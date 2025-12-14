# Plan: Intelligent Flight Exploration System

**Date**: 2025-12-06
**Feature**: Flexible date search, vacation duration, hub exploration, travel time optimization
**Architecture**: Option B - Multi-Search Aggregation

---

## Confirmed Decisions

| Decision | Choice |
|----------|--------|
| Architecture | Multi-Search Aggregation (parallel hub searches) |
| API | Keep RapidAPI for now, migrate to Kiwi Tequila if insufficient |
| Hub Database | Hybrid (known hubs + validation before search) |
| Caching | Short-term shared cache (15-30 min TTL) |
| Scoring Weights | Price 40%, Duration 35%, Convenience 25% |
| UI Approach | Full overhaul of search form + results |
| Background Jobs | Future improvement (Phase 6 outlined only) |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND                                  │
├─────────────────────────────────────────────────────────────────┤
│  FlexibleSearchForm                                              │
│  ├── DateSelector (specific / month / range)                    │
│  ├── DurationPicker (min-max nights)                            │
│  ├── HubPreferences (preferred / excluded)                      │
│  └── TravelPreferences (max hours, asymmetric toggle)           │
│                                                                  │
│  ExplorationResults                                              │
│  ├── HighlightedOptions (recommended, cheapest, fastest)        │
│  ├── GroupedResults (by date, by route)                         │
│  ├── InsightsPanel                                               │
│  └── FilterSidebar                                               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        BACKEND                                   │
├─────────────────────────────────────────────────────────────────┤
│  FlightExplorationController                                     │
│  └── POST /flights/explore                                       │
│                                                                  │
│  FlightExplorationService                                        │
│  ├── validateHubAvailability()                                  │
│  ├── generateSearchPermutations()                               │
│  ├── executeParallelSearches()                                  │
│  ├── aggregateResults()                                          │
│  ├── scoreAndRank()                                              │
│  └── generateInsights()                                          │
│                                                                  │
│  HubService                                                      │
│  ├── getKnownHubs()                                              │
│  ├── validateHubRoute(origin, hub)                              │
│  └── getHubStrengths(hub, destination)                          │
│                                                                  │
│  TravelTimeScoringService                                        │
│  ├── categorizeDestination(origin, destination)                 │
│  ├── getExpectedTravelTime(category)                            │
│  └── scoreTravelTime(actual, expected)                          │
│                                                                  │
│  CacheService                                                    │
│  └── Redis/Memory cache with 15-30 min TTL                      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     EXTERNAL API                                 │
│                   (RapidAPI Kiwi)                                │
└─────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Flexible Dates & Duration

**Goal**: Allow users to search with date ranges and vacation duration instead of fixed dates.

### 1.1 Backend Changes

#### New DTO: `FlexibleSearchDto`

```typescript
// backend/src/modules/flights/dto/flexible-search.dto.ts

export enum DateType {
  SPECIFIC = 'specific',
  MONTH = 'month',
  RANGE = 'range',
}

export class FlexibleSearchDto {
  @IsString()
  origin: string;

  @IsString()
  destination: string;

  @IsEnum(DateType)
  dateType: DateType;

  // For SPECIFIC date type
  @IsOptional()
  @IsDateString()
  departureDate?: string;

  @IsOptional()
  @IsDateString()
  returnDate?: string;

  // For MONTH date type
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}$/)  // "2025-03"
  month?: string;

  // For RANGE date type
  @IsOptional()
  @IsDateString()
  dateRangeStart?: string;

  @IsOptional()
  @IsDateString()
  dateRangeEnd?: string;

  // Duration (used with MONTH and RANGE)
  @IsInt()
  @Min(1)
  @Max(30)
  minNights: number;

  @IsInt()
  @Min(1)
  @Max(30)
  maxNights: number;

  @IsInt()
  @Min(1)
  @Max(9)
  passengers: number;

  @IsEnum(CabinClass)
  cabinClass: CabinClass;
}
```

#### Update Kiwi Service

```typescript
// Add method to build flexible search params
buildFlexibleSearchParams(dto: FlexibleSearchDto): KiwiSearchParams {
  const params: KiwiSearchParams = {
    fly_from: dto.origin,
    fly_to: dto.destination,
    adults: dto.passengers,
    selected_cabins: dto.cabinClass,
  };

  switch (dto.dateType) {
    case DateType.SPECIFIC:
      params.date_from = formatDate(dto.departureDate);
      params.date_to = formatDate(dto.departureDate);
      params.return_from = formatDate(dto.returnDate);
      params.return_to = formatDate(dto.returnDate);
      break;

    case DateType.MONTH:
      const { start, end } = getMonthBounds(dto.month);
      params.date_from = formatDate(start);
      params.date_to = formatDate(end);
      params.nights_in_dst_from = dto.minNights;
      params.nights_in_dst_to = dto.maxNights;
      break;

    case DateType.RANGE:
      params.date_from = formatDate(dto.dateRangeStart);
      params.date_to = formatDate(dto.dateRangeEnd);
      params.nights_in_dst_from = dto.minNights;
      params.nights_in_dst_to = dto.maxNights;
      break;
  }

  return params;
}
```

