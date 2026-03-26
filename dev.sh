#!/bin/bash

# Lattes Automator AI - Launcher Script
# Redireciona para os scripts em getting-started/

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GETTING_STARTED_DIR="$SCRIPT_DIR/getting-started"

if [ ! -f "$GETTING_STARTED_DIR/dev.sh" ]; then
    echo "❌ Erro: Script dev.sh não encontrado em $GETTING_STARTED_DIR"
    echo "📁 Verifique se a pasta getting-started existe"
    exit 1
fi

# Executar o script real
exec "$GETTING_STARTED_DIR/dev.sh" "$@"