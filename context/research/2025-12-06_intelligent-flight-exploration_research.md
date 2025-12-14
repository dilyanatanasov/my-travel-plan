# Research: Intelligent Flight Exploration System

**Date**: 2025-12-06
**Feature**: Flexible date search, vacation duration, hub exploration, travel time optimization

---

## 1. Current State Analysis

### What We Have Now

The current flight search uses **Kiwi.com API** with these constraints:

| Parameter | Current | Limitation |
|-----------|---------|------------|
| Departure Date | **Fixed date required** | No flexibility |
| Return Date | Fixed date or one-way | No range support |
| Origin | Single airport | No nearby airports |
| Destination | Single airport | No hub exploration |
| Connections | Whatever Kiwi returns | No custom hub logic |

**Current Search Flow:**
```
User picks exact dates → Kiwi API → Results (single origin/destination)
```

**What User Wants:**
```
User picks: "Month of March, 7-10 days vacation, Varna→Phuket"
    ↓
System explores:
  - All departure dates in March
  - All valid return dates (7-10 days later)
  - All sensible connection hubs (FRA, VIE, IST, LHR)
  - Both directions (outbound via Vienna, return via Istanbul)
    ↓
Ranked results by: price, total travel time, sanity of journey
```

---

## 2. Core Requirements Breakdown

### 2.1 Flexible Date Search

**User Need:** "I'm free in March" or "Any weekend in next 2 months"

| Approach | How It Works | Pros | Cons |
|----------|--------------|------|------|
| **Kiwi Flexible Dates** | API supports `date_from/date_to` range | Native support, single call | Limited to 30-day range per call |
| **Multiple API Calls** | Loop through dates, aggregate | Full control | Many API calls, rate limits, slow |
| **Cached Price Calendar** | Pre-fetch month of prices | Fast UX | Requires background jobs, stale data |

**Kiwi API Flexible Date Support:**
```
# Kiwi's search endpoint accepts:
date_from=01/03/2025
date_to=31/03/2025
nights_in_dst_from=7    # Min nights at destination
nights_in_dst_to=10     # Max nights at destination
```

This is **exactly** what we need - Kiwi already supports this!

### 2.2 Vacation Duration Instead of Fixed Return

**User Need:** "I want to stay 5-10 days"

Kiwi supports this via:
- `nights_in_dst_from` - Minimum nights
- `nights_in_dst_to` - Maximum nights

**Example:** User wants 7-10 days in Phuket
```json
{
  "origin": "VAR",
  "destination": "HKT",
  "date_from": "01/03/2025",
  "date_to": "31/03/2025",
  "nights_in_dst_from": 7,
  "nights_in_dst_to": 10
}
```

### 2.3 Travel Time Optimization

**User Need:**
- Prefer under 24 hours total travel time
- Accept longer for far destinations (SEA, Alaska)
- Penalize unreasonable times (30h to Lisbon)

**Implementation Strategy:**

```typescript
interface TravelTimeRules {
  // Distance-based thresholds (approximate)
  shortHaul: { maxKm: 2000, maxHours: 8 };    // Europe
  mediumHaul: { maxKm: 6000, maxHours: 16 };  // Middle East, North Africa
  longHaul: { maxKm: 12000, maxHours: 24 };   // Americas, East Asia
  ultraLong: { maxKm: 20000, maxHours: 36 };  // Australia, Pacific
}

// Scoring: flights exceeding threshold get penalized
function scoreTravelTime(flightHours: number, distanceKm: number): number {
  const expectedMax = getExpectedMaxHours(distanceKm);
  if (flightHours <= expectedMax) return 100;  // Perfect
  if (flightHours <= expectedMax * 1.25) return 75;  // Acceptable
  if (flightHours <= expectedMax * 1.5) return 50;   // Show but low priority
  return 25;  // "30h to Lisbon" - show last
}
```

### 2.4 Hub Exploration (The Core Innovation)

**User Need:** From Varna (small airport), explore all sensible routes

**The Problem:**
- Varna (VAR) has limited direct flights
- To reach Phuket (HKT), you NEED connections
- Kiwi finds connections, but doesn't explore ALL hub options

**Hub Exploration Strategy:**

