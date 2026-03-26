# 🎓 Lattes Automator AI

> **Automação Inteligente para Currículos Lattes** - Transforme dados acadêmicos em insights executivos com IA

Uma ferramenta completa para extração, processamento e análise de currículos da Plataforma Lattes do CNPq. Desenvolvida para pesquisadores, gestores acadêmicos e analistas que precisam de resumos executivos de alta qualidade a partir de perfis acadêmicos.

## 📋 O que é o Projeto?

O **Lattes Automator AI** automatiza o processo de coleta e análise de currículos Lattes, oferecendo:

- **Extração Automática**: Coleta dados diretamente da plataforma Lattes
- **Resumos com IA**: Geração de perfis executivos usando Google Gemini e OpenAI
- **Relatórios Profissionais**: Documentos Word estruturados e editáveis
- **Processamento em Lote**: Análise de múltiplos currículos simultaneamente
- **Interface Web Moderna**: Experiência intuitiva e responsiva

### 🎯 Para quem serve?

- **Pesquisadores**: Análise rápida de colaboradores e concorrentes
- **Gestores Acadêmicos**: Avaliação de candidatos e equipe
- **Analistas**: Estudos de mercado acadêmico e tendências
- **Recrutadores**: Triagem eficiente de perfis acadêmicos
- **Instituições**: Automação de processos de admissão e avaliação

## 🏗️ Arquitetura e Stack Tecnológica

### Arquitetura de Monorepo

```
lattes.cnpq/
├── backend/                   # 🐍 API FastAPI (Python)
│   ├── src/
│   │   ├── api/               # Endpoints REST
│   │   ├── core/              # Lógica de negócio
│   │   └── ...
│   ├── pyproject.toml         # 📦 Gerenciamento uv
│   └── Dockerfile
├── frontend/                  # ⚛️ Interface Next.js
│   ├── src/
│   │   ├── app/               # App Router
│   │   ├── components/        # Componentes React
│   │   └── ...
│   ├── package.json           # 📦 Gerenciamento pnpm
│   └── tsconfig.json
├── getting-started/           # 🛠️ Scripts de automação
│   ├── dev.sh                # Script universal
│   ├── Makefile              # Automação Make
│   ├── .env.example          # Configuração exemplo
│   └── README.md             # Guia de uso
├── supabase/                  # 🗄️ Configurações BaaS
│   └── README.md             # Planejamento Supabase
└── README.md                  # 📖 Esta documentação
```

### Stack Tecnológica

#### Backend (Python)
- **Framework**: FastAPI - API moderna e performática
- **Linguagem**: Python 3.11+ com tipagem completa
- **Gerenciador**: uv - Ultrarrápido e confiável
- **Web Scraping**: Playwright - Automação headless
- **IA**: Google Gemini API + OpenAI API
- **Documentos**: python-docx - Geração de Word
- **Validação**: Pydantic - Modelos de dados robustos

#### Frontend (TypeScript)
- **Framework**: Next.js 14+ com App Router
- **Linguagem**: TypeScript - Tipagem estática
- **Gerenciador**: pnpm - Performático e eficiente
- **Styling**: Tailwind CSS - Utilitário e moderno
- **Componentes**: React 19 com hooks modernos
- **Build**: Turbopack - Compilação ultrarrápida

#### Infraestrutura
- **Containerização**: Docker para backend
- **BaaS**: Supabase (futuro - banco e auth)
- **Deploy**: Vercel (frontend) + On-premises (backend)

## 🚀 Como Usar

### Instalação Rápida

```bash
# Clone o repositório
git clone https://github.com/victor-ferreira-fai-ufscar/lattes.cnpq
cd lattes.cnpq

# ⚡ INÍCIO ULTRA-RÁPIDO (recomendado)
./dev.sh dev

# Ou veja o guia completo em getting-started/
cat getting-started/QUICKSTART.md
```

### Desenvolvimento

```bash
# Executar tudo simultaneamente (do root)
./dev.sh dev

# Ou da pasta getting-started
./getting-started/dev.sh dev

# URLs de acesso:
# 🌐 Frontend: http://localhost:3000
# 📡 Backend API: http://localhost:8000
# 📚 Documentação API: http://localhost:8000/docs
```

### Desenvolvimento Individual

```bash
# Apenas backend
./dev.sh backend

# Apenas frontend
./dev.sh frontend
```

### Produção

```bash
# Docker (backend)
./dev.sh docker
```

## 🔑 Configuração

### Chaves de API

1. **Google Gemini** (Recomendado):
   - Acesse: https://aistudio.google.com/app/apikey
   - Crie uma chave gratuita
   - Configure: `GEMINI_API_KEY=your_key_here`

2. **OpenAI** (Alternativo):
   - Acesse: https://platform.openai.com/api-keys
   - Configure: `OPENAI_API_KEY=your_key_here`

### Arquivo .env

```bash
# API Keys
GEMINI_API_KEY=your_gemini_key
OPENAI_API_KEY=your_openai_key

# Configurações (opcionais)
HEADLESS=true
LOG_LEVEL=INFO
```

