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

Esse é o modo indicado para professor, apresentação e validação rápida:

- Sem hot reload
- Sem bind mounts no frontend
- Frontend empacotado com build `standalone` do Next.js
- Menor chance de comportamento inconsistente entre Linux e Windows

URLs padrão:

- Frontend: http://localhost:3000
- Backend: http://localhost:8000
- Health: http://localhost:8000/health
- Docs (Scalar): http://localhost:8000/docs

Verificação rápida após subir:

```bash
curl -f http://localhost:8000/health
curl -I http://localhost:3000
```

## Primeira execução após git clone

Este é o fluxo recomendado para primeira execução em qualquer máquina, inclusive Windows 11 com Docker Desktop sem WSL2:

1. Clone o repositório.
2. Abra um terminal na raiz do projeto.
3. Rode `docker compose up -d --build`.
4. Aguarde o primeiro build terminar.
5. Abra `http://localhost:3000` no navegador.

Observações importantes para esse cenário:

- O modo padrão não usa hot reload nem bind mounts no frontend.
- Isso evita os problemas mais comuns de compartilhamento de arquivos entre host e container no Windows.
- Não é necessário criar `.env` na raiz para a primeira execução; o compose já usa valores padrão.
- O arquivo `backend/.env` é opcional no primeiro boot.
- O primeiro build é pesado porque o backend instala o Chromium do Playwright.
- Para primeira execução, reserve idealmente pelo menos 12 GB livres no Docker Desktop.

### Windows 11 + Docker Desktop

- Use Docker Desktop em modo Linux containers.
- Você pode rodar o comando acima no PowerShell, Prompt de Comando ou terminal do VS Code.
- Não é necessário WSL2 para o modo padrão estável.
- Se o Docker Desktop estiver com pouco espaço de disco, o primeiro build pode falhar ou parecer travado.

Verificação rápida no PowerShell:

```powershell
Invoke-WebRequest http://localhost:8000/health
Invoke-WebRequest http://localhost:3000
```

Parar serviços:

```bash
docker compose down
```

## Modo desenvolvimento com hot reload

Quando for editar código localmente, use o override de desenvolvimento:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
```

Nesse modo:

- Backend roda com `uvicorn --reload`
- Frontend usa bind mount do projeto
- O container do frontend usa volumes nomeados para `node_modules` e `.next`

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

No PowerShell:

```powershell
Copy-Item .env.example .env
```

Se alterar variáveis de compose, recrie os serviços:

```bash
docker compose up -d --force-recreate backend frontend
```

## Modos de execução

- Padrão: execução estável, sem hot reload, para rodar rápido e testar localmente.
- Desenvolvimento: use [docker-compose.dev.yml](docker-compose.dev.yml) para hot reload no backend e no frontend.

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

1. No modo desenvolvimento, o frontend em Docker usa bind mount do código e volumes nomeados para `node_modules` e `.next`.
2. Em alguns casos, esses volumes podem ficar desatualizados em relação ao `package.json`/`pnpm-lock.yaml`.
3. A correção mais segura é recriar o serviço frontend.

```bash
docker compose down
docker compose up -d --build frontend
```

Observações importantes para máquinas com pouco espaço:

- O build padrão do frontend não instala navegadores do Playwright.
- Os navegadores ficam restritos ao perfil `frontend-e2e`, reduzindo tempo de build e uso de disco no fluxo normal.
- O contexto de build agora ignora `.pnpm-store`, evitando enviar centenas de megabytes desnecessários para o Docker.

Se estiver usando o modo desenvolvimento e ainda falhar, derrube os serviços, remova os volumes nomeados do frontend e suba novamente:

```bash
docker compose down -v
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build frontend
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
