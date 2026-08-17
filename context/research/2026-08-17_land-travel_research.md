# Land Travel (Trains, Cars, Bus, Ferry) - Research

Date: 2026-08-17
Phase: 1 (Research)
Status: research only - no plan confirmed, no code touched

## 1. What exists today

### Data model (backend)
- `backend/src/modules/flights/entities/flight-journey.entity.ts` - table `flight_journeys`:
  userId, journeyDate (nullable), datePrecision ('day'|'month'|'year'), isRoundTrip,
  sortIndex (replay/list order tie-breaker), notes, eager `legs`, virtual totalDistanceKm.
- `backend/src/modules/flights/entities/flight-leg.entity.ts` - table `flight_legs`:
  journeyId, legOrder (unique per journey), departureAirportId, arrivalAirportId
  (both FK to `airports`, eager-loaded), distanceKm (decimal). No mode, no timestamps.
- `backend/src/modules/airports/entities/airport.entity.ts` - table `airports`:
  iataCode (length 3, unique, NOT NULL), icaoCode, name, city, country, countryIso
  (alpha-2), latitude, longitude. IATA is the identity: route keys, search, markers,
  stats all key on it.
- Visits auto-creation: `flights.service.ts` createVisitsFromLegs() marks every leg
  country as a 'trip' visit with source 'flight' (`VisitSource` in frontend types is
  'manual' | 'flight'). Land legs would want the same behavior, plus maybe a new source.

### "Flight" is baked in everywhere, but shallowly
- Names: FlightJourney, FlightLeg, flight_journeys, flight_legs, /flights endpoints,
  useGetFlightsQuery, FlightForm, FlightMap, FlightStats. Renaming is optional - a land
  leg living inside a "flight_leg" row is cosmetically odd but structurally fine.
- The controller (`flights.controller.ts`) exposes CRUD at /flights plus /flights/summary,
  /flights/stats, /flights/reorder, /flights/import, leg photos, and the search-v2
  endpoints (search, smart-search, explore, watches) - the latter are genuinely
  flight-only (Kiwi API, airlines, cabins) and should stay that way.
- `CreateFlightDto` takes `airportIds: number[]` (a chain); the service rebuilds legs and
  computes haversine distance server-side. Update replaces the whole chain.
- Frontend types (`frontend/src/types/index.ts`): FlightLeg has departureAirport /
  arrivalAirport of type Airport; FlightJourney has legs. A `mode` field slots in
  naturally on FlightLeg; nothing about the shape resists it.

### The killer finding: the app actively deletes ground travel today
- `backend/src/modules/flights/flight-chain.util.ts` - GROUND_TRANSFER_KM = 100.
  Any hop under 100 km between different airports is treated as "a train, bus or taxi",
  and `splitChainAtGroundTransfers()` removes it, splitting the chain into separate
  journeys. The create path 400s if the whole chain is transfers.
- Migration `1786500000000-SplitGroundTransferJourneys.ts` applied this retroactively:
  transfer legs were deleted, trailing legs moved to new undated journeys.
- So "ground transfer" exists only as a rejection rule. There is no stored land leg
  anywhere. A land-travel feature partially inverts this decision: NRT to HND stops being
  garbage and becomes a first-class (train) leg - but only when the user says so.
  The 100 km auto-split should stay for airport-chain input; a mode-aware create path
  would simply never run the splitter on legs the user marked as land.

### Migration pattern
`backend/src/migrations/` - timestamped classes (17866..., 17867..., now at
1787500000000-AddTerritories), raw SQL in up(), honest down() (sometimes "irreversible
by design; the deploy backup is the undo"). Deploys run migrations via the Actions
button with run_migrations=true. New land-travel migrations follow the same pattern.

## 2. The endpoints problem: what is a train station or a road stop?

Airports work because of the seeded table: `backend/src/seeds/airports.seed.ts`
downloads the open datasets/airport-codes CSV from GitHub once at seed time, filters to
valid IATA + coordinates, and inserts. Important nuance for the "no third-party runtime
deps" stance: the rule in practice is no runtime calls on behalf of users (the world
atlas TopoJSON is self-hosted in `frontend/public/geo/`), but a one-time seed-time fetch
of an open dataset is the established, accepted pattern. Options:

