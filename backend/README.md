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

Scraping automático do currículo Lattes e download do PDF:

```bash
curl -X POST http://localhost:8000/scrape \
  -H "Content-Type: application/json" \
  -d '{"nome": "Neocles"}'
```

**Response:**

```json
{
  "nome": "Neocles",
  "arquivo_pdf": "neocles-20260326-123456.pdf",
  "download_pdf_url": "/download/raw/neocles-20260326-123456.pdf"
}
```

O fluxo automático:

1. Busca o nome no Lattes
2. Clica no resultado
3. Abre o currículo completo
4. Gera PDF via `page.pdf()` do Playwright
5. Salva em `backend/output/raw/{nome}-{timestamp}.pdf`

### GET /download/raw/{filename}

Baixa o PDF gerado:

```bash
curl http://localhost:8000/download/raw/neocles-20260326-123456.pdf -o curriculo.pdf
```

- **Content-Type**: `application/pdf` (para `.pdf`) ou `text/html` (para `.html`)
- **Segurança**: Valida nome do arquivo (sem `../` ou caracteres perigosos)

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
