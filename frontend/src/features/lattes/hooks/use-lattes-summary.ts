"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import type { SummaryFormData } from "@/features/lattes/schemas/lattes.schemas";
import {
  listarModelosPorProvedor,
  summarizeCurriculo,
  type ScrapeResponse,
  type SummarizeResponse,
} from "@/features/lattes/services/lattes.service";
import { isRequestCancelledError } from "@/lib/http";
import { useLattesSummaryStore } from "@/features/lattes/stores/lattes-summary-store";
import { useLattesWorkbenchStore } from "@/features/lattes/stores/lattes-workbench-store";

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
  const summaryAbortRef = useRef<AbortController | null>(null);
  const lastModelsFeedbackAt = useRef<number>(0);
  const lastModelsErrorAt = useRef<number>(0);
  const queryClient = useQueryClient();
  const summaryConfig = useLattesSummaryStore((state) => state.summaryConfig);
  const storedApiKeys = useLattesSummaryStore((state) => state.storedApiKeys);
  const updateSummaryConfig = useLattesSummaryStore(
    (state) => state.updateSummaryConfig,
  );
  const summaryResult = useLattesWorkbenchStore((state) => state.summaryResult);
  const setSummaryResult = useLattesWorkbenchStore(
    (state) => state.setSummaryResult,
  );

  const modelsQuery = useQuery({
    queryKey: [
      "lattes",
      "models",
      modelsRequest?.provedor ?? "",
      modelsRequest?.apiKey ?? "",
      modelsRequestVersion,
    ],
    queryFn: ({ signal }) =>
      listarModelosPorProvedor(
        modelsRequest?.provedor ?? "openai",
        modelsRequest?.apiKey || undefined,
        { signal },
      ),
    enabled: modelsRequest !== null,
    staleTime: 5 * 60_000,
  });

  const summaryMutation = useMutation<SummarizeResponse, unknown, SummaryPayload>({
    mutationFn: async ({ nome, provedor, modelo, apiKey }) => {
      const controller = new AbortController();
      summaryAbortRef.current = controller;

      try {
        return await summarizeCurriculo(
          nome,
          provedor,
          modelo,
          apiKey || undefined,
          { signal: controller.signal },
        );
      } finally {
        if (summaryAbortRef.current === controller) {
          summaryAbortRef.current = null;
        }
      }
    },
    onSuccess: (response, variables) => {
      setSummaryResult(response);
      updateSummaryConfig({
        provedor: variables.provedor,
        modelo: variables.modelo,
        apiKey: variables.apiKey,
      });
      notifySuccess("Resumo gerado com sucesso.");
    },
    onError: (error) => {
      if (!isRequestCancelledError(error)) {
        notifyError(error);
      }
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

    notifySuccess(`Opções de ${modelsRequest.provedor} atualizadas.`);
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

    if (isRequestCancelledError(modelsQuery.error)) {
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
      notifyError(new Error("Prepare um currículo antes de gerar o resumo."));
      return;
    }

    summaryMutation.reset();
    setSummaryResult(null);

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
    setSummaryResult(null);
  };

  const cancelActiveRequest = async () => {
    summaryAbortRef.current?.abort();
    await queryClient.cancelQueries({ queryKey: ["lattes", "models"] });
  };

  return {
    summaryConfig,
    storedApiKeys,
    availableModels: modelsQuery.data?.modelos ?? [],
    summaryResult,
    isLoadingModels: modelsQuery.isFetching,
    isSummarizing: summaryMutation.isPending,
    updateSummaryConfig,
    loadModels,
    summarize,
    cancelActiveRequest,
    reset,
  };
}