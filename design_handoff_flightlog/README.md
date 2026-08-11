# Handoff: Flightlog mobile app (5 screens)

## Overview
Flightlog is the mobile companion to the `my-travel-plan` app (repo: dilyanatanasov/my-travel-plan, branch main).
It lets a traveller log flights, see everywhere they have been on a world map, read insights about their
flying, run a flexible-date flight search, and export a shareable image of their map.

Five screens, one bottom tab bar: **Map · Flights · Stats · Search · Share**.

## About the design files
The files in this bundle are **design references created in HTML** — prototypes that show the intended
look and behaviour. They are not production code to copy. The task is to **recreate these designs in the
target codebase's environment** (this repo: React 18 + Vite + TypeScript + Tailwind + Redux Toolkit
Query) using its existing patterns: RTK Query hooks in `features/*`, presentational components under
`components/*`, pages under `pages/*`. For the mobile shell, either responsive breakpoints on the
existing React app or a React Native/Expo port — the layout is authored at 390×844.

## Fidelity
**High fidelity.** Colors, typography, spacing, radii and copy below are final. Recreate pixel-accurately
using the Organic design tokens (bundled as `organic-tokens.css`).

## Design tokens (Organic design system)
Take every value from these variables; do not hard-code new hexes.

Color
- ground `--color-bg` #f5ead8 · surface `--color-surface` #ebddc5 · text `--color-text` #201e1d
- accent (terracotta) `--color-accent` #c67139 · second accent (sage) `--color-accent-2` #7a8a5e
- neutral ramp 100–900: #f9f4ed #eee7db #dcd3c4 #c0b6a5 #a19786 #82796a #645c50 #474238 #2e2b25
- accent ramp 100–900: #fff2eb #ffe1d0 #ffc6a5 #f6a06b #d67f48 #b2622d #8c491a #643312 #402310
- accent-2 ramp 100–900: #f0fae1 #e1eecc #ccdbb2 #aebf92 #8fa073 #728157 #56633f #3d472b #272e1b
- card surface used throughout the app: neutral-100 #f9f4ed on the #f5ead8 ground

Type
- headings: Caprasimo 400 (`--font-heading`). Screen titles 29px/1.08, card numbers 22–26px, hero 34–44px.
- body: Figtree 400/600/700/800 (`--font-body`). Body 13–14px, meta 12–12.5px, labels 11.5px 600
  uppercase letter-spacing .03em, tab labels 10.5px.
- airport codes and routes are monospace 700 (ui-monospace/Menlo), 15–20px.

Spacing / radius / elevation
- space scale: 4.4 / 8.8 / 13.2 / 17.6 / 26.4 / 35.2px. Screen side padding 22px, card gutter 16px.
- radius: sm 8 · md 16 · lg 28. Cards 22–24px, map card 28px, all buttons and inputs 999px.
- shadow-sm `0 1px 2px rgba(46,43,37,.14)` · shadow-md `0 3px 10px rgba(46,43,37,.16)` ·
  shadow-lg `0 12px 32px rgba(46,43,37,.22)`
- icons: Lucide, stroke-width 2.75. The prototype uses geometric placeholder glyphs in the tab bar —
  replace with Lucide `map`, `plane`, `bar-chart-3`, `search`, `share-2`.

## Shell
- Device canvas 390×844, radius 42, ground #f5ead8.
- Status bar 52px, transparent, overlaying content (content top padding 60px).
- Scroll region: `flex:1; overflow-y:auto`, bottom padding 104px to clear the tab bar.
- Tab bar: absolute bottom, background rgba(249,244,237,.94), 1px top border rgba(32,30,29,.10),
  padding 10px 8px 22px, 5 items `space-around`. Inactive label color neutral-600 #82796a weight 600;
  active accent-600 #b2622d weight 700. Icon 18px above a 10.5px label, gap 6px.

## Screens

### 1. Map — "Where you've been"
Purpose: see every visited country and every flown route at a glance.
- Title 29px Caprasimo, subline 13.5px neutral-700: "21 countries · 34 flights · 214,860 km".
- Filter chips (horizontal scroll, gap 8): Everything / Flights only / Countries only.
  Chip inactive: 9px 14px, radius 999, 1.5px border #dcd3c4, transparent bg, 13px 600 #474238.
  Chip active: accent fill #c67139, white text, same border color as fill.
