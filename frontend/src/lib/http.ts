import axios from "axios";

type ApiErrorPayload = {
  detail?: unknown;
  [key: string]: unknown;
};

export const http = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000",
  timeout: 120000,
});

const REQUEST_MONITOR_CONNECT_TIMEOUT_MS = 800;
const REQUEST_MONITOR_DRAIN_TIMEOUT_MS = 400;

type MonitoredRequestOptions = {
  signal?: AbortSignal;
  onLog?: (line: string) => void;
};

export class RequestCancelledError extends Error {
  constructor(message = "Solicitação cancelada.") {
    super(message);
    this.name = "RequestCancelledError";
  }
}

export async function runMonitoredRequest<T>({
  signal,
  onLog,
  execute,
}: MonitoredRequestOptions & {
  execute: (requestId: string | null) => Promise<T>;
}): Promise<T> {
  if (
    !onLog ||
    typeof window === "undefined" ||
    typeof EventSource === "undefined"
  ) {
    return execute(null);
  }

  const requestId = createRequestId();
  const eventSource = new EventSource(buildRequestMonitorUrl(requestId));
  let isOpen = false;
  let isClosed = false;
  let hasTerminalEvent = false;
  let connectTimeoutId: number | null = null;
  let resolveReady: (() => void) | null = null;
  let resolveDrain: (() => void) | null = null;
  const readyPromise = new Promise<void>((resolve) => {
    resolveReady = resolve;
  });
  const drainPromise = new Promise<void>((resolve) => {
    resolveDrain = resolve;
  });

  const finalizeMonitor = () => {
    resolveReady?.();
    resolveDrain?.();
  };

  const closeMonitor = () => {
    if (isClosed) {
      return;
    }

    isClosed = true;
    if (connectTimeoutId !== null) {
      window.clearTimeout(connectTimeoutId);
      connectTimeoutId = null;
    }
    eventSource.close();
    finalizeMonitor();
  };

  const handleAbort = () => {
    closeMonitor();
  };

  eventSource.onopen = () => {
    isOpen = true;
    if (connectTimeoutId !== null) {
      window.clearTimeout(connectTimeoutId);
      connectTimeoutId = null;
    }
    resolveReady?.();
  };

  eventSource.onerror = () => {
    if (!isOpen) {
      closeMonitor();
    }
  };

  eventSource.addEventListener("log", (event) => {
    const payload = parseMonitorPayload(event);
    if (typeof payload.message === "string") {
      onLog(payload.message);
    }
  });

  eventSource.addEventListener("request-error", () => {
    hasTerminalEvent = true;
    finalizeMonitor();
  });

  eventSource.addEventListener("end", () => {
    hasTerminalEvent = true;
    closeMonitor();
  });

  if (signal) {
    if (signal.aborted) {
      closeMonitor();
    } else {
      signal.addEventListener("abort", handleAbort, { once: true });
    }
  }

  connectTimeoutId = window.setTimeout(() => {
    resolveReady?.();
  }, REQUEST_MONITOR_CONNECT_TIMEOUT_MS);

  try {
    await readyPromise;
    return await execute(requestId);
  } finally {
    if (signal) {
      signal.removeEventListener("abort", handleAbort);
    }

    if (!hasTerminalEvent) {
      await Promise.race([
        drainPromise,
        wait(REQUEST_MONITOR_DRAIN_TIMEOUT_MS),
      ]);
    }

    closeMonitor();
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

function buildRequestMonitorUrl(requestId: string) {
  return new URL(
    `/events/requests/${requestId}`,
    ensureTrailingSlash(resolveBaseUrl()),
  ).toString();
}

function createRequestId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `req-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function ensureTrailingSlash(value: string) {
  return value.endsWith("/") ? value : `${value}/`;
}

function parseMonitorPayload(event: Event) {
  if (!(event instanceof MessageEvent) || typeof event.data !== "string") {
    return {} as Record<string, unknown>;
  }

  try {
    return JSON.parse(event.data) as Record<string, unknown>;
  } catch {
    return {} as Record<string, unknown>;
  }
}

function resolveBaseUrl() {
  return http.defaults.baseURL || "http://localhost:8000";
}

function wait(timeoutMs: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, timeoutMs);
  });
}