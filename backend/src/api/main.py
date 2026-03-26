import re
from datetime import datetime
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from scalar_fastapi import get_scalar_api_reference

from ..core.scraper import scrape_lattes

OUTPUT_RAW_DIR = Path(__file__).resolve().parents[2] / "output" / "raw"


def _slugify_nome(nome: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", nome.strip().lower()).strip("-")
    return slug or "docente"


def _salvar_html_bruto(nome: str, html_completo: str) -> str:
    OUTPUT_RAW_DIR.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    filename = f"{_slugify_nome(nome)}-{timestamp}.html"
    destino = OUTPUT_RAW_DIR / filename
    destino.write_text(html_completo, encoding="utf-8")
    return filename


app = FastAPI(
    title="Lattes Scraper API", version="0.1.0", docs_url=None, redoc_url=None
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class ScrapeRequest(BaseModel):
    nome: str


@app.post("/scrape")
async def scrape(request: ScrapeRequest):
    nome = request.nome.strip()
    if not nome:
        raise HTTPException(status_code=400, detail="Informe o nome do docente.")

    try:
        resultado = await scrape_lattes(nome)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    html_completo = resultado.pop("html_completo", "")
    filename = _salvar_html_bruto(nome, html_completo)

    return {
        **resultado,
        "arquivo_html": filename,
        "download_html_url": f"/download/raw/{filename}",
    }


@app.get("/download/raw/{filename}")
async def download_raw_html(filename: str):
    if "/" in filename or "\\" in filename:
        raise HTTPException(status_code=400, detail="Nome de arquivo inválido.")

    file_path = OUTPUT_RAW_DIR / filename
    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=404, detail="Arquivo não encontrado.")

    return FileResponse(
        path=file_path,
        media_type="text/html",
        filename=filename,
    )


@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}


@app.get("/docs", include_in_schema=False)
async def scalar_docs():
    return get_scalar_api_reference(
        openapi_url="/openapi.json", title="Lattes Scraper API"
    )