## 📁 Estrutura Detalhada

### Backend (`/backend`)
```
backend/
├── src/
│   ├── api/               # 🎯 Camada da API
│   │   ├── main.py        # Ponto de entrada FastAPI
│   │   ├── routes.py      # Endpoints (/scrape, /batch)
│   │   └── schemas.py     # Modelos Pydantic
│   ├── core/              # 🧠 Lógica de negócio
│   │   ├── scraper.py     # Scraping Lattes + IA
│   │   └── document_maker.py # Geração DOCX
│   └── __init__.py
├── docs/                  # 📄 Dados de exemplo
├── scripts/               # 🔧 Utilitários
├── pyproject.toml         # ⚙️ Configuração uv
├── uv.lock               # 🔒 Lockfile dependências
└── Dockerfile            # 🐳 Containerização
```

### Frontend (`/frontend`)
```
frontend/
├── src/
│   ├── app/               # 🚀 App Router Next.js
│   │   ├── layout.tsx     # Layout principal
│   │   └── page.tsx       # Página inicial
│   ├── components/        # 🧩 Componentes React
│   │   ├── Header.tsx     # Cabeçalho com branding
│   │   └── IndividualSearch.tsx # Formulário de busca
│   ├── lib/               # 🔌 Utilitários
│   │   └── api.ts         # Cliente HTTP para backend
│   └── types/             # 📝 Tipos TypeScript
│       └── api.ts         # Interfaces da API
├── public/                # 🖼️ Assets estáticos
├── package.json           # 📦 Dependências pnpm
├── pnpm-lock.yaml        # 🔒 Lockfile pnpm
└── tailwind.config.ts    # 🎨 Configuração Tailwind
```

## 🔌 API Endpoints

### Core Endpoints

- `GET /health` - Verificação de saúde da API
- `POST /scrape` - Processar currículo individual
- `POST /scrape/batch` - Processar múltiplos currículos
- `GET /download/{filename}` - Baixar relatório gerado

### Exemplo de Uso

```bash
# Busca individual
curl -X POST http://localhost:8000/scrape \
  -H "Content-Type: application/json" \
  -d '{
    "nome": "João Silva",
    "provedor": "Google Gemini",
    "modelo": "gemini-2.0-flash",
    "api_key": "your_key"
  }'
```

## 🎯 Funcionalidades

### ✅ Implementadas
- ✅ Extração automática de currículos Lattes
- ✅ Integração com Google Gemini e OpenAI
- ✅ Geração de relatórios Word profissionais
- ✅ Interface web responsiva
- ✅ Processamento individual e em lote
- ✅ API REST completa
- ✅ Containerização Docker
- ✅ Monorepo organizado

### 🚧 Planejadas
- 🔄 Autenticação e usuários (Supabase Auth)
- 🔄 Histórico de buscas (Supabase Database)
- 🔄 Dashboard analítico
- 🔄 Exportação para PDF
- 🔄 API rate limiting
- 🔄 Cache inteligente
- 🔄 Webhooks para notificações

## 🚀 Roadmap e Deploy

### Fase Atual: Desenvolvimento Local
- ✅ Monorepo configurado
- ✅ Backend FastAPI funcional
- ✅ Frontend Next.js responsivo
- ✅ Scripts de automação

### Próxima Fase: Deploy Híbrido
- **Frontend**: Vercel (já configurado para Next.js)
- **Backend**: Railway/Render ou VPS
- **Banco**: Supabase (PostgreSQL + Auth)

### Fase Final: On-Premises
- **Infraestrutura**: Docker Compose completo
- **Banco**: PostgreSQL local
- **Deploy**: Servidor próprio/institucional
- **Backup**: Estratégia de dados

## 🛠️ Desenvolvimento

### Pré-requisitos

- **Python 3.11+**
- **Node.js 18+**
- **uv** (gerenciador Python)
- **pnpm** (gerenciador Node.js)
- **Docker** (opcional)

### Comandos Úteis

```bash
# Setup inicial
./dev.sh setup

# Desenvolvimento
./dev.sh dev

# Limpeza
./dev.sh clean

# Testes
cd backend && uv run pytest
cd frontend && pnpm test

# Build produção
cd backend && docker build -t lattes-api .
cd frontend && pnpm build
```

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch: `git checkout -b feature/nova-funcionalidade`
3. Commit suas mudanças: `git commit -am 'Adiciona nova funcionalidade'`
4. Push: `git push origin feature/nova-funcionalidade`
5. Abra um Pull Request

### Padrões de Código

- **Backend**: Black + isort + mypy
- **Frontend**: ESLint + Prettier
- **Commits**: Conventional Commits
- **Documentação**: Docstrings + JSDoc

## 📄 Licença

Este projeto está sob a licença **MIT**. Veja o arquivo `LICENSE` para detalhes.

## 🙏 Agradecimentos

- **CNPq** pela plataforma Lattes
- **Google** pelo Gemini AI
- **OpenAI** pela API GPT
- **Comunidade Open Source** pelos ferramentas incríveis

---

**Desenvolvido com ❤️ para a comunidade acadêmica brasileira**
