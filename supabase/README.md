# Supabase (self-hosted)

O Supabase roda **nesta máquina**, não na nuvem. É usado só como object storage:
guarda os PDFs dos currículos e os artefatos gerados. Não há banco de aplicação,
tabelas, migrations, RLS nem autenticação — o backend só chama `storage.from_(...)`.

O projeto antigo na nuvem (`*.supabase.co`) foi desativado.

## Estrutura

```text
supabase/
├── docker/                        # stack oficial vendorizada, sem edições
│   ├── docker-compose.yml         # upstream — não editar (ver .upstream-commit)
│   ├── docker-compose.lattes.yml  # nossos ajustes (porta, limite de arquivo)
│   ├── .env                       # segredos, gitignored
│   └── volumes/                   # dados: banco + arquivos, gitignored
├── backup.sh                      # backup do par banco+arquivos
├── caddy-lattes-storage.conf      # cópia do bloco que vive no Caddy central
└── README.md
```

## Serviços

Só o caminho de storage sobe — 4 containers, ~490 MB:

| Serviço    | Papel                                              |
| ---------- | -------------------------------------------------- |
| `db`       | Postgres; guarda os metadados dos objetos           |
| `storage`  | storage-api; a API que o backend consome            |
| `rest`     | PostgREST; dependência do storage-api               |
| `imgproxy` | dependência declarada; ocioso (transformação off)   |

Ficam de fora `kong`, `studio`, `auth`, `realtime`, `functions`, `meta` e
`supavisor`: nada disso é usado, a porta 8000 do kong já é do chatbot desta
máquina, e o Caddy central faz o roteamento que seria função do kong.

## Operação

```bash
make supabase-up       # sobe
make supabase-ps       # status
make supabase-logs     # logs
make supabase-down     # derruba (os dados ficam em docker/volumes)
make supabase-backup   # backup do banco + arquivos
```

## Como o backend chega no storage

```
navegador / backend ──HTTPS──> lattes-storage.sup.fai.ufscar.br  (Caddy central)
                                 handle_path /storage/v1/*
                                   └──> 127.0.0.1:5100  (storage-api)
```

`SUPABASE_URL` precisa ser a URL **pública**, não `localhost`: o SDK monta os
links de download como `{SUPABASE_URL}/storage/v1/object/public/...`, e esses
links vão no JSON da API e viram `<a href>` no navegador do usuário.

O bloco do Caddy vive em `/srv/docker/caddy/Caddyfile`, fora deste repo; a cópia
em `caddy-lattes-storage.conf` existe só como referência.

## Variáveis usadas pelo backend

Em `backend/.env` (chaves vêm de `supabase/docker/.env`):

```env
SUPABASE_URL=https://lattes-storage.sup.fai.ufscar.br
SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY do supabase/docker/.env>
SUPABASE_ANON_KEY=<ANON_KEY do supabase/docker/.env>

SUPABASE_STORAGE_BUCKET=lattes-cvs
SUPABASE_STORAGE_FOLDER=raw
SUPABASE_STORAGE_PUBLIC=true
SUPABASE_SIGNED_URL_EXPIRES_IN=3600
```

Dev usa o bucket `lattes-cvs-dev` na mesma instância — a sobrescrita está em
`docker-compose.dev.yml`, para que dev não escreva por cima dos currículos de
produção.

## Backup: banco e arquivos são inseparáveis

No disco cada objeto vira
`volumes/storage/<root>/<tenant>/<bucket>/<caminho>/<uuid-da-versão>`. Só o
Postgres sabe qual UUID é a versão atual de qual arquivo. Banco sem arquivos são
metadados apontando pro vazio; arquivos sem banco são pastas de UUIDs ilegíveis.
`backup.sh` sempre gera o par, e restaurar exige o par do mesmo instante.

Cron sugerido:

```cron
0 3 * * * cd /srv/projects/lattes.cnpq && sh supabase/backup.sh >> /var/log/lattes-backup.log 2>&1
```

## Atualizar a stack

`docker/` é cópia fiel do upstream (`supabase/supabase`, commit em
`.upstream-commit`). Para atualizar, troque o diretório por uma cópia nova do
upstream e preserve `docker-compose.lattes.yml`, `.env` e `volumes/`. Faça
backup antes.
