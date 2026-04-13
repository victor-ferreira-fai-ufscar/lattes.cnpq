from datetime import datetime, timezone

from src.core import storage


class _DummyBucketRef:
    def __init__(self, items, base_url: str = "https://storage.example"):
        self._items = items
        self._base_url = base_url
        self.download_calls: list[str] = []

    def list(self, path=None, options=None):  # noqa: ANN001, ANN002
        return self._items

    def get_public_url(self, object_path: str) -> str:
        return f"{self._base_url}/{object_path}"

    def create_signed_url(self, object_path: str, ttl: int):  # noqa: ARG002
        return {"signedURL": f"{self._base_url}/signed/{object_path}"}

    def download(self, object_path: str) -> bytes:
        self.download_calls.append(object_path)
        return b"%PDF-cache%"


class _NotFoundBucketRef(_DummyBucketRef):
    def __init__(self):
        super().__init__([])

    def download(self, object_path: str) -> bytes:
        self.download_calls.append(object_path)
        raise Exception(
            {
                "statusCode": 404,
                "error": "not_found",
                "message": "Object not found",
            }
        )


class _DummyStorage:
    def __init__(self, bucket_ref: _DummyBucketRef):
        self._bucket_ref = bucket_ref

    def from_(self, bucket: str) -> _DummyBucketRef:  # noqa: ARG002
        return self._bucket_ref


class _DummyClient:
    def __init__(self, bucket_ref: _DummyBucketRef):
        self.storage = _DummyStorage(bucket_ref)


def test_find_fresh_curriculo_pdf_returns_most_recent_fresh_file(monkeypatch):
    bucket_ref = _DummyBucketRef(
        [
            {
                "name": "jose-silva-2026-02-01.pdf",
                "updated_at": "2026-02-10T09:30:00Z",
            },
            {
                "name": "jose-silva-2026-03-01.pdf",
                "updated_at": "2026-03-25T12:00:00+00:00",
            },
            {
                "name": "outra-pessoa-2026-03-20.pdf",
                "updated_at": "2026-03-28T08:00:00+00:00",
            },
        ]
    )

    monkeypatch.setattr(
        storage, "_create_supabase_client", lambda: _DummyClient(bucket_ref)
    )
    monkeypatch.setenv("SUPABASE_STORAGE_BUCKET", "lattes-cvs")
    monkeypatch.setenv("SUPABASE_STORAGE_FOLDER", "raw")
    monkeypatch.setenv("SUPABASE_STORAGE_PUBLIC", "true")

    result = storage.find_fresh_curriculo_pdf(
        "José Silva",
        max_age_days=30,
        include_bytes=True,
        now=datetime(2026, 3, 30, 10, 0, tzinfo=timezone.utc),
    )

    assert result is not None
    assert result.filename == "jose-silva-2026-03-01.pdf"
    assert result.object_path == "raw/jose-silva-2026-03-01.pdf"
    assert result.curriculo_date is not None
    assert result.curriculo_date.isoformat() == "2026-03-01"
    assert result.file_bytes == b"%PDF-cache%"
    assert bucket_ref.download_calls == ["raw/jose-silva-2026-03-01.pdf"]


def test_find_fresh_curriculo_pdf_returns_none_when_stale(monkeypatch):
    bucket_ref = _DummyBucketRef(
        [
            {
                "name": "jose-silva-2026-01-05.pdf",
                "updated_at": "2026-01-08T12:00:00+00:00",
            }
        ]
    )

    monkeypatch.setattr(
        storage, "_create_supabase_client", lambda: _DummyClient(bucket_ref)
    )
    monkeypatch.setenv("SUPABASE_STORAGE_BUCKET", "lattes-cvs")
    monkeypatch.setenv("SUPABASE_STORAGE_FOLDER", "raw")

    result = storage.find_fresh_curriculo_pdf(
        "Jose Silva",
        max_age_days=30,
        now=datetime(2026, 3, 30, 10, 0, tzinfo=timezone.utc),
    )

    assert result is None


def test_find_fresh_curriculo_pdf_prefers_most_recent_curriculo_date(monkeypatch):
    bucket_ref = _DummyBucketRef(
        [
            {
                "name": "jose-silva-2026-04-10.pdf",
                "updated_at": "2026-04-10T11:00:00+00:00",
            },
            {
                "name": "jose-silva-2026-04-02.pdf",
                "updated_at": "2026-04-11T12:00:00+00:00",
            },
        ]
    )

    monkeypatch.setattr(
        storage, "_create_supabase_client", lambda: _DummyClient(bucket_ref)
    )
    monkeypatch.setenv("SUPABASE_STORAGE_BUCKET", "lattes-cvs")
    monkeypatch.setenv("SUPABASE_STORAGE_FOLDER", "raw")

    result = storage.find_fresh_curriculo_pdf(
        "Jose Silva",
        max_age_days=30,
        now=datetime(2026, 4, 12, 10, 0, tzinfo=timezone.utc),
    )

    assert result is not None
    assert result.filename == "jose-silva-2026-04-10.pdf"
    assert result.curriculo_date is not None
    assert result.curriculo_date.isoformat() == "2026-04-10"


def test_get_curriculo_pdf_history_returns_first_and_last_versions(monkeypatch):
    bucket_ref = _DummyBucketRef(
        [
            {
                "name": "jose-silva-2026-04-10.pdf",
                "updated_at": "2026-04-10T11:00:00+00:00",
            },
            {
                "name": "jose-silva-2026-04-02.pdf",
                "updated_at": "2026-04-02T11:00:00+00:00",
            },
            {
                "name": "outra-pessoa-2026-04-09.pdf",
                "updated_at": "2026-04-09T10:00:00+00:00",
            },
        ]
    )

    monkeypatch.setattr(
        storage, "_create_supabase_client", lambda: _DummyClient(bucket_ref)
    )
    monkeypatch.setenv("SUPABASE_STORAGE_BUCKET", "lattes-cvs")
    monkeypatch.setenv("SUPABASE_STORAGE_FOLDER", "raw")

    history = storage.get_curriculo_pdf_history("Jose Silva")

    assert len(history.versions) == 2
    assert history.first_version is not None
    assert history.last_version is not None
    assert history.first_version.filename == "jose-silva-2026-04-02.pdf"
    assert history.last_version.filename == "jose-silva-2026-04-10.pdf"


def test_download_storage_file_bytes_returns_none_when_object_is_missing(monkeypatch):
    bucket_ref = _NotFoundBucketRef()

    monkeypatch.setattr(
        storage, "_create_supabase_client", lambda: _DummyClient(bucket_ref)
    )
    monkeypatch.setenv("SUPABASE_STORAGE_BUCKET", "lattes-cvs")

    result = storage.download_storage_file_bytes(
        "structured/outputs/v2/curriculos/neocles-alves-pereira/2020-09-11/manifest.json"
    )

    assert result is None
    assert bucket_ref.download_calls == [
        "structured/outputs/v2/curriculos/neocles-alves-pereira/2020-09-11/manifest.json"
    ]
