# Flight Map Filters - Research

## Date: 2025-12-05

## Current Data Structure

### Airport Entity
Available fields for filtering:
- `iataCode` - 3-letter airport code (e.g., "JFK")
- `icaoCode` - 4-letter code (e.g., "KJFK")
- `name` - Full airport name
- `city` - City name
- `country` - Country name
- `countryIso` - 2-letter ISO country code
- `latitude` / `longitude` - Coordinates

### Flight Journey Entity
- `journeyDate` - Date of travel
- `isRoundTrip` - Boolean flag
- `notes` - User notes
- `legs[]` - Array of FlightLeg with departure/arrival airports and distance

### Key Insight
**Continent is NOT stored in the database.** We'll need to derive it from `countryIso` using a mapping.

---

## Proposed Filter Options

### 1. Origin Airport (User Requested)
**Description:** Filter routes by departure airport
**Implementation:** Dropdown/searchable select of all unique departure airports
**Data Available:** Yes - `departureAirport` on each leg

### 2. Destination Airport
**Description:** Filter routes by arrival airport
**Implementation:** Same as origin
**Data Available:** Yes - `arrivalAirport` on each leg

### 3. Continent Filter (User Requested)
**Description:** Show flights involving a specific continent
**Options:**
- Origin continent only
- Destination continent only
- Either origin OR destination (any connection)
- Both origin AND destination (within continent)

**Implementation Challenge:** Need continent mapping from `countryIso`

**Continent Mapping (ISO 3166-1 alpha-2 → Continent):**
```typescript
const CONTINENT_MAP: Record<string, string> = {
  // Europe
  'GB': 'Europe', 'DE': 'Europe', 'FR': 'Europe', 'IT': 'Europe', 'ES': 'Europe',
  'PT': 'Europe', 'NL': 'Europe', 'BE': 'Europe', 'AT': 'Europe', 'CH': 'Europe',
  'PL': 'Europe', 'CZ': 'Europe', 'GR': 'Europe', 'SE': 'Europe', 'NO': 'Europe',
  'DK': 'Europe', 'FI': 'Europe', 'IE': 'Europe', 'HU': 'Europe', 'RO': 'Europe',
  'BG': 'Europe', 'HR': 'Europe', 'SK': 'Europe', 'SI': 'Europe', 'LT': 'Europe',
  'LV': 'Europe', 'EE': 'Europe', 'CY': 'Europe', 'MT': 'Europe', 'LU': 'Europe',
  'IS': 'Europe', 'TR': 'Europe', 'UA': 'Europe', 'BY': 'Europe', 'RS': 'Europe',

  // North America
  'US': 'North America', 'CA': 'North America', 'MX': 'North America',
  'GT': 'North America', 'CU': 'North America', 'DO': 'North America',
  'HT': 'North America', 'JM': 'North America', 'PR': 'North America',
  'PA': 'North America', 'CR': 'North America', 'NI': 'North America',
  'HN': 'North America', 'SV': 'North America', 'BZ': 'North America',

  // South America
  'BR': 'South America', 'AR': 'South America', 'CO': 'South America',
  'PE': 'South America', 'VE': 'South America', 'CL': 'South America',
  'EC': 'South America', 'BO': 'South America', 'PY': 'South America',
  'UY': 'South America', 'GY': 'South America', 'SR': 'South America',

  // Asia
  'CN': 'Asia', 'JP': 'Asia', 'KR': 'Asia', 'IN': 'Asia', 'ID': 'Asia',
  'TH': 'Asia', 'VN': 'Asia', 'MY': 'Asia', 'SG': 'Asia', 'PH': 'Asia',
  'PK': 'Asia', 'BD': 'Asia', 'LK': 'Asia', 'NP': 'Asia', 'MM': 'Asia',
  'KH': 'Asia', 'LA': 'Asia', 'TW': 'Asia', 'HK': 'Asia', 'MO': 'Asia',
  'AE': 'Asia', 'SA': 'Asia', 'QA': 'Asia', 'KW': 'Asia', 'BH': 'Asia',
  'OM': 'Asia', 'JO': 'Asia', 'LB': 'Asia', 'IL': 'Asia', 'IQ': 'Asia',
  'IR': 'Asia', 'AF': 'Asia', 'KZ': 'Asia', 'UZ': 'Asia', 'TM': 'Asia',
  'KG': 'Asia', 'TJ': 'Asia', 'AZ': 'Asia', 'GE': 'Asia', 'AM': 'Asia',
  'MN': 'Asia',

  // Africa
  'EG': 'Africa', 'ZA': 'Africa', 'NG': 'Africa', 'KE': 'Africa', 'ET': 'Africa',
  'MA': 'Africa', 'DZ': 'Africa', 'TN': 'Africa', 'LY': 'Africa', 'GH': 'Africa',
  'TZ': 'Africa', 'UG': 'Africa', 'ZW': 'Africa', 'ZM': 'Africa', 'BW': 'Africa',
  'NA': 'Africa', 'MZ': 'Africa', 'AO': 'Africa', 'SN': 'Africa', 'CI': 'Africa',
  'CM': 'Africa', 'MU': 'Africa', 'RW': 'Africa', 'MW': 'Africa', 'MG': 'Africa',

  // Oceania
  'AU': 'Oceania', 'NZ': 'Oceania', 'FJ': 'Oceania', 'PG': 'Oceania',
  'NC': 'Oceania', 'PF': 'Oceania', 'GU': 'Oceania', 'WS': 'Oceania',

  // Russia spans Europe/Asia - typically classified as Europe
  'RU': 'Europe',
};
```

