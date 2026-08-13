# Consolidation pass — tests, pipeline, and the god component

**Date:** planned 2026-08-13 night for 2026-08-14. Verdict from the honest
review: product 9, execution 8, engineering discipline 6 — zero automated
tests, one 1,200-line component owning two render modes, and a pipeline trap
that nearly fired twice. This pass buys back the debt before new features
(duel analytics, completion, puzzle) pile onto untested foundations.

**Prime directive: no behavior changes.** Every step ends with build + lint +
a manual smoke of flat map, globe, and one replay. Anything that changes what
users see has leaked out of scope.

## Decisions to confirm at session start

- **D1 Frontend test runner:** Vitest (recommended — Vite-native, zero config
  friction, same expect API as jest) vs adding jest to the frontend.
- **D2 TravelMap strategy:** incremental hook extraction (recommended — each
  step shippable and verifiable) vs a big-bang split into controller +
  FlatMapView/GlobeView siblings (cleaner end-state, riskier single step).
- **D3 Timeline unification depth:** extract-and-test both timeline builders
  as they are (recommended for this pass) vs also merging the flat (SMIL
  keyPoints) and globe (rAF sampling) builders into one shared module now.

## M1 — Test infrastructure (~1h)

- Frontend: add Vitest + a `test` script; wire `tsconfig` types. No component
  testing library yet — this pass tests pure logic only.
- Backend: jest already configured; verify `npm test` runs green on the
  (near-empty) suite; add `test` to both packages' CI expectations.

## M2 — Extract-and-test the load-bearing logic (~half day, the heart)

Each item: extract inline logic into a pure function (where not already
pure), then test the extraction. The extraction IS the refactor; the tests
are the harness that makes tomorrow's features safe.

| Logic | Today | Extraction target | Key cases |
|---|---|---|---|
| Replay clocks | `legFlightSeconds` / `journeyFlightSeconds` (pure) | as-is | clamps, sqrt curve, pause summation, empty legs |
| Flat flight timeline | inline in `JourneyHighlight` (keyPoints/keyTimes/altitude/contrail strings) | `flightTimeline.ts` | 1-leg, 3-leg, pauses landing on keyPoint duplicates, lists ending exactly at "1" |
| Globe timeline | `globeUtils.buildJourneyTimeline` / `samplePlaneFrame` / `chaseCamera` | as-is (see D3) | frame at t=0/mid/pause/done, camera easing bounds, antimeridian legs |
| Ground-transfer split | inline in `flights.service.create` | `splitChainAtGroundTransfers(legData, airportMap)` | no transfers, NRT→HND mid-chain, transfer-first, all-transfers → empty, round-trip flag drop |
| Duel merge | inline `useMemo` in `DuelPage` | `mergeDuelMaps(a, b)` | exclusives/shared buckets, wishlist excluded, sort order (exclusive-first) |
| Date precision | `utils/journeyDate.ts` (pure) | as-is | year/month/day render + parts round-trip + `buildDateDto` clearing |
| Token parsing | `extractTokens` in `DuelSection` | export it | bare token, /s/ link, one- and two-token /duel/ links, self-only input |
| Backend tokens | `AuthTokensService` issue/redeem | test with repo mock | single-use atomicity, expiry, reissue invalidation |

## M3 — The pipeline trap (~1h)

Per-service image tags, exactly as designed in memory: `BACKEND_TAG` /
`FRONTEND_TAG` in `docker-compose.prod.yml`; deploy workflow sets both on
`service=all`, and on single-service deploys resolves the *other* service's
tag from its running container (`docker inspect`) instead of `:latest`;
rollback.yml gets the same treatment. Kills the stale-`:latest` trap that
nearly fired twice on 2026-08-13. Manual-recreate reflex note can then be
retired from memory.

## M4 — TravelMap decomposition (timeboxed ~2h, stop when time is up)

Incremental (per D2), in this order, smoke-testing both modes after each:
1. `useReplayOrchestration` — the landing/pop/year-chip timer effects.
2. `useSearchLanding` — search-go handler + blink/ping state.
3. `useCountryInteraction` — tap-cycle + long-press handlers.
4. If time remains: hoist the globe/flat branch data-prep (`replayRoutes`,
   display maps) into a `useMapData` hook both branches consume.
Non-goal: moving JSX around for aesthetics. Only stateful logic leaves.

## M5 — CI gate + ship (~30min)

- `deploy.yml`: add `npm test` to both lint jobs (fail closed).
- One deploy at the end. Update the implement log + memory: tests exist,
  trap fixed, TravelMap slimmed to whatever line count it reached.

## Explicit non-goals

Staging environment (worth a separate conversation), component/E2E tests,
visual regression, splitting the backend, touching any feature behavior.
