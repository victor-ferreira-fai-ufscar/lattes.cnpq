# Frontend — Lattes Scraper

Frontend em Next.js 16 com React 19 para scraping interativo de currículos Lattes.

## Arquitetura atual

Estrutura enxuta e orientada por feature:

```text
src/
├── app/                     # Rotas e composição de páginas
├── components/
│   ├── shared/              # Blocos reaproveitáveis entre features
│   └── ui/                  # Design system base
├── features/
│   └── lattes/
│       ├── components/      # Componentes específicos do domínio
│       ├── hooks/           # Orquestração do fluxo da feature
│       ├── schemas/         # Validação com Zod
│       └── services/        # Integração com a API do backend
└── lib/                     # Infra compartilhada, como cliente HTTP
```

Princípios aplicados:

- `app/` não concentra regra de negócio.
- O domínio Lattes fica isolado em `features/lattes/`.
- `lib/` foi reduzida à infraestrutura compartilhada, sem misturar serviços de domínio.
- Componentes de UI continuam genéricos em `components/ui/`.

## Rodar com Docker Compose (Recomendado)

```bash
# a partir da raiz do projeto
docker compose up -d --build
```

- Frontend: http://localhost:3000
- Backend: http://localhost:8000

Hot-reload ativo para mudanças em [frontend](frontend).

## Desenvolvimento Local (Sem Docker)

```bash
cd frontend
# Instalar dependências
pnpm install

# Configurar variáveis de ambiente
cp .env.example .env.local

# Executar dev server
pnpm dev
```

Abra http://localhost:3000.

## Variáveis de Ambiente

```env
# URL do backend para requisições de API
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## Quando adicionar nova lib Node

Opção rápida:

```bash
docker compose exec frontend pnpm add <pacote>
```

Ou rebuild:

```bash
docker compose build frontend
docker compose up -d frontend
```

## Comandos úteis

```bash
docker compose logs -f frontend
pnpm build
pnpm start
```

## Testes (Playwright)

Projeto padronizado com **apenas Playwright** para manter uma única estratégia de testes focada em fluxos reais de usuário (E2E), como upload de CSV e processamento em lote.

```bash
cd frontend

# instalar navegadores (primeira execução)
pnpm exec playwright install

# rodar testes E2E
pnpm test

# modo UI interativo
pnpm test:ui
```
