import asyncio
import json

from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse

from ...libs.request_monitor import request_monitor

router = APIRouter()


def _sse_event(event: str, payload: dict[str, object]) -> str:
    return f"event: {event}\ndata: {json.dumps(payload, ensure_ascii=False)}\n\n"


@router.get("/events/requests/{request_id}")
async def stream_request_events(request_id: str, request: Request):
    queue = request_monitor.subscribe(request_id)

    async def event_stream():
        try:
            while True:
                if await request.is_disconnected():
                    break

                try:
                    item = await asyncio.wait_for(queue.get(), timeout=15.0)
                except asyncio.TimeoutError:
                    yield ": ping\n\n"
                    continue

                if item is None:
                    break

                event, payload = item
                yield _sse_event(event, payload)
        finally:
            request_monitor.unsubscribe(request_id, queue)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