#### New Controller Endpoint

```typescript
// backend/src/modules/flights/flights.controller.ts

@Post('explore')
async exploreFlights(@Body() dto: FlexibleSearchDto): Promise<FlightExplorationResultDto> {
  return this.flightExplorationService.explore(dto);
}
```

### 1.2 Frontend Changes

#### New Search Form Component

Location: `frontend/src/features/flightSearch/components/FlexibleSearchForm.tsx`

**Form Fields:**
- Origin airport (existing autocomplete)
- Destination airport (existing autocomplete)
- Date type toggle: Specific / Flexible
- If Specific: departure + return date pickers
- If Flexible:
  - Month selector OR date range picker
  - Duration: min nights, max nights (number inputs)
- Passengers (existing)
- Cabin class (existing)

#### New Redux Slice

Location: `frontend/src/features/flightSearch/slices/flexibleSearchSlice.ts`

State shape:
```typescript
interface FlexibleSearchState {
  form: FlexibleSearchDto;
  results: FlightExplorationResultDto | null;
  isLoading: boolean;
  error: string | null;
}
```

#### RTK Query Endpoint

```typescript
exploreFlights: builder.mutation<FlightExplorationResultDto, FlexibleSearchDto>({
  query: (body) => ({
    url: '/flights/explore',
    method: 'POST',
    body,
  }),
}),
```

### 1.3 Tasks

- [ ] Create `FlexibleSearchDto` with validation
- [ ] Create `FlightExplorationResultDto` response type
- [ ] Add `buildFlexibleSearchParams()` to Kiwi service
- [ ] Create `FlightExplorationService` with basic explore method
- [ ] Add `POST /flights/explore` endpoint
- [ ] Create `FlexibleSearchForm` component
- [ ] Add date type toggle (specific/flexible)
- [ ] Add month selector component
- [ ] Add date range picker component
- [ ] Add duration picker (min/max nights)
- [ ] Create RTK Query mutation
- [ ] Create Redux slice for exploration state
- [ ] Wire up form submission to API

---

## Phase 2: Travel Time Scoring

**Goal**: Score and filter results based on reasonable travel time for the distance.

### 2.1 Destination Categorization

```typescript
// backend/src/modules/flights/services/travel-time-scoring.service.ts

interface DistanceCategory {
  name: string;
  maxDistanceKm: number;
  expectedMaxHours: number;
  unreasonableAboveHours: number;
}

const DISTANCE_CATEGORIES: DistanceCategory[] = [
  { name: 'short-haul', maxDistanceKm: 2000, expectedMaxHours: 8, unreasonableAboveHours: 12 },
  { name: 'medium-haul', maxDistanceKm: 6000, expectedMaxHours: 14, unreasonableAboveHours: 20 },
  { name: 'long-haul', maxDistanceKm: 12000, expectedMaxHours: 22, unreasonableAboveHours: 32 },
  { name: 'ultra-long', maxDistanceKm: 20000, expectedMaxHours: 32, unreasonableAboveHours: 45 },
];
```

### 2.2 Scoring Algorithm

```typescript
@Injectable()
export class TravelTimeScoringService {
  // Calculate great-circle distance between airports
  calculateDistance(originCoords: Coordinates, destCoords: Coordinates): number;

  // Get category based on distance
  getCategory(distanceKm: number): DistanceCategory;

  // Score travel time (0-100)
  scoreTravelTime(actualHours: number, distanceKm: number): number {
    const category = this.getCategory(distanceKm);

    if (actualHours <= category.expectedMaxHours) {
      return 100; // Perfect
    }
    if (actualHours <= category.expectedMaxHours * 1.25) {
      return 75; // Good
    }
    if (actualHours <= category.unreasonableAboveHours) {
      return 50; // Acceptable
    }
    return 25; // Show but flag as long
  }
}
```

### 2.3 Airport Coordinates

Need airport coordinates for distance calculation:

```typescript
// backend/src/modules/flights/data/airports.ts

export const AIRPORT_COORDINATES: Record<string, { lat: number; lon: number }> = {
  'VAR': { lat: 43.2329, lon: 27.8251 },
  'HKT': { lat: 8.1132, lon: 98.3169 },
  'IST': { lat: 41.2753, lon: 28.7519 },
  // ... more airports
};

// Or fetch from API/database
```

### 2.4 Tasks

- [ ] Create `TravelTimeScoringService`
- [ ] Implement great-circle distance calculation (Haversine formula)
- [ ] Define distance categories with thresholds
- [ ] Implement `scoreTravelTime()` method
- [ ] Create airport coordinates data file (start with common airports)
- [ ] Add travel time score to `FlightOptionDto`
- [ ] Add "unreasonable travel time" flag to results
- [ ] Integrate scoring into result aggregation

