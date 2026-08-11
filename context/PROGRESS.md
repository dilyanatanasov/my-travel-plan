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
- [ ] **6. Flight import (CSV)** ← NEXT
- [ ] 7. Decide fate of flight search (decision point with user)
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

1. **Journey card does not always clear on deselect.** Reported twice. The first fix moved
   clearing to a single container-level handler in `TravelMap.tsx`
   (`handleContainerClick` + `clickConsumedRef`), which fixed the airport-dot case, but a
   path remains. Prime suspect: `clickConsumedRef` is only reset inside
   `handleContainerClick`, so any click that never reaches the container — the card itself
   calls `stopPropagation`, and `SelectedJourneyCard`'s close button is inside the map
   container — can leave the flag stuck `true`, swallowing the *next* clear. Reproduce by
   selecting a route, clicking the card body, then clicking open water. Fix is likely to
   reset the flag on `pointerdown` rather than on the container click.
2. **Contrast audit not done.** The theme sweep was mechanical; the tokens were measured but
   not every rendered text/background pair. Suspects: the amber transit badge, the
   `bg-map-*/10` stat tiles, and toast chips in dark mode.
3. **Move "Home country" out of the filter panel into Settings.** Everything else in that
   panel is a view toggle; home country is account state, and changing it rewrites a visit's
   type. A destructive control should not look like a harmless one.
