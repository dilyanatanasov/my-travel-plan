# Travel Book - plan (2026-10-27)

Research: `context/research/2026-10-27_travel-book_research.md`

## Confirmed decisions

| Topic | Decision |
|---|---|
| Structure | Yearbook (option C): cover, one chapter per year, a spread per trip, passport stamps for new countries, "next chapter" closing page |
| Page-turn | Own CSS 3D hardcover flip (fold shading, drag to turn). No `react-pageflip` |
| Editing | Read-only in v1 |
| Style | Country flags as faded, styled page backgrounds; paper texture; warm dark-paper variant for dark mode |
| Undated trips | Year-only trips open their year's chapter; trips with no date go in a closing "Somewhere in time" chapter |
| Entry point | Main navigation, new route `/book` |
| Guests | Closed-cover teaser with "Sign in to keep your travel book" |
| Privacy | Private (owner-only) in v1. Components take plain data props so a share link can reuse them later |
| PDF / print | Undecided. Pages use a fixed 3:4 ratio so export stays possible |

## Permission model

v1 is owner-only and adds **no new server endpoints**. All data comes from
existing authenticated, user-scoped endpoints (`GET /flights`, `/flights/stats`,
`/flights/summary`, `/flights/legs/photos`, `/flights/legs/:legId/photo`,
visits). Photos load as plain `<img>` with same-origin cookies, exactly as
`StopPhotoControl` does now. A future share link needs its own token check and
an explicit opt-in for photos and notes, so it gets its own plan.

## Architecture

Pure data layer, then dumb page components, then the flip shell:

```
pages/TravelBookPage.tsx           route /book; guest teaser or the book
features/book/
  buildBook.ts                     journeys + countries -> BookPage[] (pure, tested)
  buildBook.test.ts
  useTravelBook.ts                 RTK Query hooks -> buildBook (only place that fetches)
  types.ts                         BookPage union: cover | chapter | trip | stamps | closing
  components/
    FlipBook.tsx                   3D flip shell: spreads, drag, keys, reduced motion, mobile single page
    BookPageFrame.tsx              3:4 paper page, grain, flag background slot
    FlagBackdrop.tsx               faded, styled flags behind a page (uses CountryFlag)
    PassportStamp.tsx              inline SVG stamp, tinted, slightly rotated
    pages/CoverPage.tsx
    pages/ChapterOpener.tsx        year summary + flag collage
    pages/TripRoutePage.tsx        left page: route map, date, distance, modes
    pages/TripStoryPage.tsx        right page: photos as postcards, notes, stamps
    pages/ClosingPage.tsx          "Next chapter" -> /search (Where to next?)
```

Page components receive data props only (no hooks that assume the owner),
so a future public `/b/:token` page can render the same components.

## Tasks

### 1. Data layer
- `buildBook.ts`: group journeys into chapters by year using `journey_date` +
  `date_precision`; order by date then `sort_index`; year-only trips first in
  their year; no-date trips into "Somewhere in time".
- Countries per trip via `legEndpoints` (flight and land legs), mapped to iso2.
- "New country" = first trip in book order that touches a country -> stamp.
- Chapter stats: trips, new countries, km. Cover stats: totals.
- Unit tests for grouping, ordering, undated handling, first-visit stamps,
  land legs.

### 2. Shared extraction (reuse rule)
- Move the authed leg photo URL helper out of `StopPhotoControl.tsx` into a
  shared util so the book and the stop chip use the same function.
- Reuse `formatJourneyDate`, `CountryFlag`, and the trip-route drawing from
  `MapExportCanvas` / `utils/shareCard` for the route page (extract a
  `TripRouteMap` component if it is not reusable as is).

### 3. Flip shell (`FlipBook`)
- Leaves with `preserve-3d`, `rotateY`, `backface-visibility: hidden`;
  fold shadow via gradient whose strength follows the angle.
- Turn by click/tap on page edge, arrow keys, drag (pointer events, snaps
  past 50%).
- `md` and up: two-page spreads. Below `md`: single page.
- Only current spread +/- 1 mounted; photos `loading="lazy"`.
- `prefers-reduced-motion`: crossfade.
- Page counter + chapter jump (table of contents on the cover's back).

### 4. Pages and styling
- Paper: CSS gradient + inline SVG noise; light and warm-dark variants as
  theme tokens.
- `FlagBackdrop`: trip's flags large, low opacity, tinted toward paper,
  slight rotation; chapter opener uses a collage of the year's flags.
- Empty trips (no photo, no notes) still look designed: bigger route map,
  stats, and flag backdrop.
- Copy: no em dashes, no emoji; icons inline SVG.

### 5. Route, nav, guests
- `/book` route inside the app layout; add "Book" to the main navigation.
- Guest: closed cover teaser + sign-in link.
- Analytics event on open (`track('book_open')`) consistent with existing usage.

### 6. Verification
- Unit tests (task 1), typecheck, lint.
- Run locally, check: desktop spread, phone single page, dark mode, reduced
  motion, a user with no trips, many trips, undated trips.

## Delivery

- Branch `feat/travel-book`. Owner tests locally first; deploy only on the
  owner's explicit go (new feature, not a bugfix).
- Implementation log: `context/implement/2026-10-27_travel-book_implement.md`.

## Out of scope for v1 (noted for later)

- Public share link for the book (token + photo/notes opt-in).
- PDF / print export.
- Captions, cover photo choice, any editing.
- Paper-curl polish on top of the hard-page flip.
