# Globe mode — implementation log

**Date:** 2026-08-13 · **Branch:** `feat/globe-mode` · **Scope:** frontend only

The dream-tier item from `context/research/2026-08-13_engagement-motivators_research.md`:
a user-togglable globe mode — the same world map rendered as a d3 orthographic
globe with drag-to-rotate, and the replay camera rotating the globe to follow
the planes. The flat map remains the default and primary experience; globe is
strictly additive.

## What was built

- **`GlobeView.tsx`** (new): the globe canvas. Renders `ComposableMap` with a
  `geoOrthographic().clipAngle(90)` projection instance and owns everything
  ZoomableGroup used to own: pointer drag → rotation, pinch/wheel → zoom,
  rAF-throttled so the globe re-renders at most once per frame. Sphere = the
  ocean (same `mapColors` palette), plus a soft atmosphere ring and a faint
  30° graticule so open ocean still shows rotation. Overlays reused verbatim:
  `MapControlPanel` (with the new Globe switch), `MapLegend`,
  `MapZoomControls`, `ReplayControl`, `CountryTooltip`, the year chip.
- **`GlobeJourney.tsx`** (new): the replay journey on the globe — great-circle
  leg arcs, a contrail of the exact track flown so far, and the plane glyph
  (shared `PLANE_PATH`, now exported from `JourneyHighlight`).
- **`globeUtils.ts`** (new): camera types, the journey timeline (same per-leg
  `legFlightSeconds` + `STOP_PAUSE_SECONDS` clock as the flat replay), plane
  sampling with the flat map's altitude profile (climb to 30%, cruise,
  descend from 70%), horizon checks, and the camera chase easing.
- **`MapControlPanel.tsx`**: optional `globeMode`/`onGlobeModeChange` pair
  renders a Globe switch in the layers section. Omitting the handler (as the
  public shared map does) renders the panel exactly as before.
- **`TravelMap.tsx`**: owns the mode. `globeMode` state initialised from
  `localStorage` (`contrail:globe-mode`), persisted on toggle, tracked as
  `map_interact` kind `globe-on`/`globe-off` (kind only — no travel data).
  When on, it returns `<GlobeView …>` fed from the state it already owns
  (settings, filters, replay clock, replay orchestration: reveals, landing
  flashes, airport pops, year chips). When off, the flat return tree is
  byte-identical to before apart from the two toggle props on the panel —
  so switching modes never loses settings, filters or a running replay's
  bookkeeping.
- **`useMapViewport.ts`**: converted the ref from a RefObject captured once
  at mount to a callback ref tracked in state. This fixes a real bug the
  mode switch exposed: the ResizeObserver kept watching the unmounted
  container after a toggle, so resizes stopped landing — and with globe
  persisted on, the flat map would never have been measured at all. For a
  container that never changes (the only case before this feature) the
  behaviour is identical.

## Rotation approach

Lon/lat delta dragging, not versor: horizontal drag spins longitude,
vertical drag tilts latitude, φ clamped to ±90° so the world cannot go
upside down. Sensitivity is the classic `75 / scale` degrees-per-pixel, so
the ground tracks the finger at any zoom. Versor's advantage
(grab-a-point-and-hold-it near the poles) was judged not worth a new
dependency for v1; the drag feels natural everywhere people actually fly.
Pinch zooms (two-pointer distance ratio), wheel zooms exponentially via a
native non-passive listener (React's root wheel listener is passive, so
`preventDefault` in JSX props cannot stop page zoom).

## Camera-follow: continuous (the vision, not the fallback)

While a journey plays, a `requestAnimationFrame` loop samples the plane's
position on its great-circle track — same per-leg sqrt-distance seconds and
ground stops as the flat replay — and eases the camera toward it every frame
(exponential chase along the great circle via `geoInterpolate`, i.e. a slerp
without versor). Zoom eases toward a framing that fits the journey's longest
leg (~60° of arc across the 180° hemisphere, clamped 1.15–3). The camera
deliberately trails the plane slightly, which reads as a cameraman following
an aircraft rather than the plane being nailed to screen centre.

**Deliberate deviation from the flat map's SMIL plane:** the same rAF loop
drives the plane itself. SMIL `animateMotion` binds a clock to a screen-space
path computed once per journey — but on the globe the camera moves every
frame, so every path's `d` mutates every frame, and a SMIL clock bound to a
mutating motion path is exactly the class of undefined behaviour the flat
map's `begin="indefinite"` lesson warns about. Since the follow loop already
knows the plane's geographic position, drawing it there directly gives one
clock for camera and plane; they cannot drift apart. The flat map's SMIL
implementation is untouched.

## Horizon handling

- Countries, routes, contrail, graticule: clipped free by
  `clipAngle(90)` + `geoPath` (routes are GeoJSON LineStrings — never the
  flat map's screen-space `calculateArcPath`, which is wrong on a sphere).
- Point markers (airports, the plane): the raw orthographic projection maps
  the far hemisphere onto the same disk, so these are culled by great-circle
  distance from the camera centre (> 90° − ε → not rendered).

## Deferred to flat mode (v1)

All disabled cleanly — nothing renders an affordance it cannot honour:

- **Country tap-cycle and long-press card**: the globe's country layer is
  read-only (handlers omitted, so hover/pressed styling is off too).
  Hover name tooltips still work.
- **Search + fit-to-country framing**: search box not rendered in globe mode.
- **Route hover tooltips and tap-to-select a journey**: globe routes draw
  with pointer events off. The ambient selected-journey highlight is
  therefore flat-only.
- **Rotate/zoom during replay**: the follow loop owns the camera; drags are
  ignored while a replay runs (the flat map similarly withholds search and
  filters during replay).

## New dependencies

None. `d3-geo` (orthographic, geoPath, geoInterpolate, geoDistance) is
already in the tree via react-simple-maps and was already imported directly
by `CountriesLayer`. Neither `versor` nor `d3-interpolate` proved necessary:
`geoInterpolate` covers both the plane's track and the camera slerp.

Two typed shims against `@types/react-simple-maps` gaps, both commented in
`GlobeView.tsx`: `ZoomPanProvider` exists at runtime but not in the types
(needed so reused layers can read `useZoomPanContext()` with k=1 outside a
ZoomableGroup), and the `projection` prop's published type only admits a
factory although the runtime accepts a d3 projection instance directly.

## Verification

- `npm run build` ✓ (tsc + vite, clean)
- `npm run lint` ✓ (0 errors; 9 warnings, 8 pre-existing — the new one is
  the same `replay.current` exhaustive-deps pattern the flat map already
  carries twice, and correct for the same reason)
- Node-level smoke test: ZoomPanProvider/Sphere/Graticule runtime exports,
  camera-centre projection, horizon clipping of far-side LineStrings, sphere
  outline, zero-distance/normal geoInterpolate, horizon distance check — all
  pass.
- Not yet exercised in a browser session — the rotation *feel* (sensitivity
  constant, chase rate 3.2/s, zoom clamp 1–8) is tuned on paper and should
  be the first thing reviewed locally.

## Known trade-offs

- During drag and replay the whole 110m world re-projects each frame
  (react-simple-maps memoises paths on the projection, which changes per
  frame by design). Fine on a desktop; if a phone stutters, the lever is a
  coarser `.precision()` on the projection or throttling country re-paths.
- Replay zoom buttons technically remain pressable during replay but the
  chase loop re-eases zoom each frame (the flat map has the analogous quirk
  with its replay camera).
