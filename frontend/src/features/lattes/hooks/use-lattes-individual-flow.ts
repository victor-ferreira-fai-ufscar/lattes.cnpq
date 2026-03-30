"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import {
  buscarCandidatos,
  scrapeCurriculoSelecionado,
  type SearchResponse,
  type ScrapeResponse,
  type SearchCandidate,
} from "@/features/lattes/services/lattes.service";

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
  const [selectedCandidateHref, setSelectedCandidateHref] = useState<string | null>(
    null,
  );
  const lastSearchFeedbackAt = useRef<number>(0);
  const lastSearchErrorAt = useRef<number>(0);

  const candidatesQuery = useQuery<SearchResponse>({
    queryKey: ["lattes", "search-candidates", searchTerm],
    queryFn: () => buscarCandidatos(searchTerm ?? ""),
    enabled: Boolean(searchTerm),
    staleTime: 60_000,
  });
  const candidates = candidatesQuery.data?.candidatos ?? [];
  const selectedCandidate =
    candidates.find((candidate) => candidate.href === selectedCandidateHref) ??
    candidates[0] ??
    null;

  const scrapeMutation = useMutation<ScrapeResponse, unknown, SearchCandidate>({
    mutationFn: (candidate) =>
      scrapeCurriculoSelecionado(candidate.nome, candidate.href),
    onSuccess: () => {
      notifySuccess("Curriculo preparado com sucesso.");
    },
    onError: (error) => {
      notifyError(error);
    },
  });

  useEffect(() => {
    const response = candidatesQuery.data;
    if (!response) {
      return;
    }

    if (lastSearchFeedbackAt.current === candidatesQuery.dataUpdatedAt) {
      return;
    }

    lastSearchFeedbackAt.current = candidatesQuery.dataUpdatedAt;
    notifySuccess(
      response.total > 0
        ? `${response.total} opcao(oes) encontrada(s). Escolha uma pessoa para continuar.`
        : "Nao encontramos resultados para o nome informado.",
    );
  }, [searchTerm, candidatesQuery.data, candidatesQuery.dataUpdatedAt, notifySuccess]);

  useEffect(() => {
    if (!candidatesQuery.isError || !candidatesQuery.error) {
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

  const scrapeSelected = async () => {
    if (!selectedCandidate) {
      notifyError(new Error("Escolha uma pessoa antes de continuar."));
      return;
    }

    scrapeMutation.reset();
    await scrapeMutation.mutateAsync(selectedCandidate);
  };

  const refetchCandidates = async () => {
    if (!searchTerm) {
      return;
    }

    await candidatesQuery.refetch();
  };

  const setSelectedCandidate = (candidate: SearchCandidate) => {
    setSelectedCandidateHref(candidate.href);
  };

  const reset = () => {
    setSelectedCandidateHref(null);
    scrapeMutation.reset();
  };

  return {
    lastSearchTerm: searchTerm,
    candidates,
    selectedCandidate,
    scrapeResult: scrapeMutation.data ?? null,
    isSearching: candidatesQuery.isFetching,
    isScraping: scrapeMutation.isPending,
    setSelectedCandidate,
    refetchCandidates,
    scrapeSelected,
    reset,
  };
}