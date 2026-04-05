"use client";

import { useMutation } from "@tanstack/react-query";
import { useRef } from "react";

import type { OutputFormat } from "@/features/lattes/lib/output-format";
import {
  scrapeCurriculosLote,
  type BatchScrapeResponse,
} from "@/features/lattes/services/lattes.service";
import { isRequestCancelledError } from "@/lib/http";
import { useLattesWorkbenchStore } from "@/features/lattes/stores/lattes-workbench-store";

type BatchPayload = {
  file: File;
  skip: number;
  limit?: number;
  totalNamesInCsv: number;
  outputFormat: OutputFormat;
};

type BatchFlowFeedback = {
  notifyError: (error: unknown) => void;
  notifySuccess: (message: string) => void;
};

export function useLattesBatchFlow({
  notifyError,
  notifySuccess,
}: BatchFlowFeedback) {
  const batchAbortRef = useRef<AbortController | null>(null);
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
    mutationFn: async ({ file, skip, limit, totalNamesInCsv, outputFormat }) => {
      const controller = new AbortController();
      batchAbortRef.current = controller;

      try {
        return await scrapeCurriculosLote(
          file,
          { skip, limit, outputFormat },
          totalNamesInCsv,
          {
            onLog: (line) => {
              appendLiveBatchLog(line);
            },
          },
          { signal: controller.signal },
        );
      } finally {
        if (batchAbortRef.current === controller) {
          batchAbortRef.current = null;
        }
      }
    },
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
      if (!isRequestCancelledError(error)) {
        notifyError(error);
      }
    },
  });

  const submitBatch = async (
    file: File,
    skip: number,
    limit: number | undefined,
    outputFormat: OutputFormat,
  ) => {
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
      outputFormat,
    });
  };

  const reset = () => {
    batchMutation.reset();
    setBatchResult(null);
    setLiveBatchLogs([]);
  };

  const cancelActiveRequest = () => {
    batchAbortRef.current?.abort();
  };

  return {
    batchResult,
    liveBatchLogs,
    isSubmitting: batchMutation.isPending,
    submitBatch,
    cancelActiveRequest,
    reset,
  };
}