# Flight Map Filters - Implementation Plan

## Date: 2025-12-05

## Filters to Implement

1. **Origin Airport** - Dropdown of departure airports
2. **Destination Airport** - Dropdown of arrival airports
3. **Continent** - Multi-select (Europe, Asia, North America, etc.)
4. **Year** - Dropdown of years with flights
5. **Distance Range** - Short/Medium/Long-haul toggle
6. **Domestic/International** - Toggle switch

## UI Decision
**Horizontal filter bar above the map** - Clean, doesn't obstruct map view

## Technical Approach
**Frontend-only filtering** - Filter after fetching all flights (dataset is personal travel, likely small)

---

## Implementation Steps

### Step 1: Create Continent Mapping Utility
- File: `frontend/src/components/FlightMap/continentUtils.ts`
- Map country ISO codes to continents
- Export helper function `getContinent(countryIso: string): string`

### Step 2: Create Filter Types
- File: `frontend/src/components/FlightMap/filterTypes.ts`
- Define `FlightFilters` interface
- Define filter option types

### Step 3: Create Filter Bar Component
- File: `frontend/src/components/FlightMap/FlightMapFilters.tsx`
- Horizontal bar with all filter controls
- Dropdowns, multi-select, toggles

### Step 4: Create Filter Logic Utility
- File: `frontend/src/components/FlightMap/filterUtils.ts`
- `applyFilters(flights, filters)` function
- Individual filter predicates

### Step 5: Integrate Filters into FlightMap
- Add filter state to `FlightMap.tsx`
- Pass filtered flights to routes/airports
- Add FlightMapFilters component

### Step 6: Update Legend with Active Filter Count
- Show "X filters active" indicator
- Clear all filters button

---

## File Structure After Implementation

```
frontend/src/components/FlightMap/
├── index.ts
├── FlightMap.tsx          (modified - add filter state)
├── FlightMapFilters.tsx   (new)
├── FlightRoutes.tsx
├── AirportMarkers.tsx
├── RouteTooltip.tsx
├── routeUtils.ts
├── filterTypes.ts         (new)
├── filterUtils.ts         (new)
└── continentUtils.ts      (new)
```
