# Implementation log: England, Scotland, Wales and Northern Ireland as countries

Date: 2026-10-03. Plan: `context/plan/2026-10-03_uk-constituent-countries_plan.md`.
Branch: `feat/uk-constituent-countries`. Status: BUILT, dev-migrated, awaiting
owner's local test and deploy go.

## Done

### Geometry
- `frontend/scripts/build-world-atlas.mjs` (npm `build:atlas`): regenerates
  `public/geo/countries-{50m,110m}.json` from Natural Earth map units at a
  pinned commit (v5.1.1). Units are grouped back per country except the UK's
  four. Pipeline mirrors world-atlas@2 (quantize 1e5, spherical simplify
  1e-7, drop detached rings, land = merge, re-quantize). Output sizes:
  50m 642 KB (was 756), 110m 105 KB (was 108).
- Also emits `backend/src/geo/uk-map-units.data.ts` (the four 50m polygons,
  20 KB), so the backend classifier and the painted borders share one source.
- Deviation noted, accepted: Natural Earth 5.1.1 names "North Macedonia"
  (was "Macedonia") and gives Tuvalu a polygon. Daily puzzle answers
  reshuffle once; `DayState.answerName` handles it.
- Dev deps added to frontend: `topojson-server`, `topojson-simplify`.

### Backend
- `src/geo/uk-constituent.ts`: `ukConstituentFor(lat, lon)` ray-cast over
  the four polygons, nearest-vertex fallback offshore. 14 jest cases
  (`uk-constituent.spec.ts`): border towns both sides, Shetland, Hebrides,
  Anglesey, Isle of Wight, Scilly, offshore Dover and Antrim.
- Migration `1787800000000-SplitUnitedKingdom.ts`: widens `iso_code_2`,
  `airports.country_iso`, `cities.country_iso` to varchar(6); inserts the
  four; moves UK visits to England (drops a UK row only if the user already
  holds England); reclassifies every GB airport and city by coordinates
  (airports also get the country name); deletes the United Kingdom row.
  Full `down`.
- Entities widened. Seeds: countries lists the four; airports and cities
  seeds route GB rows through the classifier; the UK name entry dropped from
  the airports name dictionary.

### Frontend
- `isoCodes.ts`: `'826': 'GBR'` removed, four names in `nameToAlpha3`.
- `continentUtils.ts`: four `GB-*` codes -> Europe (GB kept for old data).
- `priceMatrix.ts`: LTN -> England / GB-ENG.
- `types/index.ts`: Alpha2 doc notes the ISO 3166-2 exception.
- `worldAtlas.ts` header updated. Flags needed no change (`fi-gb-eng` etc.).

## Verified
- backend: `nest build` clean, jest 115/115, eslint clean on touched files.
- frontend: `tsc -b` clean, vitest 133/133, eslint clean on touched files.
- Dev DB migrated (stack started with overridden host ports 3100/5273
  because ia-fitness holds 3000/5173/5432). Result:
  - countries: 200 non-territory (was 197); England holds the 1 former UK visit.
  - airports: 56 England, 39 Scotland, 5 Wales, 4 Northern Ireland;
    LHR/MAN/BHX/NCL/NQY/ISC England, EDI/ABZ/INV/LSI Scotland, BFS/BHD N. Ireland.
  - cities: 3635 England, 512 Scotland, 377 Wales, 114 Northern Ireland;
    Berwick England, Wrexham Wales, Derry Northern Ireland, Lerwick Scotland.
  - `/api/countries` returns 240 rows with the four and no United Kingdom.
- Playwright MCP could not reach localhost in this session; geometry was
  checked by rendering the UK region of both tiers to PNG instead.

## Not done / for the owner
- Visual check in the real app: paint, flags, country card for Scotland,
  a flight to EDI marking Scotland, share denominator, daily puzzle, globe.
- Prod deploy: Actions "Deploy to Production" with `run_migrations=true`
  after the owner's go. Workflow backs the DB up first.
