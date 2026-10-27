# Travel Book - implementation log (2026-10-27)

Plan: `context/plan/2026-10-27_travel-book_plan.md`
Branch: `feat/travel-book` (not merged, not deployed - owner tests locally first)

## Done

### 1. Data layer
- `frontend/src/features/book/types.ts` - BookTrip / BookChapter / BookData / BookPage.
- `frontend/src/features/book/buildBook.ts`
  - `compareJourneys`: oldest first; year-only trips open their year; then
    date, then `sortIndex`; undated last by `sortIndex`.
  - `journeyYear` reads the year from the "YYYY-MM-DD" string (no Date
    timezone shift).
  - `tripStops` / `tripTitle` via `legEndpoints` (flight + land). Round trips
    are titled by the stop farthest from the origin ("Sofia to Tokyo and back").
  - New-country stamps: first trip in book order that reaches a country;
    home country excluded.
  - `buildPages`: cover alone, then pairs, then back cover alone, so the page
    count is always even and every trip is a true spread (route left, story
    right).
- `buildBook.test.ts` - 10 tests (ordering, titles, land legs, chapters,
  stamps, totals, page layout, empty book).

### 2. Shared extraction
- `legPhotoUrl` moved from `StopPhotoControl.tsx` to
  `features/flights/legPhoto.ts`; StopPhotoControl, PostcardMarker and the book
  import it from there.
- `MapExportCanvas` got an `inline` prop: draws in place filling its parent
  instead of off-screen. The book's route pages use the same trip renderer as
  the boarding-pass share (each with its own `svgId` so it never collides with
  the export canvas).

### 3. Flip shell - `features/book/components/FlipBook.tsx`
- Leaves hinged on the spine, `rotateY` + `preserve-3d` + hidden backfaces.
- Tap a side, drag (snaps past 30%), arrow keys / PageUp / PageDown / Home / End,
  prev/next buttons with a live page label.
- Spreads from 768px; single page below (each page its own leaf).
- Only leaves around the open spread are mounted.
- Jumps of more than one leaf (contents links) fade instead of riffling.
- `prefers-reduced-motion`: no turn animation, no drag.
- Pages designed at 450x600 and scaled via `--page-scale`.

### 4. Pages and styling
- Tokens: `--color-paper`, `--color-paper-edge`, `--color-binding`,
  `--color-binding-foil` (light + dark) -> Tailwind `paper`, `binding`
  (not `cover`: `bg-cover` is Tailwind's background-size utility).
- `BookPageFrame` (paper grain as inline SVG noise, spine gutter shadow,
  page numbers, leather cover with foil border), `FlagBackdrop` (corner +
  collage variants, faded flags via `CountryFlag`), `PassportStamp`
  (inline SVG, ink/shape/tilt stable per country).
- `BookPages.tsx`: cover, intro (owner + totals), contents (clickable),
  chapter title + stamps, trip route (map, stops, km, legs, mode icons),
  trip story (up to 3 photos as taped postcards, notes, entry stamps, a
  designed empty state), the story so far, next chapter (-> /search),
  back cover.
- Keyframes `book-shade`, `book-fade` in `index.css`.

### 5. Route, nav, guests
- `/book` inside the app layout (`App.tsx`, lazy chunk).
- Header link "Book" (icon-only on phones, 44px square).
- Guests: closed-cover teaser with Create account / Sign in.
- Current page kept in `?page=` so reload/back returns to it.
- `track('book_open', { kind })`.

## Permission model
Owner-only. No new endpoints; every source is an existing user-scoped
endpoint, photos through the existing authenticated photo route.

## Browser check (dev stack on 127.0.0.1:5273, test account book-test-1027@example.com)
Seeded 6 journeys (year-only, month, day, undated, multi-leg round trip) and
3 leg photos. Checked: cover, intro + contents, chapter opener + stamps, trip
spreads with and without photos, closing spread, phone single-page layout,
dark paper, guest teaser, keyboard turns, contents jump.

Fixed during the check:
- Infinite render loop: `setSearchParams` changes identity on every URL
  write, so syncing `?page=` re-fired forever. FlipBook now calls
  `onPageChange` through a ref, and the page only writes when the value differs.
- Flag backdrops moved inside the scaled page box (they kept desktop size on
  phones), collages softened and moved below the intro text, chapter
  openers and trip pages use corner flags placed away from text, dark-mode
  opacity lowered.
- Route line lists each stop once (+ the way home), so round trips with
  layovers no longer list every airport twice.

## Deviations from plan
- Chapter openers use the corner flag style rather than a collage (the
  collage fought the big year numeral). The intro page keeps the collage.

## Not verified
- Drag-to-turn by finger/mouse was not exercised by automation (tap,
  keys and buttons were). Worth trying on a real phone.

## Remaining
- Owner local test, then commit/merge/deploy on the owner's go.
- Test account `book-test-1027@example.com` lives only in the local dev DB.
