# Research: Undo Toasts & Flight List Scaling

Date: 2026-08-10

## 1. Destructive actions had no safety net

`TravelMap.tsx` — clicking a visited country called `removeVisit(id)` immediately. The visit
row carries `visitedAt`, `notes` and `visitType`, all destroyed with it. No confirmation, no
undo. On a phone, small countries are a few pixels wide, so this is one mis-tap away at all
times. This is not theoretical: while testing this very change, a real "France" visit
(2025-12-05, trip, manual) was destroyed by exactly this flow and had to be recovered from
the `pg_dump` backup.

`CountryList.tsx` had a Remove button with the same behaviour, and only passed `visit.id`
upward — so even a caller that wanted to offer undo could not, having nothing to restore from.

## 2. Failures were invisible

- `TravelMapPage.tsx` — `handleToggleCountry` awaited the mutation and discarded the result.
- `TravelMap.tsx` — `handleSetHomeCountry` caught errors into `console.error`.
- `TravelMapPage.tsx` — `handleUpdateVisitType` did not even await.

With the backend down, clicking a country did nothing and said nothing. There is no toast or
notification system anywhere in the app to say otherwise.

## 3. The flight list does not scale, and already hurts

`FlightList.tsx` mapped every journey with no grouping, sort, search or pagination. With the
41 real journeys in this database that produced a **7,771px** page. This is present-tense,
not a future concern.

`FlightCard` renders route, date, distance, leg count and per-leg breakdown — a rich card,
which is right, but forty of them stacked flat is not browsable.

## Constraints

- `POST /visits` accepts `countryId`, `visitedAt`, `notes`, `visitType`, so a visit can be
  faithfully re-created — undo is genuinely possible for countries.
- `POST /flights` rebuilds legs from `airportIds` or `legs`, but **also appends reverse legs
  when `isRoundTrip` is true**. Restoring a deleted round trip by replaying its stored legs
  would either duplicate them or lose the round-trip flag. Faithful flight undo therefore
  needs a dedicated restore path on the backend, which is more than this pass should take on.
- RTK Query already invalidates the `Visit` tag on add/remove, so a restored visit repaints
  the map without extra wiring.
