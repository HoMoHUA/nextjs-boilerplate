#!/usr/bin/env bash
# Hermes Office — one-shot production setup on a Debian/Ubuntu server.
# Idempotent: safe to run again (keeps existing secrets in deploy/.env.production).
#
#   sudo deploy/setup.sh --domain office.example.com --email you@example.com \
#        [--mode docker|bare] [--password PW] [--hermes-url URL] [--hermes-key KEY] \
#        [--app-port 3000] [--skip-dns-check]
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$APP_DIR/deploy/.env.production"
MODE=docker DOMAIN="" EMAIL="" PASSWORD="" HERMES_URL="" HERMES_KEY="" APP_PORT="" SKIP_DNS=false

log()  { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[warn]\033[0m %s\n' "$*"; }
die()  { printf '\033[1;31m[error]\033[0m %s\n' "$*" >&2; exit 1; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --domain) DOMAIN="$2"; shift 2 ;;
    --email) EMAIL="$2"; shift 2 ;;
    --mode) MODE="$2"; shift 2 ;;
    --password) PASSWORD="$2"; shift 2 ;;
    --hermes-url) HERMES_URL="$2"; shift 2 ;;
    --hermes-key) HERMES_KEY="$2"; shift 2 ;;
    --app-port) APP_PORT="$2"; shift 2 ;;
    --skip-dns-check) SKIP_DNS=true; shift ;;
    -h|--help) sed -n '2,9p' "$0"; exit 0 ;;
    *) die "unknown option: $1" ;;
  esac
done

[[ $EUID -eq 0 ]] || die "run as root (sudo)"
[[ "$MODE" == docker || "$MODE" == bare ]] || die "--mode must be docker or bare"
command -v apt-get >/dev/null || die "this script supports Debian/Ubuntu (apt) only"

# ---------- env file: keep what exists, fill in what was passed or is missing ----------
touch "$ENV_FILE"; chmod 600 "$ENV_FILE"
get() { grep -E "^$1=" "$ENV_FILE" | tail -1 | cut -d= -f2- || true; }
put() { # put KEY VALUE (only when VALUE is non-empty)
  [[ -n "$2" ]] || return 0
  if grep -qE "^$1=" "$ENV_FILE"; then
    local tmp; tmp="$(mktemp)"; awk -v k="$1" -v v="$2" -F= 'BEGIN{OFS="="} $1==k{print k,v; next} {print}' "$ENV_FILE" >"$tmp" && cat "$tmp" >"$ENV_FILE" && rm -f "$tmp"
  else
    printf '%s=%s\n' "$1" "$2" >>"$ENV_FILE"
  fi
}
put DOMAIN "$DOMAIN"; put ACME_EMAIL "$EMAIL"; put APP_PORT "$APP_PORT"
put HERMES_API_URL "$HERMES_URL"; put HERMES_API_KEY "$HERMES_KEY"; put OFFICE_PASSWORD "$PASSWORD"
[[ -n "$(get APP_PORT)" ]] || put APP_PORT 3000
[[ -n "$(get HERMES_API_URL)" ]] || put HERMES_API_URL "http://127.0.0.1:8642/v1"
[[ -n "$(get HERMES_MODEL)" ]] || put HERMES_MODEL hermes-agent
[[ -n "$(get CLAUDE_CODE_ENABLED)" ]] || put CLAUDE_CODE_ENABLED false
GENERATED_PASSWORD=""
if [[ -z "$(get OFFICE_PASSWORD)" ]]; then GENERATED_PASSWORD="$(openssl rand -base64 18 | tr -d '/+=' | cut -c1-20)"; put OFFICE_PASSWORD "$GENERATED_PASSWORD"; fi
[[ -n "$(get OFFICE_SESSION_SECRET)" ]] || put OFFICE_SESSION_SECRET "$(openssl rand -hex 32)"

DOMAIN="$(get DOMAIN)"; EMAIL="$(get ACME_EMAIL)"; APP_PORT="$(get APP_PORT)"
[[ -n "$DOMAIN" ]] || die "--domain is required (first run)"
[[ -n "$EMAIL" ]] || die "--email is required (first run; used for the TLS certificate)"

# ---------- preflight ----------
log "Installing base tools"
apt-get update -qq && apt-get install -y -qq curl ca-certificates openssl dnsutils gnupg >/dev/null

if [[ "$SKIP_DNS" != true ]]; then
  PUBLIC_IP="$(curl -fsS4 --max-time 8 https://api.ipify.org || true)"
  DNS_IPS="$(dig +short A "$DOMAIN" | tr '\n' ' ')"
  if [[ -z "$DNS_IPS" ]]; then die "$DOMAIN has no A record yet. Point it at ${PUBLIC_IP:-this server} and retry (or --skip-dns-check)."; fi
  if [[ -n "$PUBLIC_IP" && " $DNS_IPS " != *" $PUBLIC_IP "* ]]; then
    die "$DOMAIN resolves to [$DNS_IPS] but this server is $PUBLIC_IP. Fix the A record (or --skip-dns-check if behind a proxy/CDN)."
  fi
  log "DNS ok: $DOMAIN → $DNS_IPS"
