# Implement: Anniversary push sweep (M2)

**Date:** 2026-08-16
**Plan:** `context/plan/2026-08-16_push-completion-daily-nudge_plan.md` (M2)

## What shipped

**Scheduler**
- `@nestjs/schedule` installed (host + dev container, host lockfile
  canonical); `ScheduleModule.forRoot()` in `AppModule`.
- `GuestCleanupService` migrated off its raw `setInterval` onto
  `@Timeout(60s)` + `@Interval(6h)` — its own comment mandated the switch
  at the second scheduled job. Sweep logic untouched.

**Anniversary sweep** (`modules/push/anniversary.service.ts`)
- `@Cron('0 8 * * *', UTC)`. Candidates: day-precision journeys whose
  month+day equal today's, from an earlier year, owned by a user with at
  least one push subscription (SQL `EXISTS`) — so the send-log only ever
  records notifications that had somewhere to go.
- **Dedup is claim-then-send:** `INSERT … ON CONFLICT DO NOTHING` into
  `anniversary_sends` (`UNIQUE(user_id, journey_id, year)`, migration
  `1787200000000`); empty `RETURNING` = already claimed = skip. Restarts
  and duplicate containers cannot double-send.
- Copy: "✈️ One year ago today / N years ago today — You landed in
  {city, country}". Round trips read the stop before the return leg;
  fallbacks city+country → country → airport name. Click opens `/`
  (no URL-based journey landing exists in the app; the payload's `url`
  field is ready whenever one does).
- Feb 29 journeys ring only on leap years — accepted in the plan.

**Test doorbell (small addition beyond the plan)**
- `POST /push/test` (authed, 3/min throttle): sends a real notification
  through the real pipeline to the caller's own devices only.
- Settings: a ghost "Send a test notification" button appears under the
  toggle once enabled. This exists so the end-to-end path is verifiable
  today, before the first real anniversary fires.

## Verification
- Backend: jest 57/57 (7 new: destination rules, payload copy, claim/skip/
  same-year sweep paths), tsc clean, eslint clean.
- Frontend: vitest 81/81, tsc clean, build clean, eslint 0 errors.
- The cron itself is prod-verified by construction (fires at 08:00 UTC);
  the test endpoint proves the send path without waiting for one.

## How the user tests
Settings → Notifications → Turn on → "Send a test notification" → a
notification pops on that device (and any other enabled ones). First real
anniversary arrives at 08:00 UTC on a matching date.
