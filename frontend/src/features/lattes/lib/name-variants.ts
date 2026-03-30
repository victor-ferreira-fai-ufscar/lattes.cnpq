function removeAccents(text: string) {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function toTitleCase(text: string) {
  return text
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

export function buildNameVariants(name: string) {
  const cleaned = name.trim();
  if (!cleaned) {
    return [];
  }

  const variants = new Set<string>([
    cleaned,
    removeAccents(cleaned),
    cleaned.toUpperCase(),
    cleaned.toLowerCase(),
    toTitleCase(cleaned),
  ]);

  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    variants.add(`${parts[0]} ${parts[parts.length - 1]}`);
    variants.add(parts[0]);
  }

  return [...variants].filter(Boolean);
}
