import json

from ...core.curriculo_diff import build_curriculo_text_diff
from ...core.storage import download_storage_file_bytes, get_curriculo_pdf_history


def sse_event(event: str, payload: object) -> str:
    return f"event: {event}\ndata: {json.dumps(payload, ensure_ascii=False)}\n\n"


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
