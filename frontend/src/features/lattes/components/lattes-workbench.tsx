"use client";

import {
  AlertCircle,
  CheckCircle2,
  FileSpreadsheet,
  Search,
  Sparkles,
} from "lucide-react";

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
    storedApiKeys,
    summaryConfig,
    handleModeChange,
    searchCandidates,
    setSelectedCandidate,
    scrapeSelected,
    submitBatch,
    updateSummaryConfig,
    loadModels,
    summarize,
    activeLogs,
  } = useLattesWorkbench();

  return (
    <main className="relative overflow-hidden px-4 py-12 sm:px-6 lg:px-8">
      <div className="absolute inset-x-0 top-0 -z-10 h-[520px] bg-[radial-gradient(circle_at_top_left,_rgba(13,148,136,0.18),_transparent_36%),radial-gradient(circle_at_top_right,_rgba(249,115,22,0.14),_transparent_33%),linear-gradient(180deg,_rgba(255,251,235,0.85),_rgba(248,250,252,0.92)_42%,_rgba(240,253,250,0.88)_100%)]" />
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)] lg:items-end">
          <SectionHeading
            eyebrow="Consulta de currículos Lattes"
            title="Encontre, organize e leia currículos com menos esforço"
            description="Busque uma pessoa por nome ou envie uma lista em CSV. A ferramenta prepara os currículos para leitura e, se você quiser, também gera um resumo em linguagem mais direta."
          />

          <div className="rounded-3xl border border-white/60 bg-white/80 p-5 shadow-[0_24px_80px_-48px_rgba(15,23,42,0.45)] backdrop-blur">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <Sparkles className="h-4 w-4 text-teal-700" />
              Como funciona
            </div>
            <div className="mt-4 grid gap-3 text-sm text-slate-600">
              <div className="rounded-2xl bg-amber-50/80 p-3">
                <p className="font-semibold text-slate-900">1. Escolha o tipo de busca</p>
                <p>Use a busca por nome para uma pessoa ou envie uma lista em CSV para várias pessoas.</p>
              </div>
              <div className="rounded-2xl bg-teal-50/80 p-3">
                <p className="font-semibold text-slate-900">2. Confira o resultado</p>
                <p>Você verá o currículo preparado em PDF e as informações principais logo abaixo.</p>
              </div>
              <div className="rounded-2xl bg-cyan-50/80 p-3">
                <p className="font-semibold text-slate-900">3. Gere um resumo se precisar</p>
                <p>O resumo por IA é opcional e pode ajudar em leituras rápidas ou triagens.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button
            className={cn(
              "min-w-44 rounded-full",
              mode === "individual" ? "shadow-md" : "bg-white text-slate-900",
            )}
            onClick={() => handleModeChange("individual")}
            type="button"
            variant={mode === "individual" ? "default" : "outline"}
          >
            <Search className="h-4 w-4" />
            Buscar uma pessoa
          </Button>
          <Button
            className={cn(
              "min-w-44 rounded-full",
              mode === "lote" ? "shadow-md" : "bg-white text-slate-900",
            )}
            onClick={() => handleModeChange("lote")}
            type="button"
            variant={mode === "lote" ? "default" : "outline"}
          >
            <FileSpreadsheet className="h-4 w-4" />
            Enviar lista em CSV
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
            ) : null}
            <ExecutionLogCard logs={activeLogs} />
          </div>
        </div>
      </section>
    </main>
  );
}