```
Step 1: Identify reachable hubs from origin
  VAR → [IST, VIE, FRA, MUC, LHR, AMS, SOF, OTP]

Step 2: For each hub, find flights to destination
  IST → HKT (Turkish Airlines hub - likely good)
  VIE → HKT (Austrian hub)
  FRA → HKT (Lufthansa hub)

Step 3: Combine and score all options
  VAR → IST → HKT (14h total, $450)
  VAR → VIE → HKT (16h total, $520)
  VAR → FRA → HKT (18h total, $480)

Step 4: Allow asymmetric returns
  Outbound: VAR → IST → HKT
  Return: HKT → LHR → VAR (different hub!)
```

**Hub Database Structure:**

```typescript
interface HubAirport {
  code: string;           // "IST"
  name: string;           // "Istanbul"
  region: string;         // "Europe-East"
  majorCarriers: string[]; // ["TK", "PC"]

  // Destinations this hub is good for
  strongRoutes: {
    region: string;       // "Southeast Asia"
    quality: 'excellent' | 'good' | 'limited';
  }[];

  // Typical connection time
  minConnectionMinutes: number;  // 60 for IST
}
```

**Known Good Hubs from Varna:**

| Hub | Code | Good For | Carriers |
|-----|------|----------|----------|
| Istanbul | IST | Asia, Middle East, Africa | Turkish Airlines |
| Vienna | VIE | Europe, some Asia | Austrian |
| Frankfurt | FRA | Worldwide | Lufthansa |
| Munich | MUC | Europe, Americas | Lufthansa |
| London | LHR/LGW | Worldwide | BA, many LCCs |
| Amsterdam | AMS | Worldwide | KLM |
| Sofia | SOF | Limited, Balkans | Bulgaria Air |
| Bucharest | OTP | Limited | TAROM |

### 2.5 Asymmetric Routing

**User Need:** "Fly out via Vienna, return via London"

**Why This Matters:**
- Sometimes return flights from a different hub are cheaper
- Seasonal routes may only work one direction
- Scheduling convenience (better times via different hub)

**Implementation:**

```typescript
interface FlightExplorationRequest {
  origin: string;          // "VAR"
  destination: string;     // "HKT"

  dateRange: {
    from: string;          // "2025-03-01"
    to: string;            // "2025-03-31"
  };

  stayDuration: {
    minNights: number;     // 7
    maxNights: number;     // 10
  };

  preferences: {
    maxTravelHours: number;          // 24
    allowAsymmetricRouting: boolean; // true
    preferredHubs?: string[];        // ["IST", "VIE", "FRA"]
    excludeHubs?: string[];          // ["SOF"] - if user dislikes an airport
  };
}
```

---

## 3. API Capabilities Deep Dive

### 3.1 Kiwi.com API - Flexible Date Support

**Endpoint:** `https://api.tequila.kiwi.com/v2/search`

**Key Parameters for Flexible Search:**

| Parameter | Description | Example |
|-----------|-------------|---------|
| `date_from` | Start of departure range | "01/03/2025" |
| `date_to` | End of departure range | "31/03/2025" |
| `nights_in_dst_from` | Min nights at destination | 7 |
| `nights_in_dst_to` | Max nights at destination | 10 |
| `fly_from` | Origin (supports radius!) | "VAR" or "49.2-16.6-250km" |
| `fly_to` | Destination | "HKT" |
| `max_stopovers` | Limit connections | 2 |
| `stopover_from` | Min layover time | "1:00" |
| `stopover_to` | Max layover time | "8:00" |
| `max_fly_duration` | Max total hours | 24 |

**Radius Search (Nearby Airports):**
```
fly_from=49.2-16.6-250km  # Search airports within 250km of coordinates
fly_from=VAR,BOJ          # Or list multiple airports
```

**Virtual Interlining:**
Kiwi's "virtual interlining" already finds creative routings through different carriers that don't traditionally connect. This is huge for small airports.

### 3.2 RapidAPI Kiwi Endpoint (Current)

Our current RapidAPI endpoint may have **fewer features** than direct Kiwi Tequila API.

**Recommendation:** Migrate to direct Kiwi Tequila API for:
- Flexible date parameters
- Radius search
- More control over stopover times
- Better rate limits (needs paid plan)

**Kiwi Tequila API Tiers:**

| Plan | Searches/Month | Cost |
|------|---------------|------|
| Free | 1,000 | $0 |
| Basic | 10,000 | ~$50/mo |
| Pro | 100,000 | ~$200/mo |

### 3.3 Multi-City / Nomad Search

