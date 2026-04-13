from time import perf_counter

from fastapi import APIRouter, HTTPException, Request

from ...core.curriculo_diff import build_curriculo_text_diff
from ...core.exporter import (
    artifacts_to_payload,
    ensure_curriculo_artifacts,
)
from ...core.scraper import (
    scrape_lattes,
    scrape_lattes_by_href,
    scrape_lattes_profile_assets_by_href,
    scrape_lattes_ultima_atualizacao,
)
from ...core.storage import (
    download_storage_file_bytes,
    find_fresh_curriculo_pdf,
    get_curriculo_pdf_history,
    upload_curriculo_pdf,
)
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


def _serialize_cache_version(version) -> dict | None:  # noqa: ANN001
    if version is None:
        return None
    return {
        "arquivo_pdf": version.filename,
        "storage_path": version.object_path,
        "download_pdf_url": version.download_url,
        "ultima_atualizacao_curriculo": (
            version.curriculo_date.isoformat() if version.curriculo_date else None
        ),
        "cache_last_modified": version.last_modified.isoformat(),
    }


def _build_curriculo_history_payload(nome: str) -> dict:
    history = get_curriculo_pdf_history(nome)
    first_version = history.first_version
    last_version = history.last_version

    payload = {
        "cache_historico_total_versoes": len(history.versions),
        "cache_historico_primeira_versao": _serialize_cache_version(first_version),
        "cache_historico_ultima_versao": _serialize_cache_version(last_version),
    }

    if first_version is None or last_version is None:
        payload["cache_historico_diff"] = None
        return payload

    if first_version.object_path == last_version.object_path:
        payload["cache_historico_diff"] = {
            "has_changes": False,
            "added_lines": 0,
            "removed_lines": 0,
            "diff_preview": "",
        }
        return payload

    first_bytes = download_storage_file_bytes(first_version.object_path)
    last_bytes = download_storage_file_bytes(last_version.object_path)
    if not first_bytes or not last_bytes:
        payload["cache_historico_diff"] = None
        return payload

    diff = build_curriculo_text_diff(first_bytes, last_bytes)
    payload["cache_historico_diff"] = {
        "has_changes": diff.has_changes,
        "added_lines": diff.added_lines,
        "removed_lines": diff.removed_lines,
        "diff_preview": diff.diff_preview,
    }
    return payload


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
        cache_validation_error: str | None = None
        try:
            cache_hit = find_fresh_curriculo_pdf(nome, include_bytes=True)
        except Exception as exc:
            cache_hit = None
            cache_lookup_error = str(exc)
            add_log(
                "Falha ao consultar cache no Storage " f"(seguindo com scraping): {exc}"
            )

        profile_assets = None
        remote_ultima_atualizacao = None
        if cache_hit is not None:
            try:
                if request.href:
                    profile_assets = await scrape_lattes_profile_assets_by_href(
                        nome, request.href
                    )
                    remote_ultima_atualizacao = profile_assets.ultima_atualizacao
                else:
                    remote_ultima_atualizacao = await scrape_lattes_ultima_atualizacao(nome)
            except Exception as exc:
                cache_validation_error = str(exc)
                add_log(
                    "Falha ao validar atualização do currículo no Lattes "
                    f"(usando cache existente): {exc}"
                )

        cache_hit_ativo = cache_hit is not None
        if cache_hit is not None and remote_ultima_atualizacao is not None:
            cache_hit_ativo = cache_hit.curriculo_date == remote_ultima_atualizacao
            if not cache_hit_ativo:
                add_log(
                    "Cache desatualizado detectado. "
                    f"Storage={cache_hit.curriculo_date}, Lattes={remote_ultima_atualizacao}."
                )

        if cache_hit is not None and cache_hit_ativo:
            if request.href and profile_assets is None:
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
                "cache_validation_error": cache_validation_error,
                "logs": logs,
                "duracao_segundos": round(perf_counter() - t_total, 2),
                **artifacts_to_payload(artifacts),
                **_build_curriculo_history_payload(nome),
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
            "cache_validation_error": cache_validation_error,
            "ultima_atualizacao_curriculo": scrape_result.ultima_atualizacao.isoformat(),
            "arquivo_pdf": filename,
            "storage_path": upload_result.object_path,
            "download_pdf_url": upload_result.download_url,
            "logs": logs,
            "duracao_segundos": round(perf_counter() - t_total, 2),
            **artifacts_to_payload(artifacts),
            **_build_curriculo_history_payload(nome),
        }
    except HTTPException as exc:
        publish_request_error(request_id, str(exc.detail))
        raise
    except Exception as exc:
        publish_request_error(request_id, str(exc) or "Falha ao preparar currículo.")
        raise
    finally:
        request_monitor.complete(request_id)
