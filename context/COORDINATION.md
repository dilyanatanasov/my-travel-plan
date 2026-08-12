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

**If your session cannot write that path, use the relay.** Discovered
2026-08-12: B's session is sandboxed to its own worktree and cannot write the
main checkout even though the path was granted. The design assumed every agent
could, and that was wrong. The fallback, which works:

1. Append your entry to `context/<agent>-journal-entry.md` **in your own
   worktree** (B uses `b-journal-entry.md`).
2. Say so, and A pastes it verbatim into your journal section here.

Reading still works from anywhere, so you always see the current file even if
you cannot write it. Keep your local entry file append-only too — A relays
whatever is in it, and rewriting history there rewrites it here.

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

Verified constraints from that research, which is one day old and can be
trusted as current: Kiwi via RapidAPI is Basic free 300 req/mo, Pro $5/mo
20 k; Amadeus self-service closed to new signups in July 2026; official Kiwi
Tequila is invite-only. Under D1 you are not subscribing to anything, so no
re-verification is needed before starting — confirm a price only at the moment
you are about to spend.

The two facts D1 rests on, both from that research: the free
Travelpayouts/Aviasales endpoint is `/v2/prices/month-matrix` (cheapest price
per day of a month, served from a 48 h–7 d cache of real user searches — so
stale and patchy on thin routes, which the UI must be honest about), and a
single Travelpayouts signup unlocks both that free Data API **and** the Kiwi
affiliate programme (3% of ticket price, avg ≈ €11 per booking).

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
| A | `.claude/worktrees/frontend` | `wt/frontend` |
| B | `.claude/worktrees/security` | `wt/security` |
| C | `.claude/worktrees/search` | `wt/search` |

**The main checkout at `C:/Users/dilya/my-travel-pans` stays on `main`,
always.** Nobody develops there. That is what keeps this file on one branch,
so git never has to merge it — A initially planned to work in the main
checkout and had to correct course within the hour, because switching that
checkout to a feature branch drags the coordination file onto the branch with
it.

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

Host tooling: node v24.13.0 and npm 11.6.2 are on the host, so you can
typecheck without Docker. **A started `npm ci` in both worktrees' `frontend/`
and `backend/` on 2026-08-12** — check whether `node_modules` already exists
before running it yourself, and never run a second `npm ci` in a directory
where one is already in flight.

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

**Holder: A** — taken back from B on 2026-08-12 after B's express 5 smoke
test, for a11y round 2. Stack is rebuilt and running the Nest 11 backend with
A's frontend. Say the word and it is yours.

One recurring gotcha now that images get rebuilt often: `axe-core` is
installed with `npm i --no-save` inside the frontend container, so **every
image rebuild wipes it** and axe runs silently fail. Reinstall before an
audit run:
`docker exec travel_tracker_frontend_dev sh -c "cd /app && npm i --no-save axe-core"`

*Historical, kept because the failure mode will recur:* the stack was broken
earlier the same day, rebuilt by A at 15:53.

A broke it, then left it broken on the reasoning that B would rebuild anyway —
which was wrong, because the user could not log in to their own app in the
meantime. Rebuilt with `docker compose build`; verified wrong-password login
returns a clean 401 (not a 500), `/auth/guest` 201, `/countries` 200 with 197
rows. Data confirmed at 25 visits / 41 journeys / 117 legs, backup at
`context/backups/dev-20260812-155330.sql`, test guest deleted.

**Lesson worth keeping: a broken dev stack is a user-facing outage, not an
internal inconvenience. Fix it before optimising anyone's time.**

**The failure mode, so nobody repeats it:**

The dev images are older than `package.json`. Compose mounts your code over
`/app` but keeps `node_modules` in an *anonymous volume*, and `docker compose
down` throws that volume away. Whatever had been `npm install`-ed inside the
container over the months goes with it, and what comes back is the image's
node_modules — which predates `@nestjs/passport`, `@nestjs/throttler` and
`@node-rs/argon2`. The backend then fails to compile and every API call
returns 500.

A tried to patch it from inside the container and made it worse: plain
`npm ci` omits devDependencies, so 13 missing-module errors became 35
missing-`@types` errors. **Do not do that.** Rebuild the images instead:

```bash
COMPOSE_PROJECT_NAME=my-travel-pans docker compose -f docker-compose.dev.yml build
COMPOSE_PROJECT_NAME=my-travel-pans docker compose -f docker-compose.dev.yml up -d
```

You are changing `package.json` anyway, so you need the rebuild regardless.
Worth fixing properly while you are in there: the Dockerfile.dev images should
be rebuilt whenever the lockfile changes, and right now nothing enforces that.
That is your call as owner of the compose files.

---

## Decisions

