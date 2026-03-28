# Backend — Lattes Scraper

FastAPI + [Playwright](https://playwright.dev/) para scraping determinístico do Lattes.

## Pré-requisitos

- [Docker](https://www.docker.com/) e [Docker Compose](https://docs.docker.com/compose/) (recomendado para desenvolvimento)
- **OU** localmente:
  - [uv](https://astral.sh/uv) — gerenciador de pacotes Python
  - Python 3.11+
  - Browsers do Playwright instalados

## Setup Rápido (Docker Compose — Recomendado)

```bash
# A partir da raiz do projeto
docker-compose up
```

- Backend: http://localhost:8000
- Docs (Scalar): http://localhost:8000/docs
- Health check: http://localhost:8000/health

O **hot-reload** está ativado automaticamente — qualquer mudança no código reflete na hora sem reiniciar o container.

---

## Setup Local (Sem Docker)

```bash
cd backend

# 1. Instalar dependências
uv sync

# 2. Instalar browsers
uv run playwright install chromium

# 3. Configurar variáveis de ambiente
cp .env.example .env
# Ajuste PLAYWRIGHT_HEADLESS, SUPABASE_* conforme necessário
```

## Rodar o servidor localmente

```bash
uv run uvicorn src.api.main:app --reload
```

- API: http://localhost:8000
- Docs (Scalar): http://localhost:8000/docs

## Como usar

### POST /scrape

Scraping automático do currículo Lattes + upload do PDF no Supabase Storage:

```bash
curl -X POST http://localhost:8000/scrape \
  -H "Content-Type: application/json" \
  -d '{"nome": "Neocles"}'
```

**Response:**

```json
{
  "nome": "Neocles",
  "ultima_atualizacao_curriculo": "2020-09-11",
  "arquivo_pdf": "neocles-2020-09-11.pdf",
  "storage_path": "raw/neocles-2020-09-11.pdf",
  "download_pdf_url": "https://<project>.supabase.co/storage/v1/object/public/lattes-cvs/raw/neocles-2020-09-11.pdf"
}
```

O fluxo automático:

1. Busca o nome no Lattes
2. Clica no resultado
3. Abre o currículo completo
4. Gera PDF via `page.pdf()` do Playwright
5. Extrai a data de "última atualização do currículo"
6. Salva no Supabase com nome `{slug-do-nome}-{YYYY-MM-DD}.pdf`
7. Retorna a URL final do Storage para download

### GET /health

Verifica se a API está rodando:

```bash
curl http://localhost:8000/health
```

## Estrutura

```bash
backend/
├── src/
│   ├── api/
│   │   └── main.py          # FastAPI app + endpoint /scrape
│   └── core/
│       └── scraper.py       # Lógica de scraping com Playwright
├── .env.example
└── pyproject.toml
```

## Variáveis de Ambiente

```env
PLAYWRIGHT_BROWSER=chromium        # Opcional
PLAYWRIGHT_HEADLESS=true           # Opcional
BACKEND_PORT=8000                  # Opcional
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service_role_key>
SUPABASE_STORAGE_BUCKET=lattes-cvs
SUPABASE_STORAGE_FOLDER=raw
SUPABASE_STORAGE_PUBLIC=true
```

## Troubleshooting

> **Erro: browser do Playwright não encontrado**

- Execute `uv run playwright install chromium`

> **Erro: timeout durante scraping**

- Tente com `PLAYWRIGHT_HEADLESS=false` para depurar visualmente

## Dependências principais

- `playwright` — Automação de browser determinística
- `fastapi` — Framework web
- `uvicorn` — Servidor ASGI
- `scalar-fastapi` — Documentação interativa
- `supabase` — Upload e link de download via Supabase Storage
