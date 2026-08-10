# Research: User Accounts & Authentication

Date: 2026-08-10
Feature: Multi-user support — authentication, authorization, per-user data scoping

## Why

The app is currently single-tenant with no concept of a user. Every query returns
every row in the database, and every endpoint is unauthenticated. This is the single
blocker between "personal tool" and "product other people can use".

## Current state — verified findings

### No auth exists anywhere
`grep -ril "passport|jwt|auth|userId" backend/src` returns only
`modules/flights/data/eu-banned-airlines.json` (a false positive on the word "authority").
There is no users module, no guards, no strategies, no session handling.

### Every query is global
- `backend/src/modules/visits/visits.service.ts:17` — `findAll()` returns all visits, unfiltered.
- `visits.service.ts:35` — `findByCountryId()` finds *any* user's visit for a country.
- `visits.service.ts:119` — `setHomeCountry()` demotes *the* global home visit. With two
  users, one user setting home would silently rewrite the other's.
- `visits.service.ts:148` — `getHomeCountry()` returns the first home visit in the table.
- `backend/src/modules/flights/flights.service.ts` + `flights-stats.service.ts` — same pattern.

### CORS is permissive
`backend/src/main.ts:11` — `app.enableCors({ origin: true, credentials: true })`.
`origin: true` reflects the caller's Origin header. Combined with `credentials: true`
and the httpOnly cookie we are about to introduce, this would allow any website to make
credentialed requests against the API. **Must be tightened as part of this work** — it is
not a pre-existing issue we can defer, because introducing cookie auth is what makes it
exploitable.

### Schema is managed by `synchronize`
`backend/src/app.module.ts:24` — `synchronize: NODE_ENV === 'development'`.
There is no `migrations` directory, no `data-source.ts`, and no migration npm script
(`package.json` has a `typeorm` script but nothing that runs migrations).

This matters concretely: the dev database currently holds **41 flight journeys and 25 visits**.
Adding a `NOT NULL user_id` column to populated tables cannot be done by `synchronize` —
it would need a default that does not exist. Hence the confirmed decision to introduce
migrations and land `user_id` as nullable first, backfilled on first registration.

### Entities that need ownership
| Entity | File | Needs user_id? |
|---|---|---|
| `Visit` | `modules/visits/entities/visit.entity.ts` | **Yes** — user data |
| `FlightJourney` | `modules/flights/entities/flight-journey.entity.ts` | **Yes** — user data |
| `FlightLeg` | `modules/flights/entities/flight-leg.entity.ts` | No — owned via its journey (cascade) |
| `Country` | `modules/countries/entities/country.entity.ts` | No — reference data, shared |
| `Airport` | `modules/airports/entities/airport.entity.ts` | No — reference data, shared |
| `BannedAirline` | `modules/flights/entities/banned-airline.entity.ts` | No — reference data, shared |

Reference data (countries, airports) stays global and its endpoints stay public-readable.
Only `visits` and `flight_journeys` become user-owned.

### Cross-module coupling to be careful with
`visits.service.ts:80` — `createOrUpdateFromFlight()` is called by the flights module when a
journey is created, to auto-create visits for the countries touched. This crosses the
flights → visits boundary and **must thread userId through**, or a user's flight will
mutate another user's visits. This is the least obvious place scoping can be missed.

### Frontend state
- `frontend/src/store/api/apiSlice.ts` — single `fetchBaseQuery`, no credentials option,
  base URL from `VITE_API_URL`. Needs `credentials: 'include'` and a 401 handler.
- `frontend/src/App.tsx` — no route protection; all routes render unconditionally.
- No auth UI of any kind exists.
- `react-hook-form` is already a dependency and unused in most places — use it for the
  login/register forms rather than adding another form library.

## Dependencies to add (backend)

| Package | Purpose |
|---|---|
| `@nestjs/jwt` | Sign/verify access tokens |
| `@nestjs/passport`, `passport`, `passport-jwt` | Strategy plumbing + guard integration |
| `argon2` | Password hashing. Preferred over bcrypt: memory-hard, winner of the Password Hashing Competition, no 72-byte truncation footgun |
| `cookie-parser` | Read the httpOnly auth cookie |
| `@nestjs/throttler` | Rate limit register/login against credential stuffing |
| `@types/passport-jwt`, `@types/cookie-parser` | Types (dev) |

Note: `argon2` is a native module. The backend runs in Docker (`node:*-alpine` per
`backend/Dockerfile.dev`) — alpine needs build tooling for native modules. **Risk flagged:**
if the image lacks `python3/make/g++`, `npm install argon2` will fail. Fallback is `bcrypt`
(same problem) or `@node-rs/argon2` (prebuilt binaries, no compiler needed). Verify at install time.

## Security decisions and their rationale

- **httpOnly cookie over localStorage.** A token in localStorage is readable by any XSS.
  This app renders user-supplied `notes` strings; httpOnly removes token theft from the
  XSS blast radius entirely.
- **`sameSite: 'lax'`** — the frontend and API are same-site in the intended deployment.
  If they end up on different domains this must become `'none'` + `secure: true`, which
  also forces HTTPS. Documented in the plan so it is not discovered in production.
- **`secure: true` in production only**, so local http://localhost dev still works.
- **Generic login errors.** Return the same message for "no such user" and "wrong password"
  so the endpoint is not a user-enumeration oracle.
- **Rate limiting** on auth endpoints specifically, not globally — the map does many
  legitimate rapid requests when toggling countries.

## Claim-on-first-registration

Confirmed approach: the migration adds `user_id` as nullable, leaving the existing 41 journeys
and 25 visits with `user_id IS NULL`. The first successful registration runs, in the same
transaction as the user insert, an `UPDATE visits SET user_id = :id WHERE user_id IS NULL`
and the equivalent for `flight_journeys`.

Requirements:
- Must be transactional — a partial claim leaves data half-owned.
- Must be guarded so it only ever runs for the genuinely first user
  (`SELECT COUNT(*) FROM users` = 0 inside the transaction, with the row lock that implies).
- After it runs, orphan rows should no longer be possible, because all new writes set user_id.

## Open risks

1. **argon2 native build in alpine** — see above. Verify early, fall back to `@node-rs/argon2`.
2. **`synchronize: true` is currently on in dev** and will fight the migrations — it must be
   turned off in the same change that introduces migrations, or TypeORM will try to reconcile
   the schema itself on boot.
3. **The dev database has real data the user cares about** (41 journeys entered by hand).
   Back it up with `pg_dump` before running any migration.
4. **Global guard + public reference endpoints** — applying `JwtAuthGuard` globally means
   countries/airports lookups break until they are marked `@Public()`. Easy to miss; the
   airport search typeahead would silently stop working.
