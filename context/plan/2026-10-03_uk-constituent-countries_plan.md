# Plan: England, Scotland, Wales and Northern Ireland as countries

Date: 2026-10-03. Research: `context/research/2026-10-03_uk-constituent-countries_research.md`.

## Decisions (owner, 2026-10-03)

| # | Question | Decision |
|---|---|---|
| D1 | Existing UK visits | All move to England, no splitting by trip history ("assume they went only to England") |
| D2 | Future UK trips | Option A: each UK airport and city is assigned its real constituent country by point-in-polygon, so a flight to Edinburgh marks Scotland |
| D3 | Counting | Full countries: four rows with `is_territory = false`; world total rises by 3 |
| D4 | Codes | Real ISO 3166-2 codes `GB-ENG`, `GB-SCT`, `GB-WLS`, `GB-NIR` as the alpha-2 key (columns widened to 6). Alpha-3 key uses Natural Earth's unit codes `ENG`, `SCT`, `WLS`, `NIR`, which collide with no ISO alpha-3 |
| D5 | Order | UK split first, social login (Google only) after |
| D6 | Delivery | Branch `feat/uk-constituent-countries`, owner tests locally, deploy only on explicit go |

## Approach

### 1. Geometry: regenerate both atlas tiers from Natural Earth map units

- New script `frontend/scripts/build-world-atlas.mjs` (node, devDeps
  `topojson-server`, `topojson-simplify`, `topojson-client`).
- Source: Natural Earth GitHub, pinned commit `ca96624a56bd078437bca8184e78163e5039ad19`
  (v5.1.1, 2022-06-02): `ne_{50m,110m}_admin_0_map_units.geojson` for
  geometry, `ne_{50m,110m}_admin_0_countries.geojson` for names and numeric ids.
- Map units are grouped back into one feature per `ADM0_A3` (so France,
  Portugal, Belgium and the rest stay single features exactly as today) except
  `GBR`, whose four units become their own features named England, Scotland,
  Wales, Northern Ireland with no numeric id.
- Pipeline mirrors world-atlas@2: quantize 1e5, spherical simplify 1e-7,
  drop detached rings under that weight, `land` = merge of all countries.
- Output: `frontend/public/geo/countries-50m.json`, `countries-110m.json`,
  plus `backend/src/geo/uk-map-units.data.ts` (the four 50m polygons, used by
  the backfill classifier). Script validates: no feature 826, four UK units
  present, feature count and id set as expected.
- Side effects accepted: "Macedonia" becomes "North Macedonia" (matches the
  table), Tuvalu gets a real polygon, daily puzzle answers reshuffle once.

### 2. Backend

- `backend/src/geo/uk-constituent.ts`: `ukConstituentFor(lat, lon)` returns
  `GB-ENG | GB-SCT | GB-WLS | GB-NIR` by ray-cast point-in-polygon over the
  50m units, falling back to the unit with the nearest vertex for offshore
  points. Jest spec with London, Edinburgh, Cardiff, Belfast, Berwick,
  Shetland, Isle of Wight, Scilly, and a near-Dover offshore point.
- Migration `1787800000000-SplitUnitedKingdom.ts`:
  1. widen `countries.iso_code_2`, `airports.country_iso`,
     `cities.country_iso` to varchar(6);
  2. insert the four countries (`ON CONFLICT DO NOTHING`);
  3. move visits from GB to England (drop a GB visit only if the same user
     already has an England row);
  4. reclassify every airport and city with `country_iso = 'GB'` through the
     classifier; airports also get `country` = the constituent name;
  5. delete the United Kingdom row.
  `down` reverses all of it.
- Entities: widen `isoCode2`, `countryIso` lengths to 6.
- Seeds: countries seed lists the four instead of the UK; airports seed uses
  the classifier for `GB` rows (iso_region is not trusted blindly); cities
  seed does the same; name dictionary gains the four.
- `visits.service` unchanged: `findByIsoCode2('GB-SCT')` now resolves.

### 3. Frontend

- `isoCodes.ts`: `nameToAlpha3` gains the four names; `'826': 'GBR'` goes.
- `continentUtils.ts`: the four `GB-*` codes map to Europe.
- `priceMatrix.ts`: LTN becomes `GB-ENG` / England.
- `types/index.ts`: Alpha2 comment notes the ISO 3166-2 exception.
- `CountryFlag` already works: `fi-gb-eng` etc. exist in flag-icons.
- No other code assumes a 2-character country code (grep verified).

### 4. Verification

- Backend jest, frontend vitest, both tsc builds.
- Local stack: run migration on the dev DB, check the four countries paint,
  flags show, a flight to EDI marks Scotland, share denominator is +3,
  daily puzzle loads, globe coarse tier draws the four.
- Prod: deploy workflow with `run_migrations=true` after owner's go. The
  workflow backs up the DB before migrating.

## Out of scope

- Splitting other composite states (Denmark/Greenland already separate).
- Social login: separate plan after this ships.
