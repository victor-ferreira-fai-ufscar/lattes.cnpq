"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Markdown from "react-markdown";
import {
  getApiErrorMessage,
  scrapeCurriculo,
  summarizeCurriculo,
  type ScrapeResponse,
  type SummarizeResponse,
} from "@/lib/api";

type LogSource = "frontend" | "backend";

type LogEntry = {
  id: number;
  source: LogSource;
  message: string;
};

const SCRAPE_LOADING_MESSAGES = [
  "Conectando ao backend...",
  "Acessando busca do Lattes...",
  "Localizando currículo...",
  "Gerando PDF e enviando para storage...",
];

const SUMMARY_LOADING_MESSAGES = [
  "Coletando texto do currículo...",
  "Enviando conteúdo para a OpenAI...",
  "Gerando resumo com ChatGPT...",
  "Finalizando resposta...",
];

export default function Home() {
  const [nome, setNome] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ScrapeResponse | null>(null);

  const [apiKey, setApiKey] = useState("");
  const [modelo, setModelo] = useState("gpt-4o-mini");
  const [summarizing, setSummarizing] = useState(false);
  const [summaryError, setSummaryError] = useState("");
  const [summary, setSummary] = useState<SummarizeResponse | null>(null);

  const [showLogs, setShowLogs] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);

  const activeMode = summarizing ? "summarize" : loading ? "scrape" : null;

  const activeLoadingMessage = useMemo(() => {
    if (activeMode === "scrape") {
      return SCRAPE_LOADING_MESSAGES[
        loadingMessageIndex % SCRAPE_LOADING_MESSAGES.length
      ];
    }
    if (activeMode === "summarize") {
      return SUMMARY_LOADING_MESSAGES[
        loadingMessageIndex % SUMMARY_LOADING_MESSAGES.length
      ];
    }
    return "";
  }, [activeMode, loadingMessageIndex]);

  const addLog = (source: LogSource, message: string) => {
    const timestamp = new Date().toLocaleTimeString("pt-BR");
    const entry: LogEntry = {
      id: Date.now() + Math.random(),
      source,
      message: `[${timestamp}] ${message}`,
    };
    setLogs((prev) => [...prev, entry]);
  };

  useEffect(() => {
    if (!activeMode) {
      setElapsedSeconds(0);
      setLoadingMessageIndex(0);
      return;
    }

    const elapsedTimer = window.setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    const messageTimer = window.setInterval(() => {
      setLoadingMessageIndex((prev) => prev + 1);
    }, 2500);

    return () => {
      window.clearInterval(elapsedTimer);
      window.clearInterval(messageTimer);
    };
  }, [activeMode]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nomeLimpo = nome.trim();
    if (!nomeLimpo) {
      setError("Informe o nome do docente.");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);
    setSummary(null);
    setSummaryError("");
    addLog("frontend", `Iniciando requisição /scrape para '${nomeLimpo}'.`);

    try {
      const response = await scrapeCurriculo(nomeLimpo);
      setResult(response);
      addLog(
        "frontend",
        `Resposta /scrape recebida em ${response.duracao_segundos ?? "?"}s.`,
      );
      response.logs?.forEach((message) => addLog("backend", message));
    } catch (err) {
      setError(getApiErrorMessage(err));
      addLog("frontend", `Erro em /scrape: ${getApiErrorMessage(err)}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleSummarize() {
    if (!result) return;

    setSummarizing(true);
    setSummaryError("");
    setSummary(null);
    addLog("frontend", `Iniciando requisição /summarize para '${result.nome}'.`);

    try {
      const response = await summarizeCurriculo(
        result.nome,
        apiKey || undefined,
        modelo,
      );
      setSummary(response);
      addLog(
        "frontend",
        `Resposta /summarize recebida em ${response.duracao_segundos ?? "?"}s.`,
      );
      response.logs?.forEach((message) => addLog("backend", message));
    } catch (err) {
      setSummaryError(getApiErrorMessage(err));
      addLog("frontend", `Erro em /summarize: ${getApiErrorMessage(err)}`);
    } finally {
      setSummarizing(false);
    }
  }

  return (
    <main className="page">
      <section className="card">
        <h1>Lattes CNPq</h1>
        <p>Digite o nome do docente para executar o scraping no backend.</p>

        <form onSubmit={handleSubmit} className="form">
          <label htmlFor="nome">Nome</label>
          <input
            id="nome"
            type="text"
            value={nome}
            onChange={(event) => setNome(event.target.value)}
            placeholder="Ex: Neocles Alves Pereira"
            autoComplete="off"
            required
          />

          <button type="submit" disabled={loading}>
            {loading ? "Processando..." : "Buscar currículo"}
          </button>
        </form>

        {activeMode ? (
          <div className="loading-box">
            <div className="loading-header">
              <span className="loading-spinner" aria-hidden="true" />
              <strong>
                {activeMode === "scrape"
                  ? "Executando scraping"
                  : "Gerando resumo com ChatGPT"}
              </strong>
            </div>
            <p>{activeLoadingMessage}</p>
            <small>Tempo decorrido: {elapsedSeconds}s</small>
          </div>
        ) : null}

        <div className="logs-toggle-row">
          <button
            type="button"
            className="btn-logs"
            onClick={() => setShowLogs((prev) => !prev)}
          >
            {showLogs ? "Ocultar logs" : "Mostrar logs"}
          </button>
          <button
            type="button"
            className="btn-logs-clear"
            onClick={() => setLogs([])}
            disabled={logs.length === 0}
          >
            Limpar
          </button>
        </div>

        {showLogs ? (
          <div className="logs-panel">
            <h3>Logs das requisições</h3>
            {logs.length === 0 ? (
              <p>Nenhum log registrado.</p>
            ) : (
              <div className="logs-list">
                {logs.map((entry) => (
                  <p key={entry.id} className={`log-item ${entry.source}`}>
                    <strong>{entry.source === "backend" ? "Backend" : "Frontend"}</strong>{" "}
                    {entry.message}
                  </p>
                ))}
              </div>
            )}
          </div>
        ) : null}

        {error ? <div className="message error">{error}</div> : null}

        {result ? (
          <div className="result">
            <h2>Resultado</h2>
            <p>
              <strong>Nome:</strong> {result.nome}
            </p>
            <p>
              <strong>Última atualização:</strong>{" "}
              {new Date(result.ultima_atualizacao_curriculo).toLocaleDateString(
                "pt-BR",
              )}
            </p>
            <p>
              <strong>Arquivo:</strong> {result.arquivo_pdf}
            </p>
            <p>
              <a href={result.download_pdf_url} target="_blank" rel="noreferrer">
                Baixar PDF
              </a>
            </p>

            <div className="summarize-form">
              <h3>Resumir com ChatGPT</h3>

              <div className="summarize-fields">
                <div>
                  <label htmlFor="openai-key">API Key OpenAI</label>
                  <input
                    id="openai-key"
                    type="password"
                    value={apiKey}
                    onChange={(event) => setApiKey(event.target.value)}
                    placeholder="sk-... (opcional se configurada no backend)"
                    autoComplete="off"
                  />
                </div>
                <div>
                  <label htmlFor="modelo">Modelo</label>
                  <select
                    id="modelo"
                    value={modelo}
                    onChange={(event) => setModelo(event.target.value)}
                  >
                    <option value="gpt-4o-mini">gpt-4o-mini</option>
                    <option value="gpt-4o">gpt-4o</option>
                    <option value="gpt-4.1">gpt-4.1</option>
                    <option value="gpt-4.1-mini">gpt-4.1-mini</option>
                    <option value="gpt-4.1-nano">gpt-4.1-nano</option>
                  </select>
                </div>
              </div>

              <button
                type="button"
                onClick={handleSummarize}
                disabled={summarizing}
                className="btn-summarize"
              >
                {summarizing ? "Resumindo..." : "Resumir com ChatGPT"}
              </button>
            </div>

            {summaryError ? (
              <div className="message error">{summaryError}</div>
            ) : null}
          </div>
        ) : null}

        {summary ? (
          <div className="result summary">
            <h2>Resumo — {summary.nome}</h2>
            <div className="markdown">
              <Markdown>{summary.resumo}</Markdown>
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}
