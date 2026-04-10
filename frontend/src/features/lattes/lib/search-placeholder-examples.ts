const INDIVIDUAL_SEARCH_PLACEHOLDER_NAMES = [
  "Dr. Neocles",
  "Debora Cappelini",
  "Silvana Perseguino",
  "Nicolas Toledo",
  "Joao Pedro Silva",
  "Victor Ferreira",
  "Ana Rita Terra Argoud",
] as const;

const PLACEHOLDER_STORAGE_KEY = "lattes.individual-search.placeholder-index";

function pickPlaceholderIndex(previousIndex?: number | null) {
  if (INDIVIDUAL_SEARCH_PLACEHOLDER_NAMES.length <= 1) {
    return 0;
  }

  let nextIndex = Math.floor(
    Math.random() * INDIVIDUAL_SEARCH_PLACEHOLDER_NAMES.length,
  );

  while (nextIndex === previousIndex) {
    nextIndex = Math.floor(
      Math.random() * INDIVIDUAL_SEARCH_PLACEHOLDER_NAMES.length,
    );
  }

  return nextIndex;
}

export function getNextIndividualSearchPlaceholder() {
  if (typeof window === "undefined") {
    return INDIVIDUAL_SEARCH_PLACEHOLDER_NAMES[0];
  }

  const storedIndex = window.localStorage.getItem(PLACEHOLDER_STORAGE_KEY);
  const previousIndex = Number.parseInt(storedIndex ?? "", 10);
  const nextIndex = pickPlaceholderIndex(
    Number.isNaN(previousIndex) ? null : previousIndex,
  );

  window.localStorage.setItem(PLACEHOLDER_STORAGE_KEY, String(nextIndex));

  return INDIVIDUAL_SEARCH_PLACEHOLDER_NAMES[nextIndex];
}

export function formatIndividualSearchPlaceholder(name: string) {
  return `Ex.: ${name}`;
}

export { INDIVIDUAL_SEARCH_PLACEHOLDER_NAMES };