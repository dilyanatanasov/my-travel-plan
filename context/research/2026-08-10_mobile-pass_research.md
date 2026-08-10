# Research: Mobile Pass

Date: 2026-08-10
Feature: Make the app usable on a phone

## Measured evidence (Playwright, iPhone-class viewport 390×844)

Taken against the running app before any changes.

### 1. The page scrolls sideways
```
document.documentElement.scrollWidth  = 426
document.documentElement.clientWidth  = 390
```
Single offending element:
```
BUTTON .px-6 py-4 text-sm font-medium border-b-2 …   right: 426px, width: 104px
```
That is the **Statistics** tab in `TravelMapPage.tsx:118-131` — a `flex` row of four
`px-6 py-4` buttons with no wrap and no scroll container. 36px of the page hangs off
the right edge, which also makes every other element feel misaligned.

### 2. Fifteen interactive controls below 40px tall
| Control | Size | Source |
|---|---|---|
| 3 layer checkboxes | 16×16 | `TravelMapControls.tsx:48,58,67` |
| 6 continent chips | 26px tall | `FlightMapFilters.tsx:114` |
| Home country select | 30px | `TravelMapControls.tsx:79` |
| 5 filter selects | 34px | `FlightMapFilters.tsx:78,97,132,149,167` |

Apple HIG and Material both put the minimum at 44px / 48dp.

### 3. ~570px of controls before any map
On a 844px-tall viewport the map's first pixel is below the fold. Order is:
app header → page header → layer toggles → home select → legend → stats line →
six filter widgets → *then* the map. The hero of the product is the last thing you reach.

### 4. The map is a thumbnail and a scroll trap
`TravelMap.tsx:251` — `className="w-full h-[500px]"` with `projectionConfig.scale: 147`.
At 390px wide the globe occupies a fraction of that box. Worse, `ZoomableGroup` binds
d3-zoom, which captures touch drag: a full-width map in the middle of a scrolling page
means a thumb-drag pans the map instead of scrolling the page, with no way to scroll past
it except from the very edges.

### 5. Text wrapping
- `Layout.tsx:14` "Search Flights" wraps to two lines at 390px (fixed during item 1).
- `FlightSearchPage.tsx:150` "Explore (Flexible Dates)" wraps to three lines and
  vertically de-aligns from its sibling tab.

### 6. Not installable, no identity
- `frontend/public/` is **empty**.
- `index.html:5` references `/vite.svg`, which does not exist → browsers show a default icon.
- No `manifest.webmanifest`, no `apple-touch-icon`, no `theme-color`.
- Logging a flight at the gate is the archetypal use case and it ships as a desktop web page.

## Duplication worth removing while here

- Two headers stack: `Layout.tsx:9` ("Travel Tracker / Track your journeys around the world")
  then `TravelMapPage.tsx:103` ("Travel Map / Track your countries, flights, and adventures
  around the world"). ~150px of vertical space for the same statement twice.
- Overview tab shows "Countries Visited 25" and "Total Countries 25" — the same number.

## Dead code to delete

- `frontend/src/pages/HomePage.tsx` — not referenced by `App.tsx` since the unified map landed.
- `frontend/src/components/WorldMap/` — superseded by `TravelMap/`; only `HomePage` imported it.

Confirmed by grep: `WorldMap` is imported solely by `HomePage.tsx`, which nothing imports.

## Constraints

- Tailwind config has no custom breakpoints — defaults apply (`sm` 640, `md` 768, `lg` 1024).
- No component library; everything is hand-rolled Tailwind. A disclosure/sheet must be built.
- `react-simple-maps` `ZoomableGroup` has no built-in "require gesture to activate" option,
  so the scroll trap needs handling at the container level.
- The design-token work is roadmap item 3, so this pass should not invent a new palette —
  it should restructure layout and sizing only, to keep the two changes reviewable apart.
