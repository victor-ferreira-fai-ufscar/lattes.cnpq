"""
Testes de integração do endpoint GET /health.

Usa o TestClient do Starlette (síncrono) para verificar que a rota responde
corretamente sem dependências externas (sem scraper, sem Supabase).
"""

from fastapi.testclient import TestClient

from src.api.main import app

client = TestClient(app, raise_server_exceptions=True)


def test_health_retorna_status_200():
    response = client.get("/health")
    assert response.status_code == 200


def test_health_retorna_json_com_status_healthy():
    response = client.get("/health")
    data = response.json()
    assert data["status"] == "healthy"


def test_health_inclui_campo_timestamp():
    response = client.get("/health")
    data = response.json()
    assert "timestamp" in data
    assert isinstance(data["timestamp"], str)
    assert len(data["timestamp"]) > 0


def test_health_content_type_eh_json():
    response = client.get("/health")
    assert "application/json" in response.headers["content-type"]
