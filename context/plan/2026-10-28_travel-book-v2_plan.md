# Travel Book v2 - plan (2026-10-28)

Research: `context/research/2026-10-28_travel-book-v2_research.md`

## Confirmed decisions

| Topic | Decision |
|---|---|
| Stamps growing | A **Passport** section at the end of the book: every stamp ever collected, in order, 9 per page, the last page always keeps empty dotted slots (room to grow) |
| End of book | Fix the phone blank page; phone and desktop both end on the back cover. One more turn (Next, arrow key, tap, swipe) closes the book and reopens on the front cover |
| Empty trips | An auto-written story per trip from its own data (varied wording, no external sources) |
| Add photo | Drop the repeated "Photos and notes..." sentence; empty trips get a small "Add a photo" link that opens the Journeys panel on the map |
| Not doing | Compact single-page trips, ticket/fact cards, third-party destination photos |

## Permission model

Unchanged: owner-only, no new endpoints, no new data leaves the browser.
The story is computed client-side from data the owner already loads.
The "Add a photo" link is plain navigation to the owner's own map; the
future shared book must hide it (page components get a `canEdit` flag,
true only in the owner's book).

## Tasks

### 1. End of book (FlipBook)
- Single-page mode: the last reachable state is the back cover
  (`maxTurned = leafCount - 1`), never a turned-away blank page.
- At the end, forward intent loops: Next button (label "Back to the
  cover"), ArrowRight/PageDown, a tap on the back cover's right side, a
  leftward swipe. Uses the existing jump fade, ends on the cover.
- `?page=` beyond the last page clamps to the back cover (already does).

### 2. Passport section (buildBook + page)
- `buildPages`: after the last chapter, a `passport-title` page (owner,
  stamp count, first and latest entry) followed by `passport` pages of 9
  stamps each in first-visit order. Always at least one empty slot on the
  last page; pad with one more stamp page when needed to keep the page
  count even.
- Each stamp carries the trip date of its first visit.
- Contents lists "Passport" after the chapters.
- Empty slot: faint dashed ring, same footprint as a stamp.

### 3. Auto-written trip story (pure, tested)
- `features/book/tripStory.ts`: `tripStory(trip, context) -> string`.
  Context built in `buildBook`: position in its year and in the book, first
  journey ever, first use of a mode, longest journey so far, first-visit
  year of countries it returns to.
- 2-3 sentences: an opening (position + date), the route (km, modes,
  stops, back home), one highlight by priority: new countries, longest
  yet, first by a mode, a return to a known country, share of the Earth.
- Wording variants chosen by journey id, so it is stable but not
  identical across pages. No em dashes, no emoji.
- Stored as `BookTrip.story`; unit tests for each branch.

### 4. Story page layout
- No notes: the auto story is the page's text (with or without photos).
  With notes: the owner's words win, no auto story.
- No photo, no notes: story in larger serif, the countries list kept below
  it, then the small "Add a photo" link (owner only), stamps at the foot.

### 5. Verification
- Unit tests (buildPages passport layout + parity, tripStory), typecheck,
  lint.
- Browser: desktop + phone end-of-book loop, passport pages, story pages
  with/without photos/notes, dark mode.

## Delivery
- Branch `feat/travel-book-v2`; owner tests locally; deploy only on the
  owner's explicit go.
- Log: `context/implement/2026-10-28_travel-book-v2_implement.md`.
