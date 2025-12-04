# Plan: Flight Tracking Feature
**Date**: 2025-12-04
**Feature**: Track all flights with airports, multi-leg routes, distance statistics

---

## Confirmed Decisions

| Decision | Choice |
|----------|--------|
| Data Model | Multi-leg journeys (chains like VAR → IST → LIS) |
| Round Trip | Auto-create reverse legs when marked round-trip |
| Flight Input UI | Both: simple form + route builder |
| Visualization | Both: overlay on home map + dedicated flights page |
| Statistics | All (core + records + creative) |
| Airport Data | OurAirports CSV (~6,000 IATA airports) |
| Distance Calc | Custom TypeScript Haversine function |

---

## Phase 1: Database Foundation

### 1.1 Create Airport Entity
**File**: `backend/src/modules/airports/entities/airport.entity.ts`
```typescript
@Entity('airports')
export class Airport {
  id: number
  iataCode: string      // "VAR"
  icaoCode: string      // "LBWN"
  name: string          // "Varna Airport"
  city: string          // "Varna"
  country: string       // "Bulgaria"
  countryIso: string    // "BG"
  latitude: number
  longitude: number
  createdAt: Date
}
```

### 1.2 Create Flight Journey Entity
**File**: `backend/src/modules/flights/entities/flight-journey.entity.ts`
```typescript
@Entity('flight_journeys')
export class FlightJourney {
  id: number
  journeyDate: Date
  isRoundTrip: boolean  // When true, reverse legs auto-created
  notes: string
  legs: FlightLeg[]     // OneToMany relation
  createdAt: Date
  updatedAt: Date
}
```

### 1.3 Create Flight Leg Entity
**File**: `backend/src/modules/flights/entities/flight-leg.entity.ts`
```typescript
@Entity('flight_legs')
export class FlightLeg {
  id: number
  journey: FlightJourney  // ManyToOne
  legOrder: number        // 1, 2, 3...
  departureAirport: Airport
  arrivalAirport: Airport
  distanceKm: number      // Pre-calculated
}
```

### 1.4 Create Haversine Utility
**File**: `backend/src/common/utils/haversine.ts`
```typescript
export function calculateDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number // Returns km
```

### 1.5 Download & Process Airport Data
**File**: `backend/src/seeds/airports.seed.ts`
- Download OurAirports CSV
- Filter to entries with IATA codes (~6,000 airports)
- Parse and insert into database

---

## Phase 2: Backend Modules

### 2.1 Airports Module
**Files**:
- `backend/src/modules/airports/airports.module.ts`
- `backend/src/modules/airports/airports.service.ts`
- `backend/src/modules/airports/airports.controller.ts`

**Endpoints**:
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/airports` | Search airports (query param: `q`) |
| GET | `/api/airports/:id` | Get single airport |
| GET | `/api/airports/iata/:code` | Get by IATA code |

### 2.2 Flights Module - Core
**Files**:
- `backend/src/modules/flights/flights.module.ts`
- `backend/src/modules/flights/flights.service.ts`
- `backend/src/modules/flights/flights.controller.ts`
- `backend/src/modules/flights/dto/create-flight.dto.ts`
- `backend/src/modules/flights/dto/update-flight.dto.ts`

**Endpoints**:
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/flights` | List all journeys with legs |
| GET | `/api/flights/:id` | Get single journey |
| POST | `/api/flights` | Create journey (with legs) |
| PATCH | `/api/flights/:id` | Update journey |
| DELETE | `/api/flights/:id` | Delete journey |

**Create Flight DTO**:
```typescript
{
  journeyDate: Date
  isRoundTrip: boolean
  notes?: string
  legs: [
    { departureAirportId: number, arrivalAirportId: number },
    { departureAirportId: number, arrivalAirportId: number }
  ]
}
```

**Round-Trip Logic** (in service):
- When `isRoundTrip: true`, automatically append reverse legs
- Example: VAR → IST → LIS becomes VAR → IST → LIS → IST → VAR
- Calculate distance for each leg on creation

### 2.3 Flights Module - Statistics
**File**: `backend/src/modules/flights/flights-stats.service.ts`

**Endpoint**: `GET /api/flights/stats`

**Response Structure**:
```typescript
{
  // Core
  totalFlights: number          // Count of all legs
  totalJourneys: number         // Count of journeys
  totalDistanceKm: number       // Sum of all leg distances

  // By Time
  byYear: { year: number, flights: number, distanceKm: number }[]
  byMonth: { year: number, month: number, flights: number, distanceKm: number }[]
  strongestYear: { year: number, flights: number, distanceKm: number }
  strongestMonth: { year: number, month: number, flights: number, distanceKm: number }

  // Records
  longestFlight: { leg: FlightLeg, distanceKm: number }
  shortestFlight: { leg: FlightLeg, distanceKm: number }
  mostVisitedAirport: { airport: Airport, visitCount: number }
  mostCommonRoute: { from: Airport, to: Airport, count: number }

  // Geographic
  uniqueAirports: number
  uniqueCountries: number
  furthestFromHome: { airport: Airport, distanceKm: number } // If home set

  // Creative
  earthCircumferences: number   // totalKm / 40075
  moonDistancePercent: number   // (totalKm / 384400) * 100
  estimatedFlightHours: number  // totalKm / 800 (avg speed)
  walkingYears: number          // totalKm / (5 * 24 * 365) (5km/h walking)
}
```

