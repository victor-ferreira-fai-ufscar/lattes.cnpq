import asyncio
import json
from typing import Any, Callable, Optional

from ...core.curriculo_diff import build_curriculo_text_diff
from ...core.exporter import extrair_textos_curriculo
from ...core.perfil_externo import NoticiaExterna, PerfilExterno, perfil_to_payload
from ...core.perfil_externo_cache import get_perfil_externo
from ...core.storage import download_storage_file_bytes, get_curriculo_pdf_history


def sse_event(event: str, payload: object) -> str:
    return f"event: {event}\ndata: {json.dumps(payload, ensure_ascii=False)}\n\n"


def iniciar_perfil_externo(
    nome: str, add_log: Callable[[str], None]
) -> "asyncio.Task[Optional[PerfilExterno]]":
    """Dispara o enriquecimento externo em paralelo ao scraping do Lattes.

    O nome já é conhecido no início da requisição, então as chamadas HTTP
    (OpenAlex + Google News, ~1-2s) correm junto com o Playwright (~30s) e o
    custo em tempo de resposta fica próximo de zero.
    """
    return asyncio.create_task(get_perfil_externo(nome, log=add_log))


def descartar_perfil_externo(
    task: "Optional[asyncio.Task[Optional[PerfilExterno]]]",
) -> None:
    """Cancela a coleta externa que ficou pendente após uma falha no fluxo."""
    if task is not None and not task.done():
        task.cancel()


async def resolver_perfil_externo(
    task: "Optional[asyncio.Task[Optional[PerfilExterno]]]",
    *,
    nome: str,
    add_log: Callable[[str], None],
    pdf_bytes: Optional[bytes] = None,
    html_text: Optional[str] = None,
    html_source: Optional[str] = None,
) -> Optional[PerfilExterno]:
    """Aguarda a coleta externa e, se preciso, tenta de novo usando o currículo.

    A primeira tentativa roda sem o texto do CV (ela começa antes do scraping
    terminar). Quando o resultado não atinge confiança alta e o currículo está
    disponível, vale uma segunda tentativa: casar títulos de obras com o que o
    docente declarou no Lattes desempata casos em que a afiliação no OpenAlex
    está desatualizada.
    """
    if task is None:
        return None

    try:
        perfil = await task
    except Exception as exc:
        add_log(f"Falha no enriquecimento externo de '{nome}' (seguindo sem ele): {exc}")
        return None

    if perfil is None or perfil.publicavel or not pdf_bytes:
        return perfil

    try:
        texto_curriculo, _, _ = extrair_textos_curriculo(
            pdf_bytes, html_text, html_source
        )
        if not texto_curriculo.strip():
            return perfil

        add_log(
            f"Confiança insuficiente no perfil externo de '{nome}'; "
            "tentando desambiguar com o texto do currículo."
        )
        segunda = await get_perfil_externo(
            nome, texto_curriculo=texto_curriculo, log=add_log
        )
    except Exception as exc:
        add_log(
            f"Falha ao desambiguar o perfil externo de '{nome}' com o currículo: {exc}"
        )
        return perfil

    return segunda if segunda is not None else perfil


def noticias_publicaveis(
    perfil: Optional[PerfilExterno],
) -> tuple[NoticiaExterna, ...]:
    """Notícias que podem entrar no resumo por IA.

    Vale a mesma régua do card e do export: só perfil com confiança alta
    (`publicavel`). O resumo é artefato que circula, e sem esse filtro a notícia
    de um homônimo entraria no texto como se fosse do docente — pior que num
    card, porque ali a procedência está visível e no resumo ela se dissolve na
    redação do modelo.
    """
    if perfil is None or not perfil.publicavel:
        return ()
    return perfil.noticias


def perfil_externo_payload_fields(perfil: Optional[PerfilExterno]) -> dict[str, Any]:
    """Campos do perfil externo prontos para espalhar (`**`) na resposta."""
    return {"perfil_externo": perfil_to_payload(perfil)}


def serialize_cache_version(version) -> dict | None:  # noqa: ANN001
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


def build_curriculo_history_payload(nome: str) -> dict:
    history = get_curriculo_pdf_history(nome)
    first_version = history.first_version
    last_version = history.last_version

    payload = {
        "cache_historico_total_versoes": len(history.versions),
        "cache_historico_primeira_versao": serialize_cache_version(first_version),
        "cache_historico_ultima_versao": serialize_cache_version(last_version),
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
