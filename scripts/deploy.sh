#!/usr/bin/env bash
# CD do Lattes Automator AI.
#
# Roda por cron no CHECKOUT DE DEPLOY dedicado (/srv/deploy/lattes.cnpq).
# Sincroniza com origin/main e republica em lattes.sup só se a main avançou.
# NÃO editar esse checkout à mão — quem edita usa seu próprio clone e faz merge
# na main. Mesmo padrão de fai-prestacao-de-contas e casos-de-uso-4-5-8.
#
# O que este script NÃO toca: a stack do Supabase. Ela é um serviço com estado,
# mora em /srv/docker/lattes-supabase e sobe/desce pelo `make supabase-*`.
# Um deploy da aplicação não pode derrubar o storage.
set -euo pipefail
export PATH="/usr/local/bin:/usr/bin:/bin:${PATH:-}"
export HOME="${HOME:-/home/v1cferr}"

REPO="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO"

# lock: sem execuções concorrentes (cron + deploy manual)
exec 9>"$REPO/../.lattes-deploy.lock"
flock -n 9 || exit 0

# a partir daqui, tudo vai pro log (silencioso quando não há o que publicar)
exec >>"$REPO/../lattes-deploy.log" 2>&1

git fetch --quiet origin main
# --short em vez de ${VAR:0:7}: assim o script roda igual em bash e em dash,
# e um `sh deploy.sh` distraído não quebra com "Bad substitution".
LOCAL="$(git rev-parse --short HEAD)"
REMOTE="$(git rev-parse --short origin/main)"
[ "$LOCAL" = "$REMOTE" ] && exit 0    # nada novo na main

# backend/.env é gitignored e carrega as chaves do Supabase. Sem ele o backend
# sobe e falha em todo /scrape — melhor não publicar do que publicar quebrado.
if [ ! -f "$REPO/backend/.env" ]; then
    echo "=== $(date '+%F %T') ABORTADO: backend/.env ausente em $REPO ==="
    exit 1
fi

echo "=== $(date '+%F %T') publicando $LOCAL -> $REMOTE ==="
git reset --hard origin/main
# docker-compose.override.yml (produção) é auto-carregado; ver Makefile.
docker compose up -d --build

# Fumaça: se o backend não responder, o log registra em vez de fingir sucesso.
sleep 15
if curl -fsS --max-time 20 http://localhost:8001/health >/dev/null; then
    echo "=== ok: $(git rev-parse --short HEAD) em $(date '+%T') ==="
else
    echo "=== ATENÇÃO: publicado $(git rev-parse --short HEAD), mas /health não respondeu ==="
    exit 1
fi