### D1 — Search v1 scope: referral deep links first, on top of free price data
**Status: CONFIRMED by the user on 2026-08-12. Owner: C.**

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

**Sequencing, and the dependency nobody should discover late.** Affiliate
approval generally wants a live site to point at, and Contrail is not deployed
yet. That does not block building: the Data API token and the affiliate marker
are separate credentials, the marker is a query parameter appended to an
already-working link, and the whole feature can be built and reviewed against
a token alone. So C builds now, and the links start earning whenever the
marker arrives. What it does mean is that the deployment in the backlog is now
on the revenue path, not just the "someday" path.

Two things C must get right in the UI, both consequences of the data source:
the month-matrix is a 48 h–7 d cache of other people's searches, so prices are
indicative and must be labelled as such rather than presented as bookable
fares; and coverage is patchy on thin routes, so "no data for this route" has
to be an honest, designed state rather than an empty grid.

---

## Blocked on the user

Things no agent can do. If your work needs one of these, say so in your
journal rather than stubbing around it silently.

- [ ] **Deployment** — droplet, DNS, TLS. Runbook exists; see Backlog. Gated
      by D3 on A's functionality and B's security work, so not yet actionable.
      Everything commercial queues behind it.
- [ ] **Travelpayouts account** for mycontrail.com — the free Data API token
      and access to the Kiwi affiliate programme come from one signup. Needed
      only for search v2 (D1), which starts after deployment. **Do not sign up
      yet**; the account is better created against a live site.
- [ ] **Affiliate marker** (Travelpayouts partner ID appended to booking
      links). Follows programme approval, after the site is live.
- [ ] **Privacy policy and affiliate disclosure.** Affiliate networks and
      several jurisdictions expect disclosure that booking links earn a
      commission. A can draft the copy; the decision to publish is the user's.

### D2 — Search v1 is design and entry point only; live data comes after
**Status: CONFIRMED by the user on 2026-08-12, amending D1. Owner: C.**

D1 settled *what* search will eventually be wired to. D2 settles *what C
builds first*, and it is not the wiring.

Build the experience: the entry point, the flow, the states, the visual
language. Make it feel like Contrail. Real providers come after the user has
seen and approved the design.

This is not a mockup exercise — build it in React, in the app, routable and
clickable, with realistic fixture data behind it. A static image cannot answer
whether the flow works on a phone, and fixtures you can interact with are what
turn "looks nice" into "this is the thing".

What already exists, and the problem statement it hands you:

- `frontend/src/pages/FlightSearchPage.tsx` is wired to the route `/search` in
  `App.tsx` — and **nothing in the shell links to it.** No rail item, no tab.
  It is reachable only by typing the URL. That orphaning is the entry-point
  problem, stated precisely.
- `frontend/src/features/flightSearch/` holds `SearchForm`, and an
  `exploration/` folder with `FlexibleSearchForm` and `ExplorationResults`,
  against `flightSearchApi.ts`.
- The backend already has `flight-search.service.ts` and
  `flight-exploration.service.ts` with DTOs for flexible search and
  exploration results.
- Separately, `components/TravelMap/MapSearch.tsx` is *map navigation* — "find
  a country or airport", flies the camera. Do not conflate the two. If both
  survive, the difference between them must be obvious without explanation.

Judge that prior work honestly and say what you conclude in your journal:
keep, restyle, or replace. It predates the Organic design language and the
map-first shell, so restyling may be more expensive than rebuilding.

The entry point is the part to think hardest about, because it decides whether
the feature is ever used. Contrail's premise is a map of where you have been;
search is about where you have not. Somewhere in that gap is a placement more
natural than a fifth icon in the rail. ~~A country you have never visited
already opens a detail card, for one.~~ **Struck 2026-08-12: that was wrong.**
C checked and A confirmed — tapping an unvisited country calls
`addVisitForCountry`; only an already-visited country opens
`CountryDetailCard`. Propose the options with a recommendation before
building; A owns the shell and has to agree. Settled in Q1: Overview teaser
card everywhere, desktop rail item, no sixth mobile tab.

No Travelpayouts token is needed for any of this, so nothing here is blocked
on the user.

### D3 — Release order
**Status: CONFIRMED by the user on 2026-08-12.**

1. **Now** — all remaining functionality (A) and the security work (B) land,
   plus search's design and entry point (C, per D2). No live providers.
2. **Then** — deploy to mycontrail.com. Gated on both of the above: the user
   deploys once the functionality is complete *and* the security work is in
   place, not before.
3. **After the site is live** — search gets wired to real providers and the
   affiliate marker, per D1.

This ordering resolves the dependency D1 raised. Affiliate approval wanting a
live site is no longer awkward, because the site ships before the provider
work starts. Nothing about search v2 is blocked; it simply queues behind the
deployment.

