"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Loader2, Sparkles, Terminal } from "lucide-react";
import Markdown from "react-markdown";
import {
  getApiErrorMessage,
  scrapeCurriculo,
  summarizeCurriculo,
  type ScrapeResponse,
  type SummarizeResponse,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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

  const isBusy = loading || summarizing;

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
    <main className="min-h-screen bg-slate-50 py-10">
      <section className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Lattes CNPq</CardTitle>
            <CardDescription>
              Faça o scraping do currículo e acompanhe o progresso em tempo real.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome</Label>
                <Input
                  id="nome"
                  type="text"
                  value={nome}
                  onChange={(event) => setNome(event.target.value)}
                  placeholder="Ex: Neocles Alves Pereira"
                  autoComplete="off"
                  required
                />
              </div>
              <Button type="submit" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Processando...
                  </>
                ) : (
                  "Buscar currículo"
                )}
              </Button>
            </form>

            {activeMode ? (
              <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900">
                <div className="mb-1 flex items-center gap-2 font-medium">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {activeMode === "scrape"
                    ? "Executando scraping"
                    : "Gerando resumo com ChatGPT"}
                </div>
                <p>{activeLoadingMessage}</p>
                <p className="mt-1 text-xs">Tempo decorrido: {elapsedSeconds}s</p>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setShowLogs((prev) => !prev)}
              >
                <Terminal className="h-4 w-4" />
                {showLogs ? "Ocultar logs" : "Mostrar logs"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setLogs([])}
                disabled={logs.length === 0}
              >
                Limpar logs
              </Button>
            </div>

            {showLogs ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="mb-2 text-sm font-medium">Logs das requisições</p>
                {logs.length === 0 ? (
                  <p className="text-sm text-slate-500">Nenhum log registrado.</p>
                ) : (
                  <div className="max-h-56 space-y-2 overflow-auto">
                    {logs.map((entry) => (
                      <p
                        key={entry.id}
                        className={`rounded-md px-2 py-1 text-xs ${
                          entry.source === "backend"
                            ? "bg-cyan-50 text-cyan-900"
                            : "bg-indigo-50 text-indigo-900"
                        }`}
                      >
                        <strong>
                          {entry.source === "backend" ? "Backend" : "Frontend"}
                        </strong>{" "}
                        {entry.message}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            ) : null}

            {error ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}
          </CardContent>
        </Card>

        {result ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Resultado do scraping</CardTitle>
              <CardDescription>
                {result.duracao_segundos
                  ? `Concluído em ${result.duracao_segundos}s`
                  : "Scraping concluído"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2 text-sm md:grid-cols-2">
                <p>
                  <span className="font-semibold">Nome:</span> {result.nome}
                </p>
                <p>
                  <span className="font-semibold">Última atualização:</span>{" "}
                  {new Date(result.ultima_atualizacao_curriculo).toLocaleDateString(
                    "pt-BR",
                  )}
                </p>
                <p className="md:col-span-2">
                  <span className="font-semibold">Arquivo:</span> {result.arquivo_pdf}
                </p>
                <p className="md:col-span-2">
                  <a
                    href={result.download_pdf_url}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-sky-700 underline hover:text-sky-600"
                  >
                    Baixar PDF
                  </a>
                </p>
              </div>

              <div className="space-y-3 rounded-lg border border-slate-200 p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <Sparkles className="h-4 w-4" />
                  Resumir com ChatGPT
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="openai-key">API Key OpenAI</Label>
                    <Input
                      id="openai-key"
                      type="password"
                      value={apiKey}
                      onChange={(event) => setApiKey(event.target.value)}
                      placeholder="sk-... (opcional se configurada no backend)"
                      autoComplete="off"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="modelo">Modelo</Label>
                    <select
                      id="modelo"
                      value={modelo}
                      onChange={(event) => setModelo(event.target.value)}
                      className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                    >
                      <option value="gpt-4o-mini">gpt-4o-mini</option>
                      <option value="gpt-4o">gpt-4o</option>
                      <option value="gpt-4.1">gpt-4.1</option>
                      <option value="gpt-4.1-mini">gpt-4.1-mini</option>
                      <option value="gpt-4.1-nano">gpt-4.1-nano</option>
                    </select>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="success"
                  onClick={handleSummarize}
                  disabled={isBusy}
                >
                  {summarizing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Resumindo...
                    </>
                  ) : (
                    "Resumir com ChatGPT"
                  )}
                </Button>
              </div>

              {summaryError ? (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {summaryError}
                </div>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        {summary ? (
          <Card className="border-emerald-200 bg-emerald-50">
            <CardHeader>
              <CardTitle className="text-xl">Resumo - {summary.nome}</CardTitle>
              <CardDescription>
                {summary.duracao_segundos
                  ? `Gerado em ${summary.duracao_segundos}s`
                  : "Resumo gerado"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm leading-relaxed text-slate-800 [&_h1]:mt-4 [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:mt-3 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:mt-2 [&_h3]:text-base [&_h3]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_p]:my-2">
                <Markdown>{summary.resumo}</Markdown>
              </div>
            </CardContent>
          </Card>
        ) : null}
      </section>
    </main>
  );
}
