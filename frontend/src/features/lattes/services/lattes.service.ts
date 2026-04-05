import { http, RequestCancelledError } from "@/lib/http";
import type { OutputFormat } from "@/features/lattes/lib/output-format";

export type AIProvider = "openai" | "gemini" | "ollama";
export type { OutputFormat } from "@/features/lattes/lib/output-format";

export type GeneratedFile = {
  format: string;
  filename: string;
  relative_path: string;
  download_url: string;
  content_type: string;
};

export type SearchCandidate = {
  nome: string;
  href: string;
};

export type SearchResponse = {
  nome_busca: string;
  total: number;
  candidatos: SearchCandidate[];
};

export type ScrapeResponse = {
  nome: string;
  cache_status?: "hit" | "miss";
  artifacts_cache_status?: "hit" | "miss";
  cache_last_modified?: string;
  cache_lookup_error?: string | null;
  ultima_atualizacao_curriculo: string;
  arquivo_pdf: string;
  storage_path: string;
  download_pdf_url: string;
  output_format: OutputFormat;
  output_directory: string;
  output_label?: string;
  generated_files: GeneratedFile[];
  extracted_text_length?: number;
  template_name?: string | null;
  zip_arquivo?: string | null;
  zip_storage_path?: string | null;
  zip_download_url?: string | null;
  logs?: string[];
  duracao_segundos?: number;
};

export type SummarizeResponse = {
  nome: string;
  resumo: string;
  fonte_resumo?: "pdf" | "html";
  logs?: string[];
  duracao_segundos?: number;
};

export type ModelsResponse = {
  provedor: AIProvider;
  total: number;
  modelos: string[];
  duracao_segundos?: number;
};

export type BatchItemSuccess = {
  nome: string;
  status: "sucesso";
  cache_status?: "hit" | "miss";
  artifacts_cache_status?: "hit" | "miss";
  cache_last_modified?: string;
  ultima_atualizacao_curriculo: string;
  arquivo_pdf: string;
  storage_path: string;
  download_pdf_url: string;
  output_format: OutputFormat;
  output_directory: string;
  output_label?: string;
  generated_files: GeneratedFile[];
  extracted_text_length?: number;
  template_name?: string | null;
  duracao_segundos: number;
};

export type BatchItemError = {
  nome: string;
  status: "erro";
  erro: string;
  erro_detalhe?: string;
  erro_tipo?: string;
  erro_timeout_ms?: number | null;
  erro_locator?: string | null;
  duracao_segundos: number;
};

export type BatchScrapeResponse = {
  arquivo: string;
  output_format: OutputFormat;
  output_directory: string;
  output_label?: string;
  total_nomes_csv: number;
  total_processados: number;
  sucesso: number;
  erro: number;
  cache_hits?: number;
  cache_misses?: number;
  cache_lookup_errors?: number;
  resultados: Array<BatchItemSuccess | BatchItemError>;
  zip_arquivo?: string | null;
  zip_storage_path?: string | null;
  zip_download_url?: string | null;
  zip_erro?: string | null;
  logs?: string[];
  duracao_segundos?: number;
};

type BatchOptions = {
  skip?: number;
  limit?: number;
  outputFormat?: OutputFormat;
};

type BatchStreamCallbacks = {
  onLog?: (line: string) => void;
};

type RequestOptions = {
  signal?: AbortSignal;
};

export async function buscarCandidatos(
  nome: string,
  limit = 20,
  options?: RequestOptions,
): Promise<SearchResponse> {
  const response = await http.post<SearchResponse>(
    "/search",
    { nome, limit },
    { signal: options?.signal },
  );
  return response.data;
}

export async function scrapeCurriculoSelecionado(
  nome: string,
  href: string,
  outputFormat: OutputFormat,
  options?: RequestOptions,
): Promise<ScrapeResponse> {
  const response = await http.post<ScrapeResponse>(
    "/scrape",
    {
      nome,
      href,
      output_format: outputFormat,
    },
    { signal: options?.signal },
  );
  return response.data;
}

export async function summarizeCurriculo(
  nome: string,
  provedor: AIProvider,
  modelo: string,
  apiKey?: string,
  options?: RequestOptions,
): Promise<SummarizeResponse> {
  const response = await http.post<SummarizeResponse>(
    "/summarize",
    {
      nome,
      provedor,
      modelo,
      api_key: apiKey || undefined,
    },
    { signal: options?.signal },
  );
  return response.data;
}

export async function listarModelosPorProvedor(
  provedor: AIProvider,
  apiKey?: string,
  options?: RequestOptions,
): Promise<ModelsResponse> {
  const response = await http.post<ModelsResponse>(
    "/models",
    {
      provedor,
      api_key: apiKey || undefined,
    },
    { signal: options?.signal },
  );
  return response.data;
}

