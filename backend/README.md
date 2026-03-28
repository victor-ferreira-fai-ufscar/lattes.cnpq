# Backend — Lattes Scraper

FastAPI + [Playwright](https://playwright.dev/) para scraping determinístico do Lattes.

## Visão rápida da arquitetura

Hoje o backend está organizado para separar responsabilidades e facilitar manutenção.

- api: camada HTTP. Define rotas e recebe as requisições.
- models: contratos de entrada (Pydantic) usados pelas rotas.
- libs: utilitários reaproveitáveis (ex.: parser CSV, geração de nome de arquivo, logs).
- core: regras e integrações principais (scraper, storage e sumarização por IA).

### Estrutura de pastas

```text
backend/src/
├── api/
│   ├── main.py             # Cria o app FastAPI, CORS e inclui os routers
│   └── routers/            # Um arquivo por grupo de endpoints
│       ├── scrape.py       # /scrape
│       ├── search.py       # /search
│       ├── batch.py        # /scrape/batch
│       ├── ai.py           # /summarize e /models
│       └── health.py       # /health e /docs
├── models/
│   ├── scrape.py           # ScrapeRequest
│   ├── search.py           # SearchRequest
│   └── ai.py               # SummarizeRequest e ModelsRequest
├── libs/
│   ├── filename.py         # Regras para nome de PDF
│   ├── csv_utils.py        # Leitura e deduplicação de nomes do CSV
│   └── logging.py          # Logs com timestamp
└── core/
    ├── scraper.py          # Fluxo Playwright no Lattes
    ├── storage.py          # Upload no Supabase Storage
    └── summarizer.py       # Integração com provedores de IA
```

### Como uma requisição percorre o sistema

1. A rota em api/routers recebe a chamada.
2. O payload é validado com models.
3. A rota chama funções de core para executar a regra principal.
4. libs ajuda com tarefas auxiliares comuns.
5. A rota monta a resposta HTTP.

Resultado: arquivos menores, menor acoplamento e mais facilidade para evoluir sem quebrar tudo.

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

## Rotas disponíveis

- GET /health
- POST /search
- POST /scrape
- POST /scrape/batch
- POST /summarize
- POST /models

## Quando adicionar nova lib Python

Atualize [backend/pyproject.toml](backend/pyproject.toml) e [backend/uv.lock](backend/uv.lock), depois:

```bash
docker compose build backend
docker compose up -d backend
```

## Troubleshooting rápido

```bash
docker compose logs -f backend
```
