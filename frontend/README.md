# Frontend Simplificado

Frontend mínimo em Next.js para integração com o backend.

## O que faz

- Exibe um formulário com nome do docente.
- Faz `POST /scrape` no backend.
- Mostra os dados retornados e link para download do PDF.

## Configuração

1. Copie o arquivo de ambiente:

```bash
cp .env.example .env.local
```

2. Configure a URL da API:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## Execução

```bash
pnpm install
pnpm dev
```

Abra `http://localhost:3000`.
