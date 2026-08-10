# Research: Sharing (export image + public link + link previews)

Date: 2026-08-10

## Why

The retention loop for this product category (been-to maps, Polarsteps, Flighty) is showing
people. The app currently has none of it: no export, no share link, no public view, and a
pasted URL previews as nothing.

## Current state

- **No OG or Twitter tags.** After item 2, `index.html` has `<title>` and `<meta
  name="description">`, so a pasted link shows a bare title with no image or card.
- **No public route.** Since item 1, `App.tsx` puts everything except `/login` and
  `/register` behind `RequireAuth`, and every data endpoint is behind the global
  `JwtAuthGuard`. A share link therefore needs both a public API endpoint and a public route.
- **No export.** Nothing turns the map into an image.

## What the map actually is

`react-simple-maps` renders a real inline `<svg class="rsm-svg">` in the DOM:
- Geography paths come from a CDN TopoJSON but are already **rasterised into path elements**
  by the time they are in the DOM, so serialising the live SVG needs no network access.
- All fills and strokes are inline attributes (item 3 moved map colours to JS strings, which
  helps here — no `currentColor` or CSS-class-dependent fills to resolve).
- The only text is IATA labels on hovered airports, which are absent in a resting screenshot.

That makes `XMLSerializer` → `Image` → `<canvas>` → `toBlob` viable **without** any external
library (html2canvas, dom-to-image). Worth confirming: canvas is only tainted by external
raster images, and there are none.

## What a share payload may contain

`Visit` carries `notes`, and `FlightJourney` carries `notes`. These are private free text
("Trip to see Camp Nou", "Team building", "Warsaw and Quedlinburg" appear in the real data).
A public payload must exclude them. Country names, visit types and airport codes are the
point of the map and are fine.

## Constraint: dynamic link previews need a server

The frontend is a Vite SPA served as static files. Crawlers for Slack, iMessage, WhatsApp and
Twitter do not execute JavaScript, so per-user OG tags (`"Dilyan has been to 25 countries"`)
cannot be produced by React setting `document.title`. Options:

1. Static OG tags describing the app — works everywhere, same preview for every link.
2. Backend serves the HTML for `/share/:token` with injected tags — correct, but means the
   API starts serving HTML and needs the built frontend on hand.
3. Prerender/SSR — a build-system change.

Option 1 is what fits this pass; 2 is the natural follow-up.

## Existing pieces to reuse

- `components/FlightMap/FlightRoutes.tsx`, `AirportMarkers.tsx` — standalone, prop-driven,
  usable in a read-only map as-is.
- `components/TravelMap/countryColors.ts` — `buildCountryDisplayMap` maps visits to colours.
- `components/TravelMap/TravelMap.tsx` holds two things a second map would otherwise have to
  duplicate: the 250-line `numericToAlpha3` table and the `<Geographies>` render block.
  These should be extracted rather than copied.
- `routeUtils.aggregateRoutes` / `extractUniqueAirports` work off journeys and can run on the
  public payload if it keeps leg airport coordinates.
