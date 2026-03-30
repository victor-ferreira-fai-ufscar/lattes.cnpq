# Lattes Automator AI

Automação de busca, coleta e processamento de currículos Lattes com backend em FastAPI/Playwright e frontend em Next.js.

## Visão geral

O projeto cobre o fluxo completo:

- Busca de candidatos por nome no Lattes
- Scraping individual de currículo (com PDF)
- Scraping em lote por CSV (com logs em tempo real via SSE)
- Geração de ZIP consolidado dos PDFs processados
- Sumarização de currículo com IA (OpenAI, Gemini e Ollama)

## Estrutura do repositório

```text
lattes.cnpq/
├── backend/             # API FastAPI, Playwright, Supabase, IA
├── frontend/            # Interface Next.js (feature-based)
├── docs/                # Documentação de fluxo e materiais de apoio
├── supabase/            # Notas e informações de suporte
├── exemplo/             # Arquivos de exemplo
└── docker-compose.yml   # Orquestração de desenvolvimento local
```

## Stack principal

- Backend: Python 3.11+, FastAPI, Playwright, Supabase SDK, uv
- Frontend: Next.js 16, React 19, TypeScript, React Query, Zustand, Playwright
- Infra local: Docker Compose

## Executar com Docker Compose (recomendado)

Na raiz do projeto:

```bash
docker compose up -d --build
```

URLs padrão:

- Frontend: http://localhost:3000
- Backend: http://localhost:8000
- Health: http://localhost:8000/health
- Docs (Scalar): http://localhost:8000/docs

Parar serviços:

```bash
docker compose down
```

## Configuração de ambiente

Arquivos importantes:

- [.env.example](.env.example): variáveis para interpolação do docker compose (portas)
- [.env.docker](.env.docker): variáveis compartilhadas de runtime dos containers
- [backend/.env.example](backend/.env.example): exemplo completo de variáveis do backend
- [frontend/.env.example](frontend/.env.example): variáveis públicas do frontend

Para customizar portas do compose:

```bash
cp .env.example .env
```

Se alterar variáveis de compose, recrie os serviços:

```bash
docker compose up -d --force-recreate backend frontend
```

## Hot-reload em desenvolvimento

- Backend: mudanças em [backend/src](backend/src) recarregam com Uvicorn `--reload`
- Frontend: mudanças em [frontend](frontend) recompilam com `next dev`

## Endpoints principais da API

- GET /health
- POST /search
- POST /scrape
- POST /scrape/batch
- POST /scrape/batch/stream
- POST /summarize
- POST /models

## Testes

Frontend (E2E com Playwright):

```bash
cd frontend
pnpm test
```

Backend (integração de storage):

```bash
cd backend
uv run pytest
```

## Como adicionar dependências

Backend (Python/uv):

1. Atualize [backend/pyproject.toml](backend/pyproject.toml)
2. Sincronize dependências localmente (`uv sync`) quando necessário
3. Rebuild do serviço backend:

```bash
docker compose build backend
docker compose up -d backend
```

Frontend (pnpm):

```bash
docker compose exec frontend pnpm add <pacote>
```

Ou via rebuild:

```bash
docker compose build frontend
docker compose up -d frontend
```

## READMEs por módulo

- [backend/README.md](backend/README.md)
- [frontend/README.md](frontend/README.md)

## Troubleshooting rápido

Erro comum no frontend após adicionar dependência nova (ex.: `Module not found: Can't resolve ...`):

1. O frontend em Docker usa bind mount do código e volume para `node_modules`.
2. Em alguns casos, o volume pode ficar desatualizado em relação ao `package.json`/`pnpm-lock.yaml`.
3. A correção mais segura é recriar o serviço frontend.

```bash
docker compose up -d --build --force-recreate --renew-anon-volumes frontend
```

Se ainda falhar, rode uma instalação explícita dentro do container e reinicie o serviço:

```bash
docker compose exec frontend sh -lc "CI=true pnpm install --frozen-lockfile"
docker compose restart frontend
```

Ver logs:

```bash
docker compose logs -f backend
docker compose logs -f frontend
```

Health check da API:

```bash
curl -f http://localhost:8000/health
```

Subir do zero:

```bash
docker compose down --remove-orphans
docker compose up -d --build
```
