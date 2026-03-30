# Frontend — Lattes Scraper

Frontend em Next.js 16 com React 19 para scraping interativo de currículos Lattes.

## Stack atual

- Next.js 16.2.1
- React 19.2.4
- TypeScript 5
- Tailwind CSS 4
- React Query 5
- Zustand 5
- Playwright 1.58 (E2E)

## Como o time deve ler esta base

O frontend está organizado por feature para reduzir acoplamento e facilitar manutenção.
Se alguém novo entrar no projeto, o caminho recomendado é:

1. Ler a página em src/app/page.tsx.
2. Abrir o workbench em src/features/lattes/components/lattes-workbench.tsx.
3. Seguir os hooks de fluxo em src/features/lattes/hooks.
4. Conferir chamadas de API em src/features/lattes/services/lattes.service.ts.

## Estrutura

```text
src/
├── app/                     # Rotas, layout e providers
├── components/
│   ├── shared/              # Blocos reaproveitáveis
│   └── ui/                  # Design system base
├── features/
│   └── lattes/
│       ├── components/      # UI da feature
│       ├── hooks/           # Fluxos e coordenação
│       ├── schemas/         # Validação de formulários (Zod)
│       ├── services/        # Chamadas HTTP para o backend
│       └── stores/          # Estado persistido da feature (Zustand)
└── lib/                     # Infra compartilhada (http, utilitários)
```

## Estado: regra prática (importante)

Para evitar confusão, cada tipo de estado tem um lugar específico.

1. Server State (dados vindos da API): React Query
2. UI State compartilhado da feature: Zustand
3. Estado navegável/compartilhável: Query Params da URL
4. Estado local de formulário: React Hook Form

### Onde cada um está hoje

1. React Query
- Busca de candidatos e cache por nome em src/features/lattes/hooks/use-lattes-individual-flow.ts
- Carregamento de modelos por provedor em src/features/lattes/hooks/use-lattes-summary.ts
- Provider global em src/app/providers.tsx

2. Zustand
- Configuração de resumo e chaves por provedor em src/features/lattes/stores/lattes-summary-store.ts

3. Query Params
- Fluxo atual (individual ou lote) e termo de busca em src/features/lattes/hooks/use-lattes-workbench-mode.ts

4. Formulários
- Busca individual, lote e resumo em componentes dentro de src/features/lattes/components

## Fluxo da feature Lattes

1. src/app/page.tsx renderiza o workbench da feature.
2. src/features/lattes/components/lattes-workbench.tsx compõe os painéis de UI.
3. src/features/lattes/hooks/use-lattes-workbench.ts coordena os subfluxos.
4. Hooks especializados cuidam do domínio:
- use-lattes-individual-flow.ts
- use-lattes-batch-flow.ts
- use-lattes-summary.ts
- use-lattes-workbench-feedback.ts
- use-lattes-workbench-mode.ts
5. src/features/lattes/services/lattes.service.ts concentra integração HTTP.

## Por que isso não é complexidade acidental

A feature foi dividida para manter coesão:

1. Cada hook resolve um problema específico.
2. Regras de estado ficam explícitas e previsíveis.
3. O workbench virou composição, não um hook deus.
4. O time consegue evoluir busca, lote e resumo separadamente.

## Convenções para manter o código simples

1. Nunca colocar chamada HTTP direto em componente.
2. Se estado vem de API, preferir React Query.
3. Se estado precisa sobreviver refresh e ser compartilhável, usar URL.
4. Se estado é da feature e compartilhado entre painéis, usar Zustand.
5. Se for input de formulário, manter no React Hook Form.
6. Evitar criar novos hooks grandes de orquestração.

## Checklist para PRs do frontend

1. O tipo de estado está no lugar correto (API, UI compartilhada, URL ou formulário)?
2. A mudança aumentou ou reduziu acoplamento?
3. A feature continua navegável via URL quando aplicável?
4. O comportamento em loading e erro está claro para o usuário?
5. Rodou pnpm lint e pnpm build?

## Rodar com Docker Compose (Recomendado)

```bash
# a partir da raiz do projeto
docker compose up -d --build
```

- Frontend: http://localhost:3000
- Backend: http://localhost:8000

Hot-reload ativo para mudanças no frontend e no backend.

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

Requisitos locais recomendados:

- Node.js 22+
- pnpm

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

## Problema comum: dependência nova não encontrada no Docker

Sintoma típico:

- `Module not found: Can't resolve '<pacote>'`

Isso pode acontecer porque o frontend roda com bind mount do código e volume para `node_modules`. Se o volume estiver desatualizado, a dependência nova pode não aparecer imediatamente.

Recuperação recomendada:

```bash
docker compose up -d --build --force-recreate --renew-anon-volumes frontend
```

Se necessário, execute também:

```bash
docker compose exec frontend sh -lc "CI=true pnpm install --frozen-lockfile"
docker compose restart frontend
```

## Comandos úteis

```bash
docker compose logs -f frontend
pnpm dev
pnpm lint
pnpm build
pnpm start
```

## Testes (Playwright)

Projeto padronizado com **apenas Playwright** para manter uma única estratégia de testes focada em fluxos reais de usuário (E2E), como upload de CSV e processamento em lote.

Configuração atual dos testes:

- Diretório de testes: `tests/e2e`
- Navegador: Chromium
- App de teste sobe automaticamente em `http://127.0.0.1:3100` via `webServer` do Playwright
- O cenário atual de lote mocka a rota `**/scrape/batch/stream`, sem depender de backend real

```bash
cd frontend

# instalar navegadores (primeira execução)
pnpm exec playwright install

# rodar testes E2E
pnpm test

# modo UI interativo
pnpm test:ui
```

Observação: os testes E2E atuais usam o CSV em `../docs/csv/nomes_docentes_formatado.csv`, então execute os comandos a partir da pasta `frontend`.
