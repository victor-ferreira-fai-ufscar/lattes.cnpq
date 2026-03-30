# Plan: Operacionalizar MVP Lattes

## Contexto Operacional (fixo para o projeto)

- Ja existe ambiente virtual do backend gerenciado com `uv` (nao recriar setup alternativo sem necessidade).
- Fluxo preferencial de execucao local: `docker compose` com servicos em containers.
- Priorizar instrucoes e planos que preservem isolamento, reproducibilidade e facilidade de onboarding em outras maquinas.
- Sempre que houver comando de execucao no plano, indicar primeiro a opcao via containers e deixar execucao local direta como alternativa.

## Contexto Frontend (estado atual, manter como base)

Frontend em Next.js 16 + React 19 com arquitetura por feature em `frontend/src/features/lattes`.

Regras de estado já adotadas e que devem ser preservadas em novos planos:

1. Server State com React Query
- Busca de candidatos e cache por nome.
- Carregamento de modelos por provedor.

2. UI State compartilhado da feature com Zustand
- Configuração de resumo e chaves por provedor em store dedicada.

3. Estado navegável com Query Params
- Fluxo da interface (`individual`/`lote`) e termo de busca na URL.

4. Estado local de inputs com React Hook Form
- Formulários de busca, lote e resumo.

Pontos de manutenção importantes para o time:

- Evitar novo "god hook"; preferir hooks focados por fluxo.
- Não colocar chamadas HTTP dentro de componentes de UI.
- Manter `lattes-workbench` como composição, não centro de regras.
- Sempre validar `pnpm lint` e `pnpm build` após mudanças estruturais.

Arquivos-chave para contexto durante planejamento:

- `frontend/src/features/lattes/components/lattes-workbench.tsx`
- `frontend/src/features/lattes/hooks/use-lattes-workbench.ts`
- `frontend/src/features/lattes/hooks/use-lattes-individual-flow.ts`
- `frontend/src/features/lattes/hooks/use-lattes-batch-flow.ts`
- `frontend/src/features/lattes/hooks/use-lattes-summary.ts`
- `frontend/src/features/lattes/hooks/use-lattes-workbench-mode.ts`
- `frontend/src/features/lattes/hooks/use-lattes-workbench-feedback.ts`
- `frontend/src/features/lattes/stores/lattes-summary-store.ts`
- `frontend/src/features/lattes/services/lattes.service.ts`

Objetivo de qualquer plano frontend novo:

- reduzir acoplamento,
- manter rastreabilidade por URL,
- reforçar previsibilidade de estado,
- preservar simplicidade para onboarding do time.

**Context**
Aplicação de scraping de currículos Lattes com frontend em Next.js e backend em FastAPI/Playwright. Atualmente: busca individual, scraping com upload em Supabase, lote com CSV, resumo com OpenAI. Time: equipe de pesquisa UFSCAR. Horizonte: 2 a 4 semanas. Prioridade: gestores/secretarias.

**Objetivo Principal**
Transformar o que já funciona em um produto operacional confiável, focando em execução local simples, robustez do lote, persistência mínima de resultados e saídas estruturadas úteis para consumo institucional. Adiar RAG/CCS/chatbot e manter IA apenas como complemento opcional.

---

## Fase 1 — Consolidar Operação Local (1 semana)

### 1.1 Docker Compose para Stack Completa
**Por quê:** Reduz fricção para setup, testes e colaboração; fecha o item mais útil do backlog.

**Tarefas:**
- Criar `docker-compose.yml` na raiz do projeto:
  - Serviço `backend`: build do `backend/Dockerfile`, variáveis de `.env`, portas 8000
  - Serviço `frontend`: build do `frontend/Dockerfile`, variáveis de `.env`, portas 3000
  - Volume compartilhado para logs/output
  - Network padrão para comunicação interna
