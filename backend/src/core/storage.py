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


@dataclass(frozen=True)
class StorageCurriculoHistoryResult:
    versions: list[StorageCachedPdfResult]

    @property
    def first_version(self) -> StorageCachedPdfResult | None:
        return self.versions[0] if self.versions else None

    @property
    def last_version(self) -> StorageCachedPdfResult | None:
        return self.versions[-1] if self.versions else None


@dataclass(frozen=True)
class StorageFileResult:
    object_path: str
    filename: str
    download_url: str
    last_modified: datetime | None = None
    content_type: str | None = None
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


def _storage_bucket_config(*, folder: str | None = None) -> tuple[str, str, bool, int]:
    bucket = os.getenv("SUPABASE_STORAGE_BUCKET", "lattes-cvs").strip() or "lattes-cvs"
    effective_folder = (
        folder.strip().strip("/")
        if folder is not None
        else os.getenv("SUPABASE_STORAGE_FOLDER", "raw").strip().strip("/")
    )
    is_public = _is_true(os.getenv("SUPABASE_STORAGE_PUBLIC", "true"))
    signed_url_ttl = int(os.getenv("SUPABASE_SIGNED_URL_EXPIRES_IN", "3600"))
    return bucket, effective_folder, is_public, signed_url_ttl


def _is_storage_not_found_error(exc: Exception) -> bool:
    status_code = getattr(exc, "status_code", None)
    if status_code == 404:
        return True

    response = getattr(exc, "response", None)
    if getattr(response, "status_code", None) == 404:
        return True

    for arg in getattr(exc, "args", ()):  # pragma: no branch - tiny loop
        if isinstance(arg, dict):
            raw_status = arg.get("statusCode") or arg.get("status_code")
            raw_error = str(arg.get("error") or "").strip().lower()
            if raw_status == 404 or raw_error == "not_found":
                return True

    message = str(exc).lower()
    return (
        "statuscode': 404" in message
        or "not_found" in message
        or "object not found" in message
    )


def download_storage_file_bytes(object_path: str) -> bytes | None:
    bucket, _, _, _ = _storage_bucket_config()
    supabase = _create_supabase_client()
    try:
        downloaded = supabase.storage.from_(bucket).download(object_path)
    except Exception as exc:
        if _is_storage_not_found_error(exc):
            return None
        raise

    if isinstance(downloaded, bytes):
        return downloaded
    if hasattr(downloaded, "content"):
        return downloaded.content
    if hasattr(downloaded, "data"):
        return downloaded.data
    return None


def list_storage_files(
    folder: str,
    *,
    include_bytes: bool = False,
) -> list[StorageFileResult]:
    bucket, effective_folder, is_public, signed_url_ttl = _storage_bucket_config(
        folder=folder
    )
    supabase = _create_supabase_client()
    items = _list_storage_objects(supabase, bucket=bucket, folder=effective_folder)

    results: list[StorageFileResult] = []
    for item in items:
        filename = str(item.get("name") or "").strip()
        if not filename:
            continue

        object_path = f"{effective_folder}/{filename}" if effective_folder else filename
        file_bytes = download_storage_file_bytes(object_path) if include_bytes else None
        results.append(
            StorageFileResult(
                object_path=object_path,
                filename=filename,
                download_url=_build_download_url(
                    supabase,
                    bucket=bucket,
                    object_path=object_path,
                    is_public=is_public,
                    signed_url_ttl=signed_url_ttl,
                ),
                last_modified=_parse_iso_datetime(
                    item.get("updated_at") or item.get("last_accessed_at")
                ),
                content_type=(
                    str(item.get("metadata", {}).get("mimetype") or "").strip()
                    if isinstance(item.get("metadata"), dict)
                    else None
                ),
                file_bytes=file_bytes,
            )
        )

    return results


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
    cache_max_age_days = _effective_cache_max_age_days(max_age_days)
    now_dt = now or datetime.now(timezone.utc)
    max_age = timedelta(days=cache_max_age_days)

    versions = list_curriculo_pdf_versions(nome, include_bytes=False)
    best_version = versions[-1] if versions else None
    if best_version is None:
        return None

    if now_dt - best_version.last_modified > max_age:
        return None

    if not include_bytes:
        return best_version

    file_bytes = download_storage_file_bytes(best_version.object_path)
    return StorageCachedPdfResult(
        object_path=best_version.object_path,
        filename=best_version.filename,
        download_url=best_version.download_url,
        last_modified=best_version.last_modified,
        curriculo_date=best_version.curriculo_date,
        file_bytes=file_bytes,
    )


def list_curriculo_pdf_versions(
    nome: str,
    *,
    include_bytes: bool = False,
) -> list[StorageCachedPdfResult]:
    bucket, folder, is_public, signed_url_ttl = _storage_bucket_config()
    supabase = _create_supabase_client()
    items = _list_storage_objects(supabase, bucket=bucket, folder=folder)

    from ..libs.filename import slugify_nome

    slug = slugify_nome(nome)
    prefix = f"{slug}-"

    versions: list[StorageCachedPdfResult] = []
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

        object_path = f"{folder}/{filename}" if folder else filename
        file_bytes = download_storage_file_bytes(object_path) if include_bytes else None
        versions.append(
            StorageCachedPdfResult(
                object_path=object_path,
                filename=filename,
                download_url=_build_download_url(
                    supabase,
                    bucket=bucket,
                    object_path=object_path,
                    is_public=is_public,
                    signed_url_ttl=signed_url_ttl,
                ),
                last_modified=last_modified,
                curriculo_date=_extract_curriculo_date_from_filename(filename),
                file_bytes=file_bytes,
            )
        )

    versions.sort(
        key=lambda version: (
            version.curriculo_date or date.min,
            version.last_modified,
            version.filename,
        )
    )
    return versions


def get_curriculo_pdf_history(
    nome: str,
    *,
    include_bytes: bool = False,
) -> StorageCurriculoHistoryResult:
    versions = list_curriculo_pdf_versions(nome, include_bytes=include_bytes)
    return StorageCurriculoHistoryResult(versions=versions)


def upload_file_bytes(
    filename: str,
    file_bytes: bytes,
    *,
    content_type: str,
    folder: str | None = None,
) -> StorageUploadResult:
    bucket, effective_folder, is_public, signed_url_ttl = _storage_bucket_config(
        folder=folder
    )

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
