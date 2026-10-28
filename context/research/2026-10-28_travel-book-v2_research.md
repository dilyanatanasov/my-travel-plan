# Travel Book v2 - research (2026-10-28)

Follow-up to `2026-10-27_travel-book_*`. Owner feedback after using v1:

1. Stamps are nice, but you never see the stamp pages *grow* toward the end.
2. On the last page the book does not start again from the beginning when
   you keep swiping; desktop and phone behave differently at the end.
3. Some pages feel empty and repetitive: trips with no photo and no notes
   carry no description, so those pages feel unimportant.

## Relevant files

| File | Role |
|---|---|
| `frontend/src/features/book/buildBook.ts` | BookData + `buildPages` (cover alone, pairs, back cover alone; even count) |
| `frontend/src/features/book/types.ts` | `BookTrip`, `BookChapter`, `BookPage` union |
| `frontend/src/features/book/components/FlipBook.tsx` | 3D flip shell, `turnTo` clamps to `[0, leafCount]` |
| `frontend/src/features/book/components/BookPages.tsx` | All page components |
| `frontend/src/features/book/components/PassportStamp.tsx` | Inline SVG stamp, stable per country |
| `frontend/src/pages/TravelBookPage.tsx` | Route, `?page=` sync, page labels |
| `frontend/src/utils/shareCard.ts` | Boarding-pass trip card (canvas only, not reusable as DOM) |

## Findings (checked in the browser, dev stack 127.0.0.1:5273)

### End of book (issue 2) - a bug plus a missing behaviour
- Desktop: leaves = pages / 2. The final state (`turned === leafCount`) is the
  closed back cover; Next is disabled. Nothing loops.
- Phone: every page is its own leaf, so `leafCount === pageCount`. The back
  cover is page 25 but `turned` may reach 26: one more swipe turns the back
  cover away and leaves an **empty, unlabeled page** (`?page=26`). This is the
  "different view". Root cause: the single-page max should be `pageCount - 1`.
- No path from the back cover to the cover except Home key / prev x N.

### Stamps (issue 1)
- Stamps appear in two places: a per-chapter "New stamps" page (only that
  year's new countries, max 9) and up to 3 on each trip's story page.
- There is no cumulative view, so the collection never visibly fills up.
  A year with 3 stamps leaves most of its page blank.

### Empty pages (issue 3)
- `TripStoryPage` without photos/notes shows "Countries on this journey" +
  "Photos and notes you add to this journey will appear on this page." The
  same sentence repeats on every such trip; with one country it is mostly
  blank paper.
- Data available per trip with no new requests: stops (names, iso2, lat/lng),
  modes per leg, km per leg, date + precision, round trip flag, order in
  year / in book, new countries, home country, first-ever visit flags.
  That is enough to write a short, varied description per trip and to build
  "facts" (ordinal in the year, longest leg, km vs. Earth, first time abroad
  by train, etc.).
- Photos exist only as user-uploaded leg photos. Destination imagery from a
  third party (Wikipedia/Unsplash) would be the first external image source
  in the app: new privacy surface (destinations sent to a third party), CSP
  changes, licensing/attribution. No current precedent.

## Constraints
- No em dashes, no emoji in copy; icons inline SVG.
- Page components must stay pure (props only) for a future shared book.
- `buildPages` must keep an even page count (desktop leaves have two faces).
- New feature work: branch first, deploy only on owner's word.
