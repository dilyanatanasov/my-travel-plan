# Globe-mode search — Plan

**Date:** 2026-08-13 (late). Research:
`context/research/2026-08-13_globe-search_research.md`. Decision D7 in
COORDINATION.md; user confirmed start after consolidation M4 landed
(`dbe2d0c`). G1 resolved per the recommendation: **fly + zoom-to-fit +
blink, no CountryDetailCard on the globe** — the card would be the globe's
first interactive object and deserves its own design pass.

Built in the `globe-search` worktree on `feat/globe-search`, so the main
checkout stays free for the consolidation/deploy session.

## Approach

One principle: flat and globe share one landing brain (`useSearchLanding`),
and differ only in how a landing becomes a camera frame.

1. **`globeUtils.ts`** — `searchFraming(box, fallbackCenter)`: spherical
   fit-to-country. Zoom from the box diagonal's angular extent, the same
   ~60°-of-hemisphere trick `buildJourneyTimeline` uses for legs, clamped
   [1.15, 7]; center is the great-circle midpoint of the box diagonal
   (mirrors flat's `fitToPoints` box-midpoint behaviour, and survives
   antimeridian boxes because the math is spherical). No box (airport) →
   the target's own coordinates at zoom 5. Plus an optional `rate`
   parameter on `chaseCamera` (default 3.2, unchanged): the search flight
   uses a brisker chase than the replay's cameraman-trail so the landing
   completes inside the ping's lifetime.
2. **`useSearchLanding.ts`** — optional `frameTarget(target, box)` strategy.
   Absent (flat), the existing `fitToPoints` path runs verbatim — zero
   behaviour change to the flat map.
3. **`GlobeView.tsx`** — new props `countries`, `countryCentroids`,
   `countryBounds`, `onCentroids` (threaded from TravelMap, which already
   owns them). `MapSearch` mounts in the control column's existing berth.
   A one-shot rAF flight drives `chaseCamera` at the framing until arrival
   (< ~0.1° and zoom settled), then snaps exact. The flight yields the
   camera to anything with a stronger claim: pointer-down and wheel cancel
   it, replay activation aborts it frame-by-frame. Blink wires
   `searchBlinkIso` into the `blinkIsoCode` prop CountriesLayer already
   has; the airport ping reuses `ArrivalChip` gated by `isOnVisibleSide`
   so it never renders mirrored from the hidden hemisphere. `onCentroids`
   goes to the globe's CountriesLayer — globe mode persists in
   localStorage, so a globe-first load must still learn centroids/bounds
   or search would come up empty.
4. **`TravelMap.tsx`** — pass the four props at the GlobeView call site.
   Nothing else moves.

## Tests (globeUtils.test.ts, M2b style)

`searchFraming`: small country clamps at 7, mid-size lands between,
continental clamps at 1.15, airport fallback (no box) is zoom 5 at the
target, antimeridian box stays finite with a center near the dateline.
`chaseCamera` rate: default unchanged; higher rate converges faster.

## Verification bar

`npm run lint`, `vitest run`, `tsc -b`, `vite build` — all clean; manual
browser check of search-fly-blink on the globe (vite dev against stubs or
the running stack, whichever is free). Rebase onto latest `main` before
review — the deploy session may move it.
