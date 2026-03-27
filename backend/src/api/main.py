import re
import unicodedata
from datetime import date, datetime
from time import perf_counter

from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from scalar_fastapi import get_scalar_api_reference

from ..core.scraper import scrape_lattes, scrape_lattes_text
from ..core.storage import upload_curriculo_pdf
from ..core.summarizer import resumir_curriculo


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


class SummarizeRequest(BaseModel):
    nome: str
    api_key: Optional[str] = None
    modelo: str = "gpt-4o-mini"


def _stamp() -> str:
    return datetime.now().strftime("%H:%M:%S")


@app.post("/scrape")
async def scrape(request: ScrapeRequest):
    t_total = perf_counter()
    logs: list[str] = []

    def add_log(message: str) -> None:
        logs.append(f"[{_stamp()}] {message}")

    nome = request.nome.strip()
    add_log("Request /scrape recebida.")
    if not nome:
        raise HTTPException(status_code=400, detail="Informe o nome do docente.")

    add_log(f"Iniciando scraping do currículo de '{nome}'.")
    t_scrape = perf_counter()
    try:
        scrape_result = await scrape_lattes(nome)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    add_log(
        "Scraping concluído em "
        f"{(perf_counter() - t_scrape):.1f}s. "
        f"Data do currículo: {scrape_result.ultima_atualizacao.isoformat()}."
    )

    filename = _build_curriculo_filename(nome, scrape_result.ultima_atualizacao)
    add_log(f"Enviando PDF para Storage como '{filename}'.")

    t_upload = perf_counter()
    try:
        upload_result = upload_curriculo_pdf(filename, scrape_result.pdf_bytes)
    except ValueError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Falha ao enviar arquivo para o Supabase Storage: {exc}",
        ) from exc
    add_log(
        "Upload concluído em "
        f"{(perf_counter() - t_upload):.1f}s para '{upload_result.object_path}'."
    )
    add_log("Request /scrape finalizada com sucesso.")

    return {
        "nome": nome,
        "ultima_atualizacao_curriculo": scrape_result.ultima_atualizacao.isoformat(),
        "arquivo_pdf": filename,
        "storage_path": upload_result.object_path,
        "download_pdf_url": upload_result.download_url,
        "logs": logs,
        "duracao_segundos": round(perf_counter() - t_total, 2),
    }


@app.post("/summarize")
async def summarize(request: SummarizeRequest):
    t_total = perf_counter()
    logs: list[str] = []

    def add_log(message: str) -> None:
        logs.append(f"[{_stamp()}] {message}")

    nome = request.nome.strip()
    add_log("Request /summarize recebida.")
    if not nome:
        raise HTTPException(status_code=400, detail="Informe o nome do docente.")

    add_log(f"Coletando texto bruto do currículo de '{nome}'.")
    t_scrape = perf_counter()
    try:
        texto = await scrape_lattes_text(nome)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    add_log(
        "Texto do currículo coletado em "
        f"{(perf_counter() - t_scrape):.1f}s ({len(texto)} caracteres)."
    )

    add_log(f"Enviando texto para OpenAI com modelo '{request.modelo}'.")
    t_openai = perf_counter()
    try:
        resumo = await resumir_curriculo(
            texto,
            api_key=request.api_key,
            modelo=request.modelo,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Erro ao chamar a OpenAI: {exc}",
        ) from exc
    add_log(f"Resumo gerado em {(perf_counter() - t_openai):.1f}s.")
    add_log("Request /summarize finalizada com sucesso.")

    return {
        "nome": nome,
        "resumo": resumo,
        "logs": logs,
        "duracao_segundos": round(perf_counter() - t_total, 2),
    }


@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}


@app.get("/docs", include_in_schema=False)
async def scalar_docs():
    return get_scalar_api_reference(
        openapi_url="/openapi.json", title="Lattes Scraper API"
    )
