"use client";

import { useMutation } from "@tanstack/react-query";
import { useState } from "react";

import {
  scrapeCurriculosLote,
  type BatchScrapeResponse,
} from "@/features/lattes/services/lattes.service";

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
  const [liveBatchLogs, setLiveBatchLogs] = useState<string[]>([]);

  const batchMutation = useMutation<BatchScrapeResponse, unknown, BatchPayload>({
    mutationFn: ({ file, skip, limit, totalNamesInCsv }) =>
      scrapeCurriculosLote(
        file,
        { skip, limit },
        totalNamesInCsv,
        {
          onLog: (line) => {
            setLiveBatchLogs((current) => [...current, line]);
          },
        },
      ),
    onSuccess: (response) => {
      setLiveBatchLogs((current) =>
        current.length > 0 ? current : (response.logs ?? []),
      );
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
    setLiveBatchLogs([]);
    batchMutation.reset();
  };

  return {
    batchResult: batchMutation.data ?? null,
    liveBatchLogs,
    isSubmitting: batchMutation.isPending,
    submitBatch,
    reset,
  };
}