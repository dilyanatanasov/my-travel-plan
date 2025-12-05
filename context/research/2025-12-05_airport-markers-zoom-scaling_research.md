# Research: Airport Markers Zoom Scaling

**Date**: 2025-12-05
**Issue**: Airport marker dots don't scale down when zooming in - they remain proportionate to the map zoom, making it hard to pinpoint exact airport locations.

---

## Current Implementation Analysis

### Relevant Files
- `frontend/src/components/FlightMap/AirportMarkers.tsx` - Renders airport dots
- `frontend/src/components/FlightMap/FlightRoutes.tsx` - Renders flight path lines
- `frontend/src/components/FlightMap/FlightMap.tsx` - Parent component with `ZoomableGroup`

### Root Cause
The `ZoomableGroup` component from `react-simple-maps` applies a CSS transform to scale all child elements when zooming. This means:
- When user zooms in 2x, everything inside (countries, routes, markers) appears 2x larger
- The marker radius values (3-6px in `AirportMarkers.tsx`) are in SVG coordinate space, not screen space
- Result: markers grow/shrink with zoom instead of staying constant size

### Current Marker Code (AirportMarkers.tsx:22-26)
```tsx
const getRadius = (iataCode: string): number => {
  const count = visitCounts.get(iataCode) || 1;
  const normalized = (count - 1) / Math.max(maxVisits - 1, 1);
  return 3 + normalized * 3; // Range: 3 to 6 pixels
};
```

---

## Solution: useZoomPanContext Hook

### API Discovery
`react-simple-maps` provides `useZoomPanContext()` hook that exposes the current zoom state:

```tsx
import { useZoomPanContext } from 'react-simple-maps';

// Returns:
{
  x: number;          // Horizontal offset
  y: number;          // Vertical offset
  k: number;          // Scale factor (zoom level)
  transformString: string;  // Full transform string
}
```

**Key value**: `k` is the scale factor - when zoomed in 2x, `k = 2`.

### Type Definitions Available
The types are already available in `@types/react-simple-maps` (line 263-268):
```ts
declare function useZoomPanContext(): {
    x: number;
    y: number;
    k: number;
    transformString: string;
};
```

---

## Implementation Options

### Option 1: Divide radius by zoom factor (Recommended)
**Approach**: Counter-scale markers by dividing their size by `k`

```tsx
const { k } = useZoomPanContext();
const baseRadius = getRadius(airport.iataCode);
const scaledRadius = baseRadius / k;  // Stays visually constant
```

**Pros**:
- Simple, minimal code change
- Markers remain clickable/hoverable
- Works for all zoom levels

**Cons**:
- At extreme zoom levels (8x), markers might become very small in SVG space

---

### Option 2: Use CSS transform on markers
**Approach**: Apply inverse transform to marker group

```tsx
<g transform={`scale(${1/k})`}>
  <circle r={radius} ... />
</g>
```

**Pros**:
- Single transform for entire marker

**Cons**:
- Need to re-translate position after scaling
- More complex math for positioning

---

### Option 3: Render markers outside ZoomableGroup
**Approach**: Render markers in a separate layer with manual projection

**Pros**:
- Complete control over marker rendering
- No scaling issues

**Cons**:
- Major refactor required
- Need to recalculate positions on zoom/pan
- Loses automatic transform sync

---

## Affected Elements

Elements that should be counter-scaled for better UX:

| Element | File | Current Values | Should Counter-Scale? |
|---------|------|----------------|----------------------|
| Airport dot radius | AirportMarkers.tsx | 3-6px | ✅ Yes |
| Airport dot stroke | AirportMarkers.tsx | 1px | ✅ Yes |
| Highlight ring radius | AirportMarkers.tsx | radius + 3 | ✅ Yes |
| Highlight ring stroke | AirportMarkers.tsx | 2px | ✅ Yes |
| IATA label font-size | AirportMarkers.tsx | 10px | ✅ Yes |
| Flight route stroke | FlightRoutes.tsx | 1.5-4px | ⚠️ Optional |

**Note**: Flight routes could optionally stay proportional (thicker when zoomed) for visibility, or be counter-scaled for precision.

---

## Sources

- [react-simple-maps ZoomableGroup docs](https://www.react-simple-maps.io/docs/zoomable-group/)
- [useZoomPanContext docs](https://www.react-simple-maps.io/docs/use-zoom-pan-context/)
- Package version: `react-simple-maps@3.0.0`
- Type definitions: `@types/react-simple-maps@3.0.6`
