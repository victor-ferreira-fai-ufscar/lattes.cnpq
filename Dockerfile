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
RUN uv pip install --system playwright google-genai python-dotenv rich streamlit python-docx pandas
RUN playwright install --with-deps chromium

# Copia o código do projeto com a estrutura organizada
COPY src/ ./src/
COPY app.py .
COPY pyproject.toml .

# Executa o Streamlit por padrão
EXPOSE 8501
CMD ["streamlit", "run", "app.py", "--server.headless=true"]
