# Research: Design Tokens & Palette

Date: 2026-08-10

## Current state

`frontend/tailwind.config.js` is `theme: { extend: {} }` — **completely empty**. There are
no design tokens of any kind. Every colour in the app is a raw Tailwind default chosen
ad hoc at the call site.

### Blue carries five unrelated meanings
| Usage | Location |
|---|---|
| Primary action | `Layout.tsx` Search Flights, all submit buttons |
| Active tab | `TravelMapPage.tsx` |
| Flight route on the map | `FlightRoutes.tsx`, legend |
| "Came from a flight" badge | `CountryList.tsx:114` |
| A stat card accent | `TravelMapPage.tsx` overview |

Purple similarly means both "home country" (a map semantic) and "a stat card colour".
Nothing tells the user that map-blue and button-blue are unrelated.

### The overview cards use four unrelated hues
Green / orange / blue / purple side by side, with no hierarchy. This is the single strongest
"hobby project" signal in the UI — a designed product would use one accent plus neutrals,
and reserve hue for the map's semantics.

### Grey on grey on grey
| Surface | Value |
|---|---|
| Page background | `#f9fafb` (`bg-gray-50`) |
| Card background | `#ffffff` |
| Body background | `#f3f4f6` hardcoded in `index.css` |
| Unvisited country | `#d1d5db` |
| Map "ocean" | transparent → shows the white card |

Land, ocean and page all read as the same non-colour. Visited countries have to do all the
work of making the map legible.

### Colourblind exposure
- Airport markers are red (`#ef4444`-family) drawn **on top of** green visited countries
  (`#22c55e`). Red/green is the most common confusion (deuteranomaly, ~8% of men).
- The three visit types are separated by **hue only**: green / orange / violet. Green vs
  orange is also a common confusion pair. Converted to greyscale, `#22c55e` (L≈73) and
  `#f59e0b` (L≈70) are nearly identical — they would be genuinely indistinguishable.

### No dark mode
`index.css` hardcodes `background-color: #f3f4f6` on `body`, so even the groundwork is absent.

## Where colours are actually defined

- `components/TravelMap/countryColors.ts` — the only file that already treats colour as data
  (`COUNTRY_COLORS`, `_HOVER`, `_PRESSED`). Good structure to build on.
- `components/FlightMap/FlightRoutes.tsx`, `AirportMarkers.tsx` — inline colour values.
- Everything else — Tailwind utility classes inline.

## Constraints

- Tailwind 3.4. CSS custom properties in the config work via the `<alpha-value>` placeholder
  for opacity utilities to keep working.
- `react-simple-maps` takes colours as JS strings, not classes, so map semantics must be
  readable from JS — a CSS-variable-only approach would not reach them without
  `getComputedStyle`. The tokens therefore need a JS-importable source of truth as well.
- Items 1 and 2 already shipped; this pass should not change layout, only colour, so the
  diff stays reviewable.
