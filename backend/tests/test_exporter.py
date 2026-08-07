import json
from datetime import date, datetime, timezone
from io import BytesIO

from docx import Document

from src.core import exporter, storage
from src.core.perfil_externo import NoticiaExterna, ObraExterna, PerfilExterno

_RESUMO_MD = (
    "```markdown\n"
    "## Visão geral\n\n"
    "> Este é o RESUMOTESTE123 do currículo, gerado por IA.\n\n"
    "- ponto **um**\n"
    "- ponto dois\n"
    "```\n"
)


def _docx_text(data: bytes) -> str:
    document = Document(BytesIO(data))
    linhas = [p.text for p in document.paragraphs]
    for table in document.tables:
        for row in table.rows:
            for cell in row.cells:
                linhas.extend(p.text for p in cell.paragraphs)
    return "\n".join(linhas)


def _artifact_bytes(fake, bundle, fmt: str) -> bytes:
    artifact = next(item for item in bundle.generated_files if item.format == fmt)
    return fake.files[artifact.relative_path][0]


class _FakeStorageState:
    def __init__(self):
        self.files: dict[str, tuple[bytes, str]] = {}
        self.upload_calls: list[str] = []

    def upload(
        self, filename: str, file_bytes: bytes, *, content_type: str, folder: str
    ):
        object_path = f"{folder}/{filename}"
        self.files[object_path] = (file_bytes, content_type)
        self.upload_calls.append(object_path)
        return storage.StorageUploadResult(
            object_path=object_path,
            download_url=f"https://storage.example/{object_path}",
        )

    def list_files(self, folder: str):
        prefix = f"{folder}/"
        results: list[storage.StorageFileResult] = []
        for object_path, (_, content_type) in sorted(self.files.items()):
            if not object_path.startswith(prefix):
                continue
            filename = object_path.removeprefix(prefix)
            results.append(
                storage.StorageFileResult(
                    object_path=object_path,
                    filename=filename,
                    download_url=f"https://storage.example/{object_path}",
                    last_modified=datetime(2026, 4, 4, tzinfo=timezone.utc),
                    content_type=content_type,
                )
            )
        return results

    def download(self, object_path: str) -> bytes | None:
        item = self.files.get(object_path)
        return item[0] if item else None


def test_ensure_curriculo_artifacts_uses_storage_cache(monkeypatch):
    fake = _FakeStorageState()

    monkeypatch.setenv("SUPABASE_STORAGE_STRUCTURED_FOLDER", "structured/outputs")
    monkeypatch.setenv("LATTES_EXPORT_TEMPLATE_VERSION", "v2-test")
    monkeypatch.setattr(exporter, "upload_file_bytes", fake.upload)
    monkeypatch.setattr(exporter, "list_storage_files", fake.list_files)
    monkeypatch.setattr(exporter, "download_storage_file_bytes", fake.download)

    bundle = exporter.ensure_curriculo_artifacts(
        nome="Claudia Maria Simões Martinez",
        ultima_atualizacao=date(2026, 4, 4),
        pdf_filename="claudia-martinez-2026-04-04.pdf",
        pdf_storage_path="raw/claudia-martinez-2026-04-04.pdf",
        pdf_download_url="https://storage.example/raw/claudia-martinez-2026-04-04.pdf",
        pdf_bytes=b"%PDF-1.4 fake%",
        output_format="all",
        cache_status="hit",
    )

    assert bundle.artifacts_cache_status == "miss"
    assert (
        bundle.output_directory
        == "structured/outputs/v2-test/curriculos/claudia-maria-simoes-martinez/2026-04-04"
    )
    assert bundle.output_label == "Claudia Maria Simões Martinez - 2026-04-04"
    assert [item.format for item in bundle.generated_files] == [
        "docx",
        "json",
        "html",
        "csv",
        "pdf",
    ]
    assert bundle.generated_files[0].filename == (
        "perfil-vitrine-claudia-maria-simoes-martinez-2026-04-04.docx"
    )
    assert bundle.zip_file is not None
    assert bundle.zip_file.relative_path.endswith(
        "pacote-claudia-maria-simoes-martinez-2026-04-04.zip"
    )
    assert any(path.endswith("manifest.json") for path in fake.upload_calls)

    upload_count_after_first_run = len(fake.upload_calls)

    cached_bundle = exporter.ensure_curriculo_artifacts(
        nome="Claudia Maria Simões Martinez",
        ultima_atualizacao=date(2026, 4, 4),
        pdf_filename="claudia-martinez-2026-04-04.pdf",
        pdf_storage_path="raw/claudia-martinez-2026-04-04.pdf",
        pdf_download_url="https://storage.example/raw/claudia-martinez-2026-04-04.pdf",
        pdf_bytes=b"%PDF-1.4 fake%",
        output_format="docx",
        cache_status="hit",
    )

    assert cached_bundle.artifacts_cache_status == "hit"
    assert [item.format for item in cached_bundle.generated_files] == ["docx"]
    assert len(fake.upload_calls) == upload_count_after_first_run


