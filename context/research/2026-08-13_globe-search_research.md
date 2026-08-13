# Globe-mode search — Research

**Date:** 2026-08-13 (late). The user searched in globe mode, found nothing,
and asked whether the flat/globe discrepancy can be removed. Answer: **yes,
and cheaply — every hard primitive already exists.** Written by a fourth
session in the main checkout; read-only, no code touched (consolidation pass
was mid-M2 in the same checkout at the time).

## Why search is missing today

Globe mode is an early return: `TravelMap.tsx:902` hands the whole render to
`GlobeView`, a sibling tree that rebuilds the top-left control column with
only `MapControlPanel`. The omission is deliberate and documented at
`GlobeView.tsx:697`:

> Same berth as the flat map's control column. Search is absent by design:
> fit-to-country framing is deferred to flat mode for v1.

So the missing piece was never the search box — it is the *camera landing*:
fly the globe to a country and frame it by its size.

## Why it is feasible now

1. **The search box is already portable.** `MapSearch` is self-contained:
   `countries`, `countryCentroids`, `onGo(target: SearchTarget)`. It knows
   nothing about projections. GlobeView already receives everything needed to
   supply those props; the berth in the control column is sitting there.
2. **The camera fly-to exists and is now test-pinned.** `chaseCamera()` in
   `globeUtils.ts` slerps the camera along the great circle toward any
   lon/lat with frame-rate-independent zoom easing — it is what the replay
   flies on, and consolidation M2b (`d23c156`) put unit tests on it.
   A one-shot search flight is a rAF loop driving `chaseCamera` at a fixed
   target until within epsilon, cancelled by pointer-down (the drag guards
   and raf-batched camera writes already exist for exactly this fight) and
   suppressed during replay (search is already withheld during replay on the
   flat map; same rule).
   Antipodal targets: `chaseCamera` already snaps rather than NaN-ing.
   Dateline: a non-issue on a sphere — this is *easier* than flat.
3. **Fit-to-country framing is one formula, not a subsystem.** Flat mode uses
   `fitToPoints` on the country's bounding box (flat zoom units — not
   portable). The globe equivalent is the trick `buildJourneyTimeline`
   already uses for legs: angular extent of the bbox via `geoDistance`,
   framed at ~a third of the hemisphere — `clampGlobeZoom(60 / extentDeg)`
   with the same clamps (min ~1.15 so Russia never zooms *out* past the
   globe, max ~7 so Malta never slams into the ground). Airports are points:
   fixed zoom ≈ 5.
4. **Landing feedback has existing pathways.** Flat search blinks the found
   country and pings searched airports. The globe already highlights a
   country via the replay's landed-pop treatment (`landedIsoCode` →
   country-paths layer), so the blink reuses that styling with a timer.
   An airport ping must gate on `isOnVisibleSide()` (utility exists) or it
   renders mirrored from the hidden hemisphere — the one genuine globe-only
   subtlety, and it is a one-line guard.

## The one product decision

Flat search also opens `CountryDetailCard` on landing. The globe renders no
card at all — it is non-interactive by design for v1 (no tap-to-select).
Options:

- **v1 (recommended): fly + zoom-to-fit + blink, no card.** Full parity on
  "take me there and show me which shape it is"; the card stays a flat-mode
  affordance until globe interactivity is designed as its own thing.
- v2: render the card overlay in GlobeView too (it is screen-space, nothing
  projection-dependent) — trivially possible, but it would be the globe's
  first interactive object and deserves the same thought taps got.

## Sequencing — this must not land mid-consolidation

`TravelMap/**` is A's territory and the consolidation pass is actively
reshaping the exact seam this feature builds on:

- **M4 step 2 extracts `useSearchLanding`** (search-go handler + blink/ping
  state) out of TravelMap. Building globe search *before* that lands means
  writing the code M4 is about to move. Build it **after M4**, ideally
  consuming the extracted hook so flat and globe share one landing brain.
- The new pieces slot into the consolidation's own patterns: the framing
  formula (`globeZoomForExtent` or similar) belongs in `globeUtils.ts`
  next to `chaseCamera`, with tests in the M2b style; the fly-to loop
  mirrors the replay follow loop GlobeView already runs.

**Estimate:** ~half a day including tests, once M4 has landed. New code is
roughly: one pure framing helper (+tests), one ~40-line fly-to effect in
GlobeView, the `MapSearch` mount in the existing column, one blink state
reusing pop styling, one visible-side guard on the ping.

## Open decisions

- G1 Landing affordance: fly + blink only for v1 (recommended) vs also
  rendering CountryDetailCard on the globe.
- G2 Owner: A (owns TravelMap/GlobeView and is mid-refactor there —
  recommended) vs this session after M4 merges.