- Atualizar `backend/README.md` e `frontend/README.md` com instruções de `docker-compose up`
- Criar script `.env.docker` com valores padrão para ambiente containerizado

**Arquivos a tocar:**
- `docker-compose.yml` (novo)
- `backend/Dockerfile` (validar/expandir se necessário)
- `frontend/Dockerfile` (criar se não existir, usar Next.js padrão)
- `backend/README.md` (adicionar seção Docker Compose)
- `frontend/README.md` (adicionar seção Docker Compose)

**Validação:**
- `docker-compose up` sobe frontend e backend sem erros
- Frontend em http://localhost:3000, backend em http://localhost:8000
- Ambos conseguem se comunicar (frontend consegue fazer request para `/health` do backend)

---

### 1.2 Configuração Operacional Unificada (Headless, Timeouts, Saída)
**Por quê:** Prepara flags que serão controláveis depois; padroniza inicialização.

**Tarefas:**
- Expandir `backend/.env.example`:
  ```
  PLAYWRIGHT_HEADLESS=true
  PLAYWRIGHT_TIMEOUT_MS=45000
  SCRAPE_RETRY_COUNT=3
  OUTPUT_BUCKET=lattes-cvs
  OUTPUT_FOLDER_RAW=raw
  OUTPUT_FOLDER_STRUCTURED=structured
  BATCH_MAX_CONCURRENT=5
  BATCH_TIMEOUT_TOTAL_SECONDS=3600
  LOG_LEVEL=INFO
  ```
- Carregar essas variáveis em `backend/src/api/main.py` no startup
- Passar `headless` como parâmetro ao `buscar_lattes_candidatos()` e `scrape_lattes()` em `scraper.py`
- Adicionar logging estruturado com `LOG_LEVEL` para observabilidade mínima

**Arquivos a tocar:**
- `backend/.env.example` (expandir)
- `backend/src/api/main.py` (load de config no startup)
- `backend/src/core/scraper.py` (aceitar `headless` como parâmetro, aplicar em `async_playwright()`)

**Validação:**
- Mudar `PLAYWRIGHT_HEADLESS=false` e validar que o browser abre manualmente
- Mudar `SCRAPE_RETRY_COUNT=1` e observar comportamento de falha
- Confirmar logs estruturados no stdout

---

## Fase 2 — Robustez do Lote e Saídas (1,5 semanas)

### 2.1 Reforçar Endpoint `/scrape/batch`
**Por quê:** Maior confiabilidade, melhor visibilidade de erros e exportação de metadados.

**Tarefas:**
- Refatorar `POST /scrape/batch` para:
  1. Validar CSV com clara separação de "lido vs. vazio"
  2. Deduplicar nomes mantendo lista de duplicatas para relatório
  3. Iterar por nome com try-catch por item (hoje falha no batch inteiro se um item falha)
  4. Consolidar resultados em estrutura clara: sucesso, erro, timeout, dedup
  5. Gerar ZIP apenas de itens bem-sucedidos; relatório CSV de todos os itens com status
- Expandir `BatchItemSuccess` e `BatchItemError` com campos:
  - `resumo_estruturado` (opcional): formação, vínculo, contato
  - `timestamp_inicio`, `timestamp_fim`
  - `tentativas`, `ultima_tentativa_erro`
- Adicionar novo endpoint `GET /batch/{job_id}/status` para polling de progresso (futuro para job queue; hoje retorna resultado completo)

**Arquivos a tocar:**
- `backend/src/api/main.py` (refatorar `/scrape/batch`)
- `backend/src/core/scraper.py` (adicionar tryable wrapper por item)
- `frontend/src/lib/api.ts` (estender tipos `BatchItemSuccess`, `BatchItemError`)

**Validação:**
- Enviar CSV com 10 nomes, alguns válidos, alguns inválidos
- Confirmar que o processamento não para no primeiro erro
- Validar que ZIP contém apenas PDFs de itens bem-sucedidos
- Confirmar que o CSV de resultado mostra status e erro por linha

