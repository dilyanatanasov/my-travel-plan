# Contrail — three-agent coordination

Three Claude sessions work on Contrail in parallel. This file is the only
channel between them. Read it before you start anything; write to it when you
finish anything.

Started 2026-08-12.

---

## The one rule that makes this work

**This file lives at exactly one physical path:**

```
C:/Users/dilya/my-travel-pans/context/COORDINATION.md
```

Not a copy in your worktree — *that* absolute path, always, no matter which
worktree your code is in. Every agent reads and writes the same file on disk,
so everyone sees everything immediately instead of after a merge.

Three habits keep it from turning into a merge war:

1. **Write only in your own section.** Never edit another agent's journal,
   never reword their entries. Correct them by asking in Open Questions.
2. **Append, never rewrite.** New entries at the bottom of your journal. Use
   the Edit tool with an exact anchor, never a whole-file overwrite — someone
   else may have written between your read and your write.
3. **Re-read immediately before you write.** The file changes under you.

It is committed only from the main checkout, only on `main`, and never merged
from a feature branch. That way git never has to resolve it.

---

## Roles

### A — Product & Frontend
Owns what the user sees and touches: the map, the shell, share, settings,
onboarding, empty states, accessibility, copy. Owns the visual language and is
the final say on whether something *feels* like Contrail.

Current queue: accessibility pass; replay-as-video for share; code-split the
539 kB bundle (coordinate with B, who also measures bundle cost).

### B — Security & Performance
Owns the backend's exposure and the app's cost per user. Reviews first,
changes second — a written finding with a reproduction beats a speculative
patch.

Reference implementation: `C:/Users/dilya/ia-ftiness-app`. Already verified as
present there and worth porting or bettering:
- `backend/src/app.module.ts` — `ThrottlerModule` with two named buckets
  (`short` 20/60 s, `long` 100/600 s). Contrail currently has **one** global
  bucket, `{ ttl: 60_000, limit: 300 }`.
- `backend/src/main.ts` — `helmet` with an explicit CSP directive set, a
  1 MB body limit on json and urlencoded, and a CORS allow-list that reads a
  comma-separated origin list and rejects unknown origins.
- `frontend/nginx.conf` — HSTS, `X-Frame-Options`, `nosniff`,
  `Referrer-Policy`, TLS 1.2/1.3 with a pinned cipher list, per-asset
  `Cache-Control`.

Note what is **not** there, so nobody assumes it: no `limit_req`/`limit_conn`
in nginx, no fail2ban, no WAF. Real DDoS protection for Contrail will have to
come from the edge (Cloudflare in front of the droplet) plus nginx rate zones.
Say so in your findings rather than implying the fitness app solved it.

Contrail's current state, verified 2026-08-12 — start from these facts, not
from a fresh audit of the same ground:
- `helmet` and `@nestjs/throttler` are both installed and wired.
- Auth endpoints already carry per-route throttles: `/auth/guest` and
  `/auth/register` 5/min, `/auth/login` 10/min.
- JWT lives in an httpOnly cookie; a global `JwtAuthGuard` with `@Public()`
  opt-outs.
- `frontend/security-headers.conf` and three nginx templates exist from the
  deployment work.

Worth your attention early, in rough priority order:
1. **IDOR sweep.** Every controller that reads or writes visits, flights,
   journeys, legs and shares must scope by the authenticated `userId`. This
   app was single-tenant until recently. One missed `where` clause hands one
   user another's map. Prove each endpoint, don't assume.
2. **Guest-account abuse.** `/auth/guest` inserts a row for anyone who asks.
   5/min per IP is a speed bump, not a wall. Consider what a botnet costs us
   in rows, and whether the 30-day sweep in `guest-cleanup.service.ts` is
   enough. Do not weaken the guest flow to fix it — it is load-bearing for
   conversion.
3. Cookie flags, CORS origins and secrets handling for the real domains.
4. `npm audit` on both packages, and the CVE surface of what we actually ship.
5. Performance: query counts on the map's initial load, N+1s in the visits and
   flights joins, response sizes, and the bundle.

### C — Trip Search
Owns the search feature end to end — backend providers, the API surface, and
its frontend — and is responsible for making it look and feel like the rest of
Contrail rather than a bolted-on booking widget.

Prior work exists and must be read before designing anything: branch
`worktree-smart-trip-search`, commit `dbb59c1`, files
`context/research/2026-08-11_smart-trip-search_research.md` and
`context/plan/2026-08-11_smart-trip-search_plan.md`. That plan was approved on
2026-08-11 and covers the funnel architecture, all three providers, SSE
streaming, watches and the affiliate economics. Bring the docs onto your
branch with:

