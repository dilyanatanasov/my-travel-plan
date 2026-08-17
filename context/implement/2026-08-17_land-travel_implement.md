# Land Travel - Implementation Log

Date: 2026-08-17
Branch: feat/land-travel
Plan: context/plan/2026-08-17_land-travel_plan.md

## Done

### Backend
- Migration 1787600000000-AddLandTravel: cities table (GeoNames shape,
  prefix index on lower(ascii_name)), travel_mode on flight_legs
  (default 'flight'), nullable airport FKs + nullable city FKs with
  per-endpoint CHECK (exactly one of airport/city).
- cities module: entity + GET /cities?q= (public, prefix ILIKE on
  name/ascii_name, population-ranked, limit 10).
- cities.seed.ts: downloads cities1000.zip at seed time, unzips with a
  minimal zero-dependency single-entry zip reader (EOCD -> central dir ->
  inflateRawSync), filters feature class P, chunked orIgnore inserts.
  run-seed.ts wired (idempotent: skips when cities exist).
- CreateFlightDto/UpdateFlightDto: stops[] ({airportId|cityId}) + modes[]
  (one per hop). create() branches to createMixed(); update() accepts the
  same replacement chain. resolveStops validates: exactly one endpoint
  kind per stop, flight hops need airports both ends, no zero-length
  hops. The 100 km ground-transfer splitter does NOT run on the stops
  path - the user declared each hop's mode; it still guards the legacy
  airportIds path and the importer.
- Visits: createVisitsForCountries - every touched country (airport or
  city endpoint) becomes a 'trip' visit, same as flights.
- flights-stats: every existing number now means FLIGHTS ONLY (isFlightLeg
  filter through core/time/records/geo aggregates); new overlandDistanceKm,
  overlandLegs, overlandByMode in getStats; summary adds overlandDistanceKm
  via FILTER clauses in the same single query.
- share.service public map: land legs ship as routes with mode; cities
  pose as PublicAirportDto with name in the label slot; flights/distanceKm
  counters stay flight-only. Route keys include mode.

### Frontend
- types: TravelMode, CityRef, FlightLeg (nullable airports, optional
  cities + travelMode), TravelStop, DTO shapes, FlightSummary/FlightStats
  overland fields.
- routeUtils: cityAsAirport (city poses as Airport, negative id, name in
  the iataCode label slot), legEndpoints, legMode, TRAVEL_MODE_EMOJI,
  journeyRouteLabel (deduped from 3 copies); aggregation keys on endpoint
  ids + mode; AggregatedRoute.mode.
- FlightRoutes: land routes are straight dashed chords with
  data-travel-mode on the path (the video sampler reads it).
- JourneyHighlight: legEndpoints/mode-aware; land legs straight + dashed
  base; timeline legs pass grounded (no cruise swell); MIXED journeys get
  the glyph baton pass - one VehicleGlyph per leg on the same
  animateMotion group, discrete opacity keyframes swap at each next
  takeoff (SMIL keyTimes always span 0..1; swap animates begin in the
  same beginElement batch).
- flightTimeline: grounded legs hold scale 1; returns legWindows.
- globeUtils/GlobeJourney: segments carry mode; PlaneFrame.mode picks the
  glyph per frame; grounded legs hold altitude 1.
- lib/planeSprite: VEHICLE_PATHS (train/car/bus/ferry, 24-box, nose +x),
  drawVehicleSprite (plane keeps nav lights; land glyphs plain);
  VehicleGlyph SVG component wraps PlaneGlyph.
- exportMapVideo: RouteSamples.mode from data-travel-mode; both renderers
  draw the leg's own vehicle; land trails dashed (setLineDash).
- Form: RouteBuilder rebuilt - per-stop airport/city toggle, per-hop mode
  chips (flight/train/car/bus), preview with mode emoji, flight-hop
  validation message; all-flight all-airport submissions still use the
  legacy airportIds shape (keeps the server typo guard). CitySearch
  component + citiesApi (lazy query).
- FlightCard/FlightList/CountryDetailCard/ReplayControl/JourneyHighlightCard:
  endpoint labels via legEndpoints (city names appear); land legs show
  their vehicle emoji in the leg chips.
- FlightStats: "Distance Flown" + "+ N km overland" subtitle; Overland
  card with per-mode km and trip counts.
- SharedMapPage: passes route mode through (absent = flight for cached
  payloads).

## Deploy notes
- Migration must run (run_migrations=true).
- Cities seed on prod: run the seed AFTER the migration
  (node dist/seeds/run-seed.js in the backend container); countries and
  airports skip themselves; cities downloads ~10MB from GeoNames once.
- Frontend + backend both change.

## Not in v1
Ferry UI, edit-form mode editing (FlightCard edit still airport-chain
only - editing a mixed journey needs the same stop/mode UI), land-leg
support in ImportFlights, mode-aware search v2 (aviation only).
