# Email verification + password reset — Plan

**Date:** 2026-08-13 · **Decisions confirmed by user same day:**
**Resend** · **`auth_tokens` table** · **unverified = sharing blocked** · **From `no-reply@mycontrail.com`**.
Research: `context/research/2026-08-13_email-auth_research.md`.

## 1. Schema (one migration)

- `users.email_verified` boolean NOT NULL default false; the migration sets it **true for all existing non-guest rows** (grandfathers the owner account — nobody gets locked out of sharing by a deploy).
- New `auth_tokens` table: `id`, `user_id` (FK, cascade delete), `type` (`'verify' | 'reset'`), `token_hash` (SHA-256 hex — tokens are 32 random bytes, high-entropy, so argon2 is unnecessary), `expires_at`, `used_at` (nullable), `created_at`. Index on `(user_id, type)`.

## 2. Backend

### MailService (`modules/mail/`)
- Thin wrapper over Resend's REST API (plain `fetch` — no SDK dependency needed for one endpoint; revisit if we send more kinds of mail).
- **No-ops with a log line when `RESEND_API_KEY` is unset** — dev/test send nothing, same pattern as the agreed `analytics.ts`.
- Env: `RESEND_API_KEY`, `MAIL_FROM=no-reply@mycontrail.com`, reuses `DOMAIN` for link URLs (`https://${DOMAIN}/reset-password?token=…`).
- Two templates, inline HTML + text fallback, personal tone, no tracking pixels.

### Token rules (both types)
32 random bytes base64url; store only SHA-256; single-use (`used_at` set on redemption); expiry: reset **1 h**, verify **24 h**; issuing a new token invalidates the user's outstanding tokens of that type; redemption checks hash + type + unexpired + unused.

### Endpoints (all `@Public`, throttled 3/min like the strictest existing ones)
- `POST /auth/forgot-password { email }` → always `{ ok: true }` (no user enumeration); sends reset mail if the account exists and is not a guest.
- `POST /auth/reset-password { token, password }` → verifies token, argon2-hashes new password, marks token used, **does not auto-login** (user logs in with the new password — simpler, and proves it works).
- `POST /auth/verify-email { token }` → sets `email_verified`, marks token used.
- `POST /auth/resend-verification` → authenticated (uses cookie), only when unverified.
- `register` additionally creates a verify token and sends the mail. Login response and `/auth/me` include `emailVerified`.

### Enforcement (the spam defense)
- Share endpoints (create/refresh `share_token`) require `email_verified` → 403 with a distinct error code the frontend maps to the verify prompt. Everything else works unverified.

## 3. Frontend

- New public routes: `/forgot-password`, `/reset-password` (token from query string), `/verify-email` (token from query string, auto-submits on mount). All on `AuthLayout` + `authStyles`.
- `authApi.ts`: four mutations matching the endpoints; `AuthUser` gains `emailVerified`.
- Login page gets a "Forgot password?" link.
- Unverified banner: shown when `user.emailVerified === false && !user.isGuest`, with a resend button (disabled 60 s after use). Sharing UI shows the verify prompt instead of the share dialog when blocked.

## 4. DNS + provider setup (user, ~15 min, one-time)

1. Create Resend account (free tier), add domain `mycontrail.com`.
2. Add the DKIM/SPF TXT records Resend shows at Namecheap (same panel as the A records; 1-min TTL makes verification quick).
3. Create API key → goes in the droplet `.env` as `RESEND_API_KEY` (and `MAIL_FROM`). **Not** a GitHub secret — runtime config, not CI config.

## 5. Sequence

1. Migration + entities + MailService (no-op locally, tested with a logged link).
2. Backend endpoints + enforcement + tests of the token rules.
3. Frontend pages + banner + gated sharing.
4. User does §4 (Resend + DNS), sets droplet env, restart backend.
5. Deploy (`all` / `run_migrations=true` — first real migration through the pipeline; the workflow auto-backups first).
6. Verify end-to-end on prod: register a throwaway → verify → share; forgot → reset → login.

## 6. Out of scope

Guest flow (no email, already throttled + swept), email change flow, marketing/digest mail, Umami (separate plan §3.5), SMS/2FA.
