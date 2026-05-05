import asyncio

from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse

from ...libs.request_monitor import request_monitor
from ._helpers import sse_event

router = APIRouter()


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
                    yield sse_event("end", {"request_id": request_id})
                    break

                event, payload = item
                yield sse_event(event, payload)
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
