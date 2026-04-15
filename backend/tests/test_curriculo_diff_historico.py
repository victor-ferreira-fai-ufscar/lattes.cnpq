"""
Testes integrados de Cache com Diff.

Cenário principal:
  - victor-ferreira-2026-03-10.pdf  → primeira consulta ao CV
  - victor-ferreira-2026-04-13.pdf  → CV foi atualizado pelo docente

Verifica que:
  1. O histórico retorna ambas as versões ordenadas.
  2. Os bytes de cada versão podem ser baixados individualmente do cache.
  3. O diff identifica corretamente o que mudou entre as duas versões.
  4. Quando só existe uma versão, o diff não reporta mudanças.
"""

from datetime import date

from src.core import curriculo_diff, storage


# ---------------------------------------------------------------------------
# Infraestrutura de mock reutilizável
# ---------------------------------------------------------------------------


class _TwoVersionsBucketRef:
    """
    Simula o Supabase Storage com dois CVs de Victor Ferreira em datas distintas.
    Retorna bytes diferentes por arquivo para permitir diffs significativos.
    """

    _PDF_DATA = {
        "raw/victor-ferreira-2026-03-10.pdf": b"pdf-2026-03-10",
        "raw/victor-ferreira-2026-04-13.pdf": b"pdf-2026-04-13",
    }

    def list(self, path=None, options=None):  # noqa: ANN001, ANN002, ARG002
        return [
            {
                "name": "victor-ferreira-2026-03-10.pdf",
                "updated_at": "2026-03-10T10:00:00+00:00",
            },
            {
                "name": "victor-ferreira-2026-04-13.pdf",
                "updated_at": "2026-04-13T15:30:00+00:00",
            },
        ]

    def get_public_url(self, object_path: str) -> str:
        return f"https://storage.example/{object_path}"

    def download(self, object_path: str) -> bytes:
        if object_path not in self._PDF_DATA:
            raise FileNotFoundError(f"Objeto não encontrado: {object_path}")
        return self._PDF_DATA[object_path]


class _OneVersionBucketRef:
    """Simula o Supabase Storage com apenas uma versão do CV."""

    def list(self, path=None, options=None):  # noqa: ANN001, ANN002, ARG002
        return [
            {
                "name": "victor-ferreira-2026-03-10.pdf",
                "updated_at": "2026-03-10T10:00:00+00:00",
            },
        ]

    def get_public_url(self, object_path: str) -> str:
        return f"https://storage.example/{object_path}"

    def download(self, object_path: str) -> bytes:  # noqa: ARG002
        return b"pdf-2026-03-10"


class _MockStorage:
    def __init__(self, bucket_ref):
        self._ref = bucket_ref

    def from_(self, bucket: str):  # noqa: ANN001, ARG002
        return self._ref


class _MockClient:
    def __init__(self, bucket_ref):
        self.storage = _MockStorage(bucket_ref)


def _fake_extract_two_versions(pdf_bytes: bytes) -> str:
    """Retorna conteúdo de texto diferente para cada versão do PDF."""
    if pdf_bytes == b"pdf-2026-03-10":
        return (
            "Identificação\nVictor Ferreira\n"
            "Formação\nDoutor em Ciência da Computação — UFSCar\n"
            "Publicações\n"
            "2024 - Artigo A — Revista X\n"
            "2023 - Artigo B — Revista Y\n"
        )
    # Versão de 2026-04-13: nova publicação adicionada
    return (
        "Identificação\nVictor Ferreira\n"
        "Formação\nDoutor em Ciência da Computação — UFSCar\n"
        "Publicações\n"
        "2026 - Novo Artigo Z — Revista W\n"
        "2024 - Artigo A — Revista X\n"
        "2023 - Artigo B — Revista Y\n"
    )


# ---------------------------------------------------------------------------
# Testes
# ---------------------------------------------------------------------------


