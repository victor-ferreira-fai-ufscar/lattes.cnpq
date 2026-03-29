"use client";

import { useState } from "react";

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

  const updateSummaryConfig = (patch: Partial<SummaryConfig>) => {
    setSummaryConfig((current) => ({ ...current, ...patch }));
  };

  return {
    summaryConfig,
    setSummaryConfig,
    updateSummaryConfig,
  };
}