---

## Phase 3: Hub Exploration

**Goal**: Search through multiple connection hubs to find the best routes.

### 3.1 Hub Knowledge Base

```typescript
// backend/src/modules/flights/data/hubs.ts

export interface Hub {
  code: string;
  name: string;
  region: string;
  seasonalFromVarna: boolean;  // true = summer only
  strongForRegions: string[];  // regions this hub connects well to
  majorCarriers: string[];
  minConnectionMinutes: number;
}

export const KNOWN_HUBS: Hub[] = [
  {
    code: 'IST',
    name: 'Istanbul',
    region: 'Europe-East',
    seasonalFromVarna: false,
    strongForRegions: ['Southeast Asia', 'Middle East', 'Africa', 'Indian Subcontinent'],
    majorCarriers: ['TK', 'PC'],
    minConnectionMinutes: 90,
  },
  {
    code: 'VIE',
    name: 'Vienna',
    region: 'Europe-Central',
    seasonalFromVarna: true,
    strongForRegions: ['Europe', 'North America'],
    majorCarriers: ['OS'],
    minConnectionMinutes: 60,
  },
  {
    code: 'FRA',
    name: 'Frankfurt',
    region: 'Europe-Central',
    seasonalFromVarna: true,
    strongForRegions: ['Worldwide'],
    majorCarriers: ['LH'],
    minConnectionMinutes: 60,
  },
  {
    code: 'MUC',
    name: 'Munich',
    region: 'Europe-Central',
    seasonalFromVarna: true,
    strongForRegions: ['Europe', 'Americas'],
    majorCarriers: ['LH'],
    minConnectionMinutes: 45,
  },
  {
    code: 'LHR',
    name: 'London Heathrow',
    region: 'Europe-West',
    seasonalFromVarna: true,
    strongForRegions: ['Worldwide'],
    majorCarriers: ['BA'],
    minConnectionMinutes: 90,
  },
  {
    code: 'AMS',
    name: 'Amsterdam',
    region: 'Europe-West',
    seasonalFromVarna: true,
    strongForRegions: ['Worldwide'],
    majorCarriers: ['KL'],
    minConnectionMinutes: 50,
  },
  {
    code: 'SOF',
    name: 'Sofia',
    region: 'Balkans',
    seasonalFromVarna: false,
    strongForRegions: ['Europe', 'Middle East'],
    majorCarriers: ['FB'],
    minConnectionMinutes: 45,
  },
  {
    code: 'OTP',
    name: 'Bucharest',
    region: 'Balkans',
    seasonalFromVarna: false,
    strongForRegions: ['Europe', 'Middle East'],
    majorCarriers: ['RO'],
    minConnectionMinutes: 45,
  },
];
```

### 3.2 Hub Service

```typescript
// backend/src/modules/flights/services/hub.service.ts

@Injectable()
export class HubService {
  constructor(private kiwiService: KiwiService) {}

  // Get hubs relevant for a destination region
  getRelevantHubs(destinationRegion: string): Hub[] {
    return KNOWN_HUBS.filter(hub =>
      hub.strongForRegions.includes(destinationRegion) ||
      hub.strongForRegions.includes('Worldwide')
    );
  }

  // Validate that a route exists (quick API check with caching)
  async validateHubRoute(origin: string, hub: string, date: string): Promise<boolean> {
    const cacheKey = `route:${origin}:${hub}:${date.substring(0, 7)}`; // cache per month

    const cached = await this.cacheService.get(cacheKey);
    if (cached !== undefined) return cached;

    // Quick search to verify route exists
    const result = await this.kiwiService.quickRouteCheck(origin, hub, date);
    const exists = result.flights.length > 0;

    await this.cacheService.set(cacheKey, exists, 24 * 60 * 60); // 24h cache
    return exists;
  }

  // Get validated hubs for a specific search
  async getValidatedHubs(
    origin: string,
    destination: string,
    departureMonth: string,
    preferredHubs?: string[],
    excludedHubs?: string[]
  ): Promise<Hub[]> {
    let hubs = this.getRelevantHubs(this.getDestinationRegion(destination));

    // Apply user preferences
    if (preferredHubs?.length) {
      hubs = hubs.filter(h => preferredHubs.includes(h.code));
    }
    if (excludedHubs?.length) {
      hubs = hubs.filter(h => !excludedHubs.includes(h.code));
    }

    // Validate each hub route exists
    const validationResults = await Promise.all(
      hubs.map(async hub => ({
        hub,
        valid: await this.validateHubRoute(origin, hub.code, departureMonth),
      }))
    );

    return validationResults.filter(r => r.valid).map(r => r.hub);
  }
}
```

### 3.3 Exploration Orchestrator

