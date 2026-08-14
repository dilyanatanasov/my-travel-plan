# Trip photos (postcards) — plan (confirmed 2026-08-14)

**Decisions (user-confirmed):** photos attach **per stop** (a journey's leg
arrivals); **one photo per stop**, re-upload replaces — that is the only
cap (~200 images ≈ 60MB for a heavy account; the compression pipeline is
the real limit, per the ia-fitness precedent the user pointed at). Storage:
**local droplet folder + sharp compression, the ia-fitness pattern**, on a
named docker volume. Prerequisite DONE: 1GB swapfile live on the droplet
(processing RAM spikes now degrade instead of OOM-killing).

**Security (per standing rule):** uploads behind auth + ownership; magic-byte
validation; multer 10MB raw cap; sharp resize ~1600px jpeg q80 (~300KB),
EXIF (incl. GPS) stripped via rotate-then-default-strip; **serving through an
authenticated ownership-checked endpoint, NOT public /uploads** (deliberate
divergence from ia-fitness); photos never appear on shared maps, cards,
unfurls or duels in v1; app-level processing queue, concurrency 1.

## Backend

1. Port `ImageProcessingService` from ia-fitness (magic bytes, sharp,
   tmp-rename, cleanup) into `common/services/`.
2. Migration `leg_photos`: id, `leg_id` FK CASCADE UNIQUE (one per stop),
   `user_id` FK CASCADE, filename, created_at. Files under
   `uploads/leg-photos/`, volume `uploads_data:/app/uploads` in prod
   compose; deploy workflow untouched (volume persists).
3. Endpoints on flights controller: `POST /flights/legs/:legId/photo`
   (multer, ownership via leg→journey.userId, replaces existing),
   `GET /flights/legs/:legId/photo` (authed stream, 404-not-403),
   `DELETE /flights/legs/:legId/photo`. Specs on the ownership gate and
   the replace semantics.
4. Backup cron gains a weekly uploads tar (same retention).

## Frontend

1. `legPhotosApi` endpoints + a `StopPhoto` upload control in the flight
   card's edit mode (per stop row: add/replace/remove, using ui primitives).
2. Replay postcards: when the plane lands at a stop with a photo, a
   postcard (rotated polaroid frame) pops beside the airport pill for the
   pause duration; photo fetched lazily (authed URL via fetch→objectURL),
   preloaded one stop ahead. Flat map first; globe follows if cheap.
3. Photos visible in the country/journey detail surfaces later — v1 is
   upload + replay postcards.

## Out of scope

Sharing photos anywhere, multiple photos per stop, galleries, EXIF-derived
anything.
