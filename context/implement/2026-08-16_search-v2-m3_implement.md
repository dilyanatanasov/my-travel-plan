# Implement: Search v2 — M3 Streaming UX

**Date:** 2026-08-16 · **Branch:** `feat/search-v2`
**Plan:** `context/plan/2026-08-11_smart-trip-search_plan.md` (M3)

## Backend
- `search-stream.registry.ts`: in-memory searchId → ReplaySubject map.
  Replay means a subscriber arriving after the surface event still gets
  the full story in order. Owner-checked (`userId` must match — a
  searchId is not a capability), 5-minute retention sweep. In-memory is
  safe single-container; noted for Redis if the backend ever scales out.
- `POST /flights/smart-search/stream` (NonGuestGuard, 3/min) → starts the
  funnel, returns `{ searchId }`; orchestrator events are piped into the
  subject, `done` carries meta, `error` the message, then complete.
- `GET /flights/smart-search/:searchId/stream` — NestJS `@Sse`, cookie
  auth (EventSource can't set headers; same-origin cookies can).
  Deviation from the plan's `202` phrasing: the POST returns a plain 201
  with the id — same contract, default status.

## Frontend (`features/search/tripSearch/`)
- `useSmartSearch.ts`: POST + EventSource lifecycle; typed events
  (surface/result/judgement/done/error), transport-drop handling, close
  on unmount, replay-tolerant.
- `SurfaceCalendar.tsx`: the month as a heat-map — cheapest observed
  price per departure day, tercile buckets in brand tints, candidate days
  ringed, "indicative prices" labelled (D1 honesty rule).
- `TripResultCard.tsx`: streamed itineraries in the current token
  language (the legacy FlightCard predates the design system); judgement
  badge + "why" line, affiliate deep link button, EU-safety-list note.
- `TripSearchPanel.tsx`: MonthPills + AirportSearch pair + nights window;
  results sorted judged-first; honest empty/degraded states; meta line
  (cached vs live lookups, duration).
- Routed at `/search/trips` (auth-gated, lazy chunk), cross-linked both
  ways with "Where to next?" (`/search`) — the two pages answer opposite
  questions (where vs when).

## Verification
- Backend tsc clean (SSE endpoints compile; stream logic is the M2-tested
  orchestrator + a thin registry).
- Frontend: tsc clean, build clean, eslint 0 errors, vitest 93/93.
- Live end-to-end needs provider keys — the no-key path shows the honest
  "no recent prices" state.
