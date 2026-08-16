# Implement: Daily nudge + completion stats (M3 + M4)

**Date:** 2026-08-16
**Plan:** `context/plan/2026-08-16_push-completion-daily-nudge_plan.md` (M3, M4)
**Frontend-only; no migrations.**

## M3 — daily-puzzle reminder toast
- `features/daily/dailyNudge.ts`: the pure gate (`shouldNudge`) — streak ≥ 1,
  today not won, one nudge per UTC day (`contrail:daily-nudged`, written the
  moment the toast shows: dismissed or not, shown = spent). `nudgeMessage`
  avoids "1-day streak".
- `features/daily/useDailyNudge.ts`: mounted in `TravelMapPage` (so never on
  /daily, never in satellites). 5s delay; server stats preferred when the
  session has one, localStorage otherwise. Landing server stats re-run the
  effect — the fired flag is set inside the timeout, so the re-run
  reschedules rather than cancels (that was a real bug caught mid-build).
- Toast: 🔥 + streak, "Play" action navigates to /daily.

## M4 — completion stats
- **Extraction:** `features/stats/continentProgress.ts` now owns the
  per-continent rows (transit-doesn't-count rule included);
  `RegionProgress` consumes it. One home for the rule, per the plan.
- **Celebrations:** `useMilestones` takes `continents?: ContinentRow[]`;
  a full row toasts "Europe, complete — every country on the map." with the
  Share action. Same seen-set (`continent:Europe` keys) and primed-on-mount
  rule, so existing completions are recorded quietly, not spammed.
- **Near-complete framing:** RegionProgress shows "· 2 to go" when
  remaining ≤ 3 AND the bar is ≥ half full — a short count on an empty bar
  is noise, on a full one it's a plan.
- **Personal records:** `features/stats/records.ts` —
  `computeTravelRecords(journeys)` derives the longest consecutive-year
  run that each added a first-ever country (arrival airports; order-proof
  first-seen), and the year touching the most continents. Rendered in
  FlightStats as two cards, gated to be meaningful (streak ≥ 2 years,
  continents ≥ 2). "Busiest year" was deliberately dropped — the panel's
  Strongest Year already is that record. Data rides the already-cached
  `getFlights` query; zero new requests.

## Verification
- Frontend: vitest 93/93 (12 new: nudge gate rules, records incl. shuffled
  first-seen and empty-safety), tsc clean, build clean, eslint 0 errors.
- Backend untouched.

## User-visible checklist
- Overview → By region: "· N to go" on nearly-done continents.
- Stats: two new record cards once the data earns them.
- Map page: if you hold a daily streak and haven't played today, one toast
  ~5s after load, once per day.
- Completing a continent (or crossing any old threshold) toasts with Share.
