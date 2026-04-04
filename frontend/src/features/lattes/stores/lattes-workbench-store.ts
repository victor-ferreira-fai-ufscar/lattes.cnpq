"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type {
  BatchItemError,
  BatchItemSuccess,
  BatchScrapeResponse,
  ScrapeResponse,
  SearchCandidate,
  SummarizeResponse,
} from "@/features/lattes/services/lattes.service";

function normalizeScrapeResult(result: ScrapeResponse | null): ScrapeResponse | null {
  if (!result) {
    return null;
  }

  return {
    ...result,
    generated_files: Array.isArray(result.generated_files) ? result.generated_files : [],
  };
}

function normalizeBatchItem(
  item: BatchItemSuccess | BatchItemError,
): BatchItemSuccess | BatchItemError {
  if (item.status !== "sucesso") {
    return item;
  }

  return {
    ...item,
    generated_files: Array.isArray(item.generated_files) ? item.generated_files : [],
  };
}

function normalizeBatchResult(
  result: BatchScrapeResponse | null,
): BatchScrapeResponse | null {
  if (!result) {
    return null;
  }

  return {
    ...result,
    resultados: Array.isArray(result.resultados)
      ? result.resultados.map((item) => normalizeBatchItem(item))
      : [],
  };
}

type LattesWorkbenchStore = {
  lastSearchTerm: string | null;
  candidates: SearchCandidate[];
  selectedCandidateHref: string | null;
  scrapeResult: ScrapeResponse | null;
  batchResult: BatchScrapeResponse | null;
  liveBatchLogs: string[];
  summaryResult: SummarizeResponse | null;
  setLastSearchTerm: (term: string | null) => void;
  setCandidates: (candidates: SearchCandidate[]) => void;
  setSelectedCandidateHref: (href: string | null) => void;
  setScrapeResult: (result: ScrapeResponse | null) => void;
  setBatchResult: (result: BatchScrapeResponse | null) => void;
  setLiveBatchLogs: (logs: string[]) => void;
  appendLiveBatchLog: (line: string) => void;
  setSummaryResult: (result: SummarizeResponse | null) => void;
  resetWorkbenchState: () => void;
};

const initialState = {
  lastSearchTerm: null,
  candidates: [],
  selectedCandidateHref: null,
  scrapeResult: null,
  batchResult: null,
  liveBatchLogs: [],
  summaryResult: null,
} satisfies Pick<
  LattesWorkbenchStore,
  | "lastSearchTerm"
  | "candidates"
  | "selectedCandidateHref"
  | "scrapeResult"
  | "batchResult"
  | "liveBatchLogs"
  | "summaryResult"
>;

export const useLattesWorkbenchStore = create<LattesWorkbenchStore>()(
  persist(
    (set) => ({
      ...initialState,
      setLastSearchTerm: (term) => {
        set((state) =>
          state.lastSearchTerm === term ? state : { lastSearchTerm: term },
        );
      },
      setCandidates: (candidates) => {
        set((state) => ({
          candidates,
          selectedCandidateHref:
            candidates.some((candidate) => candidate.href === state.selectedCandidateHref)
              ? state.selectedCandidateHref
              : candidates[0]?.href ?? null,
        }));
      },
      setSelectedCandidateHref: (href) => {
        set((state) =>
          state.selectedCandidateHref === href
            ? state
            : { selectedCandidateHref: href },
        );
      },
      setScrapeResult: (result) => {
        const normalized = normalizeScrapeResult(result);
        set((state) =>
          state.scrapeResult === normalized ? state : { scrapeResult: normalized },
        );
      },
      setBatchResult: (result) => {
        const normalized = normalizeBatchResult(result);
        set((state) =>
          state.batchResult === normalized ? state : { batchResult: normalized },
        );
      },
      setLiveBatchLogs: (logs) => {
        set((state) => (state.liveBatchLogs === logs ? state : { liveBatchLogs: logs }));
      },
      appendLiveBatchLog: (line) => {
        set((state) => ({
          liveBatchLogs: [...state.liveBatchLogs, line],
        }));
      },
      setSummaryResult: (result) => {
        set((state) =>
          state.summaryResult === result ? state : { summaryResult: result },
        );
      },
      resetWorkbenchState: () => {
        set(() => ({ ...initialState }));
      },
    }),
    {
      name: "lattes-workbench-store",
      version: 2,
      storage: createJSONStorage(() => localStorage),
      migrate: (persistedState) => {
        const state = persistedState as Partial<LattesWorkbenchStore> | undefined;

        return {
          ...initialState,
          ...state,
          scrapeResult: normalizeScrapeResult(state?.scrapeResult ?? null),
          batchResult: normalizeBatchResult(state?.batchResult ?? null),
          liveBatchLogs: Array.isArray(state?.liveBatchLogs) ? state.liveBatchLogs : [],
          candidates: Array.isArray(state?.candidates) ? state.candidates : [],
        };
      },
    },
  ),
);
