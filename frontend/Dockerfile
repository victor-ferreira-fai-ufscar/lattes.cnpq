FROM node:22-bookworm-slim AS base

# Use pnpm para gerenciar pacotes (mais eficiente que npm)
RUN npm install -g pnpm

ENV NEXT_TELEMETRY_DISABLED=1

WORKDIR /app

# Copia apenas manifestos para aproveitar cache de dependências entre builds
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml* ./
RUN pnpm install --frozen-lockfile

FROM base AS dev

ENV NODE_ENV=development

# Mantém uma cópia inicial do projeto; no compose ela será sobrescrita por bind mount.
COPY . .

# Expõe a porta padrão do Next.js
EXPOSE 3000

# Comando padrão: rodar dev server com polling (funciona melhor em containers)
CMD ["pnpm", "run", "dev"]

FROM base AS prod

ENV NODE_ENV=production

COPY . .
RUN pnpm build

EXPOSE 3000

CMD ["pnpm", "run", "start", "--hostname", "0.0.0.0", "--port", "3000"]

FROM base AS e2e

ENV NODE_ENV=test

# Os navegadores do Playwright só são necessários no perfil de testes.
RUN pnpm exec playwright install --with-deps chromium

COPY . .

CMD ["pnpm", "test"]