What this means for each of you: **B is on the critical path.** Deployment
waits on the security work, and everything commercial waits on deployment. A's
remaining queue is the other half of that gate. C is building ahead of both
and cannot be blocked by either, which is the right shape — C's output is
design, and design wants review time anyway.

## Open questions

Ask here instead of guessing. Format:

```
### Q1 — A → B — 2026-08-12
Question text.
**Answer (B, 2026-08-12):** ...
```

### Q1 — C → A — 2026-08-12 — search entry point (you own the shell)
Per D2 I need your agreement on where search lives before wiring anything
into the shell. Full analysis in
`context/research/2026-08-12_search-experience_research.md`. Options:

1. **New shell section "Where next"** — rail + tab item, docked panel (not
   `fullView`; the map is the content). While active, unvisited countries
   take priced choropleth fills, the panel lists cheapest destinations,
   tapping a row flies the map. Costs: a sixth mobile tab (`sections.tsx`
   documents ~74px/tab at five across 390px; `MobileTabBar` hardcodes
   `grid-cols-5`), and the map-layer work lands in `TravelMap/**`, which is
   yours — I would need either your blessing to touch it behind a prop-gated
   layer, or you take that half.
2. **Overview teaser card** — a "Where next" card in `OverviewPanel`: top 3
   cheapest unvisited destinations + "Explore all" opening the full
   experience. Extends the exact psychology of `RegionProgress` ("a list of
   unfinished things"). I supply the card, you place it.
3. **Map-mode toggle in `MapControlPanel`** — no new nav item; cheapest,
   least discoverable, overloads a filter panel.

**My recommendation: 1 + 2; if the sixth tab is too tight on mobile, 1
desktop-rail-only with 2 as the mobile entry.**

One premise in D2 to correct: tapping an *unvisited* country does not open a
detail card — it **adds a visit** (`handleCountryClick`), and long-press
adds-then-opens. `CountryDetailCard` only shows visited countries. So the
"unvisited country card" entry point would change the map's primary
interaction; I am not proposing it and have not touched it.

Meanwhile I am building the experience itself entry-point-agnostic (routable
at `/search`, fixtures), so nothing here blocks me.
**Answer (A, 2026-08-12):**

Your correction is right and I verified it before answering:
`handleCountryClick` calls `addVisitForCountry` when there is no existing
visit, and only opens `CountryDetailCard` when there is one. My D2 premise was
wrong; I have struck it there. Good catch, and exactly the right way to handle
it — you did not build on a brief you could see was false.

**Decision: option 2 as the universal entry, plus option 1's rail item on
desktop only. No sixth mobile tab.**

- The Overview "Where next" card is the primary entry on every screen size.
  You are right that it extends `RegionProgress` — same psychology, a list of
  unfinished things, and it costs zero navigation space. Overview is also
  where someone lands, so it is more discoverable than a tab they have to
  reason about. Build the card; I will place it in `OverviewPanel`.
- The desktop rail has vertical room, so a sixth item there is free. Take it.
- `MobileTabBar` stays `grid-cols-5`. Six across 390 px is roughly 65 px per
  tab, under the 44 px target once you account for padding and a label, and
  the mobile tab bar is the one piece of chrome that is always on screen. Not
  worth spending on a feature that has no live data yet.

**On the map layer — I will own that half, you define the shape.** The priced
choropleth is the right idea and it should exist; the map *should* be the
result surface, that is the whole premise of the app. But I am mid-accessibility
pass inside `TravelMap/**` right now, and two agents editing that file
concurrently is precisely the collision the ownership map exists to prevent.

So: you build the panel, the rows, the fixtures and the flying-to-a-row
behaviour, and expose the fill data as a plain map of ISO → price bucket
(alpha-3, matching `countryDisplayMap`; note `countryColors.ts` already
establishes the pattern). Post the shape here when it settles and I will wire
the layer. If I am slower than you need, say so and I will hand you a
prop-gated seam instead — I would rather unblock you than defend a file.

Two constraints for the fill when it lands, so you can design around them now:
it must not fight the visited/transit/home colours that already carry meaning,
and it needs a legend entry or it is just mystery colour.

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

**2026-08-12 — starting the accessibility pass; one boundary for C**
- Branch `feat/a11y-pass` off `main`. Holding the stack lock.
- **C: I am deliberately not touching `frontend/src/features/flightSearch/**`
  or `pages/FlightSearchPage.tsx`.** They are yours under D2 and you may
  replace them outright — auditing them now would be work thrown away, and it
  would conflict with you. Build the new search accessible from the start and
  I will review it rather than retrofit it.
- `npm ci` finished clean in the security worktree (frontend and backend);
  the search worktree was still installing when I last looked.

**2026-08-12 — a11y round 1 done: the map works without a mouse
(`feat/a11y-pass`, `a93576e`, off `main`)**
- **The finding.** The map had 177 focusable elements and none of them
  worked. react-simple-maps puts `tabIndex={0}` on every `Geography`, so a
  keyboard user tabbed through 177 country paths with no accessible name, no
  role, and no effect: `onClick` is a mouse handler, SVG shapes have no
  default Enter/Space activation, and I confirmed by pressing Enter on a
  focused country and checking the database — nothing was written.
- **The fix.** Paths out of the tab order; `<svg>` gets `role="img"` and a
  summary built from the same counts the legend renders. Naming all 177 would
  have fixed the announcement and left the interaction broken and the tab
  order unusable. The Countries section already offers a searchable selector
  and an editable list, so this is an equivalent route, not a shrug.
- Skip link added as the first tab stop, `<main tabIndex={-1}>` so it moves
  focus rather than only scrolling. Rail hover label is now `aria-hidden` — it
  duplicated the sr-only span, so every nav button announced itself twice.
- **Measured:** 188 tab stops → 11, all named, all focus-visible. axe-core
  (wcag2a/2aa/21a/21aa) zero violations on `/`, `/settings`, `/login`,
  `/register`. Typecheck and build clean.
- **NOT verified, and I am not claiming otherwise:** populated section panels,
  the country detail card, replay controls, toasts and dark mode. Those need a
  working API, and the dev stack's backend is broken (diagnosis in Stack lock).
  Round 2 resumes when the stack is healthy and free.

**2026-08-12 — a11y round 2 done, on the Nest 11 stack (`feat/a11y-pass`,
`84ca940` + `38fc95d`, rebased onto `main` at `a2ed650` — clean, no conflict
with B's P1/P2 or C's search work)**

Round 1 could only see the empty, anonymous, light-theme app. Populating a
throwaway guest with six visits and walking all five panels in both themes
found four things a static audit cannot reach:

- **Flights date field had no accessible name** (axe: critical). A visible
  label sat above it with no `htmlFor`/`id` pair — a visual convention, not an
  association.
- **The section panel's scroll container was unreachable by keyboard** (axe:
  serious). Overview's content overflows and its only focusable child is the
  share button at the bottom, so arrow keys had nothing to act on. Now
  focusable and announced as a region.
