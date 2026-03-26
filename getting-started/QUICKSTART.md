# 🚀 Quick Start - Lattes Automator AI

## ⚡ Início Ultra-Rápido

Se você já tem tudo instalado, execute:

```bash
# Do root do projeto
./dev.sh dev
```

Isso vai:
1. ✅ Verificar dependências
2. 🐍 Iniciar FastAPI backend (porta 8000)
3. ⚛️ Iniciar Next.js frontend (porta 3000)
4. 🌐 Abrir automaticamente no navegador

## 📋 URLs Importantes

- **Interface Web**: http://localhost:3000
- **API Backend**: http://localhost:8000
- **Documentação API**: http://localhost:8000/docs
- **Health Check**: http://localhost:8000/health

## 🔧 Primeiro Uso

Se for a primeira vez:

```bash
# 1. Configurar ambiente
cp getting-started/.env.example .env
# Edite o .env com suas chaves API

# 2. Instalar dependências
./dev.sh setup

# 3. Desenvolver
./dev.sh dev
```

## 🆘 Problemas Comuns

### "Comando não encontrado"
```bash
# Instalar uv (Python)
curl -LsSf https://astral.sh/uv/install.sh | sh

# Instalar pnpm (Node.js)
npm install -g pnpm
```

### "Porta já em uso"
```bash
# Verificar processos
lsof -i :3000  # Frontend
lsof -i :8000  # Backend

# Ou alterar portas no .env
BACKEND_PORT=8001
FRONTEND_PORT=3001
```

### "API key inválida"
```bash
# Verificar .env
cat .env | grep API_KEY

# Pegar nova chave:
# Gemini: https://aistudio.google.com/app/apikey
# OpenAI: https://platform.openai.com/api-keys
```

---

**Para documentação completa, veja o [README principal](../README.md)**