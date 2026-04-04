from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from .routers import (
    ai_router,
    batch_router,
    health_router,
    scrape_router,
    search_router,
)
from ..core.exporter import ensure_outputs_root, outputs_route_prefix


app = FastAPI(
    title="Lattes Scraper API", version="0.1.0", docs_url=None, redoc_url=None
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount(
    outputs_route_prefix(),
    StaticFiles(directory=ensure_outputs_root()),
    name="outputs",
)

app.include_router(scrape_router)
app.include_router(search_router)
app.include_router(ai_router)
app.include_router(batch_router)
app.include_router(health_router)