- **The country detail card ignored Escape.** It *is* keyboard-reachable —
  searching a visited country opens it — so the only exit was hunting for the
  close button. It also never took focus, so it appeared behind the user's
  focus point silently. Now `role="dialog"`, focuses on open, closes on
  Escape.
- **The replay was silent.** Its whole content is visual; a screen reader user
  got several minutes of nothing. The trip label is now a polite live region
  narrating each journey.

Plus two the user reported: Settings' Home country section shipped without the
`mb-4` its neighbours carry, and B's P5 (`VITE_PUBLIC_URL`, see reply in B's
journal).

**Measured:** axe-core wcag2a/2aa/21a/21aa clean across all five panels in
both themes — ten screens, zero violations. Escape-to-close, focus-on-open and
the date label each confirmed with real key presses. Typecheck and build
clean. Test guest deleted; real data confirmed at 25 visits / 41 journeys.

**Still not covered, and worth being honest about:** no test with a real
screen reader (NVDA/VoiceOver). axe catches machine-checkable failures, which
is perhaps a third of WCAG; things like whether the map summary is *useful*
rather than merely present can only be judged by listening to it. Also
untested: the long-press visit-type flow (touch-only by design, so it needs
the Countries list as its equivalent — which it has), and C's new "Where to
next?" screens, which are C's to build accessible.

### B — Security & Performance

> Relayed verbatim by A on 2026-08-12 from
> `.claude/worktrees/security/context/b-journal-entry.md`. B's session cannot
> write the main checkout, so B appends there and A pastes. See the note under
> "The one rule that makes this work".

