# Deployment to mycontrail.com / mycontrail.app — Implementation Log

**Date:** 2026-08-11
**Branch:** `worktree-deploy-mycontrail` (off `feat/user-accounts-auth`)
**Reference:** `C:\Users\dilya\ia-ftiness-app` — deployed, same stack; its patterns are followed unless noted.

## Changes made on this branch

| File | Change | Why |
|---|---|---|
| `frontend/nginx.alt.conf.template` | NEW — dual-domain config: canonical `${DOMAIN}` + `${ALT_DOMAIN}` 301-redirect blocks (own cert, port 80 + 443) | `.app` is HSTS-preloaded: it can never be served or redirected over plain HTTP, so the redirect needs valid TLS. A cert-mismatch would hard-fail with no bypass button. |
| `frontend/docker-entrypoint.d/10-select-nginx-template.sh` | 3-way template selection: http-only → https single → https dual (both certs present) | The existing bootstrapping pattern, extended: each phase (no cert / .com cert / both certs) boots cleanly and upgrades on restart. |
| `frontend/Dockerfile` | Ship the alt template; `ENV ALT_DOMAIN=""` | `NGINX_ENVSUBST_FILTER=DOMAIN` is an unanchored regex so `ALT_DOMAIN` is substituted too — no filter change needed. |
| `docker-compose.yml` | Pass `ALT_DOMAIN` to the frontend | |
| `setup-ssl.sh` | Install pre/post renewal hooks (stop/start frontend) + `certbot renew --dry-run` verification | **Bug fix.** Issuance uses `--standalone`, so renewal does too — and needs port 80, which nginx holds. Without hooks the renewal timer fails silently and the cert expires after 90 days. Copied from ia-fitness-app, where it is proven. |
| `backend/package.json` | Add `migration:run:prod` (`typeorm migration:run -d dist/data-source.js`) | **Bug fix.** `migration:run` needs ts-node + `src/`, neither of which exists in the prod image (`npm ci --only=production`, dist only). The compiled data-source globs `dist/migrations/*.js` via `__dirname`, and `typeorm` is a production dep, so the plain CLI works. |
| `.env.example` | Document `DOMAIN` / `ALT_DOMAIN` | |

## Rollout order (.com first, .app second — deliberate)

`mycontrail.app` must not have DNS records until its certificate can be issued,
because the whole `.app` TLD is HSTS-preloaded: a browser will refuse plain
HTTP outright, and there is no "proceed anyway" for a bad cert. `.com` has no
such constraint and can bootstrap over HTTP.

## Manual steps (in order)

### 0. Git
1. Frontend session finishes / commits; merge `feat/user-accounts-auth` → `main` (all deployable work is on the feat branch; `main` is months behind).
2. Merge `worktree-deploy-mycontrail` (this branch) into `main` too, and push. The server deploys from GitHub.

