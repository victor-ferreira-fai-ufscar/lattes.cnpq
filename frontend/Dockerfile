FROM node:22-alpine

# Use pnpm para gerenciar pacotes (mais eficiente que npm)
RUN npm install -g pnpm

# Define variáveis de environment padrão
ENV NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=development

WORKDIR /app

# Copia apenas package.json e pnpm-lock.yaml para cache/download de dependências
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml* ./

# Instala dependências com pnpm
RUN pnpm install --frozen-lockfile

# Copia o código-fonte
COPY . .

# Expõe a porta padrão do Next.js
EXPOSE 3000

# Comando padrão: rodar dev server com polling (funciona melhor em containers)
CMD ["pnpm", "run", "dev"]
