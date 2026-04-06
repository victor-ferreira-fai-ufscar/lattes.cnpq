from time import perf_counter

from fastapi import APIRouter, HTTPException

from ...core.scraper import scrape_lattes_summary_source
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

    add_log(f"Coletando texto do currículo de '{nome}' com prioridade para PDF.")
    t_scrape = perf_counter()
    try:
        source_result = await scrape_lattes_summary_source(nome)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    texto = source_result.texto

    if source_result.fonte == "pdf":
        add_log(
            "Texto do currículo coletado a partir do PDF "
            f"({source_result.caracteres_pdf} caracteres extraídos)."
        )
    else:
        add_log(
            "PDF indisponível ou incompleto para resumo; usando HTML da página como fallback "
            f"({source_result.caracteres_html} caracteres, PDF extraído: {source_result.caracteres_pdf})."
        )

    add_log(
        "Texto-base do currículo coletado em "
        f"{(perf_counter() - t_scrape):.1f}s ({len(texto)} caracteres)."
    )

    add_log(
        f"Enviando texto para IA (provedor='{request.provedor}', modelo='{request.modelo}')."
    )
    t_ai = perf_counter()
    try:
        resumo = await resumir_curriculo(
            texto,
            texto_pdf=source_result.texto_pdf,
            texto_html=source_result.texto_html,
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
        "fonte_resumo": source_result.fonte,
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
