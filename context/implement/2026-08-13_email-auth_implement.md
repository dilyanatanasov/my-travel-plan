# Email verification + password reset — Implementation Log

**Date:** 2026-08-13 · **Plan:** `context/plan/2026-08-13_email-auth_plan.md` (all four decisions as confirmed: Resend, `auth_tokens` table, sharing gated on verification, `no-reply@mycontrail.com`).

## Built

**Backend**
- Migration `1786300000000-AddEmailAuth`: `users.email_verified` (existing registered accounts grandfathered `true`), `auth_tokens` table (hash-only storage, type/expiry/used_at). Ran and verified on dev: owner account grandfathered, table shape correct.
- `modules/mail/`: `MailService` over Resend's REST API via fetch; **no-ops with a logged link when `RESEND_API_KEY` is unset** — dev flows are exercised by copying links out of `docker logs`.
- `AuthTokensService`: 32-byte tokens, SHA-256 stored, single-use with atomic claim, reissue invalidates prior tokens; reset 1 h TTL, verify 24 h.
- Endpoints: `forgot-password` (uniform `{ok:true}`, no enumeration, 3/min), `reset-password` (5/min), `verify-email` (5/min), `resend-verification` (authed, 3/min). Register fire-and-forgets the verify email outside the transaction — mail outages never fail signups.
- Sharing gate: `ShareService.enable` throws 403 `EMAIL_UNVERIFIED` for unverified accounts.
- `PublicUser`/`/auth/me` now carry `emailVerified`.

**Frontend**
- Routes `/forgot-password`, `/reset-password`, `/verify-email` (auto-submits on mount, StrictMode-guarded); "Forgot password?" link on login; `VerifyEmailBanner` under the header with resend; SharePanel's Public-link section explains verification instead of failing.

## Deviations from plan (all small, all deliberate)

1. **Reset also verifies**: completing a password reset proves control of the email, so it sets `email_verified` — same proof verification asks for.
2. **Bundled fixes/changes in the same working session** (kept in one commit because the files overlap heavily):
   - **Logout stale-cache bug** (user-reported): RTK Query keeps last-good data when a refetch 401s, so the previous account's map stayed visible after logout / "look around without an account". Both paths now `resetApiState()`.
   - **Rebrand Contrail → myContrail** after trademark research (Juniper's registered CONTRAIL software marks; indie "Contrail – Live Flight Tracker" at contrail.app in our exact consumer space; research in chat 2026-08-13). Swept: index.html title/OG/twitter/apple tags, PWA manifest, header (two-tone lockup, brand-600 "my"), share-card kicker, share-sheet title, SharedMapPage, Aviasales disclosure, email templates, `MAIL_FROM` default `myContrail <no-reply@mycontrail.com>`. Installed PWAs show the old name until reinstalled.

## Prod activation (user-side, in progress)

Resend account created, domain **verified** (DKIM/SPF/MX confirmed at Namecheap authoritative servers). Remaining: sending-only API key → droplet `.env` (`RESEND_API_KEY`, `MAIL_FROM`) → recreate backend. Until then the feature runs dark on prod (links logged, not emailed).

## Deploy note

First deploy carrying a real migration through the pipeline: `service=all`, `run_migrations=true`; the workflow backs up the DB before touching the backend.
