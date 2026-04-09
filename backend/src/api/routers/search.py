from time import perf_counter

from fastapi import APIRouter, HTTPException, Request

from ...core.scraper import buscar_lattes_candidatos
from ...libs.logging import build_logger
from ...libs.request_monitor import (
    REQUEST_ID_HEADER,
    publish_request_error,
    publish_request_start,
    request_monitor,
)
from ...models import SearchRequest

router = APIRouter()


@router.post("/search")
async def search(request: SearchRequest, http_request: Request):
    t_total = perf_counter()
    logs: list[str] = []
    request_id = http_request.headers.get(REQUEST_ID_HEADER)
    publish_request_start(
        request_id,
        operation="search",
        title="Buscando pessoas no Lattes",
    )
    add_log = build_logger(
        logs,
        sink=lambda line: request_monitor.publish(request_id, "log", {"message": line}),
    )

    try:
        nome = request.nome.strip()
        add_log("Request /search recebida.")
        if not nome:
            raise HTTPException(status_code=400, detail="Informe o nome do docente.")

        limit = max(1, min(request.limit, 50))
        add_log(f"Buscando candidatos para '{nome}' com limite {limit}.")

        try:
            candidatos = await buscar_lattes_candidatos(nome, limit=limit)
        except ValueError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc

        add_log(f"Busca concluída com {len(candidatos)} candidato(s) encontrado(s).")
        add_log("Request /search finalizada com sucesso.")

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
            "logs": logs,
            "duracao_segundos": round(perf_counter() - t_total, 2),
        }
    except HTTPException as exc:
        publish_request_error(request_id, str(exc.detail))
        raise
    except Exception as exc:
        publish_request_error(request_id, str(exc) or "Falha ao buscar candidatos.")
        raise
    finally:
        request_monitor.complete(request_id)
