# Research: Map-First App Shell

Date: 2026-08-10

## The two complaints

1. **"Hidden parts you have to scroll to see."** After items 2–5 the page is still a scrolling
   document: header → map card → tab bar → tab content. The tab content (country list, flight
   list, stats) lives *below the fold on every screen size*. Adding a country in the Countries
   tab fills that country in on a map that is scrolled off screen, so the core feedback loop
   is invisible at the moment it happens.
2. **"The map zooms when my cursor is on top and I scroll."** Reproduced. `ZoomableGroup`
   binds d3-zoom, which captures `wheel`. The tap-to-activate scrim added in item 2 is gated
   on `pointer: coarse`, so it only ever protected touch devices — desktop wheel-over-map was
   never covered. This is a daily annoyance, not an edge case.

## Key finding: the second problem is caused by the first

Wheel-over-map only *steals* something if there is a page scroll to steal. In a fixed shell
where the map is a canvas and only panels scroll, zooming on wheel is the correct and
expected behaviour — that is how every map application works.

So the layout change removes the bug at the root, and lets the `isCoarsePointer` scrim in
`TravelMap.tsx` be **deleted** rather than joined by a second workaround for mouse users.

## Library capability

`ZoomableGroupProps` exposes `filterZoomEvent`, `zoom`, `center`, `minZoom`, `maxZoom`,
`onMoveEnd`.

`@types/react-simple-maps` types it as `(element: SVGElement) => boolean`, which is **wrong**.
The runtime (`dist/index.js:745`) calls `filterZoomEvent(d3Event)`. So a cast is required, and
the parameter is a real DOM event with `type`, `ctrlKey`, `metaKey`. This gives full control
if plain-wheel zoom ever needs suppressing again.

Controlled `zoom` + `onMoveEnd` allows explicit +/− buttons, which touch users and keyboard
users need since pinch is undiscoverable and unreachable respectively.

## What can and cannot live in a side panel

Measured from the current tab contents:

| Section | Content | Panel-suitable? |
|---|---|---|
| Overview | 4 stat tiles + a hint line | Yes |
| Countries | `CountrySelector` + `CountryList` (25 rows) | Yes — a list is exactly panel-shaped |
| Flights | `FlightForm` + `FlightList` (41 journeys in 10 year groups) | Yes |
| Statistics | 4 stat cards, gradient Fun Facts block, longest/shortest flight, strongest year and month, 5 airport chips, 25 country chips | **No.** This is a dashboard, roughly 1,400px tall at full width. In a 400px rail it becomes a column of wrapped text |

Flight search is already its own full page and stays that way.

## Shell constraints

- **`100vh` is wrong on mobile.** iOS Safari's URL bar makes `100vh` taller than the visible
  viewport, so a fixed shell would push its own bottom bar off screen. Needs `100dvh` with a
  `100vh` fallback.
- **Overscroll.** A fixed shell still gets pull-to-refresh and rubber-banding unless
  `overscroll-behavior: none` is set.
- `index.css` currently sets `body { min-height: 100vh; overflow-x: hidden }` and
  `#root { min-height: 100vh }` — both assume a scrolling document and need revisiting.
- `Layout.tsx` is the shared header (Search Flights, Share, Account) and renders `<Outlet/>`.
  Making it the flex column shell keeps those menus in one place.
- The map currently sizes itself with `aspect-[4/3] md:aspect-[2/1]` plus a matching viewBox
  from `useMapViewport`. In a shell the map must fill *available space* instead, so the
  viewBox has to follow the measured container rather than a fixed breakpoint pair.

## Existing pieces that survive unchanged

`MapControlPanel` (layers/filters/legend) is map chrome and belongs with the canvas, not the
section nav. `CountriesLayer`, `FlightRoutes`, `AirportMarkers`, `useVisitActions`,
`ToastProvider` are all prop-driven and reusable as-is.
