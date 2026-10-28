# Travel Book v2 - implementation log (2026-10-28)

Plan: `context/plan/2026-10-28_travel-book-v2_plan.md`
Branch: `feat/travel-book-v2` (not merged, not deployed - owner tests locally first)

## Done

### 1. End of book (`FlipBook.tsx`)
- Phone bug fixed: the last reachable state is the back cover
  (`maxTurned = leafCount - 1` in single-page mode). Before, one more turn
  showed a blank, unlabeled page (`?page=26`).
- Forward from the back cover reopens the book at the front cover (fade):
  Next button (becomes a "Back to the cover" restart icon), ArrowRight /
  PageDown, a tap anywhere on the back cover, a leftward swipe. A rightward
  drag on the back cover still goes back a page.

### 2. Passport section
- `BookData.passport`: every stamp in first-visit order with its date.
- `buildPages`: after the chapters, `passport-title` + `passport` sheets of
  9 (`STAMPS_PER_SHEET`). The last sheet always keeps at least one empty
  slot; one extra blank sheet when needed so the closing pages stay a spread.
- Title page: stamp count, "of 195 countries" with a progress bar, first and
  latest entry. Sheets: numbered stamps, dashed empty slots, "Room for the
  next ones." Contents lists "Passport".

### 3. Auto-written story (`tripStory.ts`, pure)
- Opening (first page of the book / nth journey of the year + month / last
  of the year / undated), route (km, modes, via up to two stops, home
  again), one highlight by priority: new countries, longest yet, first time
  by a mode, a return, at home, share of the Earth.
- Wording variants picked by journey id: stable, but not identical page to page.
- Context (first-visit years, modes seen, longest so far) built in `buildBook`.

### 4. Story page
- Owner notes win. No notes: the story is shown (smaller under photos,
  large serif on a bare page). Bare page: story, countries as a flag row,
  "Add a photo" link to the Journeys panel (`/` with `{ section: 'flights' }`),
  owner only via the new `canEdit` page prop. The repeated "Photos and notes
  you add..." sentence is gone.

### Found and fixed on the way
- `MapExportCanvas` render loop ("Maximum update depth exceeded"): while
  the visits query loads, `data: visits = []` was a new array each render,
  so the framing memo changed, its effect set state, and it looped. Showed
  in the book on slow loads; affects the trip share dialog too. Now stable
  module-level empties.

## Tests
- `buildBook.test.ts`: passport order, contents entry, parity + room to grow
  for 1/8/9/17/18/26 stamps, stories present.
- `tripStory.test.ts`: openings, route wording, highlight priority, fallbacks,
  undated / no stops, no em dashes.
- Full suite 165 passed, `tsc -b` clean, eslint clean.

## Browser check (127.0.0.1:5273, book-test-1027@example.com)
Desktop + phone: bare trip story page, notes trip, passport spread, back
cover loop by key / button / tap / swipe, rightward drag goes back, `?page=40`
clamps to the back cover on phone, dark mode passport. No console errors.

## Deviations
- The world count is a fixed 195; the countries table has 240 rows
  including territories.

## Remaining
- Owner local test, then merge/deploy on the owner's go.
