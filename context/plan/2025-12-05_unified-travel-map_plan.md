# Unified Travel Map - Implementation Plan

## Date: 2025-12-05

## Confirmed Decisions
1. **Page Structure**: Merge into single "Travel Map" page
2. **Transit Handling**: Auto-detect from flight patterns + allow manual override
3. **Flight Countries**: Auto-create Visit records from flights, allow modify/delete
4. **Colors**: Include home country with special color

---

## Color Scheme

| Visit Type | Color | Hex |
|------------|-------|-----|
| Home Country | Purple | `#8b5cf6` |
| Visited (trip) | Green | `#22c55e` |
| Flight Only | Blue | `#3b82f6` |
| Both (trip + flight) | Teal | `#14b8a6` |
| Transit | Orange | `#f59e0b` |
| Not Visited | Gray | `#d1d5db` |

---

## Implementation Phases

### Phase 1: Backend Changes

#### 1.1 Update Visit Entity
Add `visitType` enum to track how country was visited:
```typescript
// visit.entity.ts
@Column({
  name: 'visit_type',
  type: 'enum',
  enum: ['trip', 'transit', 'home'],
  default: 'trip'
})
visitType: 'trip' | 'transit' | 'home';

@Column({ name: 'source', type: 'enum', enum: ['manual', 'flight'], default: 'manual' })
source: 'manual' | 'flight';

@Column({ name: 'flight_journey_id', nullable: true })
flightJourneyId: number | null;
```

#### 1.2 Database Migration
- Add `visit_type` column with default 'trip'
- Add `source` column with default 'manual'
- Add `flight_journey_id` for linking visits to flights

#### 1.3 Update Flights Service
Auto-create visits when flight is added:
```typescript
async createFlightWithVisits(dto: CreateFlightDto) {
  const journey = await this.create(dto);

  // Extract unique countries from legs
  const countries = this.extractCountriesFromLegs(journey.legs);

  // Detect transit countries
  const transitCountries = this.detectTransitCountries(journey.legs);

  // Create visit records
  for (const countryIso of countries) {
    const isTransit = transitCountries.has(countryIso);
    await this.visitsService.createFromFlight({
      countryIso,
      visitType: isTransit ? 'transit' : 'trip',
      source: 'flight',
      flightJourneyId: journey.id,
      journeyDate: journey.journeyDate,
    });
  }

  return journey;
}
```

#### 1.4 Transit Detection Logic
```typescript
detectTransitCountries(legs: FlightLeg[]): Set<string> {
  const transit = new Set<string>();

  for (let i = 0; i < legs.length - 1; i++) {
    const currentArrival = legs[i].arrivalAirport.countryIso;
    const nextDeparture = legs[i + 1].departureAirport.countryIso;

    // If we arrive and depart from same country in consecutive legs = transit
    if (currentArrival === nextDeparture) {
      transit.add(currentArrival);
    }
  }

  return transit;
}
```

#### 1.5 Update Visit DTOs
```typescript
// create-visit.dto.ts
export class CreateVisitDto {
  countryId?: number;
  countryIso?: string; // Alternative to countryId
  visitedAt?: string;
  notes?: string;
  visitType?: 'trip' | 'transit' | 'home';
  source?: 'manual' | 'flight';
  flightJourneyId?: number;
}

// update-visit.dto.ts
export class UpdateVisitDto {
  visitedAt?: string;
  notes?: string;
  visitType?: 'trip' | 'transit' | 'home'; // Allow override
}
```

---

### Phase 2: Frontend - Unified Map Component

#### 2.1 New Component Structure
```
frontend/src/components/TravelMap/
├── index.ts
├── TravelMap.tsx           # Main unified component
├── TravelMapLayers.tsx     # Layer toggle controls
├── TravelMapLegend.tsx     # Color legend
├── CountryLayer.tsx        # Country polygons with colors
├── FlightLayer.tsx         # Routes + airports (reuse existing)
├── HomeCountrySelector.tsx # Set home country
├── VisitTypeEditor.tsx     # Edit visit type modal
├── mapUtils.ts             # Shared utilities
└── types.ts                # Unified types
```

#### 2.2 TravelMap State
```typescript
interface TravelMapState {
  // Layer visibility
  showCountries: boolean;
  showFlights: boolean;
  showAirports: boolean;

  // Flight filters (existing)
  flightFilters: FlightFilters;

  // Country display options
  highlightTransit: boolean;

  // Home country
  homeCountryIso: string | null;
}
```

