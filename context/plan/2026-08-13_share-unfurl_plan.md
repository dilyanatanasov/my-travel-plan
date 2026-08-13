# Social share: intent buttons + per-token link previews — Plan

**Date:** 2026-08-13 · **Decisions confirmed by user:** UA-split in nginx · single stored card per user, replaced on regenerate, in Postgres bytea · preview shows name + counts + card image.
Implemented on branch `feat/share-unfurl` by a background agent; review + deploy happen from the main session.

## Problem

`/s/<token>` links unfurl with the generic site OG image. The goal: X/FB/WhatsApp/iMessage previews showing *that user's* map card. Plus cheap share-intent buttons.

## 1. Cheap tier — intent buttons (frontend only)

In `SharePanel`'s Public-link section, when a link exists: three small buttons —
X (`https://twitter.com/intent/tweet?url=<u>&text=<t>`), Facebook (`https://www.facebook.com/sharer/sharer.php?u=<u>`), WhatsApp (`https://wa.me/?text=<t>%20<u>`). `window.open`, `noopener`. Instagram deliberately absent: no web intent exists; the native-sheet image share already covers it.

## 2. Real tier — per-token OG

### Storage
New table `share_cards`: `user_id` (PK, FK cascade), `image` bytea, `width`, `height`, `updated_at`. One row per user, upsert-replace on write (user decision: no history). ~300 KB/card; existing pg_dump backups carry it.

### Backend (share module)
- `POST /share/card` (authed, throttled): accepts the rendered PNG (multipart or raw body, limit 1 MB, verify PNG magic bytes), upserts `share_cards`. Called by the frontend right after it renders a card while sharing is enabled, and on enable if a card exists.
- `GET /share/card/:token.png` (@Public, throttled like the public map): looks up the user by shareToken, streams the bytea with `Content-Type: image/png`, long-lived cache headers plus `ETag` on `updated_at`. 404 when sharing off or no card — sharing off must kill the preview image too.
- `GET /share/unfurl/:token` (@Public, throttled): minimal HTML for crawlers — `og:title` "«displayName or 'My'»'s travel map — N countries" (counts derived same as `PublicMapDto`; never notes/dates — privacy rule), `og:description` short tagline, `og:image` absolute `https://<DOMAIN>/api/share/card/<token>.png` falling back to site-wide og-image when no card, `og:url` the /s/ link, plus `<meta http-equiv="refresh">` to the real page for stray humans. 404 → serve generic tags, not an error page.

### nginx (both HTTPS templates)
`map $http_user_agent $is_crawler` matching facebookexternalhit|Twitterbot|WhatsApp|TelegramBot|LinkedInBot|Slackbot|Discordbot|Pinterest|SkypeUriPreview (case-insensitive); in `location /s/` (new, before SPA fallback): crawlers proxy to `backend:3000/share/unfurl/…` (same variable-upstream + resolver pattern as `/api`), humans get the SPA `try_files` as today. Keep the `NGINX_ENVSUBST_FILTER=DOMAIN` constraint in mind: nginx runtime vars like `$http_user_agent` are safe (filter only substitutes DOMAIN-ish names).

### Frontend
After `renderShareCard` succeeds and sharing is enabled → fire-and-forget upload via new `shareApi` mutation. On `enable` success, upload the current card if one is rendered. No UI beyond the intent buttons.

## Constraints for the implementing agent

- Branch `feat/share-unfurl` from main; commit there; push the branch; **never touch main, never deploy, never run against the production droplet**.
- Verify: backend `npm run build` + `lint`, frontend `npm run build` + `lint`, migration runs against the dev DB only if the dev stack is up (skip otherwise and say so).
- Follow existing idioms: raw-SQL migrations with docblocks, `@Public()`/`@Throttle` decorators, variable-upstream nginx pattern, RTK Query slice injection, comment style (constraints, not narration).
- Write `context/implement/2026-08-13_share-unfurl_implement.md` documenting what was built and any deviations.
