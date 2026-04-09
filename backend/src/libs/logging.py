from datetime import datetime
import re
from typing import Callable
from zoneinfo import ZoneInfo


BRASILIA_TZ = ZoneInfo("America/Sao_Paulo")


def now_brasilia() -> datetime:
    return datetime.now(BRASILIA_TZ)


def stamp() -> str:
    return now_brasilia().strftime("%H:%M:%S")


def build_logger(
    logs: list[str],
    *,
    sink: Callable[[str], None] | None = None,
) -> Callable[[str], None]:
    def add_log(message: str) -> None:
        line = f"[{stamp()}] {message}"
        logs.append(line)
        if sink is not None:
            sink(line)

    return add_log


def _compact_whitespace(value: str) -> str:
    return " ".join(value.split())


def _truncate(value: str, max_chars: int) -> str:
    if len(value) <= max_chars:
        return value
    return value[: max_chars - 1].rstrip() + "…"


def summarize_exception(
    exc: Exception,
    *,
    max_summary_chars: int = 180,
    max_detail_chars: int = 1200,
) -> dict[str, str | int | None]:
    """Retorna versão curta e metadados úteis para log de erros longos."""
    raw_message = str(exc).strip() or exc.__class__.__name__
    detail = _truncate(_compact_whitespace(raw_message), max_detail_chars)

    timeout_match = re.search(r"timeout\s*(\d+)ms", raw_message, flags=re.IGNORECASE)
    timeout_ms = int(timeout_match.group(1)) if timeout_match else None

    locator_match = re.search(r"locator\((?:\"([^\"]+)\"|'([^']+)')\)", raw_message)
    locator = None
    if locator_match:
        locator = locator_match.group(1) or locator_match.group(2)

    if timeout_ms is not None and locator:
        summary = f"Timeout ({timeout_ms}ms) ao interagir com locator '{locator}'."
    elif timeout_ms is not None:
        summary = f"Timeout ({timeout_ms}ms) durante o scraping."
    else:
        summary = detail

    summary = _truncate(summary, max_summary_chars)

    return {
        "tipo": exc.__class__.__name__,
        "resumo": summary,
        "detalhe": detail,
        "timeout_ms": timeout_ms,
        "locator": locator,
    }
