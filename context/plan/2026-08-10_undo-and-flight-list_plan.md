# Plan: Undo Toasts & Flight List Scaling

Date: 2026-08-10
Research: `context/research/2026-08-10_undo-and-flight-list_research.md`

## Decisions (made autonomously; roadmap approved, user away)

| Decision | Chosen | Rejected |
|---|---|---|
| Country delete | Delete immediately, offer **Undo** in a toast (8s) | A confirm dialog — it interrupts the common case (deliberate toggling) to guard the rare one, and users click through them anyway |
| Flight delete | Keep `confirm()`, add a result toast | Undo — the create endpoint re-derives legs from `isRoundTrip`, so replaying stored legs would duplicate them or drop the flag. Needs a backend restore endpoint; logged as a follow-up rather than shipped half-working |
| Undo payload | Pass the whole `Visit` object | Passing the id — an id alone restores an empty country, silently losing date, notes and type, which is the data the undo exists to protect |
| Flight list | Group by year, newest expanded, rest collapsed, plus free-text search | Pagination — years are how people think about trips, and collapsed sections keep the totals visible |

## Changes

1. **`components/Toast/ToastProvider.tsx`** (new) — context + `aria-live` region, tones
   (neutral/success/error), optional action button, auto-dismiss (4s, 8s with an action).
   Mounted in `main.tsx` above `App`.
2. **`features/visits/useVisitActions.ts`** (new) — `addVisitForCountry`,
   `removeVisitWithUndo(visit)`, `restoreVisit(visit)`. One place where country mutations
   report failure and offer undo, shared by the map and the list.
3. **`TravelMap.tsx` / `TravelMapPage.tsx`** — key `visitByCountryId` by full `Visit` rather
   than id; route all country mutations through the hook; toast on home-country failure and
   on visit-type update failure.
4. **`CountryList.tsx`** — `onRemove` takes the `Visit`, not the id.
5. **`FlightList.tsx`** — group by year (undated last), per-year journey count and distance
   total, newest year expanded by default, search across IATA codes, cities and notes.
   Searching expands everything, since hidden matches are useless.

## Verification

1. Remove a country, click Undo, confirm the date and visit type come back — not just the name.
2. Confirm the flight list groups by year with only the newest expanded, and that the page
   height drops substantially from 7,771px.
3. Search filters and reveals matches.
4. `tsc --noEmit` clean.
