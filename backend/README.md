# Backend — Lattes Scraper

FastAPI + [Playwright](https://playwright.dev/) para scraping determinístico do Lattes.

## Stack atual

- Python 3.11+
- FastAPI 0.104+
- Uvicorn
- Playwright (Chromium por padrão)
- Supabase Python SDK
- Integrações de IA: OpenAI, Gemini e Ollama
- Gerenciamento de dependências com uv

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
│       ├── batch.py        # /scrape/batch e /scrape/batch/stream
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

Comandos úteis no dia a dia:

```bash
cd backend
uv run uvicorn src.api.main:app --reload
uv run pytest
```

## Variáveis principais

```env
PLAYWRIGHT_BROWSER=chromium
PLAYWRIGHT_HEADLESS=true
BACKEND_PORT=8000
FRONTEND_PORT=3000
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service_role_key>
SUPABASE_ANON_KEY=<anon_key_opcional>
SUPABASE_STORAGE_BUCKET=lattes-cvs
SUPABASE_STORAGE_FOLDER=raw
SUPABASE_STORAGE_PUBLIC=true
SUPABASE_SIGNED_URL_EXPIRES_IN=3600
OPENAI_API_KEY=<openai_key_opcional>
GEMINI_API_KEY=<gemini_key_opcional>
OLLAMA_BASE_URL=http://host.docker.internal:11434
OLLAMA_MODEL=llama3.1
OLLAMA_API_KEY=ollama
```

Observação: para upload no Storage, o backend exige `SUPABASE_URL` e pelo menos uma chave (`SUPABASE_SERVICE_ROLE_KEY` ou `SUPABASE_ANON_KEY`).

## Rotas disponíveis

- GET /health
- POST /search
- POST /scrape
- POST /scrape/batch
- POST /scrape/batch/stream (SSE com logs em tempo real)
- POST /summarize
- POST /models

Detalhes importantes:

- `/docs` usa Scalar (não Swagger/ReDoc padrão).
- `/search` aplica limite entre 1 e 50 candidatos.
- `/summarize` e `/models` aceitam provedores `openai`, `gemini` e `ollama`.

## Batch: parâmetros principais

- Campo de arquivo: `arquivo` (compatível também com `file`)
- `skip`: inteiro >= 0 para pular linhas iniciais
- `limit`: inteiro > 0 para limitar quantos nomes serão processados

No fluxo de lote, o backend também tenta gerar um `.zip` consolidado com os PDFs processados com sucesso.

## Quando adicionar nova lib Python

Atualize [backend/pyproject.toml](backend/pyproject.toml) e [backend/uv.lock](backend/uv.lock), depois:

```bash
docker compose build backend
docker compose up -d backend
```

Se estiver rodando sem Docker:

```bash
cd backend
uv sync
```

## Testes

O projeto possui teste de integração para upload no Supabase Storage em `tests/test_storage.py`.

```bash
cd backend
uv run pytest
```

Observação: esse teste depende de credenciais válidas do Supabase no ambiente.

## Troubleshooting rápido

```bash
docker compose logs -f backend
curl -f http://localhost:8000/health
```
