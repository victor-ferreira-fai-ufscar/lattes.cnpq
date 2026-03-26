# Backend — Lattes Automator AI

FastAPI + Playwright para scraping automático do Lattes e geração de resumos com IA.

## Pré-requisitos

- [uv](https://astral.sh/uv) — gerenciador de pacotes Python
- Python 3.10+

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

## Configuração

```bash
cd backend

# Instalar dependências
uv sync

# Instalar o browser do Playwright
uv run playwright install chromium

# Copiar e preencher o .env
cp .env.example .env
```

No `.env`, configure ao menos uma chave de IA:

```env
OPENAI_API_KEY=sk-...
# ou
GEMINI_API_KEY=...
```

## Rodar o servidor

```bash
uv run uvicorn src.api.main:app --reload
```

- API: <http://localhost:8000>
- Swagger UI: <http://localhost:8000/docs>

## Testar

```bash
# Suite de testes automatizados
uv run pytest tests/ -v

# Pipeline completo com nome avulso
uv run python scripts/test_batch.py "Neocles Juaçaba"

# Com a lista de docentes (primeiros 5)
uv run python scripts/test_batch.py --csv docs/csv/50-nomes-docentes.csv --limit 5

# Todos os 50
uv run python scripts/test_batch.py --csv docs/csv/50-nomes-docentes.csv
```

Arquivos gerados em:

- `output/raw/` — texto bruto extraído do Lattes
- `output/structured/` — `.docx` com resumo IA

## Endpoints principais

| Método | Rota                   | Descrição                  |
| ------ | ---------------------- | -------------------------- |
| `GET`  | `/health`              | Status da API              |
| `POST` | `/scrape`              | Processa um docente        |
| `POST` | `/scrape/batch`        | Processa lista de docentes |
| `GET`  | `/download/{filename}` | Baixa o DOCX gerado        |

### Exemplo de request

```bash
curl -X POST http://localhost:8000/scrape \
  -H "Content-Type: application/json" \
  -d '{
    "nome": "Neocles Juaçaba",
    "provedor": "OpenAI",
    "modelo": "gpt-4o-mini",
    "api_key": "sk-..."
  }'
```

## Estrutura

```
backend/
├── src/
│   ├── api/
│   │   ├── main.py        # App FastAPI
│   │   └── routes.py      # Endpoints + models
│   └── core/
│       ├── scraper.py     # Automação Playwright + IA
│       └── document_maker.py  # Geração de DOCX
├── tests/
│   └── test_scraper.py
├── scripts/
│   └── test_batch.py      # Teste em lote via CLI
├── docs/
│   ├── SCRAPING_FLOW.md   # Documentação do fluxo
│   └── csv/50-nomes-docentes.csv
└── output/                # Arquivos gerados (gitignored)
```
