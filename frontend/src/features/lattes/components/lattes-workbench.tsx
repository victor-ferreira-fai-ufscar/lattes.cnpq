"use client";

import {
  AlertCircle,
  ArrowDownRight,
  BrainCircuit,
  CheckCircle2,
  FileCheck2,
  FileSpreadsheet,
  Search,
  Sparkles,
  TerminalSquare,
  Trash2,
} from "lucide-react";
import { useEffect, useRef } from "react";

import { SectionHeading } from "@/components/shared/section-heading";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BatchUploadPanel } from "@/features/lattes/components/batch-upload-panel";
import { BatchResultCard } from "@/features/lattes/components/batch-result-card";
import { ExecutionLogCard } from "@/features/lattes/components/execution-log-card";
import { IndividualSearchPanel } from "@/features/lattes/components/individual-search-panel";
import { RequestLoadingModal } from "@/features/lattes/components/request-loading-modal";
import { ScrapeResultCard } from "@/features/lattes/components/scrape-result-card";
import { SummaryPanel } from "@/features/lattes/components/summary-panel";
import { SummaryResultCard } from "@/features/lattes/components/summary-result-card";
import { useLattesWorkbench } from "@/features/lattes/hooks/use-lattes-workbench";
import { cn } from "@/lib/utils";

