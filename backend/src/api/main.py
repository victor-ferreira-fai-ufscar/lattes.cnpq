import re
import unicodedata
from datetime import date, datetime

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from scalar_fastapi import get_scalar_api_reference

from ..core.scraper import scrape_lattes
from ..core.storage import upload_curriculo_pdf


def _slugify_nome(nome: str) -> str:
    # Decompõe caracteres acentuados e remove os diacríticos (ex: "Amélia" → "amelia")
    sem_acento = unicodedata.normalize("NFD", nome.strip().lower())
    sem_acento = sem_acento.encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-z0-9]+", "-", sem_acento).strip("-")
    return slug or "docente"


def _build_curriculo_filename(nome: str, ultima_atualizacao: date) -> str:
    data = ultima_atualizacao.strftime("%Y-%m-%d")
    filename = f"{_slugify_nome(nome)}-{data}.pdf"
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
        scrape_result = await scrape_lattes(nome)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    filename = _build_curriculo_filename(nome, scrape_result.ultima_atualizacao)

    try:
        upload_result = upload_curriculo_pdf(filename, scrape_result.pdf_bytes)
    except ValueError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Falha ao enviar arquivo para o Supabase Storage: {exc}",
        ) from exc

    return {
        "nome": nome,
        "ultima_atualizacao_curriculo": scrape_result.ultima_atualizacao.isoformat(),
        "arquivo_pdf": filename,
        "storage_path": upload_result.object_path,
        "download_pdf_url": upload_result.download_url,
    }


@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}


@app.get("/docs", include_in_schema=False)
async def scalar_docs():
    return get_scalar_api_reference(
        openapi_url="/openapi.json", title="Lattes Scraper API"
    )
