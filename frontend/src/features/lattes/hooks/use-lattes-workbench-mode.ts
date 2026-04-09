"use client";

import { usePathname, useRouter } from "next/navigation";
import { startTransition } from "react";

import { useLattesWorkbenchStore } from "@/features/lattes/stores/lattes-workbench-store";

export type WorkbenchMode = "individual" | "lote";

const INDIVIDUAL_PATH = "/";
const BATCH_PATH = "/lote";

function parseMode(pathname: string): WorkbenchMode {
  return pathname === BATCH_PATH ? "lote" : "individual";
}

export function useLattesWorkbenchMode() {
  const pathname = usePathname();
  const router = useRouter();
  const searchTerm = useLattesWorkbenchStore((state) => state.lastSearchTerm);
  const setStoredSearchTerm = useLattesWorkbenchStore(
    (state) => state.setLastSearchTerm,
  );
  const mode = parseMode(pathname);

  const navigateTo = (nextPathname: string, method: "push" | "replace") => {
    startTransition(() => {
      if (method === "push") {
        router.push(nextPathname, { scroll: false });
        return;
      }

      router.replace(nextPathname, { scroll: false });
    });
  };

  const setMode = (nextMode: WorkbenchMode) => {
    const nextPathname = nextMode === "lote" ? BATCH_PATH : INDIVIDUAL_PATH;
    navigateTo(nextPathname, "push");
  };

  const setSearchTerm = (nextSearchTerm: string | null) => {
    const normalized = nextSearchTerm?.trim() ?? "";
    setStoredSearchTerm(normalized.length > 0 ? normalized : null);

    if (mode !== "individual") {
      navigateTo(INDIVIDUAL_PATH, "replace");
    }
  };

  return {
    mode,
    searchTerm,
    setMode,
    setSearchTerm,
  };
}