### 4. Country Filter
**Description:** Filter by specific country (origin/destination/both)
**Implementation:** Multi-select from `countriesVisited` in stats
**Data Available:** Yes - `country` field on Airport

### 5. Year Filter
**Description:** Show flights from specific year(s)
**Implementation:** Dropdown or range selector
**Data Available:** Yes - `journeyDate` on FlightJourney

### 6. Distance Range (Flight Type)
**Description:** Categorize flights by distance
**Categories:**
- **Short-haul:** < 1,500 km
- **Medium-haul:** 1,500 - 4,000 km
- **Long-haul:** > 4,000 km

**Data Available:** Yes - `distanceKm` on FlightLeg

### 7. Domestic vs International
**Description:** Filter by route type
**Logic:** Compare `countryIso` of departure vs arrival
**Data Available:** Yes - can derive from airport countries

### 8. Round Trip Filter
**Description:** Show only round trips or one-way flights
**Data Available:** Yes - `isRoundTrip` on FlightJourney

### 9. Route Frequency
**Description:** Highlight or filter routes by how many times traveled
**Options:**
- Show only routes flown 2+ times
- Color intensity based on frequency (already implemented visually)
**Data Available:** Yes - aggregated in `routeUtils.ts`

### 10. Time Period (Advanced)
**Description:** Filter by date range
**Implementation:** Date range picker
**Data Available:** Yes - `journeyDate`

---

## Additional Cool Insights (Beyond Filters)

### Quick Toggle Views
1. **"Home Base" View** - Highlight all routes from user's most frequent airport
2. **"Intercontinental Only"** - Show only flights crossing continents
3. **"New Routes This Year"** - Highlight routes first flown in current year

### Heat Map Modes
1. **Distance Heat Map** - Color routes by distance
2. **Frequency Heat Map** - Already partially implemented

---

## Relevant Files

### Frontend
- [FlightMap.tsx](frontend/src/components/FlightMap/FlightMap.tsx) - Main map component
- [FlightRoutes.tsx](frontend/src/components/FlightMap/FlightRoutes.tsx) - Route rendering
- [routeUtils.ts](frontend/src/components/FlightMap/routeUtils.ts) - Route aggregation logic
- [flightsApi.ts](frontend/src/features/flights/flightsApi.ts) - API hooks

### Backend
- [airport.entity.ts](backend/src/modules/airports/entities/airport.entity.ts) - Airport data
- [flight-journey.entity.ts](backend/src/modules/flights/entities/flight-journey.entity.ts) - Journey data
- [flight-leg.entity.ts](backend/src/modules/flights/entities/flight-leg.entity.ts) - Leg data
- [flights-stats.service.ts](backend/src/modules/flights/flights-stats.service.ts) - Stats calculations

### Types
- [types/index.ts](frontend/src/types/index.ts) - Frontend type definitions

---

## Implementation Approach Options

### Option A: Frontend-Only Filtering
- Filter data client-side after fetching all flights
- **Pros:** Simpler, no backend changes
- **Cons:** Performance with large datasets

### Option B: Backend Query Parameters
- Add filter params to `/flights` endpoint
- **Pros:** Better performance, server-side filtering
- **Cons:** More complex, backend changes required

### Recommendation
Start with **Option A** (frontend filtering) since the dataset is likely small (personal travel history). Can optimize to Option B later if needed.

---

## UI/UX Considerations

### Filter Panel Location
1. **Above map** - Horizontal filter bar
2. **Collapsible sidebar** - More space for filters
3. **Floating panel** - Overlay on map

### Filter Interaction
- Dropdowns for single selection (origin airport, year)
- Multi-select for categories (continents, countries)
- Toggle switches for boolean (domestic/international, round trip)
- Range slider for distance

---

## Next Steps
1. Confirm which filters to implement
2. Decide on UI layout
3. Create implementation plan
