# Backend — Lattes Scraper

FastAPI + [Playwright](https://playwright.dev/) para scraping determinístico do Lattes.

## Pré-requisitos

- [uv](https://astral.sh/uv) — gerenciador de pacotes Python
- Python 3.11+
- Browsers do Playwright instalados

## Setup rápido

```bash
cd backend

# 1. Instalar dependências
uv sync

# 1.1 Instalar browser (uma vez)
uv run playwright install chromium

# 2. Configurar variáveis de ambiente
cp .env.example .env
# Ajuste o modo headless se necessário
```

## Rodar o servidor

```bash
uv run uvicorn src.api.main:app --reload
```

- API: <http://localhost:8000>
- Docs (Scalar): <http://localhost:8000/docs>
- Health check: <http://localhost:8000/health>

## Como usar

### POST /scrape

Extrai dados do currículo Lattes e retorna JSON:

```bash
curl -X POST http://localhost:8000/scrape \
  -H "Content-Type: application/json" \
  -d '{"nome": "Neocles"}'
```

**Response:**

```json
{
  "graduacao": "Engenharia de Controle e Automação - UFSCar",
  "mestrado": "Engenharia Elétrica - UNICAMP",
  "doutorado": "Engenharia de Controle e Automação - UFSCar",
  "pos_doutorado": "",
  "vinculo_institucional": "Universidade Federal de São Carlos",
  "resumo": "...",
  "arquivo_html": "neocles-20260326-123456.html",
  "download_html_url": "/download/raw/neocles-20260326-123456.html"
}
```

### GET /download/raw/{filename}

Baixa o HTML bruto capturado durante o scraping.

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
