from datetime import date
from pathlib import Path

from docx import Document

from src.core import exporter


def test_export_curriculo_artifacts_generates_requested_files(monkeypatch, tmp_path):
    outputs_dir = tmp_path / "outputs"
    templates_dir = tmp_path / "templates"
    templates_dir.mkdir(parents=True)

    template_path = templates_dir / "antonio-jose-modelo.docx"
    document = Document()
    document.add_paragraph("Template base")
    document.save(template_path)

    monkeypatch.setenv("LATTES_OUTPUTS_DIR", str(outputs_dir))
    monkeypatch.setenv("LATTES_OUTPUTS_ROUTE", "/outputs")
    monkeypatch.setattr(exporter, "_DOCX_TEMPLATES_DIR", templates_dir)

    bundle = exporter.export_curriculo_artifacts(
        nome="Antonio Jose Goncalves da Cruz",
        ultima_atualizacao=date(2026, 4, 3),
        pdf_filename="antonio-jose-goncalves-da-cruz-2026-04-03.pdf",
        pdf_storage_path="raw/antonio-jose-goncalves-da-cruz-2026-04-03.pdf",
        pdf_download_url="https://example.com/raw/antonio-jose-goncalves-da-cruz-2026-04-03.pdf",
        pdf_bytes=b"%PDF-1.4 invalid but acceptable for fallback%",
        output_format="all",
        output_directory=outputs_dir
        / "individual"
        / "antonio-jose-goncalves-da-cruz"
        / "20260403-120000",
        relative_output_directory="individual/antonio-jose-goncalves-da-cruz/20260403-120000",
        cache_status="hit",
    )

    assert bundle.output_format == "all"
    assert bundle.template_name == template_path.name
    assert [item.format for item in bundle.generated_files] == [
        "docx",
        "json",
        "html",
        "csv",
        "pdf",
    ]

    generated_paths = [
        outputs_dir / Path(item.relative_path) for item in bundle.generated_files
    ]
    assert all(path.exists() for path in generated_paths)
    assert all(
        item.download_url.startswith("/outputs/") for item in bundle.generated_files
    )


def test_create_batch_zip_packages_generated_directories(monkeypatch, tmp_path):
    outputs_dir = tmp_path / "outputs"
    batch_dir = outputs_dir / "batches" / "lote-20260403-120000"
    person_dir = batch_dir / "antonio-jose"
    person_dir.mkdir(parents=True)
    (person_dir / "antonio-jose.docx").write_text("docx-placeholder", encoding="utf-8")
    (person_dir / "antonio-jose.json").write_text("{}", encoding="utf-8")

    monkeypatch.setenv("LATTES_OUTPUTS_DIR", str(outputs_dir))
    monkeypatch.setenv("LATTES_OUTPUTS_ROUTE", "/outputs")

    artifact = exporter.create_batch_zip(
        batch_output_directory=batch_dir,
        relative_batch_output_directory="batches/lote-20260403-120000",
        batch_id="lattes-lote-20260403-120000",
    )

    assert artifact.filename == "lattes-lote-20260403-120000.zip"
    assert (
        artifact.download_url
        == "/outputs/batches/lote-20260403-120000/lattes-lote-20260403-120000.zip"
    )
    assert (batch_dir / artifact.filename).exists()
