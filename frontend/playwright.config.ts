import { defineConfig, devices } from "@playwright/test";

// Dois modos:
//   padrão      -> sobe um Next dev local e roda os specs mockados
//   E2E_LIVE=1  -> aponta pra produção e roda só os *-live.spec.ts (sem mock,
//                  exercita backend + Supabase self-hosted de verdade)
const live = process.env.E2E_LIVE === "1";
const liveBaseURL =
  process.env.E2E_BASE_URL ?? "https://lattes.sup.fai.ufscar.br";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: live ? "**/*-live.spec.ts" : undefined,
  testIgnore: live ? undefined : "**/*-live.spec.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "list",
  use: {
    baseURL: live ? liveBaseURL : "http://127.0.0.1:3100",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  // No modo live o alvo já está no ar; subir um dev server só atrasaria.
  webServer: live
    ? undefined
    : {
        command: "pnpm dev --hostname 127.0.0.1 --port 3100",
        url: "http://127.0.0.1:3100",
        reuseExistingServer: !process.env.CI,
        timeout: 120000,
      },
});