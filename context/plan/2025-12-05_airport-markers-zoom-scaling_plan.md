# Plan: Airport Markers Zoom Scaling

**Date**: 2025-12-05
**Research**: [2025-12-05_airport-markers-zoom-scaling_research.md](../research/2025-12-05_airport-markers-zoom-scaling_research.md)

---

## Confirmed Decisions

1. **Scope**: Counter-scale everything (markers + flight routes)
2. **Minimum size**: Add clamp to prevent elements becoming too small in SVG space
3. **Implementation**: Extract utility function to routeUtils.ts

---

## Implementation Steps

### Step 1: Add utility function to routeUtils.ts

Create `getZoomAdjustedSize()` function:

```ts
/**
 * Adjust a size value to remain visually constant regardless of zoom level.
 * Divides by zoom factor and clamps to a minimum SVG size.
 */
export function getZoomAdjustedSize(
  size: number,
  zoom: number,
  minSize: number = 0.5
): number {
  return Math.max(size / zoom, minSize);
}
```

---

### Step 2: Update AirportMarkers.tsx

1. Import `useZoomPanContext` from `react-simple-maps`
2. Import `getZoomAdjustedSize` from `routeUtils`
3. Get zoom level: `const { k } = useZoomPanContext();`
4. Apply to all size values:
   - Dot radius: `getZoomAdjustedSize(radius, k)`
   - Dot stroke width: `getZoomAdjustedSize(1, k)`
   - Highlight ring radius offset: `getZoomAdjustedSize(3, k)`
   - Highlight ring stroke: `getZoomAdjustedSize(2, k)`
   - IATA label font-size: `getZoomAdjustedSize(10, k)`
   - IATA label y-offset: `getZoomAdjustedSize(radius + 5, k)`

---

### Step 3: Update FlightRoutes.tsx

1. Import `useZoomPanContext` from `react-simple-maps`
2. Import `getZoomAdjustedSize` from `routeUtils`
3. Get zoom level: `const { k } = useZoomPanContext();`
4. Apply to stroke width:
   - Base stroke: `getZoomAdjustedSize(strokeWidth, k)`
   - Hovered stroke: `getZoomAdjustedSize(strokeWidth + 1, k)`

---

## Files Modified

| File | Changes |
|------|---------|
| `frontend/src/components/FlightMap/routeUtils.ts` | Add `getZoomAdjustedSize()` function |
| `frontend/src/components/FlightMap/AirportMarkers.tsx` | Import hook + utility, apply to all sizes |
| `frontend/src/components/FlightMap/FlightRoutes.tsx` | Import hook + utility, apply to stroke width |

---

## Testing Checklist

- [ ] Markers stay same visual size when zooming in/out
- [ ] Flight routes stay same visual thickness when zooming
- [ ] Highlight ring appears correctly on hover
- [ ] IATA labels readable at all zoom levels
- [ ] No visual glitches at min zoom (1x)
- [ ] No visual glitches at max zoom (8x)
