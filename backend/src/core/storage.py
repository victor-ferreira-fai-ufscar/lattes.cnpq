import os
import re
from importlib import import_module
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from typing import Any

import httpx


@dataclass(frozen=True)
class StorageUploadResult:
    object_path: str
    download_url: str


@dataclass(frozen=True)
class StorageCachedPdfResult:
    object_path: str
    filename: str
    download_url: str
    last_modified: datetime
    curriculo_date: date | None = None
    file_bytes: bytes | None = None


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


def _build_download_url(
    supabase: Any,
    *,
    bucket: str,
    object_path: str,
    is_public: bool,
    signed_url_ttl: int,
) -> str:
    if is_public:
        return supabase.storage.from_(bucket).get_public_url(object_path)

    signed = supabase.storage.from_(bucket).create_signed_url(
        object_path, signed_url_ttl
    )
    signed_url = signed.get("signedURL") or signed.get("signedUrl")
    if not signed_url:
        raise ValueError(
            "Não foi possível gerar URL assinada para o arquivo no Supabase."
        )
    return signed_url


def _parse_iso_datetime(value: Any) -> datetime | None:
    if not isinstance(value, str) or not value.strip():
        return None

    raw = value.strip()
    if raw.endswith("Z"):
        raw = f"{raw[:-1]}+00:00"

    try:
        parsed = datetime.fromisoformat(raw)
    except ValueError:
        return None

    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)

    return parsed


def _extract_curriculo_date_from_filename(filename: str) -> date | None:
    match = re.search(r"-(\d{4}-\d{2}-\d{2})\.pdf$", filename.lower())
    if not match:
        return None

    try:
        return datetime.strptime(match.group(1), "%Y-%m-%d").date()
    except ValueError:
        return None


def _list_storage_objects(
    supabase: Any, *, bucket: str, folder: str
) -> list[dict[str, Any]]:
    bucket_ref = supabase.storage.from_(bucket)
    options = {"limit": 1000, "offset": 0}

    try:
        items = bucket_ref.list(path=folder, options=options)
    except TypeError:
        try:
            items = bucket_ref.list(folder, options)
        except TypeError:
            items = bucket_ref.list(folder)

    if not isinstance(items, list):
        return []
    return [item for item in items if isinstance(item, dict)]


def _effective_cache_max_age_days(value: int | None) -> int:
    if value is not None:
        return max(0, value)

    raw = os.getenv("SUPABASE_STORAGE_CACHE_MAX_AGE_DAYS", "30").strip()
    try:
        return max(0, int(raw))
    except ValueError:
        return 30


def find_fresh_curriculo_pdf(
    nome: str,
    *,
    max_age_days: int | None = None,
    include_bytes: bool = False,
    now: datetime | None = None,
) -> StorageCachedPdfResult | None:
    bucket = os.getenv("SUPABASE_STORAGE_BUCKET", "lattes-cvs").strip() or "lattes-cvs"
    folder = os.getenv("SUPABASE_STORAGE_FOLDER", "raw").strip().strip("/")
    is_public = _is_true(os.getenv("SUPABASE_STORAGE_PUBLIC", "true"))
    signed_url_ttl = int(os.getenv("SUPABASE_SIGNED_URL_EXPIRES_IN", "3600"))
    cache_max_age_days = _effective_cache_max_age_days(max_age_days)

    supabase = _create_supabase_client()
    items = _list_storage_objects(supabase, bucket=bucket, folder=folder)

    from ..libs.filename import slugify_nome

    slug = slugify_nome(nome)
    prefix = f"{slug}-"
    now_dt = now or datetime.now(timezone.utc)
    max_age = timedelta(days=cache_max_age_days)

    best: dict[str, Any] | None = None
    best_last_modified: datetime | None = None

    for item in items:
        filename = str(item.get("name") or "").strip()
        if not filename.lower().endswith(".pdf"):
            continue
        if not filename.startswith(prefix):
            continue

        last_modified = _parse_iso_datetime(
            item.get("updated_at") or item.get("last_accessed_at")
        )
        if last_modified is None:
            continue

        if best_last_modified is None or last_modified > best_last_modified:
            best = item
            best_last_modified = last_modified

    if best is None or best_last_modified is None:
        return None

    if now_dt - best_last_modified > max_age:
        return None

    filename = str(best.get("name") or "").strip()
    object_path = f"{folder}/{filename}" if folder else filename
    download_url = _build_download_url(
        supabase,
        bucket=bucket,
        object_path=object_path,
        is_public=is_public,
        signed_url_ttl=signed_url_ttl,
    )

    file_bytes: bytes | None = None
    if include_bytes:
        downloaded = supabase.storage.from_(bucket).download(object_path)
        if isinstance(downloaded, bytes):
            file_bytes = downloaded
        elif hasattr(downloaded, "content"):
            file_bytes = downloaded.content
        elif hasattr(downloaded, "data"):
            file_bytes = downloaded.data

    return StorageCachedPdfResult(
        object_path=object_path,
        filename=filename,
        download_url=download_url,
        last_modified=best_last_modified,
        curriculo_date=_extract_curriculo_date_from_filename(filename),
        file_bytes=file_bytes,
    )


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

    download_url = _build_download_url(
        supabase,
        bucket=bucket,
        object_path=object_path,
        is_public=is_public,
        signed_url_ttl=signed_url_ttl,
    )
    return StorageUploadResult(object_path=object_path, download_url=download_url)


def upload_curriculo_pdf(filename: str, pdf_bytes: bytes) -> StorageUploadResult:
    return upload_file_bytes(
        filename,
        pdf_bytes,
        content_type="application/pdf",
    )
