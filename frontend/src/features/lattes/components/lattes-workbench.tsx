"use client";

import {
  AlertCircle,
  ArrowDownRight,
  BrainCircuit,
  CircleHelp,
  CheckCircle2,
  FileCheck2,
  FileSpreadsheet,
  Info,
  Pin,
  PinOff,
  Search,
  TerminalSquare,
  Trash2,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { BatchUploadPanel } from "@/features/lattes/components/batch-upload-panel";
import { BatchResultCard } from "@/features/lattes/components/batch-result-card";
import { ExecutionLogCard } from "@/features/lattes/components/execution-log-card";
import { RequestErrorToast } from "@/features/lattes/components/request-error-toast";
import { IndividualSearchPanel } from "@/features/lattes/components/individual-search-panel";
import { RequestLoadingToast } from "@/features/lattes/components/request-loading-toast";
import { ScrapeResultCard } from "@/features/lattes/components/scrape-result-card";
import { SummaryPanel } from "@/features/lattes/components/summary-panel";
import { SummaryResultCard } from "@/features/lattes/components/summary-result-card";
import { useLattesWorkbench } from "@/features/lattes/hooks/use-lattes-workbench";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const ACTIVE_REQUEST_TOAST_ID = "lattes-active-request";
const ERROR_REQUEST_TOAST_ID = "lattes-error-request";
const FLOW_PANEL_PINNED_STORAGE_KEY = "lattes-flow-panel-pinned";
const LOG_PANEL_OPEN_STORAGE_KEY = "lattes-log-panel-open";
const LOG_PANEL_PINNED_STORAGE_KEY = "lattes-log-panel-pinned";

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
    canRetryLastAction,
    retryActionLabel,
    retryLastAction,
    activeLogs,
  } = useLattesWorkbench();
  const resultsRef = useRef<HTMLDivElement | null>(null);
  const summaryResultRef = useRef<HTMLDivElement | null>(null);
  const formSectionRef = useRef<HTMLDivElement | null>(null);
  const activeToastIdRef = useRef<string | number | null>(null);
  const lastErrorMessageRef = useRef<string | null>(null);
  const hasLoadedPreferencesRef = useRef(false);
  const previousLoadingRef = useRef({
    scrape: loading.scrape,
    batch: loading.batch,
    summarize: loading.summarize,
  });
  const [isFlowPanelPinned, setIsFlowPanelPinned] = useState(true);
  const [isLogPanelOpen, setIsLogPanelOpen] = useState(false);
  const [isLogPanelPinned, setIsLogPanelPinned] = useState(false);
  const hasMainResult = Boolean(scrapeResult || batchResult);
  const hasSummaryResult = Boolean(summaryResult);
  const hasLogs = activeLogs.length > 0;
  const canShowLogPanel = isInteractionLocked || hasLogs;
  const isLogPanelVisible = canShowLogPanel && (isLogPanelOpen || isLogPanelPinned);
  const activeFlowLabel =
    mode === "individual" ? "Busca individual" : "Processamento em lote";
  const showResultsSection = mode === "individual"
    ? Boolean(scrapeResult)
    : Boolean(batchResult);
  const showSummarySection = mode === "individual" && Boolean(scrapeResult);
  const visibleStepCount = mode === "individual"
    ? showSummarySection
      ? 3
      : showResultsSection
        ? 2
        : 1
    : showResultsSection
      ? 2
      : 1;
  const currentStepIndex = mode === "individual"
    ? hasSummaryResult || loading.summarize || loading.models
      ? 2
      : showResultsSection
        ? 1
        : 0
    : showResultsSection
        ? 1
        : 0;
  const flowSteps = mode === "individual"
    ? [
        { title: "Pesquisar e selecionar" },
        { title: "Resultados" },
        { title: "Resumo" },
      ]
    : [
        { title: "Enviar CSV" },
        { title: "Resultados" },
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

  useEffect(() => {
    if (!activeRequest) {
      toast.dismiss(ACTIVE_REQUEST_TOAST_ID);
      activeToastIdRef.current = null;
      return;
    }

    activeToastIdRef.current = toast.custom(
      () => (
        <RequestLoadingToast
          onCancel={() => {
            toast.dismiss(ACTIVE_REQUEST_TOAST_ID);
            activeToastIdRef.current = null;
            void cancelActiveRequest();
          }}
          onViewDetails={() => {
            setIsLogPanelOpen(true);
            setIsLogPanelPinned(true);
          }}
        />
      ),
      {
        id: ACTIVE_REQUEST_TOAST_ID,
        duration: Number.POSITIVE_INFINITY,
      },
    );

    return () => {
      if (!activeRequest) {
        toast.dismiss(ACTIVE_REQUEST_TOAST_ID);
        activeToastIdRef.current = null;
      }
    };
  }, [activeRequest, cancelActiveRequest]);

  useEffect(() => {
    if (!errorMessage) {
      lastErrorMessageRef.current = null;
      toast.dismiss(ERROR_REQUEST_TOAST_ID);
      return;
    }

    if (lastErrorMessageRef.current === errorMessage) {
      return;
    }

    lastErrorMessageRef.current = errorMessage;

    toast.custom(
      () => (
        <RequestErrorToast
          message={errorMessage}
          retryLabel={retryActionLabel ?? undefined}
          title="Nao foi possivel concluir a solicitacao"
          onRetry={
            canRetryLastAction
              ? () => {
                  toast.dismiss(ERROR_REQUEST_TOAST_ID);
                  void retryLastAction();
                }
              : undefined
          }
        />
      ),
      {
        id: ERROR_REQUEST_TOAST_ID,
        duration: 12_000,
      },
    );
  }, [canRetryLastAction, errorMessage, retryActionLabel, retryLastAction]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      const nextFlowPanelPinned =
        window.localStorage.getItem(FLOW_PANEL_PINNED_STORAGE_KEY) !== "false";
      const nextLogPanelOpen =
        window.localStorage.getItem(LOG_PANEL_OPEN_STORAGE_KEY) === "true";
      const nextLogPanelPinned =
        window.localStorage.getItem(LOG_PANEL_PINNED_STORAGE_KEY) === "true";

      setIsFlowPanelPinned((currentValue) =>
        currentValue === nextFlowPanelPinned ? currentValue : nextFlowPanelPinned,
      );
      setIsLogPanelOpen((currentValue) =>
        currentValue === nextLogPanelOpen ? currentValue : nextLogPanelOpen,
      );
      setIsLogPanelPinned((currentValue) =>
        currentValue === nextLogPanelPinned ? currentValue : nextLogPanelPinned,
      );
      hasLoadedPreferencesRef.current = true;
    });

    return () => window.cancelAnimationFrame(frameId);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !hasLoadedPreferencesRef.current) {
      return;
    }

    window.localStorage.setItem(
      FLOW_PANEL_PINNED_STORAGE_KEY,
      String(isFlowPanelPinned),
    );
  }, [isFlowPanelPinned]);

  useEffect(() => {
    if (typeof window === "undefined" || !hasLoadedPreferencesRef.current) {
      return;
    }

    window.localStorage.setItem(LOG_PANEL_OPEN_STORAGE_KEY, String(isLogPanelOpen));
  }, [isLogPanelOpen]);

  useEffect(() => {
    if (typeof window === "undefined" || !hasLoadedPreferencesRef.current) {
      return;
    }

    window.localStorage.setItem(LOG_PANEL_PINNED_STORAGE_KEY, String(isLogPanelPinned));
  }, [isLogPanelPinned]);

  return (
    <main className="relative overflow-x-clip px-3 py-5 pb-[calc(7.5rem+env(safe-area-inset-bottom))] sm:px-5 sm:py-8 sm:pb-8 lg:px-8 lg:py-10">
      <div className="absolute inset-x-0 top-0 -z-10 h-[420px] bg-[radial-gradient(circle_at_top_left,_rgba(13,148,136,0.24),_transparent_38%),radial-gradient(circle_at_top_right,_rgba(249,115,22,0.18),_transparent_34%),linear-gradient(180deg,_rgba(255,251,235,0.95),_rgba(248,250,252,0.96)_40%,_rgba(240,253,250,0.92)_100%)]" />
      <div className="absolute inset-x-0 top-24 -z-10 h-[720px] bg-[linear-gradient(180deg,rgba(255,255,255,0)_0%,rgba(255,255,255,0.32)_24%,rgba(255,255,255,0)_100%)]" />
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-5 sm:gap-6 lg:gap-8">
        <div className="relative overflow-hidden rounded-[32px] border border-white/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.94),rgba(240,253,250,0.88))] p-5 shadow-[0_28px_100px_-52px_rgba(15,23,42,0.55)] backdrop-blur sm:p-7 lg:p-8">
          <div className="absolute -right-14 top-0 h-40 w-40 rounded-full bg-teal-200/40 blur-3xl" />
          <div className="absolute bottom-0 left-0 h-36 w-36 rounded-full bg-amber-200/40 blur-3xl" />
          <div className="relative space-y-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-3xl space-y-3">
                <div className="inline-flex w-fit items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-teal-800">
                  Consulta de curriculos Lattes
                </div>
                <h2 className="text-balance text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl lg:text-[3.1rem] lg:leading-[1.02]">
                  Pesquisar, processar e revisar.
                </h2>
              </div>

              <div className="flex items-center gap-2 self-start">
                <div className="rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm">
                  {activeFlowLabel}
                </div>
                <InfoDialogButton
                  description="Esta tela foi reduzida ao minimo necessario. Os detalhes de operacao ficam aqui para consulta sob demanda."
                  items={[
                    "Escolha busca individual para validar uma pessoa por vez.",
                    "Use CSV quando quiser processar listas maiores com menos interacao manual.",
                    "As etapas aparecem aos poucos conforme voce avanca no fluxo.",
                    "Resultados, resumo e logs continuam disponiveis nas seções abaixo.",
                  ]}
                  title="Workspace Lattes"
                />
              </div>
            </div>

            <div className="space-y-4 rounded-[28px] border border-white/80 bg-white/72 p-4 shadow-[0_18px_50px_-36px_rgba(15,23,42,0.35)] backdrop-blur sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                  Passo a passo
                </p>
                <div className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
                  Etapa {currentStepIndex + 1} de {flowSteps.length}
                </div>
              </div>

              <div className="space-y-4">
                <div className="relative h-2 overflow-hidden rounded-full bg-slate-200/80">
                  <motion.div
                    animate={{ width: `${((currentStepIndex + 1) / flowSteps.length) * 100}%` }}
                    className="h-full rounded-full bg-[linear-gradient(90deg,#0f766e,#14b8a6,#f59e0b)]"
                    initial={false}
                    transition={{ duration: 0.35, ease: "easeOut" }}
                  />
                </div>

                <div className="grid gap-3 lg:grid-cols-3">
                  <AnimatePresence initial={false} mode="popLayout">
                    {flowSteps.slice(0, visibleStepCount).map((step, index) => (
                      <StepProgressCard
                        key={step.title}
                        index={index}
                        isActive={index === currentStepIndex}
                        isComplete={index < currentStepIndex}
                        title={step.title}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div
          className={cn(
            "z-20 rounded-[28px] border border-white/70 bg-white/80 p-3 shadow-[0_20px_60px_-42px_rgba(15,23,42,0.45)] backdrop-blur sm:p-4",
            isFlowPanelPinned ? "sticky top-3 sm:top-4" : "relative",
          )}
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start justify-between gap-3 lg:flex-1">
              <div className="flex items-center gap-2">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                  Escolha o fluxo
                </p>
                <InfoDialogButton
                  description={mode === "individual"
                    ? "Use este fluxo quando precisar validar uma pessoa especifica antes de gerar os arquivos."
                    : "Use este fluxo quando a lista ja estiver pronta em CSV e a prioridade for produtividade."}
                  items={mode === "individual"
                    ? [
                        "Busque o nome.",
                        "Selecione a pessoa correta.",
                        "Gere os arquivos e, se quiser, o resumo com IA.",
                      ]
                    : [
                        "Envie o CSV com os nomes.",
                        "Acompanhe o processamento em lote.",
                        "Revise resultados e logs ao final.",
                      ]}
                  title="Sobre este fluxo"
                />
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    aria-label={isFlowPanelPinned ? "Desafixar seletor de fluxo" : "Fixar seletor de fluxo"}
                    aria-pressed={isFlowPanelPinned}
                    className={cn(
                      "h-11 w-11 shrink-0 rounded-2xl border px-0 shadow-sm",
                      isFlowPanelPinned
                        ? "border-teal-200 bg-teal-50 text-teal-800 hover:bg-teal-100"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                    )}
                    onClick={() => setIsFlowPanelPinned((currentValue) => !currentValue)}
                    type="button"
                    variant="outline"
                  >
                    {isFlowPanelPinned ? (
                      <Pin className="h-4.5 w-4.5" />
                    ) : (
                      <PinOff className="h-4.5 w-4.5" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  {isFlowPanelPinned
                    ? "Painel fixado durante a rolagem. Clique para soltar."
                    : "Painel solto no fluxo da pagina. Clique para fixar."}
                </TooltipContent>
              </Tooltip>
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
                <span className="flex items-center gap-3">
                  <Search className="h-4 w-4 shrink-0" />
                  <span className="block text-sm font-semibold">Buscar uma pessoa</span>
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
                <span className="flex items-center gap-3">
                  <FileSpreadsheet className="h-4 w-4 shrink-0" />
                  <span className="block text-sm font-semibold">Enviar lista em CSV</span>
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
              disabled={!canShowLogPanel}
              label="Abrir logs"
              onClick={() => setIsLogPanelOpen(true)}
            />
          </div>
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

        <div className="space-y-6">
          <div
            ref={formSectionRef}
            className="rounded-[30px] border border-white/70 bg-white/84 p-4 shadow-[0_24px_80px_-50px_rgba(15,23,42,0.5)] backdrop-blur sm:p-5"
          >
            <SectionBlockHeader
              eyebrow="Etapa 1"
              title={mode === "individual" ? "Pesquise e selecione a pessoa" : "Envie e configure o arquivo CSV"}
              infoDescription={mode === "individual"
                ? "Nesta etapa voce busca um nome, revisa as correspondencias e escolhe a pessoa correta antes de gerar os arquivos."
                : "Nesta etapa voce envia o CSV, ajusta limites opcionais e define o formato de saida do processamento em lote."}
              infoTitle="Detalhes da etapa 1"
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

          {showResultsSection ? (
            <div
              ref={resultsRef}
              className="rounded-[30px] border border-white/70 bg-white/84 p-4 shadow-[0_24px_80px_-50px_rgba(15,23,42,0.5)] backdrop-blur sm:p-5"
            >
              <SectionBlockHeader
                eyebrow="Etapa 2"
                title="Resultados principais"
                infoDescription="Esta area concentra os arquivos gerados e o retorno principal do processamento assim que a execucao termina."
                infoTitle="Detalhes da etapa 2"
              />
              <div className="mt-4 space-y-6">
                {scrapeResult ? <ScrapeResultCard result={scrapeResult} /> : null}
                {batchResult ? <BatchResultCard result={batchResult} /> : null}
              </div>
            </div>
          ) : null}

          {showSummarySection ? (
            <div className="rounded-[30px] border border-white/70 bg-white/84 p-4 shadow-[0_24px_80px_-50px_rgba(15,23,42,0.5)] backdrop-blur sm:p-5">
              <SectionBlockHeader
                eyebrow="Etapa 3"
                title="Resumo"
                infoDescription="Use esta etapa para gerar um resumo com IA depois que o curriculo estiver pronto."
                infoTitle="Detalhes da etapa 3"
              />
              <div className="mt-4 space-y-6">
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
                {summaryResult ? (
                  <div ref={summaryResultRef} className="scroll-mt-32 sm:scroll-mt-36 lg:scroll-mt-40">
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
              </div>
            </div>
          ) : null}
        </div>
      </section>
      <FloatingExecutionPanel
        isAvailable={canShowLogPanel}
        isOpen={isLogPanelVisible}
        isPinned={isLogPanelPinned}
        isProcessing={isInteractionLocked}
        logs={activeLogs}
        onOpenChange={setIsLogPanelOpen}
        onPinnedChange={setIsLogPanelPinned}
      />
      <MobileBottomBar
        hasLogs={canShowLogPanel}
        hasMainResult={hasMainResult}
        hasSummaryResult={hasSummaryResult}
        isInteractionLocked={isInteractionLocked}
        onGoToForm={() => scrollToSection(formSectionRef.current)}
        onGoToLogs={() => setIsLogPanelOpen(true)}
        onGoToResults={() => scrollToSection(resultsRef.current)}
        onGoToSummary={() => scrollToSection(summaryResultRef.current)}
      />
    </main>
  );
}

function scrollToSection(element: HTMLElement | null) {
  if (!element) {
    return;
  }

  requestAnimationFrame(() => {
    const isMobile = window.innerWidth < 640;
    const isTablet = window.innerWidth < 1024;
    const topOffset = isMobile ? 144 : isTablet ? 132 : 116;
    const targetTop = window.scrollY + element.getBoundingClientRect().top - topOffset;

    window.scrollTo({
      top: Math.max(0, targetTop),
      behavior: "smooth",
    });
  });
}

function StepProgressCard({
  index,
  isActive,
  isComplete,
  title,
}: {
  index: number;
  isActive: boolean;
  isComplete: boolean;
  title: string;
}) {
  return (
    <motion.div
      animate={{
        opacity: isActive || isComplete ? 1 : 0.72,
        scale: isActive ? 1 : 0.985,
        y: isActive ? -2 : 0,
      }}
      exit={{ opacity: 0, scale: 0.96, y: 8 }}
      className={cn(
        "rounded-[24px] border p-4 transition-colors",
        isActive
          ? "border-teal-300 bg-teal-50/90 shadow-[0_18px_44px_-34px_rgba(13,148,136,0.45)]"
          : isComplete
            ? "border-emerald-200 bg-emerald-50/85"
            : "border-slate-200/80 bg-white/82",
      )}
      initial={{ opacity: 0, scale: 0.96, y: 8 }}
      layout
      transition={{ duration: 0.25, ease: "easeOut" }}
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-sm font-semibold",
            isActive
              ? "bg-slate-900 text-white"
              : isComplete
                ? "bg-emerald-600 text-white"
                : "bg-slate-100 text-slate-600",
          )}
        >
          {String(index + 1).padStart(2, "0")}
        </div>
        <p className="font-semibold text-slate-950">{title}</p>
      </div>
    </motion.div>
  );
}

function InfoDialogButton({
  description,
  items,
  title,
}: {
  description: string;
  items: string[];
  title: string;
}) {
  return (
    <Dialog>
      <Tooltip>
        <TooltipTrigger asChild>
          <DialogTrigger asChild>
            <Button
              aria-label="Ver informacoes do Workspace Lattes"
              className="h-11 w-11 rounded-full border-slate-200 bg-white/90 px-0 text-slate-700 shadow-sm hover:bg-white"
              type="button"
              variant="outline"
            >
              <Info className="h-4 w-4" />
            </Button>
          </DialogTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">Informacoes desta tela</TooltipContent>
      </Tooltip>
      <DialogContent className="w-[min(92vw,640px)] max-w-[640px] p-0">
        <div className="space-y-5 p-6 sm:p-7">
          <DialogHeader className="space-y-3">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-teal-800">
              <CircleHelp className="h-3.5 w-3.5" />
              Mais informacoes
            </div>
            <div className="space-y-2">
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription>{description}</DialogDescription>
            </div>
          </DialogHeader>

          <div className="grid gap-3">
            {items.map((item, index) => (
              <InfoCard key={item} description={item} title={`${index + 1}.`} />
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function InfoCard({
  description,
  title,
}: {
  description: string;
  title: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4">
      <p className="text-sm font-semibold text-slate-950">{title}</p>
      <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p>
    </div>
  );
}

function SectionBlockHeader({
  eyebrow,
  infoDescription,
  infoTitle,
  title,
}: {
  eyebrow: string;
  infoDescription: string;
  infoTitle: string;
  title: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
          {eyebrow}
        </p>
        <InfoDialogButton
          description={infoDescription}
          items={[infoDescription]}
          title={infoTitle}
        />
      </div>
      <div className="flex items-center gap-3">
        <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-sm">
          {eyebrow === "Etapa 1" ? (
            <Search className="h-4 w-4" />
          ) : eyebrow === "Etapa 2" ? (
            <FileCheck2 className="h-4 w-4" />
          ) : (
            <BrainCircuit className="h-4 w-4" />
          )}
        </div>
        <h3 className="text-xl font-semibold text-slate-950">{title}</h3>
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

function FloatingExecutionPanel({
  isAvailable,
  isOpen,
  isPinned,
  isProcessing,
  logs,
  onOpenChange,
  onPinnedChange,
}: {
  isAvailable: boolean;
  isOpen: boolean;
  isPinned: boolean;
  isProcessing: boolean;
  logs: string[];
  onOpenChange: (nextValue: boolean) => void;
  onPinnedChange: (nextValue: boolean) => void;
}) {
  return (
    <div className="pointer-events-none fixed bottom-[calc(5.75rem+env(safe-area-inset-bottom))] right-3 z-40 lg:bottom-6 lg:right-6">
      <div className="flex flex-col items-end gap-3">
        <AnimatePresence>
          {isOpen && isAvailable ? (
            <motion.div
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className="pointer-events-auto w-[min(92vw,420px)]"
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              <div className="rounded-[28px] border border-slate-200/80 bg-white/96 p-3 shadow-[0_28px_70px_-28px_rgba(15,23,42,0.45)] backdrop-blur-xl">
                <div className="mb-3 flex items-center justify-between gap-3 px-1">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                      Execucao
                    </p>
                    <p className="text-sm font-semibold text-slate-950">
                      {isProcessing ? "Acompanhamento ao vivo" : "Ultimos registros"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          aria-label={isPinned ? "Desafixar painel de execucao" : "Fixar painel de execucao"}
                          className={cn(
                            "h-10 w-10 rounded-2xl px-0",
                            isPinned
                              ? "border-teal-200 bg-teal-50 text-teal-800 hover:bg-teal-100"
                              : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                          )}
                          type="button"
                          variant="outline"
                          onClick={() => onPinnedChange(!isPinned)}
                        >
                          {isPinned ? <Pin className="h-4 w-4" /> : <PinOff className="h-4 w-4" />}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        {isPinned ? "Painel fixado" : "Fixar painel"}
                      </TooltipContent>
                    </Tooltip>
                    {!isPinned ? (
                      <Button
                        aria-label="Fechar painel de execucao"
                        className="h-10 rounded-2xl border-slate-200 bg-white px-3 text-slate-700 hover:bg-slate-50"
                        type="button"
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                      >
                        Fechar
                      </Button>
                    ) : null}
                  </div>
                </div>
                <ExecutionLogCard isProcessing={isProcessing} logs={logs} variant="floating" />
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <Button
          className="pointer-events-auto h-12 rounded-full border-slate-200 bg-white/96 px-4 text-slate-900 shadow-[0_18px_48px_-28px_rgba(15,23,42,0.45)] hover:bg-white"
          disabled={!isAvailable}
          type="button"
          variant="outline"
          onClick={() => {
            if (isPinned && isOpen) {
              onPinnedChange(false);
              onOpenChange(false);
              return;
            }

            onOpenChange(!isOpen);
          }}
        >
          <TerminalSquare className="h-4 w-4" />
          {isProcessing ? "Acompanhar execucao" : "Detalhes da execucao"}
        </Button>
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
            disabled={!hasLogs}
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