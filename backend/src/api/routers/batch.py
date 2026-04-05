import asyncio
import json
from time import perf_counter
from typing import Any, Callable, Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse

from ...core.exporter import (
    artifacts_to_payload,
    create_batch_storage_target,
    download_artifact_bytes,
    DEFAULT_OUTPUT_FORMAT,
    ensure_curriculo_artifacts,
    normalize_output_format,
    upload_batch_zip,
)
from ...core.scraper import scrape_lattes
from ...core.storage import (
    find_fresh_curriculo_pdf,
    upload_curriculo_pdf,
)
from ...libs.csv_utils import parse_csv_names
from ...libs.filename import build_curriculo_filename
from ...libs.logging import now_brasilia, stamp, summarize_exception
from ...models import OutputFormat

router = APIRouter()


def _sse_event(event: str, payload: Any) -> str:
    return f"event: {event}\ndata: {json.dumps(payload, ensure_ascii=False)}\n\n"


async def _prepare_batch_input(
    arquivo: Optional[UploadFile],
    file: Optional[UploadFile],
    skip: str,
    limit: Optional[str],
    output_format: str,
) -> tuple[str, list[str], list[str], int, Optional[int], OutputFormat]:
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

    nomes_all = parse_csv_names(content)
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

    try:
        normalized_output_format = normalize_output_format(output_format)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return (
        arquivo_upload.filename,
        nomes_all,
        nomes,
        skip_value,
        limit_value,
        normalized_output_format,
    )


