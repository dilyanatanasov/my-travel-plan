# Plan: Push notifications, anniversary pushes, completion stats, daily nudge

**Date:** 2026-08-16
**Research:** `context/research/2026-08-16_push-completion-daily-nudge_research.md`
**Confirmed decisions (user, 2026-08-16):**
- Anniversaries ship as **push only** in v1; the Settings toggle shows iOS
  users an "install to home screen" hint. Email may join later behind the
  same preference (supersedes the email half of
  `context/plan/2026-08-13_want-to-go-and-memories_plan.md` part 2).
- Daily-puzzle reminder targets **streak-at-risk only** (active streak, not
  yet won today), once per UTC day, delayed after load, never on `/daily`,
  dismiss silences until tomorrow.
- Completion stats = **continent celebrations + personal records**,
  frontend-only (continent mapping stays client-side; no migration).
- **No badge grid** — celebrations stay toasts + stats panel numbers.

**Stated defaults (flag if wrong):** any registered user may enable push
(no `email_verified` gate — the browser permission prompt is its own
consent anchor); guests don't see the toggle. Anniversary send hour fixed
at 08:00 UTC in v1.

## Permission model (standing rule)
- `push_subscriptions` rows belong to their `user_id`; subscribe/unsubscribe
  endpoints are JWT-authed and operate only on the caller's rows —
  **enforced server-side** in the service, not the client.
- There is **no user-facing send endpoint**; only the cron sweep sends.
- Anniversary content is derived per-user from their own journeys; nothing
  crosses user boundaries.

## M1 — Push infrastructure
1. Backend: add `web-push` (host **and dev container** — sharp precedent);
   generate VAPID keypair; private key → droplet `.env` (recreate to apply),
   public key → `VITE_VAPID_PUBLIC_KEY` build arg (remember
   `!.env.production` dockerignore lesson).
2. Migration: `push_subscriptions` (`id, user_id FK cascade, endpoint
   UNIQUE, p256dh, auth, created_at, last_seen_at`).
3. `PushModule`: `POST /push/subscribe`, `DELETE /push/subscribe` (authed);
   send helper that deletes rows on 404/410. Jest specs: ownership
   enforcement, dead-subscription pruning.
4. `sw.js`: add `push` + `notificationclick` handlers (deep-link focus/open);
   **bump `CACHE` to `mycontrail-v3`**; fetch path untouched (version-toast
   regression guard).
5. Settings: "Notifications" block — enable/disable toggle (gesture-driven
   permission request), iOS-not-installed hint (`navigator.standalone` /
   `display-mode` check), registered users only.

## M2 — Anniversary sweep
1. Adopt `@nestjs/schedule`; migrate `GuestCleanupService` onto it (its own
   comment mandates this at the second job).
2. Daily cron 08:00 UTC: journeys with **day-precision** dates matching
   today's month+day → "N years ago you landed in X" → send to all the
   user's subscriptions. Skip N=0.
3. Dedup: `anniversary_sends` log (`user_id, journey_id, year` unique) so
   restarts can't double-send. Jest specs: precision filtering, dedup,
   leap-day (Feb 29 → skipped in non-leap years is acceptable v1).
4. Notification click → the journey on the map (verify journey landing
   route; fall back to country landing).

## M3 — Daily reminder toast (frontend-only)
1. `features/daily/useDailyNudge.ts`: on shell mount, if
   `loadStats().streak ≥ 1` && not won today && `loadDayState` not won &&
   nudge-date key ≠ today && route ≠ `/daily` → after ~5s, toast
   "🔥 {streak}-day streak on the line — today's country is waiting" with a
   **Play** action → `/daily`. Write `contrail:daily-nudged` immediately
   (shown = spent, dismiss included). Signed-in users: prefer server stats
   when loaded, localStorage otherwise. Vitest specs on the pure gate.
2. Mount in the app shell (near `useMilestones`' host), never in satellites.

## M4 — Completion stats (frontend-only)
1. Extract `RegionProgress`'s row computation into a shared helper
   (`features/stats/continentProgress.ts`) — single home for the
   transit-doesn't-count rule; RegionProgress consumes it.
2. Extend `useMilestones` with continent-complete checks (seen-keys
   `continent:EU` style; primed-on-mount pattern unchanged; toast copy
   "Europe, complete. Every country." + Share action).
3. Personal records in the stats panel: busiest travel year, longest
   new-country streak, continents visited in one year — pure derivations
   from journeys+visits, Vitest-covered (`features/stats/records.ts`).
4. Near-complete framing ("2 from completing Europe") rides RegionProgress,
   not a toast.

## Sequencing & verification
M1 → M2 (dependency); M3 and M4 anytime, independent. Bar per milestone:
tsc, lint, tests, build green; deploy via Actions button `service=all`,
`run_migrations=true` (M1/M2 carry migrations). User smoke-test before
deploy per house habit; push end-to-end needs prod HTTPS, so M1 gets a
dev-mode check (localhost is a secure context) plus a prod verification
step after deploy.
