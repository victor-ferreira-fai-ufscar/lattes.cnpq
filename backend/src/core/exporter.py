import csv
import json
import os
import zipfile
from dataclasses import asdict, dataclass
from datetime import date, datetime
from html import escape
from io import StringIO
from pathlib import Path
from typing import Literal
from urllib.parse import quote

from .scraper import _extrair_texto_pdf_bytes
from ..libs.filename import slugify_nome

OutputFormat = Literal["pdf", "docx", "json", "html", "csv", "all"]

DEFAULT_OUTPUT_FORMAT: OutputFormat = "docx"
_FORMAT_ORDER: tuple[OutputFormat, ...] = ("docx", "json", "html", "csv", "pdf")
_SUPPORTED_FORMATS: set[str] = set(_FORMAT_ORDER) | {"all"}
_REPO_ROOT = Path(__file__).resolve().parents[3]
_BACKEND_ROOT = _REPO_ROOT / "backend"
_DEFAULT_OUTPUTS_ROOT = _BACKEND_ROOT / "output" / "structured" / "outputs"
_DEFAULT_OUTPUTS_ROUTE = "/outputs"
_DOCX_TEMPLATES_DIR = _REPO_ROOT / "docs" / "docx"


@dataclass(frozen=True)
class GeneratedArtifact:
    format: str
    filename: str
    relative_path: str
    download_url: str
    content_type: str


@dataclass(frozen=True)
class GeneratedArtifactBundle:
    output_format: str
    output_directory: str
    generated_files: list[GeneratedArtifact]
    extracted_text_length: int
    template_name: str | None = None


def normalize_output_format(value: str | None) -> OutputFormat:
    normalized = (value or DEFAULT_OUTPUT_FORMAT).strip().lower()
    if normalized not in _SUPPORTED_FORMATS:
        supported = ", ".join(sorted(_SUPPORTED_FORMATS))
        raise ValueError(
            f"Formato de saída inválido: '{value}'. Use um destes: {supported}."
        )
    return normalized  # type: ignore[return-value]


def expand_output_formats(output_format: OutputFormat) -> list[OutputFormat]:
    if output_format == "all":
        return list(_FORMAT_ORDER)
    return [output_format]


def ensure_outputs_root() -> Path:
    root = Path(
        os.getenv("LATTES_OUTPUTS_DIR", str(_DEFAULT_OUTPUTS_ROOT)).strip()
        or _DEFAULT_OUTPUTS_ROOT
    )
    root.mkdir(parents=True, exist_ok=True)
    return root


def outputs_route_prefix() -> str:
    route = os.getenv("LATTES_OUTPUTS_ROUTE", _DEFAULT_OUTPUTS_ROUTE).strip()
    route = route or _DEFAULT_OUTPUTS_ROUTE
    if not route.startswith("/"):
        route = f"/{route}"
    return route.rstrip("/") or _DEFAULT_OUTPUTS_ROUTE


def create_individual_output_dir(nome: str) -> tuple[Path, str]:
    slug = slugify_nome(nome)
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    relative_dir = Path("individual") / slug / timestamp
    absolute_dir = ensure_outputs_root() / relative_dir
    absolute_dir.mkdir(parents=True, exist_ok=True)
    return absolute_dir, relative_dir.as_posix()


def create_batch_output_dir() -> tuple[Path, str, str]:
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    batch_id = f"lote-{timestamp}"
    relative_dir = Path("batches") / batch_id
    absolute_dir = ensure_outputs_root() / relative_dir
    absolute_dir.mkdir(parents=True, exist_ok=True)
    return absolute_dir, relative_dir.as_posix(), batch_id


def create_batch_person_output_dir(
    batch_relative_dir: str, nome: str
) -> tuple[Path, str]:
    relative_dir = Path(batch_relative_dir) / slugify_nome(nome)
    absolute_dir = ensure_outputs_root() / relative_dir
    absolute_dir.mkdir(parents=True, exist_ok=True)
    return absolute_dir, relative_dir.as_posix()


def build_outputs_download_url(relative_path: str) -> str:
    encoded_path = quote(relative_path.strip("/"), safe="/")
    return f"{outputs_route_prefix()}/{encoded_path}"


def build_absolute_outputs_dir() -> str:
    return str(ensure_outputs_root())


def _select_docx_template(nome: str) -> Path | None:
    if not _DOCX_TEMPLATES_DIR.exists():
        return None

    candidates = sorted(_DOCX_TEMPLATES_DIR.glob("*.docx"))
    if not candidates:
        return None

    nome_slug = slugify_nome(nome)
    for candidate in candidates:
        candidate_slug = slugify_nome(candidate.stem)
        if nome_slug in candidate_slug or candidate_slug in nome_slug:
            return candidate

    return candidates[0]