```typescript
// backend/src/modules/flights/services/flight-exploration.service.ts

@Injectable()
export class FlightExplorationService {
  constructor(
    private hubService: HubService,
    private kiwiService: KiwiService,
    private scoringService: TravelTimeScoringService,
    private cacheService: CacheService,
  ) {}

  async explore(dto: FlexibleSearchDto & HubPreferencesDto): Promise<FlightExplorationResultDto> {
    // 1. Get validated hubs
    const validHubs = await this.hubService.getValidatedHubs(
      dto.origin,
      dto.destination,
      dto.month || dto.dateRangeStart,
      dto.preferredHubs,
      dto.excludeHubs,
    );

    // 2. Generate search permutations
    const searches = this.generateSearchPermutations(dto, validHubs);

    // 3. Execute searches in parallel (with rate limiting)
    const results = await this.executeParallelSearches(searches);

    // 4. Aggregate and deduplicate
    const aggregated = this.aggregateResults(results);

    // 5. Score and rank
    const scored = this.scoreAndRank(aggregated, dto);

    // 6. Generate insights
    const insights = this.generateInsights(scored, validHubs);

    // 7. Build response
    return this.buildExplorationResult(scored, insights);
  }

  private generateSearchPermutations(
    dto: FlexibleSearchDto,
    hubs: Hub[]
  ): SearchPermutation[] {
    const permutations: SearchPermutation[] = [];

    // Direct search (no hub)
    permutations.push({
      type: 'direct',
      origin: dto.origin,
      destination: dto.destination,
      ...this.extractDateParams(dto),
    });

    // Via each hub
    for (const hub of hubs) {
      permutations.push({
        type: 'via-hub',
        hub: hub.code,
        origin: dto.origin,
        destination: dto.destination,
        ...this.extractDateParams(dto),
      });
    }

    return permutations;
  }

  private async executeParallelSearches(
    searches: SearchPermutation[]
  ): Promise<SearchResult[]> {
    // Rate limit: max 5 concurrent requests
    const results: SearchResult[] = [];
    const batchSize = 5;

    for (let i = 0; i < searches.length; i += batchSize) {
      const batch = searches.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(search => this.executeSearch(search))
      );
      results.push(...batchResults);
    }

    return results;
  }
}
```

### 3.4 Tasks

- [ ] Create `hubs.ts` data file with known hubs
- [ ] Create `HubService`
- [ ] Implement `getRelevantHubs()` - filter by destination region
- [ ] Implement `validateHubRoute()` - quick check with caching
- [ ] Implement `getValidatedHubs()` - combine filtering and validation
- [ ] Create `FlightExplorationService`
- [ ] Implement `generateSearchPermutations()`
- [ ] Implement `executeParallelSearches()` with rate limiting
- [ ] Implement `aggregateResults()` with deduplication
- [ ] Add hub preferences to DTO (`preferredHubs`, `excludeHubs`)
- [ ] Add hub selection UI to search form
- [ ] Display hub info in results (which hub was used)

---

## Phase 4: Asymmetric Routing

**Goal**: Allow different connection hubs for outbound and return flights.

### 4.1 Enhanced Search Logic

```typescript
// Extend FlexibleSearchDto
export class FlexibleSearchDto {
  // ... existing fields ...

  @IsBoolean()
  allowAsymmetricRouting: boolean;
}

// New permutation generation for asymmetric
private generateAsymmetricPermutations(
  dto: FlexibleSearchDto,
  hubs: Hub[]
): SearchPermutation[] {
  if (!dto.allowAsymmetricRouting) return [];

  const permutations: SearchPermutation[] = [];

  // For each outbound hub, try each return hub
  for (const outboundHub of hubs) {
    for (const returnHub of hubs) {
      if (outboundHub.code === returnHub.code) continue; // Skip symmetric

      permutations.push({
        type: 'asymmetric',
        outboundHub: outboundHub.code,
        returnHub: returnHub.code,
        origin: dto.origin,
        destination: dto.destination,
        ...this.extractDateParams(dto),
      });
    }
  }

  return permutations;
}
```

### 4.2 Combining Outbound + Return

For asymmetric routing, we may need to search outbound and return separately:

```typescript
async searchAsymmetric(permutation: AsymmetricPermutation): Promise<FlightOption[]> {
  // Search outbound: origin → hub1 → destination
  const outboundResults = await this.kiwiService.searchOneWay({
    from: permutation.origin,
    to: permutation.destination,
    via: permutation.outboundHub,
    ...permutation.dateParams,
  });

  // Search return: destination → hub2 → origin
  const returnResults = await this.kiwiService.searchOneWay({
    from: permutation.destination,
    to: permutation.origin,
    via: permutation.returnHub,
    ...permutation.returnDateParams,
  });

  // Combine compatible outbound + return flights
  return this.combineFlights(outboundResults, returnResults, permutation);
}

private combineFlights(
  outbound: Flight[],
  returns: Flight[],
  permutation: AsymmetricPermutation
): FlightOption[] {
  const combinations: FlightOption[] = [];

  for (const out of outbound) {
    for (const ret of returns) {
      // Check if combination is valid (return after outbound, respects min/max nights)
      const nightsAtDest = this.calculateNights(out.arrivalDate, ret.departureDate);

      if (nightsAtDest >= permutation.minNights &&
          nightsAtDest <= permutation.maxNights) {
        combinations.push({
          outbound: out,
          return: ret,
          totalPrice: out.price + ret.price,
          isAsymmetric: true,
          outboundHub: permutation.outboundHub,
          returnHub: permutation.returnHub,
        });
      }
    }
  }

  return combinations;
}
```

