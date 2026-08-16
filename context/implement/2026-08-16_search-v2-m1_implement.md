# Implement: Search v2 — M1 Foundations

**Date:** 2026-08-16 · **Branch:** `feat/search-v2` (not on main)
**Plan:** `context/plan/2026-08-11_smart-trip-search_plan.md` (M1)

## What shipped
- `providers/flight-provider.interface.ts`: `FlightProvider` with the
  two tiers (`getPriceSurface` / `searchPrecise`), `PricePoint`,
  `SurfaceQuery`, `PreciseQuery`, `costPerCall`, `isConfigured()`.
- `travelpayouts.provider.ts`: v2 month-matrix → PricePoints (always
  `isEstimate: true`); unset `TRAVELPAYOUTS_TOKEN` = skipped; failures
  degrade to `[]`, never throw. Pure `mapMatrixRows` for tests.
- `serpapi.provider.ts`: `google_flights_calendar` surface (month range
  clamped to the future); $0.025/call. Precise-via-SerpApi deliberately
  deferred to M2's "Kiwi came up empty" branch.
- `kiwi.provider.ts`: thin adapter over the existing `FlightSearchService`
  — the legacy `/flights/search` endpoint and its transform stay untouched
  (**deviation from the plan's "extract HTTP+transform": satisfied at the
  seam instead of moving 400 working lines**).
- `affiliate.util.ts` `withAffiliate`: `affilid` marker on kiwi.com links
  only, pass-through otherwise; wired into BOTH deep-link branches of
  `FlightSearchService.transformPricingOptions` — the legacy search earns
  the marker too, the moment `TRAVELPAYOUTS_MARKER` exists.
- Migration `1787400000000… (1787300000000-AddSearchV2Tables)`:
  `price_observations` (append-only, route+date and route+seen indexes)
  and `api_spend_ledger` (`UNIQUE(provider, period_month)`).
- `budget.service.ts`: `canSpend(provider, n)` against
  `BUDGET_*_CALLS` env caps (0/unset = uncapped), `record()` as
  upsert-then-increment so concurrent searches stay additive and restarts
  can't zero the month. Key rotation stays in ApiKeyManagerService.
- `.env.example`: `TRAVELPAYOUTS_TOKEN/MARKER`, `SERPAPI_KEY`,
  `BUDGET_KIWI_CALLS`, `BUDGET_SERPAPI_CALLS`.

## Verification
Backend jest 67/67 (10 new: both mappers, month clamp, affiliate rules,
budget caps incl. fresh-month), tsc clean, eslint clean.

## Blocked on the user (not on code)
1. Travelpayouts signup → token + marker (unlocks the free surface AND
   the Kiwi affiliate program).
2. Kiwi RapidAPI **Pro** subscription ($5/mo) — key(s) into
   `RAPIDAPI_KEY(S)`.
3. SerpApi signup (free tier 100 searches/mo) → `SERPAPI_KEY`.
Everything runs without them: unconfigured providers are skipped and the
funnel degrades to cache/fixtures.

## Pending probe
The plan's "probe Kiwi wrapper for date-range params" needs a live key —
parked until the Pro subscription exists.