def test_upload_batch_zip_saves_zip_to_storage(monkeypatch):
    fake = _FakeStorageState()
    monkeypatch.setattr(exporter, "upload_file_bytes", fake.upload)

    artifact = exporter.upload_batch_zip(
        batch_folder="structured/outputs/v2-test/lotes/lote-20260404-100000",
        batch_filename="lattes-lote-20260404-100000.zip",
        entries=[
            (
                "Claudia Maria Simões Martinez - 2026-04-04/perfil-vitrine-claudia-maria-simoes-martinez-2026-04-04.docx",
                b"docx-bytes",
            ),
            ("Claudia Maria Simões Martinez - 2026-04-04/dados-extraidos.json", b"{}"),
        ],
    )

    assert artifact.filename == "lattes-lote-20260404-100000.zip"
    assert (
        artifact.relative_path
        == "structured/outputs/v2-test/lotes/lote-20260404-100000/lattes-lote-20260404-100000.zip"
    )
    assert (
        artifact.download_url
        == "https://storage.example/structured/outputs/v2-test/lotes/lote-20260404-100000/lattes-lote-20260404-100000.zip"
    )
    assert artifact.relative_path in fake.files


def test_build_curriculo_docx_filename_uses_storage_safe_slug():
    assert (
        exporter.build_curriculo_docx_filename(
            "Víctor / Ferreira",
            date(2020, 6, 24),
        )
        == "perfil-vitrine-victor-ferreira-2020-06-24.docx"
    )


def test_ensure_curriculo_artifacts_prefers_source_html_for_html_output(monkeypatch):
    fake = _FakeStorageState()

    monkeypatch.setenv("SUPABASE_STORAGE_STRUCTURED_FOLDER", "structured/outputs")
    monkeypatch.setenv("LATTES_EXPORT_TEMPLATE_VERSION", "v3-test")
    monkeypatch.setattr(exporter, "upload_file_bytes", fake.upload)
    monkeypatch.setattr(exporter, "list_storage_files", fake.list_files)
    monkeypatch.setattr(exporter, "download_storage_file_bytes", fake.download)

    source_html = "<html><body><main><h1>Neocles Alves Pereira</h1><img src='foto.png' /></main></body></html>"

    bundle = exporter.ensure_curriculo_artifacts(
        nome="Neocles Alves Pereira",
        ultima_atualizacao=date(2020, 9, 11),
        pdf_filename="neocles-alves-pereira-2020-09-11.pdf",
        pdf_storage_path="raw/neocles-alves-pereira-2020-09-11.pdf",
        pdf_download_url="https://storage.example/raw/neocles-alves-pereira-2020-09-11.pdf",
        pdf_bytes=b"%PDF-1.4 fake%",
        output_format="html",
        cache_status="miss",
        html_source=source_html,
    )

    html_artifact = bundle.generated_files[0]
    assert html_artifact.filename == "curriculo-lattes.html"
    assert fake.files[html_artifact.relative_path][0].decode("utf-8") == source_html


