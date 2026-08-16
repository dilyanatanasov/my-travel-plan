# Implement: Search v2 — M4 Watches + Alerts

**Date:** 2026-08-16 · **Branch:** `feat/search-v2`
**Plan:** `context/plan/2026-08-11_smart-trip-search_plan.md` (M4)

## What shipped
- Migration `1787400000000-AddTripWatches`: `trip_watches`
  (`UNIQUE(user_id, origin, destination, month)`, cascade on user).
  Month-scoped rather than the plan's date_type/range — the funnel's own
  unit of interest, one fewer shape to explain.
- `watch-alerts.util.ts` (pure): `shouldAlert` — user threshold OR >10%
  under the 30-day trailing min, muzzled by a 24h debounce and by "only
  news is news" (must beat the last announced price). `alertCopy` shares
  one voice across push and email.
- `watches.service.ts`: CRUD owner-scoped end to end (delete filters by
  userId; duplicates 400 via the unique constraint; max 10 active per
  user so the nightly spend is bounded). Nightly `@Cron 03:00 UTC` sweep:
  **free provider only** (Travelpayouts, still budget-gated) — watches
  never burn the paid budget; past months auto-deactivate; failures per
  watch are logged and skipped.
- `trailingMin` on PriceObservationsService deliberately EXCLUDES the
  last 24h: it is the floor the new price must undercut, not a mirror the
  sweep just wrote itself.
- **Alerts are push-first** (existing PushService — free, instant,
  softens the Resend 100/day cap) **plus email for verified addresses**
  (`MailService.sendPriceAlertEmail`, branded shell; mail failure never
  stops the sweep). Deviation from the plan's Nodemailer/SMTP: the house
  already has one mail path, it stays one.
- Endpoints: `POST/GET/DELETE /flights/watches` (create NonGuest-gated).
- Frontend: "Watch prices" button beside the search (route+month is
  enough — no search required), `WatchList` receipt with per-watch Stop,
  `Watch` tag in the API slice.

## Verification
- Backend jest 87/87 (7 new: threshold/trend/debounce/only-news rules,
  copy), tsc + eslint clean.
- Frontend tsc/build/lint clean, vitest 93/93.

## Status: the whole search v2 plan (M1–M4) is BUILT on `feat/search-v2`.
Not merged, not deployed. Gates before merge:
1. User review (design + flows) — screenshots or a local run.
2. Provider signups: Travelpayouts (token+marker), Kiwi RapidAPI Pro,
   SerpApi. Without keys everything degrades honestly, but the feature's
   value needs at least Travelpayouts + Kiwi.
3. Deploy carries THREE migrations (search-v2 tables, trip_watches — plus
   nothing else pending); `run_migrations=true`.
