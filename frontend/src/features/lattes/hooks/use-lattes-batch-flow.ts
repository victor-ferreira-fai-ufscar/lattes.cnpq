"use client";

import { useMutation } from "@tanstack/react-query";

import {
  scrapeCurriculosLote,
  type BatchScrapeResponse,
} from "@/features/lattes/services/lattes.service";
import { useLattesWorkbenchStore } from "@/features/lattes/stores/lattes-workbench-store";

type BatchPayload = {
  file: File;
  skip: number;
  limit?: number;
  totalNamesInCsv: number;
};

type BatchFlowFeedback = {
  notifyError: (error: unknown) => void;
  notifySuccess: (message: string) => void;
};

export function useLattesBatchFlow({
  notifyError,
  notifySuccess,
}: BatchFlowFeedback) {
  const liveBatchLogs = useLattesWorkbenchStore((state) => state.liveBatchLogs);
  const batchResult = useLattesWorkbenchStore((state) => state.batchResult);
  const setLiveBatchLogs = useLattesWorkbenchStore(
    (state) => state.setLiveBatchLogs,
  );
  const appendLiveBatchLog = useLattesWorkbenchStore(
    (state) => state.appendLiveBatchLog,
  );
  const setBatchResult = useLattesWorkbenchStore((state) => state.setBatchResult);

  const batchMutation = useMutation<BatchScrapeResponse, unknown, BatchPayload>({
    mutationFn: ({ file, skip, limit, totalNamesInCsv }) =>
      scrapeCurriculosLote(
        file,
        { skip, limit },
        totalNamesInCsv,
        {
          onLog: (line) => {
            appendLiveBatchLog(line);
          },
        },
      ),
    onSuccess: (response) => {
      setBatchResult(response);
      if (liveBatchLogs.length === 0) {
        setLiveBatchLogs(response.logs ?? []);
      }
      notifySuccess(
        `Processamento concluido para ${response.total_processados} pessoa(s).`,
      );
    },
    onError: (error) => {
      notifyError(error);
    },
  });

  const submitBatch = async (file: File, skip: number, limit?: number) => {
    batchMutation.reset();
    setBatchResult(null);
    setLiveBatchLogs([]);

    const text = await file.text();
    const totalNamesInCsv = text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean).length;

    await batchMutation.mutateAsync({
      file,
      skip,
      limit,
      totalNamesInCsv,
    });
  };

  const reset = () => {
    batchMutation.reset();
    setBatchResult(null);
    setLiveBatchLogs([]);
  };

  return {
    batchResult,
    liveBatchLogs,
    isSubmitting: batchMutation.isPending,
    submitBatch,
    reset,
  };
}