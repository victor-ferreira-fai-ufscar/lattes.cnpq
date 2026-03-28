# Backend — Lattes Scraper

FastAPI + [Playwright](https://playwright.dev/) para scraping determinístico do Lattes.

## Rodar com Docker Compose (Recomendado)

```bash
# a partir da raiz do projeto
docker compose up -d --build
```

- API: http://localhost:8000
- Docs: http://localhost:8000/docs
- Health: http://localhost:8000/health

Hot-reload ativo para mudanças em [backend/src](backend/src).

## Desenvolvimento Local (Sem Docker)

```bash
cd backend
uv sync
uv run playwright install chromium
cp .env.example .env
uv run uvicorn src.api.main:app --reload
```

## Variáveis principais

```env
PLAYWRIGHT_BROWSER=chromium
PLAYWRIGHT_HEADLESS=true
PLAYWRIGHT_TIMEOUT_MS=45000
SCRAPE_RETRY_COUNT=3
BACKEND_PORT=8000
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service_role_key>
SUPABASE_STORAGE_BUCKET=lattes-cvs
SUPABASE_STORAGE_FOLDER=raw
SUPABASE_STORAGE_PUBLIC=true
```

## Quando adicionar nova lib Python

Atualize [backend/pyproject.toml](backend/pyproject.toml) e [backend/uv.lock](backend/uv.lock), depois:

```bash
docker compose build backend
docker compose up -d backend
```

## Endpoints principais

- `GET /health`
- `POST /search`
- `POST /scrape`
- `POST /scrape/batch`
- `POST /summarize`

## Troubleshooting rápido

```bash
docker compose logs -f backend
```
