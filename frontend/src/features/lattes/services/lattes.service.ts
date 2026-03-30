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
  erro_detalhe?: string;
  erro_tipo?: string;
  erro_timeout_ms?: number | null;
  erro_locator?: string | null;
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

type BatchOptions = {
  skip?: number;
  limit?: number;
};

type BatchStreamCallbacks = {
  onLog?: (line: string) => void;
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

// Tempo estimado por item (segundos) + margem de segurança
const BATCH_SECONDS_PER_ITEM = 30;
const BATCH_TIMEOUT_MIN_MS = 120_000;

function buildBatchFormData(file: File, options?: BatchOptions): FormData {
  const formData = new FormData();
  formData.append("arquivo", file, file.name);
  formData.append("skip", String(options?.skip ?? 0));

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
): Promise<BatchScrapeResponse> {
  const baseURL = http.defaults.baseURL || "http://localhost:8000";
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${baseURL}/scrape/batch/stream`, {
      method: "POST",
      body: buildBatchFormData(file, options),
      signal: controller.signal,
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
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(
        "O processamento em lote demorou além do tempo máximo configurado.",
      );
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function scrapeCurriculosLote(
  file: File,
  options?: BatchOptions,
  totalNamesInCsv?: number,
  callbacks?: BatchStreamCallbacks,
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
    );
  }

  const response = await http.post<BatchScrapeResponse>(
    "/scrape/batch",
    buildBatchFormData(normalizedFile, options),
    { timeout: dynamicTimeout },
  );

  return response.data;
}