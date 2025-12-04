# Research: Flight Tracking Feature
**Date**: 2025-12-04
**Feature**: Track all flights with airports, routes, distance statistics

---

## 1. Current Codebase Overview

### Existing Infrastructure (Ready to Extend)
- **Backend**: NestJS + TypeORM + PostgreSQL
- **Frontend**: React + Redux Toolkit + RTK Query + Tailwind
- **Docker**: Full dev/prod setup ready
- **Pattern**: Countries → Visits (we'll follow same pattern for Airports → Flights)

### Existing Entities
```
countries (id, name, isoCode, isoCode2, createdAt)
visits (id, countryId, visitedAt, notes, createdAt, updatedAt)
```

### Key Files to Modify/Extend
- `backend/src/modules/` - Add new airports & flights modules
- `backend/src/seeds/` - Add airport seeding
- `frontend/src/features/` - Add flights feature
- `frontend/src/components/` - Add flight-related components
- `frontend/src/pages/` - Add flights page with statistics

---

## 2. Airport Data Sources

### Option A: OurAirports (Recommended - Open Data)
- **URL**: https://ourairports.com/data/
- **Format**: CSV (downloadable, 12MB+)
- **License**: Public Domain
- **Data includes**: name, isoCountry, isoRegion, municipality, icaoCode, iataCode, latitude, longitude, elevation
- **Size**: ~70,000+ airports worldwide
- **Pros**:
  - Completely free, no API limits
  - Regularly updated (last update Dec 3, 2025)
  - Includes small airports
- **Cons**:
  - Need to download and seed into database
  - Large dataset (can filter to major airports with IATA codes ~6,000)

### Option B: OpenFlights
- **URL**: https://openflights.org/data
- **Format**: CSV/DAT files
- **License**: Open Database License
- **Data includes**: IATA, ICAO, name, city, country, lat, lon, altitude, timezone
- **Size**: ~7,000 airports
- **Pros**: Curated list of commercial airports
- **Cons**: Less frequently updated

### Option C: AirportDB.io (API)
- **URL**: https://airportdb.io/
- **Format**: JSON API
- **License**: Free tier available
- **Data includes**: ~60,000 airports with locations, runways, frequencies
- **Pros**: Real-time API access
- **Cons**: Rate limits on free tier, API dependency

### Option D: API Ninjas - Airports API
- **URL**: https://api-ninjas.com/api/airports
- **Format**: REST API
- **Data includes**: ICAO, IATA, name, city, region, country, elevation, lat, lon, timezone
- **Pros**: Simple API, includes pagination
- **Cons**: Rate limits, requires API key

### Recommendation
**OurAirports filtered dataset** - Download once, filter to ~6,000 airports with IATA codes (commercial airports), seed into database. No API dependencies, no rate limits.

---

## 3. Distance Calculation

### Haversine Formula
The standard for calculating great-circle distance between two lat/lon points.

```
a = sin²(Δlat/2) + cos(lat1) × cos(lat2) × sin²(Δlon/2)
c = 2 × atan2(√a, √(1−a))
d = R × c

Where R = 6,371 km (Earth's mean radius)
```

### Implementation Options

#### Option A: Calculate in Backend (TypeScript)
```typescript
function haversineDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371; // km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}
```
**Pros**: No dependencies, calculated on-demand or stored
**Cons**: Need to implement ourselves

#### Option B: Use npm package (geolib)
- **Package**: `geolib` - https://www.npmjs.com/package/geolib
- **Function**: `getDistance(point1, point2)`
- **Pros**: Battle-tested, includes many geo utilities
- **Cons**: Additional dependency

#### Option C: PostgreSQL PostGIS extension
- Calculate distances directly in SQL queries
- **Pros**: Efficient for complex spatial queries
- **Cons**: Overkill for our use case, adds complexity

### Recommendation
**Option A** - Simple TypeScript function. We only need basic distance calculation, and can pre-calculate/cache distances when creating flights.

---

## 4. Data Model Design

### airports Table
```sql
CREATE TABLE airports (
  id SERIAL PRIMARY KEY,
  iata_code VARCHAR(3) UNIQUE,      -- e.g., "VAR"
  icao_code VARCHAR(4),              -- e.g., "LBWN"
  name VARCHAR(200) NOT NULL,        -- e.g., "Varna Airport"
  city VARCHAR(100),                 -- e.g., "Varna"
  country VARCHAR(100),              -- e.g., "Bulgaria"
  country_iso VARCHAR(2),            -- e.g., "BG"
  latitude DECIMAL(10, 7) NOT NULL,
  longitude DECIMAL(10, 7) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### flights Table
```sql
CREATE TABLE flights (
  id SERIAL PRIMARY KEY,
  departure_airport_id INTEGER REFERENCES airports(id),
  arrival_airport_id INTEGER REFERENCES airports(id),
  distance_km DECIMAL(10, 2),        -- Pre-calculated
  flight_date DATE,                   -- When the flight happened
  is_return BOOLEAN DEFAULT false,   -- If true, counts as 2 flights
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Alternative: Multi-leg Flight Model
For routes like "Varna → Istanbul → Lisbon":

```sql
CREATE TABLE flight_journeys (
  id SERIAL PRIMARY KEY,
  journey_date DATE,
  is_round_trip BOOLEAN DEFAULT false,  -- Doubles the journey if true
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE flight_legs (
  id SERIAL PRIMARY KEY,
  journey_id INTEGER REFERENCES flight_journeys(id) ON DELETE CASCADE,
  leg_order INTEGER NOT NULL,           -- 1, 2, 3...
  departure_airport_id INTEGER REFERENCES airports(id),
  arrival_airport_id INTEGER REFERENCES airports(id),
  distance_km DECIMAL(10, 2),
  UNIQUE(journey_id, leg_order)
);
```

### Recommendation
**Multi-leg model** is more flexible and matches user's request for routes like "Varna → Istanbul → Lisbon".

---

## 5. Statistics Features

### Core Statistics
1. **Total Flights Count**
   - All-time total
   - Account for round trips (×2)

2. **Distance Traveled**
   - Total kilometers (all-time)
   - By year
   - By month
   - Account for round trips (×2)

3. **Records**
   - Longest single flight (km)
   - Shortest single flight (km)
   - Most visited airport
   - Most common route

4. **Time-based Analysis**
   - "Strongest" year (most km or flights)
   - "Strongest" month (most km or flights)
   - Flight frequency over time (chart potential)

### Creative Statistics Ideas
5. **Earth Comparisons**
   - "You've flown X times around the Earth" (40,075 km circumference)
   - "Distance to the Moon: X%" (384,400 km)

6. **Geographic Insights**
   - Countries reached via flights
   - Continents visited
   - Hemispheres crossed
   - Furthest point from home (configurable home airport)

7. **Airport Stats**
   - Total unique airports visited
   - Airports by country breakdown
   - "Hub" analysis (airports used most for connections)

8. **Time Patterns**
   - Most active travel month (historically)
   - Average flights per year
   - Longest gap between flights

9. **Fun Facts**
   - CO2 emissions estimate (optional, ~90g per passenger-km for short haul)
   - Time spent in air (estimate based on average speeds)
   - "If you walked this distance, it would take X years"

---

## 6. UI/UX Considerations

### Flight Input Methods

#### Option A: Simple Form
- Departure airport (searchable dropdown)
- Arrival airport (searchable dropdown)
- Date
- One-way / Round-trip toggle
- Add button

#### Option B: Multi-leg Builder
- Start typing route: "VAR → IST → LIS"
- Autocomplete as you type
- Visual representation of the route
- Date and round-trip options

#### Option C: Quick Input Mode
- Text input: "varna sofia roundtrip 2023-05-15"
- Parse and create automatically
- Good for bulk entry

### Visualization Ideas
1. **Flight Map**
   - Arc lines connecting airports on world map
   - Thicker lines for frequently flown routes
   - Color coding by year or frequency

2. **Statistics Dashboard**
   - Cards with key metrics
   - Charts for time-based data
   - Leaderboard-style for records

3. **Airport Explorer**
   - Click on airport to see all flights from/to it
   - Airport details (city, country)

---

## 7. Integration with Existing Features

### Connection to Countries/Visits
- When a flight lands in a new country, optionally auto-add to visits
- Show "visited by flight" badge on countries
- Unified travel map (countries + flight routes overlay)

---

## 8. Technical Implementation Notes

### Airport Seeding Strategy
1. Download OurAirports CSV
2. Filter to airports with IATA codes (~6,000 airports)
3. Create seed script similar to `countries.seed.ts`
4. Run on database initialization

### API Endpoints Needed
```
GET    /api/airports          - List/search airports
GET    /api/airports/:id      - Single airport
GET    /api/flights           - List all flights
GET    /api/flights/:id       - Single flight
POST   /api/flights           - Create flight (supports multi-leg)
PATCH  /api/flights/:id       - Update flight
DELETE /api/flights/:id       - Delete flight
GET    /api/flights/stats     - Get statistics
```

### Frontend Components Needed
- `AirportSearch` - Autocomplete search for airports
- `FlightForm` - Create/edit flights
- `FlightList` - Display user's flights
- `FlightMap` - Visualize routes on world map
- `FlightStats` - Statistics dashboard
- `FlightStatsCard` - Individual stat display

---

## 9. Decisions Required for Planning Phase

### Data Source
- [ ] **Option A**: OurAirports CSV (recommended - ~6,000 IATA airports)
- [ ] **Option B**: OpenFlights dataset (~7,000 airports)
- [ ] **Option C**: API-based (AirportDB or API Ninjas)

### Data Model
- [ ] **Option A**: Simple flights table (single departure → arrival)
- [ ] **Option B**: Multi-leg journeys (supports Varna → Istanbul → Lisbon)

### Distance Calculation
- [ ] **Option A**: Custom TypeScript Haversine implementation
- [ ] **Option B**: Use `geolib` npm package
- [ ] **Option C**: PostgreSQL calculation

### Round Trip Handling
- [ ] **Option A**: Boolean flag `is_return` - doubles distance/count in stats
- [ ] **Option B**: Create two separate flight records automatically
- [ ] **Option C**: Store as single record but with `multiplier` field

### Flight Input UI
- [ ] **Option A**: Simple form (one flight at a time)
- [ ] **Option B**: Multi-leg builder with visual route
- [ ] **Option C**: Quick text input with parsing

### Flight Visualization
- [ ] **Option A**: Integrate flight routes into existing world map
- [ ] **Option B**: Separate flights page with dedicated map
- [ ] **Option C**: Both (routes on main map + detailed flights page)

### Statistics Priority
Which stats to implement first?
- [ ] Core: Total flights, total km, by year/month
- [ ] Records: Longest/shortest flight, most visited airport
- [ ] Creative: Earth comparisons, time estimates
- [ ] All of the above

---

## 10. Sources

### Airport Data
- [OurAirports - Open Data](https://ourairports.com/data/)
- [OpenFlights Data](https://openflights.org/data)
- [AirportDB.io](https://airportdb.io/)
- [API Ninjas - Airports API](https://api-ninjas.com/api/airports)

### Distance Calculation
- [Haversine Formula - Wikipedia](https://en.wikipedia.org/wiki/Haversine_formula)
- [Movable Type Scripts - Lat/Long Calculations](https://www.movable-type.co.uk/scripts/latlong.html)
- [Stack Overflow - Haversine in JavaScript](https://stackoverflow.com/questions/27928/calculate-distance-between-two-latitude-longitude-points-haversine-formula)

### NPM Packages (Potential)
- [geolib](https://www.npmjs.com/package/geolib) - Geo utilities including distance
- [airportsdata (Python)](https://pypi.org/project/airportsdata/) - Reference for data structure

---

## 11. Estimated Scope

### New Backend Components
- 2 new modules (airports, flights)
- 2-3 new entities (airports, flights/journeys, legs)
- 1 new seed file (~6,000 airports)
- Statistics service with aggregation queries

### New Frontend Components
- ~6-8 new components
- 1-2 new pages (Flights, possibly Stats)
- New RTK Query endpoints
- Map enhancement (flight routes)

### Database
- 2-3 new tables
- Pre-calculated distance column for performance
