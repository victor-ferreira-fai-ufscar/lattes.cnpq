import re
import unicodedata
import zipfile
from datetime import date, datetime
from io import BytesIO
from time import perf_counter
from typing import Optional

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from scalar_fastapi import get_scalar_api_reference

from ..core.scraper import (
    buscar_lattes_candidatos,
    scrape_lattes,
    scrape_lattes_by_href,
    scrape_lattes_text,
)
from ..core.storage import upload_curriculo_pdf, upload_file_bytes
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
    href: Optional[str] = None


class SearchRequest(BaseModel):
    nome: str
    limit: int = 20


class SummarizeRequest(BaseModel):
    nome: str
    api_key: Optional[str] = None
    modelo: str = "gpt-4o-mini"


def _stamp() -> str:
    return datetime.now().strftime("%H:%M:%S")


def _parse_csv_names(content: bytes) -> list[str]:
    try:
        raw = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        raw = content.decode("latin-1")

    rows = [line.strip() for line in raw.splitlines() if line.strip()]

    # Remover duplicatas preservando ordem
    seen: set[str] = set()
    unique: list[str] = []
    for row in rows:
        key = row.lower().strip()
        if key not in seen:
            seen.add(key)
            unique.append(row)

    return unique


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

    if request.href:
        add_log(
            "Iniciando scraping do currículo selecionado "
            f"(nome='{nome}', href='{request.href}')."
        )
    else:
        add_log(f"Iniciando scraping do currículo de '{nome}'.")
    t_scrape = perf_counter()
    try:
        if request.href:
            scrape_result = await scrape_lattes_by_href(nome, request.href)
        else:
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


@app.post("/search")
async def search(request: SearchRequest):
    nome = request.nome.strip()
    if not nome:
        raise HTTPException(status_code=400, detail="Informe o nome do docente.")

    limit = max(1, min(request.limit, 50))

    try:
        candidatos = await buscar_lattes_candidatos(nome, limit=limit)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    return {
        "nome_busca": nome,
        "total": len(candidatos),
        "candidatos": [
            {
                "nome": candidato.nome,
                "href": candidato.href,
            }
            for candidato in candidatos
        ],
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


@app.post("/scrape/batch")
async def scrape_batch(
    arquivo: Optional[UploadFile] = File(None),
    file: Optional[UploadFile] = File(None),
    skip: str = Form("0"),
    limit: Optional[str] = Form(None),
):
    t_total = perf_counter()
    logs: list[str] = []

    def add_log(message: str) -> None:
        logs.append(f"[{_stamp()}] {message}")

    arquivo_upload = arquivo or file
    if not arquivo_upload or not arquivo_upload.filename:
        raise HTTPException(
            status_code=400,
            detail="Arquivo CSV não informado. Envie no campo 'arquivo' (ou 'file').",
        )

    try:
        skip_value = int(skip)
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="skip deve ser um número inteiro.")

    limit_value: Optional[int] = None
    if limit is not None and str(limit).strip() != "":
        try:
            limit_value = int(limit)
        except (TypeError, ValueError):
            raise HTTPException(
                status_code=400,
                detail="limit deve ser um número inteiro quando informado.",
            )

    content = await arquivo_upload.read()
    if not content:
        raise HTTPException(status_code=400, detail="Arquivo CSV vazio.")

    nomes_all = _parse_csv_names(content)
    if not nomes_all:
        raise HTTPException(status_code=400, detail="Nenhum nome válido no CSV.")

    if skip_value < 0:
        raise HTTPException(status_code=400, detail="skip deve ser maior ou igual a 0.")
    if limit_value is not None and limit_value <= 0:
        raise HTTPException(status_code=400, detail="limit deve ser maior que 0.")

    nomes = nomes_all[skip_value:]
    if limit_value is not None:
        nomes = nomes[:limit_value]

    if not nomes:
        raise HTTPException(
            status_code=400, detail="Nenhum nome selecionado após skip/limit."
        )

    add_log(f"Request /scrape/batch recebida com {len(nomes_all)} nomes únicos no CSV.")
    add_log(
        f"Processando {len(nomes)} nomes após filtros skip={skip_value}, "
        f"limit={limit_value}."
    )

    resultados: list[dict] = []
    pdfs_sucesso: list[tuple[str, bytes]] = []
    ok_count = 0
    erro_count = 0

    for idx, nome in enumerate(nomes, 1):
        add_log(f"[{idx}/{len(nomes)}] Iniciando scraping de '{nome}'.")
        t_item = perf_counter()
        try:
            scrape_result = await scrape_lattes(nome)
            filename = _build_curriculo_filename(nome, scrape_result.ultima_atualizacao)
            upload_result = upload_curriculo_pdf(filename, scrape_result.pdf_bytes)

            item = {
                "nome": nome,
                "status": "sucesso",
                "ultima_atualizacao_curriculo": scrape_result.ultima_atualizacao.isoformat(),
                "arquivo_pdf": filename,
                "storage_path": upload_result.object_path,
                "download_pdf_url": upload_result.download_url,
                "duracao_segundos": round(perf_counter() - t_item, 2),
            }
            resultados.append(item)
            pdfs_sucesso.append((filename, scrape_result.pdf_bytes))
            ok_count += 1
            add_log(
                f"[{idx}/{len(nomes)}] Sucesso para '{nome}' em {item['duracao_segundos']}s."
            )
        except Exception as exc:
            erro_count += 1
            message = str(exc)
            resultados.append(
                {
                    "nome": nome,
                    "status": "erro",
                    "erro": message,
                    "duracao_segundos": round(perf_counter() - t_item, 2),
                }
            )
            add_log(f"[{idx}/{len(nomes)}] Erro para '{nome}': {message}")

    add_log(f"Lote finalizado. Sucessos: {ok_count}. Erros: {erro_count}.")

    zip_filename = None
    zip_storage_path = None
    zip_download_url = None
    zip_error = None

    if pdfs_sucesso:
        zip_filename = f"lattes-lote-{datetime.now().strftime('%Y%m%d-%H%M%S')}.zip"
        add_log(f"Gerando ZIP consolidado com {len(pdfs_sucesso)} PDFs.")
        try:
            buffer = BytesIO()
            with zipfile.ZipFile(
                buffer,
                mode="w",
                compression=zipfile.ZIP_DEFLATED,
            ) as zip_file:
                for filename, pdf_bytes in pdfs_sucesso:
                    zip_file.writestr(filename, pdf_bytes)

            zip_upload = upload_file_bytes(
                zip_filename,
                buffer.getvalue(),
                content_type="application/zip",
            )
            zip_storage_path = zip_upload.object_path
            zip_download_url = zip_upload.download_url
            add_log("ZIP consolidado enviado para o Storage com sucesso.")
        except Exception as exc:
            zip_error = str(exc)
            add_log(f"Falha ao gerar/enviar ZIP consolidado: {zip_error}")

    return {
        "arquivo": arquivo_upload.filename,
        "total_nomes_csv": len(nomes_all),
        "total_processados": len(nomes),
        "sucesso": ok_count,
        "erro": erro_count,
        "resultados": resultados,
        "zip_arquivo": zip_filename,
        "zip_storage_path": zip_storage_path,
        "zip_download_url": zip_download_url,
        "zip_erro": zip_error,
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