- Map card: margin 0 16px, radius 28, background #ebddc5, shadow-sm, height 320, overflow hidden.
  Geometry is real: Natural Earth world-atlas 110m TopoJSON rendered with d3-geo
  (`d3.geoNaturalEarth1()` fitted to the card) — see `world-map.js`. Visited countries #f6a06b,
  other land #e3d5bd, country stroke rgba(32,30,29,.13) 0.6px, routes are great-circle paths
  #b2622d 1.4px round caps, airport dots r 2.6 #8c491a with a 1px white ring.
  Filters: "Flights only" clears the visited fill; "Countries only" clears routes and dots.
  Legend pills bottom-left, rgba(249,244,237,.9), radius 999, 11px 600: Visited swatch, Route dash.
- Stat tiles: 3-column grid, gap 10, bg #f9f4ed, radius 20, padding 14/16.
  "34 flights logged" · "29 airports touched" · "5.4× around the Earth" (number 24px Caprasimo,
  label 11px/1.3 neutral-700).
- "Latest" row: 15px 700 heading with a text button "All flights" (13px 600 accent-700 #8c491a) that
  navigates to the Flights tab; one card bg #f9f4ed radius 22 padding 15/16 with route
  "SOF → AMS → KEF" (mono 700 17px) and meta "12 Jun 2026 · 4,720 km · 2 flights" (12.5px neutral-700).

### 2. Flights
Purpose: browse and add logged journeys.
- Title "Flights", subline "{n} journeys · newest first".
- Year chips: All years / 2026 / 2025 / 2024 (same chip styling as Map). Filters on `journeyDate` year.
- Journey cards (`FlightJourney`): bg #f9f4ed, radius 24, padding 16/18, gap 8, shadow-sm.
  Route = leg chain joined with " → " in mono 700 17px. If `isRoundTrip`, a tag "ROUND TRIP"
  (padding 3px 9px, radius 999, bg accent-2-200 #e1eecc, color accent-2-800 #3d472b, 10.5px 700).
  Meta line 12.5px neutral-700: "{date, e.g. 12 Jun 2026} · {km with thousands separator} km ·
  {legCount} flight(s)". Notes, if present, 13px/1.45 #474238.
- FAB: bottom-right, 18px from the right, 118px from the bottom. Pill 14px 20px, accent fill,
  white 14.5px 700, shadow-md, hover #b2622d. Label "Add flight".

### 3. Add-flight sheet (modal over Flights)
- Backdrop rgba(32,30,29,.42), tap to dismiss; sheet bg #f9f4ed, radius 34 top / 42 bottom,
  padding 20/22/28, gap 16, 44×5 grab handle #dcd3c4 centered.
- Title "Add a flight" 23px Caprasimo.
- Route builder (mirrors `FlightForm/RouteBuilder`): a well (bg #eee7db, radius 22, padding 12,
  min-height 56) holding the current stop chain as white pills (mono 700 14px, radius 999, shadow-sm);
  hint text "add the next airport" (13px #82796a) while fewer than two stops.
  Below it quick-pick outline pills: AMS IST LHR CDG ATH OTP DXB JFK — hover bg #ffe1d0,
  border #f6a06b — plus a ghost "Clear" (13px 600 accent-700) that resets to the home airport (SOF).
- Date input (native date) radius 999, 1.5px #dcd3c4, white bg, 14px; "Round trip" toggle uses the
  chip on/off styling.
- Primary "Save flight": full width, padding 16, accent fill, white 15.5px 700, hover #b2622d.
- On save: needs ≥2 stops; distance per leg computed with the haversine formula (R = 6371 km),
  doubled when round trip; the journey is prepended to the list, the sheet closes, the year filter
  resets to "All years", and the app lands on the Flights tab. In production this is
  `POST /flights` with `CreateFlightDto { airportIds, journeyDate, isRoundTrip, notes }` — the
  backend already computes `distanceKm` per leg, so drop the client-side haversine.

### 4. Stats — "Your year in air"
Purpose: the insight layer, from `FlightStats`.
- Two cards (2-col grid, gap 10, bg #f9f4ed, radius 22, padding 16): "DISTANCE / 214,860 / km flown"
  and "TIME ALOFT / ~268 h / 11 days in the sky". Kicker 11.5px 600 uppercase neutral-700,
  number 26px Caprasimo, sub 12px neutral-700.
- Fun facts block: margin 0 16px, radius 28, padding 20, bg sage #7a8a5e, text #f0fae1. Three rows
  (label 13px opacity .85, value 18px 800) split by 1px rgba(240,250,225,.25) rules:
  "Of the way to the Moon 0.06%" · "If you had walked it 5.4 years" · "Times around the Earth 5.36×".
  Maps to `moonDistancePercent`, `walkingYears`, `earthCircumferences`.
- "Flights by year" bar chart: 5 bars, flex end-aligned, height box 132, gap 10, radius 12/12/6/6.
  Heights 38/56/74/92/110 for '22–'26; fills #ffc6a5 #ffc6a5 #f6a06b #d67f48 #b2622d. Year label
  11px neutral-700, active year 700. Caption 12.5px: "2026 is your strongest year: 11 flights, 62,400 km."
  (`byYear`, `strongestYear`).
- Records: two cards — "LONGEST / VAR → BKK / Varna to Bangkok / 8,240 km" (value accent-700 #8c491a)
  and "SHORTEST / SOF → OTP / Sofia to Bucharest / 294 km" (value accent-2-700 #56633f).
- "Most visited airports": wrapping pills bg #eee7db, radius 999, padding 8/12, 12.5px —
  mono IATA + grey city + accent-700 count. SOF Sofia 18× · IST İstanbul 9× · AMS Amsterdam 6× ·
  VAR Varna 5× (`mostVisitedAirports`).

### 5. Search — "Smart search"
Purpose: flexible-date exploration (`FlexibleSearchDto` → `FlightExplorationResultDto`).
- Panel: margin 0 16px, bg #f9f4ed, radius 28, padding 18, gap 14.
  From / To inputs side by side: label 11.5px 600 uppercase, input radius 999, 1.5px #dcd3c4,
  white, mono 700 15px, value upper-cased on change. Defaults SOF → LIS.
- "When" segmented control (`dateType`): track bg #eee7db, radius 999, padding 4; options
  Exact / Month / Range / Weekends. Active option: bg #f9f4ed, shadow-sm, 700; inactive 600 neutral-700.
- Summary row: left = the human-readable window ("Anywhere in March 2027" for Month,
  "14 March 2027, return 19 March" for Exact, "1 March – 12 April 2027" for Range,
  "Weekends only, next 3 months" for Weekends), right = "5–9 nights" (`minNights`/`maxNights`).
- Primary CTA full width accent pill: "Explore 128 options", becomes "Search again" once run.
- Results (revealed after search):
  - "Price across March" — 8 bars, box height 84, gap 5, radius 8, heights 44/62/30/52/70/84/56/38;
    the cheapest bar is sage #7a8a5e, the peak #f6a06b, the rest #ffc6a5. Axis row 11px:
    "2 Mar · Cheapest: 9–14 Mar · 30 Mar" (`priceTrend`).
  - Recommended card: radius 28, padding 18, bg accent-900 #402310, text #ffe1d0. Badge "RECOMMENDED"
    (bg #f6a06b, color #402310, 10.5px 800) + "score 92". Route "SOF → LIS" mono 700 20px white,
    detail "9–14 Mar · 5 nights · 1 stop in VIE · 6 h 45 m", price €212 in 30px Caprasimo white,
    light button "Open deal" (bg #f5ead8, text #201e1d, radius 999).
  - Two comparison cards bg #f9f4ed radius 24: CHEAPEST tag (sage tint) "SOF → IST → LIS,
    11–16 Mar · 9 h 20 m · long layover, €178"; FASTEST tag (accent tint #ffe1d0/#8c491a)
    "SOF → LIS, 20–25 Mar · 4 h 55 m · direct, €341" (`highlights.cheapest`/`.fastest`).
  - Insight strip: radius 22, bg accent-2-100 #f0fae1, text #3d472b 13px/1.5 —
    "Shifting two days earlier saves €34 and one stop. Prices for this route have been falling for
    three weeks." (`insights[]`).

### 6. Share — "Share your map"
Purpose: export a social image. Subline: "Three directions — pick one, it exports 1080×1350".
Three style chips (Warm / Ink / Editorial) switch the card; the export target is 1080×1350.
- **Warm** — bg #f5ead8, radius 28, shadow-lg, padding 22. Mono kicker "2026 · FLIGHTLOG"
  (10.5px 600, letter-spacing .12em, accent-700), headline "21 countries and counting" 34px/1 Caprasimo,
  map (visited #d67f48, land #e3d5bd, arcs #8c491a, dots #402310) in a 22px-radius 190px block,
  then three figures: 214,860 km · 34 flights · 5.4× the Earth.
- **Ink** — bg #201e1d, text #f9f4ed. Kicker "FLIGHTLOG" accent-400 #f6a06b + a 26px accent circle.
  Map 230px on #2e2b25 (land #3a352d, visited #8c491a, arcs #f6a06b, dots #ffc6a5, stroke
  rgba(249,244,237,.10)). Big number 214,860 at 44px/.95 Caprasimo white over
  "KILOMETRES · 21 COUNTRIES · 29 AIRPORTS" 12.5px letter-spacing .05em #c0b6a5.
- **Editorial** — bg #f9f4ed, full-bleed sage map band 210px (land #8fa073, visited #f0fae1,
  arcs #402310, dots #201e1d), then padding 20/22/24: headline "Six years, five continents"
  26px/1.05 Caprasimo, a 1px rgba(32,30,29,.16) rule, and a 2×2 fact grid
  (34 flights logged · 268 h time aloft · VAR → BKK longest hop · 2026 busiest year).
- Actions: "Save image" (accent fill pill, flex 1) and "Story" (outline pill, 1.5px #c67139,
  text accent-700, hover bg #ffe1d0).

## Interactions & behaviour
- Tab bar switches screens and closes any open sheet.
- Map filter chips, year chips, date-type segments and share-style chips are single-select; the active
  state is the accent fill (chips) or raised light pill (segments).
- Add-flight sheet: backdrop click closes, sheet click does not propagate; quick-pick appends a stop;
  Clear resets to `['SOF']`; Save validates ≥2 stops, computes distance, prepends, navigates.
- Search CTA reveals the result block and relabels itself.
- Every interactive element needs a hover tint (accent-600 #b2622d on filled, #ffe1d0 on outline/ghost)
  and `:focus-visible { outline: 2px solid #c67139; outline-offset: 2px }`. No browser-default focus rings.
- No entry/exit animation is specified in the prototype; when implementing, a 200–250ms ease-out
  translateY for the sheet and a 150ms cross-fade between tabs match the system's soft feel.

## State
`screen` ('map'|'flights'|'stats'|'search'|'share') · `mapFilter` ('all'|'flights'|'countries') ·
`year` ('all'|'2026'|'2025'|'2024') · `journeys` (FlightJourney[]) · `sheetOpen` · `stops` (IATA[]) ·
`newDate` · `round` · `origin` · `destination` · `dateType` · `searched` ·
`cardStyle` ('warm'|'ink'|'editorial').

Data in production: `GET /visits` + `GET /countries` (map fills), `GET /flights` (journeys),
`GET /flights/stats` (Stats screen), `POST /flights` (sheet), `POST /flight-search/explore` (Search).
All shapes already exist in `frontend/src/types/index.ts`.

## Assets
- World geometry: `https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json`
  (Natural Earth, public domain), rendered with d3-geo + topojson-client. Version-pinned — keep the URL.
- Airport coordinates for the routes are inlined in the prototype logic (SOF, VAR, IST, AMS, KEF, BKK,
  VIE, BCN, DXB, SGN, MUC, JFK, LIS, CUN, RAK, ATH, CPH, OTP, NRT, LHR); production reads
  `Airport.latitude/longitude` from the API.
- Icons: Lucide (not bundled). Fonts: Caprasimo + Figtree from Google Fonts.
- No photography is used.

## Files in this bundle
- `Travel App.dc.html` — the full 5-screen prototype (markup + logic; open in a browser).
- `world-map.js` — the `<travel-world-map>` custom element: d3-geo + TopoJSON world map with
  great-circle routes and themable colors. Directly portable.
- `organic-tokens.css` — the Organic design system stylesheet (tokens + component layer).
- `github.md` — the repo association and the screen → repo-file map.
