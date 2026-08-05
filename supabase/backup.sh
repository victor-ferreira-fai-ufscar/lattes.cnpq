#!/bin/sh
# Backup do Supabase self-hosted: banco + arquivos, sempre juntos.
#
# Os dois são inseparáveis. No disco cada objeto vira
# volumes/storage/<root>/<tenant>/<bucket>/<caminho>/<uuid-da-versao>, e só o
# Postgres sabe qual UUID é a versão atual de qual arquivo. Banco sem arquivos
# = metadados apontando pro vazio; arquivos sem banco = pastas de UUIDs
# ilegíveis. Restaurar exige o par do mesmo instante.
#
#   sh supabase/backup.sh              # -> ~/backups/lattes-supabase
#   DEST=/outro/lugar sh supabase/backup.sh
#
# Cron diário às 3h (ver `crontab -l`):
#   0 3 * * * cd /srv/projects/lattes.cnpq && sh supabase/backup.sh >> "$HOME/backups/lattes-supabase/backup.log" 2>&1
#
# ponytail: backup fica na mesma máquina. Protege contra erro de operação e
# corrupção do banco, não contra perda do disco — mandar pra fora quando o
# conteúdo do bucket justificar.

set -eu

# ~/backups em vez de /srv/backups: /srv não é gravável sem sudo, e o cron roda
# como usuário. Mesmo filesystem, então não muda nada em espaço.
DEST=${DEST:-$HOME/backups/lattes-supabase}
KEEP=${KEEP:-14}
STAMP=$(date +%Y%m%d-%H%M%S)

mkdir -p "$DEST"

# Um dump lógico basta: o banco só guarda metadados de objetos, é pequeno.
docker exec supabase-db pg_dump -U postgres -d postgres --clean --if-exists \
    | gzip > "$DEST/db-$STAMP.sql.gz"

# Rodado dentro do container: o diretório é de propriedade do usuário da imagem
# e não é legível pelo usuário do host.
#
# --xattrs é obrigatório, não detalhe: o storage-api guarda content-type e
# cache-control de cada objeto em extended attributes do arquivo. Um tar sem
# isso restaura os bytes e devolve HTTP 500 na leitura. Por isso debian (GNU
# tar) em vez de alpine — o tar do busybox ignora xattrs em silêncio.
docker run --rm \
    --volumes-from supabase-storage \
    -v "$DEST:/backup" \
    debian:12-slim \
    tar --xattrs --xattrs-include='*' --acls -czf "/backup/storage-$STAMP.tar.gz" -C /var/lib/storage .

# ponytail: retenção por contagem, não por tamanho. Se o bucket crescer a ponto
# de encher o disco, trocar por política de tamanho ou mandar pra fora da máquina.
for prefix in db storage; do
    ls -1t "$DEST/$prefix-"*.tar.gz "$DEST/$prefix-"*.sql.gz 2>/dev/null \
        | tail -n "+$((KEEP + 1))" | xargs -r rm -f
done

printf 'backup ok: %s\n' "$STAMP"
ls -lh "$DEST" | tail -4
