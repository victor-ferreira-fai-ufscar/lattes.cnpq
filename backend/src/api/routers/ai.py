from time import perf_counter

from fastapi import APIRouter, HTTPException

from ...core.scraper import scrape_lattes_text
from ...core.summarizer import listar_modelos, resumir_curriculo
from ...libs.logging import build_logger
from ...models import ModelsRequest, SummarizeRequest

router = APIRouter()


@router.post("/summarize")
async def summarize(request: SummarizeRequest):
    t_total = perf_counter()
    logs: list[str] = []
    add_log = build_logger(logs)

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

    add_log(
        f"Enviando texto para IA (provedor='{request.provedor}', modelo='{request.modelo}')."
    )
    t_ai = perf_counter()
    try:
        resumo = await resumir_curriculo(
            texto,
            api_key=request.api_key,
            modelo=request.modelo,
            provedor=request.provedor,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Erro ao chamar a IA: {exc}",
        ) from exc

    add_log(f"Resumo gerado em {(perf_counter() - t_ai):.1f}s.")
    add_log("Request /summarize finalizada com sucesso.")

    return {
        "nome": nome,
        "resumo": resumo,
        "logs": logs,
        "duracao_segundos": round(perf_counter() - t_total, 2),
    }


@router.post("/models")
async def models(request: ModelsRequest):
    t_total = perf_counter()
    provedor = (request.provedor or "openai").strip().lower()

    try:
        modelos = await listar_modelos(provedor=provedor, api_key=request.api_key)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Erro ao listar modelos do provedor '{provedor}': {exc}",
        ) from exc

    return {
        "provedor": provedor,
        "total": len(modelos),
        "modelos": modelos,
        "duracao_segundos": round(perf_counter() - t_total, 2),
    }
