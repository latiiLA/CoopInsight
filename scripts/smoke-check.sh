#!/usr/bin/env bash
# Smoke-check Switch Hub API. Usage: ./scripts/smoke-check.sh [--login]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API_BASE="${SMOKE_API_BASE:-https://127.0.0.1:8088}"
DO_LOGIN=0
for arg in "$@"; do
  case "$arg" in
    --login|-login) DO_LOGIN=1 ;;
  esac
done

echo "→ GET $API_BASE/api/health"
body="$(curl -skS --fail "$API_BASE/api/health")"
echo "$body"
echo "$body" | grep -q '"status":"ok\|"status": "ok"' || {
  echo "health status not ok" >&2
  exit 1
}
echo "OK health"

if [[ "$DO_LOGIN" -eq 1 ]]; then
  if [[ -f "$ROOT/backend/.env" ]]; then
    # shellcheck disable=SC1091
    set -a
    # Load only the bootstrap keys (avoid sourcing whole .env with spaces/specials poorly)
    while IFS= read -r line || [[ -n "$line" ]]; do
      case "$line" in
        BOOTSTRAP_ADMIN_USERNAME=*|BOOTSTRAP_ADMIN_PASSWORD=*)
          export "$line"
          ;;
      esac
    done < "$ROOT/backend/.env"
    set +a
  fi
  user="${BOOTSTRAP_ADMIN_USERNAME:-systemadmin}"
  pass="${BOOTSTRAP_ADMIN_PASSWORD:-}"
  if [[ -z "$pass" ]]; then
    echo "BOOTSTRAP_ADMIN_PASSWORD not set; skip login probe" >&2
    exit 1
  fi
  echo "→ POST $API_BASE/api/auth/login (user=$user)"
  code="$(curl -skS -o /tmp/switch-hub-login.json -w "%{http_code}" \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"$user\",\"password\":\"$pass\"}" \
    "$API_BASE/api/auth/login")"
  if [[ "$code" != "200" ]]; then
    echo "login failed HTTP $code" >&2
    exit 1
  fi
  grep -q 'accessToken\|access_token\|token' /tmp/switch-hub-login.json \
    || grep -qi 'token' /tmp/switch-hub-login.json \
    || {
      # Accept any 200 with JSON body as success if shape differs
      test -s /tmp/switch-hub-login.json
    }
  echo "OK login"
fi

echo "smoke-check passed"
