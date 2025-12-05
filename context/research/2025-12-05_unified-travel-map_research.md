# Unified Travel Map - Research

## Date: 2025-12-05

## Objective
Merge countries (visits) and flights into a single unified map view with the ability to show one, the other, or both layers.

---

## Current Implementation

### Countries/Visits System
- **Page**: `HomePage.tsx`
- **Map**: `WorldMap.tsx` - Shows countries colored by visit status
- **Data**:
  - `Visit` entity: `{ countryId, visitedAt, notes }`
  - `Country` entity: `{ isoCode (3-letter), isoCode2 (2-letter), name }`
- **Interaction**: Click country to toggle visited status

### Flights System
- **Page**: `FlightsPage.tsx`
- **Map**: `FlightMap/` - Shows routes and airport markers
- **Data**:
  - `FlightJourney` entity: `{ journeyDate, isRoundTrip, legs[] }`
  - `FlightLeg` entity: `{ departureAirport, arrivalAirport, distanceKm }`
  - `Airport` entity: `{ iataCode, countryIso (2-letter), city, country }`
- **Interaction**: Hover routes for details, filter by various criteria

### Key Data Relationship
```
Airport.countryIso (2-letter) ←→ Country.isoCode2 (2-letter)
```
This allows mapping flights to countries.

---

## Country Visit Types

### 1. Manual Visits (Existing)
Countries added via the current visit system (road trips, trains, etc.)

### 2. Flight-Based Visits (Derived)
Countries where user has flown to/from. Can be derived from:
- Departure airports
- Arrival airports

### 3. Transit Countries (New Concept)
Countries passed through but not "properly" visited:
- Layover airports (connecting flights)
- Brief stops without leaving the airport

---

## Transit Detection Strategies

### Option A: Explicit Transit Flag on Visit
Add `isTransit: boolean` to Visit entity.
- **Pros**: User has full control
- **Cons**: Requires manual marking, database change

### Option B: Automatic Detection from Flight Patterns
Detect transit based on:
- Same-day departure after arrival
- Layover duration < X hours (e.g., 6 hours)
- No other activities in that country

**Logic:**
```typescript
// If arrival to country X and departure from country X on same journey
// and they're consecutive legs, it's likely a transit
function isTransit(leg: FlightLeg, nextLeg: FlightLeg | null): boolean {
  if (!nextLeg) return false; // Final destination
  return leg.arrivalAirport.countryIso === nextLeg.departureAirport.countryIso;
}
```
- **Pros**: Automatic, no schema change
- **Cons**: May have false positives/negatives

### Option C: Visit Type Enum (Recommended)
Add `visitType: 'trip' | 'transit' | 'layover'` to Visit entity.
- **Pros**: Explicit control, clear semantics
- **Cons**: Database migration required

### Option D: Hybrid - Derived + Override
Auto-detect from flights, but allow user to override classification.
- **Pros**: Best of both worlds
- **Cons**: More complex UI

---

## Unified Map Architecture

### Layer Model
```typescript
type MapLayer = 'countries' | 'flights' | 'both';
type CountryVisitSource = 'manual' | 'flight' | 'both';

interface UnifiedMapState {
  // What to show
  visibleLayers: MapLayer;

  // Country coloring mode
  countryMode: 'visited' | 'flight-countries' | 'combined';

  // Whether to highlight transit differently
  showTransitDifferently: boolean;

  // Existing flight filters
  flightFilters: FlightFilters;
}
```

### Country Coloring Options

| Mode | Description | Colors |
|------|-------------|--------|
| **Visited Only** | Manual visits (current behavior) | Green = visited, Gray = not |
| **Flight Countries** | Countries from flights only | Blue = has flights, Gray = none |
| **Combined** | Both sources merged | Green = manual, Blue = flight-only, Teal = both, Orange = transit |

### Data Flow
```
┌─────────────┐     ┌──────────────┐
│   Visits    │     │   Flights    │
│  (manual)   │     │  (airports)  │
└─────┬───────┘     └──────┬───────┘
      │                    │
      │    ┌───────────────┘
      │    │
      ▼    ▼
┌─────────────────────────────┐
│   Unified Country Set       │
│  - source: manual | flight  │
│  - isTransit: boolean       │
│  - visitCount: number       │
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│   Unified Map Component     │
│  - Country layer (colors)   │
│  - Flight routes layer      │
│  - Airport markers layer    │
└─────────────────────────────┘
```

---

## UI/UX Considerations

### Navigation Options

