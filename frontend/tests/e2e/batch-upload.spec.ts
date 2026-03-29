import { expect, test } from "@playwright/test";
import path from "node:path";

const MOCK_RESPONSE = {
  arquivo: "nomes_docentes_formatado.csv",
  total_nomes_csv: 3,
  total_processados: 2,
  sucesso: 2,
  erro: 0,
  resultados: [
    {
      nome: "Aline Barreto de Almeida Nordi",
      status: "sucesso",
      ultima_atualizacao_curriculo: "2026-03-16",
      arquivo_pdf: "aline-barreto-de-almeida-nordi-2026-03-16.pdf",
      storage_path: "raw/aline-barreto-de-almeida-nordi-2026-03-16.pdf",
      download_pdf_url:
        "https://example.com/aline-barreto-de-almeida-nordi-2026-03-16.pdf",
      duracao_segundos: 9.74,
    },
    {
      nome: "Aline Guerra Aquilante",
      status: "sucesso",
      ultima_atualizacao_curriculo: "2026-03-25",
      arquivo_pdf: "aline-guerra-aquilante-2026-03-25.pdf",
      storage_path: "raw/aline-guerra-aquilante-2026-03-25.pdf",
      download_pdf_url:
        "https://example.com/aline-guerra-aquilante-2026-03-25.pdf",
      duracao_segundos: 8.5,
    },
  ],
  zip_arquivo: "lattes-lote-20260328-120000.zip",
  zip_storage_path: "zips/lattes-lote-20260328-120000.zip",
  zip_download_url: "https://example.com/zips/lattes-lote-20260328-120000.zip",
  zip_erro: null,
  logs: ["lote executado"],
  duracao_segundos: 18.24,
};

function buildSseBody(
  result: Record<string, unknown>,
  logs: string[] = ["[12:00:01] lote executado"],
) {
  const startEvent = [
    "event: start",
    `data: ${JSON.stringify({
      arquivo: result.arquivo,
      total_nomes_csv: result.total_nomes_csv,
      total_processados: result.total_processados,
    })}`,
    "",
  ].join("\n");

  const logEvents = logs
    .map((line) => ["event: log", `data: ${JSON.stringify({ message: line })}`, ""].join("\n"))
    .join("\n");

  const resultEvent = ["event: result", `data: ${JSON.stringify(result)}`, ""].join("\n");
  const endEvent = ["event: end", "data: {}", ""].join("\n");

  return `${startEvent}\n${logEvents}\n${resultEvent}\n${endEvent}\n`;
}

