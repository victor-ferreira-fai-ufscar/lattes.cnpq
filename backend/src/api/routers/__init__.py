from .ai import router as ai_router
from .batch import router as batch_router
from .health import router as health_router
from .scrape import router as scrape_router
from .search import router as search_router

__all__ = [
    "ai_router",
    "batch_router",
    "health_router",
    "scrape_router",
    "search_router",
]
