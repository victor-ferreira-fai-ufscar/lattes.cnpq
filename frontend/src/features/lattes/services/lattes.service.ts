import { http, runMonitoredRequest } from "@/lib/http";
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
  logs?: string[];
  duracao_segundos?: number;
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
  logs?: string[];
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
  onLog?: (line: string) => void;
};

export async function buscarCandidatos(
  nome: string,
  limit = 20,
  options?: RequestOptions,
): Promise<SearchResponse> {
  return runMonitoredRequest({
    signal: options?.signal,
    onLog: options?.onLog,
    execute: async (requestId) => {
      const response = await http.post<SearchResponse>(
        "/search",
        { nome, limit },
        {
          signal: options?.signal,
          headers: buildRequestIdHeaders(requestId),
        },
      );
      return response.data;
    },
  });
}

export async function scrapeCurriculoSelecionado(
  nome: string,
  href: string,
  outputFormat: OutputFormat,
  options?: RequestOptions,
): Promise<ScrapeResponse> {
  return runMonitoredRequest({
    signal: options?.signal,
    onLog: options?.onLog,
    execute: async (requestId) => {
      const response = await http.post<ScrapeResponse>(
        "/scrape",
        {
          nome,
          href,
          output_format: outputFormat,
        },
        {
          signal: options?.signal,
          headers: buildRequestIdHeaders(requestId),
        },
      );
      return response.data;
    },
  });
}

export async function summarizeCurriculo(
  nome: string,
  provedor: AIProvider,
  modelo: string,
  apiKey?: string,
  options?: RequestOptions,
): Promise<SummarizeResponse> {
  return runMonitoredRequest({
    signal: options?.signal,
    onLog: options?.onLog,
    execute: async (requestId) => {
      const response = await http.post<SummarizeResponse>(
        "/summarize",
        {
          nome,
          provedor,
          modelo,
          api_key: apiKey || undefined,
        },
        {
          signal: options?.signal,
          headers: buildRequestIdHeaders(requestId),
        },
      );
      return response.data;
    },
  });
}

export async function listarModelosPorProvedor(
  provedor: AIProvider,
  apiKey?: string,
  options?: RequestOptions,
): Promise<ModelsResponse> {
  return runMonitoredRequest({
    signal: options?.signal,
    onLog: options?.onLog,
    execute: async (requestId) => {
      const response = await http.post<ModelsResponse>(
        "/models",
        {
          provedor,
          api_key: apiKey || undefined,
        },
        {
          signal: options?.signal,
          headers: buildRequestIdHeaders(requestId),
        },
      );
      return response.data;
    },
  });
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

  return runMonitoredRequest({
    signal: requestOptions?.signal,
    onLog: callbacks?.onLog,
    execute: async (requestId) => {
      const response = await http.post<BatchScrapeResponse>(
        "/scrape/batch",
        buildBatchFormData(normalizedFile, options),
        {
          timeout: dynamicTimeout,
          signal: requestOptions?.signal,
          headers: buildRequestIdHeaders(requestId),
        },
      );

      return response.data;
    },
  });
}

function buildRequestIdHeaders(requestId: string | null) {
  return requestId ? { "X-Request-ID": requestId } : undefined;
}