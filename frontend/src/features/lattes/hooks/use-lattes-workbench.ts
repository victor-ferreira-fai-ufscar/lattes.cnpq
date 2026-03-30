"use client";

import { useLattesBatchFlow } from "@/features/lattes/hooks/use-lattes-batch-flow";
import { useLattesWorkbenchFeedback } from "@/features/lattes/hooks/use-lattes-workbench-feedback";
import { useLattesIndividualFlow } from "@/features/lattes/hooks/use-lattes-individual-flow";
import {
  useLattesWorkbenchMode,
  type WorkbenchMode,
} from "@/features/lattes/hooks/use-lattes-workbench-mode";
import { useLattesSummary } from "@/features/lattes/hooks/use-lattes-summary";

export function useLattesWorkbench() {
  const { mode, searchTerm, setMode, setSearchTerm } = useLattesWorkbenchMode();
  const { errorMessage, statusMessage, resetFeedback, notifyError, notifySuccess } =
    useLattesWorkbenchFeedback();

  const individualFlow = useLattesIndividualFlow({
    searchTerm,
    notifyError,
    notifySuccess,
  });
  const batchFlow = useLattesBatchFlow({
    notifyError,
    notifySuccess,
  });
  const summaryFlow = useLattesSummary({
    scrapeResult: individualFlow.scrapeResult,
    notifyError,
    notifySuccess,
  });

  const handleModeChange = (nextMode: WorkbenchMode) => {
    resetFeedback();
    if (mode === nextMode) {
      return;
    }

    setMode(nextMode);
  };

  const searchCandidates = async (nome: string) => {
    resetFeedback();
    summaryFlow.reset();

    if (nome.trim() === (searchTerm ?? "").trim()) {
      await individualFlow.refetchCandidates();
      return;
    }

    setSearchTerm(nome);
  };

  const scrapeSelected = async () => {
    resetFeedback();
    summaryFlow.reset();
    await individualFlow.scrapeSelected();
  };

  const submitBatch = async (file: File, skip: number, limit?: number) => {
    resetFeedback();
    await batchFlow.submitBatch(file, skip, limit);
  };

  const loadModels = async (provisorio?: {
    provedor?: typeof summaryFlow.summaryConfig.provedor;
    apiKey?: string;
  }) => {
    resetFeedback();
    await summaryFlow.loadModels(provisorio);
  };

  const summarize = async (config?: {
    provedor?: typeof summaryFlow.summaryConfig.provedor;
    modelo?: string;
    apiKey?: string;
  }) => {
    resetFeedback();
    await summaryFlow.summarize(config);
  };

  const activeLogs =
    (mode === "lote" && batchFlow.liveBatchLogs.length > 0
      ? batchFlow.liveBatchLogs
      : summaryFlow.summaryResult?.logs ??
        individualFlow.scrapeResult?.logs ??
        batchFlow.batchResult?.logs) ?? [];

  return {
    mode,
    loading: {
      search: individualFlow.isSearching,
      scrape: individualFlow.isScraping,
      batch: batchFlow.isSubmitting,
      summarize: summaryFlow.isSummarizing,
      models: summaryFlow.isLoadingModels,
    },
    errorMessage,
    statusMessage,
    lastSearchTerm: individualFlow.lastSearchTerm,
    candidates: individualFlow.candidates,
    selectedCandidate: individualFlow.selectedCandidate,
    scrapeResult: individualFlow.scrapeResult,
    batchResult: batchFlow.batchResult,
    summaryResult: summaryFlow.summaryResult,
    availableModels: summaryFlow.availableModels,
    storedApiKeys: summaryFlow.storedApiKeys,
    summaryConfig: summaryFlow.summaryConfig,
    handleModeChange,
    searchCandidates,
    setSelectedCandidate: individualFlow.setSelectedCandidate,
    scrapeSelected,
    submitBatch,
    updateSummaryConfig: summaryFlow.updateSummaryConfig,
    loadModels,
    summarize,
    activeLogs,
  };
}