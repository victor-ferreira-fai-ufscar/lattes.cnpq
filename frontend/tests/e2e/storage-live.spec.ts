/**
 * Teste e2e AO VIVO contra produção — sem mocks.
 *
 * Os outros specs mockam /search e /scrape, então provam a UI e nada sobre onde
 * os arquivos moram. Este aqui existe para provar o storage: que o Supabase
 * self-hosted está servindo os currículos de verdade, pelo navegador.
 *
 * Só roda com E2E_LIVE=1 (ver playwright.config.ts), porque depende da
 * produção de pé e usa um docente já em cache.
 *
 *   E2E_LIVE=1 pnpm exec playwright test storage-live
 */

import { expect, test } from "@playwright/test";

// Docente já presente no bucket: garante cache hit, sem disparar scrape novo
// na Plataforma Lattes a cada execução do teste.
const DOCENTE = "Ricardo Cerri";
const STORAGE_HOST = "lattes-storage.sup.fai.ufscar.br";

test.describe("storage self-hosted (ao vivo)", () => {
  // Cache hit ainda faz o backend montar os artefatos; 3 min cobre folga.
  test.setTimeout(180_000);

  test("serve o currículo pelo Supabase self-hosted", async ({ page, request }) => {
    await page.goto("/");

    await page.getByLabel("Nome da pessoa").fill(DOCENTE);
    await page.getByRole("button", { name: /^Buscar$/ }).click();

    await expect(page.getByRole("button", { name: new RegExp(DOCENTE, "i") }).first())
      .toBeVisible({ timeout: 60_000 });
    await page.getByRole("button", { name: new RegExp(DOCENTE, "i") }).first().click();

    await page.getByRole("button", { name: /Preparar arquivos do currículo/ }).click();
    await expect(page.getByText("Currículo pronto para uso")).toBeVisible({
      timeout: 150_000,
    });

    // O link tem que apontar pro storage local — não pra supabase.co nem pra
    // localhost (que o navegador do usuário não alcançaria).
    const pdfLink = page.getByRole("link", { name: /PDF/i }).first();
    const href = await pdfLink.getAttribute("href");
    expect(href).toBeTruthy();
    expect(new URL(href!).host).toBe(STORAGE_HOST);

    // A parte que importa: seguir o link e conferir que vem um PDF de verdade.
    // Só checar status 200 não serve — o Caddy responde 200 vazio para host
    // não configurado, então um erro de roteamento passaria despercebido.
    const download = await request.get(href!);
    expect(download.status()).toBe(200);
    expect(download.headers()["content-type"]).toContain("application/pdf");

    const body = await download.body();
    expect(body.length).toBeGreaterThan(100_000);
    expect(body.subarray(0, 5).toString()).toBe("%PDF-");
  });
});
