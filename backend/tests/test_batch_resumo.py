import types
from datetime import date

from src.api.routers import batch as batch_router
from src.core.perfil_externo import NoticiaExterna, PerfilExterno


class _FakeBundle:
    def __init__(self) -> None:
        self.generated_files: list = []
        self.output_label = "Fulano de Tal - 2026-01-01"
        self.artifacts_cache_status = "miss"


def _patch_common(monkeypatch) -> None:
    """Isola _process_batch de I/O: cache miss + scrape/upload/artefatos falsos."""
    monkeypatch.setattr(batch_router, "find_fresh_curriculo_pdf", lambda *a, **k: None)

    async def fake_scrape(_):
        return types.SimpleNamespace(
            pdf_bytes=b"%PDF-1.4 fake%",
            ultima_atualizacao=date(2026, 1, 1),
            html_text="texto html do curriculo",
            html_source="<html><body>raw</body></html>",
            photo_bytes=None,
            photo_content_type=None,
        )

    monkeypatch.setattr(batch_router, "scrape_lattes", fake_scrape)
    monkeypatch.setattr(
        batch_router,
        "upload_curriculo_pdf",
        lambda filename, pdf_bytes: types.SimpleNamespace(
            object_path=f"raw/{filename}", download_url=f"https://x/{filename}"
        ),
    )
    monkeypatch.setattr(
        batch_router, "build_curriculo_history_payload", lambda nome: {}
    )
    monkeypatch.setattr(batch_router, "artifacts_to_payload", lambda bundle: {})
    monkeypatch.setattr(
        batch_router,
        "extrair_textos_curriculo",
        lambda pdf_bytes, html_text=None, html_source=None: (
            "texto base",
            "texto pdf",
            "texto html",
        ),
    )


async def test_batch_gera_resumo_quando_habilitado(monkeypatch) -> None:
    _patch_common(monkeypatch)

    capturado: dict = {}

    def fake_ensure(**kwargs):
        capturado["resumo_ia"] = kwargs.get("resumo_ia")
        return _FakeBundle()

    monkeypatch.setattr(batch_router, "ensure_curriculo_artifacts", fake_ensure)

    async def fake_resumir(texto, **kwargs):
        assert kwargs.get("secao") is None  # lote sempre resume o currículo completo
        return "## Resumo\n\nConteúdo gerado por IA."

    monkeypatch.setattr(batch_router, "resumir_curriculo", fake_resumir)

    result = await batch_router._process_batch(
        arquivo_nome="docentes.csv",
        nomes_all=["Fulano de Tal"],
        nomes=["Fulano de Tal"],
        skip_value=0,
        limit_value=1,
        gerar_resumo=True,
    )

    assert result["sucesso"] == 1
    assert result["erro"] == 0
    assert result["resumos_gerados"] == 1
    assert result["resumos_erros"] == 0
    # O resumo é repassado ao exporter para embutir no DOCX/HTML.
    assert capturado["resumo_ia"] == "## Resumo\n\nConteúdo gerado por IA."

    item = result["resultados"][0]
    assert item["status"] == "sucesso"
    assert item["resumo_status"] == "ok"
    assert item["resumo"] == "## Resumo\n\nConteúdo gerado por IA."
    assert "resumo_duracao_segundos" in item


async def test_batch_nao_gera_resumo_por_padrao(monkeypatch) -> None:
    _patch_common(monkeypatch)
    monkeypatch.setattr(
        batch_router, "ensure_curriculo_artifacts", lambda **k: _FakeBundle()
    )

    chamou = {"resumir": False}

    async def fake_resumir(*a, **k):
        chamou["resumir"] = True
        return "não deveria ser chamado"

    monkeypatch.setattr(batch_router, "resumir_curriculo", fake_resumir)

    result = await batch_router._process_batch(
        arquivo_nome="docentes.csv",
        nomes_all=["Fulano de Tal"],
        nomes=["Fulano de Tal"],
        skip_value=0,
        limit_value=1,
    )

    assert chamou["resumir"] is False
    assert result["sucesso"] == 1
    assert result["resumos_gerados"] == 0
    assert result["resumos_erros"] == 0
    item = result["resultados"][0]
    assert "resumo" not in item
    assert "resumo_status" not in item


