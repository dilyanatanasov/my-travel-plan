# Flight reorder — plan (confirmed 2026-08-14)

**Problem:** two journeys on the same date replay in arbitrary order (the
backend's created-DESC tie order), and the user does not want to enter hours.
Undated journeys replay purely by creation time.

**Confirmed decisions:** up/down arrows in the Flights list (no dnd library);
same-date clusters and the Undated section display in execution order, so the
arrows visibly move cards; dated journeys may swap only with same-date
neighbours, undated ones reorder freely — both rules enforced server-side.

## Backend

1. Migration: `sort_index` int NOT NULL DEFAULT 0 on `flight_journeys`,
   backfilled to `id` (creation order, preserves today's undated replay
   order exactly).
2. Entity `sortIndex`; `create()` and the import path set it to the new row's
   id after insert (monotonic, no counter table).
3. `POST /flights/reorder` `{ aId, bId }`: both journeys must belong to the
   user and be either both undated or dated with the exact same stored
   `journey_date` (precision may differ — same stored date is ambiguous
   enough to be swappable). Swaps the two `sort_index` values in a
   transaction; 400 otherwise.
4. `findAll` order: `journeyDate DESC, sortIndex ASC`.

## Frontend

1. `sortIndex` on the FlightJourney type; `useReorderFlightsMutation`
   invalidating the Flights tag.
2. Replay ordering extracted to a pure `orderJourneysForReplay` (dated:
   date ASC then sortIndex ASC; undated after, sortIndex ASC) + tests —
   it joins the critical-logic suite since reordering now feeds it.
3. FlightList: within-group sort mirrors the replay tie rules (display is
   date DESC, ties sortIndex ASC); each card gets up/down arrows enabled
   only when the neighbour is legally swappable; arrows hidden while a
   search filter is active (filtered neighbours are not real neighbours).

## Out of scope

Drag-and-drop, cross-date moves for dated journeys (change the date
instead), hours/times on journeys.
