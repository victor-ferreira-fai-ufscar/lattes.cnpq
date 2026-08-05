# Supabase (self-hosted)

O Supabase roda **nesta máquina**, não na nuvem. É usado só como object storage:
guarda os PDFs dos currículos e os artefatos gerados. Não há banco de aplicação,
tabelas, migrations, RLS nem autenticação — o backend só chama `storage.from_(...)`.

O projeto antigo na nuvem (`*.supabase.co`) foi desativado.

## Onde a stack mora

**Fora deste repo**, em `/srv/docker/lattes-supabase/`, junto das outras stacks
de infra da máquina (caddy, forgejo, ollama, open-webui) e versionada no repo
`/srv/docker`.

O motivo é o deploy automático: ele faz `git reset --hard origin/main` no
checkout da aplicação, então este repo precisa ser descartável. Serviço com
estado — banco e arquivos dos currículos — não pode viver dentro dele.

```text
/srv/docker/lattes-supabase/       # a stack (repo /srv/docker)
├── docker-compose.yml             # oficial, vendorizado sem editar (.upstream-commit)
├── docker-compose.lattes.yml      # nossos ajustes (porta 5100, limite de arquivo)
├── .env                           # segredos, gitignored
└── volumes/                       # dados: banco + arquivos, gitignored

supabase/                          # neste repo, só apoio
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

Em `backend/.env` (chaves vêm de `/srv/docker/lattes-supabase/.env`):

```env
SUPABASE_URL=https://lattes-storage.sup.fai.ufscar.br
SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY do /srv/docker/lattes-supabase/.env>
SUPABASE_ANON_KEY=<ANON_KEY do /srv/docker/lattes-supabase/.env>

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

**Copiar os arquivos exige preservar extended attributes.** O storage-api guarda
o `content-type` e o `cache-control` de cada objeto em xattrs (`user.supabase.*`),
não no banco. Cópia sem eles restaura os bytes e devolve HTTP 500 na leitura —
com uma listagem de bucket perfeitamente saudável, o que torna a falha confusa.
Na prática: use GNU tar com `--xattrs --xattrs-include='*'`. O `cp -a` e o `tar`
do busybox (alpine) descartam xattrs em silêncio.

Cron ativo (`crontab -l`), diário às 3h, retenção de 14, em `~/backups/lattes-supabase`:

```cron
0 3 * * * cd /srv/projects/lattes.cnpq && sh supabase/backup.sh >> /home/v1cferr/backups/lattes-supabase/backup.log 2>&1
```

Fica na mesma máquina: protege contra erro de operação e corrupção do banco,
não contra perda do disco.

## Atualizar a stack

`/srv/docker/lattes-supabase/docker-compose.yml` é cópia fiel do upstream
(`supabase/supabase`, commit em `.upstream-commit`). Para atualizar, troque os
arquivos por uma cópia nova do upstream preservando `docker-compose.lattes.yml`,
`.env` e `volumes/`. Rode `make supabase-backup` antes.
