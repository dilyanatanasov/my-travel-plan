# Research: Push notifications + anniversary pushes, completion stats, daily-puzzle reminder

**Date:** 2026-08-16
**Scope decided by the user:** anniversary notifications ship as **push, not email**
(supersedes part 2 of `context/plan/2026-08-13_want-to-go-and-memories_plan.md`,
which specified emails). Completion stats and a non-annoying daily-puzzle
reminder toast ride the same wave.

---

## 1. Push notification infrastructure (the prerequisite)

### What exists
- `frontend/public/sw.js` — a real service worker, installable-PWA grade,
  cache-versioned (`mycontrail-v2`), with the hard-won `no-store` bypass for
  `/version.json`. **No `push` or `notificationclick` handlers yet.** Any edit
  requires a cache-name bump per the comment at the top.
- `manifest.webmanifest` + icons already exist (192/512 + apple-touch).
- Backend scheduling: the **only** scheduled job is
  `guest-cleanup.service.ts`, done with raw `setInterval` and carrying an
  explicit note: *"this is the only scheduled job in the app… If a second one
  ever appears, switch to the real scheduler."* The anniversary sweep is that
  second job → adopt `@nestjs/schedule` and migrate guest cleanup onto it.
- Auth: JWT cookie; users table has `email_verified`; Settings page exists
  (used for GDPR "Your data", password change) — natural home for the toggle.

### What web push needs (standard, self-hosted, no third-party account)
- **Backend:** `web-push` npm package; one-time VAPID keypair (public key to
  the frontend, private key in droplet `.env` — same handling as the Resend
  key: env change ⇒ container recreate, not redeploy).
- **DB:** `push_subscriptions` table — `id, user_id (FK, cascade), endpoint
  (unique), p256dh, auth, created_at, last_seen_at`. A user can hold several
  (phone + desktop). 410/404 on send ⇒ delete the row (standard hygiene).
- **API:** `POST /push/subscribe`, `DELETE /push/subscribe` (authed);
  server-side permission model: a subscription row belongs to its user, sends
  are always server-initiated — no user-triggered send endpoint at all.
- **SW:** add `push` (showNotification) + `notificationclick` (focus/open a
  deep link) handlers; bump cache name.
- **Frontend:** permission must be requested from a **user gesture** — a
  Settings toggle and/or a contextual prompt, never on load.

### Reach constraints (honest numbers)
- **iOS Safari:** push only works when the site is **installed to the home
  screen** (iOS 16.4+), and the permission prompt must come from a gesture
  inside the installed app. A plain Safari tab can never receive push.
- Android Chrome/desktop browsers: works from the normal site.
- Consequence: anniversary *pushes* reach strictly fewer people than emails
  would have. Mitigation options: an "install the app to get these" hint on
  the Settings toggle for iOS users; or later add email as a second channel
  behind the same preference (the old plan's migration name `memory_emails`
  should therefore be generalized, e.g. `anniversary_notifications`).
- Guests: have accounts (real rows) but no trust anchor; simplest is to gate
  the toggle on registered users (matches sharing's `email_verified` gate
  precedent — decision needed on whether verification is required or just
  registration).

## 2. Anniversary pushes (rider on §1)

- Data exists: journeys carry dates with `date_precision` (Y/M/D). Only
  **day-precision** rows can anniversary; month/year-precision rows are
  silently skipped (rendering utils in `utils/journeyDate.ts` show the
  precision-aware patterns).
- Sweep: daily cron (via `@nestjs/schedule`), picks journeys where
  month+day == today's, computes "N years ago you landed in X", sends to all
  of the user's subscriptions. Timezone: users have no stored TZ; fixed UTC
  morning hour (e.g. 08:00 UTC) is the pragmatic v1.
- Dedup guard: a `(user_id, journey_id, year)` sent-log or an
  idempotent-by-date design so a redeploy mid-day can't double-send.
- Settings toggle default: **off until opted in** — push permission itself is
  the opt-in gesture, so no separate default-on question exists (unlike
  email).
- Copy surface: notification click deep-links to the journey on the map
  (existing routes support country/airport landings; check journey landing).

## 3. Completion stats

### What already exists (more than the research sketch assumed)
- `components/FlightMap/continentUtils.ts` — frontend continent mapping
  (`getContinent`, `ALL_CONTINENTS`) — **the "continent migration" may not be
  needed for v1 at all**; it's only required when stats must be computed
  server-side (share unfurls, Wrapped, cohort SQL).
- `AppShell/RegionProgress.tsx` — per-continent visited/total bars already in
  the Overview ("3 of 5 in Oceania"), transit excluded.
- `features/milestones/useMilestones.ts` — threshold toasts for countries /
  flights / distance with a "Share it" action; seen-set in localStorage;
  primed-on-mount so old milestones never spam. This is the pattern to
  extend, not replace.

### The gap (= the actual feature)
1. **Continent-complete celebrations:** extend `useMilestones` with
   per-continent completion checks (data: `RegionProgress`'s exact rows —
   extract the row computation into a shared helper to avoid duplicating the
   transit rule). Also near-complete framing ("2 from completing Europe") as
   a stat, not a toast.
2. **Personal records** (stats panel): busiest travel year, longest
   new-country streak, continents in a single year — derivable client-side
   from journeys+visits.
3. **External baselines:** "most people visit <10 countries in a lifetime"
   — hand-curated constants, needs sourcing (open decision D3 from the
   2026-08-13 research).
4. "Badges" (user's word): could be a visual grid rendering of the same
   milestone data — optional presentation-layer decision, no new data.

## 4. Daily-puzzle reminder toast (non-annoying by construction)

- State available synchronously: `loadDayState(todayUtc())` (null or
  `status: 'playing'` ⇒ not finished today), `loadStats().streak` +
  `lastWonDate` (localStorage; server stats mirror for signed-in via
  `dailyApi`). `DailyCard` already sits in the Overview; `/daily` is a
  satellite page.
- Toast infra exists (`ToastProvider`, used by `useMilestones` with an action
  button — "Play" action can deep-link to `/daily`).
- Anti-annoyance rules to encode:
  - at most **once per UTC day**, persisted (`contrail:daily-nudged` date key);
  - never on `/daily` itself, never during replay;
  - delayed a few seconds after load so it doesn't compete with app open;
  - dismiss = silence until tomorrow;
  - **audience decision needed:** everyone who hasn't played today, vs only
    players with a streak at risk (streak ≥ 1 and not yet won today). The
    streak-at-risk variant is self-limiting: people who never play are never
    nagged, which is the Wordle-retention psychology anyway.

## 5. Risks / constraints

- sw.js changes: bump `CACHE` name or returning visitors never get the push
  handlers; the version-toast machinery (just fixed at 240f2c0) must not
  regress — push handlers are additive, fetch path untouched.
- VAPID private key: droplet `.env` only, container recreate to apply.
- `web-push` is a backend dep ⇒ must also be installed **inside the dev
  container** (standing reflex; sharp precedent).
- Cron in a single-container backend is fine (one instance), but keep the
  dedup guard so scaling or restarts can't double-send.
- Do not build notification batching/quiet-hours in v1 — one notification
  type, one per anniversary day, is below any annoyance threshold.

## 6. Suggested sequencing

1. Push infra (SW handlers, VAPID, subscriptions table, Settings toggle).
2. Anniversary sweep (adopt `@nestjs/schedule`, migrate guest cleanup).
3. Daily reminder toast (frontend-only, can ship in the same wave).
4. Completion stats (independent of 1–3; frontend-only in v1 if continent
   stays client-side).
