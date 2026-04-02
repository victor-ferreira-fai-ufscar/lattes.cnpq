# syntax=docker/dockerfile:1.7

FROM node:22-bookworm-slim AS base

# Use pnpm para gerenciar pacotes (mais eficiente que npm)
RUN npm install -g pnpm

ENV NEXT_TELEMETRY_DISABLED=1 \
	PNPM_STORE_DIR=/pnpm/store

WORKDIR /app

FROM base AS deps

# Copia apenas manifestos para aproveitar cache de dependências entre builds
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml* ./
RUN --mount=type=cache,target=/pnpm/store,sharing=locked \
	pnpm install --frozen-lockfile

FROM deps AS dev

ENV NODE_ENV=development

# Mantém uma cópia inicial do projeto; no compose ela será sobrescrita por bind mount.
COPY . .

# Expõe a porta padrão do Next.js
EXPOSE 3000

# Comando padrão: rodar dev server com polling (funciona melhor em containers)
CMD ["pnpm", "run", "dev"]

FROM deps AS builder

ENV NODE_ENV=production

COPY . .
RUN pnpm build

FROM node:22-bookworm-slim AS prod

ENV NODE_ENV=production \
	NEXT_TELEMETRY_DISABLED=1 \
	HOSTNAME=0.0.0.0 \
	PORT=3000

WORKDIR /app

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000

CMD ["node", "server.js"]

FROM deps AS e2e

ENV NODE_ENV=test

# Os navegadores do Playwright só são necessários no perfil de testes.
RUN pnpm exec playwright install --with-deps chromium

COPY . .

CMD ["pnpm", "test"]
