# Implement: Search v2 — M2 Funnel

**Date:** 2026-08-16 · **Branch:** `feat/search-v2`
**Plan:** `context/plan/2026-08-11_smart-trip-search_plan.md` (M2)

## What shipped
- `search-funnel.util.ts` — the pure opinions: `surfaceTtlHours`
  (48h/12h/4h by lead time), `selectCandidates` (nights window, cheapest
  observation per date pair, one pick per week before doubling up, K=8),
  `paretoFront` on (price, TOTAL duration — return leg finally counts),
  `median`, `judge` (recommended = smallest normalized price+time distance
  inside the front; copy from real deltas, cheapness anchored to the
  route's period median, never the result set's own min/max).
- `price-observations.service.ts` — append-only write-back;
  `freshSurface` (latest observation per date pair still inside its TTL);
  `periodMedian` via `percentile_cont` in Postgres.
- `search-orchestrator.service.ts` — the funnel: cached surface first,
  then Travelpayouts → SerpApi (each `isConfigured` + `canSpend` gated),
  candidates, Kiwi L2 in batches of `MAX_CONCURRENT=3` under a
  `HARD_CALL_CAP=25`, L2 cheapest written back as `is_estimate: false`,
  judgement last. Budget refusal or missing providers set `meta.degraded`
  — the search never hard-fails. `onEvent` callback is the M3 SSE seam
  (surface → result* → judgement), already ordered and tested.
- `POST /flights/smart-search` (non-streaming, M2 testability):
  `NonGuestGuard` + 3/min throttle — same gate as `/explore`, it spends
  real money. DTO: origin/destination/month + optional nights window,
  passengers, cabin.

## Deviation
Hub exploration is NOT wired into the funnel yet — the plan gates it on
"L1/L2 found nothing sane", a threshold that needs live keys to
calibrate. Parked for M3+; the old /explore endpoint still has it.

## Verification
Backend jest 80/80 (13 new: TTL tiers, nights window, week spread,
Pareto incl. ties, judgement copy + anchors, orchestrator cache-first /
pay-and-write-back / budget-degrade / event order), tsc clean.