---

### 2.2 Geração de Metadados Estruturados (JSON, CSV)
**Por quês:** Atende ao TODO "JSON, HTML, CSV e etc."; permite consumo por outras ferramentas; facilita histórico.

**Tarefas:**
- Criar `backend/src/export/metadata.py`:
  - Classe `CVMetadata` com campos: nome, status, ultima_atualizacao, storage_path, pdf_url, duração, erro, formação_estruturada (grau, instituição, ano)
  - Função `to_json()` e `to_csv()` para converter lista de metadados
- Adicionar novo endpoint `GET /batch/{job_id}/export`:
  - Query param `format=json|csv|zip`
  - Retorna arquivo único com metadados da execução
- Em `/scrape/batch`, salvar metadados no Supabase Storage como `{job_id}_metadata.json`

**Arquivos a tocar:**
- `backend/src/export/metadata.py` (novo)
- `backend/src/api/main.py` (adicionar `GET /batch/{job_id}/export`)
- `backend/src/core/storage.py` (adicionar método para salvar JSON/CSV)
- `frontend/src/lib/api.ts` (adicionar função `downloadBatchExport()`)

**Validação:**
- Rodar um lote pequeno e confirmar que é possível baixar `metadata.json` com todos os itens
- Confirmar que o CSV é legível em Excel/scripts Python
- Validar que o ZIP, JSON e CSV no mesmo resultado não se conflitam nos downloads

---

### 2.3 Persistência Mínima (Metadados em Supabase)
**Por quê:** Libera histórico, reuso e auditoria sem exigir banco permanente complexo.

**Tarefas:**
- Criar schema Supabase (ou tabela local SQLite como fallback):
  - `scrape_jobs` (id, job_id, nome, status, timestamp_inicio, timestamp_fim, total_itens, sucesso_contar, erro_contar, metadata_path, resultado_zip)
  - `cv_results` (id, job_id, nome, status, erro, ultima_atualizacao, storage_path, duracao)
- Em `/scrape/batch`, após conclusão, inserir registro em `scrape_jobs`
- Adicionar novo endpoint `GET /history`:
  - Retorna últimos 50 jobs com status/contadores
  - Permite filtro por data/status
- Adicionar "reuse history" no frontend: dropdown de jobs passados para re-download

**Arquivos a tocar:**
- `backend/src/db/models.py` (novo): SQLAlchemy models para `ScrapeJob`, `CVResult`
- `backend/src/db/supabase_client.py` (novo): wrapper para inserir/ler histórico
- `backend/src/api/main.py` (adicionar `GET /history`, salvar após `/scrape/batch`)
- `frontend/src/lib/api.ts` (adicionar `getJobHistory()`)

**Validação:**
- Rodar um lote, confirmar que o registro aparece em Supabase
- Acessar `GET /history` e ver o lote listado
- Voltar ao frontend, ver histórico carregado e poder re-baixar ZIP do job anterior

---

## Fase 3 — UX Operacional e Saída Inicial (1,5 semanas)

### 3.1 Reorganizar Frontend para Dois Fluxos Claros
**Por quê:** Gestores usam principalmente lote; precisam de clareza entre fluxos e feedback visual melhor.

**Tarefas:**
- Refatorar `frontend/src/app/page.tsx`:
  - Nova navegação: aba "Um Currículo" vs. "Processar Lote"
  - Aba 1: busca + seleção + botão scrape + link de download
  - Aba 2: upload CSV + inputs de skip/limit + barra de progresso + tabela de resultados + botões de export
- Criar novo componente `BatchResultsTable` em `frontend/src/components`:
  - Tabela com colunas: Nome, Status (badge verde/vermelho), Duração, Ação (link download PDF ou erro visual)
  - Suporte a sort + filtro por status
