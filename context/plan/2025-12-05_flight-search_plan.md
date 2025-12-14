# Flight Search Feature - Implementation Plan

**Date**: 2025-12-05
**Feature**: Personalized Flight Search with Advanced Filtering
**Based on**: [Research Document](../research/2025-12-05_flight-search_research.md)

---

## Confirmed Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| API Provider | Skyscanner (free via RapidAPI) | No cost, sufficient coverage, redirect links |
| Booking Model | None (redirect only) | User links to airline/OTA for booking |
| Filtering | Backend post-processing | Reliable, API-agnostic, full control |
| Safety | Warning system | Show all flights, flag banned/low-rated carriers |
| Upgrades | Show fare families | Display all cabin classes from results |
| Baggage | Display API data | Show what Skyscanner returns |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (React)                        │
├─────────────────────────────────────────────────────────────────┤
│  Search Form  │  Results List  │  Filters Panel  │  Flight Card │
└───────┬───────┴───────▲────────┴────────┬────────┴──────────────┘
        │               │                 │
        ▼               │                 ▼
┌───────────────────────┴─────────────────────────────────────────┐
│                        Backend (NestJS)                         │
├─────────────────────────────────────────────────────────────────┤
│  FlightSearchService  │  FilterService  │  SafetyService        │
│  - Skyscanner API     │  - Stops        │  - EU Blacklist       │
│  - Response caching   │  - Layover time │  - Warning flags      │
│                       │  - Price range  │                       │
└───────────────────────┴─────────────────┴───────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │   PostgreSQL    │
                    │  - Blacklist    │
                    │  - Search cache │
                    └─────────────────┘
