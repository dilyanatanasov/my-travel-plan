# Implementation log: stop kinds follow the hop mode; reorder arrows wait

Date: 2026-10-03. Bugfix to shipped behaviour (no separate plan file).
Owner report: "if I set a stop as land, e.g. car, it should switch the
picker from airport to city; this has problems when editing", and "moving
a journey up doesn't always work as expected".

## Diagnosis
- The editor only switched a stop to city search when the stop was still
  EMPTY (`syncStopsWithMode`, "a filled airport is a legitimate land
  endpoint"). On an existing journey every stop is filled, so choosing
  Car left the airports in place and the server accepted a car leg
  between two airports (`resolveStops` had no rule for that direction).
- Adding a stop after a land hop appended an airport picker under a car chip.
- Reorder: the swap mutation only invalidates the list; between the POST
  resolving and the refetch landing, the old order still showed live
  arrows, and a quick second click re-sent the same pair, swapping it
  straight back.

## The rule (owner, 2026-10-03)
A stop needs an airport if any hop touching it is a flight; otherwise it
is a city. The stop where a flight meets a drive stays the airport.

## Done
- `frontend/.../stopChain.ts`: `requiredStopKind`, `kindForNewStop`,
  `conformStopsToModes` (per-stop conversion with resolvers both ways),
  `syncStopsWithMode` now takes the full updated `modes` and both
  resolvers. A filled airport under a land hop becomes the city it serves;
  if no city can be placed it becomes an empty city search and is named
  in `unresolved`. Edit-open pass (`keepUnresolved`) never clears a stop
  nobody touched.
- `frontend/.../FlightForm/useCityForAirport.ts`: airport -> city lookup
  by the airport's municipality (first comma part), nearest result in the
  same country within 150 km.
- `FlightCard`: mode change and edit-open apply the rule, announced with
  "Adjusted for you: LHR → London"; new stops start as the inherited
  mode's kind. `RouteBuilder`: same for the add form.
- `FlightList`: arrows disabled while the list is refetching, not only
  while the POST is in flight.
- Backend `flights/stop-kinds.util.ts` + spec: `stopKindViolation`, called
  from `resolveStops` after the airports load so the message can name the
  IATA code. Server-side enforcement of the rule.
- Tests: stopChain 21 (6 new), backend stop-kinds 7.

## Verified
- frontend tsc, eslint, vitest 139/139; backend build, eslint, jest.
- Dev stack: POST car VAR->SOF refused with the new message; POST
  VAR ->(flight) SOF ->(car) Plovdiv accepted, legs flight,car.

## Known effects
- Existing journeys with a land leg between two airports (saved under the
  old rule) now convert on edit-open where the city can be placed, else
  the server message asks for the city on save. Replay and stats of
  untouched journeys are unaffected.
- The same-date reorder direction (top of a same-date cluster plays
  first) is a documented design choice from 2026-08-14, unchanged.
