FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    DEBIAN_FRONTEND=noninteractive \
    HEADLESS=true

WORKDIR /app

# Instala ferramentas basicas
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Instala uv copiando o binário oficial
COPY --from=ghcr.io/astral-sh/uv:0.5.2 /uv /uvx /bin/

# Instala dependencias do python com uv e do playwright (navegador chromium)
RUN uv pip install --system fastapi uvicorn[standard] playwright google-genai python-dotenv rich python-docx pandas openai google-generativeai
RUN playwright install --with-deps chromium

# Copia o código do projeto com a estrutura organizada
COPY src/ ./src/
COPY pyproject.toml .

# Executa o FastAPI por padrão
EXPOSE 8000
CMD ["uvicorn", "src.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
