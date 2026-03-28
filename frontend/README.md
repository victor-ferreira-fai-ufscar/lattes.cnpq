# Frontend — Lattes Scraper

Frontend em Next.js 16 com React 19 para scraping interativo de currículos Lattes.

## O que faz

- Buscar docentes no Lattes por nome
- Selecionar e fazer scraping individual do currículo
- Processar lotes de nomes via CSV
- Gerar resumos com OpenAI (opcional)
- Visualizar logs e baixar PDFs

## Setup Rápido (Docker Compose — Recomendado)

```bash
# A partir da raiz do projeto
docker-compose up
```

- Frontend: http://localhost:3000
- Backend: http://localhost:8000

O **hot-reload** está ativado — qualquer mudança no código reflete na hora.

---

## Setup Local (Sem Docker)

```bash
# Instalar dependências
pnpm install

# Configurar variáveis de ambiente
cp .env.example .env.local

# Executar dev server
pnpm dev
```

Abra http://localhost:3000.

**Nota:** Certifique-se de que o backend está rodando em http://localhost:8000.

## Variáveis de Ambiente

```env
# URL do backend para requisições de API
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## Build para Produção

```bash
pnpm build
pnpm start
```
