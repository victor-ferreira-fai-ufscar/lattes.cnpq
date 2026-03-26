#!/bin/bash

# Lattes Automator AI - Script de desenvolvimento
# Facilita a execução simultânea do backend e frontend

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Função para mostrar ajuda
show_help() {
    echo -e "${BLUE}🎓 Lattes Automator AI - Script de Desenvolvimento${NC}"
    echo ""
    echo "Uso: $0 [comando]"
    echo ""
    echo "Comandos:"
    echo "  setup     - Instalar dependências do backend e frontend"
    echo "  dev       - Executar backend e frontend simultaneamente"
    echo "  backend   - Executar apenas o backend (FastAPI)"
    echo "  frontend  - Executar apenas o frontend (Next.js)"
    echo "  docker    - Construir e executar backend em Docker"
    echo "  clean     - Limpar caches e arquivos temporários"
    echo "  help      - Mostrar esta ajuda"
    echo ""
    echo "Exemplos:"
    echo "  $0 setup    # Primeira vez"
    echo "  $0 dev      # Desenvolvimento normal"
    echo "  $0 backend  # Apenas API"
}

# Função para verificar dependências
check_dependencies() {
    if ! command -v uv &> /dev/null; then
        echo -e "${RED}❌ uv não encontrado. Instale: https://github.com/astral-sh/uv${NC}"
        exit 1
    fi

    if ! command -v pnpm &> /dev/null; then
        echo -e "${RED}❌ pnpm não encontrado. Instale: https://pnpm.io/installation${NC}"
        exit 1
    fi
}

# Setup
setup() {
    echo -e "${BLUE}🔧 Instalando dependências...${NC}"

    echo -e "${YELLOW}📦 Backend (Python + uv)...${NC}"
    cd backend && uv sync && cd ..

    echo -e "${YELLOW}🎨 Frontend (Node.js + pnpm)...${NC}"
    cd frontend && pnpm install && cd ..

    echo -e "${GREEN}✅ Setup completo!${NC}"
}

# Backend
run_backend() {
    echo -e "${BLUE}🐍 Iniciando FastAPI backend...${NC}"
    echo -e "${GREEN}📡 API disponível em: http://localhost:8000${NC}"
    echo -e "${GREEN}📚 Documentação: http://localhost:8000/docs${NC}"
    cd backend && uv run uvicorn src.api.main:app --reload --host 0.0.0.0 --port 8000
}

# Frontend
run_frontend() {
    echo -e "${BLUE}⚛️  Iniciando Next.js frontend...${NC}"
    echo -e "${GREEN}🌐 Interface disponível em: http://localhost:3000${NC}"
    cd frontend && pnpm dev
}

# Desenvolvimento simultâneo
dev() {
    check_dependencies

    echo -e "${BLUE}🚀 Iniciando desenvolvimento simultâneo...${NC}"
    echo -e "${GREEN}📡 Backend: http://localhost:8000${NC}"
    echo -e "${GREEN}🌐 Frontend: http://localhost:3000${NC}"
    echo ""

    # Usar parallel se disponível, senão sequencial
    if command -v parallel &> /dev/null; then
        parallel --ungroup ::: "run_backend" "run_frontend"
    else
        echo -e "${YELLOW}💡 Dica: Instale 'parallel' para execução simultânea real${NC}"
        echo -e "${YELLOW}   Ubuntu/Debian: sudo apt install parallel${NC}"
        echo -e "${YELLOW}   macOS: brew install parallel${NC}"
        echo ""
        run_backend &
        BACKEND_PID=$!
        run_frontend &
        FRONTEND_PID=$!

        # Aguardar interrupção
        trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null" INT TERM
        wait
    fi
}

# Docker
docker_ops() {
    echo -e "${BLUE}🐳 Operações Docker...${NC}"

    echo -e "${YELLOW}🏗️  Construindo imagem...${NC}"
    cd backend && docker build -t lattes-api . && cd ..

    echo -e "${YELLOW}🚀 Executando container...${NC}"
    echo -e "${GREEN}📡 API disponível em: http://localhost:8000${NC}"
    docker run -p 8000:8000 --env-file .env lattes-api
}

# Limpeza
clean() {
    echo -e "${BLUE}🧹 Limpando caches...${NC}"

    rm -rf backend/.venv
    rm -rf backend/__pycache__
    rm -rf backend/src/__pycache__
    rm -rf backend/src/api/__pycache__
    rm -rf backend/src/core/__pycache__
    rm -rf frontend/node_modules
    rm -rf frontend/.next
    rm -rf frontend/out

    echo -e "${GREEN}✅ Limpeza concluída!${NC}"
}

# Main
case "${1:-help}" in
    setup)
        setup
        ;;
    dev)
        dev
        ;;
    backend)
        check_dependencies
        run_backend
        ;;
    frontend)
        check_dependencies
        run_frontend
        ;;
    docker)
        docker_ops
        ;;
    clean)
        clean
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        echo -e "${RED}❌ Comando desconhecido: $1${NC}"
        echo ""
        show_help
        exit 1
        ;;
esac