Kiwi has a **Nomad API** for complex multi-city trips:
```
POST /v2/flights_multi
{
  "requests": [
    {"fly_from": "VAR", "fly_to": "IST", "date_from": "..."},
    {"fly_from": "IST", "fly_to": "HKT", "date_from": "..."},
    {"fly_from": "HKT", "fly_to": "LHR", "date_from": "..."},
    {"fly_from": "LHR", "fly_to": "VAR", "date_from": "..."}
  ]
}
```

This could power our hub exploration!

---

## 4. Technical Architecture Options

### Option A: Enhanced Single Search (Simple)

**How it works:**
- Use Kiwi's existing flexible date parameters
- Let Kiwi find the connections
- Post-process to score and rank

**Pros:**
- Minimal changes to current code
- Single API call
- Kiwi handles connection logic

**Cons:**
- Limited control over hub selection
- Can't explore asymmetric routing well
- Dependent on Kiwi's connection database

**Effort:** Low (1-2 days)

---

### Option B: Multi-Search Aggregation (Recommended)

**How it works:**
```
1. User submits flexible search request
2. Backend spawns multiple searches:
   - Direct flights (if any)
   - Via each preferred hub
   - Asymmetric return options
3. Aggregate and deduplicate results
4. Score and rank by user preferences
5. Cache results for session
```

**Architecture:**
```
┌─────────────────┐
│  Search Request │
│  (flexible)     │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│         Exploration Orchestrator        │
│  - Generates search permutations        │
│  - Manages parallel API calls           │
│  - Handles rate limiting                │
└────────┬────────────────────────────────┘
         │
         ├──────────────────┬──────────────────┐
         ▼                  ▼                  ▼
   ┌──────────┐       ┌──────────┐       ┌──────────┐
   │ Direct   │       │ Via IST  │       │ Via VIE  │
   │ Search   │       │ Search   │       │ Search   │
   └──────────┘       └──────────┘       └──────────┘
         │                  │                  │
         └──────────────────┴──────────────────┘
                            │
                            ▼
                  ┌─────────────────┐
                  │   Aggregator    │
                  │  - Dedupe       │
                  │  - Score        │
                  │  - Rank         │
                  └─────────────────┘
                            │
                            ▼
                  ┌─────────────────┐
                  │  Ranked Results │
                  │  with insights  │
                  └─────────────────┘
```

**Pros:**
- Full control over hub exploration
- Can do asymmetric routing
- Better results for small airports
- Can parallelize searches

**Cons:**
- More API calls (cost)
- More complex code
- Need rate limit handling

**Effort:** Medium (1-2 weeks)

---

### Option C: Background Research Engine (Advanced)

**How it works:**
- User saves a "trip interest" (destination + month + duration)
- Background job continuously searches
- Notifies when good deals found
- Builds price history over time

**Pros:**
- True "research assistant"
- Can find deals over time
- User doesn't wait for searches

**Cons:**
- Requires job queue (Redis/Bull)
- Database for storing searches
- More infrastructure
- Higher API costs

**Effort:** High (3-4 weeks)

---

## 5. Hub Knowledge Base

### 5.1 Reachable Hubs from Varna (VAR)

Based on typical flight availability (may be seasonal):

| Hub | Airlines | Frequency | Notes |
|-----|----------|-----------|-------|
| **Istanbul (IST)** | Turkish, Pegasus | Daily | Best for Asia/Middle East |
| **Vienna (VIE)** | Austrian | 3-4/week | Good European hub |
| **Frankfurt (FRA)** | Lufthansa | Seasonal | Excellent worldwide |
| **Munich (MUC)** | Lufthansa | Seasonal | Similar to FRA |
| **London (STN/LTN)** | Ryanair, Wizz | Seasonal | Budget options |
| **Sofia (SOF)** | Bulgaria Air | Daily | Domestic, limited onward |
| **Bucharest (OTP)** | Various | Frequent | Regional hub |

### 5.2 Destination Categorization

For travel time expectations:

```typescript
const destinationCategories = {
  'short-haul': {
    regions: ['Western Europe', 'Central Europe', 'Mediterranean'],
    examples: ['LIS', 'BCN', 'FCO', 'ATH'],
    expectedMaxHours: 8,
    unreasonableAbove: 12
  },
  'medium-haul': {
    regions: ['Middle East', 'North Africa', 'Canary Islands'],
    examples: ['DXB', 'CAI', 'TFS'],
    expectedMaxHours: 12,
    unreasonableAbove: 18
  },
  'long-haul': {
    regions: ['Southeast Asia', 'East Africa', 'Americas'],
    examples: ['HKT', 'BKK', 'JFK', 'NBO'],
    expectedMaxHours: 20,
    unreasonableAbove: 30
  },
  'ultra-long': {
    regions: ['Australia', 'New Zealand', 'Pacific', 'South America'],
    examples: ['SYD', 'AKL', 'GIG'],
    expectedMaxHours: 30,
    unreasonableAbove: 40
  }
};
```

---

## 6. User Experience Considerations

### 6.1 Search Form Changes

**Current Form:**
- Origin (single airport)
- Destination (single airport)
- Departure date (single day)
- Return date (single day)
- Passengers
- Cabin class

**New Form:**
```
┌─────────────────────────────────────────────────────────┐
│  From: [Varna (VAR)]     To: [Phuket (HKT)]            │
│                                                         │
│  When: ( ) Specific dates                               │
│        (●) Flexible                                     │
│            Month: [March 2025 ▼]                        │
│            or Date range: [___] to [___]                │
│                                                         │
│  Stay duration: [7] to [10] nights                      │
│                                                         │
│  ┌─ Travel preferences ─────────────────────────────┐   │
│  │ Max travel time: [24] hours (each way)           │   │
│  │ [ ] Explore multiple connection options          │   │
│  │ Preferred hubs: [IST] [VIE] [FRA] [+ Add]       │   │
│  │ [ ] Allow different routing for return           │   │
│  └──────────────────────────────────────────────────┘   │
│                                                         │
│  Passengers: [2]  Cabin: [Economy ▼]                   │
│                                                         │
│            [🔍 Explore Flights]                         │
└─────────────────────────────────────────────────────────┘
```

### 6.2 Results Presentation

**Current:** Simple list sorted by price

**New:** Grouped and scored results

```
┌─────────────────────────────────────────────────────────┐
│  Best Options for Varna → Phuket                        │
│  March 2025 • 7-10 nights                               │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ⭐ RECOMMENDED                                         │
│  ┌───────────────────────────────────────────────────┐  │
│  │ Mar 8-15 via Istanbul                             │  │
│  │ VAR → IST → HKT  •  14h 20m  •  1 stop           │  │
│  │ HKT → IST → VAR  •  15h 10m  •  1 stop           │  │
│  │                                        $487      │  │
│  │ ✓ Shortest travel time  ✓ Good price            │  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
│  💰 CHEAPEST                                            │
│  ┌───────────────────────────────────────────────────┐  │
│  │ Mar 12-22 via Vienna (out) / London (return)     │  │
│  │ VAR → VIE → BKK → HKT  •  18h  •  2 stops       │  │
│  │ HKT → LHR → VAR  •  16h  •  1 stop              │  │
│  │                                        $412      │  │
│  │ ⚠ Asymmetric routing (different return hub)     │  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
│  📅 MORE OPTIONS BY DATE                                │
│  ├─ March 1-8: 12 options from $445                    │
│  ├─ March 8-15: 15 options from $412                   │
│  ├─ March 15-22: 18 options from $398                  │
│  └─ March 22-31: 8 options from $521                   │
│                                                         │
│  ✈️ BY ROUTE                                            │
│  ├─ Via Istanbul (IST): 23 options                     │
│  ├─ Via Vienna (VIE): 12 options                       │
│  ├─ Via Frankfurt (FRA): 8 options                     │
│  └─ Via London (LHR): 15 options                       │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 6.3 Insights & Recommendations

The system should provide intelligent insights:

- "Istanbul connections are 3h faster on average"
- "Flying out Thu-Sat is $80 cheaper than Sun-Mon"
- "Return via London adds 2h but saves $65"
- "⚠️ March 15-20 has limited availability (holiday season)"

---

## 7. Data Models

### 7.1 New DTOs

```typescript
// Request
interface FlexibleFlightSearchDto {
  origin: string;
  destination: string;

  // Date flexibility
  dateType: 'specific' | 'month' | 'range';
  specificDepartureDate?: string;
  specificReturnDate?: string;
  month?: string;  // "2025-03"
  dateRangeStart?: string;
  dateRangeEnd?: string;

  // Duration
  minNights: number;
  maxNights: number;

  // Preferences
  maxTravelHours?: number;
  exploreHubs: boolean;
  preferredHubs?: string[];
  excludeHubs?: string[];
  allowAsymmetricRouting: boolean;

