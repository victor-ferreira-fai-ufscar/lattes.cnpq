from datetime import datetime
from typing import Callable


def stamp() -> str:
    return datetime.now().strftime("%H:%M:%S")


def build_logger(logs: list[str]) -> Callable[[str], None]:
    def add_log(message: str) -> None:
        logs.append(f"[{stamp()}] {message}")

    return add_log
