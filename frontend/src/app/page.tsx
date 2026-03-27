"use client";

import { useEffect, useMemo, useState } from "react";
import { type FieldErrors, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Info, Loader2, Sparkles, Terminal, Upload } from "lucide-react";
import Markdown from "react-markdown";
import {
  buscarCandidatos,
  type BatchScrapeResponse,
  getApiErrorMessage,
  scrapeCurriculosLote,
  scrapeCurriculoSelecionado,
  type SearchCandidate,
  summarizeCurriculo,
  type ScrapeResponse,
  type SummarizeResponse,
} from "@/lib/api";
import {
  BatchUploadSchema,
  IndividualSearchSchema,
  type BatchUploadFormData,
  type IndividualSearchFormData,
} from "@/lib/schemas";
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

type LogSource = "frontend" | "backend";

type LogEntry = {
  id: number;
  source: LogSource;
  message: string;
};

type SearchMode = "individual" | "lote";

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

const BATCH_LOADING_MESSAGES = [
  "Enviando CSV para o backend...",
  "Validando e deduplicando nomes...",
  "Executando scraping em lote...",
  "Consolidando resultados...",
];

const SEARCH_LOADING_MESSAGES = [
  "Consultando resultados no Lattes...",
  "Carregando candidatos encontrados...",
  "Preparando seleção para você...",
];

function InfoTooltip({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex items-center">
      <span
        aria-label={text}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full text-slate-500"
      >
        <Info className="h-3.5 w-3.5" />
      </span>
      <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 hidden w-56 -translate-x-1/2 rounded-md border border-slate-200 bg-white p-2 text-xs font-normal text-slate-700 shadow-lg group-hover:block group-focus-within:block">
        {text}
      </span>
    </span>
  );
}

