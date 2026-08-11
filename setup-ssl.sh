#!/bin/bash
# Issue a Let's Encrypt certificate for Contrail, then restart nginx so
# it picks up HTTPS.
#
# This is what makes the app installable as a PWA: browsers only register a
# service worker, and only offer to install, on a secure origin.
#
# Uses certbot in standalone mode, which needs port 80 to itself, so the
# frontend container is stopped for the duration. The container is written to
# boot HTTP-only when no certificate exists, so this can be run on a host that
# has never had one.
#
# Usage:  sudo ./setup-ssl.sh yourdomain.com you@example.com
set -euo pipefail

DOMAIN="${1:-}"
EMAIL="${2:-}"
COMPOSE="docker compose"

if [ -z "$DOMAIN" ] || [ -z "$EMAIL" ]; then
  echo "Usage: sudo ./setup-ssl.sh <domain> <email>"
  echo "Example: sudo ./setup-ssl.sh travel.example.com me@example.com"
  exit 1
fi

if [ "$EUID" -ne 0 ]; then
  echo "ERROR: run with sudo — certbot writes to /etc/letsencrypt"
  exit 1
fi

echo "==> Checking DNS for $DOMAIN"
RESOLVED="$(getent hosts "$DOMAIN" | awk '{print $1}' | head -1 || true)"
PUBLIC_IP="$(curl -fsS https://api.ipify.org || echo unknown)"
echo "    $DOMAIN resolves to: ${RESOLVED:-<nothing>}"
echo "    this host's public IP: $PUBLIC_IP"
if [ -z "$RESOLVED" ]; then
  echo "ERROR: $DOMAIN does not resolve. Point an A record at $PUBLIC_IP first."
  exit 1
fi
if [ "$RESOLVED" != "$PUBLIC_IP" ] && [ "$PUBLIC_IP" != "unknown" ]; then
  echo "WARNING: DNS points somewhere other than this host."
  echo "         Let's Encrypt will fail unless it reaches THIS machine."
  read -r -p "         Continue anyway? [y/N] " reply
  [ "$reply" = "y" ] || exit 1
fi

echo "==> Installing certbot if needed"
command -v certbot >/dev/null 2>&1 || { apt-get update && apt-get install -y certbot; }

echo "==> Stopping the frontend so certbot can bind port 80"
$COMPOSE stop frontend || true

cleanup() {
  echo "==> Bringing the frontend back up"
  DOMAIN="$DOMAIN" $COMPOSE up -d frontend
}
# Restart nginx whatever happens, so a failed issuance does not leave the site down.
trap cleanup EXIT

echo "==> Requesting certificate"
certbot certonly --standalone \
  -d "$DOMAIN" -d "www.$DOMAIN" \
  --non-interactive --agree-tos --email "$EMAIL"

echo "==> Certificate installed at /etc/letsencrypt/live/$DOMAIN/"

echo "==> Adding a renewal hook so nginx reloads after each renewal"
mkdir -p /etc/letsencrypt/renewal-hooks/deploy
cat > /etc/letsencrypt/renewal-hooks/deploy/reload-travel-tracker.sh <<'HOOK'
#!/bin/sh
# Certificates renew on disk; nginx keeps serving the old one until reloaded.
docker exec travel_tracker_frontend nginx -s reload 2>/dev/null || true
HOOK
chmod +x /etc/letsencrypt/renewal-hooks/deploy/reload-travel-tracker.sh

echo
echo "Done. The frontend will restart with HTTPS enabled."
echo "Set DOMAIN=$DOMAIN in your .env so nginx and CORS agree."