async def _process_batch(
    *,
    arquivo_nome: str,
    nomes_all: list[str],
    nomes: list[str],
    skip_value: int,
    limit_value: Optional[int],
    output_format: OutputFormat = DEFAULT_OUTPUT_FORMAT,
    on_log: Optional[Callable[[str], None]] = None,
) -> dict[str, Any]:
    t_total = perf_counter()
    logs: list[str] = []
    batch_output_dir, batch_id = create_batch_storage_target()
    batch_zip_entries: list[tuple[str, bytes]] = []

    def add_log(message: str) -> None:
        line = f"[{stamp()}] {message}"
        logs.append(line)
        if on_log is not None:
            on_log(line)

    add_log(f"Request /scrape/batch recebida com {len(nomes_all)} nomes únicos no CSV.")
    add_log(
        f"Processando {len(nomes)} nomes após filtros skip={skip_value}, "
        f"limit={limit_value}."
    )

    resultados: list[dict] = []
    ok_count = 0
    erro_count = 0
    cache_hits = 0
    cache_misses = 0
    cache_lookup_errors = 0

    add_log(
        f"ZIP deste lote será salvo em '{batch_output_dir}' "
        f"com formato solicitado '{output_format}'."
    )

    for idx, nome in enumerate(nomes, 1):
        add_log(f"[{idx}/{len(nomes)}] Iniciando scraping de '{nome}'.")
        t_item = perf_counter()
        try:
            try:
                cache_hit = find_fresh_curriculo_pdf(nome, include_bytes=True)
            except Exception as exc:
                cache_hit = None
                cache_lookup_errors += 1
                add_log(
                    f"[{idx}/{len(nomes)}] Falha ao consultar cache para '{nome}' "
                    f"(seguindo com scraping): {exc}"
                )

            if cache_hit is not None:
                artifacts = ensure_curriculo_artifacts(
                    nome=nome,
                    ultima_atualizacao=(
                        cache_hit.curriculo_date or cache_hit.last_modified.date()
                    ),
                    pdf_filename=cache_hit.filename,
                    pdf_storage_path=cache_hit.object_path,
                    pdf_download_url=cache_hit.download_url,
                    pdf_bytes=cache_hit.file_bytes or b"",
                    output_format=output_format,
                    cache_status="hit",
                )
                item = {
                    "nome": nome,
                    "status": "sucesso",
                    "cache_status": "hit",
                    "cache_last_modified": cache_hit.last_modified.isoformat(),
                    "ultima_atualizacao_curriculo": (
                        cache_hit.curriculo_date or cache_hit.last_modified.date()
                    ).isoformat(),
                    "arquivo_pdf": cache_hit.filename,
                    "storage_path": cache_hit.object_path,
                    "download_pdf_url": cache_hit.download_url,
                    "duracao_segundos": round(perf_counter() - t_item, 2),
                    **artifacts_to_payload(artifacts),
                }
                resultados.append(item)
                ok_count += 1
                cache_hits += 1
                for artifact in artifacts.generated_files:
                    artifact_bytes = download_artifact_bytes(artifact)
                    if artifact_bytes is None:
                        continue
                    batch_zip_entries.append(
                        (
                            f"{artifacts.output_label}/{artifact.filename}",
                            artifact_bytes,
                        )
                    )
                add_log(
                    f"[{idx}/{len(nomes)}] Cache HIT para '{nome}' "
                    f"em {item['duracao_segundos']}s. Artefatos={artifacts.artifacts_cache_status}."
                )
                continue

            cache_misses += 1
            scrape_result = await scrape_lattes(nome)
            filename = build_curriculo_filename(nome, scrape_result.ultima_atualizacao)
            upload_result = upload_curriculo_pdf(filename, scrape_result.pdf_bytes)
            artifacts = ensure_curriculo_artifacts(
                nome=nome,
                ultima_atualizacao=scrape_result.ultima_atualizacao,
                pdf_filename=filename,
                pdf_storage_path=upload_result.object_path,
                pdf_download_url=upload_result.download_url,
                pdf_bytes=scrape_result.pdf_bytes,
                output_format=output_format,
                cache_status="miss",
                html_text=scrape_result.html_text,
                html_source=scrape_result.html_source,
                photo_bytes=scrape_result.photo_bytes,
                photo_content_type=scrape_result.photo_content_type,
            )

            item = {
                "nome": nome,
                "status": "sucesso",
                "cache_status": "miss",
                "ultima_atualizacao_curriculo": scrape_result.ultima_atualizacao.isoformat(),
                "arquivo_pdf": filename,
                "storage_path": upload_result.object_path,
                "download_pdf_url": upload_result.download_url,
                "duracao_segundos": round(perf_counter() - t_item, 2),
                **artifacts_to_payload(artifacts),
            }
            resultados.append(item)
            ok_count += 1
            for artifact in artifacts.generated_files:
                artifact_bytes = download_artifact_bytes(artifact)
                if artifact_bytes is None:
                    continue
                batch_zip_entries.append(
                    (f"{artifacts.output_label}/{artifact.filename}", artifact_bytes)
                )
            add_log(
                f"[{idx}/{len(nomes)}] Sucesso para '{nome}' em {item['duracao_segundos']}s. "
                f"Artefatos={artifacts.artifacts_cache_status}."
            )
        except Exception as exc:
            erro_count += 1
            error_info = summarize_exception(exc)
            resultados.append(
                {
                    "nome": nome,
                    "status": "erro",
                    "erro": error_info["resumo"],
                    "erro_detalhe": error_info["detalhe"],
                    "erro_tipo": error_info["tipo"],
                    "erro_timeout_ms": error_info["timeout_ms"],
                    "erro_locator": error_info["locator"],
                    "duracao_segundos": round(perf_counter() - t_item, 2),
                }
            )
            add_log(f"[{idx}/{len(nomes)}] Erro para '{nome}': {error_info['resumo']}")

            debug_parts = [f"tipo={error_info['tipo']}"]
            if error_info["timeout_ms"] is not None:
                debug_parts.append(f"timeout_ms={error_info['timeout_ms']}")
            if error_info["locator"]:
                debug_parts.append(f"locator={error_info['locator']}")

            add_log(
                f"[{idx}/{len(nomes)}] Debug erro para '{nome}': "
                + ", ".join(debug_parts)
            )

    add_log(f"Lote finalizado. Sucessos: {ok_count}. Erros: {erro_count}.")
    add_log(
        "Resumo de cache: "
        f"hits={cache_hits}, misses={cache_misses}, erros_consulta={cache_lookup_errors}."
    )

    zip_filename = None
    zip_storage_path = None
    zip_download_url = None
    zip_error = None

    if batch_zip_entries:
        add_log(f"Gerando ZIP consolidado do lote '{batch_id}'.")
        try:
            zip_artifact = upload_batch_zip(
                batch_folder=batch_output_dir,
                batch_filename=f"lattes-lote-{now_brasilia().strftime('%Y%m%d-%H%M%S')}.zip",
                entries=batch_zip_entries,
            )
            zip_filename = zip_artifact.filename
            zip_storage_path = zip_artifact.relative_path
            zip_download_url = zip_artifact.download_url
            add_log("ZIP consolidado enviado para o Supabase Storage com sucesso.")
        except Exception as exc:
            zip_error = str(exc)
            add_log(
                f"Falha ao gerar/enviar ZIP consolidado para o Storage: {zip_error}"
            )

    return {
        "arquivo": arquivo_nome,
        "output_format": output_format,
        "output_directory": batch_output_dir,
        "total_nomes_csv": len(nomes_all),
        "total_processados": len(nomes),
        "sucesso": ok_count,
        "erro": erro_count,
        "cache_hits": cache_hits,
        "cache_misses": cache_misses,
        "cache_lookup_errors": cache_lookup_errors,
        "resultados": resultados,
        "zip_arquivo": zip_filename,
        "zip_storage_path": zip_storage_path,
        "zip_download_url": zip_download_url,
        "zip_erro": zip_error,
        "logs": logs,
        "duracao_segundos": round(perf_counter() - t_total, 2),
    }


