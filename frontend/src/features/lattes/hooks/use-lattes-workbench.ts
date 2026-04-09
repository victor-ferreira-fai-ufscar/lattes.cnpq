"use client";

import { useCallback, useMemo, useRef, useState } from "react";

import type { OutputFormat } from "@/features/lattes/lib/output-format";
import { useLattesBatchFlow } from "@/features/lattes/hooks/use-lattes-batch-flow";
import { useLattesWorkbenchFeedback } from "@/features/lattes/hooks/use-lattes-workbench-feedback";
import { useLattesIndividualFlow } from "@/features/lattes/hooks/use-lattes-individual-flow";
import {
  useLattesWorkbenchMode,
  type WorkbenchMode,
} from "@/features/lattes/hooks/use-lattes-workbench-mode";
import { useLattesSummary } from "@/features/lattes/hooks/use-lattes-summary";
import { useLattesWorkbenchStore } from "@/features/lattes/stores/lattes-workbench-store";

export function useLattesWorkbench() {
  const { mode, searchTerm, setMode, setSearchTerm } = useLattesWorkbenchMode();
  const resetWorkbenchState = useLattesWorkbenchStore(
    (state) => state.resetWorkbenchState,
  );
  const clearLiveExecutionLogs = useLattesWorkbenchStore(
    (state) => state.clearLiveExecutionLogs,
  );
  const { errorMessage, statusMessage, resetFeedback, notifyError, notifySuccess } =
    useLattesWorkbenchFeedback();
  const [retryActionLabel, setRetryActionLabel] = useState<string | null>(null);
  const lastRetryActionRef = useRef<(() => Promise<void>) | null>(null);

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
    const trimmedName = nome.trim();
    setRetryActionLabel("Refazer busca");
    lastRetryActionRef.current = async () => {
      await searchCandidates(trimmedName);
    };

    resetFeedback();
    summaryFlow.reset();

    if (trimmedName === (searchTerm ?? "").trim()) {
      await individualFlow.refetchCandidates();
      return;
    }

    setSearchTerm(trimmedName);
  };

  const scrapeSelected = async (outputFormat: OutputFormat) => {
    setRetryActionLabel("Tentar gerar arquivos novamente");
    lastRetryActionRef.current = async () => {
      await scrapeSelected(outputFormat);
    };

    resetFeedback();
    summaryFlow.reset();
    await individualFlow.scrapeSelected(outputFormat);
  };

  const trySearchVariants = async (nome: string) => {
    const trimmedName = nome.trim();
    setRetryActionLabel("Testar variações novamente");
    lastRetryActionRef.current = async () => {
      await trySearchVariants(trimmedName);
    };

    resetFeedback();
    summaryFlow.reset();
    const matchedTerm = await individualFlow.searchWithVariants(trimmedName);
    if (matchedTerm) {
      setSearchTerm(matchedTerm);
    }
  };

  const submitBatch = async (
    file: File,
    skip: number,
    limit: number | undefined,
    outputFormat: OutputFormat,
  ) => {
    setRetryActionLabel("Tentar lote novamente");
    lastRetryActionRef.current = async () => {
      await submitBatch(file, skip, limit, outputFormat);
    };

    resetFeedback();
    await batchFlow.submitBatch(file, skip, limit, outputFormat);
  };

  const loadModels = async (provisorio?: {
    provedor?: typeof summaryFlow.summaryConfig.provedor;
    apiKey?: string;
  }) => {
    setRetryActionLabel("Atualizar modelos novamente");
    lastRetryActionRef.current = async () => {
      await loadModels(provisorio);
    };

    resetFeedback();
    await summaryFlow.loadModels(provisorio);
  };

  const summarize = async (config?: {
    provedor?: typeof summaryFlow.summaryConfig.provedor;
    modelo?: string;
    apiKey?: string;
  }) => {
    setRetryActionLabel("Gerar resumo novamente");
    lastRetryActionRef.current = async () => {
      await summarize(config);
    };

    resetFeedback();
    await summaryFlow.summarize(config);
  };

  const clearHistory = () => {
    resetFeedback();
    resetWorkbenchState();
    setSearchTerm(null);
    lastRetryActionRef.current = null;
    setRetryActionLabel(null);
    notifySuccess("Histórico limpo com sucesso.");
  };

  const clearExecutionLogs = () => {
    clearLiveExecutionLogs();
    notifySuccess("Logs limpos.");
  };

  const activeLogs = useMemo(
    () =>
      (batchFlow.liveBatchLogs.length > 0
        ? batchFlow.liveBatchLogs
        : summaryFlow.summaryResult?.logs ??
          individualFlow.scrapeResult?.logs ??
          batchFlow.batchResult?.logs) ?? [],
    [
      batchFlow.batchResult?.logs,
      batchFlow.liveBatchLogs,
      individualFlow.scrapeResult?.logs,
      summaryFlow.summaryResult?.logs,
    ],
  );

  const activeRequest = useMemo(
    () =>
      loadingState(
        individualFlow.isSearching,
        individualFlow.isTryingVariants,
        individualFlow.isScraping,
        batchFlow.isSubmitting,
        summaryFlow.isLoadingModels,
        summaryFlow.isSummarizing,
      ),
    [
      batchFlow.isSubmitting,
      individualFlow.isScraping,
      individualFlow.isSearching,
      individualFlow.isTryingVariants,
      summaryFlow.isLoadingModels,
      summaryFlow.isSummarizing,
    ],
  );

  const cancelActiveRequest = useCallback(async () => {
    if (!activeRequest) {
      return;
    }

    resetFeedback();

    if (
      activeRequest.kind === "search" ||
      activeRequest.kind === "variants" ||
      activeRequest.kind === "scrape"
    ) {
      await individualFlow.cancelActiveRequest();
    }

    if (activeRequest.kind === "batch") {
      batchFlow.cancelActiveRequest();
    }

    if (activeRequest.kind === "models" || activeRequest.kind === "summarize") {
      await summaryFlow.cancelActiveRequest();
    }

    notifySuccess("Solicitação cancelada.");
  }, [
    activeRequest,
    batchFlow,
    individualFlow,
    notifySuccess,
    resetFeedback,
    summaryFlow,
  ]);

  const retryLastAction = useCallback(async () => {
    const retry = lastRetryActionRef.current;
    if (!retry) {
      return;
    }

    resetFeedback();
    await retry();
  }, [resetFeedback]);

  return {
    mode,
    loading: {
      search: individualFlow.isSearching,
      variants: individualFlow.isTryingVariants,
      scrape: individualFlow.isScraping,
      batch: batchFlow.isSubmitting,
      summarize: summaryFlow.isSummarizing,
      models: summaryFlow.isLoadingModels,
    },
    activeRequest,
    isInteractionLocked: activeRequest !== null,
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
    trySearchVariants,
    setSelectedCandidate: individualFlow.setSelectedCandidate,
    scrapeSelected,
    submitBatch,
    updateSummaryConfig: summaryFlow.updateSummaryConfig,
    loadModels,
    summarize,
    clearHistory,
    clearExecutionLogs,
    cancelActiveRequest,
    canRetryLastAction: retryActionLabel !== null,
    retryActionLabel,
    retryLastAction,
    activeLogs,
  };
}