fi

if command -v ufw >/dev/null && ufw status | grep -q "Status: active"; then
  log "Opening ports 80 and 443 in ufw"; ufw allow 80/tcp >/dev/null; ufw allow 443/tcp >/dev/null
fi
if ss -ltn "( sport = :80 or sport = :443 )" | grep -q LISTEN && ! systemctl is-active --quiet caddy 2>/dev/null && ! docker ps --format '{{.Names}}' 2>/dev/null | grep -q caddy; then
  warn "Something else already listens on port 80/443 (nginx/apache?). Caddy needs these ports: stop it or proxy $DOMAIN to 127.0.0.1:$APP_PORT yourself."
fi

HERMES_URL="$(get HERMES_API_URL)"; HERMES_KEY="$(get HERMES_API_KEY)"
if curl -fsS --max-time 5 -H "Authorization: Bearer $HERMES_KEY" "$HERMES_URL/models" >/dev/null 2>&1; then
  log "hermes-agent API server reachable at $HERMES_URL"
else
  warn "hermes-agent API server NOT reachable at $HERMES_URL — the office will run, but agents reply with an error until it is up (see docs/HANDOFF.md step 2)."
fi

# ---------- install & run ----------
if [[ "$MODE" == docker ]]; then
  if ! command -v docker >/dev/null; then log "Installing Docker"; curl -fsSL https://get.docker.com | sh >/dev/null; fi
  systemctl enable --now docker >/dev/null 2>&1 || true
  log "Building and starting containers (first build takes a few minutes)"
  cd "$APP_DIR/deploy"
  docker compose --env-file .env.production up -d --build
else
  NODE_MAJOR="$(node -v 2>/dev/null | sed 's/v\([0-9]*\).*/\1/' || echo 0)"
  if [[ "${NODE_MAJOR:-0}" -lt 20 ]]; then
    log "Installing Node.js 22"; curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null; apt-get install -y -qq nodejs >/dev/null
  fi
  if ! command -v caddy >/dev/null; then
    log "Installing Caddy"
    apt-get install -y -qq debian-keyring debian-archive-keyring apt-transport-https >/dev/null
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' >/etc/apt/sources.list.d/caddy-stable.list
    apt-get update -qq && apt-get install -y -qq caddy >/dev/null
  fi
  id office >/dev/null 2>&1 || useradd --system --create-home --shell /usr/sbin/nologin office
  log "Building the app"
  cd "$APP_DIR"
  npm ci --no-audit --no-fund
  npm run build
  cp -r .next/static .next/standalone/.next/ && cp -r public .next/standalone/
  chown -R office:office "$APP_DIR"
  sed "s#/opt/hermes-office#$APP_DIR#g" deploy/hermes-office.service >/etc/systemd/system/hermes-office.service
  systemctl daemon-reload && systemctl enable --now hermes-office && systemctl restart hermes-office
  sed -e "s#{\$DOMAIN}#$DOMAIN#g" -e "s#{\$ACME_EMAIL}#$EMAIL#g" -e "s#{\$APP_PORT:3000}#$APP_PORT#g" deploy/Caddyfile >/etc/caddy/Caddyfile
  systemctl enable --now caddy >/dev/null && systemctl reload caddy
fi

# ---------- wait until live ----------
log "Waiting for the app on 127.0.0.1:$APP_PORT"
for _ in $(seq 1 60); do curl -fsS "http://127.0.0.1:$APP_PORT/api/health" >/dev/null 2>&1 && break; sleep 2; done
curl -fsS "http://127.0.0.1:$APP_PORT/api/health" >/dev/null || die "app did not start — check: $( [[ $MODE == docker ]] && echo 'docker compose -f deploy/docker-compose.yml logs app' || echo 'journalctl -u hermes-office -n 100')"
log "Waiting for HTTPS on https://$DOMAIN (certificate issuance can take a minute)"
for _ in $(seq 1 60); do curl -fsS "https://$DOMAIN/api/health" >/dev/null 2>&1 && break; sleep 3; done
if curl -fsS "https://$DOMAIN/api/health" >/dev/null 2>&1; then
  log "LIVE: https://$DOMAIN"
else
  warn "HTTPS not ready yet. Check DNS/ports and: $( [[ $MODE == docker ]] && echo 'docker compose -f deploy/docker-compose.yml logs caddy' || echo 'journalctl -u caddy -n 100')"
fi

echo
echo "  URL:       https://$DOMAIN"
if [[ -n "$GENERATED_PASSWORD" ]]; then echo "  Password:  $GENERATED_PASSWORD   (generated — stored in deploy/.env.production)"; else echo "  Password:  (the OFFICE_PASSWORD in deploy/.env.production)"; fi
echo "  Verify:    deploy/verify.sh --domain $DOMAIN --password '<password>'"