```

---

## Implementation Phases

### Phase 1: Backend - Skyscanner API Integration

**Files to create:**
- `backend/src/flights/flights.module.ts`
- `backend/src/flights/flights.controller.ts`
- `backend/src/flights/flights.service.ts`
- `backend/src/flights/dto/search-flights.dto.ts`
- `backend/src/flights/dto/flight-result.dto.ts`
- `backend/src/flights/interfaces/skyscanner.interface.ts`

**Tasks:**
1. Register for Skyscanner API on RapidAPI (free tier)
2. Create Flights module with NestJS
3. Implement search endpoint: `POST /api/flights/search`
4. Map Skyscanner response to internal DTO
5. Add environment variables for API keys

**API Endpoint Design:**
```typescript
// POST /api/flights/search
interface SearchFlightsDto {
  origin: string;        // IATA code (e.g., "JFK")
  destination: string;   // IATA code (e.g., "LHR")
  departureDate: string; // YYYY-MM-DD
  returnDate?: string;   // YYYY-MM-DD (optional for one-way)
  passengers: number;
  cabinClass: 'economy' | 'premium_economy' | 'business' | 'first';
}
```

---

### Phase 2: Backend - Post-Processing Filters

**Files to modify/create:**
- `backend/src/flights/services/filter.service.ts`
- `backend/src/flights/dto/filter-options.dto.ts`

**Filter Implementation:**

```typescript
interface FilterOptionsDto {
  maxStops?: number;           // 0 = direct, 1 = 1 stop, etc.
  maxLayoverMinutes?: number;  // e.g., 180 = 3 hours max
  minLayoverMinutes?: number;  // e.g., 60 = 1 hour minimum
  maxPrice?: number;           // in user's currency
  airlines?: string[];         // include only these carriers
  excludeAirlines?: string[];  // exclude these carriers
  maxDurationMinutes?: number; // total trip duration
}
```

**Tasks:**
1. Create FilterService with filter methods
2. Parse layover duration from flight segments
3. Calculate total stops from itinerary
4. Apply filters in sequence (stops → layover → price → duration)
5. Return filtered + sorted results

---

### Phase 3: Backend - Airline Safety Warnings

**Files to create:**
- `backend/src/flights/services/safety.service.ts`
- `backend/src/flights/entities/banned-airline.entity.ts`
- `backend/prisma/migrations/xxx_add_banned_airlines.sql`
- `backend/src/flights/data/eu-banned-airlines.json`

**Database Schema:**
```sql
CREATE TABLE banned_airlines (
  id SERIAL PRIMARY KEY,
  iata_code VARCHAR(3),
  icao_code VARCHAR(4),
  name VARCHAR(255) NOT NULL,
  country VARCHAR(100),
  source VARCHAR(50) DEFAULT 'EU_AIR_SAFETY_LIST',
  ban_type VARCHAR(50), -- 'full' or 'partial'
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**Tasks:**
1. Create banned_airlines table
2. Seed with current EU Air Safety List (169 airlines)
3. Create SafetyService to check carriers against blacklist
4. Add `safetyWarning` field to flight results
5. Document quarterly update process

**Warning Levels:**
- `banned` - On EU blacklist (show red warning)
- `caution` - Partial ban or low rating (show yellow warning)
- `safe` - No issues (no indicator)

---

### Phase 4: Frontend - Search UI

**Files to create:**
- `frontend/src/features/flightSearch/` (new feature folder)
  - `FlightSearchPage.tsx`
  - `components/SearchForm.tsx`
  - `components/ResultsList.tsx`
  - `components/FlightCard.tsx`
  - `components/FilterPanel.tsx`
  - `flightSearchSlice.ts`
  - `flightSearchApi.ts`

**SearchForm Fields:**
- Origin airport (autocomplete)
- Destination airport (autocomplete)
- Departure date
- Return date (optional)
- Passengers count
- Cabin class dropdown

**Tasks:**
1. Create FlightSearch feature structure
2. Build SearchForm with React Hook Form
3. Add airport autocomplete (use Skyscanner places API)
4. Create RTK Query API slice for flight search
5. Add loading states and error handling

---

### Phase 5: Frontend - Results & Filtering

**FlightCard Display:**
```
┌────────────────────────────────────────────────────────────────┐
│ ⚠️ SAFETY WARNING (if applicable)                              │
├────────────────────────────────────────────────────────────────┤
│ [Airline Logo]  UA 123 + UA 456                                │
│                                                                │
│ JFK ──────●────── ORD ──────●────── LAX                       │
│ 08:00    2h 15m   10:15  1h 30m  11:45    4h 00m    15:45     │
│          layover                                               │
│                                                                │
│ 1 Stop • 7h 45m total • Economy                               │
├────────────────────────────────────────────────────────────────┤
│ 💼 1x carry-on included │ 🧳 Checked bag: +$35                 │
├────────────────────────────────────────────────────────────────┤
│ Economy: $299  │  Premium: $449  │  Business: $899            │
│                        [View Deal →]                           │
└────────────────────────────────────────────────────────────────┘
```

**FilterPanel Controls:**
- Stops: Radio (Any / Direct / 1 stop / 2+ stops)
- Layover: Range slider (min-max hours)
- Price: Range slider
- Duration: Max hours slider
- Airlines: Multi-select checkboxes
- Hide banned carriers: Toggle

**Tasks:**
1. Create FilterPanel component
2. Implement FlightCard with all data sections
3. Add fare family display (economy/premium/business prices)
4. Show baggage info from API response
5. Add "View Deal" link (redirects to booking site)
6. Implement safety warning banner
7. Add sort options (price, duration, departure time)

---

### Phase 6: Integration & Polish

**Tasks:**
1. Connect frontend to backend API
2. Add search result caching (Redis or in-memory)
3. Implement loading skeletons
4. Add empty state handling
5. Mobile responsive design
6. Error handling and retry logic

---

## File Structure (Final)

```
backend/src/
├── flights/
│   ├── flights.module.ts
│   ├── flights.controller.ts
│   ├── flights.service.ts
│   ├── services/
│   │   ├── filter.service.ts
│   │   └── safety.service.ts
│   ├── dto/
│   │   ├── search-flights.dto.ts
│   │   ├── filter-options.dto.ts
│   │   └── flight-result.dto.ts
│   ├── entities/
│   │   └── banned-airline.entity.ts
│   ├── interfaces/
│   │   └── skyscanner.interface.ts
│   └── data/
│       └── eu-banned-airlines.json

frontend/src/
├── features/
│   └── flightSearch/
│       ├── FlightSearchPage.tsx
│       ├── components/
│       │   ├── SearchForm.tsx
│       │   ├── ResultsList.tsx
│       │   ├── FlightCard.tsx
│       │   ├── FilterPanel.tsx
│       │   ├── AirportAutocomplete.tsx
│       │   └── SafetyWarning.tsx
│       ├── flightSearchSlice.ts
│       └── flightSearchApi.ts
```

---

## API Keys Required

| Service | Purpose | Free Tier |
|---------|---------|-----------|
| Skyscanner (RapidAPI) | Flight search | Yes |

**Setup:**
1. Create account at [RapidAPI](https://rapidapi.com/)
2. Subscribe to [Skyscanner Flight Search](https://rapidapi.com/skyscanner/api/skyscanner-flight-search)
3. Add `RAPIDAPI_KEY` to `.env`

---

## Upgrade Pricing - What You'll See

Skyscanner returns multiple "pricing options" per itinerary, which typically include:

1. **Different booking agents** - Same flight, different OTAs (Expedia, Booking.com, etc.)
2. **Fare classes** - When available, economy vs premium economy vs business
3. **Bundled vs unbundled** - Basic fare vs fare with bags included

The FlightCard will display:
- Lowest price prominently
- Alternative fare classes if available
- "View all options" expansion to show all agents/prices

**Limitation:** Skyscanner doesn't always return business/first class separately - depends on airline participation. For flights where upgrades exist, they'll show. For others, user clicks through to airline site.

---

## Safety Data Maintenance

**Initial Setup:**
1. Download EU Air Safety List PDF
2. Parse and convert to JSON
3. Seed database

**Quarterly Update Process:**
1. Check [EU Air Safety List](https://transport.ec.europa.eu/transport-themes/eu-air-safety-list_en) for updates
2. Download updated PDF
3. Run diff against current database
4. Update `eu-banned-airlines.json`
5. Run migration/seed script

---

## Out of Scope (v1)

- Direct booking integration
- User accounts / saved searches
- Price alerts
- Multi-city searches
- Calendar price view
- Mobile app

---

## Success Criteria

- [ ] User can search flights between any two airports
- [ ] Results show price, duration, stops, layover times
- [ ] Filters work: stops, layover, price, duration
- [ ] Banned airlines show warning banner
- [ ] All fare classes displayed when available
- [ ] Baggage info shown from API
- [ ] "View Deal" links work and open booking site
- [ ] Page is responsive on mobile
