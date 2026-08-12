# Deployment CI + observability — plan

Confirmed with the user 2026-08-12. Three decisions: **Umami self-hosted**
for behavioural analytics, **manual `workflow_dispatch`** for production
deploys, **B builds CI and infrastructure, A builds instrumentation**.

Prerequisite: D3's release order still holds. This ships after the
functionality and security work, which is now essentially done.

---

## 1. What already exists (do not rebuild it)

- `frontend/Dockerfile` is already multi-stage: `npm ci` + `npm run build`
  inside the builder, only `dist/` copied into the nginx stage. **Nothing is
  ever built locally**, and nothing needs to be.
- Three nginx templates, `security-headers.conf`, and an entrypoint that picks
  a template based on which certificates exist. Verified with `nginx -t`.
- `scripts/backup-db.sh`, and a full manual runbook at
  `context/implement/2026-08-11_deployment_implement.md` on branch
  `worktree-deploy-mycontrail` — droplet, `.env`, first boot, data migration,
  DNS, TLS, in order, with the `.com`-before-`.app` sequencing.
- Reference CI in `C:/Users/dilya/ia-ftiness-app/.github/workflows/`:
  `deploy.yml`, `rollback.yml`, `observability.yml`.

Contrail has **no** `.github/workflows` at all.

## 2. The actual problem CI solves

Today the droplet would build its own images. A Vite build on a 2 GB droplet
can exhaust memory and leave the site half-deployed. The fix is the pattern
the fitness app already uses:

```
GitHub Actions: lint → docker buildx → push ghcr.io/<user>/contrail-{frontend,backend}:{sha,latest}
            → appleboy/ssh-action → docker login ghcr → compose pull → compose up -d --no-build
```

The droplet never compiles anything. It pulls a tested image.

## 3. B's work — CI and infrastructure

### 3.1 `deploy.yml`
Port from the fitness app, adapting names. Keep its shape:
- `workflow_dispatch` with `service` (all / frontend / backend) and
  `run_migrations` (true / false).
- `concurrency: deploy-prod`, `cancel-in-progress: false` — two overlapping
  deploys onto one droplet is how you get a broken site.
- Lint + `npm audit --audit-level=high` per package before building.
- Tag images with both `${{ github.sha }}` and `latest`. The sha tag is what
  makes rollback meaningful.
- Migrations via the existing `migration:run:prod` script, gated on the input.
- Deploy step must run when one build job was *skipped* (single-service
  deploy) but not when one *failed*. The fitness workflow already gets this
  right — copy the condition rather than reinventing it.

### 3.2 `rollback.yml`
`workflow_dispatch` taking an image sha, repointing compose at that tag. The
point of tagging by sha.

### 3.3 Production compose
A `docker-compose.prod.yml` that consumes `IMAGE_TAG` and `--no-build`
rather than a `build:` context.

### 3.4 Secrets required (user creates in GitHub repo settings)
`GHCR_USERNAME`, `GHCR_TOKEN` (classic PAT, `write:packages`),
`SSH_HOST`, `SSH_USER`, `SSH_KEY`.

### 3.5 Umami container
- Add to the production compose. Umami runs on Postgres, so it can share the
  existing instance with **its own database** (`CREATE DATABASE umami`) —
  never the app's database.
- Reverse-proxy it on a path or subdomain, behind auth. It must not be
  world-readable: it is a list of what your users do.
- `APP_SECRET` in the server `.env`.

### 3.6 Memory — flag before provisioning
Backend + nginx + Postgres + Umami on a 2 GB droplet is tight. Umami is
light (~100–150 MB) but Postgres now serves two databases. **B: measure and
tell the user whether 2 GB holds, before they pay for a year.** The honest
answer may be that 4 GB is the right box; that is the user's call to make
with a number in front of them, not a guess.

## 4. A's work — instrumentation

### 4.1 The constraint that shapes everything
Contrail's sections are **React state on `/`**, not routes. Pageview
analytics sees one page. Every meaningful metric here is a custom event.

### 4.2 Privacy rule, non-negotiable
**No travel data leaves the app.** No country names, airport codes, journey
dates, notes, or anything derived from them. Events carry section ids and
durations. The product is a private map of someone's life; instrumenting it
must not quietly turn it into someone else's dataset. This is why Umami won
over PostHog's session replay.

### 4.3 Events
| Event | Answers |
| --- | --- |
| `section_view` `{ section, dwellMs }` | "Where do they stay the most" |
| `map_interact` `{ kind: zoom \| pan \| country_open }` | Is the map used, or just looked at |
| `replay_start` / `replay_complete` `{ journeys }` | Does anyone finish the replay |
| `share_render` `{ style }` | Which share style, and whether share is used at all |
| `guest_convert` | The funnel number that matters |

`dwellMs` is measured on section change and on `visibilitychange`, so a
closed tab does not count as engagement.

### 4.4 Shape
A single `frontend/src/lib/analytics.ts` with a `track(event, props)` that
no-ops when `VITE_UMAMI_URL` is unset. Everything else imports that. Local
development and tests then produce no traffic, and swapping vendor later
touches one file.

### 4.5 Not from analytics
Registered users, guest→registered conversion, visits and flights per user
are all SQL against our own Postgres. Cheaper and more accurate than any
event pipeline. A small `scripts/stats.sh` beats a dashboard for these.

## 5. Sequence

1. B ports `deploy.yml` + `rollback.yml` + prod compose (no droplet needed —
   builds and pushes to GHCR can be tested on their own).
2. A lands `analytics.ts` + events behind the unset-env no-op. Ships dark.
3. User does the one-time manual runbook: droplet, `.env`, first boot, data
   restore, `.com` DNS + TLS, then `.app`.
4. B adds Umami, user sets `VITE_UMAMI_URL`, instrumentation lights up.
5. First real deploy is a button press.

## 6. Open

- Cookie/consent copy. Umami is cookieless, which in most EU readings means
  no banner is required, but a line in a privacy policy still is. A drafts,
  user decides.
- Whether guests are tracked at all. They are the top of the funnel, so yes —
  but it is worth being deliberate rather than defaulting.
