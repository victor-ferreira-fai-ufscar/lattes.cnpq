/**
 * Testes e2e do fluxo de busca individual e exibição do CurriculoDiffCard.
 *
 * Estratégia:
 *   - Mocka GET /events/requests/** (SSE do monitor de requests)
 *   - Mocka POST /search         (candidatos)
 *   - Mocka POST /scrape         (resultado com histórico e diff)
 *
 * Cenários:
 *   1. CV atualizado   → diff card com "+N linhas" / "−N linha" visível
 *   2. Expande diff    → "Ver diferenças linha a linha" abre o viewer
 *   3. CV inalterado   → "Sem alterações detectadas"
 *   4. Primeira visita → "Primeira versão registrada"
 */

import { expect, test } from "@playwright/test";

// ---------------------------------------------------------------------------
// Fixtures compartilhadas
// ---------------------------------------------------------------------------

const CANDIDATOS = {
  nome_busca: "Victor Ferreira",
  total: 1,
  candidatos: [{ nome: "Victor Ferreira", href: "http://lattes.cnpq.br/0000000001" }],
  logs: [],
  duracao_segundos: 0.3,
};

const BASE_SCRAPE = {
  nome: "Victor Ferreira",
  cache_status: "hit",
  artifacts_cache_status: "hit",
  cache_last_modified: "2026-04-13T15:30:00+00:00",
  ultima_atualizacao_curriculo: "2026-04-13",
  arquivo_pdf: "victor-ferreira-2026-04-13.pdf",
  storage_path: "raw/victor-ferreira-2026-04-13.pdf",
  download_pdf_url: "https://example.com/victor-ferreira-2026-04-13.pdf",
  output_format: "pdf",
  output_directory:
    "structured/outputs/v2/curriculos/victor-ferreira/2026-04-13",
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
  artifacts_cache_status_label: "hit",
  extracted_text_length: 5000,
  template_name: null,
  zip_arquivo: null,
  zip_storage_path: null,
  zip_download_url: null,
  duracao_segundos: 2.5,
};

const VERSAO_PRIMEIRA = {
  arquivo_pdf: "victor-ferreira-2026-03-10.pdf",
  storage_path: "raw/victor-ferreira-2026-03-10.pdf",
  download_pdf_url: "https://example.com/victor-ferreira-2026-03-10.pdf",
  ultima_atualizacao_curriculo: "2026-03-10",
  cache_last_modified: "2026-03-10T10:00:00+00:00",
};

const VERSAO_ULTIMA = {
  arquivo_pdf: "victor-ferreira-2026-04-13.pdf",
  storage_path: "raw/victor-ferreira-2026-04-13.pdf",
  download_pdf_url: "https://example.com/victor-ferreira-2026-04-13.pdf",
  ultima_atualizacao_curriculo: "2026-04-13",
  cache_last_modified: "2026-04-13T15:30:00+00:00",
};

// Unified diff com 3 adições e 1 remoção
const DIFF_COM_ALTERACOES = {
  has_changes: true,
  added_lines: 3,
  removed_lines: 1,
  diff_preview: [
    "--- primeira-versao",
    "+++ ultima-versao",
    "@@ -4,4 +4,6 @@",
    " Publicações",
    "+2026 - Novo Artigo Z — IEEE",
    "+2025 - Artigo Y — Springer",
    "+2025 - Artigo X — ACM",
    " 2024 - Artigo A — Revista X",
    "-2023 - Artigo B (versão antiga)",
  ].join("\n"),
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sseBody(
  events: Array<{ event: string; data: Record<string, unknown> }>,
) {
  return events
    .map(({ event, data }) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
    .join("");
}

async function setupCommonRoutes(
  page: import("@playwright/test").Page,
  scrapeOverrides: Record<string, unknown> = {},
) {
  // SSE monitor — responde imediatamente com start + end
  await page.route("**/events/requests/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      headers: { "Cache-Control": "no-cache", Connection: "keep-alive" },
      body: sseBody([
        { event: "start", data: { operation: "scrape", title: "Preparando" } },
        { event: "log", data: { message: "[12:00:01] Cache HIT." } },
        { event: "end", data: {} },
      ]),
    });
  });

  await page.route("**/search", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(CANDIDATOS),
    });
  });

  // Evita vazar para batch
  await page.route("**/scrape", async (route) => {
    if (route.request().url().includes("batch")) {
      return route.continue();
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ...BASE_SCRAPE, ...scrapeOverrides }),
    });
  });
}

