#!/usr/bin/env bash
# Rebuilds and restarts after the code changed (new zip unpacked over the folder, or git pull).
# Keeps deploy/.env.production.   sudo deploy/update.sh [--mode docker|bare]
set -euo pipefail
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MODE=docker; [[ "${1:-}" == --mode ]] && MODE="$2"
cd "$APP_DIR"
if [[ "$MODE" == docker ]]; then
  cd deploy && docker compose --env-file .env.production up -d --build && docker image prune -f >/dev/null
else
  npm ci --no-audit --no-fund && npm run build
  cp -r .next/static .next/standalone/.next/ && cp -r public .next/standalone/
  chown -R office:office "$APP_DIR" && systemctl restart hermes-office
fi
PORT="$(grep -E '^APP_PORT=' "$APP_DIR/deploy/.env.production" | cut -d= -f2 || echo 3000)"
for _ in $(seq 1 60); do curl -fsS "http://127.0.0.1:${PORT:-3000}/api/health" && echo && exit 0; sleep 2; done
echo "app did not come back — check logs" >&2; exit 1
