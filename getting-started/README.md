# 🚀 Getting Started - Lattes Automator AI

Bem-vindo! Esta pasta contém todos os scripts e configurações para facilitar o desenvolvimento e deploy do projeto Lattes Automator AI.

## ⚡ Início Ultra-Rápido

**Para começar AGORA mesmo, leia o [QUICKSTART.md](QUICKSTART.md)!**

## 📋 O que tem aqui?

- **`QUICKSTART.md`** - 🚀 Guia ultra-rápido (leia primeiro!)
- **`dev.sh`** - Script universal para desenvolvimento (recomendado)
- **`Makefile`** - Automação para usuários Linux/macOS com `make`
- **`.env.example`** - Exemplo de configuração de ambiente
- **`README.md`** - Esta documentação detalhada

## 🏃‍♂️ Início Rápido

### Primeira vez - Setup completo
```bash
# Opção 1: Script universal (recomendado)
./getting-started/dev.sh setup

# Opção 2: Make (se disponível)
make -f getting-started/Makefile setup
```

### Desenvolvimento normal
```bash
# Executar backend + frontend simultaneamente
./getting-started/dev.sh dev

# Ou individualmente
./getting-started/dev.sh backend   # Apenas API
./getting-started/dev.sh frontend  # Apenas interface
```

### Produção/Docker
```bash
# Construir e executar em Docker
./getting-started/dev.sh docker
```

## ⚙️ Configuração

1. **Copie o arquivo de exemplo**:
   ```bash
   cp getting-started/.env.example .env
   ```

2. **Configure suas APIs** no arquivo `.env`:
   ```bash
   # Edite o .env com suas chaves
   GEMINI_API_KEY=sua_chave_aqui
   OPENAI_API_KEY=sua_chave_aqui
   ```

3. **Execute o setup**:
   ```bash
   ./getting-started/dev.sh setup
   ```

## 📚 Comandos Disponíveis

### Desenvolvimento
```bash
./getting-started/dev.sh dev       # Backend + Frontend juntos
./getting-started/dev.sh backend   # Apenas FastAPI
./getting-started/dev.sh frontend  # Apenas Next.js
```

### Utilitários
```bash
./getting-started/dev.sh setup     # Instalar dependências
./getting-started/dev.sh clean     # Limpar caches
./getting-started/dev.sh docker    # Docker operations
./getting-started/dev.sh help      # Esta ajuda
```

### URLs de Acesso
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **Documentação API**: http://localhost:8000/docs

## 🐳 Docker (Produção)

Para executar em produção:

```bash
# Construir imagem
./getting-started/dev.sh docker

# Ou manualmente
cd backend
docker build -t lattes-api .
docker run -p 8000:8000 --env-file ../.env lattes-api
```

## 🔧 Solução de Problemas

### Erro: "uv não encontrado"
```bash
# Instalar uv
curl -LsSf https://astral.sh/uv/install.sh | sh
```

### Erro: "pnpm não encontrado"
```bash
# Instalar pnpm
npm install -g pnpm
```

### Erro: "make não encontrado"
```bash
# Use o script dev.sh ao invés do Makefile
./getting-started/dev.sh [comando]
```

### Portas ocupadas
```bash
# Verificar processos usando as portas
lsof -i :3000  # Frontend
lsof -i :8000  # Backend

# Ou alterar portas no .env
BACKEND_PORT=8001
FRONTEND_PORT=3001
```

## 📁 Estrutura do Projeto

```
lattes.cnpq/
├── backend/              # 🐍 API FastAPI
├── frontend/             # ⚛️ Interface Next.js
├── getting-started/      # 🛠️ Esta pasta
│   ├── Makefile         # Automação Make
│   ├── dev.sh          # Script universal
│   └── .env.example    # Configuração exemplo
├── supabase/            # 🗄️ Configurações BaaS
└── README.md           # Documentação principal
```

## 🚀 Próximos Passos

1. ✅ **Setup inicial** - Dependências instaladas
2. ✅ **Desenvolvimento local** - Backend + Frontend funcionando
3. 🔄 **Deploy Vercel** - Frontend na nuvem
4. 🔄 **Deploy Backend** - API na nuvem (Railway/Render)
5. 🔄 **Supabase** - Banco e autenticação
6. 🔄 **On-Premises** - Infraestrutura própria

## 💡 Dicas

- **Use `./getting-started/dev.sh dev`** para desenvolvimento diário
- **Configure o `.env`** antes do primeiro uso
- **Verifique as portas** se houver conflitos
- **Use Docker** para testes de produção

---

**Precisa de ajuda?** Consulte o [README principal](../README.md) para documentação completa!