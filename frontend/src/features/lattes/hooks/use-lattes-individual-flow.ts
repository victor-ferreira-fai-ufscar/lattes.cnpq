"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import { buildNameVariants } from "@/features/lattes/lib/name-variants";
import type { OutputFormat } from "@/features/lattes/lib/output-format";
import {
  buscarCandidatos,
  scrapeCurriculoSelecionado,
  type SearchResponse,
  type SearchCandidate,
} from "@/features/lattes/services/lattes.service";
import { isRequestCancelledError } from "@/lib/http";
import { useLattesWorkbenchStore } from "@/features/lattes/stores/lattes-workbench-store";

type IndividualFlowFeedback = {
  notifyError: (error: unknown) => void;
  notifySuccess: (message: string) => void;
};

export function useLattesIndividualFlow({
  searchTerm,
  notifyError,
  notifySuccess,
}: IndividualFlowFeedback & {
  searchTerm: string | null;
}) {
  const storedCandidates = useLattesWorkbenchStore((state) => state.candidates);
  const storedLastSearchTerm = useLattesWorkbenchStore(
    (state) => state.lastSearchTerm,
  );
  const selectedCandidateHref = useLattesWorkbenchStore(
    (state) => state.selectedCandidateHref,
  );
  const scrapeResult = useLattesWorkbenchStore((state) => state.scrapeResult);
  const setLastSearchTerm = useLattesWorkbenchStore(
    (state) => state.setLastSearchTerm,
  );
  const setCandidates = useLattesWorkbenchStore((state) => state.setCandidates);
  const setSelectedCandidateHref = useLattesWorkbenchStore(
    (state) => state.setSelectedCandidateHref,
  );
  const setScrapeResult = useLattesWorkbenchStore((state) => state.setScrapeResult);
  const liveExecutionLogs = useLattesWorkbenchStore(
    (state) => state.liveExecutionLogs,
  );
  const setLiveExecutionLogs = useLattesWorkbenchStore(
    (state) => state.setLiveExecutionLogs,
  );
  const appendLiveExecutionLog = useLattesWorkbenchStore(
    (state) => state.appendLiveExecutionLog,
  );
  const queryClient = useQueryClient();
  const [isTryingVariants, setIsTryingVariants] = useState(false);
  const variantsAbortRef = useRef<AbortController | null>(null);
  const scrapeAbortRef = useRef<AbortController | null>(null);
  const lastSearchFeedbackAt = useRef<number>(0);
  const lastSearchErrorAt = useRef<number>(0);

  const candidatesQuery = useQuery<SearchResponse>({
    queryKey: ["lattes", "search-candidates", searchTerm],
    queryFn: ({ signal }) =>
      buscarCandidatos(searchTerm ?? "", 20, {
        signal,
        onLog: appendLiveExecutionLog,
      }),
    enabled: Boolean(searchTerm),
    staleTime: 60_000,
  });
  const candidates = candidatesQuery.data?.candidatos ?? storedCandidates;
  const selectedCandidate =
    candidates.find((candidate) => candidate.href === selectedCandidateHref) ??
    candidates[0] ??
    null;

  const [isScraping, setIsScraping] = useState(false);

  useEffect(() => {
    const response = candidatesQuery.data;
    if (!response) {
      return;
    }

    if (lastSearchFeedbackAt.current === candidatesQuery.dataUpdatedAt) {
      return;
    }

    lastSearchFeedbackAt.current = candidatesQuery.dataUpdatedAt;
    setCandidates(response.candidatos);
    setLastSearchTerm(response.nome_busca || searchTerm);
    if (liveExecutionLogs.length === 0 && response.logs?.length) {
      setLiveExecutionLogs(response.logs);
    }
    notifySuccess(
      response.total > 0
        ? `${response.total} opção(ões) encontrada(s). Escolha uma pessoa para continuar.`
        : "Não encontramos resultados para o nome informado.",
    );
  }, [
    searchTerm,
    candidatesQuery.data,
    candidatesQuery.dataUpdatedAt,
    liveExecutionLogs.length,
    notifySuccess,
    setCandidates,
    setLastSearchTerm,
    setLiveExecutionLogs,
  ]);

  useEffect(() => {
    if (!candidatesQuery.isError || !candidatesQuery.error) {
      return;
    }

    if (isRequestCancelledError(candidatesQuery.error)) {
      return;
    }

    if (lastSearchErrorAt.current === candidatesQuery.errorUpdatedAt) {
      return;
    }

    lastSearchErrorAt.current = candidatesQuery.errorUpdatedAt;
    notifyError(candidatesQuery.error);
  }, [
    candidatesQuery.error,
    candidatesQuery.errorUpdatedAt,
    candidatesQuery.isError,
    notifyError,
  ]);

  const scrapeSelected = async (outputFormat: OutputFormat) => {
    if (!selectedCandidate) {
      notifyError(new Error("Escolha uma pessoa antes de continuar."));
      return;
    }

    setScrapeResult(null);
    setIsScraping(true);
    const controller = new AbortController();
    scrapeAbortRef.current = controller;

    try {
      const result = await scrapeCurriculoSelecionado(
        selectedCandidate.nome,
        selectedCandidate.href,
        outputFormat,
        {
          signal: controller.signal,
          onLog: appendLiveExecutionLog,
        },
      );
      if (liveExecutionLogs.length === 0 && result.logs?.length) {
        setLiveExecutionLogs(result.logs);
      }
      setScrapeResult(result);
      notifySuccess("Currículo preparado com sucesso.");
    } catch (error) {
      if (!isRequestCancelledError(error)) {
        notifyError(error);
      }
    } finally {
      if (scrapeAbortRef.current === controller) {
        scrapeAbortRef.current = null;
      }
      setIsScraping(false);
    }
  };

  const refetchCandidates = async () => {
    if (!searchTerm) {
      return;
    }

    await candidatesQuery.refetch();
  };

  const searchWithVariants = async (rawName: string) => {
    const baseName = rawName.trim();
    if (!baseName) {
      notifyError(new Error("Informe um nome para tentar variações."));
      return null;
    }

    const variants = buildNameVariants(baseName);
    setIsTryingVariants(true);
    const controller = new AbortController();
    variantsAbortRef.current = controller;

    try {
      for (const variant of variants) {
        if (controller.signal.aborted) {
          throw new DOMException("Aborted", "AbortError");
        }

        const response = await buscarCandidatos(variant, 20, {
          signal: controller.signal,
          onLog: appendLiveExecutionLog,
        });
        queryClient.setQueryData(["lattes", "search-candidates", variant], response);
        if (liveExecutionLogs.length === 0 && response.logs?.length) {
          setLiveExecutionLogs(response.logs);
        }

        if (response.total > 0) {
          setCandidates(response.candidatos);
          setLastSearchTerm(response.nome_busca || variant);
          notifySuccess(
            `${response.total} opção(ões) encontrada(s) com a variação "${response.nome_busca || variant}".`,
          );
          return response.nome_busca || variant;
        }
      }

      setCandidates([]);
      setLastSearchTerm(baseName);
      notifyError(
        new Error(
          "Não encontramos resultados mesmo após testar variações automáticas do nome.",
        ),
      );
      return null;
    } catch (error) {
      if (!isRequestCancelledError(error)) {
        notifyError(error);
      }
      return null;
    } finally {
      if (variantsAbortRef.current === controller) {
        variantsAbortRef.current = null;
      }
      setIsTryingVariants(false);
    }
  };

  const cancelActiveRequest = async () => {
    variantsAbortRef.current?.abort();
    scrapeAbortRef.current?.abort();
    await queryClient.cancelQueries({ queryKey: ["lattes", "search-candidates"] });
  };

  const setSelectedCandidate = (candidate: SearchCandidate) => {
    setSelectedCandidateHref(candidate.href);
  };

  const reset = () => {
    setSelectedCandidateHref(null);
    setScrapeResult(null);
  };

  return {
    lastSearchTerm: searchTerm ?? storedLastSearchTerm,
    candidates,
    selectedCandidate,
    scrapeResult,
    isSearching: candidatesQuery.isFetching,
    isScraping,
    isTryingVariants,
    setSelectedCandidate,
    refetchCandidates,
    searchWithVariants,
    scrapeSelected,
    cancelActiveRequest,
    reset,
  };
}