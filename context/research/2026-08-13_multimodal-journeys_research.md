# Multi-modal journeys (trains, buses, cars, ships) — Research

**Date:** 2026-08-13. Prompted by the first real user test: a traveler whose trips didn't fit the flights box (Balkans reality — buses to Greece, cars through Serbia, ferries across the Adriatic). Today's mitigation was copy-level (nudges phrased so flights read as optional); this explores making overland/sea journeys first-class.

## Why it matters

The product promise is "you leave a trail — see it", not "your flight log". Today only flights draw trails; a bus trip exists solely as a tapped country. Generalizing modes widens who the app is for and makes the map an actual life-trail. Analytics (Umami `section_view`, once live) will quantify how many users are flight-less.

## Current model (what generalization touches)

- `flight_journeys` → `flight_legs` → `airports` (IATA-coded, seeded dataset). `journeyDate` optional. Backend auto-creates country visits from legs (`flights.service.ts` `createVisitRecords`).
- Rendering: routes are arcs between airport coordinates (`frontend/src/components/TravelMap/`); replay orders dated journeys (`useJourneyReplay.ts`) and is mode-agnostic in principle — arcs don't care about vehicles.
- Forms: `FlightForm` autocompletes airports; `importCsv` is airline-data-specific. Stats (`FlightStats`) count airports/distances.

## The core problem: endpoints

Flights work because airports are a clean, finite, globally-coded dataset. Nothing equivalent exists for land/sea:
- **Rail**: UIC station codes — Europe-centric, huge, messy.
- **Sea**: UN/LOCODE — ports-ish, incomplete for ferries.
- **Road**: nothing.

Realistic granularity options:
1. **City-to-city** — a filtered GeoNames subset (cities over ~15k population ≈ 25–30k rows, one-time seed like airports). Good arcs, bounded data, autocomplete parity with airports.
2. **Country-to-country** — zero new data (country centroids exist for the map); coarse arcs; trivially cheap; may feel imprecise for short hops (Sofia→Thessaloniki drawn centroid-to-centroid is wrong-looking).
3. **Freeform + geocoding API** — precise but adds an external runtime dependency and rate limits; against the self-contained grain.

## Schema options

- **A. Generalize in place**: add `mode` (`flight|train|bus|car|ferry`) to `flight_journeys`, make legs reference either an airport or a city (nullable FKs or a polymorphic `endpoint` table). Migration-heavy; one timeline, one replay, one stats surface.
- **B. Parallel `trips` table**: flights untouched; new entity for other modes with city endpoints. Cheaper migration, but two timelines to merge in replay/stats/share, and "flights vs trips" duality leaks into the UI forever.

## What stays flight-only regardless

Where-next price search, CSV import, airport-specific stats. These are features *about aviation*, not about the trail.

## UI/IA implications

"Flights" section likely becomes "Journeys" (nav copy, empty states, FlightForm gains a mode picker whose endpoint autocomplete switches dataset, list badges per mode). Route styling per mode (e.g. solid air / dashed land / dotted sea) — a genuinely attractive map upgrade. Replay unchanged conceptually.

## Open decisions for the plan phase

- **D1 Endpoint granularity**: city (GeoNames seed) vs country-only vs geocode API. (City recommended — parity with the airports pattern.)
- **D2 Schema**: generalize `flight_journeys` (A) vs parallel table (B). (A recommended — one timeline; pay the migration once.)
- **D3 Naming/IA**: rename Flights → Journeys? Affects nav, stats, share copy.
- **D4 Scope of v1**: which modes ship first (train/bus/car/ferry all at once vs an initial subset).

## Sequencing

After the share-unfurl branch merges and Umami lands. Design-first like search v1: mock mixed-mode trails and the form's mode/endpoint flow before any migration is written. This is a search-v1-sized feature, not a quick add.
