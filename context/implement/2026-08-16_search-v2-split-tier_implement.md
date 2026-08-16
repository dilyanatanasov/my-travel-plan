# Implement: Search v2 — Split-ticket tier + review fixes

**Date:** 2026-08-16 · **Branch:** `feat/search-v2`
**User decision:** a separate-booking combination via a positioning hub IS
a route (the Varna→Iceland pattern: VAR⇄SOF ticket + SOF⇄KEF ticket) —
priced end-to-end and judged on the same Pareto front as through-tickets.
Confirmed rules: same-day connections need ≥4h, overnight in the hub city
allowed (≤36h); hubs are the 3 nearest majors by geography, auto-derived.

## Backend
- `split-search.util.ts` (pure): `nearestHubCodes` (haversine over
  KNOWN_HUBS coordinates from the airports table; origin + destination
  excluded — for Varna the honest answer is OTP, IST, SOF),
  `composeSurfaceCombos` (date alignment: main leg departs same/next day
  after positioning arrives; positioning return leaves same/next day after
  the main leg lands back; nights window on the destination stay;
  **seasonality is free** — a month a hub route doesn't fly contributes no
  points and no combos), `composeSplitItinerary` + `composeSplitResults`
  (real flight times checked both directions; composed legs carry the hub
  wait as a layover and +1 stop; `selfTransfer` field with per-booking
  labels/prices/links).
- Orchestrator L2.5: surface fetching refactored into `ensureSurface`
  (shared by direct + every split leg, budget-gated); per hub, 2 free
  surface calls then at most 1 combo × 2 Kiwi calls — all inside the same
  `HARD_CALL_CAP = 25`. Composed totals written back as real (non-estimate)
  observations for the FULL route. The tier never fails the search.
- `FlightResultDto.selfTransfer?` added (backend + frontend types).

## Frontend
- `TripResultCard`: "Self-transfer via IST" chip, plain-words risk line,
  one Book button per ticket with its price. **Mobile layout fixed** (the
  design-review bug): route holds one unbreakable line, detail wraps
  underneath, price + buttons on their own full-width row.
- Review polish: degraded meta line now says "nothing cached, live
  providers unavailable"; WatchList wraps instead of truncating the
  last-alert price.

## Verification
- Backend jest 96/96 (9 new: hub geography, combo alignment incl.
  seasonality-by-absence and nights window, connection rule 4h/overnight/
  impossible-return, composed pricing/stops), tsc + lint clean.
- Frontend tsc/build/lint clean, vitest 93/93.
- Re-captured stub-driven screenshots (assets updated); review artifact
  republished with the split card visible on desktop and mobile.

## Cost note
Worst case per search stays bounded: 1 direct surface + 6 free hub
surfaces + 8 direct Kiwi + 6 split Kiwi ≤ the 25-call cap; hub surfaces
are Travelpayouts (free) and cached like everything else.
