from src.core import curriculo_diff


def test_build_curriculo_text_diff_counts_added_removed_lines(monkeypatch):
    def _fake_extract(pdf_bytes: bytes) -> str:
        if pdf_bytes == b"old":
            return "linha A\nlinha B"
        return "linha A\nlinha C\nlinha D"

    monkeypatch.setattr(curriculo_diff, "_extrair_texto_pdf_bytes", _fake_extract)

    result = curriculo_diff.build_curriculo_text_diff(b"old", b"new")

    assert result.has_changes is True
    assert result.added_lines == 2
    assert result.removed_lines == 1
    assert "primeira-versao" in result.diff_preview
    assert "ultima-versao" in result.diff_preview


def test_diff_cvs_identicos(monkeypatch):
    """Quando os dois PDFs têm exatamente o mesmo texto, não deve detectar mudanças."""

    def _fake_extract(pdf_bytes: bytes) -> str:  # noqa: ARG001
        return "Identificação\nVictor Ferreira\nPublicações\n2023 - Artigo X\n"

    monkeypatch.setattr(curriculo_diff, "_extrair_texto_pdf_bytes", _fake_extract)

    result = curriculo_diff.build_curriculo_text_diff(b"pdf-v1", b"pdf-v1")

    assert result.has_changes is False
    assert result.added_lines == 0
    assert result.removed_lines == 0
    assert result.diff_preview == ""


def test_diff_cv_atualizado_com_nova_publicacao(monkeypatch):
    """
    Simula o cenário onde o CV de 2026-03-10 era consultado e em 2026-04-13
    o docente adicionou uma nova publicação.  Deve detectar a linha adicionada.
    """
    VERSAO_2026_03_10 = (
        "Identificação\nVictor Ferreira\n"
        "Publicações\n"
        "2024 - Artigo A — Revista X\n"
        "2023 - Artigo B — Revista Y\n"
    )
    VERSAO_2026_04_13 = (
        "Identificação\nVictor Ferreira\n"
        "Publicações\n"
        "2026 - Novo Artigo Z — Revista W\n"  # nova publicação adicionada
        "2024 - Artigo A — Revista X\n"
        "2023 - Artigo B — Revista Y\n"
    )

    def _fake_extract(pdf_bytes: bytes) -> str:
        return (
            VERSAO_2026_03_10 if pdf_bytes == b"pdf-2026-03-10" else VERSAO_2026_04_13
        )

    monkeypatch.setattr(curriculo_diff, "_extrair_texto_pdf_bytes", _fake_extract)

    result = curriculo_diff.build_curriculo_text_diff(
        b"pdf-2026-03-10", b"pdf-2026-04-13"
    )

    assert result.has_changes is True
    assert result.added_lines == 1
    assert result.removed_lines == 0
    assert "Novo Artigo Z" in result.diff_preview


def test_diff_cv_com_linha_removida_e_adicionada(monkeypatch):
    """
    Simula atualização onde uma linha foi corrigida (remove a antiga, adiciona a nova).
    Deve contar 1 remoção e 1 adição.
    """

    def _fake_extract(pdf_bytes: bytes) -> str:
        if pdf_bytes == b"old":
            return "Título: Doutor em Ciências\nInstituição: UFSCar\n"
        return "Título: Doutor em Ciência da Computação\nInstituição: UFSCar\n"

    monkeypatch.setattr(curriculo_diff, "_extrair_texto_pdf_bytes", _fake_extract)

    result = curriculo_diff.build_curriculo_text_diff(b"old", b"new")

    assert result.has_changes is True
    assert result.added_lines == 1
    assert result.removed_lines == 1