---

## Phase 3: Frontend Types & API

### 3.1 TypeScript Types
**File**: `frontend/src/types/index.ts` (extend existing)
```typescript
interface Airport {
  id: number
  iataCode: string
  icaoCode: string
  name: string
  city: string
  country: string
  countryIso: string
  latitude: number
  longitude: number
}

interface FlightLeg {
  id: number
  legOrder: number
  departureAirport: Airport
  arrivalAirport: Airport
  distanceKm: number
}

interface FlightJourney {
  id: number
  journeyDate: string
  isRoundTrip: boolean
  notes: string | null
  legs: FlightLeg[]
  totalDistanceKm: number
  createdAt: string
}

interface FlightStats {
  totalFlights: number
  totalJourneys: number
  totalDistanceKm: number
  // ... all stats fields
}

interface CreateFlightDto {
  journeyDate: string
  isRoundTrip: boolean
  notes?: string
  airportIds: number[]  // [VAR_id, IST_id, LIS_id] - builds legs from chain
}
```

### 3.2 RTK Query Endpoints
**File**: `frontend/src/features/flights/flightsApi.ts`
```typescript
// Endpoints
getAirports(query: string)     // Search airports
getFlights()                   // All journeys
getFlight(id: number)          // Single journey
addFlight(dto: CreateFlightDto)
updateFlight(id, dto)
deleteFlight(id)
getFlightStats()               // Statistics
```

---

## Phase 4: Frontend Components - Input

### 4.1 Airport Search Component
**File**: `frontend/src/components/AirportSearch/AirportSearch.tsx`
- Text input with debounced search
- Dropdown showing matching airports
- Display format: "VAR - Varna Airport (Bulgaria)"
- Props: `onSelect(airport)`, `placeholder`, `value`

### 4.2 Simple Flight Form
**File**: `frontend/src/components/FlightForm/SimpleFlightForm.tsx`
- Departure airport (AirportSearch)
- Arrival airport (AirportSearch)
- Date picker
- Round-trip toggle
- Notes (optional)
- Submit button

### 4.3 Route Builder
**File**: `frontend/src/components/FlightForm/RouteBuilder.tsx`
- Dynamic list of airport inputs
- "Add leg" button
- Visual route display: VAR → IST → LIS
- Drag to reorder legs
- Remove leg button
- Date picker
- Round-trip toggle (shows preview of return legs)
- Notes (optional)

### 4.4 Flight Form Container
**File**: `frontend/src/components/FlightForm/FlightForm.tsx`
- Tab switcher: "Simple" | "Route Builder"
- Renders SimpleFlightForm or RouteBuilder
- Handles submission for both modes

---

## Phase 5: Frontend Components - Display

### 5.1 Flight List
**File**: `frontend/src/components/FlightList/FlightList.tsx`
- List of all journeys
- Each item shows:
  - Route chain: VAR → IST → LIS
  - Date
  - Total distance
  - Round-trip badge
  - Delete button
- Sort options: date, distance

### 5.2 Flight Card
**File**: `frontend/src/components/FlightList/FlightCard.tsx`
- Single journey display
- Expandable to show individual legs

---

## Phase 6: Frontend - Statistics Dashboard

### 6.1 Stats Page
**File**: `frontend/src/pages/FlightsPage.tsx`
- Flight input form (top or sidebar)
- Flight list
- Statistics dashboard
- Flight map

### 6.2 Stats Cards
**File**: `frontend/src/components/FlightStats/`

| Component | Displays |
|-----------|----------|
| `TotalStatsCard.tsx` | Total flights, journeys, distance |
| `TimeStatsCard.tsx` | Strongest year/month with highlights |
| `RecordsCard.tsx` | Longest/shortest flight, most visited |
| `CreativeStatsCard.tsx` | Earth circumferences, moon %, flight hours |
| `GeographyCard.tsx` | Unique airports, countries |

### 6.3 Stats Charts (Optional Enhancement)
- Bar chart: Flights per year
- Line chart: Distance over time
- Could use recharts or chart.js

---

## Phase 7: Frontend - Map Visualization

### 7.1 Flight Routes on World Map
**File**: `frontend/src/components/WorldMap/WorldMap.tsx` (extend existing)
- Add arc lines connecting airports
- Thicker lines for frequently flown routes
- Different color for flight routes vs country highlighting

### 7.2 Dedicated Flight Map
**File**: `frontend/src/components/FlightMap/FlightMap.tsx`
- Full-screen map focused on flight routes
- Airport markers
- Click airport to see flights from/to
- Hover route to see details

