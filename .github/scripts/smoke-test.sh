#!/usr/bin/env bash
#
# Post-deploy smoke tests. Each check retries a few times to absorb
# slow container startup. Any failure exits non-zero.
#
# Usage: BASE_URL=https://mycontrail.com ./smoke-test.sh

set -uo pipefail

BASE_URL="${BASE_URL:-https://mycontrail.com}"
MAX_ATTEMPTS=6
SLEEP_BETWEEN=5

failures=0

# check NAME METHOD URL EXPECTED_STATUS
check() {
  local name="$1" method="$2" url="$3" expected="$4"
  local attempt=1 status

  while [ $attempt -le $MAX_ATTEMPTS ]; do
    status=$(curl -s -o /dev/null -w "%{http_code}" \
      --max-time 15 -X "$method" "$url" || echo "000")

    if [ "$status" = "$expected" ]; then
      echo "  PASS  $name ($status)"
      return 0
    fi

    if [ $attempt -lt $MAX_ATTEMPTS ]; then
      echo "  ...   $name attempt $attempt: got $status, expected $expected — retrying"
      sleep $SLEEP_BETWEEN
    fi
    attempt=$((attempt + 1))
  done

  echo "  FAIL  $name (got $status, expected $expected after $MAX_ATTEMPTS attempts)"
  failures=$((failures + 1))
  return 1
}

echo "==> Smoke tests against $BASE_URL"

# nginx up and serving (static /health location in every template)
check "nginx health endpoint"         GET  "$BASE_URL/health"            200

# Protected endpoint without a token — proves the backend is reachable
# through the /api proxy AND the auth guard is wired up. 401 means
# "no token", which is the expected response. Anything else
# (500, 200, 404) signals a broken pipeline.
check "auth guard enforces via /api"  GET  "$BASE_URL/api/auth/me"       401

# Frontend HTML — proves the SPA shell is served
check "frontend SPA shell served"     GET  "$BASE_URL/"                  200

if [ $failures -gt 0 ]; then
  echo "==> Smoke tests FAILED: $failures check(s) failed"
  exit 1
fi

echo "==> Smoke tests passed"