```bash
git checkout worktree-smart-trip-search -- \
  context/research/2026-08-11_smart-trip-search_research.md \
  context/plan/2026-08-11_smart-trip-search_plan.md
```

Verified constraints from that research, still true: Kiwi via RapidAPI is
Basic free 300 req/mo, Pro $5/mo 20 k; Amadeus self-service closed to new
signups in July 2026; official Kiwi Tequila is invite-only. **Re-verify prices
and tiers before spending anything** — that research is a year old.

See Decision D1 below for the scope answer.

---

## Ownership map

Overlap is what causes conflicts, so paths have owners. Touching someone
else's paths is allowed — announcing it first in Open Questions is required.

| Path | Owner |
| --- | --- |
| `frontend/src/components/TravelMap/**`, `AppShell/**`, `Toast/**` | A |
| `frontend/src/pages/**` except search pages | A |
| `frontend/src/styles/**`, `tailwind.config.js`, `theme/**` | A (design tokens are A's call) |
| `frontend/src/features/share/**`, `utils/shareCard.ts` | A |
| `frontend/src/features/auth/**` | B |
| `backend/src/main.ts`, `app.module.ts`, `modules/auth/**` | B |
| `nginx*.template`, `security-headers.conf`, `docker-compose*.yml`, `scripts/**` | B |
| `backend/src/modules/flights/providers/**` and search services | C |
| `frontend/src/features/search/**` and search pages | C |
| `backend/src/modules/visits/**`, `flights/**` (non-search) | B reviews, A and C change |
| `context/research/**`, `context/plan/**`, `context/implement/**` | whoever writes the doc |

C consumes A's design tokens and components; C does not redefine them. If a
search screen needs a token or a shared component that does not exist, ask A
in Open Questions rather than inventing a parallel style.

---

## Working agreement

**Worktrees.** One per agent, already created, all gitignored:

| Agent | Worktree | Starting branch |
| --- | --- | --- |
| A | main checkout, `C:/Users/dilya/my-travel-pans` | `main` |
| B | `.claude/worktrees/security` | `wt/security` |
| C | `.claude/worktrees/search` | `wt/search` |

**Branches.** One feature per branch, off current `main`:
`feat/<area>-<slug>` — `feat/search-destination-discovery`,
`feat/sec-idor-sweep`. Your long-lived `wt/*` branch is a home base; cut a
`feat/*` branch from `main` for each piece of work.

**Merging.** Nobody merges to `main` until the user has seen the feature and
confirmed it. Then: rebase on `main`, run the full verification bar, merge,
push, and log it in your journal. If two branches touch the same file, the
second one to merge rebases and resolves — do not ask the user to arbitrate a
mechanical conflict.

**Verification bar** — all three, before you claim anything is done:
1. `npx tsc --noEmit` clean in both `frontend/` and `backend/`.
2. `npx vite build` succeeds (frontend changes).
3. A real browser check of the actual behaviour, via Playwright MCP. Screenshot
   or measurement in your journal for anything visual or performance-related.

Host tooling: node v24.13.0 and npm 11.6.2 are on the host, so run `npm ci`
once in your worktree's `frontend/` and `backend/` and typecheck without
Docker.

**Dev stack lock.** The dev stack has hardcoded container names and fixed
ports (5173, and Postgres), so **only one agent can run it at a time**. Claim
it in the Stack Lock section below before `docker compose up`, release it when
you are done. Run it from your worktree with:

```bash
COMPOSE_PROJECT_NAME=my-travel-pans docker compose -f docker-compose.dev.yml up -d
```

`COMPOSE_PROJECT_NAME` is not optional. Compose derives the volume name from
the directory, so without it you attach to a brand-new empty database and will
think the real data is gone.

**Reporting.** Say what you verified and how. "Fixed" without a measurement or
a screenshot is not a report. If something is still broken, or you skipped
part of a task, write that down — a journal that only contains successes is
not useful to the other two.

---

## Data safety — non-negotiable

The dev database holds the user's real travel history. It is not test data.

- `user_id = 1` is the real account: **25 visits, 41 journeys, 117 legs.**
  Check these numbers after anything that touches the database.
- Run `./scripts/backup-db.sh dev` **before** any destructive operation.
  Backups land in `context/backups/`.
- Test rows created by guest flows get cleaned up the same session:
  `DELETE FROM users WHERE id <> 1;` (visits cascade).
- Never `DELETE`, `TRUNCATE`, `DROP` or run a destructive migration against
  the dev database without a fresh backup in that same session.
- Never delete a row belonging to `user_id = 1` unless the user asked for that
  specific row.

---

## Stack lock

Claim by editing this line. One holder at a time.

**Holder: (free)** — last released 2026-08-12 by A.

---

## Decisions

### D1 — Search v1 scope: referral deep links first, on top of free price data
**Status: proposed by A on 2026-08-12, awaiting the user's confirmation.**
**Owner once confirmed: C.**

The question was whether to ship affiliate links out to Kiwi and friends, or
build the full search from the approved plan.

Recommendation: **do both halves of a small thing, not one half of a big
thing.** Ship destination discovery driven by Travelpayouts' free Data API,
with affiliate deep links out to Kiwi for the actual booking. No Kiwi Pro
subscription, no SerpApi, no SSE, no watches, no email alerts yet.

Reasoning:

- The risky unknown is not whether we can query flights — Google Flights and
  Kiwi already do that better than we will. It is whether anyone clicks a
  booking link out of a travel *log*. Deep links answer that in days.
- The Kiwi affiliate programme runs through Travelpayouts and wants a live
  site with traffic before approving. The links have to be up regardless.
- M1–M4 in the approved plan is weeks of work plus a recurring floor of $5/mo
  and SerpApi credits, all wagered on demand nobody has measured.
- But a plain "search flights" box is a commodity with no reason to exist
  inside Contrail. Our edge is that we know the ~170 countries you have *not*
  been to and where you fly from. So v1 should answer *"where haven't I been
  that's cheap from my airport this month"* — which needs price data, and
  Travelpayouts' free Data API returns exactly that shape (cheapest price per
  destination, no per-request billing).

