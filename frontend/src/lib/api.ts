import axios, { AxiosError } from "axios";

export type ScrapeResponse = {
  nome: string;
  ultima_atualizacao_curriculo: string;
  arquivo_pdf: string;
  storage_path: string;
  download_pdf_url: string;
};

type ApiErrorPayload = {
  detail?: string;
};

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000",
  timeout: 120000,
});

export async function scrapeCurriculo(nome: string): Promise<ScrapeResponse> {
  const response = await api.post<ScrapeResponse>("/scrape", { nome });
  return response.data;
}

export function getApiErrorMessage(error: unknown): string {
  if (error instanceof AxiosError) {
    const data = error.response?.data as ApiErrorPayload | undefined;
    if (data?.detail) {
      return data.detail;
    }

    if (error.response?.status) {
      return `Erro na API (${error.response.status})`;
    }

    return "Não foi possível conectar ao backend.";
  }

  return error instanceof Error ? error.message : "Erro inesperado.";
}
