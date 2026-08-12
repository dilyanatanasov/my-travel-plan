# Search experience (design-first, per D2) — Implementation log

**Date:** 2026-08-12
**Agent:** C (Trip Search)
**Branch:** `feat/search-destination-discovery` off `main` (`b24fa88`)
**Plan basis:** D1/D2/D3 in `context/COORDINATION.md`, research in
`context/research/2026-08-12_search-experience_research.md`.

## Name

**"Where to next?"** — chosen by the user on 2026-08-12 from four proposals
(Where to next? / Next trip / Don't stop / Somewhere new). Used as the page
h1 and the Overview card heading; A should use it for the desktop rail label
when wiring the section.

## What was built

New feature root `frontend/src/features/search/` (C's path), nothing shared
touched:

- `types.ts` — month-matrix-shaped types (`PriceDay`, `DestinationPrices`,
  `DiscoveryRow`), deliberately mirroring Travelpayouts `/v2/prices/month-matrix`
  so v2 swaps the fixture module for an API slice and nothing above changes.
- `fixtures/priceMatrix.ts` — deterministic seeded generator, 46 destinations
  across 6 continents from `HOME_ORIGIN` (SOF). Models the real endpoint's
  honesty problems on purpose: sparse day coverage, thin routes that return
  nothing, staleness 6–166 h, thinner cache for far-out months, seasonality.
- `discovery.ts` — pure derivation: visited-country filter (transit does not
  count, matching RegionProgress), cheapest-per-destination rows, sorts,
  freshness labels, and `buildPriceFillMap(rows, countries)` → the alpha-3
  keyed `Map<Alpha3, { price, bucket: 'low'|'mid'|'high' }>` A asked for
  (Q1) to drive the map choropleth. Buckets are per-month terciles.
- `affiliate.ts` — Aviasales deep link builder (marker constant empty until
  the Travelpayouts account exists, per the blocked-on-user list) and
  `trackOutboundClick` writing to localStorage until a backend endpoint
  exists (D1: instrument from day one).
- `useDiscovery.ts` — visits query + fixture "fetch" with a 450 ms settle so
  the loading state is a real, styled state.
- Components: `MonthPills` (12-month pill radiogroup), `DestinationCard`
  (price, day-strip with honest gaps, freshness + coverage line, See flights
  CTA, optional Show-on-map seam), `DiscoveryPanel` (the whole experience;
  self-contained so it is both the `/search` page today and A's docked panel
  later), `WhereNextCard` (Overview teaser for A to place).
- `pages/WhereNextPage.tsx` at `/search`, replacing the orphaned
  `FlightSearchPage` on the route. Old files untouched (v2 substrate).

States designed, not stubbed: loading skeleton; ready grid (auto-fill,
1-col mobile / 3-col desktop); region grouping; empty month; "No recent
prices" dashed strip for thin routes; affiliate disclosure line.

## Verification (bar: tsc, build, real browser)

- `npx tsc --noEmit` — exit 0, frontend. Backend untouched.
- `npx vite build` — success (531 kB main chunk; pre-existing size, A owns
  the split).
- Playwright (chromium) against a host vite dev server with the API stubbed
  at the network layer (backend was down mid-NestJS-upgrade by B; stubbing
  also meant no test rows in the real DB — nothing to clean up):
  - 43 cards for a stub user with Italy/Hungary/France visited — exactly
    46 fixtures − 3 visited; none of the three appear. Filter proven.
  - Region sort groups correctly; far-out month (Jul 2027) produced an
    honest no-data strip (Tanzania, Colombia).
  - Deep link `https://www.aviasales.com/search/SOF2309VIE1` — correct
    Aviasales shape for 23 Sep SOF→VIE.
  - Click-through instrumentation recorded the outbound click in
    localStorage.
  - Zero console errors. Light + dark themes, 1360 px and 390 px.
- Screenshots in `context/implement/2026-08-12_search-experience_assets/`
  (desktop ready, region sort, mobile light, mobile dark).
- Design fix from the check: day-strip bars `brand-200 → brand-300` in
  light theme (invisible on the cream card).

## Open

- A: place `WhereNextCard` in OverviewPanel (`import { WhereNextCard } from
  '../../features/search/components'`), add the desktop rail item labelled
  "Where to next?" (no sixth mobile tab, per Q1 answer), wire the
  choropleth from `buildPriceFillMap` + legend entry.
- Merge waits for the user's design review, per the working agreement.
- v2 (after deployment, D3): swap fixtures for providers, real click
  endpoint, affiliate marker.
