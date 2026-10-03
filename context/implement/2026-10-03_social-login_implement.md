# Implementation log: Google sign-in and sign-up

Date: 2026-10-03. Plan: `context/plan/2026-10-03_social-login_plan.md`.
Branch: `feat/google-sign-in` (on top of `feat/uk-constituent-countries`).
Status: BUILT, dev-migrated, awaiting Google credentials for an end-to-end
run, then owner's deploy go.

## Done

### Backend
- `user_identities` table (migration `1787900000000-AddUserIdentities`),
  entity `auth/entities/user-identity.entity.ts`, `User.identities`.
- `auth/google-auth.service.ts`: configured check, authorization URL
  (`openid email profile`, `prompt=select_account`, state + nonce), code
  exchange and ID-token verification via `google-auth-library`
  (audience and nonce checked, `email_verified` carried). `safeNext()`
  open-redirect guard.
- `AuthService.signInWithGoogle`: one transaction; identity -> verified
  email match (links, verifies) -> guest upgrade in place -> new
  passwordless account. Returns `outcome` for analytics.
- `PublicUser` + export gain `hasPassword` / `providers` /
  `signInMethods`. `forgotPassword` now serves passwordless accounts, which
  is how they set a password. Profile and login load identities;
  `findById` (every request) stays lean.
- Controller: `GET /auth/providers` (public), `GET /auth/google` (sets the
  10-minute flow cookie scoped to `/api/auth/google`, redirects),
  `GET /auth/google/callback` (state check, exchange, guest id from our
  cookie, sets session cookie, redirects to `/auth/complete?next&outcome`;
  every failure redirects to `/login?error=google*`). Both throttled 10/min.
- `main.ts`: `trust proxy = 1` so per-IP throttles work behind nginx.
- `common/app-url.ts` shared by mail links and OAuth redirects; optional
  `APP_URL` override for non-default dev ports.
- `.env.example`: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `APP_URL`.
- Dependency: `google-auth-library` (host + dev container).

### Frontend
- `features/auth/GoogleSignInButton.tsx`: anchor to the start route with
  inline SVG glyph and an "or" divider; renders nothing unless
  `/auth/providers` says Google is on. On Login ("Continue with Google",
  carries `next`) and Register ("Sign up with Google").
- `pages/AuthCompletePage.tsx` at `/auth/complete`: `rememberAccount()`,
  tracks `signup {method: google}` / `guest_convert`, resets the RTK
  cache, navigates to a same-origin `next`.
- Login page shows a sentence for `?error=google|google-denied|
  google-unverified|google-unavailable`.
- Settings: Google-only accounts see "You sign in with Google" + "Set a
  password" (sends the reset link); delete needs no password for them.
- Privacy policy mentions the Google account id and email.

## Verified
- backend `nest build` clean; jest 129/129 (14 new: resolution order,
  unverified refusal, safeNext); eslint clean.
- frontend `tsc -b` clean; vitest 133/133; eslint clean.
- Dev DB: migration applied, `user_identities` shape confirmed.
- Live probes on the dev stack (no credentials): providers -> `{google:false}`;
  start -> 302 `/login?error=google-unavailable`; callback without flow
  cookie -> 302 `/login?error=google`; provider error -> `google-denied`;
  guest profile carries `hasPassword:false, providers:[]`.

## Not done / for the owner
- End-to-end run needs a Google OAuth client: Google Cloud Console ->
  APIs & Services -> Credentials -> OAuth client ID (Web application).
  Authorized redirect URIs: `https://mycontrail.com/api/auth/google/callback`
  and `http://localhost:5173/api/auth/google/callback`. OAuth consent
  screen must be published (External) for arbitrary Google accounts.
  Put `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` in root `.env` locally
  (restart the backend container) and in the droplet `.env` for prod
  (recreate backend). If the dev stack runs on port 5273, also set
  `APP_URL=http://localhost:5273` locally and register that redirect URI.
- Prod deploy: after the UK split, `run_migrations=true`.
- Apple: not built (owner chose Google only).
