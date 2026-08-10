# Implementation: Undo Toasts & Flight List Scaling

Date: 2026-08-10
Plan: `context/plan/2026-08-10_undo-and-flight-list_plan.md`
Branch: `feat/user-accounts-auth`
Status: **Complete and verified**

## What shipped

| File | Change |
|---|---|
| `components/Toast/ToastProvider.tsx` | **New.** `aria-live` toast system with tones and an optional action button. 4s default, 8s when an action is present. |
| `features/visits/useVisitActions.ts` | **New.** Single place for country add/remove: reports failure, offers undo, restores from a full snapshot. |
| `main.tsx` | `ToastProvider` wraps `App`. |
| `components/TravelMap/TravelMap.tsx` | Country clicks go through the hook; `visitByCountryId` holds full `Visit` records; home-country failure now surfaces. |
| `pages/TravelMapPage.tsx` | Same, plus a toast when a visit-type update fails (it previously was not even awaited). |
| `components/CountryList/CountryList.tsx` | `onRemove` receives the `Visit`, not the id. |
| `components/FlightList/FlightList.tsx` | Year grouping, per-year totals, collapse/expand, search, toast on delete. |

## Verification

**Undo restores the whole record, not just the country** — scripted in the browser:

| | count | visit type | date |
|---|---|---|---|
| before | 25 | trip | 12/5/2025 |
| after remove | 24 | — | — |
| after undo | 25 | trip | 12/5/2025 |

**Flight list**, with the real 41 journeys:
- 10 year sections, newest (2026, 9 journeys) expanded, the rest collapsed.
- Each header shows its journey count and distance total (e.g. 2025 — 9 journeys, 47,446 km).
- Page height **7,771px → 3,121px**, and most of what remains is the map, not the list.
- Search input present and filtering across IATA codes, cities and notes.

`tsc --noEmit` clean.

## Incident during testing — real data was destroyed and recovered

While verifying the toast, the 8-second window expired between taking a screenshot and
clicking Undo, so a real **France** visit was permanently deleted. It was recovered from
`context/backups/pre-auth-20260810-185446.sql` and re-inserted with its original values
(country 60, `visited_at` 2025-12-05, `visit_type` trip, `source` manual, original
`created_at` so list ordering is unchanged). Row counts verified back at 25/25.

Two things worth recording:
- The backup taken at the start of item 1 is what made this recoverable. It earned its keep.
- This is precisely the failure the feature exists to prevent, demonstrated accidentally on
  real data within minutes of writing it. The un-undoable version of this flow shipped for
  months.

## Deliberate gap: flights still have no undo

`POST /flights` re-derives legs from `isRoundTrip`, so replaying a deleted journey's stored
legs would either duplicate every leg or silently drop the round-trip flag. Flights keep a
`confirm()` dialog plus a result toast until there is a backend restore endpoint that takes
a journey verbatim. Shipping a "working" undo that quietly corrupts a round trip would be
worse than the dialog.

**Follow-up:** add `POST /flights/restore` accepting a full journey (legs with their order
and distances, plus `isRoundTrip`) and bypassing leg derivation, then switch flight deletion
to the same undo pattern as countries.
