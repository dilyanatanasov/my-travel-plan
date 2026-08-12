# Search experience (design-first, per D2) — Research

**Date:** 2026-08-12
**Agent:** C (Trip Search)
**Scope:** What exists today, judged against what D1/D2 ask for; entry-point
analysis; fixture data shape. Prior docs:
`context/research/2026-08-11_smart-trip-search_research.md`,
`context/plan/2026-08-11_smart-trip-search_plan.md` (approved, now sequenced
behind deployment by D3 — its providers/SSE/watches are v2).

## What v1 is

Per D1: map-native destination discovery — "where haven't I been that's cheap
from my airport this month" — on Travelpayouts month-matrix-shaped data, with
affiliate deep links out. Per D2: build the *experience* now on fixtures; no
providers, no token, nothing blocked on the user.

## Existing search code, file by file

### Frontend — `features/flightSearch/` + `pages/FlightSearchPage.tsx` (~1,815 lines)

- `FlightSearchPage.tsx` (300) — routed at `/search` inside `RequireAuth`,
  **deliberately hidden from the nav** (comment in `Layout.tsx:35-42`: kept
  because its differentiator is "persistent personal constraints (preferred
  airports, minimum layover, departure hour)"). Own full-page scrolling layout
  (`scroll-page`), `bg-blue-600` hero header, two-tab mode toggle
  (Explore / Specific Dates), filter sidebar + results grid.
- `components/`: `SearchForm` (244), `FilterPanel` (260), `ResultsList` (81),
  `FlightCard` (148); `exploration/`: `FlexibleSearchForm` (419),
  `ExplorationResults` (200), `FlightOptionCard` (231), `HighlightCards` (152),
  `InsightsPanel` (46).
- `flightSearchApi.ts` (34) — two RTK Query mutations against
  `/flights/search` and `/flights/explore`.
- Someone has partially swept design tokens in (`bg-surface`, `text-ink`,
  `border-line`), but the layout, the hero, the raw `blue-600`/`gray-300`
  palette and the whole information architecture predate the Organic design
  language and the fixed no-scroll shell.

### Backend — `modules/flights/`

`flight-search.service.ts`, `flight-exploration.service.ts`,
`api-key-manager.service.ts`, `hub.service.ts`, `date-sampling.service.ts`,
`filter.service.ts`, `safety.service.ts`, DTOs for both search shapes, Kiwi
interfaces. This is the *precise round-trip* funnel the approved v2 plan
extends. **Not touched in this phase** — D2 is frontend-only on fixtures.

### Adjacent, not search

`components/TravelMap/MapSearch.tsx` is map *navigation* — type a country or
airport, the camera flies there. It must stay visually and verbally distinct
from trip search (D2 explicitly warns against conflation).

## Judgment: replace the page, keep the parts, leave the backend alone

**Replace** `FlightSearchPage` as the thing users meet. Reasons:

1. **Wrong question.** Every existing form starts from origin + destination.
   Discovery has no destination — that is the point. The data shape
   (cheapest indicative price per destination/day) matches no existing
   component; `FlightCard`/`FlightOptionCard` render legs, airlines,
   durations, booking links — none of which the month-matrix provides.
2. **Wrong shell.** The app is a fixed 100dvh shell where only panels scroll;
   the old page is a scrolling document with its own hero header and its own
   back-link. Restyling it means rebuilding its entire layout anyway.
3. **Wrong feel.** Blue-600 hero + tab bar + filter sidebar is exactly the
   "bolted-on booking widget" D2 names as the failure mode.

**Keep** (unrouted / for later): the old page and components stay in the tree
untouched — the specific-dates funnel is the approved v2 and A's Layout
comment records a real differentiator worth preserving. Deleting is a v2-era
decision, made when the orchestrator work starts. `AirportSearch` (shared
component) is reusable as the origin picker. The `/search` route slot is
reused for the new experience.

**Restyle** was considered and rejected: 1,815 lines built around the wrong
data shape and the wrong interaction model; the token sweep already done there
is the cheap 20%, the layout/IA is the expensive 80%.