def _write_json_artifact(
    destination: Path,
    *,
    nome: str,
    ultima_atualizacao: date,
    cache_status: str | None,
    pdf_filename: str,
    pdf_storage_path: str,
    pdf_download_url: str,
    texto_extraido: str,
    template_name: str | None,
) -> None:
    payload = {
        "nome": nome,
        "ultima_atualizacao_curriculo": ultima_atualizacao.isoformat(),
        "cache_status": cache_status,
        "arquivo_pdf": pdf_filename,
        "storage_path": pdf_storage_path,
        "download_pdf_url": pdf_download_url,
        "template_docx": template_name,
        "gerado_em": datetime.now().isoformat(),
        "texto_extraido": texto_extraido,
    }
    destination.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def _write_html_artifact(
    destination: Path,
    *,
    nome: str,
    ultima_atualizacao: date,
    cache_status: str | None,
    texto_extraido: str,
) -> None:
    html = f"""<!DOCTYPE html>
<html lang=\"pt-BR\">
  <head>
    <meta charset=\"utf-8\" />
    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />
    <title>Currículo Lattes - {escape(nome)}</title>
    <style>
      :root {{
        color-scheme: light;
        --bg: #f6f7f4;
        --panel: #fffdf7;
        --line: #d8d7c8;
        --ink: #162126;
        --muted: #5e6a72;
        --accent: #166534;
      }}
      * {{ box-sizing: border-box; }}
      body {{
        margin: 0;
        font-family: Georgia, \"Times New Roman\", serif;
        background:
          radial-gradient(circle at top left, rgba(22, 101, 52, 0.08), transparent 30%),
          linear-gradient(180deg, #fafaf7 0%, var(--bg) 100%);
        color: var(--ink);
      }}
      main {{
        width: min(960px, calc(100% - 32px));
        margin: 32px auto;
        padding: 32px;
        border: 1px solid var(--line);
        border-radius: 24px;
        background: var(--panel);
        box-shadow: 0 30px 80px -48px rgba(15, 23, 42, 0.45);
      }}
      h1 {{ margin: 0 0 8px; font-size: clamp(2rem, 4vw, 3rem); }}
      .meta {{ color: var(--muted); margin-bottom: 24px; }}
      .badge {{
        display: inline-flex;
        padding: 6px 12px;
        border-radius: 999px;
        background: rgba(22, 101, 52, 0.1);
        color: var(--accent);
        font-size: 0.875rem;
        font-weight: 700;
      }}
      pre {{
        white-space: pre-wrap;
        word-break: break-word;
        line-height: 1.7;
        margin: 0;
        font-family: inherit;
      }}
      section {{ margin-top: 24px; }}
      h2 {{ margin-bottom: 12px; font-size: 1.2rem; }}
    </style>
  </head>
  <body>
    <main>
      <span class=\"badge\">Exportação Lattes</span>
      <h1>{escape(nome)}</h1>
      <p class=\"meta\">Última atualização do currículo: {escape(ultima_atualizacao.isoformat())} | Origem: {escape(cache_status or 'não informada')}</p>
      <section>
        <h2>Texto extraído</h2>
        <pre>{escape(texto_extraido)}</pre>
      </section>
    </main>
  </body>
</html>
"""
    destination.write_text(html, encoding="utf-8")


def _write_csv_artifact(
    destination: Path,
    *,
    nome: str,
    ultima_atualizacao: date,
    cache_status: str | None,
    pdf_filename: str,
    pdf_storage_path: str,
    pdf_download_url: str,
    texto_extraido: str,
) -> None:
    buffer = StringIO()
    writer = csv.DictWriter(
        buffer,
        fieldnames=[
            "nome",
            "ultima_atualizacao_curriculo",
            "cache_status",
            "arquivo_pdf",
            "storage_path",
            "download_pdf_url",
            "texto_extraido",
        ],
    )
    writer.writeheader()
    writer.writerow(
        {
            "nome": nome,
            "ultima_atualizacao_curriculo": ultima_atualizacao.isoformat(),
            "cache_status": cache_status or "",
            "arquivo_pdf": pdf_filename,
            "storage_path": pdf_storage_path,
            "download_pdf_url": pdf_download_url,
            "texto_extraido": " ".join(texto_extraido.split()),
        }
    )
    destination.write_text(buffer.getvalue(), encoding="utf-8")


