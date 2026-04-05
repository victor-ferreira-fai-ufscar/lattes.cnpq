"use client";

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

  const scrapeSelected = async (outputFormat: OutputFormat) => {
    resetFeedback();
    summaryFlow.reset();
    await individualFlow.scrapeSelected(outputFormat);
  };

  const trySearchVariants = async (nome: string) => {
    resetFeedback();
    summaryFlow.reset();
    const matchedTerm = await individualFlow.searchWithVariants(nome);
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
    resetFeedback();
    await batchFlow.submitBatch(file, skip, limit, outputFormat);
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

  const clearHistory = () => {
    resetFeedback();
    resetWorkbenchState();
    setSearchTerm(null);
    notifySuccess("Historico limpo com sucesso.");
  };

  const activeLogs =
    (mode === "lote" && batchFlow.liveBatchLogs.length > 0
      ? batchFlow.liveBatchLogs
      : summaryFlow.summaryResult?.logs ??
        individualFlow.scrapeResult?.logs ??
        batchFlow.batchResult?.logs) ?? [];

  const activeRequest = loadingState(
    individualFlow.isSearching,
    individualFlow.isTryingVariants,
    individualFlow.isScraping,
    batchFlow.isSubmitting,
    summaryFlow.isLoadingModels,
    summaryFlow.isSummarizing,
  );

  const cancelActiveRequest = async () => {
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

    notifySuccess("Solicitacao cancelada.");
  };

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
    cancelActiveRequest,
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
        "A aplicacao esta consultando os candidatos para o nome informado e preparando a lista de opcoes.",
      hint: "Isso pode levar alguns segundos, dependendo da resposta do backend.",
    };
  }

  if (isTryingVariants) {
    return {
      kind: "variants" as const,
      title: "Testando variacoes do nome",
      description:
        "A busca esta tentando grafias alternativas para encontrar correspondencias com mais precisao.",
      hint: "O resultado mais promissor sera carregado automaticamente se houver correspondencias.",
    };
  }

  if (isScraping) {
    return {
      kind: "scrape" as const,
      title: "Gerando arquivos do curriculo",
      description:
        "O PDF esta sendo localizado e os arquivos de saida estao sendo preparados para download.",
      hint: "Se houver cache valido, o processamento tende a terminar mais rapido.",
    };
  }

  if (isSubmittingBatch) {
    return {
      kind: "batch" as const,
      title: "Processando lista em lote",
      description:
        "Os nomes do CSV estao sendo enviados para processamento e os registros serao atualizados conforme a execucao avanca.",
      hint: "Voce pode acompanhar os detalhes tecnicos no painel de execucao abaixo.",
    };
  }

  if (isLoadingModels) {
    return {
      kind: "models" as const,
      title: "Atualizando opcoes de modelos",
      description:
        "A aplicacao esta consultando os modelos disponiveis para o provedor de IA selecionado.",
      hint: "Se a chave de acesso mudou recentemente, a lista pode demorar um pouco mais.",
    };
  }

  if (isSummarizing) {
    return {
      kind: "summarize" as const,
      title: "Gerando resumo com IA",
      description:
        "O curriculo esta sendo analisado para montar um resumo mais direto e estruturado.",
      hint: "O resultado aparecera automaticamente assim que a resposta for concluida.",
    };
  }

  return null;
}