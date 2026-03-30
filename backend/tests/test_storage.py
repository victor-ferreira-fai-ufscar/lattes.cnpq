"""
Teste de integração: upload de ZIP para o Supabase Storage.

Verifica que:
1. upload_file_bytes(.., folder="zips") envia o arquivo para a pasta zips/ do bucket.
2. A URL retornada está corretamente formada (HTTP/HTTPS).
3. A URL é acessível (GET retorna 2xx).
4. Limpeza automática após o teste via fixture.
"""

import os
import zipfile
from io import BytesIO

import httpx
import pytest

from src.core.storage import _create_supabase_client, upload_file_bytes

TEST_FILENAME = "test-upload-integration.zip"
TEST_FOLDER = "zips"


def _build_test_zip() -> bytes:
    """Cria um ZIP mínimo em memória para fins de teste."""
    buffer = BytesIO()
    with zipfile.ZipFile(buffer, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("hello.txt", "Lattes Storage Integration Test")
    return buffer.getvalue()


@pytest.fixture(autouse=True)
def cleanup_test_file():
    """Remove o arquivo de teste do Storage antes E depois de cada teste."""
    bucket = os.getenv("SUPABASE_STORAGE_BUCKET", "lattes-cvs")
    object_path = f"{TEST_FOLDER}/{TEST_FILENAME}"

    # Remove antes para garantir estado limpo (ignore erros se não existir)
    try:
        _create_supabase_client().storage.from_(bucket).remove([object_path])
    except Exception:
        pass

    yield

    # Remove depois para não poluir o bucket
    try:
        _create_supabase_client().storage.from_(bucket).remove([object_path])
    except Exception:
        pass


def test_upload_zip_para_pasta_zips():
    """
    Faz o upload de um ZIP real para a pasta zips/ no Supabase Storage
    e verifica que a URL de download é válida e acessível.
    """
    zip_bytes = _build_test_zip()

    result = upload_file_bytes(
        TEST_FILENAME,
        zip_bytes,
        content_type="application/zip",
        folder=TEST_FOLDER,
    )

    # 1. O object_path deve estar na pasta correta
    assert (
        result.object_path == f"{TEST_FOLDER}/{TEST_FILENAME}"
    ), f"Esperado '{TEST_FOLDER}/{TEST_FILENAME}', obtido '{result.object_path}'"

    # 2. A URL deve ser uma string não vazia com esquema HTTP/HTTPS
    assert result.download_url, "download_url está vazia"
    assert result.download_url.startswith(
        ("http://", "https://")
    ), f"download_url não parece uma URL válida: {result.download_url}"

    # 3. A URL deve ser acessível (GET sem autenticação para buckets públicos)
    response = httpx.get(result.download_url, timeout=15, follow_redirects=True)
    assert (
        response.status_code < 400
    ), f"URL retornou status {response.status_code}: {result.download_url}"
