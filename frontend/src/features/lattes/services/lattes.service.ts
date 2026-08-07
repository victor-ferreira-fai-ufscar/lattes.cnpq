import { http, runMonitoredRequest } from "@/lib/http";
import type { OutputFormat } from "@/features/lattes/lib/output-format";
import type { SummarySection } from "@/features/lattes/lib/summary-section";

export type AIProvider = "openai" | "gemini" | "ollama";
export type { OutputFormat } from "@/features/lattes/lib/output-format";
export type { SummarySection } from "@/features/lattes/lib/summary-section";

export type GeneratedFile = {
  format: string;
  filename: string;
  relative_path: string;
  download_url: string;
  content_type: string;
};

export type CurriculoHistoricoVersao = {
  arquivo_pdf: string;
  storage_path: string;
  download_pdf_url: string;
  ultima_atualizacao_curriculo: string | null;
  cache_last_modified: string;
};

export type CurriculoHistoricoDiff = {
  has_changes: boolean;
  added_lines: number;
  removed_lines: number;
  diff_preview: string;
};

export type SearchCandidate = {
  nome: string;
  href: string;
};

export type ObraExterna = {
  titulo: string;
  ano: number | null;
  veiculo: string | null;
  doi: string | null;
  url: string | null;
  citacoes: number;
};

export type NoticiaExterna = {
  titulo: string;
  url: string;
  veiculo: string | null;
  data: string | null;
};

/**
 * Dados de fontes externas ao Lattes (OpenAlex + Google News).
 * A API só envia este bloco quando a identificação do docente atinge
 * confiança alta; caso contrário vem `null`.
 */
export type PerfilExterno = {
  nome_busca: string;
  confianca: "alta" | "media" | "baixa";
  score: number;
  openalex_author_id: string | null;
  openalex_url: string | null;
  orcid: string | null;
  afiliacao: string | null;
  total_obras: number;
  total_citacoes: number;
  h_index: number | null;
  criterios: string[];
  fontes: string[];
  obras: ObraExterna[];
  noticias: NoticiaExterna[];
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
  cache_historico_total_versoes?: number;
  cache_historico_primeira_versao?: CurriculoHistoricoVersao | null;
  cache_historico_ultima_versao?: CurriculoHistoricoVersao | null;
  cache_historico_diff?: CurriculoHistoricoDiff | null;
  // Presentes só quando o scrape foi pedido com `gerarResumo`.
  resumo?: string | null;
  resumo_status?: "ok" | "erro";
  resumo_erro?: string;
  resumo_duracao_segundos?: number;
  perfil_externo?: PerfilExterno | null;
  logs?: string[];
  duracao_segundos?: number;
};

export type SummarizeResponse = {
  nome: string;
  resumo: string;
  secao?: string | null;
  secao_label?: string | null;
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
  resumo?: string | null;
  resumo_status?: "ok" | "erro";
  resumo_erro?: string;
  resumo_duracao_segundos?: number;
  perfil_externo?: PerfilExterno | null;
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
  perfis_externos_ok?: number;
  perfis_externos_erros?: number;
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
  gerarResumo?: boolean;
};

type BatchStreamCallbacks = {
  onLog?: (line: string) => void;
};

type RequestOptions = {
  signal?: AbortSignal;
  onLog?: (line: string) => void;
  timeoutMs?: number;
};

const SUMMARY_TIMEOUT_DEFAULT_MS = 120_000;
const SUMMARY_TIMEOUT_OLLAMA_MS = 15 * 60_000;

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
  gerarResumo = false,
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
          gerar_resumo: gerarResumo,
        },
        {
          // Com resumo, a request embute uma chamada ao Ollama e o default de
          // 2 min do cliente não cobre — mesmo orçamento do /summarize.
          timeout: gerarResumo ? SUMMARY_TIMEOUT_OLLAMA_MS : undefined,
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
  secao?: SummarySection,
  options?: RequestOptions,
): Promise<SummarizeResponse> {
  const timeout =
    options?.timeoutMs ??
    (provedor === "ollama" ? SUMMARY_TIMEOUT_OLLAMA_MS : SUMMARY_TIMEOUT_DEFAULT_MS);

  // "completo" é o padrão do backend quando a seção é omitida.
  const secaoPayload = secao && secao !== "completo" ? secao : undefined;

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
          secao: secaoPayload,
        },
        {
          signal: options?.signal,
          timeout,
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

// Tempo estimado por item (segundos) + margem de segurança.
const BATCH_SECONDS_PER_ITEM = 30;
// Resumo por IA (Ollama, sequencial) adiciona ~10-30s por currículo.
const BATCH_SECONDS_PER_ITEM_WITH_RESUMO = 90;
const BATCH_TIMEOUT_MIN_MS = 120_000;

function buildBatchFormData(file: File, options?: BatchOptions): FormData {
  const formData = new FormData();
  formData.append("arquivo", file, file.name);
  formData.append("skip", String(options?.skip ?? 0));
  formData.append("output_format", options?.outputFormat ?? "docx");

  if (options?.limit && options.limit > 0) {
    formData.append("limit", String(options.limit));
  }

  if (options?.gerarResumo) {
    formData.append("gerar_resumo", "true");
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

  // Calcula timeout dinamicamente por item processado, mínimo 2 minutos.
  // Com resumo por IA, o orçamento por item é maior (chamada ao Ollama).
  const itemCount =
    options?.limit && options.limit > 0
      ? options.limit
      : (totalNamesInCsv ?? 50);
  const secondsPerItem = options?.gerarResumo
    ? BATCH_SECONDS_PER_ITEM_WITH_RESUMO
    : BATCH_SECONDS_PER_ITEM;
  const dynamicTimeout = Math.max(
    BATCH_TIMEOUT_MIN_MS,
    itemCount * secondsPerItem * 1000,
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