### 1. Server (once)
- Create a droplet/VPS: Ubuntu 24.04 LTS, **2 GB RAM minimum** — the compose file builds images on the server (see Differences), and a Vite production build OOMs on 1 GB. 1 vCPU fine.
- `apt install docker.io docker-compose-plugin git` (or Docker's official install script).
- Firewall: allow 22, 80, 443 (`ufw allow 22,80,443/tcp && ufw enable`).
- `git clone https://github.com/dilyanatanasov/my-travel-plan.git && cd my-travel-plan`.

### 2. Server `.env` (values)
```
POSTGRES_USER=postgres
POSTGRES_PASSWORD=<openssl rand -base64 24>
POSTGRES_DB=travel_tracker
DB_USERNAME=postgres
DB_PASSWORD=<same as POSTGRES_PASSWORD>
DB_DATABASE=travel_tracker
JWT_SECRET=<openssl rand -base64 48>
JWT_EXPIRES_IN=7d
DOMAIN=mycontrail.com
ALT_DOMAIN=            # empty until step 7
CORS_ORIGIN=https://mycontrail.com
RAPIDAPI_KEY=          # optional; flight search is hidden from nav anyway
```
Do NOT reuse the dev JWT_SECRET or DB password.

### 3. First boot (HTTP mode, still no DNS needed)
```
docker compose up -d --build
curl http://<server-ip>/health        # expect: ok
```
The frontend boots HTTP-only because no cert exists yet — by design.

### 4. Real data migration (the 25 visits / 41 journeys / 117 legs live in the LOCAL dev Docker volume)
On the Windows machine, dev stack running:
```
./scripts/backup-db.sh                 # dumps dev → context/backups/dev-<stamp>.sql, verifies row counts
scp context/backups/dev-<stamp>.sql user@<server-ip>:~
```
On the server (fresh, empty DB — nothing to destroy; the dump contains schema + data + migrations table):
```
docker compose stop backend
cat ~/dev-<stamp>.sql | docker exec -i travel_tracker_db psql -U postgres -d travel_tracker
docker compose start backend
```
Verify: `docker exec travel_tracker_db psql -U postgres -d travel_tracker -c "select count(*) from flight_legs;"` → 117.

### 5. DNS for .com only (at the registrar)
| Type | Host | Value | TTL |
|---|---|---|---|
| A | `@` (mycontrail.com) | `<server-ip>` | 300 |
| A (or CNAME→@) | `www` | `<server-ip>` | 300 |

**Create no records for mycontrail.app yet.**

### 6. TLS for .com
```
sudo ./setup-ssl.sh mycontrail.com <your-email>
```
Script handles: DNS pre-check, certbot standalone (covers apex + www), renewal hooks, dry-run verify, container restart into HTTPS mode. Then check `https://mycontrail.com`, padlock, and PWA install prompt on Android.

### 7. DNS + TLS for .app (only after 6 succeeds)
- Add the same two A records for `mycontrail.app` / `www.mycontrail.app`.
- Wait for propagation (`dig +short mycontrail.app` shows the server IP), then:
```
sudo ./setup-ssl.sh mycontrail.app <your-email>
# set ALT_DOMAIN=mycontrail.app in .env, then:
docker compose up -d --force-recreate frontend
```
- Verify `https://mycontrail.app` 301s to `https://mycontrail.com` with a valid cert.

### 8. Post-deploy checklist
- [ ] `https://mycontrail.com/api/auth/me` returns 401 JSON (API proxied)
- [ ] Register → data claimed; logout/login; guest flow from a private window
- [ ] Cookie has `Secure; HttpOnly; SameSite=Lax` (NODE_ENV=production is set by compose)
- [ ] `http://mycontrail.com` → 301 https; `www` → apex; `.app` → `.com`
- [ ] Android Chrome offers real install (WebAPK); iOS Add to Home Screen
- [ ] `docker exec travel_tracker_frontend nginx -t` clean
- [ ] Take a first prod backup: `./scripts/backup-db.sh prod`

## Where Contrail differs from ia-ftiness-app (and why)

1. **Images built on the server** (`build:` in compose) vs ref's GHCR prebuilt images pulled by a GitHub Actions deploy. Contrail has no CI at all yet. Fine at this scale; the cost is needing a 2 GB droplet and slower deploys. Porting ref's `deploy.yml`/`rollback.yml`/smoke-test is the natural follow-up once deploys become routine.
2. **Prod compose is `docker-compose.yml`** (dev is the suffixed file) vs ref's `docker-compose.prod.yml`. Cosmetic; kept as-is.
3. **nginx is templated with HTTP→HTTPS self-bootstrap** vs ref's single hardcoded-domain config that cannot boot without a cert. Contrail's is the improved version of the pattern we borrowed (variable upstream + `resolver 127.0.0.11` came from ref); kept.
4. **Two domains** (canonical + HSTS-preloaded redirect) — new `nginx.alt.conf.template`; ref serves one domain.
5. **setup-ssl.sh is parameterized** (domain + email args) vs ref's hardcoded domain; ref had the renewal stop/start hooks Contrail was missing — now adopted.
6. **No observability container, no uploads volume** — Contrail has neither feature; blocks omitted rather than carried dead.
7. **Migrations**: ref runs `migration:run:prod` inside the container during CI deploy; Contrail now has that script, run manually after a deploy that includes new migrations (`docker compose exec backend npm run migration:run:prod`). First boot needs none — the restored dump carries the schema and migrations table.

## Handoffs to the frontend session (not deployment-blocking, not touched by me)

- `og:image` in `index.html` is relative (`/og-image.png`); most crawlers require an absolute URL. There's also no `og:url` tag — the comment mentions `VITE_PUBLIC_URL` but nothing implements it. Suggest: absolute URLs via `https://mycontrail.com` at build time.
- `frontend/nginx.conf` (non-template) is a stale leftover — nothing references it; safe to delete whenever convenient.
- Manifest `start_url`/`scope` are relative → already domain-correct; no change needed.
