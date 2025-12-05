# Future Travel Plans Feature Research
**Date**: 2025-12-05

## Current Architecture

### Visit Entity
```typescript
// backend/src/modules/visits/entities/visit.entity.ts
visitType: 'trip' | 'transit' | 'home'
source: 'manual' | 'flight'
// Currently no temporal status field
```

### Current Color Scheme
| Type | Color | Hex |
|------|-------|-----|
| Home | Purple | #8b5cf6 |
| Trip (Visited) | Green | #22c55e |
| Transit | Orange | #f59e0b |
| Unvisited | Gray | #d1d5db |
| Flight Routes | Blue | #3b82f6 |

## Recommended Approach: Add `status` Field

**Best option**: Add a `status` field to Visit entity

```typescript
export type VisitStatus = 'completed' | 'planned' | 'cancelled';

@Column({
  name: 'status',
  type: 'varchar',
  length: 20,
  default: 'completed',
})
status: VisitStatus;
```

**Why this approach:**
- Clean separation: `visitType` = category, `status` = temporal state
- Minimal schema change (one column)
- Easy filtering and queries
- Future-proof for cancelled trips

## Proposed Color Scheme

### Completed Visits (existing)
- Home: `#8b5cf6` (Purple)
- Trip: `#22c55e` (Green)
- Transit: `#f59e0b` (Orange)

### Planned Visits (lighter/pastel versions)
- Home: `#d8b4fe` (Light Purple)
- Trip: `#86efac` (Light Green)
- Transit: `#fcd34d` (Light Yellow/Amber)

### Visual Distinction Options
1. **Color only**: Lighter shades for planned
2. **Pattern**: Dashed borders for planned countries
3. **Opacity**: 60% opacity for planned

### Flight Routes
- Completed: Solid blue `#3b82f6`
- Planned: Dashed blue or lighter `#93c5fd`

## Files to Modify

### Backend
- `visit.entity.ts` - Add status column
- `create-visit.dto.ts` - Add status field
- `update-visit.dto.ts` - Add status field
- `visits.service.ts` - Filter by status

### Frontend
- `types/index.ts` - Add VisitStatus type
- `countryColors.ts` - Add planned color palette
- `TravelMap.tsx` - Pass status to color logic
- `TravelMapControls.tsx` - Add toggle for planned/completed
- `FlightRoutes.tsx` - Style based on status

## Implementation Options

### Option 1: Minimal (2-3 hours)
- Add status field to backend
- No visual changes yet
- Filter on API level

### Option 2: Status + Colors (4-5 hours)
- Add status field
- Implement lighter colors for planned
- Add toggle in map controls

### Option 3: Full Feature (6-8 hours)
- All of Option 2
- Dedicated "Plan a Trip" form
- Date pickers for planned dates
- Integration with flight search (future)
- Statistics for upcoming trips

## Questions for User

1. **Data Model**: Confirm `status` field approach vs deriving from dates?
2. **Visual Style**: Lighter colors only, or add dashed borders/patterns?
3. **Toggle**: Should map toggle between planned/completed view?
4. **Flight Integration**: Auto-create planned visits from planned flights?
5. **Scope**: Which implementation option (1, 2, or 3)?
