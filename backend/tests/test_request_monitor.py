import asyncio

from src.libs.logging import build_logger
from src.libs.request_monitor import RequestMonitorHub


def test_build_logger_forwards_lines_to_sink() -> None:
    logs: list[str] = []
    forwarded: list[str] = []
    add_log = build_logger(logs, sink=forwarded.append)

    add_log("Linha de teste")

    assert len(logs) == 1
    assert forwarded == logs
    assert "Linha de teste" in logs[0]


def test_request_monitor_replays_backlog_to_late_subscriber() -> None:
    async def scenario() -> list[tuple[str, dict[str, str]]]:
        hub = RequestMonitorHub()
        hub.publish("req-123", "start", {"title": "Busca"})
        hub.publish("req-123", "log", {"message": "Primeira linha"})
        hub.complete("req-123")

        queue = hub.subscribe("req-123")
        events: list[tuple[str, dict[str, str]]] = []

        while True:
            item = await asyncio.wait_for(queue.get(), timeout=0.1)
            if item is None:
                break
            events.append(item)

        hub.unsubscribe("req-123", queue)
        return events

    events = asyncio.run(scenario())

    assert events == [
        ("start", {"title": "Busca"}),
        ("log", {"message": "Primeira linha"}),
    ]
