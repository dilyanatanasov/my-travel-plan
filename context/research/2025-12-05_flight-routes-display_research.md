# Flight Routes Display on World Map - Research

**Date**: 2025-12-05
**Feature**: Display flight routes/arcs on the existing world map

---

## Current Implementation

### Map Technology
- **Library**: `react-simple-maps` v3.0.0
- **Data Source**: TopoJSON from `world-atlas@2/countries-110m.json`
- **Component**: [WorldMap.tsx](frontend/src/components/WorldMap/WorldMap.tsx)
- **Features**: ZoomableGroup with pan/zoom, country click interaction, visited/unvisited coloring

### Existing Flight Data
The app already tracks flights with full coordinate data:

```typescript
interface Airport {
  id: number;
  name: string;
  city: string;
  country: string;
  iata: string;
  icao: string;
  latitude: number;   // Available for route drawing
  longitude: number;  // Available for route drawing
}

interface FlightLeg {
  departure: Airport;
  arrival: Airport;
  distance: number;
}

interface FlightJourney {
  id: number;
  legs: FlightLeg[];
  isRoundTrip: boolean;
  date?: string;
  notes?: string;
}
```

---

## Options for Route Display

### Option 1: react-simple-maps Built-in Components

**Components available:**
- `Line` - Straight line between coordinates
- `Marker` - Point markers for airports
- `Annotation` - Labels

**Pros:**
- No additional dependencies
- Consistent with existing codebase
- Works seamlessly with ZoomableGroup (pan/zoom)
- Lightweight

**Cons:**
- `Line` draws straight lines, not geodesic arcs (looks unrealistic on world map)
- Would need custom SVG path calculation for curved arcs

**Implementation complexity:** Low-Medium

---

### Option 2: Custom SVG Arc Paths (Quadratic Bezier Curves)

Calculate curved paths using SVG quadratic bezier curves within react-simple-maps.

**Approach:**
```tsx
// Calculate control point for arc curvature
const midX = (x1 + x2) / 2;
const midY = (y1 + y2) / 2;
const dx = x2 - x1;
const dy = y2 - y1;
const distance = Math.sqrt(dx*dx + dy*dy);
const curvature = distance * 0.2; // Adjust for arc height

// Control point perpendicular to line
const controlX = midX - (dy / distance) * curvature;
const controlY = midY + (dx / distance) * curvature;

// SVG path
const path = `M ${x1} ${y1} Q ${controlX} ${controlY} ${x2} ${y2}`;
```

**Pros:**
- No additional dependencies
- Full control over arc appearance
- Smooth curves that look like flight paths
- Performant (pure SVG)

**Cons:**
- Not true geodesic/great circle routes
- Manual calculation required
- Need to handle edge cases (date line crossing)

**Implementation complexity:** Medium

---

### Option 3: D3-geo for True Geodesic Arcs

Use `d3-geo` library to calculate great circle routes (shortest path on Earth's surface).

**Dependencies to add:**
```bash
npm install d3-geo d3-geo-projection
npm install -D @types/d3-geo
```

**Approach:**
```tsx
import { geoPath, geoInterpolate } from 'd3-geo';

// Create great circle interpolator
const interpolate = geoInterpolate(
  [departure.longitude, departure.latitude],
  [arrival.longitude, arrival.latitude]
);

// Generate points along the great circle
const points = [];
for (let t = 0; t <= 1; t += 0.01) {
  points.push(interpolate(t));
}
```

**Pros:**
- Geographically accurate great circle routes
- Industry standard for flight path visualization
- Handles international date line crossing
- D3 is well-maintained and documented

**Cons:**
- Additional dependency (~30KB)
- Slightly more complex integration
- Need to project coordinates to match react-simple-maps projection

**Implementation complexity:** Medium-High

---

### Option 4: react-simple-maps + Graticule Pattern

Use the `Graticule` component pattern to draw custom lines.

**Pros:**
- Pattern already exists in react-simple-maps ecosystem
- Integrates well with projection system

**Cons:**
- Less flexible than custom SVG
- Not designed for arbitrary routes

**Implementation complexity:** Medium

---

### Option 5: Mapbox GL JS Migration

Replace react-simple-maps with Mapbox GL JS for advanced features.

**Pros:**
- Professional-grade flight route visualization
- Built-in arc layer support
- Vector tiles, better performance at scale
- 3D globe view available

**Cons:**
- Major refactor required
- API key/account needed (free tier available)
- Different paradigm than current implementation
- Overkill for current requirements

**Implementation complexity:** High

---

## Visual Design Considerations

### Route Styling Options
1. **Solid arcs** - Simple colored curves
2. **Dashed/animated arcs** - Moving dashes to show direction
3. **Gradient arcs** - Color gradient from departure to arrival
4. **Thickness by frequency** - Thicker lines for routes flown multiple times

### Airport Markers
1. **Dots** - Simple circles at each airport
2. **Icons** - Airplane or pin icons
3. **Sized by activity** - Larger markers for frequently used airports

### Interactivity
1. **Hover on route** - Show flight details tooltip
2. **Click on route** - Highlight and show full journey
3. **Filter by date** - Show routes for specific time periods
4. **Animation** - Animate plane along route on hover

---

## Integration Points

### Data Flow
```
FlightsAPI → Redux Store → WorldMap Component
                              ↓
                         Route Overlay
                              ↓
                         Marker Layer
```

### Component Structure Options

**Option A: Extend WorldMap component**
```
WorldMap/
├── WorldMap.tsx          # Main component
├── FlightRoutes.tsx      # Arc overlay
├── AirportMarkers.tsx    # Airport dots
└── RouteTooltip.tsx      # Hover details
```

**Option B: Separate map page**
```
pages/
├── HomePage.tsx          # Countries only
└── FlightsPage.tsx       # Add map with routes
```

---

## Recommendation Summary

| Option | Dependencies | Accuracy | Effort | Best For |
|--------|-------------|----------|--------|----------|
| 1. Built-in Line | None | Low | Low | Prototype only |
| 2. Custom SVG Bezier | None | Medium | Medium | **Recommended** |
| 3. D3-geo Geodesic | d3-geo | High | Medium-High | Geographic accuracy |
| 4. Graticule Pattern | None | Medium | Medium | Limited use |
| 5. Mapbox Migration | mapbox-gl | High | High | Future scaling |

---

## Questions for Planning Phase

1. **Route accuracy**: Do you want visually pleasing curves (Option 2) or geographically accurate great circle routes (Option 3)?

2. **Route aggregation**: Should identical routes (same airports) be combined and shown with thicker lines, or each flight shown separately?

3. **Integration location**: Add routes to existing WorldMap on HomePage, or create a dedicated map on FlightsPage?

4. **Interactivity level**: Basic display only, or full interactivity (hover, click, filter)?

5. **Animation**: Static routes, or animated (dashed moving lines, plane icons)?

6. **Performance concern**: Approximately how many flights do you expect to display? (affects rendering strategy)

---

## External Resources

- [react-simple-maps docs](https://www.react-simple-maps.io/docs/line/)
- [D3-geo documentation](https://github.com/d3/d3-geo)
- [Great Circle Arc explanation](https://en.wikipedia.org/wiki/Great-circle_distance)
- [SVG Path documentation](https://developer.mozilla.org/en-US/docs/Web/SVG/Tutorial/Paths)
