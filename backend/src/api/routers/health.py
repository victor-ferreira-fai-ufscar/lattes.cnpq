from datetime import datetime

from fastapi import APIRouter
from scalar_fastapi import get_scalar_api_reference

router = APIRouter()


@router.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}


@router.get("/docs", include_in_schema=False)
async def scalar_docs():
    return get_scalar_api_reference(
        openapi_url="/openapi.json", title="Lattes Scraper API"
    )
