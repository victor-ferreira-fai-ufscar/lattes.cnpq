# Supabase

Esta pasta centraliza as informações do projeto Supabase usado pelo Lattes Automator AI.

## Estado Atual

- Projeto Supabase criado com sucesso
- URL do projeto disponível
- Chave publishable disponível
- Integração no backend ainda pendente

## Informacoes do Projeto

- URL: https://jxcdvunyobxkdlasctue.supabase.co
- Arquivo local com dados de acesso: infos

Importante: nao versione credenciais sensiveis (password e service role key). Se algum segredo ja foi exposto, gere novas chaves no painel do Supabase.

## Variaveis de Ambiente Recomendadas

Use no backend (arquivo .env):

```env
SUPABASE_URL=https://jxcdvunyobxkdlasctue.supabase.co
SUPABASE_ANON_KEY=<chave_publishable_ou_anon>
SUPABASE_SERVICE_ROLE_KEY=<service_role_key>
```

## Proximo Passo de Integracao (Backend)

1. Definir schema inicial (usuarios, buscas, documentos gerados)
2. Criar migrations SQL no Supabase
3. Adicionar cliente Supabase no backend para persistir:
	- historico de buscas
	- status de processamento
	- metadados dos DOCX gerados
4. Configurar RLS antes de expor dados em producao

## Estrutura Atual da Pasta

```text
supabase/
├── infos
└── README.md
```

## Links

- Dashboard: https://supabase.com/dashboard
- Documentacao: https://supabase.com/docs

Status: ativo (projeto criado), integracao em andamento.
