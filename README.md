# 🎓 Lattes Automator AI

Ferramenta inteligente para extração e resumo de currículos da Plataforma Lattes. Ideal para pesquisadores, gestores acadêmicos e analistas que precisam de resumos executivos de alta qualidade a partir de perfis do CNPq.

---

## 🏗️ Arquitetura

Este projeto utiliza uma arquitetura de monorepo separando responsabilidades claras:

- **Backend** (`/backend`): API FastAPI em Python para scraping e processamento de dados
- **Frontend** (`/frontend`): Interface Next.js para interação com o usuário
- **Supabase** (`/supabase`): Configurações para banco de dados (futuro)

---

## 🚀 Como Executar

### Backend (API)

```bash
cd backend
uv sync  # Instalar dependências
uv run uvicorn src.api.main:app --reload  # Executar API
```

A API ficará disponível em `http://localhost:8000`

### Frontend (Interface Web)

```bash
cd frontend
pnpm install  # Instalar dependências
pnpm dev      # Executar desenvolvimento
```

A interface ficará disponível em `http://localhost:3000`

### Docker (Produção)

```bash
cd backend
docker build -t lattes-api .
docker run -p 8000:8000 lattes-api
```

---

## 🔑 Configurando sua Chave API

Para que a inteligência artificial funcione, você precisa de uma chave gratuita do Google:

1. Acesse o [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Clique em **"Create API key"**
3. Copie o código gerado
4. Configure a variável de ambiente `GEMINI_API_KEY` ou passe via interface

---

## 📋 Funcionalidades Principais

- **Busca Individual**: Digite o nome completo e obtenha resumo estruturado
- **Processamento em Lote**: Upload de arquivos `.txt` ou `.csv` para processamento em lote
- **Relatório Word**: Geração automática de documentos `.docx` profissionais
- **API REST**: Endpoints para integração com outros sistemas

---

## 🛠️ Tecnologias

### Backend

- **Python 3.11+**
- **FastAPI**: Framework web moderno e rápido
- **Playwright**: Automação web headless
- **Google Gemini API**: Processamento de linguagem natural
- **uv**: Gerenciador de pacotes ultrarrápido

### Frontend

- **Next.js 14+**: Framework React com App Router
- **TypeScript**: Tipagem estática
- **Tailwind CSS**: Estilização utilitária
- **API Client**: Cliente HTTP para comunicação com backend

---

## 📁 Estrutura do Projeto

```bash
.
├── backend/                   # API FastAPI
│   ├── src/
│   │   ├── api/               # Endpoints FastAPI
│   │   │   ├── main.py        # Ponto de entrada
│   │   │   ├── routes.py      # Rotas da API
│   │   │   └── schemas.py     # Modelos Pydantic
│   │   ├── core/              # Lógica de negócio
│   │   │   ├── scraper.py     # Scraping Lattes
│   │   │   └── document_maker.py # Geração DOCX
│   │   └── __init__.py
│   ├── docs/                  # Dados de exemplo
│   ├── scripts/               # Scripts utilitários
│   ├── pyproject.toml         # Configuração uv
│   ├── uv.lock
│   └── Dockerfile
├── frontend/                  # Interface Next.js
│   ├── src/
│   │   ├── app/               # App Router
│   │   ├── components/        # Componentes React
│   │   ├── lib/               # Utilitários
│   │   └── types/             # Tipos TypeScript
│   ├── package.json
│   └── tsconfig.json
└── README.md
```

---

## 🔧 Desenvolvimento

### Configuração Inicial

```bash
# Backend
cd backend
uv sync
playwright install

# Frontend
cd ../frontend
pnpm install
```

### Executar em Desenvolvimento

```bash
# Terminal 1 - Backend
cd backend && uv run uvicorn src.api.main:app --reload

# Terminal 2 - Frontend
cd frontend && pnpm dev
```

---

## 📊 API Endpoints

- `GET /health` - Verificação de saúde
- `POST /scrape` - Processar nome individual
- `POST /scrape/batch` - Processar lista de nomes
- `GET /download/{filename}` - Baixar arquivo gerado

---

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/nova-funcionalidade`)
3. Commit suas mudanças (`git commit -am 'Adiciona nova funcionalidade'`)
4. Push para a branch (`git push origin feature/nova-funcionalidade`)
5. Abra um Pull Request

---

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo `LICENSE` para mais detalhes.

- **Playwright Not Installed**: O `run.bat` já tenta instalar o Chromium automaticamente com `playwright install chromium`.

---
Desenvolvido com foco em produtividade acadêmica.
