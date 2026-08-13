# Deployment CI (GHCR build + droplet deploy) — Implementation Log

**Date:** 2026-08-13
**Plan:** `context/plan/2026-08-12_deploy-and-observability_plan.md` (section 3, B's work — approved 2026-08-12)
**Reference:** `C:\Users\dilya\ia-ftiness-app\.github\workflows\` — proven in production; ported with name/path adaptations only.

## Files created / changed

| File | What | Notes |
|---|---|---|
| `.github/workflows/deploy.yml` | NEW — manual `workflow_dispatch` deploy: lint + audit → buildx → push `ghcr.io/dilyanatanasov/contrail-{backend,frontend}:{sha,latest}` → SSH pull + `up -d --no-build` → optional migrations → smoke tests | Ported from fitness app. `concurrency: deploy-prod`, single-service deploys, skipped-but-not-failed build condition all kept verbatim. |
| `.github/workflows/rollback.yml` | NEW — roll prod back to any previously deployed SHA (or `previous`); requires typing `ROLLBACK` | Shares the `deploy-prod` concurrency lock. Warns that DB schema is not rolled back. |
| `.github/scripts/smoke-test.sh` | NEW — `/health` 200 (nginx), `/api/auth/me` 401 (backend + auth guard via proxy), `/` 200 (SPA shell) | Fitness app checked `/api/health`; Contrail's backend has no health controller — nginx's static `/health` plus the proxied 401 cover both layers. |
| `docker-compose.prod.yml` | NEW — image-based (`ghcr.io/...:${IMAGE_TAG:-latest}`) twin of `docker-compose.yml`; no `build:` | Same container names, volumes (`pgdata`), network. Run from the same directory, both files share the compose project, so switching between them keeps the data volume. |
| `backend/package.json` | Added `migration:revert:prod` | The rollback workflow's manual-revert instruction now actually exists. Mirrors `migration:run:prod` (dist-based, no ts-node). |

## Deliberate adaptations from the reference

1. **Secret names follow the plan, not the ref**: `SSH_HOST`, `SSH_USER`, `SSH_KEY` (+ optional `SSH_PORT`), `GHCR_USERNAME`, `GHCR_TOKEN` — the names decided in plan §3.4, vs ref's `DROPLET_*`.
2. **Node 20 in lint jobs** (ref uses 24) — matches Contrail's `node:20-alpine` images.
3. **Single `Dockerfile` per service** (ref has `Dockerfile.prod`) — Contrail's Dockerfiles are already multi-stage production builds.
4. **No `VITE_APP_VERSION` build-arg** — Contrail has no release-notes/version-check feature. `VITE_PUBLIC_URL` needs no build-arg either: it lives in the checked-in `frontend/.env.production`, which Vite reads during the image build.
5. **`docker compose` (v2 plugin), not `docker-compose`** — matches what the runbook installs on Ubuntu 24.04.
6. **DB backup credentials from the container env** (`sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"'`), not hardcoded like the ref.
7. **Env file is `.env`** (per runbook), not ref's `.env.production`; server checkout dir is `~/my-travel-plan`.

## First-boot order change (supersedes runbook step 3's `--build`)

The droplet never builds. On deploy day, after runbook steps 1–2 (droplet, repo clone, `.env`) **and** the GitHub secrets are set:

1. Trigger **Deploy** with `service=all`, `run_migrations=false`. The smoke-test step will FAIL because DNS doesn't point at the droplet yet — that's expected; the containers are up. Verify with `curl http://<server-ip>/health`.
2. Restore the dev dump into the still-empty DB (runbook step 4). **Do not run migrations before the restore** — the dump carries schema + migrations table and expects an empty database.
3. Continue runbook steps 5–7 (DNS `.com` → TLS `.com` → DNS/TLS `.app`).
4. Every later deploy: press the button, `run_migrations=true`, smoke tests now green.

## Verification done

- `docker compose -f docker-compose.prod.yml config --quiet` passes.
- Dev-DB dump taken and row-count-verified from the dump file itself:
  `context/backups/dev-20260813-093532.sql` — 25 visits, 41 flight_journeys, 117 flight_legs, 1 user (matches production-data expectations exactly). Gitignored; take a fresh dump on deploy day if more data has been added since.
- Workflows not yet exercised — they need the repo secrets and can only be tested by a real `workflow_dispatch` run (build jobs are testable before any droplet exists).

## DEPLOYED — 2026-08-13

Full production deploy completed the same day:

- Droplet 157.230.227.115 (Ubuntu 24.04, 2 GB, NYC1), ufw 22/80/443, key `~/.ssh/contrail_deploy` (local Windows), user `root`, repo at `~/my-travel-plan`.
- First deploy required fixing lint: neither package had an ESLint config committed (`809a5bc`); `setup-ssl.sh` also had to be pointed at the prod compose file (`84a1f3b`).
- Backend crash-looped on the empty DB (42P01 at startup) until the dump was restored — harmless, self-healed; expect it again only on a from-scratch rebuild.
- Data restored from `dev-20260813-102651.sql`: 25/41/117/1 verified in prod.
- DNS at Namecheap (BasicDNS), A records apex+www for both domains, TTL 1 min.
- TLS: certbot standalone certs for `mycontrail.com` and `mycontrail.app` (apex+www each), renewal hooks installed, dry-run verified. `ALT_DOMAIN=mycontrail.app` set; `.app` 301s to `.com` with valid cert.
- First prod backup taken on the droplet: `~/my-travel-plan/context/backups/prod-20260813-074752.sql`.
- Known deviation from the old checklist: `www.mycontrail.com` serves the app (200) rather than 301-ing to apex. Cosmetic; fix in nginx template someday.
- From now on: deploys via Actions button with `run_migrations=true`; smoke tests should be green.

## Remaining before deploy (not code)

- GitHub repo secrets: `GHCR_USERNAME`, `GHCR_TOKEN` (classic PAT, `write:packages` + `read:packages`), `SSH_HOST`, `SSH_USER`, `SSH_KEY`.
- Droplet (Ubuntu 24.04, 2 GB / 1 vCPU), firewall 22/80/443, repo clone, server `.env` with fresh secrets.
- Registrar DNS, `.com` before `.app` (HSTS constraint, runbook).
- Umami container + memory measurement (plan §3.5–3.6) — deferred until after first deploy, per plan sequence step 4.
