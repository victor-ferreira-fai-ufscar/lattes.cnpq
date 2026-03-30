# Supabase

Esta pasta centraliza as informações do projeto Supabase usado pelo Lattes Automator AI.

## Estado atual

- Projeto Supabase ativo e acessível
- Integração com Supabase Storage já implementada no backend
- Upload de PDFs individuais e ZIP consolidado já usa Supabase
- Persistência em banco (tabelas, migrations e RLS) ainda não implementada

## Informações do projeto

- Project URL: https://jxcdvunyobxkdlasctue.supabase.co
- Direct connection string: postgresql://postgres:[YOUR-PASSWORD]@db.jxcdvunyobxkdlasctue.supabase.co:5432/postgres
- Arquivo local com anotações: infos

## CLI setup

```bash
supabase login
supabase init
supabase link --project-ref jxcdvunyobxkdlasctue
```

## Variáveis de ambiente usadas pelo backend

Arquivo: backend/.env

```env
SUPABASE_URL=https://jxcdvunyobxkdlasctue.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service_role_key>
# opcional como fallback caso SERVICE_ROLE não esteja definido
SUPABASE_ANON_KEY=<anon_or_publishable_key>

SUPABASE_STORAGE_BUCKET=lattes-cvs
SUPABASE_STORAGE_FOLDER=raw
SUPABASE_STORAGE_PUBLIC=true
SUPABASE_SIGNED_URL_EXPIRES_IN=3600
```

Observação importante: para funcionamento do upload no backend, é obrigatório definir SUPABASE_URL e ao menos uma chave entre SUPABASE_SERVICE_ROLE_KEY ou SUPABASE_ANON_KEY.

## Próximos passos (banco de dados)

1. Definir schema inicial de tabelas para histórico e auditoria.
2. Criar migrations versionadas via Supabase CLI.
3. Configurar políticas RLS antes de exposição em produção.
4. Integrar leitura/escrita dessas tabelas no backend.

## Estrutura da pasta

```text
supabase/
├── infos
└── README.md
```

## Links úteis

- Dashboard: https://supabase.com/dashboard
- Documentação: https://supabase.com/docs
