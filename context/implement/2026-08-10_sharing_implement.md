# Implementation: Sharing

Date: 2026-08-10
Plan: `context/plan/2026-08-10_sharing_plan.md`
Branch: `feat/user-accounts-auth`
Status: **Complete and verified**

## What shipped

### Backend
| File | Change |
|---|---|
| `migrations/1786100000000-AddShareToken.ts` | `users.share_token varchar(24) NULL UNIQUE` |
| `modules/users/entities/user.entity.ts` | `shareToken` column |
| `modules/share/dto/public-map.dto.ts` | **New.** Hand-written public shape — never an entity |
| `modules/share/share.service.ts` | **New.** Token generate/clear, and the public payload assembled from visits + journeys |
| `modules/share/share.controller.ts` | **New.** `GET status`, `POST enable`, `DELETE`, and `@Public() GET :token` (rate limited 60/min) |
| `app.module.ts` | Registers `ShareModule` |
| `nest-cli.json` | Polling watch options — see problems below |

### Frontend
| File | Change |
|---|---|
| `components/TravelMap/isoCodes.ts` | **Extracted** the 250-line ISO numeric→alpha-3 table |
| `components/TravelMap/CountriesLayer.tsx` | **Extracted** the geography layer; read-only when given no `onCountryClick` |
| `components/TravelMap/TravelMap.tsx` | Uses both; 342 → 271 lines, no behaviour change |
| `utils/exportMapImage.ts` | **New.** SVG → canvas → PNG with a composited caption bar |
| `features/share/shareApi.ts`, `ShareMenu.tsx` | **New.** Header menu: download image, create/copy/revoke link |
| `pages/SharedMapPage.tsx` | **New.** Public `/s/:token` route |
| `App.tsx` | `/s/:token` registered outside `RequireAuth` |
| `theme/mapColors.ts` | `COUNTRY_LEGEND` shared by both maps |
| `index.html`, `public/og-image.png` | OG + Twitter tags and a 1200×630 image |

## Verification

**Privacy of the public payload** — fetched with no cookie and grepped:

| Field | Result |
|---|---|
| `notes` | absent |
| `@` (any email) | absent |
| `visitedAt` / `journeyDate` | absent |
| `user_id` | absent |
| `createdAt` | absent |

Top-level keys are exactly `displayName, countries, airports, routes, stats`. Payload for the
real account: 25 countries, 39 airports, 49 routes, 141,877 km.

**Access control**
- `GET /api/share/:token` with **no credentials** → 200; `GET /api/visits` with no credentials
  → 401, in the same browser context. The public page depends on nothing authenticated.
- Revoke → the same URL returns 404 immediately.
- Unknown token → 404, identical response to a revoked one.
- Re-enabling after a revoke issues a **new** token, so old links stay dead.
- `POST /share/enable` is idempotent — repeated calls return the same token rather than
  rotating it and silently breaking links the user already sent.

**PNG export** — exercised through the real code path, not mocked: `image/png`,
2496×1512, 446 KB, with the map and a dark caption bar reading "Dilyan's travel map /
25 countries · 117 flights · 141,877 km". Inspected visually.

**Map colours** — fill histogram on the live SVG: 1 × `#6d28d9` (home), 22 × `#059669`
(visited), 154 × `#cbd5e1` (land). Confirms home renders distinctly.

`tsc --noEmit` clean on both sides.

## Problems hit

1. **The backend had the same stale-watcher problem as Vite.** New `ShareModule` routes
   404'd because `nest start --watch` never saw the files across the Windows bind mount.
   Fixed at the source with polling `watchOptions` in `nest-cli.json`, mirroring the
   `usePolling` fix made for Vite in item 2. Both dev servers now pick up host edits.
2. **`AggregatedRoute` requires `totalDistance` and `flights`.** Rather than cast through
   `unknown`, `distanceKm` was added to the public route payload (it is not private and the
   shared map can use it). `flights` stays `[]` — it only feeds the hover tooltip, which the
   read-only map does not render, and the journeys behind it *are* private.

## State left behind

Sharing was enabled during testing and has been **turned back off**; the token is cleared and
the test links 404. Sharing is opt-in and the account is back to its default.

## Follow-ups

- **Per-link OG tags need a server.** Crawlers do not run JS, so every shared link currently
  previews with the same generic card. The fix is for the API to serve the HTML for
  `/s/:token` with injected `og:title` / `og:image` ("Dilyan has been to 25 countries"),
  or to prerender. That is the difference between a link that spreads and one that does not,
  so it is the highest-value follow-up here.
- **Two visited countries do not render.** 25 visits produce 23 filled shapes because
  `countries-110m` omits micro-states — exactly the "Malta, Vatican" case the original UI
  called out. Switching to `countries-50m` would cover them at the cost of a larger download.
- **Open Graph image is static.** A generated per-user image (map + stats) would be a
  stronger share card, and the `renderMapPng` code is most of what that needs server-side.