### a) Vendor a train stations dataset (same pattern as airports)
- Trainline EU stations: https://github.com/trainline-eu/stations - stations.csv,
  ~30,000 stations/stops/cities across Europe, semicolon-delimited, with lat/lon,
  country, and per-operator IDs. License: ODbL (attribution + share-alike on the data;
  fine for this use, needs a credit line). Repo is no longer actively maintained but
  the data is stable and widely vendored. Europe-only is the main limit.
- OpenStreetMap `railway=station` extracts (via Overpass or a planet extract): global,
  ODbL, but needs a one-off extraction script and dedup pass - more work, worldwide
  coverage (~100k+ stations).
- UK-only and per-country GTFS feeds exist but do not generalize.
- Realistic call: vendor Trainline EU now (covers the likely user base), leave OSM as
  the follow-up for global coverage.

### b) Free-text place + picking a point
Cars (and many bus/ferry trips) have no station registry at all. There is no acceptable
runtime geocoder under the no-deps stance. Two self-hosted answers:
- Click the map: the map already exists with projections both ways; a "pick point on
  map" input plus a free-text label is zero new data.
- City-level fallback: reuse the airports table as a coarse city gazetteer (airports
  have city + coordinates) - "near enough" for a drive between cities, weird for
  precision. Not recommended as the primary UX, but free.

### c) Generalize airports into "places"
Add nullable-IATA support plus a `kind` column ('airport' | 'station' | 'custom') to the
existing table, or create a parallel `places` table with the same shape. The airport
entity's iataCode is NOT NULL unique length-3, and IATA is the route key everywhere in
the frontend (`routeUtils.getRouteKey` keys on iataCode), so generalizing the existing
table means relaxing that column and changing route keying to ids. A separate
`places` table (id, kind, code nullable, name, city, country, countryIso, lat, lon)
that flight legs do NOT join to, but land legs do, avoids touching the airport hot path.

## 3. Map rendering

- Routes: `frontend/src/components/FlightMap/routeUtils.ts` aggregates legs into
  AggregatedRoute keyed by sorted IATA pair; `FlightRoutes.tsx` draws each as a
  quadratic-bezier arc (calculateArcPath, curvature 0.2) with count-scaled stroke.
- Recommended land look: same renderer, different params - curvature 0 (straight
  chord; land routes are short so straight reads as "on the ground"), dashed stroke
  (strokeDasharray, zoom-adjusted like stroke width already is), and a distinct color
  token in `frontend/src/theme/mapColors.ts` (which already carries route /
  routeHighlight). A per-route `mode` on AggregatedRoute drives all three. Mixed-mode
  aggregation: keep mode in the route key so a flown and a trained SOF-IST pair render
  as two routes, not one blob.
- Globe mode (`TravelMap/GlobeView.tsx`, `GlobeJourney.tsx`, `globeUtils.ts`) draws its
  own great-circle paths - same treatment needed there.
- Stats that assume flying, `backend/src/modules/flights/flights-stats.service.ts`:
  totalFlights, earthCircumferences, moonDistancePercent, estimatedFlightHours
  (AVG_FLIGHT_SPEED_KMH = 800), walkingYears, longest/shortest FLIGHT records,
  mostVisitedAirports. With land legs in the same tables, every SUM/COUNT needs a
  mode filter or a mode split ("distance flown" vs "distance travelled"). The
  /flights/summary fast path (COUNT/SUM, feeds the peek bar and milestones) needs the
  same decision. `FlightStats.tsx` copy ("distance flown", "time in the air", Flight
  Hours at 800 km/h) all needs mode-aware wording; estimated hours per mode differ
  (train ~90 km/h, car ~80).

## 4. Ripple surfaces

- Replay: `TravelMap/useJourneyReplay.ts` computes leg duration from distance
  (legFlightSeconds, sqrt easing) - works unchanged for land, arguably should run a bit
  slower per km for effect. `useReplayOrchestration.ts` reveals countries, pops
  airports, flashes landings - all keyed on legs/airports generically; land legs flow
  through if their endpoints look airport-shaped (name, coords, countryIso, some code).
- Glyph: `frontend/src/components/FlightMap/PlaneGlyph.tsx` and
  `frontend/src/lib/planeSprite.ts` centralize the plane; `JourneyHighlight.tsx`
  animates it along the arc. `frontend/src/utils/exportMapVideo.ts` uses a Path2D
  PLANE_PATH_2D in two renderers (full map video and ticket-strip video). One glyph
  registry keyed by mode (plane / train / car) covers all four call sites.