export function LattesWorkbench() {
  const {
    mode,
    loading,
    activeRequest,
    isInteractionLocked,
    errorMessage,
    statusMessage,
    lastSearchTerm,
    candidates,
    selectedCandidate,
    scrapeResult,
    batchResult,
    summaryResult,
    availableModels,
    storedApiKeys,
    summaryConfig,
    handleModeChange,
    searchCandidates,
    trySearchVariants,
    setSelectedCandidate,
    scrapeSelected,
    submitBatch,
    updateSummaryConfig,
    loadModels,
    summarize,
    clearHistory,
    cancelActiveRequest,
    activeLogs,
  } = useLattesWorkbench();
  const resultsRef = useRef<HTMLDivElement | null>(null);
  const summaryResultRef = useRef<HTMLDivElement | null>(null);
  const formSectionRef = useRef<HTMLDivElement | null>(null);
  const logsRef = useRef<HTMLDivElement | null>(null);
  const previousLoadingRef = useRef({
    scrape: loading.scrape,
    batch: loading.batch,
    summarize: loading.summarize,
  });
  const hasMainResult = Boolean(scrapeResult || batchResult);
  const hasSummaryResult = Boolean(summaryResult);
  const hasLogs = activeLogs.length > 0;
  const activeFlowLabel =
    mode === "individual" ? "Busca individual" : "Processamento em lote";
  const statusCards = [
    {
      title: "Fluxo atual",
      value: activeFlowLabel,
      tone: "from-white to-teal-50/80",
    },
    {
      title: "Ultima busca",
      value: lastSearchTerm ?? "Nenhuma ainda",
      tone: "from-white to-amber-50/80",
    },
    {
      title: "Resultados",
      value: hasMainResult
        ? batchResult
          ? "Lote pronto"
          : "Curriculo pronto"
        : "Aguardando execucao",
      tone: "from-white to-cyan-50/80",
    },
    {
      title: "Resumo IA",
      value: hasSummaryResult ? "Gerado" : scrapeResult ? "Disponivel" : "Indisponivel",
      tone: "from-white to-slate-100",
    },
  ];

  useEffect(() => {
    const previousLoading = previousLoadingRef.current;

    if (previousLoading.scrape && !loading.scrape && scrapeResult) {
      scrollToSection(resultsRef.current);
    }

    if (previousLoading.batch && !loading.batch && batchResult) {
      scrollToSection(resultsRef.current);
    }

    if (previousLoading.summarize && !loading.summarize && summaryResult) {
      scrollToSection(summaryResultRef.current);
    }

    previousLoadingRef.current = {
      scrape: loading.scrape,
      batch: loading.batch,
      summarize: loading.summarize,
    };
  }, [
    batchResult,
    loading.batch,
    loading.scrape,
    loading.summarize,
    scrapeResult,
    summaryResult,
  ]);

  return (
    <main className="relative overflow-x-clip px-3 py-5 pb-[calc(7.5rem+env(safe-area-inset-bottom))] sm:px-5 sm:py-8 sm:pb-8 lg:px-8 lg:py-10">
      <div className="absolute inset-x-0 top-0 -z-10 h-[420px] bg-[radial-gradient(circle_at_top_left,_rgba(13,148,136,0.24),_transparent_38%),radial-gradient(circle_at_top_right,_rgba(249,115,22,0.18),_transparent_34%),linear-gradient(180deg,_rgba(255,251,235,0.95),_rgba(248,250,252,0.96)_40%,_rgba(240,253,250,0.92)_100%)]" />
      <div className="absolute inset-x-0 top-24 -z-10 h-[720px] bg-[linear-gradient(180deg,rgba(255,255,255,0)_0%,rgba(255,255,255,0.32)_24%,rgba(255,255,255,0)_100%)]" />
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-5 sm:gap-6 lg:gap-8">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)] xl:items-stretch">
          <div className="relative overflow-hidden rounded-[32px] border border-white/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.94),rgba(240,253,250,0.88))] p-5 shadow-[0_28px_100px_-52px_rgba(15,23,42,0.55)] backdrop-blur sm:p-7 lg:p-8">
            <div className="absolute -right-14 top-0 h-40 w-40 rounded-full bg-teal-200/40 blur-3xl" />
            <div className="absolute bottom-0 left-0 h-36 w-36 rounded-full bg-amber-200/40 blur-3xl" />
            <div className="relative space-y-6">
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-teal-800">
                <Sparkles className="h-3.5 w-3.5" />
                Workspace Lattes
              </div>
              <SectionHeading
                eyebrow="Consulta de currículos Lattes"
                title="Uma tela mais guiada para pesquisar, gerar arquivos e revisar resultados"
                description="O fluxo agora prioriza leitura em telas pequenas, com etapas mais claras, atalhos rápidos e contexto visual para reduzir cliques desnecessários."
              />
              <div className="grid gap-3 sm:grid-cols-3">
                <HeroFeatureCard
                  title="Busca precisa"
                  description="Pesquise um nome, escolha a pessoa certa e continue sem perder o contexto."
                />
                <HeroFeatureCard
                  title="Lote sem atrito"
                  description="Envie CSV, acompanhe a execução e volte para os resultados com menos esforço."
                />
                <HeroFeatureCard
                  title="Resumo opcional"
                  description="Gere o resumo com IA só quando fizer sentido para a triagem."
                />
              </div>
            </div>
          </div>

          <div className="rounded-[30px] border border-white/70 bg-white/86 p-5 shadow-[0_24px_80px_-50px_rgba(15,23,42,0.5)] backdrop-blur sm:p-6">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <ArrowDownRight className="h-4 w-4 text-teal-700" />
              Roteiro rápido
            </div>
            <div className="mt-4 space-y-3 text-sm text-slate-600">
              <GuideStep
                index="01"
                title="Escolha o fluxo"
                description="Use busca individual quando precisar validar uma pessoa, ou lote quando já tiver a lista pronta."
              />
              <GuideStep
                index="02"
                title="Execute com feedback"
                description="A aplicação bloqueia interações conflitantes e mostra um modal enquanto processa a solicitação."
              />
              <GuideStep
                index="03"
                title="Revise os artefatos"
                description="Resultados, resumo e logs ficam organizados em sequência para facilitar a leitura depois da execução."
              />
            </div>
          </div>
        </div>

        <div className="sticky top-3 z-20 rounded-[28px] border border-white/70 bg-white/80 p-3 shadow-[0_20px_60px_-42px_rgba(15,23,42,0.45)] backdrop-blur sm:top-4 sm:p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                Escolha o fluxo
              </p>
              <p className="mt-1 text-sm text-slate-700">
                {mode === "individual"
                  ? "Fluxo mais guiado para validar uma pessoa por vez."
                  : "Fluxo otimizado para listas maiores e acompanhamento por lote."}
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:min-w-[560px]">
              <Button
                className={cn(
                  "h-auto justify-start rounded-2xl px-4 py-3 text-left",
                  mode === "individual"
                    ? "bg-slate-900 text-white shadow-lg hover:bg-slate-900"
                    : "border-slate-200 bg-white text-slate-900 hover:bg-slate-50",
                )}
                disabled={isInteractionLocked}
                onClick={() => handleModeChange("individual")}
                type="button"
                variant={mode === "individual" ? "default" : "outline"}
              >
                <span className="flex items-start gap-3">
                  <Search className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    <span className="block text-sm font-semibold">Buscar uma pessoa</span>
                    <span className={cn("mt-1 block text-xs", mode === "individual" ? "text-slate-300" : "text-slate-500")}>
                      Ideal para conferência manual e seleção entre homônimos.
                    </span>
                  </span>
                </span>
              </Button>
              <Button
                className={cn(
                  "h-auto justify-start rounded-2xl px-4 py-3 text-left",
                  mode === "lote"
                    ? "bg-slate-900 text-white shadow-lg hover:bg-slate-900"
                    : "border-slate-200 bg-white text-slate-900 hover:bg-slate-50",
                )}
                disabled={isInteractionLocked}
                onClick={() => handleModeChange("lote")}
                type="button"
                variant={mode === "lote" ? "default" : "outline"}
              >
                <span className="flex items-start gap-3">
                  <FileSpreadsheet className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    <span className="block text-sm font-semibold">Enviar lista em CSV</span>
                    <span className={cn("mt-1 block text-xs", mode === "lote" ? "text-slate-300" : "text-slate-500")}>
                      Melhor para processar vários nomes e consolidar os artefatos gerados.
                    </span>
                  </span>
                </span>
              </Button>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              className="rounded-full border-red-300 bg-white text-red-700 hover:bg-red-50"
              disabled={isInteractionLocked}
              type="button"
              variant="outline"
              onClick={() => {
                const confirmed = window.confirm(
                  "Deseja limpar o historico salvo de buscas, execucoes e logs?",
                );
                if (!confirmed) {
                  return;
                }
                clearHistory();
              }}
            >
              <Trash2 className="h-4 w-4" />
              Limpar historico
            </Button>
            <QuickJumpButton
              disabled={!hasMainResult}
              label="Ir para resultados"
              onClick={() => scrollToSection(resultsRef.current)}
            />
            <QuickJumpButton
              disabled={!hasSummaryResult}
              label="Ir para resumo"
              onClick={() => scrollToSection(summaryResultRef.current)}
            />
            <QuickJumpButton
              disabled={!hasLogs}
              label="Ir para logs"
              onClick={() => scrollToSection(logsRef.current)}
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {statusCards.map((card) => (
            <StatusCard
              key={card.title}
              title={card.title}
              value={card.value}
              tone={card.tone}
            />
          ))}
        </div>

        {errorMessage ? (
          <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{errorMessage}</p>
          </div>
        ) : null}

        {statusMessage ? (
          <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{statusMessage}</p>
          </div>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
          <div className="space-y-6">
            <div
              ref={formSectionRef}
              className="rounded-[30px] border border-white/70 bg-white/84 p-4 shadow-[0_24px_80px_-50px_rgba(15,23,42,0.5)] backdrop-blur sm:p-5"
            >
              <SectionBlockHeader
                eyebrow="Etapa 1"
                title={mode === "individual" ? "Pesquise e selecione a pessoa" : "Envie e configure o arquivo CSV"}
                description={
                  mode === "individual"
                    ? "O fluxo individual privilegia menos ambiguidade e mais controle sobre a pessoa escolhida."
                    : "O fluxo em lote privilegia produtividade, com menos passos e acompanhamento por execução."
                }
              />
              <div className="mt-4">
                {mode === "individual" ? (
                  <IndividualSearchPanel
                    candidates={candidates}
                    disabled={isInteractionLocked}
                    isScraping={loading.scrape}
                    isSearching={loading.search}
                    isTryingVariants={loading.variants}
                    lastSearchTerm={lastSearchTerm}
                    selectedCandidate={selectedCandidate}
                    onScrape={scrapeSelected}
                    onSearch={searchCandidates}
                    onTrySearchVariants={trySearchVariants}
                    onSelectCandidate={setSelectedCandidate}
                  />
                ) : (
                  <BatchUploadPanel
                    disabled={isInteractionLocked}
                    isSubmitting={loading.batch}
                    onSubmitBatch={submitBatch}
                  />
                )}
              </div>
            </div>

            <div
              ref={resultsRef}
              className="rounded-[30px] border border-white/70 bg-white/84 p-4 shadow-[0_24px_80px_-50px_rgba(15,23,42,0.5)] backdrop-blur sm:p-5"
            >
              <SectionBlockHeader
                eyebrow="Etapa 2"
                title="Resultados principais"
                description="Os arquivos gerados e o status do processamento aparecem aqui assim que a execução termina."
              />
              <div className="mt-4 space-y-6">
                {scrapeResult ? <ScrapeResultCard result={scrapeResult} /> : null}
                {batchResult ? <BatchResultCard result={batchResult} /> : null}
                {!scrapeResult && !batchResult && (loading.scrape || loading.batch) ? (
                  <div className="rounded-3xl border border-slate-200/80 bg-white/80 p-6 shadow-[0_24px_80px_-48px_rgba(15,23,42,0.45)] backdrop-blur">
                    <div className="space-y-3">
                      <Skeleton className="h-5 w-48" />
                      <Skeleton className="h-4 w-64" />
                      <Skeleton className="h-28 w-full rounded-2xl" />
                      <div className="grid gap-3 md:grid-cols-2">
                        <Skeleton className="h-20 w-full rounded-2xl" />
                        <Skeleton className="h-20 w-full rounded-2xl" />
                      </div>
                    </div>
                  </div>
                ) : null}
                {!hasMainResult && !loading.scrape && !loading.batch ? (
                  <EmptyStateCard
                    title="Os resultados vao aparecer aqui"
                    description="Assim que voce concluir uma busca individual ou um processamento em lote, esta area recebe os artefatos principais."
                  />
                ) : null}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-[30px] border border-white/70 bg-white/84 p-4 shadow-[0_24px_80px_-50px_rgba(15,23,42,0.5)] backdrop-blur sm:p-5">
              <SectionBlockHeader
                eyebrow="Etapa 3"
                title="Resumo e acompanhamento"
                description="Quando o curriculo estiver pronto, voce pode gerar um resumo com IA e revisar os logs da execucao no mesmo bloco lateral."
              />
              <div className="mt-4 space-y-6">
                {scrapeResult ? (
                  <SummaryPanel
                    defaultValues={summaryConfig}
                    disabled={isInteractionLocked}
                    storedApiKeys={storedApiKeys}
                    isLoadingModels={loading.models}
                    isSubmitting={loading.summarize}
                    models={availableModels}
                    onConfigChange={updateSummaryConfig}
                    onLoadModels={loadModels}
                    onSubmitSummary={async (values) => {
                      await summarize(values);
                    }}
                  />
                ) : (
                  <EmptyStateCard
                    title="Resumo liberado depois do curriculo"
                    description="A etapa de resumo so faz sentido quando o curriculo ja foi preparado e os dados principais estao prontos para leitura."
                  />
                )}
                {summaryResult ? (
                  <div ref={summaryResultRef}>
                    <SummaryResultCard result={summaryResult} />
                  </div>
                ) : null}
                {!summaryResult && loading.summarize ? (
                  <div className="rounded-3xl border border-cyan-200/70 bg-cyan-50/60 p-6">
                    <div className="space-y-3">
                      <Skeleton className="h-5 w-44" />
                      <Skeleton className="h-4 w-72" />
                      <Skeleton className="h-40 w-full rounded-2xl" />
                    </div>
                  </div>
                ) : null}
                <div ref={logsRef}>
                  <ExecutionLogCard
                    isProcessing={isInteractionLocked}
                    logs={activeLogs}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      <MobileBottomBar
        hasLogs={hasLogs}
        hasMainResult={hasMainResult}
        hasSummaryResult={hasSummaryResult}
        isInteractionLocked={isInteractionLocked}
        onGoToForm={() => scrollToSection(formSectionRef.current)}
        onGoToLogs={() => scrollToSection(logsRef.current)}
        onGoToResults={() => scrollToSection(resultsRef.current)}
        onGoToSummary={() => scrollToSection(summaryResultRef.current)}
      />
      {activeRequest ? (
        <RequestLoadingModal
          description={activeRequest.description}
          hint={activeRequest.hint}
          title={activeRequest.title}
          onCancel={() => {
            void cancelActiveRequest();
          }}
        />
      ) : null}
    </main>
  );
}

function scrollToSection(element: HTMLElement | null) {
  if (!element) {
    return;
  }

  requestAnimationFrame(() => {
    element.scrollIntoView({
      behavior: "smooth",
      block: "start",
      inline: "nearest",
    });
  });
}

function GuideStep({
  index,
  title,
  description,
}: {
  index: string;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
        {index}
      </p>
      <p className="mt-2 font-semibold text-slate-900">{title}</p>
      <p className="mt-1 leading-6 text-slate-600">{description}</p>
    </div>
  );
}

function HeroFeatureCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-white/70 bg-white/75 p-4 shadow-[0_12px_28px_-24px_rgba(15,23,42,0.55)] backdrop-blur">
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p>
    </div>
  );
}

