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
