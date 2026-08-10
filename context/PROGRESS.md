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
- [ ] **2. Mobile pass** ← IN PROGRESS (h-scroll, tap targets, filter sheet, full-bleed map, PWA)
- [ ] 3. Design tokens + palette
- [ ] 4. Share (export PNG + OG tags)
- [ ] 5. Flight list grouping by year + undo toasts
- [ ] 6. Flight import (CSV)
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

- `frontend/src/pages/HomePage.tsx` is dead code — not routed. Delete during item 2 or 3.
- `frontend/src/components/WorldMap/` superseded by `TravelMap/`. Delete with HomePage.
- Tab bar at `TravelMapPage.tsx:118` causes 36px horizontal page scroll at 390px → item 2.
- 15 tap targets under 40px at 390px → item 2.
- `main.ts:11` CORS `origin: true` with credentials → item 1.9.
- `TravelMap.tsx:167` country click deletes visit with no confirm/undo → item 5.
- Mutation errors swallowed (`TravelMapPage.tsx:52`, `TravelMap.tsx:185`) → item 5 (toasts).
- `tailwind.config.js` `theme.extend` is empty; no design tokens → item 3.
- `frontend/public/` empty; `index.html` references a nonexistent `/vite.svg` favicon → item 2.
