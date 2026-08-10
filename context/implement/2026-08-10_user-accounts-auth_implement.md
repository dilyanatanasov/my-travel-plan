# Implementation: User Accounts & Authentication

Date: 2026-08-10
Plan: `context/plan/2026-08-10_user-accounts-auth_plan.md`
Branch: `feat/user-accounts-auth`
Status: **Complete and verified**

## What shipped

### Backend
| File | Change |
|---|---|
| `src/modules/users/entities/user.entity.ts` | New `User` entity (email unique + lowercased, argon2 hash, optional display name) |
| `src/modules/users/users.service.ts`, `users.module.ts` | Lookup by email/id |
| `src/modules/auth/auth.service.ts` | argon2 hashing, login, transactional claim-on-first-registration |
| `src/modules/auth/auth.controller.ts` | `POST register\|login\|logout`, `GET me`; sets/clears the httpOnly cookie |
| `src/modules/auth/jwt.strategy.ts` | Reads JWT from the cookie (Bearer header kept as a fallback for curl); re-checks the user still exists |
| `src/modules/auth/guards/jwt-auth.guard.ts` | Honours `@Public()` |
| `src/common/decorators/public.decorator.ts` | Opt-out of the global guard |
| `src/common/decorators/current-user.decorator.ts` | `@CurrentUser('id')` |
| `src/data-source.ts` | TypeORM CLI datasource for migrations |
| `src/migrations/1786000000000-AddUsersAndOwnership.ts` | `users` table; nullable `user_id` on `visits` + `flight_journeys`; FKs with ON DELETE CASCADE; indexes |
| `src/app.module.ts` | `synchronize: false`; global `JwtAuthGuard` + `ThrottlerGuard`; Users/Auth modules |
| `src/main.ts` | `cookie-parser`; CORS allowlist from `CORS_ORIGIN`; fail-fast if `JWT_SECRET` unset |
| `visits.service.ts` / `visits.controller.ts` | Every method scoped by `userId` |
| `flights.service.ts` / `flights.controller.ts` | Every method scoped by `userId` |
| `flights-stats.service.ts` | `getStats(userId)` |
| `countries.controller.ts`, `airports.controller.ts` | `@Public()` — shared reference data |

### Frontend
| File | Change |
|---|---|
| `store/api/apiSlice.ts` | `credentials: 'include'`; 401 clears the Auth tag |
| `features/auth/authApi.ts` | register/login/logout/me + `useAuth()` derived from the `me` query |
| `features/auth/RequireAuth.tsx` | Route gate; holds render while `me` resolves so refresh doesn't bounce |
| `features/auth/AccountMenu.tsx` | Avatar menu, outside-click + Escape close, sign out |
| `features/auth/AuthLayout.tsx`, `authStyles.ts` | Shared auth shell and form classes |
| `pages/LoginPage.tsx`, `pages/RegisterPage.tsx` | react-hook-form, inline + server error display |
| `App.tsx` | Public `/login` `/register`; everything else behind `RequireAuth` |
| `components/Layout/Layout.tsx` | Account menu; header no longer wraps at 390px |

## Deviations from the plan

1. **`@node-rs/argon2` instead of `argon2`.** The research flagged this risk and it materialised:
   the backend image is alpine with no `python3/make/g++`, so the node-gyp build of `argon2`
   could not run. `@node-rs/argon2` ships prebuilt musl binaries; verified working in-container.
   Same algorithm, no compiler needed.
2. **`data-source.ts` exports only the named `AppDataSource`.** A default export as well made
   the TypeORM CLI fail with "must contain only one export of DataSource instance".
3. **Two TS fixes:** `cookie-parser` needed a default import (the project has
   `esModuleInterop: true`), and `signOptions.expiresIn` needed a cast to `SignOptions['expiresIn']`
   because jsonwebtoken types it as a `ms` template-literal union that a runtime string cannot satisfy.
4. **Header tweaks landed early.** The "Search Flights" label now hides below `sm` and the button
   is `min-h-11`. This was roadmap item 2 work, but it was cheaper to do while editing the header
   than to revisit. Auth inputs were also built at 44px for the same reason.

## Verification results

Database, before and after:

| Table | Before | After | Owned by user 1 |
|---|---|---|---|
| visits | 25 | 25 | 25 |
| flight_journeys | 41 | 41 | 41 |
| flight_legs | 117 | 117 | (via journey) |

- `pg_dump` backup taken first → `context/backups/pre-auth-20260810-185446.sql` (gitignored).
- Unauthenticated `GET /api/visits`, `/api/flights`, `/api/flights/stats` → **401**.
- Unauthenticated `GET /api/countries`, `/api/airports?q=sof` → **200** (public reference data).
- Registration returned `claimed: { visits: 25, flightJourneys: 41 }` — exactly the pre-migration counts.
- User 1 authenticated: 41 journeys, 117 flights, 141,877 km — stats unchanged from before auth.
- **Second account saw `[]` for both visits and flights** — this is the check that actually proves
  scoping; everything above it would pass on a single-tenant app too. Test account then deleted.
- User 2 reading user 1's visit id → **404** (not 403; does not confirm the row exists).
- `GET /auth/me` after logout → **401**.
- Browser: `/` redirects to `/login`; login restores the full map (25 visited, 49 routes,
  39 airports, Bulgaria as home); account menu renders.
- `tsc --noEmit` clean on both backend and frontend.

## Notes for whoever picks this up

- `JWT_SECRET` was generated into `.env`; `.env.example` documents it. **`docker compose restart`
  does not re-read `env_file`** — use `up -d --force-recreate backend` after changing `.env`.
- `synchronize` is now off. All future schema changes go through
  `npm run migration:create` / `migration:run` inside the backend container.
- `user_id` is nullable at the DB level only to permit the backfill. Once you are confident no
  orphan rows exist, a follow-up migration can set `NOT NULL`.
- `sameSite: 'lax'` assumes frontend and API are same-site. Cross-domain deployment needs
  `sameSite: 'none'` + `secure: true` + HTTPS.

## Deliberately out of scope (follow-ups)

Password reset email, email verification, refresh-token rotation, roles/admin, account deletion
UI, OAuth. None blocks the rest of the roadmap.
