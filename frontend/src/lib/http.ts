import axios from "axios";

type ApiErrorPayload = {
  detail?: unknown;
  [key: string]: unknown;
};

export const http = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000",
  timeout: 120000,
});

export class RequestCancelledError extends Error {
  constructor(message = "Solicitação cancelada.") {
    super(message);
    this.name = "RequestCancelledError";
  }
}

export function isRequestCancelledError(error: unknown): boolean {
  if (axios.isCancel(error)) {
    return true;
  }

  if (error instanceof RequestCancelledError) {
    return true;
  }

  if (error instanceof DOMException && error.name === "AbortError") {
    return true;
  }

  if (error instanceof Error) {
    return (
      error.name === "AbortError" ||
      error.name === "CanceledError" ||
      ("code" in error && error.code === "ERR_CANCELED")
    );
  }

  return false;
}

export function getApiErrorMessage(error: unknown): string {
  if (isRequestCancelledError(error)) {
    return "Solicitação cancelada pelo usuário.";
  }

  if (axios.isAxiosError(error)) {
    const data = error.response?.data as ApiErrorPayload | undefined;
    const detail = data?.detail;

    if (typeof detail === "string") {
      const normalizedDetail = detail.toLowerCase();
      if (
        normalizedDetail.includes("nenhum resultado encontrado") ||
        normalizedDetail.includes("nome informado")
      ) {
        return "Não encontramos esse nome no Lattes. Confira a grafia, tente uma variação do nome ou use a busca individual para escolher a pessoa correta.";
      }

      if (
        normalizedDetail.includes("erro ao chamar a ia") ||
        normalizedDetail.includes("api key") ||
        normalizedDetail.includes("authentication")
      ) {
        return "Não foi possível gerar o resumo com IA. Revise a chave de acesso e tente novamente.";
      }

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

      return "Os dados enviados estão incompletos ou inválidos. Revise os campos e tente novamente.";
    }

    if (error.response?.status) {
      const status = error.response.status;

      if (status >= 500) {
        return "O serviço encontrou um problema ao processar sua solicitação. Tente novamente em instantes.";
      }

      if (status === 404) {
        return "Não encontramos o recurso solicitado. Tente executar a ação novamente.";
      }

      if (status === 400) {
        return "A solicitação não pôde ser concluída. Revise os dados informados e tente novamente.";
      }

      return `A solicitação não pôde ser concluída (erro ${status}).`;
    }

    if (error.code === "ECONNABORTED") {
      const url = error.config?.url ?? "";
      if (url.includes("batch")) {
        return "O processamento da lista demorou mais do que o esperado. Se quiser, tente novamente com menos nomes por vez.";
      }
      return "A resposta demorou mais do que o esperado. Tente novamente em instantes.";
    }

    if (error.request) {
      return "Não foi possível se conectar ao serviço da aplicação. Verifique se o backend está em execução e tente novamente.";
    }

    if (error.message) {
      return `Não foi possível concluir a solicitação: ${error.message}`;
    }

    return "Ocorreu uma falha inesperada ao chamar o serviço da aplicação.";
  }

  return error instanceof Error ? error.message : "Ocorreu um erro inesperado.";
}