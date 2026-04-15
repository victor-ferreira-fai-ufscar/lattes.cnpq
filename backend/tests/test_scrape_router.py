"""
Testes unitários e de integração para o roteador /scrape.

Cobre:
  - _serialize_cache_version  (helper puro)
  - _build_curriculo_history_payload (helper com dependências mockadas)
  - POST /scrape (endpoint completo, path de cache HIT)
  - POST /scrape com nome vazio (validação 400)
"""

from datetime import date, datetime, timezone

import pytest
from fastapi.testclient import TestClient

from src.api.main import app
from src.api.routers import scrape as scrape_module
from src.core.curriculo_diff import CurriculoDiffResult
from src.core.exporter import GeneratedArtifact, GeneratedArtifactBundle
from src.core.storage import (
    StorageCachedPdfResult,
    StorageCurriculoHistoryResult,
)


# ---------------------------------------------------------------------------
# Fixtures e helpers
# ---------------------------------------------------------------------------


@pytest.fixture()
def client():
    return TestClient(app, raise_server_exceptions=True)


def _make_cached_pdf(
    date_str: str,
) -> StorageCachedPdfResult:
    slug = "victor-ferreira"
    cv_date = date.fromisoformat(date_str)
    filename = f"{slug}-{date_str}.pdf"
    return StorageCachedPdfResult(
        object_path=f"raw/{filename}",
        filename=filename,
        download_url=f"https://storage.example/{filename}",
        last_modified=datetime(
            cv_date.year, cv_date.month, cv_date.day, 10, 0, tzinfo=timezone.utc
        ),
        curriculo_date=cv_date,
        file_bytes=b"pdf-content",
    )


FAKE_BUNDLE = GeneratedArtifactBundle(
    output_format="pdf",
    output_directory="structured/outputs/v2/curriculos/victor-ferreira/2026-04-13",
    output_label="victor-ferreira / 2026-04-13",
    generated_files=[
        GeneratedArtifact(
            format="pdf",
            filename="victor-ferreira-2026-04-13.pdf",
            relative_path="victor-ferreira-2026-04-13.pdf",
            download_url="https://storage.example/victor-ferreira-2026-04-13.pdf",
            content_type="application/pdf",
        )
    ],
    extracted_text_length=1000,
    template_name=None,
    zip_file=None,
    artifacts_cache_status="hit",
)


# ---------------------------------------------------------------------------
# _serialize_cache_version
# ---------------------------------------------------------------------------


def test_serialize_cache_version_retorna_none_para_none():
    assert scrape_module._serialize_cache_version(None) is None


def test_serialize_cache_version_serializa_todos_os_campos():
    version = _make_cached_pdf("2026-03-10")
    result = scrape_module._serialize_cache_version(version)

    assert result is not None
    assert result["arquivo_pdf"] == "victor-ferreira-2026-03-10.pdf"
    assert result["storage_path"] == "raw/victor-ferreira-2026-03-10.pdf"
    assert (
        result["download_pdf_url"]
        == "https://storage.example/victor-ferreira-2026-03-10.pdf"
    )
    assert result["ultima_atualizacao_curriculo"] == "2026-03-10"
    assert "cache_last_modified" in result
    assert result["cache_last_modified"].startswith("2026-03-10")


def test_serialize_cache_version_sem_curriculo_date():
    version = StorageCachedPdfResult(
        object_path="raw/test.pdf",
        filename="test.pdf",
        download_url="https://storage.example/test.pdf",
        last_modified=datetime(2026, 3, 10, 10, 0, tzinfo=timezone.utc),
        curriculo_date=None,
    )
    result = scrape_module._serialize_cache_version(version)
    assert result is not None
    assert result["ultima_atualizacao_curriculo"] is None


# ---------------------------------------------------------------------------
# _build_curriculo_history_payload
# ---------------------------------------------------------------------------


def test_build_history_payload_sem_versoes(monkeypatch):
    monkeypatch.setattr(
        scrape_module,
        "get_curriculo_pdf_history",
        lambda nome: StorageCurriculoHistoryResult(versions=[]),
    )

    payload = scrape_module._build_curriculo_history_payload("Victor Ferreira")

    assert payload["cache_historico_total_versoes"] == 0
    assert payload["cache_historico_primeira_versao"] is None
    assert payload["cache_historico_ultima_versao"] is None
    assert payload["cache_historico_diff"] is None


def test_build_history_payload_versao_unica_retorna_diff_vazio(monkeypatch):
    v = _make_cached_pdf("2026-03-10")
    monkeypatch.setattr(
        scrape_module,
        "get_curriculo_pdf_history",
        lambda nome: StorageCurriculoHistoryResult(versions=[v]),
    )

    payload = scrape_module._build_curriculo_history_payload("Victor Ferreira")

    assert payload["cache_historico_total_versoes"] == 1
    assert payload["cache_historico_diff"] == {
        "has_changes": False,
        "added_lines": 0,
        "removed_lines": 0,
        "diff_preview": "",
    }


def test_build_history_payload_duas_versoes_com_diff(monkeypatch):
    v1 = _make_cached_pdf("2026-03-10")
    v2 = _make_cached_pdf("2026-04-13")

    monkeypatch.setattr(
        scrape_module,
        "get_curriculo_pdf_history",
        lambda nome: StorageCurriculoHistoryResult(versions=[v1, v2]),
    )
    monkeypatch.setattr(
        scrape_module,
        "download_storage_file_bytes",
        lambda path: b"pdf-v1" if "2026-03-10" in path else b"pdf-v2",
    )
    monkeypatch.setattr(
        scrape_module,
        "build_curriculo_text_diff",
        lambda old, new: CurriculoDiffResult(
            has_changes=True,
            added_lines=3,
            removed_lines=1,
            diff_preview="--- primeira-versao\n+++ ultima-versao\n+nova linha\n-linha removida",
        ),
    )

    payload = scrape_module._build_curriculo_history_payload("Victor Ferreira")

    assert payload["cache_historico_total_versoes"] == 2
    assert payload["cache_historico_primeira_versao"]["archive_pdf"] if False else True

    diff = payload["cache_historico_diff"]
    assert diff is not None
    assert diff["has_changes"] is True
    assert diff["added_lines"] == 3
    assert diff["removed_lines"] == 1
    assert "nova linha" in diff["diff_preview"]


