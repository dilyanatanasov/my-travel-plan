# Land Travel (Train / Car / Bus) - Plan

Date: 2026-08-17
Phase: 2 (Plan) - decisions confirmed by owner
Research: context/research/2026-08-17_land-travel_research.md
Branch: feat/land-travel

## Confirmed decisions

1. Endpoints are CITIES, not stations. No station registry. Dataset:
   GeoNames cities1000 (every place with population > 1,000, ~130k rows,
   CC-BY 4.0), vendored at seed time like airports. "I moved from Varna
   to Plovdiv by train" - city names and coordinates are the whole need.
2. Mode is PER LEG: 'flight' (default) | 'train' | 'car' | 'bus'.
   Schema takes 'ferry' too so a later mode is data-compatible; UI ships
   train/car/bus only.
3. Stats: separate overland tally. Flight stats stay exactly as they are
   (distance flown, moon %, flight hours at 800 km/h); a new overland km
   figure appears alongside. Milestones stay flight-based.
4. Build now, on feat/land-travel.

## Backend

- Migration 1787600000000-AddLandTravel:
  - `travel_mode` varchar(10) NOT NULL DEFAULT 'flight' on flight_legs.
  - `cities` table: id, geonames_id unique, name, ascii_name, country_iso
    char(2), latitude, longitude, population. Index on ascii_name.
  - Nullable departure_city_id / arrival_city_id FKs on flight_legs;
    departure_airport_id / arrival_airport_id become nullable.
    CHECK per endpoint: exactly one of airport / city.
- cities.seed.ts: download cities1000.zip from GeoNames at seed time
  (same pattern as airports.seed.ts), parse TSV, chunked insert.
- New cities module: GET /cities/search?q= - ILIKE prefix on name and
  ascii_name, ordered population desc, limit 10 (server-side; 130k rows
  do not ship to the client).
- Create/update path: DTO gains optional `stops` + `modes` shape
  ({airportId | cityId}[] plus modes[len-1]); the legacy airportIds[]
  path stays for the importer and existing clients. Distance: haversine,
  same as airports. The 100 km ground-transfer splitter runs ONLY on
  all-flight chains - a leg the user marked as land is the point, not
  garbage.
- Visits auto-creation: land leg endpoint countries become 'trip' visits,
  same as flights (drive-through without stopping is not modeled in v1).
- flights-stats + summary: flight aggregates filter travel_mode='flight';
  new overlandKm (+ per-mode counts) in both. Share/duel cards unchanged
  (they read flight totals).

## Frontend

- Types: TravelMode; FlightLeg gains travelMode, departureCity,
  arrivalCity; shared leg-endpoint helper (name/code/coords/countryIso
  regardless of airport or city).
- Form: per-hop mode chips in RouteBuilder (plane default); a land hop
  swaps AirportSearch for CitySearch (new citiesApi query). Import stays
  flight-only.
- Map: route aggregation keys move from IATA pairs to endpoint identity +
  mode (a flown and a trained SOF-PDV render as two routes). Land routes
  draw as dashed straight chords in their own color; flights keep arcs.
  City endpoints get markers labeled by name.
- Replay / highlight: glyph registry by mode - the plane keeps its nav
  lights; train/car/bus get their own silhouettes. Same timeline math.
- Share videos: drawVehicleSprite(mode) in lib/planeSprite (renamed
  vehicleSprite); the films draw the leg's own vehicle.
- Stats UI: overland km line in FlightStats when > 0.

## Out of scope (v1)

Ferry UI, OSM/global station data (not needed - cities are global),
road-following geometry (straight dashed chord is the honest cartoon),
search v2 (aviation only), ground-transfer splitter UX changes.