### 4.3 Asymmetric Flag in Results

```typescript
interface FlightOptionDto {
  // ... existing fields ...

  isAsymmetric: boolean;
  outboundHub?: string;  // "VIE"
  returnHub?: string;    // "LHR"
  asymmetricNote?: string; // "Outbound via Vienna, return via London"
}
```

### 4.4 Tasks

- [ ] Add `allowAsymmetricRouting` to DTO
- [ ] Implement `generateAsymmetricPermutations()`
- [ ] Implement `searchAsymmetric()` - separate outbound/return searches
- [ ] Implement `combineFlights()` - pair compatible flights
- [ ] Add asymmetric info to `FlightOptionDto`
- [ ] Add asymmetric toggle to search form UI
- [ ] Display asymmetric routing info in results
- [ ] Add visual indicator for asymmetric routes

---

## Phase 5: UI Overhaul

**Goal**: Complete redesign of search form and results presentation.

### 5.1 New Search Form Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  EXPLORE FLIGHTS                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  From                          To                                │
│  ┌─────────────────────┐      ┌─────────────────────┐           │
│  │ Varna (VAR)     [x] │  →   │ Phuket (HKT)    [x] │           │
│  └─────────────────────┘      └─────────────────────┘           │
│                                                                  │
│  ─────────────────────────────────────────────────────────────  │
│                                                                  │
│  When do you want to travel?                                     │
│                                                                  │
│  ( ) Specific dates                                              │
│      Departure: [________]  Return: [________]                  │
│                                                                  │
│  (●) Flexible dates                                              │
│      ┌─────────────────────────────────────────────────┐        │
│      │  ( ) Entire month    (●) Date range             │        │
│      │                                                  │        │
│      │  Month: [March 2025 ▼]                          │        │
│      │    OR                                            │        │
│      │  From: [________]  To: [________]               │        │
│      └─────────────────────────────────────────────────┘        │
│                                                                  │
│  How long do you want to stay?                                   │
│  ┌──────────────────────────────────────────────────────┐       │
│  │  [7] nights  to  [10] nights                         │       │
│  └──────────────────────────────────────────────────────┘       │
│                                                                  │
│  ─────────────────────────────────────────────────────────────  │
│                                                                  │
│  ▼ Travel Preferences (expandable)                              │
│  ┌──────────────────────────────────────────────────────┐       │
│  │  Max travel time (each way): [24] hours              │       │
│  │                                                       │       │
│  │  Connection hubs:                                     │       │
│  │  [✓] Istanbul  [✓] Vienna  [✓] Frankfurt             │       │
│  │  [ ] Munich    [ ] London  [ ] Amsterdam             │       │
│  │  [+ Add custom hub]                                  │       │
│  │                                                       │       │
│  │  [✓] Allow different routing for return flight       │       │
│  └──────────────────────────────────────────────────────┘       │
│                                                                  │
│  ─────────────────────────────────────────────────────────────  │
│                                                                  │
│  Travelers: [2 ▼]    Cabin: [Economy ▼]                         │
│                                                                  │
│           ┌─────────────────────────────┐                       │
│           │     🔍 Explore Flights      │                       │
│           └─────────────────────────────┘                       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 Results Page Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  Varna → Phuket                                                  │
│  March 2025 • 7-10 nights • 2 travelers                         │
│  [Edit Search]                                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─ INSIGHTS ────────────────────────────────────────────────┐  │
│  │ 💡 Istanbul connections are 3h faster on average          │  │
│  │ 💰 Mid-March departures are $60 cheaper                   │  │
│  │ ⚠️ March 15-20 has limited availability                   │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ─────────────────────────────────────────────────────────────  │
│                                                                  │
│  ┌─ HIGHLIGHTS ──────────────────────────────────────────────┐  │
│  │                                                            │  │
│  │  ⭐ RECOMMENDED              💰 CHEAPEST                   │  │
│  │  ┌──────────────────┐       ┌──────────────────┐          │  │
│  │  │ Mar 8-15         │       │ Mar 12-22        │          │  │
│  │  │ via Istanbul     │       │ via Vienna/London│          │  │
│  │  │ 14h 20m • 1 stop │       │ 18h • 2 stops    │          │  │
│  │  │ $487             │       │ $412             │          │  │
│  │  │ [View Details]   │       │ [View Details]   │          │  │
│  │  └──────────────────┘       └──────────────────┘          │  │
│  │                                                            │  │
│  │  ⚡ FASTEST                                                │  │
│  │  ┌──────────────────┐                                     │  │
│  │  │ Mar 10-18        │                                     │  │
│  │  │ via Istanbul     │                                     │  │
│  │  │ 13h 45m • 1 stop │                                     │  │
│  │  │ $512             │                                     │  │
│  │  │ [View Details]   │                                     │  │
│  │  └──────────────────┘                                     │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ─────────────────────────────────────────────────────────────  │
│                                                                  │
│  VIEW BY:  [By Date]  [By Route]  [All Results]                 │
│                                                                  │
│  ┌─ BY DATE ─────────────────────────────────────────────────┐  │
│  │                                                            │  │
│  │  📅 March 1-8                                              │  │
│  │     12 options • from $445 • best: 14h via IST            │  │
│  │     [Expand]                                               │  │
│  │                                                            │  │
│  │  📅 March 8-15                                 ⭐ BEST     │  │
│  │     15 options • from $412 • best: 13h via IST            │  │
│  │     [Expand]                                               │  │
│  │                                                            │  │
│  │  📅 March 15-22                                            │  │
│  │     18 options • from $398 • best: 15h via VIE            │  │
│  │     [Expand]                                               │  │
│  │                                                            │  │
│  │  📅 March 22-31                                            │  │
│  │     8 options • from $521 • best: 14h via IST             │  │
│  │     [Expand]                                               │  │
│  │                                                            │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌─ FILTERS ─────────────────────────────────────────────────┐  │
│  │  Price: [$300] ───●─── [$800]                             │  │
│  │  Duration: [8h] ───●─── [30h]                             │  │
│  │  Stops: [ ] Direct  [✓] 1 stop  [✓] 2+ stops             │  │
│  │  Hubs: [✓] IST [✓] VIE [✓] FRA [ ] LHR                   │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 5.3 Component Structure