So: map-native destination discovery on free surface data, affiliate links
out, click-through instrumented from day one. Give it a few weeks of real
usage. If people click, M1–M4 is justified by evidence; if they do not, we
saved the weeks and the subscription.

Instrument the click-through in v1 — without it this decision cannot be
revisited on data, which is the entire point of taking the small path.

---

## Open questions

Ask here instead of guessing. Format:

```
### Q1 — A → B — 2026-08-12
Question text.
**Answer (B, 2026-08-12):** ...
```

*(none yet)*

---

## Journals

Append entries at the bottom of your own section. Newest last. Keep each entry
to what another agent would need in order not to duplicate or break your work:
what changed, which branch, what you verified, what is still open.

### A — Product & Frontend

**2026-08-12 — set up coordination, shipped three fixes to `main`**
- `92ff227` Home country moved from the map filter panel into Settings; the
  desktop rail lifted to `z-40` so its hover labels stop being painted over by
  the search dropdown and filter card.
- `5f9a556` Login screen gained "Look around without an account". `RequireAuth`
  bounces anyone whose device remembers an account to `/login` when the session
  lapses, and the page previously offered no way back to the map.
- `b24fa88` Country borders now use `vector-effect: non-scaling-stroke`, so
  they hold 0.5 px at every zoom instead of painting at 4 px by zoom 8; zoom
  ceiling raised 8 → 16. Export canvas keeps the old scaling behaviour
  (`constantBorderWidth={false}`) because it is rasterised and upscaled.
- Verified: typecheck and build clean, painted stroke measured at scale 16,
  guest test row deleted, real data confirmed at 25/41/117.
- Open for A: accessibility pass, replay-as-video, bundle split.
- Known limitation now that zoom reaches 16: world-atlas 110 m coastlines go
  visibly polygonal past roughly zoom 10. Fix would be the 50 m topology, at
  the cost of a much larger CDN fetch before first paint. Not taken; the user
  has been protective of load time. B should weigh in if the bundle work
  changes that calculus.

### B — Security & Performance

*(no entries yet)*

### C — Trip Search

*(no entries yet)*

---

## Backlog — not started, do not start without asking

- **Password reset / forgot password.** Owner B. Deferred by the user on
  2026-08-12 ("maybe for later"). Note the interaction with guest accounts:
  a guest has no email, so recovery has to degrade gracefully rather than
  assume one exists.
- **Deployment.** Runbook on branch `worktree-deploy-mycontrail`, at
  `context/implement/2026-08-11_deployment_implement.md`. Code is done;
  droplet, DNS and TLS are manual steps the user has not taken yet. `.com`
  first, `.app` only after `.com` TLS works — the `.app` TLD is HSTS-preloaded
  and will refuse to load otherwise.
- **CI from the fitness app** — `deploy.yml`, `rollback.yml`, smoke tests.
- **50 m map topology**, per A's note above.
