# Plan: Mobile Pass

Date: 2026-08-10
Research: `context/research/2026-08-10_mobile-pass_research.md`

## Decision note

The user approved the whole roadmap and is away, so the choices below were made
autonomously using the stated goal ("something people actually want to use") as the
tiebreaker. Each records the alternative rejected, so any of them is easy to revisit.

| Decision | Chosen | Rejected |
|---|---|---|
| Tab overflow | Horizontal scroll strip with snap, shrunk padding | Wrap to 2×2 grid (wastes vertical space, reorders on resize); dropdown (hides navigation) |
| Map controls | One collapsible panel, closed on mobile / open on `md+`, with an active-filter count | Bottom sheet (heavier to build, needs focus trap); always-visible (the current problem) |
| Map scroll trap | Tap/click-to-activate overlay on touch viewports | Disabling zoom entirely (removes the main map interaction); gesture heuristics (unreliable) |
| Map size | `h-[60vh]` on mobile, `h-[600px]` on desktop, projection scale responsive | Fixed taller box (bad on landscape phones) |
| Headers | Drop the page header; keep the app header only | Drop the app header (loses nav + account menu) |
| Icons | Generated SVG + PNG set, committed to `public/` | External icon service (CSP/offline issues) |

## Changes

### 1. Kill the horizontal scroll — `TravelMapPage.tsx`
Tab bar becomes `overflow-x-auto` with `scrollbar-none`, `whitespace-nowrap`,
`snap-x`, and `px-4 md:px-6` buttons at `min-h-11`. The container gets `-mx-*`
compensation so the strip bleeds to the card edge instead of clipping mid-word.

Acceptance: `scrollWidth === clientWidth` at 390, 360 and 320px.

### 2. Touch targets ≥44px
- Checkboxes: keep the 16px input but wrap each in a `min-h-11` label with padding,
  so the *hit area* is 44px even though the box stays visually small.
- Continent chips: `min-h-11 px-3`.
- All selects: `min-h-11`, `text-base` (16px prevents iOS zoom-on-focus).

### 3. Collapse the control chrome — new `MapControlPanel`
Merge `TravelMapControls` + `FlightMapFilters` behind one disclosure:
- Header row: "Map layers & filters" + a badge with the active filter count + chevron.
- `open` defaults to `false` below `md`, `true` at `md+` (evaluated once on mount).
- Legend stays **always visible** — it explains the map's colors and is not a control.
- Stats line moves next to the legend.

Result on mobile: roughly 570px of chrome becomes about 120px.

### 4. Map sizing and the scroll trap — `TravelMap.tsx`
- Height `h-[60vh] min-h-[320px] md:h-[600px]`.
- Projection scale from a `useMediaQuery`-ish resize listener: ~120 on mobile, 147 desktop.
- Touch-only overlay: on coarse pointers the map starts inert with a
  "Tap to interact with map" scrim. Tapping arms it; scrolling past is then normal.
  Pointer-fine devices never see the overlay.

### 5. Remove duplicate header — `TravelMapPage.tsx`
Delete the "Travel Map / Track your countries…" block. The app header already says it.

### 6. Fix the overview stat duplication — `TravelMapPage.tsx`
Replace "Total Countries" (identical to "Countries Visited") with **% of world**
(`visited / total countries`), which is the number people actually want.

### 7. PWA identity — `frontend/public/` + `index.html`
- `favicon.svg` (globe mark matching the auth screen), `apple-touch-icon.png`,
  `icon-192.png`, `icon-512.png`, `manifest.webmanifest`.
- `<meta name="theme-color">`, `<meta name="description">`, proper `<title>`.
- OG/Twitter tags are **item 4**, not here.

### 8. Search page tab labels — `FlightSearchPage.tsx`
"Explore (Flexible Dates)" → "Explore" + a `hidden sm:inline` "(Flexible Dates)".

### 9. Delete dead code
`pages/HomePage.tsx`, `components/WorldMap/`.

## Verification

Playwright at 390×844, 360×740, 768×1024 and 1440×900:
1. `scrollWidth === clientWidth` at every width.
2. Zero interactive elements under 44px tall.
3. Map's top edge visible without scrolling on a 844px viewport.
4. Tabs reachable and operable at 320px.
5. Desktop layout not regressed.
6. `tsc --noEmit` clean; manifest served with 200.