async function setupAndRunBatch(page: import("@playwright/test").Page) {
  await page.route("**/scrape/batch/stream", async (route) => {
    const request = route.request();
    const body = request.postDataBuffer();
    const text = body ? new TextDecoder().decode(body) : "";

    expect(request.method()).toBe("POST");
    expect(text).toContain('name="arquivo"');
    expect(text).toContain('name="skip"');

    await route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      body: buildSseBody(MOCK_RESPONSE),
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Fluxo em lote" }).click();

  const csvPath = path.resolve(
    process.cwd(),
    "../docs/csv/nomes_docentes_formatado.csv",
  );
  await page.locator("#batch-csv-file").setInputFiles(csvPath);
  await page.locator("#batch-skip").fill("0");
  await page.locator("#batch-limit").fill("2");
  await page.getByRole("button", { name: "Executar lote" }).click();

  await expect(page.getByText("Lote concluído")).toBeVisible();
}

test("envia CSV com skip/limit e confirma requisição para o backend", async ({ page }) => {
  let capturedFormData: Record<string, string> = {};

  await page.route("**/scrape/batch/stream", async (route) => {
    const request = route.request();
    const body = request.postDataBuffer();
    const text = body ? new TextDecoder().decode(body) : "";

    // Extrai os valores dos campos do multipart/form-data
    const skipMatch = text.match(/name="skip"\r\n\r\n(\d+)/);
    const limitMatch = text.match(/name="limit"\r\n\r\n(\d+)/);
    capturedFormData = {
      skip: skipMatch?.[1] ?? "",
      limit: limitMatch?.[1] ?? "",
    };

    expect(request.method()).toBe("POST");
    expect(text).toContain('name="arquivo"');
    expect(text).toContain('name="skip"');
    expect(text).toContain('name="limit"');

    await route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      body: buildSseBody(MOCK_RESPONSE),
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Fluxo em lote" }).click();

  const csvPath = path.resolve(
    process.cwd(),
    "../docs/csv/nomes_docentes_formatado.csv",
  );
  await page.locator("#batch-csv-file").setInputFiles(csvPath);
  await page.locator("#batch-skip").fill("0");
  await page.locator("#batch-limit").fill("2");
  await page.getByRole("button", { name: "Executar lote" }).click();

  await expect(page.getByText("Lote concluído")).toBeVisible();

  expect(capturedFormData.skip).toBe("0");
  expect(capturedFormData.limit).toBe("2");
});

test("exibe métricas do lote (processados, sucessos, erros)", async ({ page }) => {
  await setupAndRunBatch(page);

  await expect(page.getByText("2 currículo(s) processado(s) no lote.")).toBeVisible();

  // Métricas no card: Processados=2, Sucessos=2, Erros=0
  const card = page.locator(".border-amber-200\\/70");
  await expect(card.getByText("2").first()).toBeVisible();
  await expect(card.getByText("0")).toBeVisible();
});

test("exibe nomes e badge 'sucesso' de cada item processado", async ({ page }) => {
  await setupAndRunBatch(page);

  await expect(page.getByText("Aline Barreto de Almeida Nordi")).toBeVisible();
  await expect(page.getByText("Aline Guerra Aquilante")).toBeVisible();

  const badges = page.getByText("sucesso", { exact: true });
  await expect(badges).toHaveCount(2);
});

test("exibe logs do processamento em lote no painel de execução", async ({ page }) => {
  await setupAndRunBatch(page);

  await expect(page.getByText("Logs da execução")).toBeVisible();
  await expect(page.getByText("[12:00:01] lote executado")).toBeVisible();
});

test("exibe links 'Abrir PDF' para cada currículo processado com sucesso", async ({ page }) => {
  await setupAndRunBatch(page);

  const pdfLinks = page.getByRole("link", { name: "Abrir PDF" });
  await expect(pdfLinks).toHaveCount(2);

  const hrefs = await pdfLinks.evaluateAll((links) =>
    (links as HTMLAnchorElement[]).map((a) => a.href),
  );
  expect(hrefs).toContain(
    "https://example.com/aline-barreto-de-almeida-nordi-2026-03-16.pdf",
  );
  expect(hrefs).toContain(
    "https://example.com/aline-guerra-aquilante-2026-03-25.pdf",
  );
});

test("exibe link de download do ZIP consolidado apontando para pasta zips/", async ({ page }) => {
  await setupAndRunBatch(page);

  const zipLink = page.getByRole("link", { name: "Baixar ZIP consolidado" });
  await expect(zipLink).toBeVisible();

  const href = await zipLink.getAttribute("href");
  expect(href).toBe(MOCK_RESPONSE.zip_download_url);
  expect(href).toContain("/zips/");
});

test("exibe mensagem de erro quando ZIP falha no backend", async ({ page }) => {
  await page.route("**/scrape/batch/stream", async (route) => {
    const result = {
      ...MOCK_RESPONSE,
      zip_download_url: null,
      zip_arquivo: null,
      zip_storage_path: null,
      zip_erro: "Falha ao conectar com o Supabase Storage.",
    };

    await route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      body: buildSseBody(result),
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Fluxo em lote" }).click();

  const csvPath = path.resolve(
    process.cwd(),
    "../docs/csv/nomes_docentes_formatado.csv",
  );
  await page.locator("#batch-csv-file").setInputFiles(csvPath);
  await page.getByRole("button", { name: "Executar lote" }).click();

  await expect(page.getByText("Lote concluído")).toBeVisible();
  await expect(page.getByRole("link", { name: "Baixar ZIP consolidado" })).not.toBeVisible();
  await expect(page.getByText("Falha ao conectar com o Supabase Storage.")).toBeVisible();
});