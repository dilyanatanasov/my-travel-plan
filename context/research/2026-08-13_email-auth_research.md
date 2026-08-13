# Email: password reset + email verification — Research

**Date:** 2026-08-13
**Why now:** the site went live today. There is no way to recover a forgotten password, and registration is unverified — email verification was the agreed answer to register spam (decision recorded 2026-08-12; per-IP throttling alone rejected). Built as one piece because both flows share the provider, templates, and token machinery.

## 1. Current state (what the feature builds on)

### Backend (`backend/src/modules/auth/`)
- **User entity** (`users/entities/user.entity.ts`): `email` (nullable, unique, stored lowercased), `passwordHash` (argon2 via `@node-rs/argon2`), `isGuest`, `lastSeenAt`, `displayName`, `shareToken`. **No verification/reset fields exist** — migration needed.
- **Endpoints** (`auth.controller.ts`): `POST /auth/guest|register|login|logout`, `GET /auth/me`. JWT in an `HttpOnly; Secure; SameSite=Lax` cookie (`ACCESS_TOKEN_COOKIE`), 7-day expiry. All public endpoints already throttled (`@nestjs/throttler`: guest/register 5/min, login 10/min) — the pattern to copy for the new endpoints.
- **Guest conversion**: `register` upgrades a guest row in place (`claimed: true`). Guests have `email = null` → reset/verification flows apply only to registered users; guest spam is *not* solved by verification (already mitigated by throttle + `guest-cleanup.service.ts` sweep).
- **Background-job pattern**: `guest-cleanup.service.ts` uses plain `setInterval` (deliberately not `@nestjs/schedule` — "the only scheduled job in the app"). Token-expiry cleanup can piggyback on this pattern or rely on expiry checks at use time (no sweep needed).
- **Migrations**: TypeORM, `backend/src/migrations/` (latest: `1786200000000-AddGuestAccounts.ts`), run in prod via the deploy workflow (`migration:run:prod`).
- **Config**: env via `ConfigService`; server `.env` on the droplet — new vars go there + `.env.example`.

### Frontend (`frontend/src/`)
- Routes in `App.tsx`: public `/login`, `/register`, `/s/:token`; everything else behind `RequireAuth`. New public routes needed: forgot-password, reset-password, verify-email landing.
- `features/auth/authApi.ts`: RTK Query slice with `getAuthProfile`, `createGuest`, `register`, `login` — add mutations here.
- `AuthLayout.tsx` + `authStyles.ts`: existing shells for auth screens — new pages reuse them.

### Infra
- Email provider is API-based (HTTPS call) — **no new container, no memory impact** on the 2 GB droplet (relevant given the pending Umami memory question).
- Sending domain needs DNS verification records (SPF/DKIM TXT, sometimes MX) at **Namecheap BasicDNS** — same panel as the A records. Providers verify `mycontrail.com` or a subdomain like `send.mycontrail.com` (subdomain isolates deliverability reputation; either works).

## 2. Provider options (checked 2026-08-13)

| Provider | Free tier | Paid entry | Notes |
|---|---|---|---|
| **Resend** | 3,000/mo | $20/mo (50k) | Best developer experience; simple REST API; official Node SDK |
| **Brevo** | ~300/day (~9,000/mo) | $25/mo (40k) | Biggest free tier; heavier API, marketing-oriented |
| **Postmark** | 100/mo (trial tier) | $15/mo | Best deliverability reputation; most restrictive free tier |
| **Amazon SES** | pay-as-you-go | ~$0.10/1,000 | Cheapest at scale; most setup friction (AWS account, sandbox exit) |

Volume here is tens of emails/month — all four are effectively $0. Sources: [Brevo comparison](https://www.brevo.com/blog/best-email-api/), [pricing comparison](https://www.buildmvpfast.com/api-costs/email), [Resend/SendGrid/Postmark costs](https://blog.vibecoder.me/email-service-pricing-resend-sendgrid-postmark).

## 3. What the feature needs (both flows share most of it)

1. **Schema** (one migration): `email_verified` boolean; token storage for two token types (verification, reset) with hash + expiry + single-use semantics. Design choice: columns on `users` vs. a small `auth_tokens` table (type, user_id, token_hash, expires_at, used_at).
2. **Token rules** (non-negotiable security): random ≥32 bytes, store only a hash (same argon2 or SHA-256 — they're high-entropy, SHA-256 suffices), single-use, short expiry (reset ~1 h, verification ~24 h), invalidate prior tokens on reissue. Uniform API responses so `/forgot-password` never reveals whether an email exists (no user enumeration).
3. **Mailer module**: thin `MailService` wrapping the provider SDK/API; no-op (log-only) when the API key env is unset, so dev/test send nothing — mirrors the `analytics.ts` unset-env pattern already agreed for Umami.
4. **Endpoints** (all `@Public` + throttled hard, e.g. 3/min): request-reset, perform-reset, verify-email, resend-verification.
5. **Frontend**: forgot/reset/verify pages on the existing `AuthLayout`; "verify your email" banner state; authApi mutations.
6. **Templates**: two emails (verify, reset). Plain, personal tone; from e.g. `no-reply@mycontrail.com`.
7. **DNS**: provider's SPF/DKIM records at Namecheap; one-time, ~10 min including propagation at current 1-min TTL.

## 4. Constraints and open decision points (for the plan phase)

- **D1 — Provider**: Resend (recommended: DX, 3k/mo free) vs Brevo (bigger free tier) vs Postmark vs SES.
- **D2 — Token storage**: columns on `users` (fewer moving parts, but reissue/audit awkward) vs small `auth_tokens` table (cleaner single-use/expiry semantics, one more entity). 
- **D3 — Unverified-account policy**: what does an unverified registered user lose? Options: (a) nothing, just a banner nag (weakest spam defense), (b) blocked from sharing/public-map features only, (c) full read-only until verified. The 2026-08-12 decision framed verification as the register-spam answer, which implies at least (b).
- **D4 — Sending identity**: root domain (`no-reply@mycontrail.com`) vs subdomain (`send.mycontrail.com`) for DKIM alignment; subdomain protects the root domain's reputation but shows a slightly less clean From address.
- **Existing user (id 1)**: migration should set `email_verified = true` for accounts created before the feature (grandfathering) — or the owner verifies once; decide in plan.
- Guest flow is untouched by design; guests have no email.

## 5. Relevant files (quick index)

| Area | Files |
|---|---|
| Backend auth | `backend/src/modules/auth/{auth.controller,auth.service,auth.module,jwt.strategy}.ts`, `guards/`, `dto/` |
| User entity | `backend/src/modules/users/entities/user.entity.ts` |
| Job pattern | `backend/src/modules/auth/guest-cleanup.service.ts` |
| Migrations | `backend/src/migrations/`, `backend/src/data-source.ts` |
| Frontend auth | `frontend/src/features/auth/{authApi,AuthLayout,authStyles,RequireAuth}.tsx/.ts`, `frontend/src/App.tsx`, pages in `frontend/src/pages/` |
| Env plumbing | server `.env` (droplet), `.env.example`, `docker-compose.prod.yml` backend environment block |
