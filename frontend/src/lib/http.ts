import axios from "axios";

type ApiErrorPayload = {
  detail?: unknown;
  [key: string]: unknown;
};

export const http = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000",
  timeout: 120000,
});

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
      return statusText
        ? `Erro na API (${status} - ${statusText})`
        : `Erro na API (${status})`;
    }

    if (error.code === "ECONNABORTED") {
      const url = error.config?.url ?? "";
      if (url.includes("batch")) {
        return "O processamento em lote demorou mais do esperado. Tente reduzir o número de itens com o campo Limite.";
      }
      return `Tempo limite excedido ao conectar com ${http.defaults.baseURL}.`;
    }

    if (error.request) {
      return `Nao foi possivel conectar ao backend em ${http.defaults.baseURL}. Verifique se o servidor FastAPI esta ativo.`;
    }

    if (error.message) {
      return `Falha ao montar request para API: ${error.message}`;
    }

    return "Falha inesperada ao chamar o backend.";
  }

  return error instanceof Error ? error.message : "Erro inesperado.";
}