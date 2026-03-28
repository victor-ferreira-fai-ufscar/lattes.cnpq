from time import perf_counter

from fastapi import APIRouter, HTTPException

from ...core.scraper import scrape_lattes, scrape_lattes_by_href
from ...core.storage import upload_curriculo_pdf
from ...libs.filename import build_curriculo_filename
from ...libs.logging import build_logger
from ...models import ScrapeRequest

router = APIRouter()


@router.post("/scrape")
async def scrape(request: ScrapeRequest):
    t_total = perf_counter()
    logs: list[str] = []
    add_log = build_logger(logs)

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

    filename = build_curriculo_filename(nome, scrape_result.ultima_atualizacao)
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
