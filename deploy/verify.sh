#!/usr/bin/env bash
# Checks a Hermes Office deployment end to end and prints PASS/FAIL per check.
#   deploy/verify.sh --domain office.example.com --password '...' [--port 3000] [--no-agent]
set -uo pipefail
DOMAIN="" PASSWORD="" PORT=3000 AGENT=true
while [[ $# -gt 0 ]]; do
  case "$1" in
    --domain) DOMAIN="$2"; shift 2 ;; --password) PASSWORD="$2"; shift 2 ;;
    --port) PORT="$2"; shift 2 ;; --no-agent) AGENT=false; shift ;; *) echo "unknown option $1"; exit 2 ;;
  esac
done
FAILS=0
check() { if eval "$2" >/dev/null 2>&1; then printf '  PASS  %s\n' "$1"; else printf '  FAIL  %s\n' "$1"; FAILS=$((FAILS+1)); fi; }
BASE="https://$DOMAIN"; [[ -n "$DOMAIN" ]] || BASE="http://127.0.0.1:$PORT"
JAR="$(mktemp)"; OUT="$(mktemp)"; trap 'rm -f "$JAR" "$OUT"' EXIT

echo "Hermes Office checks for $BASE"
check "local app answers /api/health"            "curl -fsS http://127.0.0.1:$PORT/api/health"
[[ -n "$DOMAIN" ]] && check "HTTPS certificate is valid"  "curl -fsS https://$DOMAIN/api/health"
check "login page loads"                          "curl -fsS $BASE/login"
check "office requires login (API returns 401)"  "[ \"\$(curl -s -o /dev/null -w '%{http_code}' -X POST $BASE/api/hermes)\" = 401 ]"
if [[ -n "$PASSWORD" ]]; then
  check "password signs in"                       "curl -s -c $JAR -o /dev/null -w '%{redirect_url}' -X POST --data-urlencode password='$PASSWORD' -d next=/ $BASE/api/login | grep -vq error"
  check "office page loads after sign-in"         "curl -fsS -b $JAR $BASE/ | grep -q 'Hermes Office'"
  if [[ "$AGENT" == true ]]; then
    check "hermes-agent replies through the office (streaming)" \
      "curl -fsS -N -b $JAR -H 'content-type: application/json' --max-time 120 -X POST $BASE/api/hermes \
        -d '{\"messages\":[{\"role\":\"user\",\"content\":\"Reply with the single word: pong\"}]}' -o $OUT; grep -q 'data:' $OUT"
  fi
fi
HEALTH="$(curl -fsS "$BASE/api/health" 2>/dev/null)"; echo "  health: ${HEALTH:-unreachable}"
echo "$HEALTH" | grep -q '"hermes":"demo"' && echo "  NOTE  HERMES_API_URL is not set: rooms run in demo mode."
echo "$HEALTH" | grep -q '"auth":false' && echo "  WARN  OFFICE_PASSWORD is not set: the office is open to anyone."
[[ $FAILS -eq 0 ]] && echo "All checks passed." || { echo "$FAILS check(s) failed."; exit 1; }
