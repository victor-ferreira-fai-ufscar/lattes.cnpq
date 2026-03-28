def parse_csv_names(content: bytes) -> list[str]:
    try:
        raw = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        raw = content.decode("latin-1")

    rows = [line.strip() for line in raw.splitlines() if line.strip()]

    seen: set[str] = set()
    unique: list[str] = []
    for row in rows:
        key = row.lower().strip()
        if key not in seen:
            seen.add(key)
            unique.append(row)

    return unique
