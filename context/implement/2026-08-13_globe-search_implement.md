# Globe-mode search — Implementation log

**Date:** 2026-08-13 (late). Plan:
`context/plan/2026-08-13_globe-search_plan.md`. Built by the fourth session
in the `globe-search` worktree on `feat/globe-search`; merged to `main` at
`d08c6e3` after the user's browser review. Deployed: **not yet** — deploys
are manual `workflow_dispatch`; this rides the next one.

## What shipped, against the plan

All four plan items landed as designed, one commit:

1. `globeUtils.ts` — `searchFraming(box, fallbackCenter)` (spherical
   fit-to-country; box-diagonal angular extent → zoom clamped [1.15, 7];
   no box → point target at zoom 5) and an optional `rate` parameter on
   `chaseCamera` (default 3.2 unchanged; search flies at 4.6 so a
   worst-case antipodal landing beats the ping's 2.6s life).
2. `useSearchLanding.ts` — optional `frameTarget(target, box)` strategy;
   without it the flat `fitToPoints` path runs verbatim.
3. `GlobeView.tsx` — MapSearch in the control column; one-shot rAF flight
   with arrival snap, cancelled by pointer-down, wheel, or replay;
   `blinkIsoCode` + `onCentroids` wired to its CountriesLayer; ArrivalChip
   ping gated by `isOnVisibleSide`. No CountryDetailCard per G1.
4. `TravelMap.tsx` — four additive props at the GlobeView call site.

## Deviations from the plan

- None in behaviour. One test fixture was wrong, not the code: Brazil's
  box diagonal (~52°) legitimately hits the 1.15 wide floor, so the
  "between the clamps" case now uses France and Brazil joined Russia in
  the floor-clamp test.

## Verification

- 53 frontend tests green (6 new: searchFraming ×5, chaseCamera rate ×1),
  lint 0 errors, `tsc -b` clean, `vite build` clean — run on the rebased
  tip before the ff-merge.
- Browser check: host vite (`vite.config.local.mts`, untracked, since
  removed) proxying `/api` to the live site; the user tested country and
  airport landings on the real map in globe mode and approved.

## Open follow-ups

- G1's other half: a country card (or any tap interactivity) on the globe
  is still undesigned; the search landing deliberately stops at fly + fit
  + blink.
- The flat map's `SearchTarget.zoom` values (2.5/6) are dead weight on the
  globe path — harmless fallbacks, worth folding into the strategies if
  MapSearch ever grows a third consumer.