def test_historico_retorna_ambas_versoes_ordenadas(monkeypatch):
    """
    Com dois CVs no cache (2026-03-10 e 2026-04-13), o histórico deve retornar
    as duas versões com first_version=2026-03-10 e last_version=2026-04-13.
    """
    monkeypatch.setattr(
        storage, "_create_supabase_client", lambda: _MockClient(_TwoVersionsBucketRef())
    )
    monkeypatch.setenv("SUPABASE_STORAGE_BUCKET", "lattes-cvs")
    monkeypatch.setenv("SUPABASE_STORAGE_FOLDER", "raw")
    monkeypatch.setenv("SUPABASE_STORAGE_PUBLIC", "true")

    history = storage.get_curriculo_pdf_history("Victor Ferreira")

    assert len(history.versions) == 2
    assert history.first_version is not None
    assert history.last_version is not None
    assert history.first_version.curriculo_date == date(2026, 3, 10)
    assert history.last_version.curriculo_date == date(2026, 4, 13)


def test_bytes_de_cada_versao_podem_ser_baixados_individualmente(monkeypatch):
    """
    Cada versão do CV deve poder ser baixada individualmente do cache
    e retornar os bytes corretos.
    """
    monkeypatch.setattr(
        storage, "_create_supabase_client", lambda: _MockClient(_TwoVersionsBucketRef())
    )
    monkeypatch.setenv("SUPABASE_STORAGE_BUCKET", "lattes-cvs")
    monkeypatch.setenv("SUPABASE_STORAGE_FOLDER", "raw")
    monkeypatch.setenv("SUPABASE_STORAGE_PUBLIC", "true")

    history = storage.get_curriculo_pdf_history("Victor Ferreira")
    first_bytes = storage.download_storage_file_bytes(history.first_version.object_path)
    last_bytes = storage.download_storage_file_bytes(history.last_version.object_path)

    assert first_bytes == b"pdf-2026-03-10"
    assert last_bytes == b"pdf-2026-04-13"
    assert first_bytes != last_bytes


def test_diff_detecta_publicacao_adicionada_entre_versoes(monkeypatch):
    """
    Diff entre 2026-03-10 e 2026-04-13 deve reportar 1 linha adicionada
    (nova publicação) e 0 linhas removidas.
    """
    monkeypatch.setattr(
        storage, "_create_supabase_client", lambda: _MockClient(_TwoVersionsBucketRef())
    )
    monkeypatch.setenv("SUPABASE_STORAGE_BUCKET", "lattes-cvs")
    monkeypatch.setenv("SUPABASE_STORAGE_FOLDER", "raw")
    monkeypatch.setenv("SUPABASE_STORAGE_PUBLIC", "true")
    monkeypatch.setattr(
        curriculo_diff, "_extrair_texto_pdf_bytes", _fake_extract_two_versions
    )

    history = storage.get_curriculo_pdf_history("Victor Ferreira")
    first_bytes = storage.download_storage_file_bytes(history.first_version.object_path)
    last_bytes = storage.download_storage_file_bytes(history.last_version.object_path)

    diff = curriculo_diff.build_curriculo_text_diff(first_bytes, last_bytes)

    assert diff.has_changes is True
    assert diff.added_lines == 1
    assert diff.removed_lines == 0
    assert "Novo Artigo Z" in diff.diff_preview


def test_diff_cv_sem_atualizacao_nao_tem_mudancas(monkeypatch):
    """
    Quando só existe uma versão no cache (first == last), o diff deve
    indicar ausência de mudanças.
    """
    monkeypatch.setattr(
        storage, "_create_supabase_client", lambda: _MockClient(_OneVersionBucketRef())
    )
    monkeypatch.setenv("SUPABASE_STORAGE_BUCKET", "lattes-cvs")
    monkeypatch.setenv("SUPABASE_STORAGE_FOLDER", "raw")
    monkeypatch.setenv("SUPABASE_STORAGE_PUBLIC", "true")

    history = storage.get_curriculo_pdf_history("Victor Ferreira")

    assert len(history.versions) == 1
    assert history.first_version is not None
    assert history.last_version is not None
    # first e last apontam para o mesmo arquivo
    assert history.first_version.object_path == history.last_version.object_path

    first_bytes = storage.download_storage_file_bytes(history.first_version.object_path)
    last_bytes = storage.download_storage_file_bytes(history.last_version.object_path)

    # Mesmos bytes → monkeypatch desnecessário, mas garantimos que não há diff
    diff = curriculo_diff.build_curriculo_text_diff(first_bytes, last_bytes)

    assert diff.has_changes is False
    assert diff.added_lines == 0
    assert diff.removed_lines == 0
