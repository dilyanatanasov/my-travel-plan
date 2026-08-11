# Roadmap Progress — "make it something people want to use"

**Resume anchor.** If a session ends or tokens reset, read this file first, then the
`_implement.md` doc for whichever item is IN PROGRESS. Update the checkboxes as work lands.

Started: 2026-08-10
Source review: UX/product review of the running app (desktop 1440px + mobile 390px) on 2026-08-10.

---

## Confirmed decisions (do not re-ask)

| Decision | Choice |
|---|---|
| Auth method | Email + password, JWT in **httpOnly cookie** (argon2 hashing) |
| Existing data (25 visits, 41 journeys) | **Claim into the first account created** — backfill, no data loss |
| Schema changes | **Switch to proper TypeORM migrations**, drop reliance on `synchronize` |
| Signup policy | **Open signup** (+ rate limiting on auth endpoints) |

---

## Items

- [x] **1. Users + auth + scope all data by userId** — DONE, verified (see implement doc)
- [x] **2. Mobile pass** (superseded in part by 5.5) — DONE, verified (0 sub-44px targets, no h-scroll, PWA installable)
- [x] **3. Design tokens + palette** — DONE, verified (greyscale-safe map, AA contrast)
- [x] **4. Share (export PNG + OG tags)** — DONE, verified (payload leak-checked; revocation works)
- [x] **5. Flight list grouping by year + undo toasts** — DONE, verified (undo restores full record; 7771px → 3121px)
- [x] **5.5. Map-first app shell** — DONE, verified (no page scroll; wheel-hijack fixed at root)
- [x] **6. Flight import (CSV)** — DONE (parse + preview + idempotent import)
- [~] **7. Flight search** — DECIDED: keep it, hidden from nav for now. Its differentiator
  is persistent personal constraints (preferred airports, minimum layover, departure hour)
  and month-level "when is this cheapest" questions, which mainstream search does not answer.
  The current quality ceiling is the free rotating API key; paid multi-source is the upgrade
  path, funded by subscriptions. Do NOT delete the backend.
- [ ] 8. Accessibility pass

---

## Item 1 — subtask checklist

Docs: `context/research/2026-08-10_user-accounts-auth_research.md`,
`context/plan/2026-08-10_user-accounts-auth_plan.md`,
`context/implement/2026-08-10_user-accounts-auth_implement.md`

### Backend
- [x] 1.1 Install deps (@nestjs/jwt, @nestjs/passport, passport, passport-jwt, argon2, cookie-parser, @nestjs/throttler)
- [x] 1.2 Migration infrastructure (`data-source.ts`, npm scripts, turn off `synchronize`)
- [x] 1.3 `User` entity + `users` table migration
- [x] 1.4 Migration: add nullable `user_id` to `visits` + `flight_journeys` (+ indexes)
- [x] 1.5 Auth module: register / login / logout / me, `JwtStrategy`, global `JwtAuthGuard`, `@Public()`, `@CurrentUser()`
- [x] 1.6 Claim-orphan-data-on-first-registration logic
- [x] 1.7 Scope `VisitsService` by userId (findAll, findOne, create, update, remove, setHomeCountry, getHomeCountry, findByCountryId, createOrUpdateFromFlight)
- [x] 1.8 Scope `FlightsService` + `FlightsStatsService` by userId
- [x] 1.9 Rate limit auth endpoints; tighten CORS to an env-driven origin

### Frontend
- [x] 1.10 `credentials: 'include'` in RTK Query baseQuery + 401 handling
- [x] 1.11 authApi slice (register/login/logout/me)
- [x] 1.12 Login + Register pages
- [x] 1.13 Protected route wrapper + auth bootstrap on load
- [x] 1.14 Account menu / logout in header

### Verify
- [x] 1.15 Migration runs against the live dev DB without data loss (41 journeys, 25 visits intact)
- [x] 1.16 End-to-end in browser: register → data claimed → logout → login → data still scoped
- [x] 1.17 Second account sees an empty map (proves scoping works)

---

## Known issues logged during review (fix within the items above)

- `main.ts:11` CORS `origin: true` with credentials → item 1.9.

---

## Follow-ups discovered while implementing

