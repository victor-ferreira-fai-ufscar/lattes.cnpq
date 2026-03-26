from datetime import datetime

from fastapi import FastAPI

from .routes import router

app = FastAPI(title="Lattes Automator API", version="1.0.0")

app.include_router(router)


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}
