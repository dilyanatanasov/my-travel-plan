# Plan: User Accounts & Authentication

Date: 2026-08-10
Research: `context/research/2026-08-10_user-accounts-auth_research.md`

## Confirmed decisions

| Option | Chosen | Rejected alternatives |
|---|---|---|
| Auth method | Email + password, JWT in httpOnly cookie, argon2 | Google OAuth only; both |
| Existing data | Claim into first account created | Seeded admin from env; wipe |
| Schema management | Proper TypeORM migrations | Keep `synchronize`, nullable forever |
| Signup policy | Open signup + rate limiting | Invite code; locked to one account |

## Architecture

```
backend/src/
  data-source.ts                      # TypeORM CLI datasource (migrations)
  migrations/
    <ts>-CreateUsers.ts
    <ts>-AddUserIdToUserData.ts
  common/
    decorators/public.decorator.ts    # @Public() — opt out of the global guard
    decorators/current-user.decorator.ts
  modules/auth/
    auth.module.ts
    auth.controller.ts                # POST register|login|logout, GET me
    auth.service.ts                   # hashing, claim-on-first-user, token issue
    jwt.strategy.ts                   # reads token from the cookie
    guards/jwt-auth.guard.ts          # registered globally, honours @Public()
    dto/{register,login}.dto.ts
  modules/users/
    users.module.ts
    users.service.ts
    entities/user.entity.ts
```

**Guard posture: deny by default.** `JwtAuthGuard` is registered as an `APP_GUARD` so every
endpoint requires auth unless explicitly marked `@Public()`. The alternative — opt-in guards
per controller — means every future endpoint is unprotected until someone remembers. Deny by
default converts a security bug into an obvious 401 during development.

Endpoints marked `@Public()`: `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`,
`GET /countries*`, `GET /airports*` (reference data — the airport typeahead needs it, and
none of it is user data).

`GET /auth/me` stays protected and returns 401 when logged out; the frontend uses that 401 as
the "not authenticated" signal on boot.

## Data model

```ts
// users
id            serial pk
email         varchar(255) unique not null   // stored lowercased
password_hash varchar(255) not null
display_name  varchar(100) nullable
created_at    timestamptz
updated_at    timestamptz
```

`visits.user_id` and `flight_journeys.user_id`:
- `integer null references users(id) on delete cascade`
- indexed (`idx_visits_user_id`, `idx_flight_journeys_user_id`) — every scoped query filters on it
- nullable **only** to allow the backfill; after the first registration claims them, all writes set it

`FlightLeg` gets no `user_id` — it is reached only through its journey and cascades with it.

## Migration strategy

1. `pg_dump` the dev database to `context/backups/` before running anything. Non-negotiable:
   there are 41 hand-entered journeys in there.
2. Add `data-source.ts` + npm scripts (`migration:generate`, `migration:run`, `migration:revert`).
3. Set `synchronize: false` unconditionally in `app.module.ts`, in the same commit that adds
   migrations, so TypeORM stops trying to manage the schema itself.
4. Because the existing schema was created by `synchronize`, the first migration must be
   written by hand (not generated) to contain **only** the new users table and the two
   `user_id` columns — a generated migration would try to "fix" unrelated drift.
5. Run, verify row counts unchanged, verify `user_id IS NULL` on all existing rows.

## Claim-on-first-registration

In `AuthService.register()`, inside a single `queryRunner` transaction:

```
BEGIN
  SELECT count(*) FROM users            -- must be 0 to claim
  INSERT INTO users ...
  IF was_first_user:
    UPDATE visits           SET user_id = :newId WHERE user_id IS NULL
    UPDATE flight_journeys  SET user_id = :newId WHERE user_id IS NULL
COMMIT
```

Concurrency: two simultaneous first registrations could both see count 0. Mitigated by the
unique constraint on email plus the fact that this is a one-shot local migration path; the
transaction makes a partial claim impossible, which is the outcome that actually matters.

## Service scoping

Every method that reads or writes user data takes `userId` as its first parameter. Signature
changes ripple to the controllers, which get it from `@CurrentUser()`.

`VisitsService`: `findAll`, `findOne`, `findByCountryId`, `findByCountryIso2`, `create`,
`update`, `remove`, `setHomeCountry`, `getHomeCountry`, `createOrUpdateFromFlight`.

`FlightsService`: `findAll`, `findOne`, `create`, `update`, `remove`.
`FlightsStatsService`: `getStats`.

**Ownership on single-row access:** `findOne(userId, id)` filters by both, so another user's
id returns 404 rather than 403. 404 avoids confirming the row exists.

**The subtle one:** `createOrUpdateFromFlight` is called from the flights module. Its userId
must come from the authenticated caller creating the journey, threaded through
`FlightsService.create`. If this is missed, one user's flight silently mutates another's
visits — and no test would catch it until there are two real users.

## Cookie + CORS

```ts
res.cookie('access_token', token, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/',
});
```

CORS becomes an explicit allowlist from `CORS_ORIGIN` (default `http://localhost:5173`),
with `credentials: true`. `origin: true` must go — with a credentialed cookie it would let
any origin drive the API as the logged-in user.

If frontend and API are later deployed to different domains, `sameSite` must become `'none'`
with `secure: true`. Noted here so it is not rediscovered in production.

Single access token, 7-day expiry, no refresh token. Refresh-token rotation is the right
answer for a bank; for a travel log it is meaningful extra surface for little gain. Revisit
if sessions ever need remote invalidation.

## Frontend

- `apiSlice`: add `credentials: 'include'`; wrap `baseQuery` so a 401 clears auth state and
  redirects to `/login`.
- `authApi`: `register`, `login`, `logout`, `me` (`me` provides the `Auth` tag; login/logout
  invalidate it, which also refetches the user's own data automatically).
- `useAuth()` derived from the `me` query — no separate Redux auth slice to keep in sync.
- `<RequireAuth>` wrapper around the app routes; renders a loading state while `me` resolves,
  redirects to `/login` with a `from` location otherwise.
- `LoginPage` / `RegisterPage` using `react-hook-form` (already a dependency).
- Header gets the account menu + logout, replacing nothing that exists today.

Password rules: minimum 8 characters, validated on both sides. No composition rules
(uppercase/symbol requirements measurably push people toward `Password1!` patterns);
length is the property that matters.

## Verification

1. `pg_dump` restore-check before touching anything.
2. Migration runs clean; `SELECT count(*)` on visits (25) and flight_journeys (41) unchanged.
3. Register → all 66 rows claimed, map renders exactly as before.
4. Logout → `GET /auth/me` 401 → redirected to login.
5. Log back in → data intact.
6. Register a **second** account → empty map, zero flights. This is the test that proves
   scoping actually works; everything before it would pass on a single-tenant app too.
7. Unauthenticated `curl` against `/api/visits` and `/api/flights` → 401.
8. `curl` a second user's visit id as user one → 404.

## Out of scope (deliberately)

Password reset email, email verification, refresh rotation, roles/admin, account deletion,
OAuth. Each is a real feature; none blocks the rest of the roadmap. Logged at the end of the
implement doc as follow-ups.
