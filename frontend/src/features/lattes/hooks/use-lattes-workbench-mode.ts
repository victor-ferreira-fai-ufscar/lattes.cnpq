"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { startTransition } from "react";

export type WorkbenchMode = "individual" | "lote";

const INDIVIDUAL_PATH = "/";
const BATCH_PATH = "/lote";
const SEARCH_PARAM = "nome";

function parseMode(pathname: string): WorkbenchMode {
  return pathname === BATCH_PATH ? "lote" : "individual";
}

export function useLattesWorkbenchMode() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const mode = parseMode(pathname);
  const searchTerm = searchParams.get(SEARCH_PARAM);

  const navigateTo = (
    nextPathname: string,
    nextSearchParams: URLSearchParams,
    method: "push" | "replace",
  ) => {
    const nextQueryString = nextSearchParams.toString();
    const nextUrl = nextQueryString
      ? `${nextPathname}?${nextQueryString}`
      : nextPathname;

    startTransition(() => {
      if (method === "push") {
        router.push(nextUrl, { scroll: false });
        return;
      }

      router.replace(nextUrl, { scroll: false });
    });
  };

  const setMode = (nextMode: WorkbenchMode) => {
    const nextPathname = nextMode === "lote" ? BATCH_PATH : INDIVIDUAL_PATH;
    const nextSearchParams =
      nextMode === "individual"
        ? new URLSearchParams(searchParams.toString())
        : new URLSearchParams();

    navigateTo(nextPathname, nextSearchParams, "push");
  };

  const setSearchTerm = (nextSearchTerm: string | null) => {
    const nextSearchParams = new URLSearchParams(searchParams.toString());
    const normalized = nextSearchTerm?.trim() ?? "";

    if (normalized.length === 0) {
      nextSearchParams.delete(SEARCH_PARAM);
    } else {
      nextSearchParams.set(SEARCH_PARAM, normalized);
    }

    navigateTo(INDIVIDUAL_PATH, nextSearchParams, "replace");
  };

  return {
    mode,
    searchTerm,
    setMode,
    setSearchTerm,
  };
}