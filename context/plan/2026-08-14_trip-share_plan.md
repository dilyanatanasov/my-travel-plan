# Trip share — plan (confirmed 2026-08-14)

Share one journey, not the whole map. Decisions (user-confirmed):
**image card only** for v1 (no public trip links, no new privacy surface);
**boarding-pass design** (ticket, not a re-skinned map card); entry points
**both** the Flights list (icon per card) and the map's selected-journey
card, one dialog behind both.

## Build

1. `MapExportCanvas` learns `journey` and `svgId` props: journey mode draws
   only that journey's route and airports, frames on its legs, renders
   countries as plain land (the trip is the highlight, not the visit
   colours), and skips the centroid wait. `svgId` avoids colliding with the
   map-card canvas if both ever mount.
2. `shareCard.ts` gains `renderTripCard`: 1080×1350 ticket — brand row,
   big mono route (SOF → AMS → NRT), date/flights row, 2:1 map strip,
   km/stops row, perforation with edge notches, stub with PASSENGER
   (displayName, else TRAVELLER) and mycontrail.com. Even-gap
   justification like the reworked Warm/Ink.
3. `TripShareDialog` (features/share): modal with preview, Share (native
   sheet) and Save buttons — the SharePanel render/poll flow, extracted
   where shared.
4. Entry points: share icon on FlightCard rows; Share button on
   SelectedJourneyCard; both open the dialog with their journey.

## Out of scope (later)

Public per-trip pages, animated/video trip share, postcards on the card.
