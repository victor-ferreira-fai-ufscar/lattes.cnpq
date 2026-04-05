from datetime import date, datetime, timezone

from src.core import exporter, storage


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
        "perfil-vitrine-Claudia-Maria-Simões-Martinez-2026-04-04.docx"
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
                "Claudia Maria Simões Martinez - 2026-04-04/perfil-vitrine-Claudia-Maria-Simões-Martinez-2026-04-04.docx",
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