  passengers: number;
  cabinClass: CabinClass;
}

// Response
interface FlightExplorationResultDto {
  searchId: string;
  origin: string;
  destination: string;

  // Highlighted options
  recommended: FlightOptionDto;
  cheapest: FlightOptionDto;
  fastest: FlightOptionDto;

  // Grouped results
  byDate: DateGroupDto[];
  byRoute: RouteGroupDto[];

  // All results for filtering
  allOptions: FlightOptionDto[];

  // Insights
  insights: InsightDto[];

  // Stats
  totalOptionsFound: number;
  searchDurationMs: number;
  apisQueried: number;
}

interface FlightOptionDto {
  id: string;

  // Dates
  departureDate: string;
  returnDate: string;
  nightsAtDestination: number;

  // Outbound
  outboundRoute: string[];  // ["VAR", "IST", "HKT"]
  outboundDurationMinutes: number;
  outboundStops: number;
  outboundCarriers: CarrierDto[];

  // Return
  returnRoute: string[];    // ["HKT", "LHR", "VAR"]
  returnDurationMinutes: number;
  returnStops: number;
  returnCarriers: CarrierDto[];

  // Totals
  totalTravelMinutes: number;
  price: number;
  currency: string;

  // Scoring
  score: number;  // 0-100
  scoreBreakdown: {
    priceScore: number;
    durationScore: number;
    convenienceScore: number;
  };

  // Flags
  isAsymmetric: boolean;
  hasLongLayover: boolean;
  hasSafetyWarning: boolean;

  // Booking
  bookingUrl: string;
}

interface InsightDto {
  type: 'recommendation' | 'warning' | 'tip';
  icon: string;
  message: string;
  relatedOptionIds?: string[];
}
```

---

## 8. Implementation Phases

### Phase 1: Flexible Dates (Backend)
- Migrate to direct Kiwi Tequila API
- Implement flexible date parameters
- Add vacation duration parameters
- Update DTOs

### Phase 2: Travel Time Scoring
- Add destination categorization
- Implement travel time scoring algorithm
- Penalize unreasonable durations

### Phase 3: Hub Exploration
- Create hub knowledge base
- Implement multi-search orchestrator
- Add parallel search execution
- Build result aggregator

### Phase 4: Asymmetric Routing
- Enable different return hub
- Combine outbound/return options
- Score asymmetric routes appropriately

### Phase 5: UI Overhaul
- New flexible search form
- Grouped results view
- Insights panel
- Hub visualization (map?)

### Phase 6: Background Research (Future)
- Save search preferences
- Background monitoring
- Price alerts
- Deal notifications

---

## 9. Open Questions for Planning

1. **API Choice**: Migrate to direct Kiwi Tequila API or enhance RapidAPI usage?

2. **Hub Database**: Hardcode known hubs or dynamically discover from route data?

3. **Search Parallelism**: How many parallel searches? Rate limit handling?

4. **Caching**: Cache results? For how long? Per-user or shared?

5. **Scoring Weights**: How to balance price vs. duration vs. convenience?

6. **UI Complexity**: Full overhaul or progressive enhancement?

7. **Background Jobs**: Implement now or defer to future phase?

---

## 10. External Resources

- [Kiwi Tequila API Docs](https://tequila.kiwi.com/docs/tequila_api)
- [Kiwi Nomad API](https://tequila.kiwi.com/docs/search_api#nomad)
- [Airport Database (OurAirports)](https://ourairports.com/data/)
- [Great Circle Distance Calculator](https://www.movable-type.co.uk/scripts/latlong.html)

---

## 11. Summary

The current implementation is a solid foundation but treats flight search as a **simple query** rather than **intelligent exploration**. The user's requirements call for:

| Feature | Current | Needed |
|---------|---------|--------|
| Date flexibility | Fixed dates only | Month/range + duration |
| Hub exploration | Kiwi decides | Explicit hub search |
| Asymmetric routing | Not supported | Full support |
| Travel time awareness | None | Score by distance |
| Research automation | None | Background exploration |

**Recommended Approach:** Option B (Multi-Search Aggregation) provides the best balance of capability and implementation effort. Start with flexible dates (Kiwi supports this!), then add hub exploration, then asymmetric routing.

The app's value proposition shifts from "search flights" to "**research my trip for me**" - which is exactly what the user wants.