- Milestones: `frontend/src/features/milestones/useMilestones.ts` - thresholds on
  countries / flights / distance; distance steps include 40,075 (Earth) and 384,400
  (Moon) with "flown" copy. Fed from the summary totals - whatever the stats decision
  is (flown-only vs total) flows straight in; copy needs the same wording pass.
- Public shared map: `backend/src/modules/share/share.service.ts` getPublicMap serves
  journeys to the read-only map; it reuses the same journey shape and the same
  FlightRoutes with onSelect omitted, so mode support arrives there for free once the
  types carry it. Share cards / duels compare totals - same stats decision applies.
- Search v2 (smart-search, explore, watches, Kiwi provider under
  `flights/services/`): genuinely aviation-only. Exclude land entirely; no changes.
- Leg photos (`leg-photos.service.ts`, unique per leg): mode-agnostic, works as is.

## 5. UI

- Add/edit: `frontend/src/components/FlightForm/RouteBuilder.tsx` builds a chain of
  AirportSearch inputs -> airportIds[], plus date (precision-aware), round trip, notes.
  `FlightForm.tsx` wraps it; `ImportFlights.tsx` bulk-imports IATA chains (keep
  flight-only). A mode picker fits at the leg level: each hop gets a mode chip
  (default plane), and the endpoint input swaps between AirportSearch and a
  station/place search by mode. Journey-level mode ("this whole trip was a drive") is a
  simpler v1 that covers most real entries.
- The existing 100 km splitter message ("splitInto") already explains ground transfers
  to users - the same touchpoint becomes "keep it as a train leg?" later.

## 6. Solution options (Phase 2 raw material - decisions needed, no plan yet)

### Option A: mode column on existing tables, endpoints stay airports (small)
Add `mode` varchar default 'flight' to flight_legs (one migration). Land legs still
reference airports (nearest airport as proxy for the city). No new place data.
- Pros: tiny; every surface (replay, share, stats filters, visits) keeps working;
  dashed line + train glyph land quickly.
- Cons: "London St Pancras" is stored as LHR; dishonest data users will notice;
  the 100 km splitter and mode interact awkwardly (a real train leg between two
  airports is exactly what the splitter deletes). A dead end worth skipping unless
  the goal is a visual-only experiment.

### Option B (recommended): mode per leg + parallel places table (medium)
Migrations: (1) `mode` on flight_legs ('flight' default, 'train', 'car', 'bus',
'ferry'); (2) new `places` table (kind, code nullable, name, city, country, countryIso,
lat, lon) + nullable departure_place_id / arrival_place_id on flight_legs, with a CHECK
that each endpoint has exactly one of airport-id or place-id. Vendor Trainline EU
stations (ODbL, Europe) via a new seed following airports.seed.ts; cars use free-text
label + map-click coordinates stored as kind='custom' places. Create path: mode-aware -
splitter runs only on all-flight chains. Frontend: leg-level mode chips, station search
component (clone of AirportSearch against /places?q=), dashed straight lines + mode
color, glyph registry, stats split into "flown" vs "overland" with copy pass.
- Pros: honest data; airports hot path untouched; search v2 untouched; extensible to
  ferry; matches every existing pattern (seed, migration, route rendering).
- Cons: touches many surfaces (stats service + summary + FlightStats + milestones +
  export video + globe); route keying must move from IATA strings to place identity;
  medium-large frontend surface. Effort: medium (backend small-medium, frontend medium).

### Option C: separate land_journeys module mirroring flights (large)
New entities, controller, service, RTK slice, map layer.
- Pros: zero risk to flights; naming stays clean.
- Cons: duplicates journey/leg/replay/share/stats logic wholesale - directly against
  the standing reuse rule; every shared surface (replay order, share map, milestones)
  must merge two lists forever. Effort: large. Not recommended.

### Open questions for the Phase 2 conversation
1. Journey-level mode (simpler v1) or per-leg mode (mixed trips, e.g. fly out, train
   back)? Per-leg matches the data model better; journey-level ships faster.
2. Do land km count toward milestones/duels ("distance travelled") or stay separate
   ("distance flown" preserved)? Affects summary, milestones, share cards.
3. Scope of v1 modes: train + car only, or bus/ferry from day one (schema should take
   the full enum regardless)?
4. Europe-only stations (Trainline EU) acceptable for v1, with OSM extract later?
5. Does the visits auto-creation treat a drive-through country as 'trip' or 'transit'?

Sources for dataset licensing: [trainline-eu/stations](https://github.com/trainline-eu/stations) (ODbL, ~30k European stations).
