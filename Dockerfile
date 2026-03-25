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
RUN uv pip install --system playwright google-genai python-dotenv rich
RUN playwright install --with-deps chromium

# Copia o código do bot
COPY scraper.py .

# Executa o bot
CMD ["python", "scraper.py"]