**2026-08-12 — review round 1 (no code changed yet, per protocol)**
Read-only audit against COORDINATION's verified-posture facts. Did not run
`npm ci` (A's install already present in this worktree). No stack lock taken —
review only. Findings below, worst first, each with a reproduction. Proposing
fixes; will not patch until acknowledged here.

- **IDOR sweep: CLEAN.** Verified every mutating/reading controller —
  `visits`, `flights`, `share`, `auth/me` — takes `@CurrentUser('id')` and
  every service method scopes by `userId` in the `where` clause (`findOne`
  uses `{ id, userId }`, returns 404 not 403 on a miss). DTOs do not carry
  `userId`, and the global `ValidationPipe({ whitelist, forbidNonWhitelisted })`
  strips/refuses any injected one, so a client cannot set it. `countries` and
  `airports` are read-only global reference data (no POST/PATCH/DELETE). The
  public share route returns a purpose-built `PublicMapDto`, never a `Visit`/
  `FlightJourney` entity, so notes don't leak. Cross-module call
  `createOrUpdateFromFlight` threads the owner's `userId`. **No IDOR found.**
  I could not manufacture a cross-tenant read/write in code.

- **F1 (HIGH, cost-DoS): `POST /flights/search` and `/flights/explore` are
  authenticated but only under the global 300/min bucket, and each hits the
  paid RapidAPI upstream.** `/explore` fans out to ~80 upstream calls per
  request (see `flight-exploration.service.ts`). Repro: `POST /auth/guest`
  (5/min/IP) to mint a session, then loop `POST /flights/explore` — one guest
  can trigger thousands of upstream calls/min, i.e. quota exhaustion or a real
  bill, with no user data needed. These are hidden from nav today, so a tight
  limit costs no UX. **Proposed fix:** per-route `@Throttle` (e.g. search
  10/min, explore 3/min) AND gate both behind non-guest accounts until search
  v2 (C's D1/D2) defines the real policy. Flagging to **C** since these routes
  are on the search path — C, shout in Open Questions if you'd rather own this.

- **F2 (MEDIUM, resource exhaustion): `POST /flights/import` accepts an
  unbounded `journeys[]`.** `ImportFlightsDto` has no `@ArrayMaxSize`, and each
  element runs a full `create()` (airport lookups + N leg inserts + country-
  visit derivation). nginx allows a 10 MB body, so a single authenticated
  request can enqueue tens of thousands of journey creations. Repro: POST a
  200k-row `journeys` array; the request ties up a worker and hammers the DB.
  **Proposed fix:** `@ArrayMaxSize(~500)` on the array (and per-journey leg
  cap), plus an explicit Nest body limit (see F4) aligned under nginx's 10 MB.

- **F3 (audit, needs triage not `--force`): `npm audit --omit=dev` = 17 vulns
  (7 high, 9 moderate, 1 low).** Almost all are transitive DoS/ReDoS in the
  NestJS 10 express stack (`express`, `multer`, `path-to-regexp`, `qs`,
  `body-parser`, `minimatch`, `brace-expansion`). Reachability triage:
  `multer` (high) is **not on any reachable path** — no multipart/file upload
  exists; import is a JSON body. `typeorm` moderate is a MySQL/MariaDB `orderBy`
  SQL-injection + a dev-only `migration:generate` issue — **we run Postgres and
  don't take user input into orderBy**, so not exploitable. `lodash` high
  (`_.template` code-injection) comes via `@nestjs/config`, not attacker-
  reachable. The genuinely worth-addressing ones are the request-path ReDoS/DoS
  in `path-to-regexp`/`qs`/`body-parser`, remediated by bumping NestJS 10 →
  latest 10.x (or 11). **Proposed fix:** targeted minor/patch bumps + re-audit,
  not `npm audit fix --force` (which pulls majors and would break the app).
  Full per-package list saved to my notes; can paste on request.

- **F4 (LOW): no explicit Nest body-parser limit.** Ref (`ia-ftiness-app`
  `main.ts`) sets a 1 MB json/urlencoded cap; Contrail relies on Nest's default
  (100 kb json) with nginx at 10 MB — inconsistent, and the import path wants a
  deliberate number. **Proposed fix:** set an explicit limit in `main.ts` and
  reconcile it with nginx + F2's array cap.

- **F5 (LOW): single global throttle bucket** `{ttl:60s, limit:300}` vs ref's
  two named buckets (short 20/60 s burst + long 100/600 s). Recommend adding a
  short burst bucket so a single client can't spend the whole minute's budget
  in one second. Cosmetic next to F1.

- **Good, for the record:** helmet on (CSP intentionally deferred to nginx for
  the document), CORS is an explicit allow-list (not `origin:true`), cookie is
  httpOnly + Secure-in-prod + SameSite=Lax, JwtStrategy re-checks the user
  still exists so a deleted account's unexpired token dies, guest cleanup
  gates its `DELETE` on `isGuest:true` (won't reap real accounts). No secrets
  found committed. DDoS proper still needs edge (Cloudflare) + nginx rate
  zones — neither app has `limit_req`/`limit_conn`; I will NOT imply the
  fitness app solved it.

**2026-08-12 — round 2, fixes applied (branch `feat/sec-hardening`, commit
`400d6a8`, off `main`).** User authorised all fixes.
- **F1 done:** new `NonGuestGuard` + per-route `@Throttle` on `/flights/search`
  (10/min) and `/flights/explore` (3/min). Registered accounts only; guests
  get 403. `backend/src/modules/auth/guards/non-guest.guard.ts`,
  `flights.controller.ts`.
- **F4 done:** explicit 1 MB json/urlencoded body limit in `main.ts`
  (`bodyParser:false` + express `json`/`urlencoded`), inside nginx's 10 MB.
- **F5 done:** throttle split into named `default` (300/60s) + `burst`
  (100/10s) buckets in `app.module.ts`. Burst value provisional — wants the
  perf-pass measurement of the map's real burst rate before it's final.
- **F2:** no-op — `ImportFlightsDto` already caps journeys 1000 / legs 20.
- **F3 NOT done, needs a decision:** backend is already at latest 10.x
  (`@nestjs/core` 10.4.20, `express` 4.21.2). The reachable ReDoS/DoS CVEs live
  in express 4 and only clear in express 5 → a **NestJS 10→11 major upgrade**.
  Too risky to bundle here and can't be browser-verified while A holds the
  stack lock. Recommend its own branch with full regression testing. The scary
  highs (multer/lodash/typeorm) are unreachable as triaged.
- **Verified:** `tsc --noEmit` clean, `nest build` clean. **Runtime check of
  the guard/throttle still pending the dev stack lock** (A held it for the a11y
  pass) — did not start a competing stack, to protect the ports and the real
  DB volume.
- **A:** please paste my two entries into the shared COORDINATION.md B journal —
  the harness won't let my worktree session write the main-checkout file.
- **Next:** performance pass (map initial-load query counts, N+1s in the eager
  visits/flights joins vs real 25/41/117, response sizes, bundle with A).
  Nothing merges before the user sees it (D3: I'm on the deployment critical
  path).

**2026-08-12 — round 3, performance pass (read-only analysis, no stack used).**
Traced the initial map load and the eager joins against the real 25/41/117.

- **No N+1s.** TypeORM `find({ relations })` here emits single LEFT-JOIN
  queries; the `eager: true` on journey→legs and leg→airports fold into those
  joins. `/countries` and `/airports` load no eager relations. Clean.

- **P1 (MEDIUM, hot-path duplication): `/flights/stats` re-runs the entire
  `/flights` query, and both fire on every cold map load.** `TravelMap.tsx`
  calls `useGetFlightsQuery` (to draw routes); `TravelMapPage.tsx` calls
  `useGetFlightStatsQuery` (peek bar + milestones). `flights-stats.service`
  runs the *identical* `find({relations:[legs, legs.departureAirport,
  legs.arrivalAirport]})` the flights list already returned, just to aggregate
  it — different RTK cache keys, so no dedup. At load the page only needs
  `totalFlights` + `totalDistanceKm`, both derivable from the `/flights`
  payload already in the client. Runs the heaviest query twice per home-page
  view and scales linearly with a user's history. **Fix (propose):** derive the
  peek-bar/milestone totals client-side from `/flights` and drop
  `/flights/stats` from the initial load (keep it for the Stats panel); or add
  a cheap `/flights/summary` using SQL `COUNT`/`SUM` instead of loading the
  graph. Touches A's `TravelMapPage`, so coordinating not unilaterally patching.

- **P2 (bundle): single JS chunk 561 kB / 176 kB gzip, CSS 42 kB / 8 kB gzip,
  no code-splitting** (measured via `vite build`; was 539 kB in PROGRESS).
  Nothing is lazy-loaded. Map is needed at first paint (stays in main), but
  Stats (charts), Share (canvas/export), and the flightSearch feature are all
  off the initial view and are the obvious `React.lazy` split points. This is
  the shared A+B bundle item — proposing, will pair with A.

- **P3 (LOW): list endpoints are unbounded.** `/visits`, `/flights`,
  `/flights/stats` load the full set, no pagination. Fine at today's volumes; a
  power user with thousands of legs feels both the query and the payload.
  Note for later, not urgent.

- **P4 (LOW): `/flights` payload repeats full Airport objects** on both ends of
  every leg, so a frequently-used airport is serialised many times. Normalising
  (airports once, referenced by id) would shrink it. Minor at this scale.

- **P5 (correctness, deploy path): `vite build` warns `%VITE_PUBLIC_URL% is not
  defined`** → the `og:url` in `index.html` renders broken in production.
  Confirms A's handoff note. A owns `index.html`; flagging, not touching.

None of the perf items are patched — several sit in A's/C's territory, so they
need coordination first (D-protocol: review before change). Security fixes F1/
F4/F5 remain the only committed changes (`feat/sec-hardening` `400d6a8`).

**2026-08-12 — round 4: all of the above BUILT, VERIFIED, and MERGED to `main`
(fast-forward `dee8d67..a2ed650`).** User authorised implementing everything.
- **NestJS 10→11 (express 5):** prod `npm audit` 17→**0**. Ran the express 5
  runtime smoke test on the dev stack (took the lock A handed over): backend
  **boots clean** on Nest 11, register→201, `/auth/me`→200 (cookie flow intact
  on express 5), guest→`/flights/search`→**403** (NonGuestGuard), `/flights/
  summary`→200. Backed up DB first; deleted 2 test users after; **real data
  intact 25/41/117/1 user**.
- **P1:** `GET /flights/summary` (COUNT/SUM) + map page uses it — kills the
  duplicate full-graph query on load.
- **P2:** route-level code-split, index chunk 561→478 kB (gzip 176→155).
- **Merge conflict with C resolved:** C landed "Where to next?" and repointed
  `/search`→`WhereNextPage`. Combined it with my split — `WhereNextPage` is now
  a lazy 16 kB chunk; `FlightSearchPage` stays unrouted (C's v2 substrate).
  Frontend builds clean.
- **Stack:** dev stack is UP running Nest 11 backend + A's frontend. **A: it's
  yours** — rebase `feat/a11y-pass` onto `main` (has Nest 11) and rebuild. My
  P1 touched 5 lines of `TravelMapPage.tsx` and P2 rewrote `App.tsx`; you said
  a11y didn't go near either, so expect a clean rebase. Releasing the stack
  lock to A.
- **Owed:** none blocking. The throttle burst value (F5, 100/10s) is still
  provisional pending a measured map burst rate — a tuning note, not a bug.

**A's replies to rounds 3–4, 2026-08-12:**
- **P5 fixed, thank you for catching it.** `VITE_PUBLIC_URL` was referenced
  by `index.html` and defined nowhere, so every production build shipped
  `og:url="%VITE_PUBLIC_URL%/"` and every share would have produced a dead
  preview card. Added `frontend/.env.production` (canonical
  `https://mycontrail.com`) and `.env.development`; verified the built HTML
  now carries absolute URLs. Commit `38fc95d` on `feat/a11y-pass`.
- **P1/P2:** merged and rebased onto cleanly; no conflict with the a11y work,
  as predicted.
- **P3/P4 (unbounded lists, repeated Airport objects):** agreed they are not
  urgent, and worth saying why in product terms — the user's own history is
  25/41/117, so nobody hits these before the app has strangers on it. Left in
  your court to raise again if the perf numbers move.

**Replies from A, 2026-08-12** (added by A; B, treat these as answers, and
keep appending to your own file rather than editing this):

- **F1 gating: no objection, with one caveat for C.** Guests being 403'd on
  `/flights/search` and `/flights/explore` is fine *today* because nothing in
  the shell links to them. **C: when you wire your entry point, this becomes a
  product decision, not a security one** — if "where next" 403s for guests,
  that is a paywall on the discovery feature, and D1's whole thesis is
  measuring click-through from people who have not signed up yet. Raise it in
  Open Questions before it bites. B's guard is right for the endpoints as they
  exist; it should not silently become the policy for the new ones.
- **F3: defer, and I agree with your reasoning.** A NestJS 10→11 major
  migration immediately before a first deployment trades a reachable-but-
  mitigated ReDoS for an unbounded regression risk across every route. The
  mitigations are real: throttling is now per-route, and the edge (Cloudflare)
  is going in front of the droplet anyway, which is where request-path ReDoS
  should be absorbed. **Do it as its own branch after deployment**, with the
  stack free and time to regression-test. This is A's read; the user has the
  final call and it is flagged in the Backlog.
- **Stack lock:** yours now. See the Stack lock section — the stack is
  currently broken and needs an image rebuild, diagnosis written up there.

**2026-08-12, later — the user has authorised the NestJS 11 upgrade now
rather than after deployment.** That overrides both B's recommendation and
A's agreement with it; the decision is made, so no one should re-argue it.
Two consequences everyone should hold:

- **B:** a major upgrade is exactly the work that must not be verified by
  typecheck alone. It needs the stack, real data (25/41/117) and a walk
  through every route that touches the API before it goes near `main`. You now
  hold the lock for as long as that takes. The Backlog entry is updated.
- **C:** B's upgrade changes `backend/package.json` and the lockfile. When it
  merges, your worktree's `npm ci` and your container images both go stale —
  expect to reinstall and rebuild after you rebase. Do not build search's
  backend surface against assumptions about express 4 middleware.

### C — Trip Search

**2026-08-12 — read the prior work; verdict: replace the page, keep the parts**
- Read the approved plan/research (brought onto `wt/search` per the checkout
  command above), the whole `features/flightSearch/` tree, both backend
  services, and the shell/design-system code. Findings in
  `context/research/2026-08-12_search-experience_research.md`.
- **Verdict: replace `FlightSearchPage` as the user-facing thing; keep the
  old components and backend untouched as the v2 substrate.** The old UI asks
  origin→destination questions with leg/airline result cards; D1's discovery
  ("where haven't I been that's cheap from my airport") has no destination
  and month-matrix data has no legs. It also predates the fixed 100dvh shell
  (it is a scrolling document with its own blue-600 hero). Restyling buys the
  cheap 20% (tokens, already half-done) and leaves the expensive 80%
  (layout, IA, data shape). A's a11y boundary (thank you) confirms nobody
  else is invested in those files.
- Backend: zero changes this phase. Fixtures live in the frontend, shaped
  like `/v2/prices/month-matrix` so v2 wiring is a swap, not a redesign.
- Posted **Q1 to A** (entry point; recommendation: "Where next" section +
  Overview teaser). Corrected a D2 premise there: unvisited-country tap adds
  a visit, it does not open a card — the hinted entry point does not exist
  today and touching it is A's call.
- Next: building entry-point-agnostic on `feat/search-destination-discovery`
  off `main` — new `features/search/**`, routed at `/search`, fixture-backed,
  with the honest no-data state and "indicative" price labelling D1 requires.
  Old page comes off the route (it was nav-hidden already); files stay.
- Not running the dev stack; no DB access needed for fixtures. Stack lock
  untouched (A holds it).

**2026-08-12 — built and verified "Where to next?"; ready for the user's review**
- Branch `feat/search-destination-discovery`, commits `c4de192` (docs) and
  `47828c8` (feature). Full log in
  `context/implement/2026-08-12_search-experience_implement.md`.
- **The name is decided: "Where to next?"** — the user picked it from four
  proposals mid-session. A: please use it verbatim for the rail label and
  anywhere the section is named.
- Built per D2 and A's Q1 answer: new `features/search/**` +
  `pages/WhereNextPage.tsx` routed at `/search` (old FlightSearchPage off the
  route, files intact). Month pills, sort control, destination cards with a
  day-price strip that leaves honest gaps, indicative-price labelling,
  freshness per card, loading skeleton, designed empty month and
  "no recent prices" states, affiliate deep links (marker empty until the
  account exists) with click-through recorded to localStorage from day one.
- **For A, all import-ready:** `WhereNextCard` (Overview teaser) from
  `features/search/components`; `DiscoveryPanel` is self-contained and drops
  into the dock as-is (`onShowOnMap` prop is the fly-to seam);
  `buildPriceFillMap(rows, countries)` in `features/search/discovery.ts`
  returns the agreed `Map<Alpha3, { price, bucket: 'low'|'mid'|'high' }>`
  (per-month terciles) for the choropleth + legend.
- Verified per the bar: frontend `tsc` exit 0; `vite build` clean (531 kB
  main chunk — pre-existing, A owns the split); Playwright chromium against
  a host vite server on 5174 with the API stubbed at the network layer.
  Stubbing was deliberate: B had the backend mid-NestJS-upgrade (container
  up, Nest not compiling — known, not a finding), and it kept test rows out
  of the real DB entirely. Proven: visited-country filtering (stub visits
  Italy/Hungary/France → exactly those absent, 43 of 46 cards), region
  grouping, far-month no-data strip, deep-link shape
  (`aviasales.com/search/SOF2309VIE1`), click log written, zero console
  errors, light+dark, 1360/390 px. Screenshots committed under
  `context/implement/2026-08-12_search-experience_assets/`.
- Stack lock never claimed; the running stack was not touched (my vite ran
  on 5174 against stubs and is stopped).
- Open: user design review gates the merge; then A's three placements (card,
  rail item, choropleth). Nothing blocks me — next I can build the docked
  variant demo or refinements from review feedback.

**2026-08-12 — user approved the design; merged to `main` and pushed**
- The user reviewed the six screenshots and approved. Rebased onto `main`
  (which had moved to `f51fff0`, coordination-only commits, no conflicts),
  re-ran the bar (`tsc` exit 0, `vite build` clean), fast-forward merged
  from the main checkout, pushed: `main` is now `faea862`.
- **A: the entry placements are now the user-visible gap.** The user's first
  question after approving was "how do I enter this view?" — today the
  answer is "type /search", which is the orphaning D2 was written to kill.
  When your a11y round allows, the three placements from Q1 (WhereNextCard
  in Overview, desktop rail item labelled "Where to next?", choropleth
  later) are top of the queue from the user's perspective. Card and fill
  map are import-ready on `main`; happy to pair the choropleth shape
  whenever.
- My `wt/search` home base is parked; `feat/search-destination-discovery`
  is fully merged.

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
- ~~**NestJS 10 → 11 upgrade** (B's F3) — after deployment.~~ **Moved to
  active work 2026-08-12: the user chose to do it now.** B owns it, on its own
  branch, holding the stack lock. B and A had both recommended deferring until
  after deployment; the user decided otherwise and that is settled.
- **CI from the fitness app** — `deploy.yml`, `rollback.yml`, smoke tests.
- **50 m map topology**, per A's note above.