- Adicionar novo componente `ProgressBar`:
  - Anima progresso de itens processados vs. total
  - Mostra tempo decorrido e ETA
- Adicionar "Histórico de Processamentos":
  - Sidebar simples com últimos 10 jobs, clicáveis para reabrir resultado

**Arquivos a tocar:**
- `frontend/src/app/page.tsx` (refatorar layout em abas)
- `frontend/src/components/BatchResultsTable.tsx` (novo)
- `frontend/src/components/ProgressBar.tsx` (novo)
- `frontend/src/components/JobHistory.tsx` (novo)
- `frontend/src/lib/api.ts` (atualizar tipos de resposta conforme Phase 2)

**Validação:**
- Abrir a aba "Um Currículo", buscar e scrape um nome
- Abrir a aba "Processar Lote", fazer upload de CSV pequeno
- Confirmar que a tabela mostra status e duração para cada item
- Clicar em histórico e reabrir um resultado anterior

---

### 3.2 Saída Institucional: Resumo Estruturado (JSON + DOCX Inicial)
**Por quê:** Gestores precisam de algo executável; resumo estruturado + DOCX inicial é diferenciador enxuto.

**Tarefas:**
- Criar `backend/src/export/resume_generator.py`:
  - Função `generate_structured_resume()` que extrai de PDF/texto:
    - Nome, data de atualização do CV
    - Formação: grau (grad, mestrado, doutorado, pós), instituição, ano início/fim
    - Vínculo: instituição atual, cargo, data início
    - Publicações recentes (top 5 por data)
    - Áreas de pesquisa (keywords)
  - Função `generate_docx_initial()` que cria DOCX com:
    - Logo/header UFSCAR
    - Seção de formação
    - Seção de vínculo
    - Seção de publicações
    - Link para PDF, JSON e dashboards internos
- Integrar ao `/scrape` e `/scrape/batch`:
  - Sempre gerar resumo estruturado
  - Opcionalmente gerar DOCX se flag `?generate_docx=true`
- Adicionar toggle no frontend "Gerar DOCX?" (checkbox na aba de lote)

**Arquivos a tocar:**
- `backend/src/export/resume_generator.py` (novo)
- `backend/src/core/storage.py` (adicionar método para salvar DOCX)
- `backend/src/api/main.py` (integrar resumo em `/scrape`, `/scrape/batch` com novo campo de resposta)
- `frontend/src/app/page.tsx` (adicionar checkbox "Gerar DOCX")
- `frontend/src/lib/api.ts` (estender params de batch upload)

**Validação:**
- Scrape um currículo, confirmar que resume_estruturado é retornado com formação
- Fazer lote com `?generate_docx=true`, confirmar que DOCX é gerado e linkável
- Abrir DOCX em office e validar formatting básico

---

### 3.3 Flag de Headless Controlável do Frontend
**Por quê:** Gestores podem precisar "ver" o scraping happening em debug; feature low-cost se já temos a config de backend pronta.

**Tarefas:**
- Adicionar novo endpoint `POST /scrape/config`:
  - Corpo: `{ "headless": true|false }`
  - Salva em estado temporário (ou Redis se disponível)
- Adicionar toggle no frontend em "Configurações" (nova aba/modal):
  - Checkbox "Modo Headless" (default: sim)
  - Botão "Aplicar"
- Ao fazer scrape/lote, enviar flag de headless encapsulada na request

**Arquivos a tocar:**
- `backend/src/api/main.py` (novo endpoint `POST /scrape/config`)
- `frontend/src/app/page.tsx` ou novo `frontend/src/components/Settings.tsx`
- `frontend/src/lib/api.ts` (nova função `updateScraperConfig()`)

**Validação:**
- Toggle headless para false no frontend
- Iniciar um scrape e confirmar que browser abre (visible)
- Toggle volta para true, scrape seguinte usa headless

---

## Fase 4 — Preparar IA, Sem Centralizar (Semana extra se tempo)