async def test_batch_falha_resumo_nao_derruba_item(monkeypatch) -> None:
    _patch_common(monkeypatch)

    capturado: dict = {}

    def fake_ensure(**kwargs):
        capturado["resumo_ia"] = kwargs.get("resumo_ia")
        return _FakeBundle()

    monkeypatch.setattr(batch_router, "ensure_curriculo_artifacts", fake_ensure)

    async def fake_resumir_raises(*a, **k):
        raise RuntimeError("Ollama indisponível")

    monkeypatch.setattr(batch_router, "resumir_curriculo", fake_resumir_raises)

    result = await batch_router._process_batch(
        arquivo_nome="docentes.csv",
        nomes_all=["Fulano de Tal"],
        nomes=["Fulano de Tal"],
        skip_value=0,
        limit_value=1,
        gerar_resumo=True,
    )

    # Falha no resumo não conta como erro do CV nem aborta o lote.
    assert result["sucesso"] == 1
    assert result["erro"] == 0
    assert result["resumos_gerados"] == 0
    assert result["resumos_erros"] == 1
    assert capturado["resumo_ia"] is None  # exporter não embute resumo quebrado

    item = result["resultados"][0]
    assert item["status"] == "sucesso"
    assert item["resumo_status"] == "erro"
    assert item["resumo"] is None
    assert "resumo_erro" in item


def _perfil_com_noticia(confianca: str) -> PerfilExterno:
    return PerfilExterno(
        nome_busca="Fulano de Tal",
        confianca=confianca,
        score=6,
        openalex_author_id="https://openalex.org/A1",
        noticias=(
            NoticiaExterna(
                titulo="Fulano assume nova diretoria",
                url="https://exemplo.com/diretoria",
                veiculo="Jornal Local",
                data=date(2026, 8, 4),
            ),
        ),
    )


def _patch_perfil(monkeypatch, perfil: PerfilExterno) -> dict:
    """Substitui a coleta externa por um perfil fixo e captura o que a IA recebe."""
    monkeypatch.setattr(
        batch_router, "iniciar_perfil_externo", lambda nome, add_log: None
    )

    async def fake_resolver(task, **kwargs):
        return perfil

    monkeypatch.setattr(batch_router, "resolver_perfil_externo", fake_resolver)
    monkeypatch.setattr(
        batch_router, "ensure_curriculo_artifacts", lambda **k: _FakeBundle()
    )

    capturado: dict = {}

    async def fake_resumir(texto, **kwargs):
        capturado["noticias"] = kwargs.get("noticias")
        return "## Resumo"

    monkeypatch.setattr(batch_router, "resumir_curriculo", fake_resumir)
    return capturado


async def test_batch_passa_noticias_do_perfil_publicavel_ao_resumo(monkeypatch) -> None:
    _patch_common(monkeypatch)
    capturado = _patch_perfil(monkeypatch, _perfil_com_noticia("alta"))

    result = await batch_router._process_batch(
        arquivo_nome="docentes.csv",
        nomes_all=["Fulano de Tal"],
        nomes=["Fulano de Tal"],
        skip_value=0,
        limit_value=1,
        gerar_resumo=True,
    )

    assert result["resumos_gerados"] == 1
    assert [n.titulo for n in capturado["noticias"]] == ["Fulano assume nova diretoria"]


async def test_batch_nao_passa_noticias_de_perfil_sem_confianca_alta(
    monkeypatch,
) -> None:
    """Homônimo não entra no resumo: lá a procedência do dado se dissolve."""
    _patch_common(monkeypatch)
    capturado = _patch_perfil(monkeypatch, _perfil_com_noticia("baixa"))

    result = await batch_router._process_batch(
        arquivo_nome="docentes.csv",
        nomes_all=["Fulano de Tal"],
        nomes=["Fulano de Tal"],
        skip_value=0,
        limit_value=1,
        gerar_resumo=True,
    )

    assert result["resumos_gerados"] == 1
    assert capturado["noticias"] == ()
