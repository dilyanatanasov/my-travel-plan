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
# The prod compose file: pulls GHCR images, never builds on the droplet.
COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env"

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

echo "==> Adding renewal hooks"
# Issuance used --standalone, so certbot's renewal config remembers standalone
# — and renewal will need port 80, which nginx holds. Without the pre/post
# hooks the systemd renewal timer fails silently and the certificate simply
# expires after 90 days. (Same pattern as ia-fitness-app, where it is proven.)
mkdir -p /etc/letsencrypt/renewal-hooks/pre \
         /etc/letsencrypt/renewal-hooks/post \
         /etc/letsencrypt/renewal-hooks/deploy

cat > /etc/letsencrypt/renewal-hooks/pre/stop-travel-tracker.sh <<'HOOK'
#!/bin/sh
docker stop travel_tracker_frontend 2>/dev/null || true
HOOK

cat > /etc/letsencrypt/renewal-hooks/post/start-travel-tracker.sh <<'HOOK'
#!/bin/sh
docker start travel_tracker_frontend 2>/dev/null || true
HOOK

cat > /etc/letsencrypt/renewal-hooks/deploy/reload-travel-tracker.sh <<'HOOK'
#!/bin/sh
# Certificates renew on disk; nginx keeps serving the old one until reloaded.
# The post hook has already started the container; reload covers the case
# where it was running the whole time (e.g. webroot renewals).
docker exec travel_tracker_frontend nginx -s reload 2>/dev/null || true
HOOK

chmod +x /etc/letsencrypt/renewal-hooks/pre/stop-travel-tracker.sh \
         /etc/letsencrypt/renewal-hooks/post/start-travel-tracker.sh \
         /etc/letsencrypt/renewal-hooks/deploy/reload-travel-tracker.sh

echo "==> Verifying renewal works end to end (dry run)"
certbot renew --dry-run || echo "WARNING: renewal dry-run failed — investigate before the cert expires"

echo
echo "Done. The frontend will restart with HTTPS enabled."
echo "For the primary domain: set DOMAIN=$DOMAIN in your .env so nginx and CORS agree."
echo "For a secondary redirect domain: set ALT_DOMAIN=$DOMAIN instead, then"
echo "  docker compose up -d --force-recreate frontend"
