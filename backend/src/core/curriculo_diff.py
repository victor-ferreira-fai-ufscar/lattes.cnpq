from dataclasses import dataclass
from difflib import unified_diff

from .scraper import _extrair_texto_pdf_bytes


@dataclass(frozen=True)
class CurriculoDiffResult:
    added_lines: int
    removed_lines: int
    has_changes: bool
    diff_preview: str


def build_curriculo_text_diff(
    old_pdf_bytes: bytes,
    new_pdf_bytes: bytes,
    *,
    preview_max_lines: int = 200,
) -> CurriculoDiffResult:
    old_text = _extrair_texto_pdf_bytes(old_pdf_bytes)
    new_text = _extrair_texto_pdf_bytes(new_pdf_bytes)

    old_lines = old_text.splitlines()
    new_lines = new_text.splitlines()
    diff_lines = list(
        unified_diff(
            old_lines,
            new_lines,
            fromfile="primeira-versao",
            tofile="ultima-versao",
            lineterm="",
        )
    )

    added = 0
    removed = 0
    for line in diff_lines:
        if line.startswith("+++") or line.startswith("---"):
            continue
        if line.startswith("+"):
            added += 1
        elif line.startswith("-"):
            removed += 1

    preview = "\n".join(diff_lines[: max(preview_max_lines, 0)])
    return CurriculoDiffResult(
        added_lines=added,
        removed_lines=removed,
        has_changes=bool(added or removed),
        diff_preview=preview,
    )
