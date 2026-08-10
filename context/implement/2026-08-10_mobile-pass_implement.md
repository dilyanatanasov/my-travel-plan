# Implementation: Mobile Pass

Date: 2026-08-10
Plan: `context/plan/2026-08-10_mobile-pass_plan.md`
Branch: `feat/user-accounts-auth`
Status: **Complete and verified**

## Before / after (measured, iPhone-class 390×844)

| Metric | Before | After |
|---|---|---|
| Document width vs viewport | 426 / 390 — **scrolled sideways** | 375 / 375 — no overflow |
| Interactive elements under 44px | **15** | **0** |
| Chrome above the map | ~570px | ~215px |
| Map letterboxing | 351×506 box holding a 351×263 map | 351×263, fills exactly |
| Full overview page height | ~1800px | ~900px |
| Installable / has an icon | No | Yes |

At 320px: no overflow, all four tabs reachable. Desktop 1440px: chrome down from
~490px to ~350px and the map is now genuinely large rather than a centred thumbnail.

## What changed

| File | Change |
|---|---|
| `components/TravelMap/MapControlPanel.tsx` | **New.** Merges the old `TravelMapControls` + `FlightMapFilters` into one disclosure with an active-filter badge. Closed by default below `md`, open at `md+`. Legend and stats stay outside the disclosure — they explain the map rather than control it. |
| `components/TravelMap/useMapViewport.ts` | **New.** Responsive projection scale plus viewBox dimensions, and coarse-pointer detection. |
| `components/TravelMap/TravelMap.tsx` | Uses the new panel; responsive `aspect-[4/3] md:aspect-[2/1]`; touch scroll-trap scrim. |
| `pages/TravelMapPage.tsx` | Tab bar scrolls horizontally instead of overflowing the page; removed the duplicate page header; "Total Countries" → "% of the world". |
| `components/Layout/Layout.tsx` | Header targets at 44px; "Search Flights" label hides below `sm` so it stops wrapping. |
| `pages/FlightSearchPage.tsx` | "Explore (Flexible Dates)" → "Explore" + `hidden sm:inline` suffix. |
| `index.css` | `overflow-x: hidden` guard; `.scrollbar-none` utility. |
| `index.html` | Real title + description, favicon, apple-touch-icon, manifest, theme-color, `viewport-fit=cover`. |
| `public/*` | **New.** `favicon.svg`, `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `apple-touch-icon.png`, `manifest.webmanifest`. |
| `vite.config.ts` | `server.watch.usePolling` — see below. |

### Deleted (all dead code, nothing referenced them)
`pages/HomePage.tsx`, `pages/FlightsPage.tsx`, `components/WorldMap/`,
`components/FlightMap/FlightMap.tsx`, `components/TravelMap/TravelMapControls.tsx`,
`components/FlightMap/FlightMapFilters.tsx`. Barrel files updated.

`FlightsPage` was unrouted and was the only consumer of `FlightMap`, which in turn was the
only consumer of `FlightMapFilters` — the whole chain was unreachable. The shared primitives
in `components/FlightMap/` (`FlightRoutes`, `AirportMarkers`, `RouteTooltip`, `routeUtils`,
`filterUtils`, `continentUtils`, `filterTypes`) are still used by `TravelMap` and stay.

## Problems hit, and the fixes

1. **HMR was silently serving stale modules.** Several edits appeared to have no effect;
   the DOM still carried the previous build's class names. Cause: filesystem events do not
   cross a Windows Docker bind mount, so Vite's watcher never fired. Fixed properly with
   `server.watch.usePolling` in `vite.config.ts` rather than restarting the container each
   time. **This was pre-existing and affected all frontend work in this repo.**
2. **New files in `public/` 404 until Vite restarts.** Vite resolves `publicDir` at boot;
   the directory did not exist before this change. One restart was needed. Not a recurring issue.
3. **`aspect-ratio` was being ignored on the map.** `ComposableMap` emits `width`/`height`
   attributes, and CSS `aspect-ratio` only applies when the used height is `auto`. Adding
   `h-auto` fixed it. This was the actual cause of the map floating in white space — the
   container aspect and the SVG viewBox disagreed, so `preserveAspectRatio` letterboxed it.
4. **First attempt made desktop worse.** The open panel was taller than the two bars it
   replaced (`sm:grid-cols-1` stacked the layer toggles vertically, and 5 filters in a
   4-column grid wrapped). Fixed with `sm:grid-cols-3` for toggles and `lg:grid-cols-5`
   for filters, plus tighter spacing.
5. **Icon generation without a build dependency.** No `sharp` and no compiler in the
   container. Rasterised the SVG by rendering it in the already-running Playwright browser
   at each target size, rather than adding a dependency used once.

## Notes

- The three layer checkboxes still measure 16px as *elements*; their hit area is the
  wrapping `<label>`, verified at exactly 44px. This is deliberate — a 44px checkbox
  graphic looks wrong, a 44px touch target does not.
- The disclosure's open/closed default is evaluated once on mount, not on resize. Re-deriving
  it from width would fight the user's own toggling when a phone rotates.
- Colour choices were deliberately left alone; that is roadmap item 3, kept separate so the
  layout change stays reviewable on its own.
