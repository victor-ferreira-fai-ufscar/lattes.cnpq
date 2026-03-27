import axios from "axios";

export type ScrapeResponse = {
  nome: string;
  ultima_atualizacao_curriculo: string;
  arquivo_pdf: string;
  storage_path: string;
  download_pdf_url: string;
  logs?: string[];
  duracao_segundos?: number;
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

type ApiErrorPayload = {
  detail?: unknown;
  // FastAPI pode retornar lista de erros de validação
  [key: string]: unknown;
};

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000",
  timeout: 120000,
});

export type SummarizeResponse = {
  nome: string;
  resumo: string;
  logs?: string[];
  duracao_segundos?: number;
};

export type BatchItemSuccess = {
  nome: string;
  status: "sucesso";
  ultima_atualizacao_curriculo: string;
  arquivo_pdf: string;
  storage_path: string;
  download_pdf_url: string;
  duracao_segundos: number;
};

export type BatchItemError = {
  nome: string;
  status: "erro";
  erro: string;
  duracao_segundos: number;
};

export type BatchScrapeResponse = {
  arquivo: string;
  total_nomes_csv: number;
  total_processados: number;
  sucesso: number;
  erro: number;
  resultados: Array<BatchItemSuccess | BatchItemError>;
  zip_arquivo?: string | null;
  zip_storage_path?: string | null;
  zip_download_url?: string | null;
  zip_erro?: string | null;
  logs?: string[];
  duracao_segundos?: number;
};

export async function scrapeCurriculo(nome: string): Promise<ScrapeResponse> {
  const response = await api.post<ScrapeResponse>("/scrape", { nome });
  return response.data;
}

export async function buscarCandidatos(
  nome: string,
  limit = 20,
): Promise<SearchResponse> {
  const response = await api.post<SearchResponse>("/search", { nome, limit });
  return response.data;
}

export async function scrapeCurriculoSelecionado(
  nome: string,
  href: string,
): Promise<ScrapeResponse> {
  const response = await api.post<ScrapeResponse>("/scrape", { nome, href });
  return response.data;
}

export async function summarizeCurriculo(
  nome: string,
  apiKey?: string,
  modelo?: string,
): Promise<SummarizeResponse> {
  const response = await api.post<SummarizeResponse>("/summarize", {
    nome,
    api_key: apiKey || undefined,
    modelo: modelo || "gpt-4o-mini",
  });
  return response.data;
}

export async function scrapeCurriculosLote(
  file: File,
  options?: { skip?: number; limit?: number },
): Promise<BatchScrapeResponse> {
  if (!(file instanceof File)) {
    throw new Error("Arquivo de lote invalido: selecione um CSV valido.");
  }
  if (!file.name.toLowerCase().endsWith(".csv")) {
    throw new Error("Arquivo invalido: envie um arquivo .csv.");
  }
  if (file.size <= 0) {
    throw new Error(
      "Arquivo CSV vazio no frontend. Verifique o arquivo selecionado.",
    );
  }

  const raw = await file.arrayBuffer();
  if (raw.byteLength <= 0) {
    throw new Error("Arquivo CSV sem conteudo legivel no frontend.");
  }

  const normalizedFile = new File([raw], file.name, {
    type: file.type || "text/csv",
    lastModified: file.lastModified,
  });

  const formData = new FormData();
  formData.append("arquivo", normalizedFile, normalizedFile.name);
  formData.append("skip", String(options?.skip ?? 0));
  if (options?.limit && options.limit > 0) {
    formData.append("limit", String(options.limit));
  }

  const response = await api.post<BatchScrapeResponse>(
    "/scrape/batch",
    formData,
  );
  return response.data;
}

export function getApiErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as ApiErrorPayload | undefined;
    const detail = data?.detail;

    if (typeof detail === "string") {
      return detail;
    }

    if (Array.isArray(detail) && detail.length > 0) {
      const first = detail[0] as {
        msg?: string;
        loc?: Array<string | number>;
      };
      if (first?.msg) {
        const where = first.loc?.join(" > ");
        return where ? `${first.msg} (${where})` : first.msg;
      }
      return "Dados inválidos enviados para a API.";
    }

    if (error.response?.status) {
      const status = error.response.status;
      const statusText = error.response.statusText;
      const fallback = statusText
        ? `Erro na API (${status} - ${statusText})`
        : `Erro na API (${status})`;
      return fallback;
    }

    if (error.code === "ECONNABORTED") {
      return `Tempo limite excedido ao conectar com ${api.defaults.baseURL}. Verifique se o backend esta rodando e respondeu a tempo.`;
    }

    if (error.request) {
      return `Nao foi possivel conectar ao backend em ${api.defaults.baseURL}. Verifique se o servidor FastAPI esta ativo, a porta esta correta e o CORS permite a origem do frontend.`;
    }

    if (error.message) {
      return `Falha ao montar request para API: ${error.message}`;
    }

    return "Falha inesperada ao chamar o backend.";
  }

  return error instanceof Error ? error.message : "Erro inesperado.";
}