function StatusCard({
  title,
  value,
  tone,
}: {
  title: string;
  value: string;
  tone: string;
}) {
  return (
    <div
      className={cn(
        "rounded-[26px] border border-white/70 bg-gradient-to-br p-4 shadow-[0_18px_48px_-36px_rgba(15,23,42,0.45)] backdrop-blur",
        tone,
      )}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
        {title}
      </p>
      <p className="mt-2 text-sm font-semibold text-slate-950 sm:text-base">{value}</p>
    </div>
  );
}

function SectionBlockHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
        {eyebrow}
      </p>
      <div className="flex items-start gap-3">
        <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-sm">
          {eyebrow === "Etapa 1" ? (
            <Search className="h-4 w-4" />
          ) : eyebrow === "Etapa 2" ? (
            <FileCheck2 className="h-4 w-4" />
          ) : (
            <BrainCircuit className="h-4 w-4" />
          )}
        </div>
        <div>
          <h3 className="text-xl font-semibold text-slate-950">{title}</h3>
          <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p>
        </div>
      </div>
    </div>
  );
}

function QuickJumpButton({
  disabled,
  label,
  onClick,
}: {
  disabled: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <Button
      className="rounded-full border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
      disabled={disabled}
      type="button"
      variant="outline"
      onClick={onClick}
    >
      <ArrowDownRight className="h-4 w-4" />
      {label}
    </Button>
  );
}

function EmptyStateCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50/80 p-5 text-sm text-slate-600">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-white text-slate-700 shadow-sm">
          <TerminalSquare className="h-4 w-4" />
        </div>
        <div>
          <p className="font-semibold text-slate-900">{title}</p>
          <p className="mt-1 leading-6">{description}</p>
        </div>
      </div>
    </div>
  );
}

function MobileBottomBar({
  hasLogs,
  hasMainResult,
  hasSummaryResult,
  isInteractionLocked,
  onGoToForm,
  onGoToLogs,
  onGoToResults,
  onGoToSummary,
}: {
  hasLogs: boolean;
  hasMainResult: boolean;
  hasSummaryResult: boolean;
  isInteractionLocked: boolean;
  onGoToForm: () => void;
  onGoToLogs: () => void;
  onGoToResults: () => void;
  onGoToSummary: () => void;
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] lg:hidden">
      <div className="mx-auto max-w-7xl rounded-[28px] border border-white/70 bg-white/88 p-2 shadow-[0_24px_60px_-28px_rgba(15,23,42,0.5)] backdrop-blur-xl">
        <div className="grid grid-cols-4 gap-2">
          <MobileBottomBarButton
            disabled={isInteractionLocked}
            icon={<Search className="h-4 w-4" />}
            label="Fluxo"
            onClick={onGoToForm}
          />
          <MobileBottomBarButton
            disabled={isInteractionLocked || !hasMainResult}
            icon={<FileCheck2 className="h-4 w-4" />}
            label="Resultados"
            onClick={onGoToResults}
          />
          <MobileBottomBarButton
            disabled={isInteractionLocked || !hasSummaryResult}
            icon={<BrainCircuit className="h-4 w-4" />}
            label="Resumo"
            onClick={onGoToSummary}
          />
          <MobileBottomBarButton
            disabled={isInteractionLocked || !hasLogs}
            icon={<TerminalSquare className="h-4 w-4" />}
            label="Logs"
            onClick={onGoToLogs}
          />
        </div>
      </div>
    </div>
  );
}

function MobileBottomBarButton({
  disabled,
  icon,
  label,
  onClick,
}: {
  disabled: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className="flex min-h-16 flex-col items-center justify-center gap-1 rounded-[20px] px-2 py-2 text-center text-[11px] font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45"
      disabled={disabled}
      type="button"
      onClick={onClick}
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-100 text-slate-900">
        {icon}
      </span>
      <span>{label}</span>
    </button>
  );
}