#### Option 1: Merge into Single Page
Replace both pages with a unified "Travel Map" page.
- **Pros**: Single source of truth, cohesive experience
- **Cons**: More complex page, potentially overwhelming

#### Option 2: Keep Separate + Add Combined View
Keep existing pages, add a third "Overview" page.
- **Pros**: Preserves existing workflows
- **Cons**: Code duplication, feature fragmentation

#### Option 3: Tabbed Interface (Recommended)
Single page with view mode tabs: Countries | Flights | Combined
- **Pros**: Clean UI, easy switching, shared context
- **Cons**: Requires rethinking page structure

### Layer Controls UI
```
┌─────────────────────────────────────────────┐
│  View: [Countries] [Flights] [Combined]     │
├─────────────────────────────────────────────┤
│  Show on map:                               │
│  [✓] Visited countries                      │
│  [✓] Flight routes                          │
│  [✓] Airport markers                        │
│  [ ] Transit countries (different color)    │
├─────────────────────────────────────────────┤
│  Country source: [Manual only ▼]            │
│    • Manual only (your visits list)         │
│    • Flights only (from your flights)       │
│    • Combined (both sources)                │
└─────────────────────────────────────────────┘
```

### Country Legend (Combined Mode)
```
[Green]  Visited (manual)
[Blue]   Flight destination only
[Teal]   Both (visited + flights)
[Orange] Transit only
[Gray]   Not visited
```

---

## Implementation Approach Options

### Approach A: Frontend-Only Derivation
Derive flight countries client-side from existing data.
- No backend changes
- Country set computed from flights in real-time

### Approach B: Backend Enrichment
Add endpoint to get "countries from flights" or enrich visits with flight data.
- Better performance for large datasets
- Enables transit detection on server

### Approach C: Sync Flight Countries to Visits
When adding a flight, auto-create Visit records for destination countries.
- Maintains single source of truth (visits)
- Requires careful handling of transit vs. destination

**Recommendation**: Start with **Approach A** (frontend derivation) for simplicity, then consider **Approach C** if users want persisted flight-based visits.

---

## Relevant Files

### Frontend - Pages
- [HomePage.tsx](frontend/src/pages/HomePage.tsx) - Current countries page
- [FlightsPage.tsx](frontend/src/pages/FlightsPage.tsx) - Current flights page

### Frontend - Maps
- [WorldMap.tsx](frontend/src/components/WorldMap/WorldMap.tsx) - Country map
- [FlightMap/](frontend/src/components/FlightMap/) - Flight map components

### Frontend - State
- [visitsApi.ts](frontend/src/features/visits/visitsApi.ts) - Visits API
- [flightsApi.ts](frontend/src/features/flights/flightsApi.ts) - Flights API

### Backend - Entities
- [visit.entity.ts](backend/src/modules/visits/entities/visit.entity.ts)
- [country.entity.ts](backend/src/modules/countries/entities/country.entity.ts)
- [airport.entity.ts](backend/src/modules/airports/entities/airport.entity.ts)
- [flight-journey.entity.ts](backend/src/modules/flights/entities/flight-journey.entity.ts)

### Shared
- [types/index.ts](frontend/src/types/index.ts) - TypeScript types

---

## Questions for Decision

### 1. Page Structure
- **A)** Merge into single "Travel Map" page?
- **B)** Keep separate pages + add combined view?
- **C)** Tabbed interface on one page?

### 2. Transit Handling
- **A)** Explicit flag on Visit (requires DB change)
- **B)** Auto-detect from flight patterns
- **C)** Visit type enum: trip/transit/layover (DB change)
- **D)** Hybrid: auto-detect + manual override

### 3. Flight Country Persistence
- **A)** Derived only (computed from flights, not saved)
- **B)** Auto-create Visit records from flights
- **C)** Let user manually "claim" flight countries as visits

### 4. Default View
- **A)** Countries only (current behavior)
- **B)** Combined view as default
- **C)** User preference (remember last selection)

---

## Complexity Estimate

| Component | Complexity | Notes |
|-----------|------------|-------|
| Unified map component | Medium | Merge WorldMap + FlightMap |
| Layer toggle UI | Low | Simple toggles |
| Country derivation from flights | Low | Frontend computation |
| Transit detection | Medium | Logic + potential DB changes |
| Visit type enum (if chosen) | Medium | DB migration + API changes |
| Tabbed page structure | Low-Medium | Routing + state management |

---

## Next Steps
1. Confirm decisions on questions above
2. Create implementation plan
3. Implement in phases:
   - Phase 1: Unified map with layer toggles
   - Phase 2: Flight-derived countries
   - Phase 3: Transit detection (if desired)
