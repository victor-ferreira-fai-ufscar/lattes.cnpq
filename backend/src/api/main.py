import os
from typing import cast, Callable, Any

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from ._limiter import limiter
from .routers import (
    ai_router,
    batch_router,
    events_router,
    health_router,
    scrape_router,
    search_router,
)

_raw_origins = os.getenv("BACKEND_CORS_ORIGINS", "http://localhost:3000")
CORS_ORIGINS: list[str] = [o.strip() for o in _raw_origins.split(",") if o.strip()]

app = FastAPI(
    title="Lattes Scraper API", version="0.1.0", docs_url=None, redoc_url=None
)

app.state.limiter = limiter
app.add_exception_handler(
    RateLimitExceeded, cast(Callable[..., Any], _rate_limit_exceeded_handler)
)
app.add_middleware(SlowAPIMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-Request-ID"],
)

app.include_router(scrape_router)
app.include_router(search_router)
app.include_router(ai_router)
app.include_router(batch_router)
app.include_router(events_router)
app.include_router(health_router)