/** Executa o fluxo completo de busca → seleção → scrape. */
async function runSearchAndScrape(page: import("@playwright/test").Page) {
  await page.goto("/");
  // Cancela qualquer toast ativo de requisição anterior (cold start)
  await page.evaluate(() => localStorage.clear());
  await page.goto("/");

  await page.getByLabel("Nome da pessoa").fill("Victor Ferreira");
  await page.getByRole("button", { name: /^Buscar$/ }).click();

  // Aguarda candidato aparecer e clica nele
  await expect(
    page.getByRole("button", { name: "Victor Ferreira" }).first(),
  ).toBeVisible({ timeout: 5000 });
  await page.getByRole("button", { name: "Victor Ferreira" }).first().click();

  await page.getByRole("button", { name: /Preparar arquivos do currículo/ }).click();
  await expect(page.getByText("Currículo pronto para uso")).toBeVisible({
    timeout: 10000,
  });
}

// ---------------------------------------------------------------------------
// Testes
// ---------------------------------------------------------------------------

test("exibe diff card com histórico e alterações detectadas", async ({ page }) => {
  await setupCommonRoutes(page, {
    cache_historico_total_versoes: 2,
    cache_historico_primeira_versao: VERSAO_PRIMEIRA,
    cache_historico_ultima_versao: VERSAO_ULTIMA,
    cache_historico_diff: DIFF_COM_ALTERACOES,
  });

  await runSearchAndScrape(page);

  // Cabeçalho e contador de versões
  await expect(page.getByText("Histórico de versões")).toBeVisible();
  await expect(page.getByText("2 versões salvas")).toBeVisible();

  // Datas das versões como chips
  await expect(page.getByText("2026-03-10").first()).toBeVisible();
  await expect(page.getByText("2026-04-13").first()).toBeVisible();

  // Badges de alteração
  await expect(page.getByText("+3 linhas")).toBeVisible();
  await expect(page.getByText(/−1 linha/)).toBeVisible();
});

test("expande o diff ao clicar em 'Ver diferenças linha a linha'", async ({ page }) => {
  await setupCommonRoutes(page, {
    cache_historico_total_versoes: 2,
    cache_historico_primeira_versao: VERSAO_PRIMEIRA,
    cache_historico_ultima_versao: VERSAO_ULTIMA,
    cache_historico_diff: DIFF_COM_ALTERACOES,
  });

  await runSearchAndScrape(page);

  // Clica no summary para expandir
  const summary = page.getByText("Ver diferenças linha a linha");
  await expect(summary).toBeVisible();
  await summary.click();

  // Verifica que o conteúdo do diff aparece (linha adicionada)
  await expect(page.getByText("2026 - Novo Artigo Z — IEEE")).toBeVisible();
  await expect(page.getByText("2025 - Artigo Y — Springer")).toBeVisible();

  // Verifica contagem de linhas alteradas no summary
  await expect(page.getByText("4 linhas alteradas")).toBeVisible();
});

test("exibe 'Sem alterações detectadas' quando diff não tem mudanças", async ({ page }) => {
  await setupCommonRoutes(page, {
    cache_historico_total_versoes: 2,
    cache_historico_primeira_versao: VERSAO_PRIMEIRA,
    cache_historico_ultima_versao: VERSAO_ULTIMA,
    cache_historico_diff: {
      has_changes: false,
      added_lines: 0,
      removed_lines: 0,
      diff_preview: "",
    },
  });

  await runSearchAndScrape(page);

  await expect(page.getByText("Histórico de versões")).toBeVisible();
  await expect(page.getByText("2 versões salvas")).toBeVisible();
  await expect(page.getByText("✓ Sem alterações detectadas")).toBeVisible();

  // Não deve mostrar badges de adição/remoção
  await expect(page.getByText(/\+\d+ linha/)).not.toBeVisible();
});

test("exibe 'Primeira versão registrada' quando só existe um CV no histórico", async ({ page }) => {
  await setupCommonRoutes(page, {
    cache_historico_total_versoes: 1,
    cache_historico_primeira_versao: VERSAO_ULTIMA,
    cache_historico_ultima_versao: VERSAO_ULTIMA,
    cache_historico_diff: null,
  });

  await runSearchAndScrape(page);

  await expect(page.getByText("Histórico de versões")).toBeVisible();
  await expect(page.getByText("1 versão salva")).toBeVisible();
  await expect(page.getByText("Primeira versão registrada")).toBeVisible();

  // Não deve mostrar seta entre versões nem badges
  await expect(page.getByText("+")).not.toBeVisible();
});

test("não exibe diff card quando payload não inclui histórico", async ({ page }) => {
  await setupCommonRoutes(page);
  // BASE_SCRAPE não tem cache_historico_total_versoes → componente não renderiza

  await runSearchAndScrape(page);

  await expect(page.getByText("Currículo pronto para uso")).toBeVisible();
  await expect(page.getByText("Histórico de versões")).not.toBeVisible();
});
