# Plan: Google sign-in and sign-up

Date: 2026-10-03. Research: `context/research/2026-10-03_social-login_research.md`.
Branch: `feat/google-sign-in` (on top of `feat/uk-constituent-countries`).

## Decisions

| # | Question | Decision |
|---|---|---|
| D1 | Providers | Google only (owner). Apple later if a native app ever needs it |
| D2 | Where it appears | "Continue with Google" on both Login and Register, above the form (owner: "google register login") |
| D3 | Account linking | A Google sign-in whose verified email matches an existing account links to it and marks the email verified. Unverified Google emails are refused (assumed, the only safe default) |
| D4 | Guests | A guest session that signs in with Google is upgraded in place, same as password registration (assumed, matches existing design) |
| D5 | Passwordless accounts | Can set a password through the existing reset-link flow ("Set a password" in Settings); delete account needs no password for them, like guests (assumed) |
| D6 | Library | `google-auth-library` for code exchange and ID-token verification; authorization URL built by hand (CommonJS, Google-maintained) |
| D7 | Delivery | Branch, owner local test, deploy only on explicit go |

## Permission model

- `GET /api/auth/google` and `GET /api/auth/google/callback` are public and
  throttled (10/min). Nothing else is new on the public surface.
- CSRF on the callback: a random `state` and `nonce` live in a short-lived
  httpOnly cookie scoped to `/api/auth/google`; the callback refuses a
  mismatch, and the nonce is checked against the ID token.
- The guest-upgrade path trusts only our own signed access-token cookie,
  as `register` already does.
- `next` after sign-in must be a same-origin path (`/...`, never `//`).
- Server sets `trust proxy` so throttling is per client behind nginx.

## Work

### Backend
1. `user_identities` table + entity: `(provider, provider_subject)` unique,
   `user_id` cascade. Migration `1787900000000-AddUserIdentities`.
2. `GoogleAuthService`: configured check, authorization URL, code exchange,
   ID-token verification (audience, nonce, email_verified).
3. `AuthService.signInWithGoogle(profile, guestId)` in one transaction:
   identity -> existing user by email (link) -> guest upgrade -> new user.
   Returns `outcome` (login | signup | guest_convert) for analytics.
4. `PublicUser` gains `hasPassword` and `providers`; profile and login load
   identities. `forgotPassword` no longer skips passwordless accounts.
   Export includes sign-in methods.
5. Controller: start + callback routes, `GET /api/auth/providers` (public,
   says which providers are configured so the button only shows when real).
6. `.env.example`: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, optional `APP_URL`.
7. Specs: resolution order (4 branches), unverified refusal, `safeNext`.

### Frontend
1. `GoogleSignInButton` (anchor to the start route, inline SVG glyph, hidden
   when the provider is not configured) + "or" divider, on Login and Register.
2. `/auth/complete` landing: remembers the account on this device, tracks
   `signup` / `guest_convert`, resets the RTK cache, navigates to `next`.
3. Login page shows a message for `?error=google*`.
4. Settings: passwordless accounts see "Signed in with Google" and a
   "Set a password" button (sends the reset link); delete needs no password.
5. Privacy policy sentence about Google sign-in data.

### Ops (owner)
- Google Cloud Console: OAuth client (Web), authorized redirect URIs
  `https://mycontrail.com/api/auth/google/callback` and
  `http://localhost:5173/api/auth/google/callback`; consent screen published.
- Droplet `.env`: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`; recreate backend.
- Deploy with `run_migrations=true`.
