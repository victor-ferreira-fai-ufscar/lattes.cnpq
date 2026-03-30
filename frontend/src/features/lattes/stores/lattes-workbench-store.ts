"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type {
  BatchScrapeResponse,
  ScrapeResponse,
  SearchCandidate,
  SummarizeResponse,
} from "@/features/lattes/services/lattes.service";

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
        set((state) => (state.scrapeResult === result ? state : { scrapeResult: result }));
      },
      setBatchResult: (result) => {
        set((state) => (state.batchResult === result ? state : { batchResult: result }));
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
    }),
    {
      name: "lattes-workbench-store",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
