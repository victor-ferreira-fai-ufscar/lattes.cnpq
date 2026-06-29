"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { SummaryFormData } from "@/features/lattes/schemas/lattes.schemas";
import type { AIProvider } from "@/features/lattes/services/lattes.service";
import { DEFAULT_SUMMARY_SECTION } from "@/features/lattes/lib/summary-section";

export type StoredApiKeys = Record<AIProvider, string>;

const defaultSummaryConfig: SummaryFormData = {
  provedor: "ollama",
  modelo: "gemma4:12b",
  apiKey: "",
  secao: DEFAULT_SUMMARY_SECTION,
};

const defaultApiKeys: StoredApiKeys = {
  openai: "",
  gemini: "",
  ollama: "",
};

type LattesSummaryStore = {
  summaryConfig: SummaryFormData;
  storedApiKeys: StoredApiKeys;
  updateSummaryConfig: (patch: Partial<SummaryFormData>) => void;
};

export const useLattesSummaryStore = create<LattesSummaryStore>()(
  persist(
    (set) => ({
      summaryConfig: defaultSummaryConfig,
      storedApiKeys: defaultApiKeys,
      updateSummaryConfig: (patch) => {
        set((state) => {
          const nextProvider = patch.provedor ?? state.summaryConfig.provedor;
          const providerChanged = nextProvider !== state.summaryConfig.provedor;
          const hasApiKeyPatch = patch.apiKey !== undefined;
          const nextStoredApiKeys = hasApiKeyPatch
            ? {
                ...state.storedApiKeys,
                [nextProvider]: patch.apiKey ?? "",
              }
            : state.storedApiKeys;
          const nextApiKey = hasApiKeyPatch
            ? patch.apiKey ?? ""
            : providerChanged
              ? nextStoredApiKeys[nextProvider] ?? ""
              : state.summaryConfig.apiKey;
          const nextSummaryConfig: SummaryFormData = {
            ...state.summaryConfig,
            ...patch,
            provedor: nextProvider,
            apiKey: nextApiKey,
          };

          const summaryUnchanged =
            nextSummaryConfig.provedor === state.summaryConfig.provedor &&
            nextSummaryConfig.modelo === state.summaryConfig.modelo &&
            nextSummaryConfig.apiKey === state.summaryConfig.apiKey &&
            nextSummaryConfig.secao === state.summaryConfig.secao;
          const storedKeysUnchanged =
            nextStoredApiKeys.openai === state.storedApiKeys.openai &&
            nextStoredApiKeys.gemini === state.storedApiKeys.gemini &&
            nextStoredApiKeys.ollama === state.storedApiKeys.ollama;

          if (summaryUnchanged && storedKeysUnchanged) {
            return state;
          }

          return {
            summaryConfig: nextSummaryConfig,
            storedApiKeys: nextStoredApiKeys,
          };
        });
      },
    }),
    {
      name: "lattes-summary-store",
      storage: createJSONStorage(() => localStorage),
      // Garante que estados salvos antes do campo 'secao' recebam o padrão ao
      // reidratar, evitando que o seletor inicie com valor indefinido.
      merge: (persistedState, currentState) => {
        const persisted = (persistedState ?? {}) as Partial<LattesSummaryStore>;
        return {
          ...currentState,
          ...persisted,
          summaryConfig: {
            ...currentState.summaryConfig,
            ...persisted.summaryConfig,
            secao: persisted.summaryConfig?.secao ?? DEFAULT_SUMMARY_SECTION,
          },
          storedApiKeys: {
            ...currentState.storedApiKeys,
            ...persisted.storedApiKeys,
          },
        };
      },
    },
  ),
);