@router.post("/scrape/batch")
async def scrape_batch(
    arquivo: Optional[UploadFile] = File(None),
    file: Optional[UploadFile] = File(None),
    skip: str = Form("0"),
    limit: Optional[str] = Form(None),
    output_format: str = Form("docx"),
):
    (
        arquivo_nome,
        nomes_all,
        nomes,
        skip_value,
        limit_value,
        normalized_output_format,
    ) = await _prepare_batch_input(
        arquivo,
        file,
        skip,
        limit,
        output_format,
    )
    return await _process_batch(
        arquivo_nome=arquivo_nome,
        nomes_all=nomes_all,
        nomes=nomes,
        skip_value=skip_value,
        limit_value=limit_value,
        output_format=normalized_output_format,
    )


@router.post("/scrape/batch/stream")
async def scrape_batch_stream(
    arquivo: Optional[UploadFile] = File(None),
    file: Optional[UploadFile] = File(None),
    skip: str = Form("0"),
    limit: Optional[str] = Form(None),
    output_format: str = Form("docx"),
):
    (
        arquivo_nome,
        nomes_all,
        nomes,
        skip_value,
        limit_value,
        normalized_output_format,
    ) = await _prepare_batch_input(
        arquivo,
        file,
        skip,
        limit,
        output_format,
    )

    queue: asyncio.Queue[str] = asyncio.Queue()
    process_task = asyncio.create_task(
        _process_batch(
            arquivo_nome=arquivo_nome,
            nomes_all=nomes_all,
            nomes=nomes,
            skip_value=skip_value,
            limit_value=limit_value,
            output_format=normalized_output_format,
            on_log=queue.put_nowait,
        )
    )

    async def event_stream():
        yield _sse_event(
            "start",
            {
                "arquivo": arquivo_nome,
                "total_nomes_csv": len(nomes_all),
                "total_processados": len(nomes),
            },
        )

        try:
            while True:
                if process_task.done() and queue.empty():
                    break

                try:
                    line = await asyncio.wait_for(queue.get(), timeout=0.5)
                except asyncio.TimeoutError:
                    continue

                yield _sse_event("log", {"message": line})

            result = await process_task
            yield _sse_event("result", result)
        except Exception as exc:
            if not process_task.done():
                process_task.cancel()
            yield _sse_event(
                "error",
                {"detail": str(exc) or "Falha ao processar lote em tempo real."},
            )
        finally:
            yield _sse_event("end", {})

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
