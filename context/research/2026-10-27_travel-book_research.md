# Travel Book - research (2026-10-27)

A new view that shows a user's trips as a book. Owner direction so far:

- **Structure: option C, the yearbook.** Cover, one chapter per year, a
  spread per trip, passport-style stamps for new countries, a closing
  "next chapter" page.
- **Page-turn: realistic if not too hard.**
- **Read-only for v1.**
- **Style:** country flags in the page backgrounds, with some styling.
- **Private for now**, but sharing would make the most sense later.
- **PDF / print export:** undecided.

## 1. Data we already have (no new tables needed for v1)

| Book element | Source |
|---|---|
| Chapters by year | `flight_journeys.journey_date` + `date_precision` (day / month / year); undated journeys need a home (see challenges) |
| Order inside a year | `journey_date`, then `sort_index` (the user's own tie-break, also used by replay) |
| Route per trip | `flight_legs` (eager on journey): `travel_mode`, airport or city endpoints, `distance_km`, `leg_order` |
| Trip text | `flight_journeys.notes` |
| Photos | `leg_photos` (max one per leg, `leg_id` unique), served by the authenticated `GET /flights/legs/:legId/photo`; `GET /flights/legs/photos` lists which legs have one |
| Countries / flags | Leg endpoints -> airport/city -> country `isoCode2`; `<CountryFlag iso2 />` (`frontend/src/components/ui/CountryFlag.tsx`, flag-icons, SVG) |
| "New country" stamps | First journey in date order that touches a country; `/flights/stats` and `/flights/summary` already compute related totals |
| Cover totals | `/flights/stats`, `/flights/summary`, visits list |

Existing frontend pieces to reuse (reuse rule):

- `legEndpoints`, `legMode` (`components/FlightMap/routeUtils`) - endpoint
  resolution for both flight and land legs (the sweep rule from land travel
  applies: always go through `legEndpoints`).
- `formatJourneyDate` (`utils/journeyDate`) - date labels respecting precision.
- `MapExportCanvas` + `utils/shareCard` - already draw a single trip's route
  as a static picture; the trip spread's route map can likely reuse this.
- `useGetLegPhotoIdsQuery` (`features/flights/flightsApi`) - photo presence.
- `CountryFlag` - every flag must go through it; no raw `fi` classes.
- `TripShareDialog` - per-trip boarding-pass image share (image only, no URL).

## 2. Page-turn options

1. **`react-pageflip` / `page-flip` (StPageFlip)** - the well-known realistic
   curl (canvas or HTML mode, shadows, drag-to-turn, mobile portrait mode).
   Last published **May 2022** (react-pageflip 2.0.3, page-flip 2.0.7); no
   maintenance for 4+ years, React 18 works in practice but it is class-based
   and touches the DOM directly. Real curl, but an unmaintained dependency
   in a core view.
2. **Own CSS 3D flip** - each leaf is a `transform-style: preserve-3d` card
   rotating on `rotateY` with `backface-visibility: hidden`, a gradient
   shadow on the fold, and pointer-drag to scrub the angle. Gives a
   "hard page" turn (like a hardcover photo book), not a paper curl. About
   200-300 lines, no dependency, full control over reduced-motion and mobile.
   **Recommended**: looks realistic enough with good shading, no stale
   library, and fits the app's "inline SVG / own components" approach.
3. **Fake curl with a clip-path + gradient on top of option 2** - possible
   polish later if the hard-page turn feels too stiff.

Mobile: two-page spreads don't fit a phone. Under the `md` breakpoint show
one page at a time (StPageFlip calls this portrait mode); the flip still
works, just one leaf wide.

Reduced motion: `prefers-reduced-motion` -> crossfade instead of the flip.

## 3. Visual direction (flags in the background)

- Page background: the trip's country flags, large, faded (low opacity,
  desaturated or tinted toward the paper color) and maybe rotated/cropped
  like a watermark. A blur or paper-grain overlay keeps text readable.
- Chapter openers: a collage of every flag from that year.
- Passport stamps: inline SVG stamp (round/rect border, country name, date),
  slightly rotated, tinted in the flag's main color. No emoji (product rule).
- Paper texture: CSS gradients / a tiny inline SVG noise filter - no image
  assets needed.
- Copy: no em dashes in product text (product rule).
- Dark mode: the book still reads as paper, but a warm dark paper variant is
  needed so it does not glare at night.

## 4. Sharing (later, not v1)

There is a public-share mechanism already: `share` module, `POST /share/enable`,
public `GET /share/:token` returning `PublicMapDto`. A shared book would follow
the same token pattern, but:

- Photos are currently **owner-only** (authenticated photo endpoint, deliberate
  privacy decision in the 2026-08-14 research). A shared book would need a
  token-scoped photo route, and the user should choose per book whether
  photos and notes are included.
- Notes are free text and may hold private things; never include them in a
  share by default.

So v1 being private costs nothing later as long as the book's page
components take plain data props (not hooks that assume the logged-in
owner). Then a public `/book/:token` page can render the same components
from a public DTO.

## 5. PDF / print (undecided)

Not committing now. To keep the door open cheaply: design pages at a fixed
aspect ratio (e.g. 3:4 per page) and scale them to fit, instead of fluid
layouts. That is also what makes the flip look like a real book.

## 6. Challenges and open points

- **Undecided dates**: journeys with no date or year-only precision. Options:
  a "Somewhere in time" chapter at the end, or year-only trips at the start of
  their year.
- **Empty trips** (no photo, no notes): the flag background + route map +
  stats must make the spread look intended, not blank.
- **Many trips**: a heavy user could have hundreds of pages. Render only the
  current spread +/- one; lazy-load photos per spread.
- **Photo loading**: photos go through an authenticated endpoint, so they
  are fetched as blobs with the auth token (check how `StopPhotoControl`
  does it today and reuse that).
- **Guests**: the app has a guest experience; decide whether guests see the
  book with local data or a "sign in to keep your book" prompt.
- **Entry point**: where the book opens from (nav item, map toolbar button,
  stats panel).
- **Permission model (security rule)**: v1 is owner-only. Every data source
  is an existing authenticated endpoint already scoped to the user, so no new
  server surface in v1. A future share link needs its own token check and
  must not expose photos/notes unless the owner opts in.