// Tempo estimado por item (segundos) + margem de segurança
const BATCH_SECONDS_PER_ITEM = 30;
const BATCH_TIMEOUT_MIN_MS = 120_000;

function buildBatchFormData(file: File, options?: BatchOptions): FormData {
  const formData = new FormData();
  formData.append("arquivo", file, file.name);
  formData.append("skip", String(options?.skip ?? 0));
  formData.append("output_format", options?.outputFormat ?? "docx");

  if (options?.limit && options.limit > 0) {
    formData.append("limit", String(options.limit));
  }

  return formData;
}

async function scrapeCurriculosLoteStream(
  file: File,
  options: BatchOptions | undefined,
  timeoutMs: number,
  callbacks: BatchStreamCallbacks,
  signal?: AbortSignal,
): Promise<BatchScrapeResponse> {
  const baseURL = http.defaults.baseURL || "http://localhost:8000";
  const timeoutController = new AbortController();
  const requestController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs);

  const abortRequest = () => {
    if (!requestController.signal.aborted) {
      requestController.abort();
    }
  };

  timeoutController.signal.addEventListener("abort", abortRequest);
  signal?.addEventListener("abort", abortRequest);

  try {
    const response = await fetch(`${baseURL}/scrape/batch/stream`, {
      method: "POST",
      body: buildBatchFormData(file, options),
      signal: requestController.signal,
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(
        detail || `Falha ao iniciar stream do lote (HTTP ${response.status}).`,
      );
    }

    if (!response.body) {
      throw new Error("Stream de lote indisponível no navegador atual.");
    }

    const decoder = new TextDecoder();
    const reader = response.body.getReader();
    let buffer = "";
    let finalResult: BatchScrapeResponse | null = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const chunks = buffer.split("\n\n");
      buffer = chunks.pop() ?? "";

      for (const rawChunk of chunks) {
        if (!rawChunk.trim()) {
          continue;
        }

        let eventName = "message";
        const dataLines: string[] = [];

        for (const line of rawChunk.split("\n")) {
          if (line.startsWith("event:")) {
            eventName = line.slice("event:".length).trim();
          }
          if (line.startsWith("data:")) {
            dataLines.push(line.slice("data:".length).trim());
          }
        }

        const rawData = dataLines.join("\n");
        const payload = rawData ? (JSON.parse(rawData) as Record<string, unknown>) : {};

        if (eventName === "log" && typeof payload.message === "string") {
          callbacks.onLog?.(payload.message);
        }

        if (eventName === "error") {
          const detail =
            typeof payload.detail === "string"
              ? payload.detail
              : "Falha ao processar lote em tempo real.";
          throw new Error(detail);
        }

        if (eventName === "result") {
          finalResult = payload as BatchScrapeResponse;
        }
      }
    }

    if (!finalResult) {
      throw new Error("A API encerrou o stream sem retornar resultado final.");
    }

    return finalResult;
  } catch (error) {
    if (signal?.aborted) {
      throw new RequestCancelledError();
    }

    if (timeoutController.signal.aborted) {
      throw new Error(
        "O processamento em lote demorou além do tempo máximo configurado.",
      );
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
    timeoutController.signal.removeEventListener("abort", abortRequest);
    signal?.removeEventListener("abort", abortRequest);
  }
}

export async function scrapeCurriculosLote(
  file: File,
  options?: BatchOptions,
  totalNamesInCsv?: number,
  callbacks?: BatchStreamCallbacks,
  requestOptions?: RequestOptions,
): Promise<BatchScrapeResponse> {
  const raw = await file.arrayBuffer();
  const normalizedFile = new File([raw], file.name, {
    type: file.type || "text/csv",
    lastModified: file.lastModified,
  });

  // Calcula timeout dinamicamente: 30s por item processado, mínimo 2 minutos
  const itemCount =
    options?.limit && options.limit > 0
      ? options.limit
      : (totalNamesInCsv ?? 50);
  const dynamicTimeout = Math.max(
    BATCH_TIMEOUT_MIN_MS,
    itemCount * BATCH_SECONDS_PER_ITEM * 1000,
  );

  if (callbacks?.onLog) {
    return scrapeCurriculosLoteStream(
      normalizedFile,
      options,
      dynamicTimeout,
      callbacks,
      requestOptions?.signal,
    );
  }

  const response = await http.post<BatchScrapeResponse>(
    "/scrape/batch",
    buildBatchFormData(normalizedFile, options),
    { timeout: dynamicTimeout, signal: requestOptions?.signal },
  );

  return response.data;
}