from datetime import datetime

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from scalar_fastapi import get_scalar_api_reference

from ..core.scraper import scrape_lattes

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
    return await scrape_lattes(nome)


@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}


@app.get("/docs", include_in_schema=False)
async def scalar_docs():
    return get_scalar_api_reference(
        openapi_url="/openapi.json", title="Lattes Scraper API"
    )
