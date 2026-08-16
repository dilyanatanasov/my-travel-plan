# Implement: Push infrastructure (M1)

**Date:** 2026-08-16
**Plan:** `context/plan/2026-08-16_push-completion-daily-nudge_plan.md` (M1)
**Status:** built and verified locally; not yet deployed.

## What shipped

**Backend**
- `web-push` + `@types/web-push` installed (host **and** dev container;
  lockfile regenerated from the host afterwards and validated with
  `npm ci --dry-run`).
- Migration `1787100000000-AddPushSubscriptions`: `push_subscriptions`
  (`user_id` FK cascade, `endpoint` TEXT UNIQUE, `p256dh`, `auth`,
  timestamps, index on `user_id`).
- `modules/push/`: entity, `PushService`, `PushController`, `PushModule`
  (registered in `AppModule`, exported for the M2 sweep).
  - `GET /api/push/public-key` — `@Public()`; 404 while VAPID is unset.
  - `POST /api/push/subscribe` — authed, throttled 10/min; upserts by
    endpoint (`orUpdate`), reassigning a shared device to whoever is
    signed in. **Guests are refused in the service** (`ForbiddenException`
    when `email === null`) — a push endpoint would outlive the 30-day
    guest TTL.
  - `DELETE /api/push/subscribe` — authed; delete scoped
    `{ userId, endpoint }`, so nobody can drop another user's row.
  - `sendToUser`: no-VAPID = log-instead-of-send (MailService's unset-env
    pattern, so dev/CI send nothing); 404/410 from the push service deletes
    the row; other failures log and keep it.
- Specs (`push.spec.ts`, 6): guest refusal, upsert, owner-scoped delete,
  410-pruning, transient-failure keep, disabled no-op.

**Service worker** (`frontend/public/sw.js`)
- `push` handler (JSON payload `{title, body, url}` → notification with the
  app icons) and `notificationclick` (focus + navigate an existing tab, else
  open one). Fetch path untouched; `CACHE` bumped `mycontrail-v2` → `v3`
  per the header rule.

**Frontend**
- `features/push/pushApi.ts` — subscribe/unsubscribe mutations.
- `features/push/usePushNotifications.ts` — support detection
  (`ready` / `ios-install` / `unsupported`), enabled-state from
  `pushManager.getSubscription()` (browser is the source of truth),
  `enable()` (permission → public key → subscribe → POST; rolls back the
  browser subscription if the server save fails), `disable()` (server
  first, then browser).
- `features/push/NotificationSettings.tsx` — Settings "Notifications"
  section: toggle for `ready`, Add-to-Home-Screen walkthrough for
  `ios-install`, honest copy for `unsupported`. Rendered for registered
  users only (`!isGuest`) in `SettingsPage`.

## Deviation from the plan
The VAPID **public key is served by `GET /push/public-key`** instead of a
`VITE_VAPID_PUBLIC_KEY` build arg. Rationale: the key pair can never drift
apart across deploys, and it sidesteps the frontend `.dockerignore`/VITE_
build-arg trap that already bit this repo once (og:url). No CI changes
needed at all.

## Verification
- Backend: jest 50/50 (6 new), `tsc --noEmit` clean, eslint clean.
- Frontend: `tsc --noEmit` clean, vitest 81/81, `vite build` clean
  (548 kB main chunk pre-existing), eslint 0 errors.
- End-to-end push needs HTTPS + real keys → prod verification after deploy.

## Deploy prerequisites (user)
1. Generate a key pair once, anywhere: `npx web-push generate-vapid-keys`.
2. Add to the **droplet** `.env` (and the local copy
   `~/.ssh/contrail-server.env`):
   `VAPID_PUBLIC_KEY=…`, `VAPID_PRIVATE_KEY=…`
   (`VAPID_SUBJECT` defaults to `mailto:no-reply@mycontrail.com`).
3. Env change ⇒ **container recreate**, not just redeploy (standing rule).
   Deploy itself: Actions button, `service=all`, `run_migrations=true`
   (new table).

## Notes for the next unit (M2)
- Until the anniversary sweep exists, enabling the toggle stores a
  subscription but nothing ever sends — worth telling the user at review.
- `PushService.sendToUser(userId, {title, body, url})` is the whole send
  API; `PushModule` already exports it.
