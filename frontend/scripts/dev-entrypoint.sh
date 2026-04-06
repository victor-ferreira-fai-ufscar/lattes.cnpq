#!/bin/sh

set -eu

MANIFEST_STAMP_FILE="/app/node_modules/.manifest-sha256"
CURRENT_MANIFEST_SHA="$({
	sha256sum /app/package.json /app/pnpm-lock.yaml 2>/dev/null || true
	sha256sum /app/.npmrc 2>/dev/null || true
} | sha256sum | awk '{print $1}')"

if [ ! -d /app/node_modules ] || [ ! -f "$MANIFEST_STAMP_FILE" ] || [ "$(cat "$MANIFEST_STAMP_FILE" 2>/dev/null || true)" != "$CURRENT_MANIFEST_SHA" ]; then
	echo "[frontend] Installing dependencies to sync node_modules volume..."
	if [ -d /app/node_modules ]; then
		find /app/node_modules -mindepth 1 -maxdepth 1 -exec rm -rf {} +
	fi
	pnpm install --frozen-lockfile
	mkdir -p /app/node_modules
	printf "%s" "$CURRENT_MANIFEST_SHA" > "$MANIFEST_STAMP_FILE"
fi

exec pnpm run dev --hostname 0.0.0.0 --port "${FRONTEND_PORT:-3000}"