---

## Phase 8: Navigation & Integration

### 8.1 Update Layout
- Add "Flights" link to navigation
- Update routes in App.tsx

### 8.2 Home Page Integration
- Optional: Show flight route overlay on main map
- Add quick stats summary

### 8.3 Cross-feature Connection
- When flight lands in new country, show suggestion to add visit
- "Countries reached by flight" indicator

---

## Implementation Order (Granular Steps)

```
Phase 1: Database Foundation
├── 1.1 Create Airport entity
├── 1.2 Create FlightJourney entity
├── 1.3 Create FlightLeg entity
├── 1.4 Create Haversine utility
└── 1.5 Create airport seed script + data

Phase 2: Backend Modules
├── 2.1 Airports module (entity, service, controller)
├── 2.2 Flights module - CRUD (entities, service, controller, DTOs)
└── 2.3 Flights stats service

Phase 3: Frontend Foundation
├── 3.1 Add TypeScript types
└── 3.2 Create RTK Query endpoints

Phase 4: Frontend - Input
├── 4.1 AirportSearch component
├── 4.2 SimpleFlightForm component
├── 4.3 RouteBuilder component
└── 4.4 FlightForm container with tabs

Phase 5: Frontend - Display
├── 5.1 FlightList component
└── 5.2 FlightCard component

Phase 6: Frontend - Statistics
├── 6.1 FlightsPage setup
├── 6.2 TotalStatsCard
├── 6.3 TimeStatsCard
├── 6.4 RecordsCard
├── 6.5 CreativeStatsCard
└── 6.6 GeographyCard

Phase 7: Frontend - Maps
├── 7.1 Add flight routes to WorldMap
└── 7.2 Create dedicated FlightMap

Phase 8: Integration
├── 8.1 Update navigation
├── 8.2 Home page integration
└── 8.3 Cross-feature connections
```

---

## Files to Create (Summary)

### Backend (12 files)
```
backend/src/
├── common/utils/
│   └── haversine.ts
├── modules/
│   ├── airports/
│   │   ├── airports.module.ts
│   │   ├── airports.service.ts
│   │   ├── airports.controller.ts
│   │   └── entities/
│   │       └── airport.entity.ts
│   └── flights/
│       ├── flights.module.ts
│       ├── flights.service.ts
│       ├── flights-stats.service.ts
│       ├── flights.controller.ts
│       ├── entities/
│       │   ├── flight-journey.entity.ts
│       │   └── flight-leg.entity.ts
│       └── dto/
│           ├── create-flight.dto.ts
│           └── update-flight.dto.ts
└── seeds/
    └── airports.seed.ts
```

### Frontend (15+ files)
```
frontend/src/
├── types/index.ts (extend)
├── features/flights/
│   └── flightsApi.ts
├── components/
│   ├── AirportSearch/
│   │   ├── AirportSearch.tsx
│   │   └── index.ts
│   ├── FlightForm/
│   │   ├── FlightForm.tsx
│   │   ├── SimpleFlightForm.tsx
│   │   ├── RouteBuilder.tsx
│   │   └── index.ts
│   ├── FlightList/
│   │   ├── FlightList.tsx
│   │   ├── FlightCard.tsx
│   │   └── index.ts
│   ├── FlightStats/
│   │   ├── TotalStatsCard.tsx
│   │   ├── TimeStatsCard.tsx
│   │   ├── RecordsCard.tsx
│   │   ├── CreativeStatsCard.tsx
│   │   ├── GeographyCard.tsx
│   │   └── index.ts
│   ├── FlightMap/
│   │   ├── FlightMap.tsx
│   │   └── index.ts
│   └── WorldMap/WorldMap.tsx (extend)
└── pages/
    └── FlightsPage.tsx
```

---

## Data: Airport Seed Sample

Example airports in seed:
```typescript
{ iataCode: 'VAR', icaoCode: 'LBWN', name: 'Varna Airport', city: 'Varna', country: 'Bulgaria', countryIso: 'BG', latitude: 43.2329, longitude: 27.8251 }
{ iataCode: 'SOF', icaoCode: 'LBSF', name: 'Sofia Airport', city: 'Sofia', country: 'Bulgaria', countryIso: 'BG', latitude: 42.6952, longitude: 23.4062 }
{ iataCode: 'IST', icaoCode: 'LTFM', name: 'Istanbul Airport', city: 'Istanbul', country: 'Turkey', countryIso: 'TR', latitude: 41.2753, longitude: 28.7519 }
{ iataCode: 'LIS', icaoCode: 'LPPT', name: 'Lisbon Portela Airport', city: 'Lisbon', country: 'Portugal', countryIso: 'PT', latitude: 38.7813, longitude: -9.1359 }
```

---

## Ready for Implementation

This plan covers all confirmed decisions and provides granular steps for each phase. Each phase is independent enough to be completed and tested before moving to the next.
