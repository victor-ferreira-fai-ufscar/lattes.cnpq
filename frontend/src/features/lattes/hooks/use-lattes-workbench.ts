"use client";

import { useState } from "react";

import { getApiErrorMessage } from "@/lib/http";
import {
  buscarCandidatos,
  listarModelosPorProvedor,
  scrapeCurriculoSelecionado,
  scrapeCurriculosLote,
  summarizeCurriculo,
  type AIProvider,
  type BatchScrapeResponse,
  type ScrapeResponse,
  type SearchCandidate,
  type SummarizeResponse,
} from "@/features/lattes/services/lattes.service";

export type WorkbenchMode = "individual" | "lote";

type LoadingState = {
  search: boolean;
  scrape: boolean;
  batch: boolean;
  summarize: boolean;
  models: boolean;
};

const defaultLoadingState: LoadingState = {
  search: false,
  scrape: false,
  batch: false,
  summarize: false,
  models: false,
};

export function useLattesWorkbench() {
  const [mode, setMode] = useState<WorkbenchMode>("individual");
  const [loading, setLoading] = useState<LoadingState>(defaultLoadingState);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
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
  const [summaryConfig, setSummaryConfig] = useState<{
    provedor: AIProvider;
    modelo: string;
    apiKey: string;
  }>({
    provedor: "openai",
    modelo: "gpt-4o-mini",
    apiKey: "",
  });

  const setLoadingFlag = (key: keyof LoadingState, value: boolean) => {
    setLoading((current) => ({ ...current, [key]: value }));
  };

  const resetFeedback = () => {
    setErrorMessage(null);
    setStatusMessage(null);
  };

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
          ? `${response.total} candidato(s) encontrado(s).`
          : "Nenhum candidato encontrado para o nome informado.",
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
      setErrorMessage("Selecione um candidato antes de iniciar o scraping.");
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
      setStatusMessage("Currículo processado com sucesso.");
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
        `${response.total_processados} currículo(s) processado(s) no lote.`,
      );
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error));
    } finally {
      setLoadingFlag("batch", false);
    }
  };

  const updateSummaryConfig = (
    patch: Partial<{
      provedor: AIProvider;
      modelo: string;
      apiKey: string;
    }>,
  ) => {
    setSummaryConfig((current) => ({ ...current, ...patch }));
  };

  const loadModels = async (provisorio?: {
    provedor?: AIProvider;
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
      setStatusMessage(`Modelos de ${provedor} carregados.`);
    } catch (error) {
      setAvailableModels([]);
      setErrorMessage(getApiErrorMessage(error));
    } finally {
      setLoadingFlag("models", false);
    }
  };

  const summarize = async (config?: {
    provedor?: AIProvider;
    modelo?: string;
    apiKey?: string;
  }) => {
    if (!scrapeResult) {
      setErrorMessage("Faça o scraping de um currículo antes de gerar o resumo.");
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