#### 2.3 Country Data Aggregation
```typescript
interface CountryVisitInfo {
  isoCode: string;
  name: string;
  visitType: 'home' | 'trip' | 'transit' | 'flight-only' | 'none';
  source: 'manual' | 'flight' | 'both';
  visits: Visit[];
  hasFlights: boolean;
}

function aggregateCountryData(
  visits: Visit[],
  flights: FlightJourney[],
  homeCountryIso: string | null
): Map<string, CountryVisitInfo>
```

---

### Phase 3: Frontend - Page Restructure

#### 3.1 New TravelMapPage
Replace HomePage + FlightsPage with unified page:
```typescript
// pages/TravelMapPage.tsx
function TravelMapPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header with layer toggles */}
        <TravelMapHeader />

        {/* Main map */}
        <TravelMap />

        {/* Tabbed content below */}
        <Tabs defaultValue="overview">
          <TabsList>
            <Tab value="overview">Overview</Tab>
            <Tab value="countries">Countries</Tab>
            <Tab value="flights">Flights</Tab>
            <Tab value="stats">Statistics</Tab>
          </TabsList>

          <TabContent value="overview">
            <CombinedStats />
          </TabContent>
          <TabContent value="countries">
            <CountryList />
            <CountrySelector />
          </TabContent>
          <TabContent value="flights">
            <FlightForm />
            <FlightList />
          </TabContent>
          <TabContent value="stats">
            <FlightStats />
          </TabContent>
        </Tabs>
      </div>
    </div>
  );
}
```

#### 3.2 Update Routing
```typescript
// App.tsx
<Routes>
  <Route path="/" element={<Layout />}>
    <Route index element={<TravelMapPage />} />
  </Route>
</Routes>
```

#### 3.3 Update Layout Navigation
Remove Countries/Flights tabs, single "Travel Map" destination.

---

### Phase 4: Home Country Feature

#### 4.1 Storage Options
**Option A**: Special visit with `visitType: 'home'`
- No new table needed
- Home country is just another visit

**Option B**: User settings table
```typescript
@Entity('user_settings')
export class UserSettings {
  @PrimaryColumn()
  key: string;

  @Column()
  value: string;
}
```

**Recommendation**: Option A (visit with type 'home') - simpler, no new infrastructure.

#### 4.2 Home Country Selector UI
```typescript
// HomeCountrySelector.tsx
function HomeCountrySelector({
  countries,
  currentHome,
  onSetHome
}: Props) {
  return (
    <div className="flex items-center gap-2">
      <label>Home Country:</label>
      <select
        value={currentHome || ''}
        onChange={(e) => onSetHome(e.target.value)}
      >
        <option value="">Not set</option>
        {countries.map(c => (
          <option key={c.isoCode} value={c.isoCode}>
            {c.name}
          </option>
        ))}
      </select>
    </div>
  );
}
```

---

## File Changes Summary

### Backend (New/Modified)
| File | Change |
|------|--------|
| `visit.entity.ts` | Add visitType, source, flightJourneyId columns |
| `create-visit.dto.ts` | Add new fields |
| `update-visit.dto.ts` | Add visitType for override |
| `visits.service.ts` | Add createFromFlight method |
| `flights.service.ts` | Auto-create visits on flight creation |
| Migration file | Add new columns |

### Frontend (New)
| File | Description |
|------|-------------|
| `components/TravelMap/` | New unified map component |
| `pages/TravelMapPage.tsx` | New merged page |

### Frontend (Modified)
| File | Change |
|------|--------|
| `App.tsx` | Update routes |
| `Layout.tsx` | Simplify navigation |
| `types/index.ts` | Update Visit type |

### Frontend (Deprecated)
| File | Status |
|------|--------|
| `pages/HomePage.tsx` | Remove |
| `pages/FlightsPage.tsx` | Remove |
| `components/WorldMap/` | Merge into TravelMap |

---

## Implementation Order

1. **Backend: Visit entity changes** + migration
2. **Backend: Update visit service** with new create method
3. **Backend: Update flights service** for auto-visit creation
4. **Frontend: Create TravelMap component** (merge WorldMap + FlightMap)
5. **Frontend: Create TravelMapPage** with tabs
6. **Frontend: Update routing** and navigation
7. **Frontend: Add home country feature**
8. **Frontend: Add visit type editing**
9. **Test & cleanup** deprecated files

---

## Estimated Scope
- Backend: ~200 lines new/modified
- Frontend: ~500 lines new, ~300 lines modified
- Migration: 1 migration file
