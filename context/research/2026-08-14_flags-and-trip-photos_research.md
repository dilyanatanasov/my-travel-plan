# Flags on countries + photos on flights — research (2026-08-14)

## A. Country flags in the UI

Three ways to render flags, one clear winner:

1. **Emoji flags** (alpha-2 → regional indicator pairs). Zero assets — but
   **Windows Chrome/Edge renders them as letter pairs ("BG"), not flags**;
   Windows ships no emoji flag font. The owner develops on Windows and a
   large share of desktop visitors will be on it. Disqualifying.
2. **`flag-icons` npm package** (SVG per country, CSS classes, 4:3 and 1:1).
   Crisp at any size, identical on every OS, no external requests. Flags load
   as individual static assets on demand — they do not bloat the JS bundle.
   **Recommended.**
3. **flagcdn.com images**: third-party request per flag — leaks visitor IPs
   to an external host, against the app's privacy posture. No.

Build note (reuse rule): one `<CountryFlag iso2 />` component wrapping the
CSS class, used everywhere — never raw classes scattered around. We already
store `isoCode2` on countries, which is exactly what flag-icons keys on.

Candidate placements (pick at plan time): CountryDetailCard header, the
Countries section list, search dropdown results, duel rosters, WhereNext
destination cards. The map itself should stay clean — flags on geography
are noise at world zoom.

## B. Photos on flights (postcards) — the ia-ftiness-app pattern

Read from `C:\Users\dilya\ia-ftiness-app` (the known-good deploy reference).
Their pipeline, end to end:

- **Upload**: multer `diskStorage` → `./uploads/<feature>/` with a
  timestamp+random filename; `fileFilter` on MIME; `limits.fileSize` 10MB
  raw ("compressed server-side"); endpoint behind JWT guard.
- **Processing**: a shared `ImageProcessingService`
  (`common/services/image-processing.service.ts`) — worth porting nearly
  verbatim: magic-byte validation (a spoofed Content-Type cannot sneak a
  non-image past the MIME filter), sharp resize/convert (jpeg/webp, quality
  85, `fit: inside`, never enlarges), write-to-tmp-then-rename (sharp cannot
  read and write the same path), cleanup of every intermediate file on both
  success and failure.
- **Serving**: Nest `useStaticAssets` on `/uploads` + nginx `location ^~
  /uploads`; a named docker volume `uploads_data:/app/uploads` persists
  across deploys.
- **Bonus for us**: sharp strips EXIF (including GPS) by default unless
  `.withMetadata()` is asked for — pair with `.rotate()` first so
  orientation is applied before the tag is dropped.

### Where myContrail must diverge — permissions

The fitness app serves `/uploads` **publicly**: anyone with the URL sees the
photo, and filenames (timestamp + Math.random) are guessable-ish. Fine for
gym check-ins; wrong for someone's travel photos in a privacy-first app.
Two options:

1. **Authenticated photo endpoint** (recommended): no public static serving
   at all — `GET /flights/:journeyId/photos/:photoId` streams the file after
   the ownership check, same 404-not-403 rule the journeys API already uses.
   Costs a Node hop per image; at our scale that is nothing.
2. Unguessable filenames (crypto 16-byte, like share tokens) on public
   static serving. Cheaper, but a leaked URL is a leaked photo forever, and
   revocation means deletion. Only acceptable if photos later become
   deliberately shareable.

### Sketch for the build (not a plan yet)

`journey_photos` table (id, journeyId FK cascade, filename, sortIndex,
createdAt) · per-user cap (e.g. 20 photos, ~300KB each after compression)
· upload/delete endpoints behind auth + ownership · replay shows a
postcard as the plane lands on a journey with photos · photos NEVER appear
on shared maps, share cards, unfurls, or duels in v1 — consent model comes
later if ever. Droplet: uploads volume joins the backup cron; disk is fine
(~50GB, photos capped).

One ambiguity to confirm before planning: "photos on the flight with the
badges" — read here as photos-on-flights plus the flag work above. If
"badges" meant something else (e.g. passport-stamp badges per country),
say so and that becomes its own research.
