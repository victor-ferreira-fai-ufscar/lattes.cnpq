"use client";

import { AlertCircle, CheckCircle2, Layers3 } from "lucide-react";

import { SectionHeading } from "@/components/shared/section-heading";
import { Button } from "@/components/ui/button";
import { BatchUploadPanel } from "@/features/lattes/components/batch-upload-panel";
import { BatchResultCard } from "@/features/lattes/components/batch-result-card";
import { ExecutionLogCard } from "@/features/lattes/components/execution-log-card";
import { IndividualSearchPanel } from "@/features/lattes/components/individual-search-panel";
import { ScrapeResultCard } from "@/features/lattes/components/scrape-result-card";
import { SummaryPanel } from "@/features/lattes/components/summary-panel";
import { SummaryResultCard } from "@/features/lattes/components/summary-result-card";
import { useLattesWorkbench } from "@/features/lattes/hooks/use-lattes-workbench";
import { cn } from "@/lib/utils";

export function LattesWorkbench() {
  const {
    mode,
    loading,
    errorMessage,
    statusMessage,
    lastSearchTerm,
    candidates,
    selectedCandidate,
    scrapeResult,
    batchResult,
    summaryResult,
    availableModels,
    summaryConfig,
    handleModeChange,
    searchCandidates,
    setSelectedCandidate,
    scrapeSelected,
    submitBatch,
    loadModels,
    summarize,
    activeLogs,
  } = useLattesWorkbench();

  return (
    <main className="relative overflow-hidden px-4 py-12 sm:px-6 lg:px-8">
      <div className="absolute inset-x-0 top-0 -z-10 h-[480px] bg-[radial-gradient(circle_at_top_left,_rgba(20,184,166,0.18),_transparent_38%),radial-gradient(circle_at_top_right,_rgba(245,158,11,0.14),_transparent_35%),linear-gradient(180deg,_rgba(248,250,252,1),_rgba(241,245,249,0.82))]" />
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)] lg:items-end">
          <SectionHeading
            eyebrow="Frontend modular"
            title="Arquitetura por feature para o fluxo de currículos Lattes"
            description="A home agora é apenas composição. Busca, lote, resumo e serviços ficam agrupados em um módulo coeso, com responsabilidade clara e sem imports órfãos espalhados pela aplicação."
          />

          <div className="rounded-3xl border border-white/60 bg-white/80 p-5 shadow-[0_24px_80px_-48px_rgba(15,23,42,0.45)] backdrop-blur">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <Layers3 className="h-4 w-4 text-teal-700" />
              Organização aplicada
            </div>
            <div className="mt-4 grid gap-3 text-sm text-slate-600">
              <p>app/: roteamento e composição da página.</p>
              <p>features/lattes/: serviços, schemas, hook de orquestração e componentes do domínio.</p>
              <p>components/shared/: blocos reaproveitáveis de apresentação.</p>
              <p>lib/: configuração de infraestrutura compartilhada, limitada ao cliente HTTP.</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button
            className={cn(
              "min-w-36 rounded-full",
              mode === "individual" ? "shadow-md" : "bg-white text-slate-900",
            )}
            onClick={() => handleModeChange("individual")}
            type="button"
            variant={mode === "individual" ? "default" : "outline"}
          >
            Fluxo individual
          </Button>
          <Button
            className={cn(
              "min-w-36 rounded-full",
              mode === "lote" ? "shadow-md" : "bg-white text-slate-900",
            )}
            onClick={() => handleModeChange("lote")}
            type="button"
            variant={mode === "lote" ? "default" : "outline"}
          >
            Fluxo em lote
          </Button>
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

        {mode === "individual" ? (
          <IndividualSearchPanel
            candidates={candidates}
            isScraping={loading.scrape}
            isSearching={loading.search}
            lastSearchTerm={lastSearchTerm}
            selectedCandidate={selectedCandidate}
            onScrape={scrapeSelected}
            onSearch={searchCandidates}
            onSelectCandidate={setSelectedCandidate}
          />
        ) : (
          <BatchUploadPanel
            isSubmitting={loading.batch}
            onSubmitBatch={submitBatch}
          />
        )}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.9fr)]">
          <div className="space-y-6">
            {scrapeResult ? <ScrapeResultCard result={scrapeResult} /> : null}
            {batchResult ? <BatchResultCard result={batchResult} /> : null}
            {summaryResult ? <SummaryResultCard result={summaryResult} /> : null}
          </div>

          <div className="space-y-6">
            {scrapeResult ? (
              <SummaryPanel
                defaultValues={summaryConfig}
                isLoadingModels={loading.models}
                isSubmitting={loading.summarize}
                models={availableModels}
                onLoadModels={loadModels}
                onSubmitSummary={async (values) => {
                  await summarize(values);
                }}
              />
            ) : null}
            <ExecutionLogCard logs={activeLogs} />
          </div>
        </div>
      </section>
    </main>
  );
}