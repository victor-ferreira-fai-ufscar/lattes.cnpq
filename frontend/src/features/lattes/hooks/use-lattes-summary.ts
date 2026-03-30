"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import type { SummaryFormData } from "@/features/lattes/schemas/lattes.schemas";
import {
  listarModelosPorProvedor,
  summarizeCurriculo,
  type ScrapeResponse,
  type SummarizeResponse,
} from "@/features/lattes/services/lattes.service";
import { useLattesSummaryStore } from "@/features/lattes/stores/lattes-summary-store";

type ModelsPayload = {
  provedor: SummaryFormData["provedor"];
  apiKey?: string;
};

type SummaryPayload = SummaryFormData & {
  nome: string;
};

type SummaryFlowFeedback = {
  scrapeResult: ScrapeResponse | null;
  notifyError: (error: unknown) => void;
  notifySuccess: (message: string) => void;
};

export function useLattesSummary({
  scrapeResult,
  notifyError,
  notifySuccess,
}: SummaryFlowFeedback) {
  const [modelsRequest, setModelsRequest] = useState<ModelsPayload | null>(null);
  const [modelsRequestVersion, setModelsRequestVersion] = useState(0);
  const lastModelsFeedbackAt = useRef<number>(0);
  const lastModelsErrorAt = useRef<number>(0);
  const summaryConfig = useLattesSummaryStore((state) => state.summaryConfig);
  const storedApiKeys = useLattesSummaryStore((state) => state.storedApiKeys);
  const updateSummaryConfig = useLattesSummaryStore(
    (state) => state.updateSummaryConfig,
  );

  const modelsQuery = useQuery({
    queryKey: [
      "lattes",
      "models",
      modelsRequest?.provedor ?? "",
      modelsRequest?.apiKey ?? "",
      modelsRequestVersion,
    ],
    queryFn: () =>
      listarModelosPorProvedor(
        modelsRequest?.provedor ?? "openai",
        modelsRequest?.apiKey || undefined,
      ),
    enabled: modelsRequest !== null,
    staleTime: 5 * 60_000,
  });

  const summaryMutation = useMutation<SummarizeResponse, unknown, SummaryPayload>({
    mutationFn: ({ nome, provedor, modelo, apiKey }) =>
      summarizeCurriculo(nome, provedor, modelo, apiKey || undefined),
    onSuccess: (_, variables) => {
      updateSummaryConfig({
        provedor: variables.provedor,
        modelo: variables.modelo,
        apiKey: variables.apiKey,
      });
      notifySuccess("Resumo gerado com sucesso.");
    },
    onError: (error) => {
      notifyError(error);
    },
  });

  useEffect(() => {
    if (!modelsRequest || !modelsQuery.data) {
      return;
    }

    if (lastModelsFeedbackAt.current === modelsQuery.dataUpdatedAt) {
      return;
    }

    lastModelsFeedbackAt.current = modelsQuery.dataUpdatedAt;

    if (modelsQuery.data.modelos[0]) {
      const nextModel = modelsQuery.data.modelos.includes(summaryConfig.modelo)
        ? summaryConfig.modelo
        : modelsQuery.data.modelos[0];

      updateSummaryConfig({
        provedor: modelsRequest.provedor,
        apiKey: modelsRequest.apiKey ?? "",
        modelo: nextModel,
      });
    }

    notifySuccess(`Opcoes de ${modelsRequest.provedor} atualizadas.`);
  }, [
    modelsQuery.data,
    modelsQuery.dataUpdatedAt,
    modelsRequest,
    notifySuccess,
    summaryConfig.modelo,
    updateSummaryConfig,
  ]);

  useEffect(() => {
    if (!modelsQuery.isError || !modelsQuery.error) {
      return;
    }

    if (lastModelsErrorAt.current === modelsQuery.errorUpdatedAt) {
      return;
    }

    lastModelsErrorAt.current = modelsQuery.errorUpdatedAt;
    notifyError(modelsQuery.error);
  }, [
    modelsQuery.error,
    modelsQuery.errorUpdatedAt,
    modelsQuery.isError,
    notifyError,
  ]);

  const loadModels = async (config?: Partial<ModelsPayload>) => {
    const provedor = config?.provedor ?? summaryConfig.provedor;
    const apiKey = config?.apiKey ?? summaryConfig.apiKey;

    setModelsRequest({ provedor, apiKey });
    setModelsRequestVersion((current) => current + 1);
  };

  const summarize = async (config?: Partial<SummaryFormData>) => {
    if (!scrapeResult) {
      notifyError(new Error("Prepare um curriculo antes de gerar o resumo."));
      return;
    }

    summaryMutation.reset();

    const nextConfig: SummaryFormData = {
      provedor: config?.provedor ?? summaryConfig.provedor,
      modelo: config?.modelo ?? summaryConfig.modelo,
      apiKey: config?.apiKey ?? summaryConfig.apiKey,
    };

    await summaryMutation.mutateAsync({
      nome: scrapeResult.nome,
      ...nextConfig,
    });
  };

  const reset = () => {
    summaryMutation.reset();
  };

  return {
    summaryConfig,
    storedApiKeys,
    availableModels: modelsQuery.data?.modelos ?? [],
    summaryResult: summaryMutation.data ?? null,
    isLoadingModels: modelsQuery.isFetching,
    isSummarizing: summaryMutation.isPending,
    updateSummaryConfig,
    loadModels,
    summarize,
    reset,
  };
}