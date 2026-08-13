# Guest experience — findings from first real user test

**Date:** 2026-08-13. Source: the user's friend used the live app as a guest; observations relayed verbatim, each traced to code.

## Finding-by-finding diagnosis

| # | Report | Diagnosis | Class |
|---|---|---|---|
| 1 | "Hard to discover settings" | Settings link exists for guests too, but only inside the avatar dropdown (`AccountMenu.tsx:138`). Nothing in the header hints it exists. | UX decision |
| 2 | "Didn't know what to do" | `MapFirstRunHint` exists and explains country-tapping — but its single CTA button is "Add your flights", which visually dominates the hint. Text says tap-a-country; button says flights. Mixed signal. | UX decision |
| 3 | "Map blocked because of no flights; maybe he just wants countries" | The map is never actually blocked — tapping a country always works. Perception created by #2's flights-first CTA. | Same as #2 |
| 4 | "Dates should be optional" | **Already optional** — form type `journeyDate?`, backend DTO `@IsOptional() @IsDateString()`. Friend proved it by skipping them. | Already done |
| 5 | "Play stayed disabled after account creation, 2–3 flights entered" | Replay deliberately includes only **dated** journeys (`useJourneyReplay.ts`: "Undated journeys are skipped rather than guessed at") and needs ≥2. His flights had no dates → `replay.total` 0. The explanation exists only as a `title` tooltip — invisible on mobile. Account creation was never relevant. | Bug (feedback invisible) |
| 6 | "Flight should auto-mark country visited" | **Backend already does this** (`flights.service.ts:129`, `createVisitRecords`). But `createFlight`/`updateFlight` mutations invalidate only `['Flight','FlightStats']` — not `'Visit'` (`flightsApi.ts:46,55`) — so the map doesn't refetch visits and the country stays uncolored until reload. CSV import invalidates correctly. | Bug (cache) |

## Fixes applied without needing decisions (both are restoring intended behavior)

1. `createFlight` + `updateFlight` also invalidate `'Visit'` → countries color the moment a flight lands.
2. Replay's disabled state: reason now (a) distinguishes "no flights" from "flights without dates", and (b) is announced via toast on tap (aria-disabled pattern) so mobile users get the signpost desktop users got from the tooltip.

## Decisions for the user (plan phase)

- **D1 First-run hint emphasis**: lead with country-tapping (primary understanding) and demote "Add your flights" to a text link? Or keep flights-primary (flights are the differentiating feature)?
- **D2 Settings discovery**: add a gear icon next to the account menu in the header, or leave Settings inside the dropdown?
- **D3 Undated journeys in replay**: keep skipping them (honest ordering) with the new clearer messaging, or append them at the end of the replay in entry order?

## Decisions confirmed (2026-08-13, same day)

D1 countries-first hint (flights demoted to text link) · D2 gear icon in header · D3 replay keeps skipping undated journeys. All implemented alongside the bug fixes.

## Files

`frontend/src/features/flights/flightsApi.ts` · `frontend/src/components/TravelMap/{ReplayControl,useJourneyReplay,MapFirstRunHint}.tsx/.ts` · `frontend/src/features/auth/AccountMenu.tsx` · `frontend/src/components/Layout/Layout.tsx` · backend auto-visit: `backend/src/modules/flights/flights.service.ts`

Note: the share-unfurl background agent owns `SharePanel`/`shareApi`/nginx templates — none of these files overlap.
