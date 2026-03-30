import csv
from io import StringIO


HEADER_TOKENS = {
    "nome",
    "nomes",
    "name",
    "names",
    "docente",
    "docentes",
    "professor",
    "professores",
    "nome_docente",
    "nome docente",
}


def parse_csv_names(content: bytes) -> list[str]:
    try:
        raw = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        raw = content.decode("latin-1")

    reader = csv.reader(StringIO(raw))
    rows: list[str] = []

    for row in reader:
        if not row:
            continue
        first_cell = row[0].strip()
        if first_cell:
            rows.append(first_cell)

    if len(rows) > 1 and rows[0].strip().lower() in HEADER_TOKENS:
        rows = rows[1:]

    seen: set[str] = set()
    unique: list[str] = []
    for row in rows:
        key = row.lower().strip()
        if key not in seen:
            seen.add(key)
            unique.append(row)

    return unique