def _setup_fake_storage(monkeypatch):
    fake = _FakeStorageState()
    monkeypatch.setenv("SUPABASE_STORAGE_STRUCTURED_FOLDER", "structured/outputs")
    monkeypatch.setenv("LATTES_EXPORT_TEMPLATE_VERSION", "v3-resumo-test")
    monkeypatch.setattr(exporter, "upload_file_bytes", fake.upload)
    monkeypatch.setattr(exporter, "list_storage_files", fake.list_files)
    monkeypatch.setattr(exporter, "download_storage_file_bytes", fake.download)
    return fake


def test_resumo_ia_embedded_in_docx_html_json_not_in_csv(monkeypatch):
    fake = _setup_fake_storage(monkeypatch)

    bundle = exporter.ensure_curriculo_artifacts(
        nome="Claudia Maria Simões Martinez",
        ultima_atualizacao=date(2026, 4, 4),
        pdf_filename="claudia-2026-04-04.pdf",
        pdf_storage_path="raw/claudia-2026-04-04.pdf",
        pdf_download_url="https://storage.example/raw/claudia-2026-04-04.pdf",
        pdf_bytes=b"%PDF-1.4 fake%",
        output_format="all",
        cache_status="miss",
        resumo_ia=_RESUMO_MD,
    )

    docx_text = _docx_text(_artifact_bytes(fake, bundle, "docx"))
    assert "Resumo gerado por IA" in docx_text
    assert "RESUMOTESTE123" in docx_text
    assert "ponto um" in docx_text  # marcador ** removido no DOCX
    assert "```" not in docx_text  # cerca de código removida
    assert ">" not in docx_text  # marcador de citação removido

    html_text = _artifact_bytes(fake, bundle, "html").decode("utf-8")
    assert "Resumo gerado por IA" in html_text
    assert "RESUMOTESTE123" in html_text
    assert "<li>ponto <strong>um</strong></li>" in html_text

    # No JSON o resumo entra como Markdown cru, sob a chave própria.
    json_payload = json.loads(_artifact_bytes(fake, bundle, "json").decode("utf-8"))
    assert json_payload["resumo_ia"] == _RESUMO_MD

    # O CSV fica de fora: é uma linha por docente, e o Markdown do resumo
    # inteiro não cabe numa célula.
    csv_text = _artifact_bytes(fake, bundle, "csv").decode("utf-8")
    assert "RESUMOTESTE123" not in csv_text


def test_resumo_ia_injected_into_raw_html_passthrough(monkeypatch):
    fake = _setup_fake_storage(monkeypatch)
    source_html = (
        "<html><body><main><h1>Neocles Alves Pereira</h1></main></body></html>"
    )

    bundle = exporter.ensure_curriculo_artifacts(
        nome="Neocles Alves Pereira",
        ultima_atualizacao=date(2020, 9, 11),
        pdf_filename="neocles-2020-09-11.pdf",
        pdf_storage_path="raw/neocles-2020-09-11.pdf",
        pdf_download_url="https://storage.example/raw/neocles-2020-09-11.pdf",
        pdf_bytes=b"%PDF-1.4 fake%",
        output_format="html",
        cache_status="miss",
        html_source=source_html,
        resumo_ia=_RESUMO_MD,
    )

    html_text = _artifact_bytes(fake, bundle, "html").decode("utf-8")
    # Mantém o HTML cru do Lattes e injeta o banner do resumo.
    assert "<h1>Neocles Alves Pereira</h1>" in html_text
    assert "Resumo gerado por IA" in html_text
    assert "RESUMOTESTE123" in html_text
    # O banner é inserido logo após a <body>.
    assert html_text.index("Resumo gerado por IA") < html_text.index(
        "<h1>Neocles Alves Pereira</h1>"
    )