```
frontend/src/features/flightSearch/
├── components/
│   ├── FlexibleSearchForm/
│   │   ├── FlexibleSearchForm.tsx
│   │   ├── AirportSelector.tsx (reuse existing)
│   │   ├── DateTypeToggle.tsx
│   │   ├── MonthSelector.tsx
│   │   ├── DateRangePicker.tsx
│   │   ├── DurationPicker.tsx
│   │   ├── TravelPreferences.tsx
│   │   ├── HubSelector.tsx
│   │   └── index.ts
│   │
│   ├── ExplorationResults/
│   │   ├── ExplorationResults.tsx
│   │   ├── InsightsPanel.tsx
│   │   ├── HighlightCards.tsx
│   │   ├── ResultTabs.tsx
│   │   ├── DateGroupedResults.tsx
│   │   ├── RouteGroupedResults.tsx
│   │   ├── AllResultsList.tsx
│   │   ├── FlightOptionCard.tsx
│   │   ├── ResultFilters.tsx
│   │   └── index.ts
│   │
│   └── shared/
│       ├── FlightLegDisplay.tsx
│       ├── PriceDisplay.tsx
│       ├── DurationDisplay.tsx
│       └── HubBadge.tsx
│
├── slices/
│   └── flightExplorationSlice.ts
│
├── hooks/
│   ├── useFlightExploration.ts
│   └── useResultFilters.ts
│
└── types/
    └── exploration.types.ts
```

### 5.4 Tasks

- [ ] Create `FlexibleSearchForm` container component
- [ ] Create `DateTypeToggle` component
- [ ] Create `MonthSelector` component
- [ ] Create `DateRangePicker` component
- [ ] Create `DurationPicker` component (min/max nights)
- [ ] Create `TravelPreferences` expandable section
- [ ] Create `HubSelector` with checkboxes
- [ ] Create `ExplorationResults` container
- [ ] Create `InsightsPanel` component
- [ ] Create `HighlightCards` (recommended, cheapest, fastest)
- [ ] Create `ResultTabs` (By Date, By Route, All)
- [ ] Create `DateGroupedResults` component
- [ ] Create `RouteGroupedResults` component
- [ ] Create `AllResultsList` component
- [ ] Create `FlightOptionCard` component
- [ ] Create `ResultFilters` component (price, duration, stops, hubs)
- [ ] Create `flightExplorationSlice` Redux slice
- [ ] Create `useFlightExploration` hook
- [ ] Create `useResultFilters` hook
- [ ] Add new route `/flights/explore` in React Router
- [ ] Style all components with Tailwind
- [ ] Add loading states and skeletons
- [ ] Add error handling UI
- [ ] Mobile responsive design

---

## Phase 6: Background Research (Future Enhancement)

**Status**: Outlined only - to be implemented later

### 6.1 Overview

Transform from "search on demand" to "continuous price monitoring" with alerts.