- **Flights still have no undo.** `POST /flights` re-derives legs from `isRoundTrip`, so
  replaying a deleted journey would duplicate legs or drop the flag. Needs a
  `POST /flights/restore` endpoint that takes a journey verbatim. Until then flight deletion
  keeps its confirm dialog. See `2026-08-10_undo-and-flight-list_implement.md`.
- **Dark mode is groundwork only.** Tokens and `darkMode:'class'` exist; no theme ships.
- **`features/flightSearch/` still uses raw `blue-*`** — deliberately skipped pending item 7.
- **`user_id` is nullable** at the DB level to allow the item-1 backfill. Once confident
  there are no orphans, a migration can set NOT NULL.
- **Dev gotchas:** `docker compose restart` does not re-read `.env` (use
  `up -d --force-recreate`); Tailwind config changes need a frontend container restart.
- **Per-link OG tags need server-rendered HTML** — crawlers do not run JS, so every shared
  link previews with the same generic card. Highest-value sharing follow-up.
- **Micro-states do not render** — `countries-110m` omits Malta/Vatican/Monaco etc, so 25
  visits draw 23 shapes. `countries-50m` would fix it.
- **Backend watcher** now uses polling (`nest-cli.json`), same fix as Vite. Both dev servers
  pick up host edits; no more mystery stale routes.
- **Opening the app from a phone** works via the Vite `/api` proxy — no absolute API host is
  baked into the bundle. Reach it at `http://<your-LAN-IP>:5173`. If the machine's IP changes,
  nothing needs updating for the browser; only the `CORS_ORIGIN` allowlist matters for direct
  (curl/native) API calls.

## PWA install status (2026-08-11)

Manifest, icons (192/512/maskable/apple-touch), theme colour, safe-area padding and a
service worker (`public/sw.js`, registered in **production builds only** — a SW in dev
fights Vite HMR) are all in place and served correctly.

Remaining constraint, not a bug: **browsers only register service workers on a secure
origin.** Over the plain-http LAN address Chrome/Android will not offer to install.
- **iOS Safari**: works today — Share > Add to Home Screen. No SW or HTTPS required; the
  `apple-mobile-web-app-*` tags give a full-screen, chrome-less launch.
- **Android/Chrome**: needs HTTPS. Either deploy, or front the dev server with a tunnel that
  terminates TLS.

`display: "standalone"` (no browser UI, OS status bar retained) rather than `"fullscreen"`,
which would also hide the status bar — wrong for an app with its own header.

## Reported after the shell rework (2026-08-11)

1. **Installs as a browser shortcut, not a standalone app.** Expected while served over plain
   http — Chrome only creates a real installed app (WebAPK) on a secure origin with a service
   worker. Needs HTTPS; see the PWA section above.
2. **PNG export is cropped** — both the map and the caption text. The map now *covers* its
   container (see `useMapViewport`), so serialising the on-screen SVG captures a cropped view.
3. **Some labels wrap on mobile.**

## Open items (2026-08-11, end of session)

1. ~~**Journey card does not always clear on deselect.**~~ FIXED. The recorded hypothesis
   (a stuck `clickConsumedRef`) was wrong — every click path was verified working with a
   mouse. The real cause was the drag guard: a flat 6px threshold, which a thumb exceeds on
   an ordinary tap, so legitimate taps were read as pans and silently swallowed. The
   threshold is now pointer-type aware (14px touch, 6px mouse).
2. **Contrast audit not done.** The theme sweep was mechanical; the tokens were measured but
   not every rendered text/background pair. Suspects: the amber transit badge, the
   `bg-map-*/10` stat tiles, and toast chips in dark mode.
3. **Move "Home country" out of the filter panel into Settings.** Everything else in that
   panel is a view toggle; home country is account state, and changing it rewrites a visit's
   type. A destructive control should not look like a harmless one.

## Naming decision (2026-08-11)

**Contrail** — chosen. The trail a plane leaves, which is literally what the map draws.
Rejected: Great Circle (two words, weak as a domain), Wayfare (safer if the product grows
well beyond flights, but less distinctive).

Logo: the agreed mark is an arc between two waypoints — hollow origin dot, solid destination
dot — because it stays legible at favicon size where a plane or a globe turns to mush. Uses
the existing teal.

