# Research: split the United Kingdom into England, Wales, Scotland, Northern Ireland

Date: 2026-10-03. Goal: the UK stops being one country; its four constituent
countries become first-class countries. All existing UK visits migrate to England.

## Where countries live today

- `backend/src/modules/countries/entities/country.entity.ts` - table `countries`:
  `name` varchar(100), `iso_code` varchar(3) UNIQUE (alpha-3), `iso_code_2`
  varchar(2) UNIQUE (alpha-2), `is_territory` bool. No numeric code.
- `backend/src/seeds/countries.seed.ts` - hand-written list. UK at line 191
  (`United Kingdom` / GBR / GB). Seeder skips when the table has rows, so existing
  DBs only change via migrations (template: `1787500000000-AddTerritories.ts`,
  INSERT ... ON CONFLICT DO NOTHING).
- `backend/src/modules/visits/entities/visit.entity.ts` - `country_id` FK. No
  unique (user_id, country_id); dedup is in code. Visits are the only FK user.
- Frontend `Country.isoCode` is a branded `Alpha3` (map join key), `isoCode2` is
  `Alpha2` (what airports and cities store). `frontend/src/types/index.ts:15-37`.

## Map geometry

- `frontend/public/geo/countries-50m.json` (main map + daily) and
  `countries-110m.json` (globe video) are vendored world-atlas@2 TopoJSON
  (Natural Earth admin-0 *countries*). The UK is ONE feature, id 826.
  No England/Scotland/Wales/NI subunits in either file.
- Natural Earth ships `admin_0_map_units` at 50m and 110m with the four as
  separate features. Both atlas files must be rebuilt from map units
  (Jersey/Guernsey/IoM remain separate at 50m).
- Join: numeric id -> alpha-3 in `components/TravelMap/isoCodes.ts`
  (`numericToAlpha3`, `nameToAlpha3` for id-less features like Kosovo,
  `fallbackCentroids`). Map-unit features carry no ISO numeric id, so the four
  need `nameToAlpha3` entries (or synthetic ids injected at build time).
- Consumers of the join: `CountriesLayer.tsx` (`geoToAlpha3`, centroid/bounds
  maps, paint + `data-country-iso`), `utils/exportGlobeVideo.ts:85-96`,
  `lib/terrainRoute.ts` (uses `land`, unaffected).
- Daily puzzle (`pages/DailyPage.tsx:101-136`) picks from 50m feature names, so
  changing the feature set reshuffles every day's answer. `DayState.answerName`
  already copes with this (it happened on the 110m->50m move).

## Airports and cities only know "GB"

- Airports: `airport.entity.ts` has `country` (name string) and `country_iso`
  (alpha-2). Seed `airports.seed.ts` reads the airport-codes CSV which has
  `iso_region` (GB-ENG / GB-SCT / GB-WLS / GB-NIR) - parsed, not stored.
- Cities: `city.entity.ts` has `country_iso` char(2). Seed downloads GeoNames
  cities1000 and discards admin1 (ENG/SCT/WLS/NIR). ~170k rows live in prod.
- Auto-visits from trips: `flights.service.ts` collects alpha-2 per stop and
  `visits.service.ts:93-130 createOrUpdateFromFlight` does `findByIsoCode2`,
  returning null SILENTLY when nothing matches. If GB has no country row,
  every future UK trip stops creating a visit with no error. GB must resolve
  to a constituent country.
- Flight stats (`flights-stats.service.ts:393-468`) count distinct
  `airport.country` NAME strings, not the countries table.
- Anniversary push uses `airport.country` name.

## Frontend alpha-2 -> country joins (all break for GB once no row has GB)

`useReplayOrchestration.ts:106-108,222-285`, `MapExportCanvas.tsx:151-167`,
`TripShareDialog.tsx:443-453`, `search/discovery.ts:111-120`,
`MapSearch.tsx:214`, `CountryDetailCard.tsx:73-92` (matches journeys and
airports to the card's country by alpha-2), `ReplayControl.tsx:92-95`,
`FlightMap/filterUtils.ts:32-46`, `stats/records.ts:39`,
`continentUtils.ts:21` (`GB: 'Europe'`, keyed by alpha-2; feeds continent
bars, milestones, records), `search/fixtures/priceMatrix.ts:54` (LTN iso2 GB).

## Flags

`components/ui/CountryFlag.tsx` renders flag-icons class `fi fi-<alpha2>`.
flag-icons 7.5 already ships `gb-eng`, `gb-sct`, `gb-wls`, `gb-nir`.

## Denominators

Share (`share.service.ts:107,205-224,324-331`), map page
(`TravelMapPage.tsx:42-49,227-232`), SharePanel, continent progress and
milestones all use count(is_territory = false). Four sovereign-style rows
instead of one raises the world total by 3 and nudges every user's percentage.

## Migrations

TypeORM 0.3, hand-written SQL migrations in `backend/src/migrations/`,
next timestamp `1787800000000`. Prod runs them via the deploy workflow with
`run_migrations=true`. Seeds never re-run on a populated table.

## Existing special-casing of GB

None beyond data entries: countries seed, airports seed name dict,
`isoCodes.ts:46`, `continentUtils.ts:21`, `priceMatrix.ts:54`. No
England/Scotland/Wales strings anywhere in source.

## Challenges

1. Column widths (3 and 2) force invented codes or a widening migration.
   ISO 3166-2 codes are GB-ENG, GB-SCT, GB-WLS, GB-NIR (6 chars). Precedent
   for invented alpha-3: Kosovo XKX.
2. GB -> constituent mapping for airports and cities. Options: default
   everything to England (wrong for Edinburgh/Cardiff/Belfast), backfill a
   region from the source datasets (needs re-download), or point-in-polygon
   each GB airport/city against the four new polygons (offline, uniform for
   both tables, one-off script).
3. Replace both TopoJSON tiers and keep Kosovo/Tuvalu workarounds intact.
4. Daily puzzle reshuffle on the day the new atlas ships.
5. Prod data migration: UPDATE visits SET country_id = England WHERE GB, then
   retire the GB row. Back up prod first (`./scripts/backup-db.sh prod`).