### 6.2 Core Features (Future)

1. **Trip Watch**: Save search criteria for monitoring
2. **Background Worker**: Periodic searches (every 6-12 hours)
3. **Price History**: Track price changes over time
4. **Alerts**: Notify user when prices drop or good deals appear

### 6.3 Technical Requirements (Future)

- **Job Queue**: Redis + Bull or similar
- **Worker Process**: Separate Node.js process
- **Database Tables**:
  - `trip_watches` - saved search criteria
  - `price_history` - historical prices
  - `alerts` - notification queue
- **Notification System**: Email (SendGrid/SES) or push notifications

### 6.4 User Flow (Future)

```
1. User searches for flights
2. User clicks "Watch this trip"
3. System saves search criteria
4. Background job runs every 12h
5. If price drops >10%, create alert
6. User receives notification with deal
```

### 6.5 Infrastructure Additions (Future)

- Redis for job queue
- Bull dashboard for monitoring
- Email service integration
- Additional API costs for continuous searches

**Note**: This phase requires significant infrastructure work and will be planned in detail when we're ready to implement.

---

## Response DTOs (Full Specification)

### FlightExplorationResultDto

```typescript
// backend/src/modules/flights/dto/flight-exploration-result.dto.ts

export class FlightExplorationResultDto {
  searchId: string;

  // Search parameters echo
  origin: string;
  destination: string;
  dateType: DateType;
  dateRange: { from: string; to: string };
  duration: { minNights: number; maxNights: number };

  // Highlights
  recommended: FlightOptionDto | null;
  cheapest: FlightOptionDto | null;
  fastest: FlightOptionDto | null;

  // Grouped results
  byDate: DateGroupDto[];
  byRoute: RouteGroupDto[];

  // All results (for filtering)
  allOptions: FlightOptionDto[];

  // Insights
  insights: InsightDto[];

  // Metadata
  totalOptionsFound: number;
  hubsSearched: string[];
  searchDurationMs: number;
  cacheHit: boolean;
}

export class DateGroupDto {
  dateRange: string;  // "March 8-15"
  departureDate: string;
  optionCount: number;
  lowestPrice: number;
  bestDuration: number;
  bestHub: string;
  options: FlightOptionDto[];
}

export class RouteGroupDto {
  hub: string;  // "IST"
  hubName: string;  // "Istanbul"
  optionCount: number;
  lowestPrice: number;
  averageDuration: number;
  options: FlightOptionDto[];
}

export class FlightOptionDto {
  id: string;

  // Dates
  departureDate: string;
  returnDate: string;
  nightsAtDestination: number;

  // Outbound journey
  outbound: FlightLegDto;

  // Return journey
  return: FlightLegDto;

  // Pricing
  totalPrice: number;
  currency: string;
  pricePerPerson: number;

  // Scoring
  score: number;  // 0-100 overall score
  scoreBreakdown: {
    price: number;      // 0-100
    duration: number;   // 0-100
    convenience: number; // 0-100
  };

  // Flags
  isAsymmetric: boolean;
  hasLongLayover: boolean;
  hasUnreasonableDuration: boolean;
  isRecommended: boolean;
  isCheapest: boolean;
  isFastest: boolean;

  // Booking
  bookingUrl: string;
  bookingToken: string;
}

export class FlightLegDto {
  route: string[];  // ["VAR", "IST", "HKT"]
  hub: string | null;  // "IST" or null for direct
  durationMinutes: number;
  stops: number;
  segments: FlightSegmentDto[];
  carriers: CarrierDto[];
}

export class FlightSegmentDto {
  from: string;
  to: string;
  departureTime: string;
  arrivalTime: string;
  durationMinutes: number;
  carrier: CarrierDto;
  flightNumber: string;
  aircraft: string | null;
}

export class CarrierDto {
  code: string;  // "TK"
  name: string;  // "Turkish Airlines"
  logo: string | null;
}

export class InsightDto {
  type: 'recommendation' | 'tip' | 'warning';
  icon: string;  // emoji
  message: string;
  relatedOptionIds?: string[];
}
```

---

## Caching Strategy

### Cache Keys

```typescript
// Hub route validation (24h TTL)
`hub:route:${origin}:${hub}:${month}` → boolean

// Search results (30 min TTL)
`search:${hash(searchParams)}` → FlightExplorationResultDto

// Airport coordinates (permanent, refreshed weekly)
`airport:coords:${code}` → { lat, lon }
```

### Implementation

```typescript
// backend/src/modules/flights/services/cache.service.ts

@Injectable()
export class FlightCacheService {
  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  // For in-memory: use NestJS CacheModule
  // For Redis: use ioredis or cache-manager-redis

  async getSearchResults(params: FlexibleSearchDto): Promise<FlightExplorationResultDto | null> {
    const key = this.buildSearchKey(params);
    return this.cacheManager.get(key);
  }

  async setSearchResults(
    params: FlexibleSearchDto,
    results: FlightExplorationResultDto,
    ttlSeconds = 1800  // 30 min
  ): Promise<void> {
    const key = this.buildSearchKey(params);
    await this.cacheManager.set(key, results, ttlSeconds);
  }

  private buildSearchKey(params: FlexibleSearchDto): string {
    const hash = createHash('md5')
      .update(JSON.stringify(params))
      .digest('hex');
    return `search:${hash}`;
  }
}
```

