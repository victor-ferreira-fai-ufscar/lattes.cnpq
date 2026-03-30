from datetime import datetime
from typing import Callable
from zoneinfo import ZoneInfo


BRASILIA_TZ = ZoneInfo("America/Sao_Paulo")


def now_brasilia() -> datetime:
    return datetime.now(BRASILIA_TZ)


def stamp() -> str:
    return now_brasilia().strftime("%H:%M:%S")


def build_logger(logs: list[str]) -> Callable[[str], None]:
    def add_log(message: str) -> None:
        logs.append(f"[{stamp()}] {message}")

    return add_log
