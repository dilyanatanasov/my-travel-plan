# "Want to go" + anniversary memories — Plan

**Date:** 2026-08-13 · Decisions confirmed same day:
tap-cycle marking (user's design) with picker buttons kept · wishlist **private** (never on the public map; counts allowed) · **anniversary** memory emails, on by default with a settings toggle · **cool slate accent** color.
Research: `context/research/2026-08-13_engagement-motivators_research.md`.

## Part 1 — Want to go (built first)

### Semantics
New `visitType: 'wishlist'` on the existing visits table (varchar column — no migration). A wishlist entry is a dream, not a visit: excluded from countriesVisited, world %, milestones, and the **entire public map payload** (server-side filter, not a frontend courtesy). The share card may later show a bare count ("12 on the list") — no names.

### Interaction (user's tap-cycle design)
Tap on a country cycles: none → visited → transit → want to go → removed (with the existing undo toast). Desktop and mobile alike. Each middle step shows a brief toast naming the new state. **Home is excluded**: it can only be set/unset via the picker, and tapping a home country keeps the old remove-with-undo behavior — a mis-tap must never silently demote someone's home. The visit-type picker (country card/list) gains a "Want to go" option as the discoverable, direct path.

### Color
Desaturated slate-blue in both palettes (+hover/pressed+legend "Want to go"). Cool against the warm earth tones = clearly "not yet". Preserves the monotonic-lightness contract as a hue outlier — acceptable because wishlist is semantically an outlier (the one state that is not history).

### Touch points
Backend: visit DTO whitelist + public-map filter. Frontend: `VisitType` union, mapColors, CountriesLayer color fns, TravelMapPage cycle handler, picker UI, legend, milestones/overview exclusions.

## Part 2 — Anniversary memories (second unit)

- Migration: `users.memory_emails boolean NOT NULL DEFAULT true`.
- Daily sweep (setInterval pattern, same as guest-cleanup): find dated journeys whose journeyDate is exactly N years ago today, group per user; skip guests, unverified emails, and opted-out users.
- One email per user per day max: "One year ago today: SOF → NRT" (route label + years-ago; the user's own data to their own inbox — no privacy tension). Branded template; footer line "manage in Settings" + the settings toggle.
- Quiet by nature: no dated journeys on that date → no email.

## Out of scope
Wishlist on Where-next (later, natural fit), share-card wishlist count, monthly digests, Wrapped.
