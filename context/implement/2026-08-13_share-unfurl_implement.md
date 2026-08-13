# Social share: intent buttons + per-token link previews — Implementation

**Date:** 2026-08-13 · **Branch:** `feat/share-unfurl` · **Plan:** `context/plan/2026-08-13_share-unfurl_plan.md`

## What was built

### Backend

- **Migration `1786400000000-AddShareCards.ts`** — `share_cards` table: `user_id` (PK, FK → users, ON DELETE CASCADE), `image` bytea, `width`, `height`, `updated_at`. One row per user, replaced in place.
- **`share/entities/share-card.entity.ts`** — entity with `userId` as `@PrimaryColumn`, so `repository.save()` is the upsert-replace.
- **`POST /share/card`** (authed, 20/min) — raw `image/png` body, not multipart. `express.raw({ type: 'image/png', limit: '1mb' })` is mounted in `main.ts` scoped to `/api/share/card` only, which is why **no multer dependency was added** (single fixed-format file; a raw Buffer is all that's needed). Validation in `ShareService.saveCard`: Buffer present, ≤ 1 MB (belt-and-braces beside the middleware's 413), PNG magic bytes, `IHDR` chunk marker, width/height parsed from the fixed IHDR offsets (16/20). Controller reads `@Req().body` deliberately, so the global ValidationPipe never sees the Buffer.
- **`GET /share/card/:token.png`** (`@Public`, 60/min like the public map) — token → user → card; the same "This map is not available" 404 for unknown token, revoked sharing, and no card. Streams the bytea with `Content-Type: image/png`, `Cache-Control: public, max-age=86400`, `ETag` derived from `updated_at`, 304 on `If-None-Match`, and `Cross-Origin-Resource-Policy: cross-origin` (helmet's global CORP is `same-site`; this image exists to be fetched by preview infrastructure).
- **`GET /share/unfurl/:token`** (`@Public`, 60/min) — minimal HTML: `og:title` "«displayName»'s travel map — N countries" ("My travel map…" when no display name; count = trip+home visits, same rule as `PublicMapDto`; never notes/dates), short tagline description, `og:image` absolute via the same DOMAIN→ConfigService pattern as `MailService.appUrl()`, `og:image:width/height` from the stored card, twitter card tags, `og:url` the `/s/` link, `<meta http-equiv="refresh">` to the real page for stray humans. Unknown/revoked token → **200 with the generic site tags** (`/og-image.png`, 1200×630) rather than an error page, since crawlers turn a 404 into no preview at all. `displayName` is HTML-escaped (it's user free text).

### nginx (both HTTPS templates: `nginx.conf.template`, `nginx.alt.conf.template`)

- `map $http_user_agent $is_crawler` at top of file — valid http-context placement because these templates render into `conf.d/`, which the stock `nginx.conf` includes inside `http{}` (checked `Dockerfile` + `10-select-nginx-template.sh`). Matches `facebookexternalhit|twitterbot|whatsapp|telegrambot|linkedinbot|slackbot|discordbot|pinterest|skypeuripreview`, case-insensitive. Only nginx runtime vars used, so `NGINX_ENVSUBST_FILTER=DOMAIN` leaves them intact.
- New `location /s/` before the SPA fallback: crawlers get `rewrite ^/s/(.*)$ /api/share/unfurl/$1 last;`, which re-enters location matching and lands in the existing `^~ /api` block — reusing its variable-upstream + `resolver 127.0.0.11` plumbing instead of duplicating it. (`if` + `rewrite … last` is one of the documented-safe `if` forms.) Humans keep the exact `try_files` SPA fallback.

### Frontend

- **`shareApi.ts`** — `uploadShareCard` mutation POSTing the Blob with `Content-Type: image/png` (fetchBaseQuery passes Blobs through untouched; no FormData).
- **`SharePanel.tsx`** —
  - After `renderShareCard` succeeds and sharing is enabled, the blob is uploaded fire-and-forget. The token is read through a ref so toggling sharing does not re-run the (expensive) render effect.
  - On `enable` success, the currently rendered card (if any) is uploaded immediately, so the link never goes out ahead of its preview.
  - Intent buttons (X / Facebook / WhatsApp) appear under the copy-link row when a link exists, `window.open` with `noopener,noreferrer`, using exactly the plan's intent URLs. Instagram deliberately absent (no web intent; the native share sheet covers it).

## Verification

- `backend`: `npm run build` ✓, `npm run lint` ✓ (clean).
- `frontend`: `npm run build` ✓, `npm run lint` ✓ (8 pre-existing warnings, all in files this branch does not touch: ToastProvider, CountriesLayer, TravelMap, MapFocusContext, ThemeContext).
- **Migration**: dev stack was up. The dev backend container bind-mounts the *main* checkout, so running inside it would not have seen this branch's migration; instead `npm run migration:run` was run from the worktree against the published dev DB port (same DB). `AddShareCards1786400000000` executed and recorded; `\d share_cards` confirms PK, FK CASCADE, NOT NULLs, default `now()`.
- **Endpoint smoke test** (beyond the plan's requirements): the built worktree backend was started locally on port 3999 against the dev DB with a throwaway user (`display_name = "Smoke <Tester>"`). All passed: non-PNG rejected 400 · PNG upload 201 · card streams back byte-identical with ETag/cache headers · `If-None-Match` → 304 · unknown token → 404 · unfurl emits the per-user tags with the `?v=` image URL and escapes the display name · unknown-token unfurl serves generic tags with 200 · unauthenticated upload → 401. Test user deleted afterwards; the CASCADE removed its card (verified count 0).
- express 5.2.1 confirmed to route `card/:token.png` with the param excluding the suffix (tested directly, since Nest 11 ships Express 5 / path-to-regexp 8).
- nginx templates not run through `nginx -t` (needs certs and the container envsubst step); the map/location additions follow the existing template idioms and the http-context placement was verified against the entrypoint. Left for review/deploy-time check.

## Deviations from the plan

1. **`?v=<updatedAt>` appended to the unfurl's og:image URL.** The card URL is stable (one per user, replaced in place) and the image response is cached long-lived; without a cache-buster, crawlers that already fetched the image would keep showing the pre-regenerate card indefinitely. The plan's ETag only helps clients that revalidate; the query param makes a regenerated card a new URL for crawler caches. Additive, no API change.
2. **Invalid-token unfurl returns HTTP 200**, reading the plan's "404 → serve generic tags, not an error page" as "the case that would have been a 404". Most crawlers refuse to render tags from a 4xx response.
3. **Upload is not gated on sharing being enabled.** The plan doesn't ask for a server-side gate; a stored card is unreachable while sharing is off (lookup is token-first), and gating would add a race with the enable→upload flow. The frontend only uploads while a token exists.

## Left for review

- nginx `-t` validation of the rendered templates (see above) — worth a config check on the next deploy dry-run.
- The crawler UA list is the plan's list verbatim; new crawlers (e.g. Bluesky's) can be appended to the `map` in both templates later.
- `Cache-Control: public, max-age=300` on the unfurl HTML — chosen so a regenerate propagates quickly; tune if crawler traffic ever matters.
