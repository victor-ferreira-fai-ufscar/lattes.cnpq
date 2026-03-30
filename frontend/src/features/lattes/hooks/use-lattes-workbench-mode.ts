"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { startTransition } from "react";

export type WorkbenchMode = "individual" | "lote";

const MODE_PARAM = "fluxo";
const SEARCH_PARAM = "nome";

function parseMode(value: string | null): WorkbenchMode {
  return value === "lote" ? "lote" : "individual";
}

export function useLattesWorkbenchMode() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const mode = parseMode(searchParams.get(MODE_PARAM));
  const searchTerm = searchParams.get(SEARCH_PARAM);

  const replaceUrlWithParams = (nextSearchParams: URLSearchParams) => {
    const nextQueryString = nextSearchParams.toString();
    const nextUrl = nextQueryString ? `${pathname}?${nextQueryString}` : pathname;

    startTransition(() => {
      router.replace(nextUrl, { scroll: false });
    });
  };

  const setMode = (nextMode: WorkbenchMode) => {
    const nextSearchParams = new URLSearchParams(searchParams.toString());

    if (nextMode === "individual") {
      nextSearchParams.delete(MODE_PARAM);
    } else {
      nextSearchParams.set(MODE_PARAM, nextMode);
    }

    replaceUrlWithParams(nextSearchParams);
  };

  const setSearchTerm = (nextSearchTerm: string | null) => {
    const nextSearchParams = new URLSearchParams(searchParams.toString());
    const normalized = nextSearchTerm?.trim() ?? "";

    if (normalized.length === 0) {
      nextSearchParams.delete(SEARCH_PARAM);
    } else {
      nextSearchParams.set(SEARCH_PARAM, normalized);
    }

    replaceUrlWithParams(nextSearchParams);
  };

  return {
    mode,
    searchTerm,
    setMode,
    setSearchTerm,
  };
}