### 4.1 Abstração de Provedor LLM
**Por quê:** Evita lock-in em OpenAI; permite Gemini, Ollama local sem reescrever resumo.

**Tarefas:**
- Refatorar `backend/src/core/summarizer.py`:
  - Interface `BaseLLMProvider` com método `summarize(texto) -> str`
  - Implementação OpenAI, Gemini, Ollama
  - Seleção de provedor via env var `LLM_PROVIDER=openai|gemini|ollama`
- Adicionar variáveis de ambiente:
  ```
  LLM_PROVIDER=openai
  OPENAI_API_KEY=...
  GEMINI_API_KEY=...
  OLLAMA_BASE_URL=http://localhost:11434
  ```
- Manter endpoint `/summarize` existente mas agora agnóstico

**Arquivos a tocar:**
- `backend/src/core/summarizer.py` (refatorar com pattern Strategy)
- `backend/.env.example` (adicionar LLM vars)

**Validação:**
- Trocar `LLM_PROVIDER=gemini`, confirmar que resumo continua funcionando com Gemini
- Confirmar que Ollama local pode ser usado se disponível

---

## Fase 4b — Trilha Paralela: Investigação API Lattes
**Nota:** Não é bloqueador. Fazer em paralelo se houver recursos.

- Documentar pontos de integração atuais: `/search`, `/scrape`, `/scrape/by_href`
- Pesquisar se existe API aberta ou documentação reversa de endpoints CNPq
- Criar branch `investigate/lattes-api` com proof-of-concepts
- Decidir ROI após prototipagem

---

## Métricas de Sucesso por Fase

**Fase 1:**
- [ ] `docker-compose up` sobe stack completa em < 2 min
- [ ] Frontend e backend comunicam-se internamente
- [ ] Headless toggle funciona (browser abre/fecha conforme flag)

**Fase 2:**
- [ ] Lote com 10 nomes: se 8 OK, 2 falham, resultado mostra exatamente isso
- [ ] ZIP gerado apenas com PDFs okès, relatório CSV mostra todos os 10 com status
- [ ] `GET /history` retorna últimos 5 jobs rodados

**Fase 3:**
- [ ] Frontend tem 2 abas: "Um Currículo" e "Processar Lote", ambas funcionam
- [ ] Tabela de resultado mostra todos os itens com status visual
- [ ] Resumo estruturado (formação + vínculo) é retornado para cada currículo
- [ ] DOCX gerado tem logo, formação e links válidos

**Fase 4:**
- [ ] `LLM_PROVIDER=gemini` funciona alternativamente ao OpenAI
- [ ] Ollama local pode ser usado se rodando
- [ ] Investigação de API Lattes documentada, com POC ou decisão de não-gozo

---

## Próximos Passos

1. Validar este plano com stakeholders (é o que gestores/secretarias precisam?)
2. Preparar issues no GitHub com tarefas de cada fase
3. Começar pela Fase 1 (Docker Compose) nesta semana
4. Sprint semanal de refinamento e andamento

---

## Notas de Escopo

**Entram neste roadmap:**
- Operação local simples (Docker Compose)
- Robustez do lote (sem parar em erro único)
- Persistência mínima (metadados, histórico)
- Saídas estruturadas (JSON, CSV, DOCX inicial)
- UX clara para gestores
- Headless toggle operacional
- Preparação para múltiplos LLMs (sem dependência forte)

**Não entram agora (Fase 5+):**
- Chatbot/Janela UFSCAR
- RAG completo com news API
- Multiusuário / RBAC complexo
- Fila distribuída (Celery) até validar volume real
- Integração CCS UFSCAR como bloqueador
- Investigação profunda de API Lattes como item priorizado

**Adiar até estabilizar MVP:**
- Comparação de versões de CV
- Múltiplos templates institucionais
- Analytics dashboard
- GPUs/scaling massivo
