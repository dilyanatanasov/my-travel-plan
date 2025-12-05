# Flight Routes Display - Implementation Plan

**Date**: 2025-12-05
**Feature**: Display flight routes on world map
**Research**: [2025-12-05_flight-routes-display_research.md](../research/2025-12-05_flight-routes-display_research.md)

---

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Route rendering | Custom SVG Bezier curves | No dependencies, good visual quality |
| Location | FlightsPage | Keep flight features together |
| Aggregation | Combine duplicate routes | Cleaner visualization, show count |
| Interactivity | Hover tooltips | Good UX without complexity |
| Animation | Static initially | Can add later as enhancement |

---

## Implementation Steps

### Step 1: Create FlightMap Component

**File**: `frontend/src/components/FlightMap/FlightMap.tsx`

Create a new map component specifically for displaying flight routes:

```tsx
// Core structure
- ComposableMap (same projection as WorldMap)
- ZoomableGroup
- Geographies (countries as background)
- FlightRoutes (custom arc component)
- AirportMarkers (endpoint dots)
```

**Props interface**:
```typescript
interface FlightMapProps {
  flights: FlightJourney[];
  onRouteHover?: (route: AggregatedRoute | null) => void;
  onRouteClick?: (route: AggregatedRoute) => void;
}
```

---

### Step 2: Create Route Utilities

**File**: `frontend/src/components/FlightMap/routeUtils.ts`

Utility functions for route calculations:

```typescript
// Aggregate flights into unique routes
function aggregateRoutes(flights: FlightJourney[]): AggregatedRoute[]

// Calculate SVG arc path between two coordinates
function calculateArcPath(
  from: [number, number],  // [lng, lat]
  to: [number, number],
  projection: (coords: [number, number]) => [number, number] | null
): string

// Generate unique route key
function getRouteKey(dep: Airport, arr: Airport): string
```

**AggregatedRoute type**:
```typescript
interface AggregatedRoute {
  key: string;
  departure: Airport;
  arrival: Airport;
  count: number;        // Times flown
  totalDistance: number;
  flights: FlightJourney[];  // Original flights for this route
}
```

---

### Step 3: Create FlightRoutes Sub-component

**File**: `frontend/src/components/FlightMap/FlightRoutes.tsx`

Renders all flight arcs:

```tsx
interface FlightRoutesProps {
  routes: AggregatedRoute[];
  projection: (coords: [number, number]) => [number, number] | null;
  hoveredRoute: string | null;
  onHover: (key: string | null) => void;
  onClick: (route: AggregatedRoute) => void;
}
```

**Features**:
- SVG `<path>` elements for each route
- Stroke width scales with flight count (1-4px range)
- Hover state changes color/opacity
- Smooth transitions on hover

---

### Step 4: Create AirportMarkers Sub-component

**File**: `frontend/src/components/FlightMap/AirportMarkers.tsx`

Renders dots at each airport:

```tsx
interface AirportMarkersProps {
  airports: Airport[];
  projection: (coords: [number, number]) => [number, number] | null;
  highlightedAirports?: string[];  // IATA codes to highlight
}
```

**Features**:
- Small circles (r=3-6) at airport locations
- Size based on frequency of use
- Highlighted state for hovered route endpoints

---

### Step 5: Create RouteTooltip Component

**File**: `frontend/src/components/FlightMap/RouteTooltip.tsx`

Tooltip displayed on route hover:

```tsx
interface RouteTooltipProps {
  route: AggregatedRoute | null;
  position: { x: number; y: number };
}
```

**Display content**:
- Route: `DEP → ARR` (IATA codes)
- Cities: `City A → City B`
- Flights: `X flights`
- Distance: `X,XXX km`

---

### Step 6: Update FlightsPage Layout

**File**: `frontend/src/pages/FlightsPage.tsx`

Modify layout to include the flight map:

**Current layout**:
```
[FlightForm + FlightList (1/3)] [FlightStats (2/3)]
```

**New layout**:
```
[FlightForm + FlightList (1/4)] [FlightMap (1/2)] [FlightStats (1/4)]
```

Or alternative tab-based:
```
[FlightForm + FlightList (1/3)] [Tabs: Map | Stats (2/3)]
```

---

### Step 7: Styling

**Colors**:
- Route arc: `#3b82f6` (blue-500)
- Route arc hover: `#1d4ed8` (blue-700)
- Airport marker: `#ef4444` (red-500)
- Airport marker highlight: `#fbbf24` (amber-400)

**Arc styling**:
```css
stroke-linecap: round;
stroke-opacity: 0.7;
transition: stroke-opacity 0.2s, stroke 0.2s;
```

---

## File Structure

```
frontend/src/components/FlightMap/
├── index.ts              # Barrel export
├── FlightMap.tsx         # Main component
├── FlightRoutes.tsx      # Arc rendering
├── AirportMarkers.tsx    # Airport dots
├── RouteTooltip.tsx      # Hover tooltip
└── routeUtils.ts         # Calculation utilities
```

---

## Implementation Order

1. [ ] Create `routeUtils.ts` with arc calculation and aggregation functions
2. [ ] Create `FlightMap.tsx` base component with geography background
3. [ ] Create `FlightRoutes.tsx` with arc rendering
4. [ ] Create `AirportMarkers.tsx` with airport dots
5. [ ] Create `RouteTooltip.tsx` for hover info
6. [ ] Create `index.ts` barrel export
7. [ ] Update `FlightsPage.tsx` to include FlightMap
8. [ ] Test with existing flight data
9. [ ] Fine-tune styling and interactions

---

## Future Enhancements (Not in Scope)

- Animated dashed lines showing direction
- Filter routes by date range
- Click to highlight all flights for a route
- Plane icon animation along route
- 3D globe view option

---

## Dependencies

**No new dependencies required** - uses existing:
- react-simple-maps (map rendering)
- Existing flight data from RTK Query

---

## Estimated Components

| Component | Lines (approx) |
|-----------|---------------|
| FlightMap.tsx | ~80 |
| FlightRoutes.tsx | ~60 |
| AirportMarkers.tsx | ~40 |
| RouteTooltip.tsx | ~35 |
| routeUtils.ts | ~70 |
| FlightsPage changes | ~20 |
| **Total** | **~305** |