**APPLIED 2026-08-11.** Tagline: "You leave a trail. See it." — header subtitle, tab title
and OG card; the meta description stays descriptive, since that is the slot search engines
read. Icons regenerated from `BrandMark` geometry (favicon.svg, 192, 512, maskable 512,
apple-touch 180, og-image 1200x630). The service worker cache key was renamed as well as
bumped so existing installs evict the old brand's icons.

Two geometry details worth not relearning: the arc is trimmed along the curve with
`getPointAtLength`, not along the straight chord (chord-trimming left the tangent pointing
the wrong way, so it read as passing the ring rather than leaving it), and it stops 5.2
units out — inside the ring's stroke band so the two read as one shape, but far enough that
the round cap does not plug the hole. `BrandMark` crops to `viewBox="10 10 44 44"`; reusing
the favicon's 64-unit box rendered it at half its tile size.

Deliberately not renamed: container, database and volume names. Renaming recreates
containers, and the DB volume is not worth risking for a cosmetic change.

## Platform decision (2026-08-11)

**Stay web / PWA.** The deciding argument is monetisation: Apple takes 15–30% of in-app
subscriptions, and the plan is to fund this with subs and paid exports. Web plus Stripe keeps
~97%. Revisit only for automatic flight detection (reading boarding-pass emails or calendar
in the background), which is the one feature that genuinely wants native. The API is already
a separate backend, so a native client would reuse all of it — the decision does not get
more expensive by waiting.

## Guest accounts — no forced signup (2026-08-11) — DONE

Anyone can use the whole app without an account. The account is what makes the map
permanent and shareable.

**Approach:** a guest is a real but anonymous `users` row, not client-side storage. The
alternative (localStorage) would mean a second implementation of haversine distance and
country derivation in the browser, and two implementations that must agree forever. With a
row, signing up **upgrades that same row in place** — nothing is copied, so nothing can be
lost in transit.

Backend (`1786200000000-AddGuestAccounts`, run 2026-08-11, DB backed up first):
- `email` / `password_hash` nullable; new `is_guest`, `last_seen_at`, index on both.
- `POST /auth/guest` creates the anonymous row. Rate limited — every call is a row.
- `register` accepts an optional guest id and converts that row inside the existing
  transaction.
- `login` rejects rows with no `password_hash`, so a guest row can never be logged into.
- `/auth/me` touches `last_seen_at` for guests only.

Two bugs caught while building, both silent:
- `@Public()` on register means the guard never populates `req.user`, so the upgrade path
  would never have fired and **every guest who signed up would have been orphaned from
  their own data**. Register now decodes the cookie itself via `userIdFromToken`.
- The JWT payload declared a non-optional email that guests do not have.

Frontend:
- `RequireAuth` creates a guest session instead of redirecting. StrictMode double-invoke is
  guarded with a ref, or one visitor would mint two accounts.
- **Returning-device guard**: `contrail-account-known` in localStorage. Without it, an
  expired session on a returning user's device is indistinguishable from a first visit, and
  they would be handed a fresh empty map — which looks exactly like their history being
  deleted. Set centrally in the RTK mutations, not in the pages. Deliberately *not* cleared
  on sign-out: it describes the device, not the session.
- The account button becomes a brand-coloured "Save map" CTA for guests. Chosen over a
  banner because it costs no vertical space, which is scarce on a phone.
- No sign-out for guests — there are no credentials to return with, so it would silently
  discard everything.
- Register page states what carries over with real numbers ("Your 4 countries and 2 flights
  will be saved"). Without it, "create an account" reads like starting over.

**Gating, deliberate:** image export stays free for everyone — it is how the app spreads.
Public share links and video export need an account. Share is the stronger trigger than
"save forever": it is something someone actively wants *now*, not an abstract future loss.

Verified end to end: fresh visitor → guest row → added Japan → registered → **same user id**,
Japan intact, CTA gone, flag set; expired session on a known device → `/login`, no new guest.
Exactly one row per visitor. Contrast of the carry-over banner measured at 12.1:1 dark /
9.1:1 light (the `dark:` variants I first wrote fought the inverted brand ramp in
`tokens.css` and produced unreadable text — the ramp already inverts per theme, so
`bg-brand-50 text-brand-800` is correct in both).

**Follow-up:** nothing sweeps abandoned guest rows yet. `last_seen_at` and its index exist
for exactly that; needs a scheduled job before this sees real traffic.
