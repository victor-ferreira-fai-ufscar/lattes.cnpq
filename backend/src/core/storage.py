import os
from importlib import import_module
from dataclasses import dataclass
from typing import Any

import httpx


@dataclass(frozen=True)
class StorageUploadResult:
    object_path: str
    download_url: str


def _is_true(value: str) -> bool:
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _require_env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise ValueError(f"Variável de ambiente obrigatória ausente: {name}")
    return value


def _create_supabase_client() -> Any:
    supabase_url = _require_env("SUPABASE_URL")
    supabase_key = (
        os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
        or os.getenv("SUPABASE_ANON_KEY", "").strip()
    )
    if not supabase_key:
        raise ValueError(
            "Defina SUPABASE_SERVICE_ROLE_KEY ou SUPABASE_ANON_KEY para usar o Storage."
        )

    try:
        supabase_module = import_module("supabase")
        create_client = getattr(supabase_module, "create_client")
    except ImportError as exc:
        raise ValueError(
            "Dependência 'supabase' não encontrada. Rode 'uv sync' no backend."
        ) from exc
    except AttributeError as exc:
        raise ValueError(
            "Biblioteca 'supabase' incompatível. Atualize as dependências com 'uv sync'."
        ) from exc

    try:
        client_options_module = import_module("supabase.lib.client_options")
        sync_client_options = getattr(client_options_module, "SyncClientOptions")
    except (ImportError, AttributeError):
        # Fallback para versões antigas da biblioteca.
        return create_client(supabase_url, supabase_key)

    timeout = httpx.Timeout(connect=10.0, read=20.0, write=20.0, pool=20.0)
    http_client = httpx.Client(timeout=timeout)
    options = sync_client_options(httpx_client=http_client)
    return create_client(supabase_url, supabase_key, options=options)


def upload_file_bytes(
    filename: str,
    file_bytes: bytes,
    *,
    content_type: str,
    folder: str | None = None,
) -> StorageUploadResult:
    bucket = os.getenv("SUPABASE_STORAGE_BUCKET", "lattes-cvs").strip() or "lattes-cvs"
    effective_folder = (
        folder.strip().strip("/")
        if folder is not None
        else os.getenv("SUPABASE_STORAGE_FOLDER", "raw").strip().strip("/")
    )
    is_public = _is_true(os.getenv("SUPABASE_STORAGE_PUBLIC", "true"))
    signed_url_ttl = int(os.getenv("SUPABASE_SIGNED_URL_EXPIRES_IN", "3600"))

    object_path = f"{effective_folder}/{filename}" if effective_folder else filename
    supabase = _create_supabase_client()

    supabase.storage.from_(bucket).upload(
        path=object_path,
        file=file_bytes,
        file_options={"content-type": content_type, "upsert": "true"},
    )

    if is_public:
        public_url = supabase.storage.from_(bucket).get_public_url(object_path)
        return StorageUploadResult(object_path=object_path, download_url=public_url)

    signed = supabase.storage.from_(bucket).create_signed_url(
        object_path, signed_url_ttl
    )
    signed_url = signed.get("signedURL") or signed.get("signedUrl")
    if not signed_url:
        raise ValueError(
            "Não foi possível gerar URL assinada para o arquivo no Supabase."
        )

    return StorageUploadResult(object_path=object_path, download_url=signed_url)


def upload_curriculo_pdf(filename: str, pdf_bytes: bytes) -> StorageUploadResult:
    return upload_file_bytes(
        filename,
        pdf_bytes,
        content_type="application/pdf",
    )
