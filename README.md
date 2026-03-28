# Lattes Automator AI

Automação de coleta e processamento de currículos Lattes com backend em FastAPI/Playwright e frontend em Next.js.

## Objetivo

- Buscar docentes no Lattes
- Fazer scraping de currículo individual e em lote (CSV)
- Gerar PDF e resumo via API

## Estrutura do Projeto

```text
lattes.cnpq/
├── backend/      # FastAPI + Playwright
├── frontend/     # Next.js
├── supabase/     # notas e planejamento
└── docker-compose.yml
```

## Rodar em Desenvolvimento (Recomendado)

Pré-requisito: Docker Desktop aberto + WSL2 ativo.

```bash
docker compose up -d --build
```

URLs:

- Frontend: http://localhost:3000
- Backend: http://localhost:8000
- Health: http://localhost:8000/health
- Docs: http://localhost:8000/docs

Parar tudo:

```bash
docker compose down
```

## Hot-Reload (VS Code com containers rodando)

Sim, funciona automaticamente.

- Backend: mudanças em [backend/src](backend/src) recarregam com `--reload`
- Frontend: mudanças em [frontend](frontend) recompilam com `next dev`

Observação importante: manter o projeto no filesystem Linux do WSL (exemplo: `/home/...`) melhora bastante o hot-reload.

## Instalar Novas Dependências

Mudança de código aplica na hora. Mudança de dependência precisa instalar/rebuildar.

### Backend (Python/uv)

1. Atualize [backend/pyproject.toml](backend/pyproject.toml)
2. Gere/atualize lock localmente se necessário
3. Rebuild do backend:

```bash
docker compose build backend
docker compose up -d backend
```

### Frontend (pnpm)

Opção rápida (sem rebuild completo):

```bash
docker compose exec frontend pnpm add <pacote>
```

Ou fluxo reproduzível por build:

```bash
docker compose build frontend
docker compose up -d frontend
```

## Configuração

- Variáveis do compose: [.env.docker](.env.docker)
- Exemplo backend: [backend/.env.example](backend/.env.example)
- Exemplo frontend: [frontend/.env.example](frontend/.env.example)

Se mudar variáveis do compose, recrie os serviços:

```bash
docker compose up -d --force-recreate backend frontend
```

## Endpoints Principais

- `GET /health`
- `POST /search`
- `POST /scrape`
- `POST /scrape/batch`
- `POST /summarize`

## Troubleshooting Rápido

Ver logs:

```bash
docker compose logs -f backend
docker compose logs -f frontend
```

Subir do zero:

```bash
docker compose down --remove-orphans
docker compose up -d --build
```