function loadingState(
  isSearching: boolean,
  isTryingVariants: boolean,
  isScraping: boolean,
  isSubmittingBatch: boolean,
  isLoadingModels: boolean,
  isSummarizing: boolean,
) {
  if (isSearching) {
    return {
      kind: "search" as const,
      title: "Buscando pessoas no Lattes",
      description:
        "A aplicação está consultando os candidatos para o nome informado e preparando a lista de opções.",
      hint: "Isso pode levar alguns segundos, dependendo da resposta do backend.",
    };
  }

  if (isTryingVariants) {
    return {
      kind: "variants" as const,
      title: "Testando variações do nome",
      description:
        "A busca está tentando grafias alternativas para encontrar correspondências com mais precisão.",
      hint: "O resultado mais promissor será carregado automaticamente se houver correspondências.",
    };
  }

  if (isScraping) {
    return {
      kind: "scrape" as const,
      title: "Preparando arquivos do currículo",
      description:
        "O PDF está sendo localizado e os arquivos de saída estão sendo preparados para download.",
      hint: "Se já houver uma versão salva, o processamento tende a terminar mais rápido.",
    };
  }

  if (isSubmittingBatch) {
    return {
      kind: "batch" as const,
      title: "Processando lista em lote",
      description:
        "Os nomes do CSV estão sendo enviados para processamento e os registros serão atualizados conforme a execução avança.",
      hint: "Você pode acompanhar os detalhes técnicos no painel de execução abaixo.",
    };
  }

  if (isLoadingModels) {
    return {
      kind: "models" as const,
      title: "Atualizando opções de modelos",
      description:
        "A aplicação está consultando os modelos disponíveis para o serviço de IA selecionado.",
      hint: "Se a chave de acesso mudou recentemente, a lista pode demorar um pouco mais.",
    };
  }

  if (isSummarizing) {
    return {
      kind: "summarize" as const,
      title: "Gerando resumo com IA",
      description:
        "O currículo está sendo analisado para montar um resumo mais direto e estruturado.",
      hint: "O resultado aparecerá automaticamente assim que a resposta for concluída.",
    };
  }

  return null;
}