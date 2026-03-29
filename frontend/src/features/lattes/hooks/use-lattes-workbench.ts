"use client";

import { useState } from "react";

import { getApiErrorMessage } from "@/lib/http";
import {
  buscarCandidatos,
  listarModelosPorProvedor,
  scrapeCurriculoSelecionado,
  scrapeCurriculosLote,
  summarizeCurriculo,
  type BatchScrapeResponse,
  type ScrapeResponse,
  type SearchCandidate,
  type SummarizeResponse,
} from "@/features/lattes/services/lattes.service";
import {
  useWorkbenchFeedback,
  useWorkbenchLoading,
  useWorkbenchSummaryConfig,
} from "@/features/lattes/hooks/use-lattes-workbench-state";

export type WorkbenchMode = "individual" | "lote";

export function useLattesWorkbench() {
  const [mode, setMode] = useState<WorkbenchMode>("individual");
  const { loading, setLoadingFlag } = useWorkbenchLoading();
  const {
    errorMessage,
    statusMessage,
    setErrorMessage,
    setStatusMessage,
    resetFeedback,
  } = useWorkbenchFeedback();
  const { summaryConfig, setSummaryConfig, updateSummaryConfig } =
    useWorkbenchSummaryConfig();
  const [lastSearchTerm, setLastSearchTerm] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<SearchCandidate[]>([]);
  const [selectedCandidate, setSelectedCandidate] =
    useState<SearchCandidate | null>(null);
  const [scrapeResult, setScrapeResult] = useState<ScrapeResponse | null>(null);
  const [batchResult, setBatchResult] = useState<BatchScrapeResponse | null>(null);
  const [summaryResult, setSummaryResult] =
    useState<SummarizeResponse | null>(null);
  const [liveBatchLogs, setLiveBatchLogs] = useState<string[]>([]);
  const [availableModels, setAvailableModels] = useState<string[]>([]);

  const handleModeChange = (nextMode: WorkbenchMode) => {
    resetFeedback();
    setMode(nextMode);
    if (nextMode === "lote") {
      setCandidates([]);
      setSelectedCandidate(null);
      setScrapeResult(null);
      setSummaryResult(null);
    } else {
      setBatchResult(null);
      setLiveBatchLogs([]);
    }
  };

  const searchCandidates = async (nome: string) => {
    resetFeedback();
    setLoadingFlag("search", true);
    setLastSearchTerm(nome);
    setScrapeResult(null);
    setSummaryResult(null);

    try {
      const response = await buscarCandidatos(nome);
      setCandidates(response.candidatos);
      setSelectedCandidate(response.candidatos[0] ?? null);
      setStatusMessage(
        response.total > 0
          ? `${response.total} opcao(oes) encontrada(s). Escolha uma pessoa para continuar.`
          : "Nao encontramos resultados para o nome informado.",
      );
    } catch (error) {
      setCandidates([]);
      setSelectedCandidate(null);
      setErrorMessage(getApiErrorMessage(error));
    } finally {
      setLoadingFlag("search", false);
    }
  };

  const scrapeSelected = async () => {
    if (!selectedCandidate) {
      setErrorMessage("Escolha uma pessoa antes de continuar.");
      return;
    }

    resetFeedback();
    setLoadingFlag("scrape", true);
    setSummaryResult(null);

    try {
      const response = await scrapeCurriculoSelecionado(
        selectedCandidate.nome,
        selectedCandidate.href,
      );

      setScrapeResult(response);
      setStatusMessage("Curriculo preparado com sucesso.");
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error));
    } finally {
      setLoadingFlag("scrape", false);
    }
  };

  const submitBatch = async (file: File, skip: number, limit?: number) => {
    resetFeedback();
    setLoadingFlag("batch", true);
    setScrapeResult(null);
    setSummaryResult(null);
    setBatchResult(null);
    setLiveBatchLogs([]);

    try {
      // Conta linhas não-vazias do CSV para calcular timeout dinâmico no serviço
      const text = await file.text();
      const totalNamesInCsv = text
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean).length;

      const response = await scrapeCurriculosLote(
        file,
        { skip, limit },
        totalNamesInCsv,
        {
          onLog: (line) => {
            setLiveBatchLogs((current) => [...current, line]);
          },
        },
      );
      setBatchResult(response);
      setLiveBatchLogs((current) =>
        current.length > 0 ? current : (response.logs ?? []),
      );
      setStatusMessage(
        `Processamento concluido para ${response.total_processados} pessoa(s).`,
      );
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error));
    } finally {
      setLoadingFlag("batch", false);
    }
  };

  const loadModels = async (provisorio?: {
    provedor?: typeof summaryConfig.provedor;
    apiKey?: string;
  }) => {
    resetFeedback();
    setLoadingFlag("models", true);

    try {
      const provedor = provisorio?.provedor ?? summaryConfig.provedor;
      const apiKey = provisorio?.apiKey ?? summaryConfig.apiKey;
      const response = await listarModelosPorProvedor(provedor, apiKey || undefined);

      setAvailableModels(response.modelos);
      if (response.modelos[0]) {
        setSummaryConfig((current) => ({
          ...current,
          provedor,
          apiKey,
          modelo: response.modelos.includes(current.modelo)
            ? current.modelo
            : response.modelos[0],
        }));
      }
      setStatusMessage(`Opcoes de ${provedor} atualizadas.`);
    } catch (error) {
      setAvailableModels([]);
      setErrorMessage(getApiErrorMessage(error));
    } finally {
      setLoadingFlag("models", false);
    }
  };

  const summarize = async (config?: {
    provedor?: typeof summaryConfig.provedor;
    modelo?: string;
    apiKey?: string;
  }) => {
    if (!scrapeResult) {
      setErrorMessage("Prepare um curriculo antes de gerar o resumo.");
      return;
    }

    resetFeedback();
    setLoadingFlag("summarize", true);

    const nextConfig = {
      provedor: config?.provedor ?? summaryConfig.provedor,
      modelo: config?.modelo ?? summaryConfig.modelo,
      apiKey: config?.apiKey ?? summaryConfig.apiKey,
    };

    try {
      const response = await summarizeCurriculo(
        scrapeResult.nome,
        nextConfig.provedor,
        nextConfig.modelo,
        nextConfig.apiKey || undefined,
      );

      setSummaryConfig(nextConfig);
      setSummaryResult(response);
      setStatusMessage("Resumo gerado com sucesso.");
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error));
    } finally {
      setLoadingFlag("summarize", false);
    }
  };

  const activeLogs =
    (mode === "lote" && liveBatchLogs.length > 0
      ? liveBatchLogs
      : summaryResult?.logs ?? scrapeResult?.logs ?? batchResult?.logs) ?? [];

  return {
    mode,
    loading,
    errorMessage,
    statusMessage,
    lastSearchTerm,
    candidates,
    selectedCandidate,
    scrapeResult,
    batchResult,
    summaryResult,
    availableModels,
    summaryConfig,
    handleModeChange,
    searchCandidates,
    setSelectedCandidate,
    scrapeSelected,
    submitBatch,
    updateSummaryConfig,
    loadModels,
    summarize,
    activeLogs,
  };
}