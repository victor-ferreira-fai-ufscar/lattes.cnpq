import asyncio
from dataclasses import dataclass, field
from time import monotonic
from typing import Any


REQUEST_ID_HEADER = "x-request-id"
SESSION_TTL_SECONDS = 5 * 60


@dataclass
class RequestMonitorSession:
    backlog: list[tuple[str, Any]] = field(default_factory=list)
    subscribers: set[asyncio.Queue[tuple[str, Any] | None]] = field(default_factory=set)
    completed: bool = False
    updated_at: float = field(default_factory=monotonic)


class RequestMonitorHub:
    def __init__(self, ttl_seconds: float = SESSION_TTL_SECONDS):
        self.ttl_seconds = ttl_seconds
        self._sessions: dict[str, RequestMonitorSession] = {}

    def publish(self, request_id: str | None, event: str, payload: Any) -> None:
        if not request_id:
            return

        self._cleanup_expired()
        session = self._sessions.get(request_id)
        if session is None or session.completed:
            session = RequestMonitorSession()
            self._sessions[request_id] = session

        session.backlog.append((event, payload))
        session.updated_at = monotonic()

        for queue in tuple(session.subscribers):
            queue.put_nowait((event, payload))

    def subscribe(self, request_id: str) -> asyncio.Queue[tuple[str, Any] | None]:
        self._cleanup_expired()
        session = self._sessions.setdefault(request_id, RequestMonitorSession())
        queue: asyncio.Queue[tuple[str, Any] | None] = asyncio.Queue()

        for item in session.backlog:
            queue.put_nowait(item)

        if session.completed:
            queue.put_nowait(None)
        else:
            session.subscribers.add(queue)
            session.updated_at = monotonic()

        return queue

    def unsubscribe(
        self,
        request_id: str,
        queue: asyncio.Queue[tuple[str, Any] | None],
    ) -> None:
        session = self._sessions.get(request_id)
        if session is None:
            return

        session.subscribers.discard(queue)
        session.updated_at = monotonic()
        self._cleanup_expired()

    def complete(self, request_id: str | None) -> None:
        if not request_id:
            return

        session = self._sessions.get(request_id)
        if session is None or session.completed:
            return

        session.completed = True
        session.updated_at = monotonic()
        for queue in tuple(session.subscribers):
            queue.put_nowait(None)
        session.subscribers.clear()

    def _cleanup_expired(self) -> None:
        now = monotonic()
        expired_request_ids = [
            request_id
            for request_id, session in self._sessions.items()
            if not session.subscribers and now - session.updated_at >= self.ttl_seconds
        ]

        for request_id in expired_request_ids:
            self._sessions.pop(request_id, None)


request_monitor = RequestMonitorHub()


def publish_request_start(
    request_id: str | None,
    *,
    operation: str,
    title: str,
) -> None:
    request_monitor.publish(
        request_id,
        "start",
        {
            "operation": operation,
            "title": title,
        },
    )


def publish_request_log(request_id: str | None, message: str) -> None:
    request_monitor.publish(request_id, "log", {"message": message})


def publish_request_error(request_id: str | None, detail: str) -> None:
    request_monitor.publish(request_id, "request-error", {"detail": detail})
