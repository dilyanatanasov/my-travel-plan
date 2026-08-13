# Consolidation pass — implementation log

**Date:** 2026-08-13 (evening, pulled forward from the 2026-08-14 plan).
**Plan:** `context/plan/2026-08-14_consolidation_plan.md`
**Decisions:** D1 Vitest ✔ · D2 incremental hooks ✔ · D3 extract-and-test both timelines (no merge) ✔
**Scope adjustment (user, mid-session):** tests only where logic is critical
or fragile, to expose edge cases — duel display merge and date-precision
formatting dropped from the test scope; everything else in M2 kept.

## Done

- **M1** — Vitest in the frontend (`npm test` = `vitest run`, explicit
  imports, no globals). Backend jest verified running.
- **M2a** — `buildFlightTimeline` extracted from JourneyHighlight into
  `FlightMap/flightTimeline.ts` (pure move). 21 tests across it and the
  replay clocks. **Caught a real defect:** `legFlightSeconds(NaN)` returned
  NaN (NaN slips through Math.min/max), which would silently disable the
  SMIL animation — hardened with a finite guard.
- **M2b** — 18 tests pin `globeUtils`: leg scheduling with pauses, plane
  sampling (t=0 / cruise / pause / done), antimeridian legs, contrail
  growth, frame-rate-independent chase camera, antipodal NaN guard, clamps.
- **M2c** — `splitChainAtGroundTransfers` extracted to
  `flights/flight-chain.util.ts` (pure move); 8 jest specs including the
  real SOF→AMS→NRT · HND→CDG→AMS→SOF case. 9 AuthTokensService specs:
  hash-only storage, reissue invalidation, per-type TTLs, single-use
  redemption with the losing race.
- **M2d** — `extractTokens` extracted to `share/duelTokens.ts`; 8 specs
  including the two-token duel-link case that shipped a bug once.
- **M3** — `BACKEND_TAG`/`FRONTEND_TAG` replace the shared `IMAGE_TAG` in
  docker-compose.prod.yml; deploy.yml and rollback.yml resolve the
  untouched service's tag from its running container (`docker inspect`),
  falling back to `latest` only when nothing is running. Kills the
  stale-`:latest` trap. The manual-recreate reflex (pull :latest first) is
  retired — but a manual `compose up` without the env vars still defaults
  to :latest, so prefer the Actions button as always.
- **M4** — TravelMap 1,200 → 951 lines via three pure-move hooks:
  `useReplayOrchestration`, `useSearchLanding`, `useCountryInteraction`.
  The drag/consumed refs stayed in the container (shared by all layers).
  The optional `useMapData` hoist was skipped at the timebox.
- **M5** — `npm test` added to both CI lint jobs, fail closed.

## Numbers

- Frontend: 47 tests in 4 files (vitest). Backend: 17 tests in 2 suites
  (jest). All green; builds and lint clean (8 pre-existing warnings, no new
  classes, zero errors).

## Deviations

- Test scope trimmed per user (critical/fragile only), see above.
- legFlightSeconds NaN guard is the one deliberate (defensive) behavior
  change; call sites already sanitized, so nothing user-visible.

## Not done / follow-ups

- Globe search (D7 in COORDINATION.md): queued, builds on useSearchLanding.
- `useMapData` hoist (M4 item 4) — skipped at timebox, still worthwhile.
- Deploy pending the user's smoke test: flat map, globe, one replay.
