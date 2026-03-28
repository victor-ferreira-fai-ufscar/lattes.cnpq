import { http } from "@/lib/http";

export type AIProvider = "openai" | "gemini" | "ollama";

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
  ultima_atualizacao_curriculo: string;
  arquivo_pdf: string;
  storage_path: string;
  download_pdf_url: string;
  logs?: string[];
  duracao_segundos?: number;
};

export type SummarizeResponse = {
  nome: string;
  resumo: string;
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

export async function buscarCandidatos(
  nome: string,
  limit = 20,
): Promise<SearchResponse> {
  const response = await http.post<SearchResponse>("/search", { nome, limit });
  return response.data;
}

export async function scrapeCurriculoSelecionado(
  nome: string,
  href: string,
): Promise<ScrapeResponse> {
  const response = await http.post<ScrapeResponse>("/scrape", { nome, href });
  return response.data;
}

export async function summarizeCurriculo(
  nome: string,
  provedor: AIProvider,
  modelo: string,
  apiKey?: string,
): Promise<SummarizeResponse> {
  const response = await http.post<SummarizeResponse>("/summarize", {
    nome,
    provedor,
    modelo,
    api_key: apiKey || undefined,
  });
  return response.data;
}

export async function listarModelosPorProvedor(
  provedor: AIProvider,
  apiKey?: string,
): Promise<ModelsResponse> {
  const response = await http.post<ModelsResponse>("/models", {
    provedor,
    api_key: apiKey || undefined,
  });
  return response.data;
}

export async function scrapeCurriculosLote(
  file: File,
  options?: { skip?: number; limit?: number },
): Promise<BatchScrapeResponse> {
  const raw = await file.arrayBuffer();
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

  const response = await http.post<BatchScrapeResponse>(
    "/scrape/batch",
    formData,
  );

  return response.data;
}