#!/bin/sh
# Choose the HTTPS or HTTP nginx template before the image's envsubst step.
#
# Runs from /docker-entrypoint.d, which the official nginx image executes in
# filename order at startup. The 10- prefix puts it ahead of the built-in
# 20-envsubst-on-templates.sh.
#
# Why this exists: an HTTPS server block referencing a certificate that is not
# there yet makes nginx fail to start, and certbot's HTTP-01 challenge needs a
# working web server on port 80 to issue that certificate. Without this the
# two deadlock on a fresh host. Serving HTTP until the cert appears breaks the
# cycle, and the container upgrades itself on the next restart.
set -e

DOMAIN="${DOMAIN:-localhost}"
CERT="/etc/letsencrypt/live/${DOMAIN}/fullchain.pem"
TEMPLATE_DIR=/etc/nginx/templates

mkdir -p "$TEMPLATE_DIR"
rm -f "$TEMPLATE_DIR"/*.conf.template

if [ -f "$CERT" ]; then
  echo "[nginx] certificate found for ${DOMAIN} — serving HTTPS"
  cp /etc/nginx/available/nginx.conf.template "$TEMPLATE_DIR/default.conf.template"
else
  echo "[nginx] no certificate at ${CERT} — serving HTTP only."
  echo "[nginx] Run ./setup-ssl.sh on the host to issue one, then restart this container."
  cp /etc/nginx/available/nginx.http.conf.template "$TEMPLATE_DIR/default.conf.template"
fi
