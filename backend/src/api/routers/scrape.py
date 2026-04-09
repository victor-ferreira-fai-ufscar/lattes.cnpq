from time import perf_counter

from fastapi import APIRouter, HTTPException, Request

from ...core.exporter import (
    artifacts_to_payload,
    ensure_curriculo_artifacts,
)
from ...core.scraper import (
    scrape_lattes,
    scrape_lattes_by_href,
    scrape_lattes_profile_assets_by_href,
)
from ...core.storage import find_fresh_curriculo_pdf, upload_curriculo_pdf
from ...libs.filename import build_curriculo_filename
from ...libs.logging import build_logger
from ...libs.request_monitor import (
    REQUEST_ID_HEADER,
    publish_request_error,
    publish_request_start,
    request_monitor,
)
from ...models import ScrapeRequest

router = APIRouter()


@router.post("/scrape")
async def scrape(request: ScrapeRequest, http_request: Request):
    t_total = perf_counter()
    logs: list[str] = []
    request_id = http_request.headers.get(REQUEST_ID_HEADER)
    publish_request_start(
        request_id,
        operation="scrape",
        title="Preparando arquivos do currículo",
    )
    add_log = build_logger(
        logs,
        sink=lambda line: request_monitor.publish(request_id, "log", {"message": line}),
    )

    try:
        nome = request.nome.strip()
        output_format = request.output_format
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

        t_cache = perf_counter()
        cache_lookup_error: str | None = None
        try:
            cache_hit = find_fresh_curriculo_pdf(nome, include_bytes=True)
        except Exception as exc:
            cache_hit = None
            cache_lookup_error = str(exc)
            add_log(
                "Falha ao consultar cache no Storage " f"(seguindo com scraping): {exc}"
            )

        if cache_hit is not None:
            profile_assets = None
            if request.href:
                try:
                    add_log(
                        "Cache HIT de PDF; buscando HTML e foto do currículo selecionado para enriquecer o perfil vitrine."
                    )
                    profile_assets = await scrape_lattes_profile_assets_by_href(
                        nome, request.href
                    )
                except Exception as exc:
                    add_log(
                        f"Falha ao extrair HTML/foto do currículo selecionado (seguindo sem foto): {exc}"
                    )

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
                html_text=profile_assets.html_text if profile_assets else None,
                html_source=profile_assets.html_source if profile_assets else None,
                photo_bytes=profile_assets.photo_bytes if profile_assets else None,
                photo_content_type=(
                    profile_assets.photo_content_type if profile_assets else None
                ),
            )
            add_log(
                "Cache HIT no Storage em "
                f"{(perf_counter() - t_cache):.1f}s para '{cache_hit.object_path}' "
                f"(modificado em {cache_hit.last_modified.isoformat()})."
            )
            add_log(
                f"Artefatos estruturados resolvidos em '{artifacts.output_directory}' "
                f"(cache={artifacts.artifacts_cache_status}, formato={output_format})."
            )
            add_log("Request /scrape finalizada com sucesso usando cache.")
            return {
                "nome": nome,
                "cache_status": "hit",
                "cache_last_modified": cache_hit.last_modified.isoformat(),
                "ultima_atualizacao_curriculo": (
                    cache_hit.curriculo_date or cache_hit.last_modified.date()
                ).isoformat(),
                "arquivo_pdf": cache_hit.filename,
                "storage_path": cache_hit.object_path,
                "download_pdf_url": cache_hit.download_url,
                "logs": logs,
                "duracao_segundos": round(perf_counter() - t_total, 2),
                **artifacts_to_payload(artifacts),
            }

        add_log(
            "Cache MISS no Storage em "
            f"{(perf_counter() - t_cache):.1f}s. Prosseguindo com scraping."
        )

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
        add_log(
            f"Artefatos estruturados resolvidos em '{artifacts.output_directory}' "
            f"(cache={artifacts.artifacts_cache_status}, formato={output_format})."
        )
        add_log("Request /scrape finalizada com sucesso.")

        return {
            "nome": nome,
            "cache_status": "miss",
            "cache_lookup_error": cache_lookup_error,
            "ultima_atualizacao_curriculo": scrape_result.ultima_atualizacao.isoformat(),
            "arquivo_pdf": filename,
            "storage_path": upload_result.object_path,
            "download_pdf_url": upload_result.download_url,
            "logs": logs,
            "duracao_segundos": round(perf_counter() - t_total, 2),
            **artifacts_to_payload(artifacts),
        }
    except HTTPException as exc:
        publish_request_error(request_id, str(exc.detail))
        raise
    except Exception as exc:
        publish_request_error(request_id, str(exc) or "Falha ao preparar currículo.")
        raise
    finally:
        request_monitor.complete(request_id)
