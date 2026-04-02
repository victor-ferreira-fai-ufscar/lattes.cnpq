# syntax=docker/dockerfile:1.7

FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    DEBIAN_FRONTEND=noninteractive

WORKDIR /app

# Instala ferramentas basicas
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt,sharing=locked \
    apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Instala uv copiando o binário oficial
COPY --from=ghcr.io/astral-sh/uv:0.5.2 /uv /uvx /bin/

# Instala dependencias exatamente como travadas no projeto
COPY pyproject.toml uv.lock ./
RUN --mount=type=cache,target=/root/.cache/uv,sharing=locked \
    uv sync --frozen --no-dev

# Instala browser do Playwright dentro do ambiente do projeto
RUN --mount=type=cache,target=/root/.cache/uv,sharing=locked \
    uv run playwright install --with-deps chromium

# Copia o código do projeto com a estrutura organizada
COPY src/ ./src/

# Executa o FastAPI por padrão
EXPOSE 8000
CMD ["uv", "run", "uvicorn", "src.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
