"use client";

/**
 * Página de preview/teste visual do CurriculoDiffCard.
 *
 * Acesse em: http://localhost:3000/test-diff
 *
 * Cobre todos os 4 cenários possíveis:
 *   1. Nenhuma versão no histórico
 *   2. Apenas uma versão (primeira consulta)
 *   3. Duas versões sem alterações detectadas
 *   4. Duas versões COM alterações (exibe o diff linha a linha)
 */

import { CurriculoDiffCard } from "@/features/lattes/components/curriculo-diff-card";
import { ScrapeResultCard } from "@/features/lattes/components/scrape-result-card";
import type { ScrapeResponse } from "@/features/lattes/services/lattes.service";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const VERSAO_2026_03_10 = {
  arquivo_pdf: "victor-ferreira-2026-03-10.pdf",
  storage_path: "raw/victor-ferreira-2026-03-10.pdf",
  download_pdf_url: "https://example.com/victor-ferreira-2026-03-10.pdf",
  ultima_atualizacao_curriculo: "2026-03-10",
  cache_last_modified: "2026-03-10T10:00:00+00:00",
};

const VERSAO_2026_04_13 = {
  arquivo_pdf: "victor-ferreira-2026-04-13.pdf",
  storage_path: "raw/victor-ferreira-2026-04-13.pdf",
  download_pdf_url: "https://example.com/victor-ferreira-2026-04-13.pdf",
  ultima_atualizacao_curriculo: "2026-04-13",
  cache_last_modified: "2026-04-13T15:30:00+00:00",
};

const DIFF_COM_ALTERACOES = {
  has_changes: true,
  added_lines: 4,
  removed_lines: 1,
  diff_preview: [
    "--- primeira-versao",
    "+++ ultima-versao",
    "@@ -3,6 +3,9 @@",
    " Identificação",
    " Victor Ferreira",
    " Publicações",
    "+2026 - Novo Artigo Z — IEEE Transactions on Neural Networks",
    "+2025 - Artigo Y — Springer LNCS",
    "+2025 - Artigo X — ACM Digital Library",
    " 2024 - Artigo A — Revista X",
    "-2023 - Artigo B (versão antiga)",
    "+2023 - Artigo B — Revista Y",
  ].join("\n"),
};

const DIFF_SEM_ALTERACOES = {
  has_changes: false,
  added_lines: 0,
  removed_lines: 0,
  diff_preview: "",
};

const BASE_SCRAPE: Omit<ScrapeResponse, "cache_historico_total_versoes" | "cache_historico_primeira_versao" | "cache_historico_ultima_versao" | "cache_historico_diff"> = {
  nome: "Victor Ferreira",
  cache_status: "hit",
  artifacts_cache_status: "hit",
  cache_last_modified: "2026-04-13T15:30:00+00:00",
  ultima_atualizacao_curriculo: "2026-04-13",
  arquivo_pdf: "victor-ferreira-2026-04-13.pdf",
  storage_path: "raw/victor-ferreira-2026-04-13.pdf",
  download_pdf_url: "https://example.com/victor-ferreira-2026-04-13.pdf",
  output_format: "pdf",
  output_directory: "structured/outputs/v2/curriculos/victor-ferreira/2026-04-13",
  output_label: "victor-ferreira / 2026-04-13",
  generated_files: [
    {
      format: "pdf",
      filename: "victor-ferreira-2026-04-13.pdf",
      relative_path: "victor-ferreira-2026-04-13.pdf",
      download_url: "https://example.com/victor-ferreira-2026-04-13.pdf",
      content_type: "application/pdf",
    },
  ],
  duracao_segundos: 3.14,
};

// ---------------------------------------------------------------------------
// Cenários de diff isolados
// ---------------------------------------------------------------------------

const scenarios: Array<{
  title: string;
  description: string;
  props: React.ComponentProps<typeof CurriculoDiffCard>;
}> = [
  {
    title: "Cenário 1 — Zero versões",
    description: "Sem histórico no cache. O componente não deve renderizar nada.",
    props: {
      totalVersoes: 0,
      primeiraVersao: null,
      ultimaVersao: null,
      diff: null,
    },
  },
  {
    title: "Cenário 2 — Primeira consulta (1 versão)",
    description:
      "Apenas um PDF salvo no cache. Não há versão anterior para comparar.",
    props: {
      totalVersoes: 1,
      primeiraVersao: VERSAO_2026_03_10,
      ultimaVersao: VERSAO_2026_03_10,
      diff: null,
    },
  },
  {
    title: "Cenário 3 — CV inalterado (2 versões, sem alterações)",
    description:
      "2 PDFs em cache mas o texto extraído é idêntico — não houve mudança real no CV.",
    props: {
      totalVersoes: 2,
      primeiraVersao: VERSAO_2026_03_10,
      ultimaVersao: VERSAO_2026_04_13,
      diff: DIFF_SEM_ALTERACOES,
    },
  },
  {
    title: "Cenário 4 — CV atualizado (2 versões, COM alterações)",
    description:
      "Entre 2026-03-10 e 2026-04-13 o docente adicionou 3 publicações e corrigiu 1 linha.",
    props: {
      totalVersoes: 2,
      primeiraVersao: VERSAO_2026_03_10,
      ultimaVersao: VERSAO_2026_04_13,
      diff: DIFF_COM_ALTERACOES,
    },
  },
];

// ---------------------------------------------------------------------------
// ScrapeResultCard integrado com diff (cenário 4)
// ---------------------------------------------------------------------------

const scrapeResultComDiff: ScrapeResponse = {
  ...BASE_SCRAPE,
  cache_historico_total_versoes: 2,
  cache_historico_primeira_versao: VERSAO_2026_03_10,
  cache_historico_ultima_versao: VERSAO_2026_04_13,
  cache_historico_diff: DIFF_COM_ALTERACOES,
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function TestDiffPage() {
  return (
    <div className="min-h-screen bg-[var(--background)] px-4 py-12">
      <div className="mx-auto max-w-3xl space-y-10">
        <header>
          <h1 className="text-2xl font-bold text-slate-900">
            🧪 Teste visual — CurriculoDiffCard
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Preview local de todos os cenários possíveis do componente de
            histórico de versões.
          </p>
        </header>

        {/* Cenários isolados do CurriculoDiffCard */}
        {scenarios.map((s) => (
          <section key={s.title} className="space-y-3">
            <div>
              <h2 className="text-sm font-bold text-slate-800">{s.title}</h2>
              <p className="text-xs text-slate-400">{s.description}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white/60 p-4">
              {s.props.totalVersoes === 0 ? (
                <div className="flex h-10 items-center justify-center rounded-xl border border-dashed border-slate-200 text-xs text-slate-400">
                  Componente não renderiza (totalVersoes = 0)
                </div>
              ) : (
                <CurriculoDiffCard {...s.props} />
              )}
            </div>
          </section>
        ))}

        {/* ScrapeResultCard completo com diff embutido */}
        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-bold text-slate-800">
              Cenário 5 — ScrapeResultCard completo com histórico
            </h2>
            <p className="text-xs text-slate-400">
              Como aparece na tela real após um scrape com cache histórico.
            </p>
          </div>
          <ScrapeResultCard result={scrapeResultComDiff} />
        </section>
      </div>
    </div>
  );
}