def test_resumo_ia_forces_docx_regeneration_when_cached(monkeypatch):
    fake = _setup_fake_storage(monkeypatch)

    kwargs = dict(
        nome="Claudia Maria Simões Martinez",
        ultima_atualizacao=date(2026, 4, 4),
        pdf_filename="claudia-2026-04-04.pdf",
        pdf_storage_path="raw/claudia-2026-04-04.pdf",
        pdf_download_url="https://storage.example/raw/claudia-2026-04-04.pdf",
        pdf_bytes=b"%PDF-1.4 fake%",
        output_format="docx",
        cache_status="miss",
    )

    # 1ª geração SEM resumo (preenche o cache de artefatos).
    primeiro = exporter.ensure_curriculo_artifacts(**kwargs)
    assert "Resumo gerado por IA" not in _docx_text(
        _artifact_bytes(fake, primeiro, "docx")
    )
    uploads_apos_primeiro = len(fake.upload_calls)

    # 2ª geração COM resumo: precisa forçar regeneração mesmo com docx em cache.
    segundo = exporter.ensure_curriculo_artifacts(**kwargs, resumo_ia=_RESUMO_MD)
    assert segundo.artifacts_cache_status == "miss"
    assert len(fake.upload_calls) > uploads_apos_primeiro
    assert "RESUMOTESTE123" in _docx_text(_artifact_bytes(fake, segundo, "docx"))


def _perfil_externo(confianca: str = "alta") -> PerfilExterno:
    return PerfilExterno(
        nome_busca="Claudia Maria Simões Martinez",
        confianca=confianca,
        score=6,
        openalex_author_id="https://openalex.org/A5001",
        afiliacao="Universidade Federal de São Carlos",
        total_obras=42,
        total_citacoes=315,
        h_index=11,
        obras=(
            ObraExterna(
                titulo="OBRATESTE123 sobre terapia ocupacional",
                ano=2021,
                veiculo="Revista Brasileira de Terapia Ocupacional",
                citacoes=30,
            ),
        ),
        noticias=(
            NoticiaExterna(
                titulo="NOTICIATESTE123 na UFSCar",
                url="https://exemplo.com/noticia",
                veiculo="Jornal da Cidade",
                data=date(2026, 8, 4),
            ),
        ),
        criterios=("afiliação casa com 'UFSCar'",),
        fontes=("openalex", "google-news"),
    )


def test_perfil_externo_entra_em_docx_html_json_e_csv(monkeypatch):
    fake = _setup_fake_storage(monkeypatch)

    bundle = exporter.ensure_curriculo_artifacts(
        nome="Claudia Maria Simões Martinez",
        ultima_atualizacao=date(2026, 4, 4),
        pdf_filename="claudia-2026-04-04.pdf",
        pdf_storage_path="raw/claudia-2026-04-04.pdf",
        pdf_download_url="https://storage.example/raw/claudia-2026-04-04.pdf",
        pdf_bytes=b"%PDF-1.4 fake%",
        output_format="all",
        cache_status="miss",
        perfil_externo=_perfil_externo(),
    )

    docx_text = _docx_text(_artifact_bytes(fake, bundle, "docx"))
    assert "Produção e presença pública" in docx_text
    assert "OBRATESTE123" in docx_text
    assert "NOTICIATESTE123" in docx_text
    assert "Confira antes de divulgar" in docx_text

    html_text = _artifact_bytes(fake, bundle, "html").decode("utf-8")
    assert "OBRATESTE123" in html_text
    assert "https://exemplo.com/noticia" in html_text

    # Diferente do resumo por IA, o perfil externo também vai para JSON e CSV.
    json_text = _artifact_bytes(fake, bundle, "json").decode("utf-8")
    assert "OBRATESTE123" in json_text

    csv_text = _artifact_bytes(fake, bundle, "csv").decode("utf-8")
    assert "externo_total_citacoes" in csv_text
    assert "315" in csv_text
    # O CSV é uma linha por docente, mas os títulos cabem em célula própria.
    assert "OBRATESTE123" in csv_text
    assert "NOTICIATESTE123" in csv_text


