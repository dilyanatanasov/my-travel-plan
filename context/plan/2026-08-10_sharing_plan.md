# Plan: Sharing

Date: 2026-08-10
Research: `context/research/2026-08-10_sharing_research.md`

## Decisions (made autonomously; roadmap approved, user away)

| Decision | Chosen | Rejected |
|---|---|---|
| Public link identity | **Opt-in random token** (`/s/:token`), off by default, revocable | Username-based public profile — makes every account guessable and forces a username concept |
| Share payload | Countries, visit types, aggregated routes, airports, stats. **No notes, no email, no exact visit dates** | Reusing the authenticated DTOs — they carry private free-text notes |
| PNG export | Serialise the live SVG → canvas → blob, no new dependency | html2canvas / dom-to-image — a large dependency for something the DOM already gives us, since the map is real SVG with inline fills |
| Export framing | Composite a caption bar (name + headline stats) under the map | Bare map crop — a shared image with no context does not travel |
| Link previews | **Static** OG/Twitter tags + a committed OG image | Dynamic per-user tags — crawlers do not run JS, so this needs the API to serve HTML. Logged as a follow-up |
| Map reuse | Extract `numericToAlpha3` and a `CountriesLayer` component | Copying 250 lines of ISO table into a second map |

## Backend

1. **Migration** — `users.share_token varchar(24) NULL UNIQUE`. Presence means sharing is on;
   clearing it revokes. Indexed by the unique constraint.
2. **`ShareModule`**
   - `POST /share/enable` (auth) → generates a token if absent, returns it. Idempotent.
   - `DELETE /share` (auth) → clears the token, instantly killing existing links.
   - `GET /share/status` (auth) → current token or null.
   - `GET /share/:token` (**`@Public()`**) → the read-only payload below, 404 on unknown token.
3. **Payload shape** — assembled in the share service so the private DTOs cannot leak by
   accident:
   ```
   { displayName, countries: [{ isoCode, isoCode2, name, visitType }],
     routes: [{ from:{iata,lat,lon}, to:{iata,lat,lon}, count }],
     airports: [{ iataCode, latitude, longitude, city }],
     stats: { countriesVisited, transitCount, worldPercent, journeys, flights, distanceKm } }
   ```
   Rate-limited, since it is unauthenticated.

## Frontend

4. **Extract** `numericToAlpha3` → `components/TravelMap/isoCodes.ts`, and the `<Geographies>`
   block → `components/TravelMap/CountriesLayer.tsx` (interactive when given `onCountryClick`,
   read-only otherwise). `TravelMap` switches to both — no behaviour change.
5. **`features/share/`** — `shareApi` (enable/disable/status/public fetch) and a `ShareMenu`
   in the header with: copy link, toggle sharing, download PNG.
6. **`utils/exportMapImage.ts`** — serialise `.rsm-svg`, draw at 2× onto a canvas, composite
   a caption bar, `toBlob`, trigger download.
7. **`pages/SharedMapPage.tsx`** — public route `/s/:token`, outside `RequireAuth`. Read-only
   map, stat strip, and a call to action to create an account.
8. **OG image + tags** — generate `public/og-image.png` (1200×630) the same way the icons were
   generated, and add `og:*` / `twitter:*` to `index.html`.

## Verification

1. `GET /share/:token` unauthenticated returns 200 with no `notes` and no email anywhere.
2. Revoking makes the same URL 404.
3. `/s/:token` renders the map logged out, in a fresh browser context with no cookie.
4. PNG downloads, opens, and shows the map plus caption.
5. Authenticated pages unaffected; `tsc --noEmit` clean.
