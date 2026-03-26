# Backend — Lattes Scraper

FastAPI + [browser-use](https://github.com/browser-use/browser-use) para scraping automático do Lattes com IA.

## Pré-requisitos

- [uv](https://astral.sh/uv) — gerenciador de pacotes Python
- Python 3.11+
- Chrome/Chromium instalado (ou `google-chrome-dev` no Arch)

## Setup rápido

```bash
cd backend

# 1. Instalar dependências
uv sync

# 2. Configurar variáveis de ambiente
cp .env.example .env
# Edite .env e adicione sua OPENAI_API_KEY
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
  "resumo": "..."
}
```

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
│       └── scraper.py       # Lógica com browser-use + IA
├── .env.example
└── pyproject.toml
```

## Variáveis de Ambiente

```env
OPENAI_API_KEY=sk-...              # Obrigatório
CHROME_PATH=/opt/google/...        # Opcional (padrão: google-chrome-dev)
BACKEND_PORT=8000                  # Opcional
```

## Troubleshooting

**Erro: "Chrome not found"**

- Linux: Instale `google-chrome-dev` ou `chromium`
- Configure `CHROME_PATH` no `.env`

**Erro: "OpenAI API key not found"**

- Copie `.env.example` para `.env` e adicione sua chave

## Dependências principais

- `browser-use` — Automação de browser com IA
- `fastapi` — Framework web
- `uvicorn` — Servidor ASGI
- `scalar-fastapi` — Documentação interativa