def test_csv_junta_varias_obras_e_noticias_numa_celula(monkeypatch):
    import csv as csv_mod

    perfil = PerfilExterno(
        nome_busca="Claudia Maria Simões Martinez",
        confianca="alta",
        openalex_author_id="https://openalex.org/A5001",
        total_obras=2,
        total_citacoes=40,
        obras=(
            ObraExterna(titulo="Primeira obra", ano=2021, citacoes=30),
            # Título com quebra de linha: vem de fonte externa e não pode
            # virar célula multilinha na planilha.
            ObraExterna(titulo="Segunda\nobra", ano=2019),
        ),
        noticias=(
            NoticiaExterna(titulo="Primeira notícia", url="https://e.com/1"),
            NoticiaExterna(titulo="Segunda notícia", url="https://e.com/2"),
        ),
    )

    csv_bytes = exporter._write_csv_bytes(
        nome="Claudia Maria Simões Martinez",
        ultima_atualizacao=date(2026, 4, 4),
        cache_status="miss",
        pdf_filename="claudia.pdf",
        pdf_storage_path="raw/claudia.pdf",
        pdf_download_url="https://storage.example/raw/claudia.pdf",
        context=exporter.build_export_summary_context("Linha do currículo", "Claudia"),
        perfil_externo=perfil,
    )

    linha = next(csv_mod.DictReader(csv_bytes.decode("utf-8").splitlines()))
    assert linha["externo_obras"] == "Primeira obra (2021) [30 citações] | Segunda obra (2019)"
    assert linha["externo_noticias"] == "Primeira notícia | Segunda notícia"
    assert "\n" not in linha["externo_obras"]


def test_csv_sem_perfil_externo_deixa_as_colunas_de_titulo_vazias(monkeypatch):
    import csv as csv_mod

    csv_bytes = exporter._write_csv_bytes(
        nome="Neocles Alves Pereira",
        ultima_atualizacao=date(2020, 9, 11),
        cache_status="miss",
        pdf_filename="neocles.pdf",
        pdf_storage_path="raw/neocles.pdf",
        pdf_download_url="https://storage.example/raw/neocles.pdf",
        context=exporter.build_export_summary_context("Linha do currículo", "Neocles"),
        perfil_externo=None,
    )

    linha = next(csv_mod.DictReader(csv_bytes.decode("utf-8").splitlines()))
    assert linha["externo_obras"] == ""
    assert linha["externo_noticias"] == ""


def test_perfil_externo_de_confianca_baixa_nao_entra_nos_artefatos(monkeypatch):
    fake = _setup_fake_storage(monkeypatch)

    bundle = exporter.ensure_curriculo_artifacts(
        nome="Claudia Maria Simões Martinez",
        ultima_atualizacao=date(2026, 4, 4),
        pdf_filename="claudia-2026-04-04.pdf",
        pdf_storage_path="raw/claudia-2026-04-04.pdf",
        pdf_download_url="https://storage.example/raw/claudia-2026-04-04.pdf",
        pdf_bytes=b"%PDF-1.4 fake%",
        output_format="all",
        cache_status="miss",
        perfil_externo=_perfil_externo(confianca="media"),
    )

    docx_text = _docx_text(_artifact_bytes(fake, bundle, "docx"))
    json_text = _artifact_bytes(fake, bundle, "json").decode("utf-8")
    assert "OBRATESTE123" not in docx_text
    assert "NOTICIATESTE123" not in json_text


def test_sem_perfil_externo_os_artefatos_seguem_iguais(monkeypatch):
    fake = _setup_fake_storage(monkeypatch)

    kwargs = dict(
        nome="Neocles Alves Pereira",
        ultima_atualizacao=date(2020, 9, 11),
        pdf_filename="neocles-2020-09-11.pdf",
        pdf_storage_path="raw/neocles-2020-09-11.pdf",
        pdf_download_url="https://storage.example/raw/neocles-2020-09-11.pdf",
        pdf_bytes=b"%PDF-1.4 fake%",
        output_format="all",
        cache_status="miss",
    )

    bundle = exporter.ensure_curriculo_artifacts(**kwargs, perfil_externo=None)

    docx_text = _docx_text(_artifact_bytes(fake, bundle, "docx"))
    html_text = _artifact_bytes(fake, bundle, "html").decode("utf-8")
    json_text = _artifact_bytes(fake, bundle, "json").decode("utf-8")
    assert "Produção e presença pública" not in docx_text
    assert "Produção e presença pública" not in html_text
    assert '"perfil_externo": null' in json_text