---

## Scoring Algorithm Details

### Overall Score Calculation

```typescript
// backend/src/modules/flights/services/scoring.service.ts

@Injectable()
export class ScoringService {
  private readonly WEIGHTS = {
    price: 0.40,
    duration: 0.35,
    convenience: 0.25,
  };

  calculateScore(option: FlightOption, context: ScoringContext): ScoredOption {
    const priceScore = this.scorePriceScore(option.totalPrice, context.priceRange);
    const durationScore = this.scoreDuration(option, context.distance);
    const convenienceScore = this.scoreConvenience(option);

    const overall =
      priceScore * this.WEIGHTS.price +
      durationScore * this.WEIGHTS.duration +
      convenienceScore * this.WEIGHTS.convenience;

    return {
      ...option,
      score: Math.round(overall),
      scoreBreakdown: {
        price: Math.round(priceScore),
        duration: Math.round(durationScore),
        convenience: Math.round(convenienceScore),
      },
    };
  }

  private scorePriceScore(price: number, range: { min: number; max: number }): number {
    // Linear scale: cheapest = 100, most expensive = 0
    const normalized = (range.max - price) / (range.max - range.min);
    return Math.max(0, Math.min(100, normalized * 100));
  }

  private scoreDuration(option: FlightOption, distanceKm: number): number {
    const totalHours = (option.outbound.durationMinutes + option.return.durationMinutes) / 60;
    const avgHoursPerLeg = totalHours / 2;

    return this.travelTimeScoringService.scoreTravelTime(avgHoursPerLeg, distanceKm);
  }

  private scoreConvenience(option: FlightOption): number {
    let score = 100;

    // Penalize stops
    const totalStops = option.outbound.stops + option.return.stops;
    score -= totalStops * 10;  // -10 per stop

    // Penalize long layovers (>4h)
    if (option.hasLongLayover) score -= 15;

    // Penalize asymmetric routing slightly (more complex journey)
    if (option.isAsymmetric) score -= 5;

    // Penalize overnight layovers
    // ... additional convenience factors

    return Math.max(0, score);
  }
}
```

---

## Implementation Order

### Recommended Sequence

1. **Phase 1** (Flexible Dates) - Foundation for everything else
2. **Phase 2** (Travel Time Scoring) - Enhances result quality
3. **Phase 5** (UI) - Can start in parallel after Phase 1 backend
4. **Phase 3** (Hub Exploration) - Core feature
5. **Phase 4** (Asymmetric Routing) - Enhancement to Phase 3
6. **Phase 6** (Background Jobs) - Future

### Parallelization Opportunities

- Frontend UI work can start after Phase 1 backend is complete
- Phase 2 (scoring) can be developed alongside Phase 3 (hub exploration)
- Phase 4 extends Phase 3, so must wait

---

## Testing Strategy

### Backend Tests

```typescript
// Unit tests
- FlexibleSearchDto validation
- TravelTimeScoringService calculations
- HubService hub filtering and validation
- ScoringService score calculations
- Result aggregation and deduplication

// Integration tests
- POST /flights/explore endpoint
- Kiwi API integration (mock external calls)
- Cache service behavior

// E2E tests
- Full search flow with various parameters
- Rate limiting behavior
- Error handling
```

### Frontend Tests

```typescript
// Component tests
- FlexibleSearchForm renders correctly
- Date type toggle switches forms
- Duration picker validates min <= max
- Hub selector updates state
- Results display correctly

// Integration tests
- Form submission triggers API call
- Results populate from API response
- Filters modify displayed results
- Tab switching works correctly
```

---

## Success Criteria

| Metric | Target |
|--------|--------|
| Search with flexible dates works | ✓ |
| Results show travel time scores | ✓ |
| Hub exploration finds multiple routes | ✓ |
| Asymmetric routing option available | ✓ |
| Results grouped by date and route | ✓ |
| Insights displayed for searches | ✓ |
| UI is responsive and intuitive | ✓ |
| Search completes in <10 seconds | ✓ |
| Results cached for 30 minutes | ✓ |

---

## Open Items / Future Considerations

1. **API Migration**: If RapidAPI lacks features, migrate to Kiwi Tequila
2. **Hub Data Updates**: Consider periodic refresh of hub availability
3. **Price Alerts**: Phase 6 background jobs
4. **Multi-city Trips**: Kiwi Nomad API for complex itineraries
5. **Map Visualization**: Show routes on a map
6. **Mobile App**: If needed in future
