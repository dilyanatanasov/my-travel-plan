# Research: social login (Google, Apple) for registration and sign-in

Date: 2026-10-03. Question: how hard is adding "Continue with Google/Apple"
next to the existing email + password flow.

## What exists

- Email + password only. `backend/src/modules/auth/` with `@nestjs/passport`,
  `passport-jwt`, `@nestjs/jwt`, argon2 (`@node-rs/argon2`). No OAuth deps.
- One access JWT in an httpOnly cookie `access_token` (secure in prod,
  SameSite=Lax, 7d). No refresh token. Issued by `issueToken()`
  (`auth.service.ts:65-69`), cookie set in `auth.controller.ts:37-53`.
- `JwtAuthGuard` is global deny-by-default with `@Public()` opt-out.
  `NonGuestGuard` treats `email == null` as guest.
- Users table: `email` nullable unique, `password_hash` nullable,
  `is_guest`, `email_verified` (gates sharing and price alerts),
  `display_name`, `share_token`. No provider / subject / avatar columns.
- Guest upgrade: `register` decodes the guest cookie by hand and converts
  the guest row in place inside a transaction (`auth.service.ts:99-150`).
  An OAuth callback can reuse this: the guest cookie arrives on a top-level
  GET under Lax.
- Email verification + reset via `auth_tokens` (SHA-256 hashed, single use),
  Resend mail. `appUrl()` in `mail.service.ts:32` builds `https://` + DOMAIN:
  the natural base for redirect URIs. No email-change flow exists.
- Frontend: `LoginPage.tsx`, `RegisterPage.tsx`, shared `AuthLayout`;
  `features/auth/authApi.ts` derives all auth state from `/auth/me`
  (no auth slice). `register`/`login` call `rememberAccount()`; an OAuth
  return must call it too or a returning social user with an expired session
  lands on an empty guest map. `RequireAuth.tsx` is the guard.
  `sw.js:94` skips `/api/*`, so a callback navigation is not hijacked.
- Config: `.env.example` has JWT_SECRET, JWT_EXPIRES_IN, CORS_ORIGIN, DOMAIN,
  ALT_DOMAIN, RESEND_API_KEY, MAIL_FROM. Prod secrets live only in the
  droplet `.env` (loaded via `env_file`), never in CI. `mycontrail.app`
  301s to `.com`, so one redirect URI per provider.
- No CSP, no COOP. CORS allowlist with credentials. urlencoded parser on.
  `ValidationPipe` has `forbidNonWhitelisted`, so callback DTOs must declare
  every field a provider posts.
- Throttler is global (300/min default, 100/10s burst) with per-route
  overrides on auth. No `trust proxy` is set, so behind nginx every client
  likely shares one IP bucket. Worth fixing before adding public auth routes.

## Places that assume "registered means has a password"

- `forgotPassword` (`auth.service.ts:231`) ignores accounts with no hash.
- `changePassword` (`:336`) throws 401 with no hash.
- `deleteAccount` (`:367`) skips the password check when hash is null.
- `SettingsPage.tsx` ~255-341, 398-400 shows password UI based only on
  `isGuest`. Needs a `hasPassword` / `providers` field on `PublicUser`.

## Prior decisions

- `context/plan/2026-08-10_user-accounts-auth_plan.md:10,171-174`: chose
  email + password; OAuth explicitly out of scope, "a real feature".
- `context/implement/2026-08-10_user-accounts-auth_implement.md:94`: OAuth
  logged as follow-up. No other research/plan mentions social login.
- `context/COORDINATION.md:505-517`: verification is the anti-spam control.
  Provider-verified emails fit that position (set email_verified = true).

## Provider notes

- Google: OIDC authorization-code flow, redirect GET, Lax cookie works.
  Free. Needs a Google Cloud project + OAuth client; consent screen in
  production mode for arbitrary users. Redirect URI
  `https://mycontrail.com/api/auth/google/callback` plus a localhost one.
- Apple: paid developer account (99 USD/yr), Services ID, domain verification,
  `.p8` key, client secret is a self-signed JWT rotated at most every 6
  months. Uses `response_mode=form_post`: a cross-site POST, so Lax state
  cookies are NOT sent. State/nonce must be `SameSite=None; Secure` or
  carried statelessly (signed). Name is only sent on first consent; email
  may be a private relay. Apple's requirement to offer Sign in with Apple
  applies to native iOS apps with other social logins; a PWA is not bound.

## Shape of the work (any provider)

1. Migration: `user_identities` (user_id, provider, provider_subject unique
   together, email_at_link, created_at). Optional avatar_url on users.
2. Backend: `GET /auth/:provider` (start, sets signed state cookie) and
   `/auth/:provider/callback` (verifies, resolves account, issues cookie,
   redirects to SPA). Both `@Public`, throttled. Library: `openid-client`
   (generic OIDC, covers both) or `google-auth-library` for Google only.
3. Account resolution order: identity by (provider, subject) -> existing
   user by verified email (link) -> guest row upgrade -> new user.
4. `PublicUser` gains `hasPassword`, `providers`.
5. Frontend: provider buttons on Login + Register (plain anchors to the
   start route, shared component), post-login landing that calls
   `rememberAccount()` and invalidates Auth, Settings branches for
   passwordless accounts (offer "set a password" via the reset path).
6. Ops: client id/secret in droplet `.env` and `.env.example`.
7. Tests: resolution order (4 branches), state mismatch rejection.

## Rough effort

- Google only: about a day of focused work plus a Google Cloud setup.
- Apple added: about half a day more plus the Apple account, domain
  verification and the form_post cookie handling.
- Prerequisite small fix: `trust proxy` so throttling is per client.
