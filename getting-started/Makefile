.PHONY: help setup backend frontend dev clean docker-build docker-run

# Default target
help:
	@echo "🎓 Lattes Automator AI - Comandos disponíveis:"
	@echo ""
	@echo "Setup:"
	@echo "  make setup          - Instalar dependências do backend e frontend"
	@echo ""
	@echo "Desenvolvimento:"
	@echo "  make dev            - Executar backend e frontend simultaneamente"
	@echo "  make backend        - Executar apenas o backend (FastAPI)"
	@echo "  make frontend       - Executar apenas o frontend (Next.js)"
	@echo ""
	@echo "Docker:"
	@echo "  make docker-build   - Construir imagem Docker do backend"
	@echo "  make docker-run     - Executar container Docker do backend"
	@echo ""
	@echo "Utilitários:"
	@echo "  make clean          - Limpar caches e arquivos temporários"
	@echo "  make help           - Mostrar esta ajuda"

# Setup
setup:
	@echo "🔧 Instalando dependências..."
	@echo "📦 Backend (Python + uv)..."
	cd backend && uv sync
	@echo "🎨 Frontend (Node.js + pnpm)..."
	cd frontend && pnpm install
	@echo "✅ Setup completo!"

# Development
dev:
	@echo "🚀 Iniciando desenvolvimento..."
	@echo "📡 Backend: http://localhost:8000"
	@echo "🌐 Frontend: http://localhost:3000"
	@echo ""
	@make -j2 backend frontend

backend:
	@echo "🐍 Iniciando FastAPI backend..."
	cd backend && uv run uvicorn src.api.main:app --reload --host 0.0.0.0 --port 8000

frontend:
	@echo "⚛️  Iniciando Next.js frontend..."
	cd frontend && pnpm dev

# Docker
docker-build:
	@echo "🏗️  Construindo imagem Docker..."
	cd backend && docker build -t lattes-api .

docker-run:
	@echo "🐳 Executando container Docker..."
	docker run -p 8000:8000 --env-file .env lattes-api

# Clean
clean:
	@echo "🧹 Limpando caches..."
	rm -rf backend/.venv
	rm -rf backend/__pycache__
	rm -rf backend/src/__pycache__
	rm -rf backend/src/api/__pycache__
	rm -rf backend/src/core/__pycache__
	rm -rf frontend/node_modules
	rm -rf frontend/.next
	rm -rf frontend/out
	@echo "✅ Limpeza concluída!"