export default function Home() {
  const [mode, setMode] = useState<SearchMode>("individual");
  const [loading, setLoading] = useState(false);
  const [searchingCandidates, setSearchingCandidates] = useState(false);
  const [result, setResult] = useState<ScrapeResponse | null>(null);
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchResult, setBatchResult] = useState<BatchScrapeResponse | null>(
    null,
  );
  const [candidates, setCandidates] = useState<SearchCandidate[]>([]);
  const [selectedCandidateHref, setSelectedCandidateHref] = useState("");
  const [searchedName, setSearchedName] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [modelo, setModelo] = useState("gpt-4o-mini");
  const [summarizing, setSummarizing] = useState(false);
  const [summaryError, setSummaryError] = useState("");
  const [summary, setSummary] = useState<SummarizeResponse | null>(null);
  const [showLogs, setShowLogs] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);

  // React Hook Form instances
  const individualForm = useForm({
    resolver: zodResolver(IndividualSearchSchema),
    mode: "onSubmit" as const,
    defaultValues: {
      nome: "",
    },
  });

  const batchForm = useForm({
    resolver: zodResolver(BatchUploadSchema),
    mode: "onSubmit" as const,
    defaultValues: {
      skip: 0,
      limit: undefined as number | undefined,
    },
  });

  const activeMode = summarizing
    ? "summarize"
    : batchLoading
      ? "batch"
      : searchingCandidates
        ? "search"
        : loading
          ? "scrape"
          : null;

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
    if (activeMode === "batch") {
      return BATCH_LOADING_MESSAGES[
        loadingMessageIndex % BATCH_LOADING_MESSAGES.length
      ];
    }
    if (activeMode === "search") {
      return SEARCH_LOADING_MESSAGES[
        loadingMessageIndex % SEARCH_LOADING_MESSAGES.length
      ];
    }
    return "";
  }, [activeMode, loadingMessageIndex]);

  const isBusy = loading || summarizing || batchLoading || searchingCandidates;

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

  const handleSubmit = async (data: IndividualSearchFormData) => {
    setSearchingCandidates(true);
    setCandidates([]);
    setSelectedCandidateHref("");
    setSearchedName(data.nome);
    setResult(null);
    setBatchResult(null);
    setSummary(null);
    setSummaryError("");
    addLog("frontend", `Iniciando requisição /search para '${data.nome}'.`);

    try {
      const response = await buscarCandidatos(data.nome, 20);
      setCandidates(response.candidatos);
      if (response.candidatos.length > 0) {
        setSelectedCandidateHref(response.candidatos[0].href);
      }
      addLog(
        "frontend",
        `Resposta /search recebida com ${response.total} candidato(s).`,
      );
    } catch (err) {
      const errorMessage = getApiErrorMessage(err);
      individualForm.setError("nome", { message: errorMessage });
      addLog("frontend", `Erro em /search: ${errorMessage}`);
    } finally {
      setSearchingCandidates(false);
    }
  };

  const handleScrapeSelected = async () => {
    if (!selectedCandidateHref) {
      individualForm.setError("nome", {
        message: "Selecione um candidato antes de iniciar o scraping.",
      });
      return;
    }

    const selectedCandidate = candidates.find(
      (candidate) => candidate.href === selectedCandidateHref,
    );

    if (!selectedCandidate) {
      individualForm.setError("nome", {
        message: "Candidato selecionado inválido. Faça a busca novamente.",
      });
      return;
    }

    setLoading(true);
    setResult(null);
    setBatchResult(null);
    setSummary(null);
    setSummaryError("");

    addLog(
      "frontend",
      `Iniciando requisição /scrape para candidato '${selectedCandidate.nome}'.`,
    );

    try {
      const response = await scrapeCurriculoSelecionado(
        selectedCandidate.nome,
        selectedCandidate.href,
      );
      setResult(response);
      addLog(
        "frontend",
        `Resposta /scrape recebida em ${response.duracao_segundos ?? "?"}s.`,
      );
      response.logs?.forEach((message) => addLog("backend", message));
    } catch (err) {
      const errorMessage = getApiErrorMessage(err);
      individualForm.setError("nome", { message: errorMessage });
      addLog("frontend", `Erro em /scrape: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const handleBatchSubmit = async (data: BatchUploadFormData) => {
    if (!data?.csvFile) {
      batchForm.setError("root", {
        message: "Selecione um arquivo CSV antes de enviar.",
      });
      addLog("frontend", "Formulário de lote inválido: arquivo CSV ausente.");
      return;
    }

    setBatchLoading(true);
    setResult(null);
    setBatchResult(null);
    setCandidates([]);
    setSelectedCandidateHref("");
    setSummary(null);
    setSummaryError("");

    addLog(
      "frontend",
      `Iniciando requisição /scrape/batch com arquivo '${data.csvFile.name}'.`,
    );
    addLog(
      "frontend",
      `Arquivo selecionado: nome='${data.csvFile.name}', tamanho=${data.csvFile.size} bytes, tipo='${data.csvFile.type || "(vazio)"}'.`,
    );

    try {
      const response = await scrapeCurriculosLote(data.csvFile, {
        skip: data.skip,
        limit: data.limit,
      });
      setBatchResult(response);
      addLog(
        "frontend",
        `Resposta /scrape/batch recebida em ${response.duracao_segundos ?? "?"}s.`,
      );
      response.logs?.forEach((message) => addLog("backend", message));
      batchForm.reset();
      setFileInputKey((prev) => prev + 1);
    } catch (err) {
      const errorMessage = getApiErrorMessage(err);
      batchForm.setError("root", { message: errorMessage });
      addLog("frontend", `Erro em /scrape/batch: ${errorMessage}`);
    } finally {
      setBatchLoading(false);
    }
  };

  const handleBatchInvalid = (errors: FieldErrors<BatchUploadFormData>) => {
    const firstError =
      errors.csvFile?.message ??
      errors.skip?.message ??
      errors.limit?.message ??
      "Verifique os campos do formulário de lote.";

    const message = String(firstError);
    batchForm.setError("root", { message });
    addLog("frontend", `Formulário de lote inválido: ${message}`);
  };

  async function handleSummarize() {
    if (!result) return;

    setSummarizing(true);
    setSummaryError("");
    setSummary(null);
    addLog(
      "frontend",
      `Iniciando requisição /summarize para '${result.nome}'.`,
    );

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
              Faça o scraping do currículo e acompanhe o progresso em tempo
              real.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={mode === "individual" ? "default" : "outline"}
                  onClick={() => setMode("individual")}
                >
                  Individual
                </Button>
                <Button
                  type="button"
                  variant={mode === "lote" ? "default" : "outline"}
                  onClick={() => {
                    setMode("lote");
                    setCandidates([]);
                    setSelectedCandidateHref("");
                    setSearchedName("");
                  }}
                >
                  Lote (CSV)
                </Button>
              </div>
            </div>

            {mode === "individual" ? (
              <Form {...individualForm}>
                <form
                  onSubmit={individualForm.handleSubmit(
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    handleSubmit as (data: any) => Promise<void>,
                  )}
                  className="space-y-3"
                >
                  <FormField
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    control={individualForm.control as any}
                    name="nome"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Ex: Neocles Alves Pereira"
                            autoComplete="off"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" disabled={isBusy} className="w-full">
                    {searchingCandidates ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Buscando candidatos...
                      </>
                    ) : (
                      "Buscar candidatos"
                    )}
                  </Button>

                  {candidates.length > 0 ? (
                    <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
                      <p className="text-sm font-medium text-slate-800">
                        {candidates.length} candidato(s) encontrado(s) para{" "}
                        <span className="font-semibold">{searchedName}</span>
                      </p>
                      <div className="max-h-56 space-y-2 overflow-auto rounded-md border border-slate-200 bg-white p-2">
                        {candidates.map((candidate, index) => (
                          <label
                            key={`${candidate.href}-${index}`}
                            className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1 text-sm hover:bg-slate-50"
                          >
                            <input
                              type="radio"
                              name="candidate-selection"
                              value={candidate.href}
                              checked={selectedCandidateHref === candidate.href}
                              onChange={() =>
                                setSelectedCandidateHref(candidate.href)
                              }
                              className="mt-0.5"
                            />
                            <span>{candidate.nome}</span>
                          </label>
                        ))}
                      </div>

                      <Button
                        type="button"
                        onClick={handleScrapeSelected}
                        disabled={isBusy || !selectedCandidateHref}
                        className="w-full"
                      >
                        {loading ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Processando scraping...
                          </>
                        ) : (
                          "Fazer scraping do candidato selecionado"
                        )}
                      </Button>
                    </div>
                  ) : null}
                </form>
              </Form>
            ) : null}

            {mode === "lote" ? (
              <Form {...batchForm}>
                <form
                  onSubmit={batchForm.handleSubmit(
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    handleBatchSubmit as (data: any) => Promise<void>,
                    handleBatchInvalid,
                  )}
                  className="space-y-4 rounded-xl border border-slate-200 bg-linear-to-br from-white via-slate-50 to-slate-100 p-5 shadow-sm"
                >
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-slate-900">
                      Upload de lista de docentes
                    </p>
                    <p className="text-xs text-slate-600">
                      Envie um CSV com um nome por linha para processar
                      curriculos em lote.
                    </p>
                  </div>

                  <FormField
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    control={batchForm.control as any}
                    name="csvFile"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Arquivo CSV</FormLabel>
                        <FormControl>
                          <div className="space-y-2">
                            <Input
                              key={fileInputKey}
                              id="csv-upload"
                              type="file"
                              accept=".csv,text/csv"
                              name={field.name}
                              ref={field.ref}
                              onBlur={field.onBlur}
                              onChange={(event) => {
                                const file = event.target.files?.[0];
                                field.onChange(file);
                              }}
                              className="sr-only"
                            />

                            <label
                              htmlFor="csv-upload"
                              onDragOver={(event) => {
                                event.preventDefault();
                                setIsDragOver(true);
                              }}
                              onDragLeave={() => setIsDragOver(false)}
                              onDrop={(event) => {
                                event.preventDefault();
                                setIsDragOver(false);
                                const file = event.dataTransfer.files?.[0];
                                if (file) {
                                  field.onChange(file);
                                }
                              }}
                              className={`flex min-h-28 w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-5 text-center transition ${
                                isDragOver
                                  ? "border-sky-400 bg-sky-50"
                                  : "border-slate-300 bg-white hover:border-sky-300 hover:bg-slate-50"
                              }`}
                            >
                              <Upload className="mb-2 h-5 w-5 text-slate-500" />
                              <p className="text-sm font-medium text-slate-800">
                                Arraste e solte o CSV aqui
                              </p>
                              <p className="mt-1 text-xs text-slate-500">
                                ou clique para selecionar o arquivo
                              </p>
                            </label>
                          </div>
                        </FormControl>
                        {field.value && (
                          <p className="text-xs text-slate-500">
                            Arquivo selecionado: {field.value.name}
                          </p>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid gap-3 md:grid-cols-2">
                    <FormField
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      control={batchForm.control as any}
                      name="skip"
                      render={({ field: { value, ...field } }) => (
                        <FormItem>
                          <FormLabel className="inline-flex items-center gap-1.5">
                            Skip
                            <InfoTooltip text="Quantidade de nomes ignorados no inicio da lista. Ex.: skip 10 comeca no 11o nome." />
                          </FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="0"
                              {...field}
                              value={value}
                              onChange={(e) =>
                                field.onChange(Number(e.target.value))
                              }
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      control={batchForm.control as any}
                      name="limit"
                      render={({ field: { value, ...field } }) => (
                        <FormItem>
                          <FormLabel className="inline-flex items-center gap-1.5">
                            Limit (opcional)
                            <InfoTooltip text="Quantidade maxima de nomes a processar apos aplicar o skip. Vazio = processa todos." />
                          </FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="1"
                              placeholder="Ex: 50"
                              {...field}
                              value={value || ""}
                              onChange={(e) =>
                                field.onChange(
                                  e.target.value === ""
                                    ? undefined
                                    : Number(e.target.value),
                                )
                              }
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {batchForm.formState.errors.root && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                      {batchForm.formState.errors.root.message}
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={batchLoading || loading}
                    className="w-full"
                  >
                    {batchLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Processando lote...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4" />
                        Enviar CSV e processar lote
                      </>
                    )}
                  </Button>
                </form>
              </Form>
            ) : null}

            {activeMode ? (
              <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900">
                <div className="mb-1 flex items-center gap-2 font-medium">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {activeMode === "scrape"
                    ? "Executando scraping"
                    : activeMode === "batch"
                      ? "Executando scraping em lote"
                      : activeMode === "search"
                        ? "Buscando candidatos"
                        : "Gerando resumo com ChatGPT"}
                </div>
                <p>{activeLoadingMessage}</p>
                <p className="mt-1 text-xs">
                  Tempo decorrido: {elapsedSeconds}s
                </p>
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
                  <p className="text-sm text-slate-500">
                    Nenhum log registrado.
                  </p>
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
          </CardContent>
        </Card>

        {batchResult ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Resultado do lote</CardTitle>
              <CardDescription>
                {batchResult.total_processados} nomes processados | Sucesso:{" "}
                {batchResult.sucesso} | Erros: {batchResult.erro}
                {batchResult.duracao_segundos
                  ? ` | Tempo: ${batchResult.duracao_segundos}s`
                  : ""}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {batchResult.zip_download_url ? (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                  <p className="mb-2 font-medium">ZIP consolidado disponível</p>
                  <a
                    href={batchResult.zip_download_url}
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-emerald-700 underline hover:text-emerald-600"
                  >
                    Baixar {batchResult.zip_arquivo ?? "arquivo.zip"}
                  </a>
                </div>
              ) : null}

              {batchResult.zip_erro ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  Falha ao gerar ZIP consolidado: {batchResult.zip_erro}
                </div>
              ) : null}

              <div className="overflow-x-auto">
                <table className="w-full min-w-170 text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-600">
                      <th className="px-2 py-2">Nome</th>
                      <th className="px-2 py-2">Status</th>
                      <th className="px-2 py-2">Duração</th>
                      <th className="px-2 py-2">Detalhes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {batchResult.resultados.map((item, index) => (
                      <tr
                        key={`${item.nome}-${index}`}
                        className="border-b border-slate-100"
                      >
                        <td className="px-2 py-2 align-top">{item.nome}</td>
                        <td className="px-2 py-2 align-top">
                          <span
                            className={`rounded px-2 py-1 text-xs font-medium ${
                              item.status === "sucesso"
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-red-100 text-red-800"
                            }`}
                          >
                            {item.status}
                          </span>
                        </td>
                        <td className="px-2 py-2 align-top">
                          {item.duracao_segundos}s
                        </td>
                        <td className="px-2 py-2 align-top">
                          {item.status === "sucesso" ? (
                            <a
                              href={item.download_pdf_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-sky-700 underline hover:text-sky-600"
                            >
                              Baixar PDF
                            </a>
                          ) : (
                            <span className="text-red-700">{item.erro}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        ) : null}

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
                  {new Date(
                    result.ultima_atualizacao_curriculo,
                  ).toLocaleDateString("pt-BR")}
                </p>
                <p className="md:col-span-2">
                  <span className="font-semibold">Arquivo:</span>{" "}
                  {result.arquivo_pdf}
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