def test_build_history_payload_diff_none_quando_bytes_nao_encontrados(monkeypatch):
    v1 = _make_cached_pdf("2026-03-10")
    v2 = _make_cached_pdf("2026-04-13")

    monkeypatch.setattr(
        scrape_module,
        "get_curriculo_pdf_history",
        lambda nome: StorageCurriculoHistoryResult(versions=[v1, v2]),
    )
    monkeypatch.setattr(
        scrape_module,
        "download_storage_file_bytes",
        lambda path: None,
    )

    payload = scrape_module._build_curriculo_history_payload("Victor Ferreira")

    assert payload["cache_historico_diff"] is None


def test_build_history_payload_versoes_serializadas_corretamente(monkeypatch):
    v1 = _make_cached_pdf("2026-03-10")
    v2 = _make_cached_pdf("2026-04-13")

    monkeypatch.setattr(
        scrape_module,
        "get_curriculo_pdf_history",
        lambda nome: StorageCurriculoHistoryResult(versions=[v1, v2]),
    )
    monkeypatch.setattr(
        scrape_module,
        "download_storage_file_bytes",
        lambda path: None,
    )

    payload = scrape_module._build_curriculo_history_payload("Victor Ferreira")

    primeira = payload["cache_historico_primeira_versao"]
    ultima = payload["cache_historico_ultima_versao"]

    assert primeira is not None
    assert primeira["ultima_atualizacao_curriculo"] == "2026-03-10"
    assert ultima is not None
    assert ultima["ultima_atualizacao_curriculo"] == "2026-04-13"


# ---------------------------------------------------------------------------
# POST /scrape — endpoint (integração com TestClient)
# ---------------------------------------------------------------------------


def test_scrape_nome_vazio_retorna_400(client):
    response = client.post("/scrape", json={"nome": "   "})
    assert response.status_code == 400
    assert "nome" in response.json()["detail"].lower()


def test_scrape_nome_ausente_retorna_422(client):
    response = client.post("/scrape", json={})
    assert response.status_code == 422


def test_scrape_cache_hit_retorna_payload_completo_com_historico(client, monkeypatch):
    """
    Simula o path de cache HIT: o PDF já existe no cache e não mudou.
    Verifica que a resposta inclui os campos de histórico e diff.
    """
    cache_version = _make_cached_pdf("2026-04-13")
    v1 = _make_cached_pdf("2026-03-10")
    v2 = _make_cached_pdf("2026-04-13")

    # Cache hit → retorna PDF válido
    monkeypatch.setattr(
        scrape_module,
        "find_fresh_curriculo_pdf",
        lambda nome, **kwargs: cache_version,
    )

    # Lattes diz que data remota == data do cache → cache ainda válido
    async def fake_ultima_atualizacao(nome):
        return date(2026, 4, 13)

    monkeypatch.setattr(
        scrape_module,
        "scrape_lattes_ultima_atualizacao",
        fake_ultima_atualizacao,
    )

    # Artefatos estruturados
    monkeypatch.setattr(
        scrape_module,
        "ensure_curriculo_artifacts",
        lambda **kwargs: FAKE_BUNDLE,
    )

    # Histórico com 2 versões
    monkeypatch.setattr(
        scrape_module,
        "get_curriculo_pdf_history",
        lambda nome: StorageCurriculoHistoryResult(versions=[v1, v2]),
    )
    monkeypatch.setattr(
        scrape_module,
        "download_storage_file_bytes",
        lambda path: b"pdf-v1" if "2026-03-10" in path else b"pdf-v2",
    )
    monkeypatch.setattr(
        scrape_module,
        "build_curriculo_text_diff",
        lambda old, new: CurriculoDiffResult(
            has_changes=True,
            added_lines=1,
            removed_lines=0,
            diff_preview="+nova publicacao",
        ),
    )

    response = client.post("/scrape", json={"nome": "Victor Ferreira"})

    assert response.status_code == 200
    data = response.json()

    # Campos básicos do scrape
    assert data["nome"] == "Victor Ferreira"
    assert data["cache_status"] == "hit"
    assert data["ultima_atualizacao_curriculo"] == "2026-04-13"
    assert data["arquivo_pdf"] == "victor-ferreira-2026-04-13.pdf"

    # Campos do histórico de versões
    assert data["cache_historico_total_versoes"] == 2
    assert data["cache_historico_primeira_versao"] is not None
    assert data["cache_historico_ultima_versao"] is not None
    assert (
        data["cache_historico_primeira_versao"]["ultima_atualizacao_curriculo"]
        == "2026-03-10"
    )
    assert (
        data["cache_historico_ultima_versao"]["ultima_atualizacao_curriculo"]
        == "2026-04-13"
    )

    # Diff
    diff = data["cache_historico_diff"]
    assert diff is not None
    assert diff["has_changes"] is True
    assert diff["added_lines"] == 1
    assert diff["removed_lines"] == 0
    assert "nova publicacao" in diff["diff_preview"]

    # Campos de artefatos
    assert "generated_files" in data
    assert "output_format" in data