## The design language to build in

- Tokens via `tailwind.config.js` → `tokens.css`: `brand-*`, `surface{,-sunken}`,
  `ink{,-muted,-subtle}`, `line`, `canvas`, `danger*`; dark mode via `.dark`.
- Map overlays use the `map-glass` utility family (`index.css`): translucent
  glass cards, `rounded-2xl`, `shadow-xl`, `font-display` headings
  (see `CountryDetailCard` — the reference component for anything floating
  over the map).
- Docked panels use `bg-surface border border-line rounded-2xl shadow-sm`
  (see `RegionProgress`, `OverviewPanel`).
- Shell: `SectionRail` (desktop, icon rail with hover labels) +
  `MobileTabBar` (five equal `grid-cols-5` tabs) over `sections.tsx`
  (`SectionId` union). Sections either dock beside the map or set
  `fullView: true` and replace it.
- Segmented controls: pill buttons in `bg-current/10` container
  (CountryDetailCard's visit-type control).

## Interaction constraints discovered (correcting D2's premise)

- **Tapping an unvisited country does not open a card — it adds a visit**
  (`TravelMap.tsx handleCountryClick`). Tap-to-add is the primary, load-bearing
  map interaction; long-press adds-then-opens the card. `CountryDetailCard`
  only ever shows *visited* countries. So the "country you have never visited
  already opens a detail card" path D2 gestured at does not exist, and
  creating it would change the map's core interaction — A's call, not C's.
- **Mobile tab capacity is a real limit.** `sections.tsx` documents that five
  tabs across 390px leave ~74px each and the icon size was already reduced to
  fit. A sixth tab drops that to ~62px; `MobileTabBar` hardcodes
  `grid-cols-5`.
- The rail hover-label z-order was just fixed by A (`z-40` on the rail);
  anything new on the map must respect the existing overlay layering.

## Entry-point options (decision is A's — proposed as Q1 in COORDINATION.md)

1. **New shell section "Where next"** — rail + tab item, docked panel (not
   `fullView`: the map is the content). While active, unvisited countries take
   priced choropleth fills; the panel lists the cheapest destinations; tapping
   a row flies the map there. Cost: sixth mobile tab (see constraint above);
   map-layer work needs A's cooperation in `TravelMap`.
2. **Overview teaser card** — a "Where next" card in `OverviewPanel` (top 3
   cheapest unvisited destinations + "Explore all") funneling into the full
   experience. `RegionProgress` already sells unfinished regions as next
   trips; this extends that psychology. Complements option 1.
3. **Map-mode toggle** in `MapControlPanel` — no new nav item; discovery as a
   map layer. Cheapest nav cost, worst discoverability; overloads a filter
   panel.
4. **Rejected: unvisited-country tap** — conflicts with tap-to-add (above).

Recommendation: **1 + 2**. If the sixth mobile tab is unacceptable, 1 becomes
desktop-rail-only and 2 is the mobile entry.

## Fixture data shape

Mirror `/v2/prices/month-matrix` semantics so v2 wiring is a swap, not a
redesign: per destination × month: `{ destination (IATA + country ISO2),
month, days: [{ depart_date, value, found_at }] }` — sparse on thin routes
(the honest no-data state is a designed requirement, not an edge case), prices
indicative (48h–7d-old cache of other users' searches — label as
"indicative", never as bookable fares). Origin fixed to the user's home
airport (SOF in fixtures). Affiliate deep link shape:
`https://www.aviasales.com/search/SOF1509BCN22091?marker=<pending>` — marker
is a query param appended when the account exists (per D1, no signup now).

## Where the new code lives

Per the ownership map: `frontend/src/features/search/**` and search pages are
C's. New work goes there (`features/search/`), leaving `features/flightSearch/`
as the frozen v2 substrate. Branch: `feat/search-destination-discovery` off
`main`. Shell wiring (sections.tsx, rail, tab bar, Overview card) is A's and
waits for Q1's answer.