def _write_docx_artifact(
    destination: Path,
    *,
    nome: str,
    ultima_atualizacao: date,
    cache_status: str | None,
    texto_extraido: str,
    template_path: Path | None,
) -> None:
    try:
        from docx import Document
    except ImportError as exc:
        raise ValueError(
            "Dependência 'python-docx' não encontrada. Atualize o backend com 'uv sync'."
        ) from exc

    document = Document(str(template_path)) if template_path else Document()
    if template_path:
        document.add_page_break()

    document.add_heading(nome, level=1)
    document.add_paragraph(
        f"Última atualização do currículo: {ultima_atualizacao.isoformat()}"
    )
    document.add_paragraph(f"Origem: {cache_status or 'não informada'}")
    document.add_heading("Texto extraído do currículo", level=2)

    for block in [
        segment.strip() for segment in texto_extraido.split("\n\n") if segment.strip()
    ]:
        document.add_paragraph(block)

    document.save(destination)


def export_curriculo_artifacts(
    *,
    nome: str,
    ultima_atualizacao: date,
    pdf_filename: str,
    pdf_storage_path: str,
    pdf_download_url: str,
    pdf_bytes: bytes,
    output_format: OutputFormat,
    output_directory: Path,
    relative_output_directory: str,
    cache_status: str | None = None,
) -> GeneratedArtifactBundle:
    slug = slugify_nome(nome)
    output_directory.mkdir(parents=True, exist_ok=True)
    texto_extraido = _extrair_texto_pdf_bytes(pdf_bytes).strip()
    template_path = _select_docx_template(nome)
    template_name = template_path.name if template_path else None
    requested_formats = expand_output_formats(output_format)
    generated_files: list[GeneratedArtifact] = []

    file_specs: dict[str, tuple[str, str]] = {
        "pdf": (f"{slug}.pdf", "application/pdf"),
        "docx": (
            f"{slug}.docx",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ),
        "json": (f"{slug}.json", "application/json"),
        "html": (f"{slug}.html", "text/html"),
        "csv": (f"{slug}.csv", "text/csv"),
    }

    for file_format in requested_formats:
        filename, content_type = file_specs[file_format]
        destination = output_directory / filename

        if file_format == "pdf":
            destination.write_bytes(pdf_bytes)
        elif file_format == "json":
            _write_json_artifact(
                destination,
                nome=nome,
                ultima_atualizacao=ultima_atualizacao,
                cache_status=cache_status,
                pdf_filename=pdf_filename,
                pdf_storage_path=pdf_storage_path,
                pdf_download_url=pdf_download_url,
                texto_extraido=texto_extraido,
                template_name=template_name,
            )
        elif file_format == "html":
            _write_html_artifact(
                destination,
                nome=nome,
                ultima_atualizacao=ultima_atualizacao,
                cache_status=cache_status,
                texto_extraido=texto_extraido,
            )
        elif file_format == "csv":
            _write_csv_artifact(
                destination,
                nome=nome,
                ultima_atualizacao=ultima_atualizacao,
                cache_status=cache_status,
                pdf_filename=pdf_filename,
                pdf_storage_path=pdf_storage_path,
                pdf_download_url=pdf_download_url,
                texto_extraido=texto_extraido,
            )
        elif file_format == "docx":
            _write_docx_artifact(
                destination,
                nome=nome,
                ultima_atualizacao=ultima_atualizacao,
                cache_status=cache_status,
                texto_extraido=texto_extraido,
                template_path=template_path,
            )

        relative_path = f"{relative_output_directory}/{filename}"
        generated_files.append(
            GeneratedArtifact(
                format=file_format,
                filename=filename,
                relative_path=relative_path,
                download_url=build_outputs_download_url(relative_path),
                content_type=content_type,
            )
        )

    return GeneratedArtifactBundle(
        output_format=output_format,
        output_directory=relative_output_directory,
        generated_files=generated_files,
        extracted_text_length=len(texto_extraido),
        template_name=template_name,
    )


def create_batch_zip(
    *,
    batch_output_directory: Path,
    relative_batch_output_directory: str,
    batch_id: str,
) -> GeneratedArtifact:
    zip_filename = f"{batch_id}.zip"
    zip_path = batch_output_directory / zip_filename

    with zipfile.ZipFile(
        zip_path, mode="w", compression=zipfile.ZIP_DEFLATED
    ) as zip_file:
        for path in sorted(batch_output_directory.rglob("*")):
            if not path.is_file() or path == zip_path:
                continue
            zip_file.write(path, arcname=path.relative_to(batch_output_directory))

    relative_path = f"{relative_batch_output_directory}/{zip_filename}"
    return GeneratedArtifact(
        format="zip",
        filename=zip_filename,
        relative_path=relative_path,
        download_url=build_outputs_download_url(relative_path),
        content_type="application/zip",
    )


def artifacts_to_payload(bundle: GeneratedArtifactBundle) -> dict[str, object]:
    return {
        "output_format": bundle.output_format,
        "output_directory": bundle.output_directory,
        "generated_files": [asdict(file) for file in bundle.generated_files],
        "extracted_text_length": bundle.extracted_text_length,
        "template_name": bundle.template_name,
    }
