from time import perf_counter

from fastapi import APIRouter, HTTPException, Request

from ...core.scraper import scrape_lattes_summary_source
from ...core.summarizer import listar_modelos, resumir_curriculo
from ...libs.logging import build_logger
from ...libs.request_monitor import (
    REQUEST_ID_HEADER,
    publish_request_error,
    publish_request_start,
    request_monitor,
)
from ...models import ModelsRequest, SummarizeRequest

router = APIRouter()


@router.post("/summarize")
async def summarize(request: SummarizeRequest, http_request: Request):
    t_total = perf_counter()
    logs: list[str] = []
    request_id = http_request.headers.get(REQUEST_ID_HEADER)
    publish_request_start(
        request_id,
        operation="summarize",
        title="Gerando resumo com IA",
    )
    add_log = build_logger(
        logs,
        sink=lambda line: request_monitor.publish(request_id, "log", {"message": line}),
    )

    try:
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
                log=add_log,
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
    except HTTPException as exc:
        publish_request_error(request_id, str(exc.detail))
        raise
    except Exception as exc:
        publish_request_error(request_id, str(exc) or "Falha ao gerar resumo.")
        raise
    finally:
        request_monitor.complete(request_id)


@router.post("/models")
async def models(request: ModelsRequest, http_request: Request):
    t_total = perf_counter()
    logs: list[str] = []
    provedor = (request.provedor or "openai").strip().lower()
    request_id = http_request.headers.get(REQUEST_ID_HEADER)
    publish_request_start(
        request_id,
        operation="models",
        title="Atualizando opções de modelos",
    )
    add_log = build_logger(
        logs,
        sink=lambda line: request_monitor.publish(request_id, "log", {"message": line}),
    )

    try:
        add_log("Request /models recebida.")
        add_log(f"Consultando modelos disponíveis para o provedor '{provedor}'.")
        try:
            modelos = await listar_modelos(
                provedor=provedor,
                api_key=request.api_key,
                log=add_log,
            )
        except ValueError as exc:
            publish_request_error(request_id, str(exc))
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        except Exception as exc:
            publish_request_error(
                request_id,
                f"Erro ao listar modelos do provedor '{provedor}': {exc}",
            )
            raise HTTPException(
                status_code=502,
                detail=f"Erro ao listar modelos do provedor '{provedor}': {exc}",
            ) from exc

        add_log(f"{len(modelos)} modelo(s) recebido(s) para o provedor '{provedor}'.")
        add_log("Request /models finalizada com sucesso.")

        return {
            "provedor": provedor,
            "total": len(modelos),
            "modelos": modelos,
            "logs": logs,
            "duracao_segundos": round(perf_counter() - t_total, 2),
        }
    finally:
        request_monitor.complete(request_id)
