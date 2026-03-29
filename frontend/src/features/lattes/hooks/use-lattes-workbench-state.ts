"use client";

import { useEffect, useState } from "react";

import type { AIProvider } from "@/features/lattes/services/lattes.service";

export type LoadingState = {
  search: boolean;
  scrape: boolean;
  batch: boolean;
  summarize: boolean;
  models: boolean;
};

export type SummaryConfig = {
  provedor: AIProvider;
  modelo: string;
  apiKey: string;
};

const defaultLoadingState: LoadingState = {
  search: false,
  scrape: false,
  batch: false,
  summarize: false,
  models: false,
};

const defaultSummaryConfig: SummaryConfig = {
  provedor: "openai",
  modelo: "gpt-4o-mini",
  apiKey: "",
};

const STORAGE_KEY_PREFIX = "lattes_ai_key_";

/**
 * Obtém a chave de acesso armazenada para um provedor específico
 */
function getStoredApiKey(provider: AIProvider): string {
  if (typeof window === "undefined") return "";
  const stored = localStorage.getItem(`${STORAGE_KEY_PREFIX}${provider}`);
  return stored || "";
}

/**
 * Salva a chave de acesso para um provedor específico no localStorage
 */
function saveApiKeyToStorage(provider: AIProvider, apiKey: string): void {
  if (typeof window === "undefined") return;
  if (apiKey.trim()) {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${provider}`, apiKey);
  } else {
    localStorage.removeItem(`${STORAGE_KEY_PREFIX}${provider}`);
  }
}

export function useWorkbenchLoading() {
  const [loading, setLoading] = useState<LoadingState>(defaultLoadingState);

  const setLoadingFlag = (key: keyof LoadingState, value: boolean) => {
    setLoading((current) => ({ ...current, [key]: value }));
  };

  return {
    loading,
    setLoadingFlag,
  };
}

export function useWorkbenchFeedback() {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const resetFeedback = () => {
    setErrorMessage(null);
    setStatusMessage(null);
  };

  return {
    errorMessage,
    statusMessage,
    setErrorMessage,
    setStatusMessage,
    resetFeedback,
  };
}

export function useWorkbenchSummaryConfig() {
  const [summaryConfig, setSummaryConfig] =
    useState<SummaryConfig>(defaultSummaryConfig);
  const [isInitialized, setIsInitialized] = useState(false);

  // Carrega a configuração do localStorage na primeira renderização
  useEffect(() => {
    const storedApiKey = getStoredApiKey(summaryConfig.provedor);
    setSummaryConfig((current) => ({
      ...current,
      apiKey: storedApiKey,
    }));
    setIsInitialized(true);
  }, []);

  const updateSummaryConfig = (patch: Partial<SummaryConfig>) => {
    setSummaryConfig((current) => {
      const updated = { ...current, ...patch };

      // Se a chave de acesso foi alterada, salva no localStorage
      if (patch.apiKey !== undefined) {
        saveApiKeyToStorage(updated.provedor, patch.apiKey);
      }

      // Se o provedor foi alterado, carrega a chave desse novo provedor
      if (patch.provedor !== undefined && patch.provedor !== current.provedor) {
        const newProviderKey = getStoredApiKey(patch.provedor);
        updated.apiKey = newProviderKey;
      }

      return updated;
    });
  };

  return {
    summaryConfig,
    setSummaryConfig,
    updateSummaryConfig,
    isInitialized,
  };
}
