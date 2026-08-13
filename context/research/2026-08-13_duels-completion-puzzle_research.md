# Duels, completion, daily puzzle — Research

**Date:** 2026-08-13 (late). User greenlit all three retention mechanics; the open question is the social model behind duels: friends system, public profiles, or limited 1v1.

## 1. The social model (the decision that matters)

Three architectures, judged against the product's soul (private by default, share by choice), cold-start reality (a handful of users), and build cost:

### A. Tokened 1v1 (no social graph at all)
A duel is `/duel/<tokenA>/<tokenB>` — two existing public-map share tokens compared. No accounts are linked, no requests, no graph tables; consent is inherent (both people already chose to make their maps public-by-link; a duel is just viewing two of them together). Works with ZERO new users and with the one friend who tested today. Virality is built in: to duel back, the friend needs an account + sharing on — the exact conversion funnel that matters. Cost: one page + one comparison endpoint reusing the public-map DTO.

### B. Friends system (mutual connections)
Persistent friend graph: requests, accept/decline, a friends list, "your friends' maps" surface, notifications when a friend passes you. Stronger habitual pull (rivalry that *persists* and pings you) — but: a full privacy surface (who can request? blocking? what do friends see vs the public map?), migrations + UI for the graph, and it is worth nothing at N≈5 users. Also quietly transforms the product's character from private tool to mini social network — a one-way door.

### C. Public profiles (discoverable)
Directory/usernames/discoverability. Maximum comparison fuel, maximum departure from "private map of your life". Wrong for this product now; possibly forever.

**Recommendation: A now, B later behind a gate, C parked.** Ship tokened 1v1; add a lightweight "saved duels" list (store opponent tokens on the account — a bookmark, not a relationship: no consent machinery needed since tokens are already shared-by-choice, and revoking your token still kills every duel). Revisit a real friends graph only when analytics show repeat duel usage and the user base can feed it.

### Duel design notes
- Reuses `getPublicMap` per token; a `/api/share/duel/:a/:b` endpoint (or two client-side fetches — endpoint preferred: one throttle point, one place to enforce token validity).
- Scoreboard: countries visited (trip+home, same rule everywhere), continents %, km flown, plus the two lists that fuel rivalry: "only you have" / "only they have". NO notes, dates, or wishlist — public-map privacy rules apply verbatim (wishlist is private by earlier decision).
- The map: both sets painted, overlap in a blend/third treatment.
- OG unfurl for duel links (the crawler split already exists): "31 – 24" as the preview. Instantly shareable trash talk.
- Guests can VIEW duels (public data); creating one requires sharing enabled (verified account — the existing gate).

## 2. Completion mechanics

- Needs `continent` on countries (motivators research D1 — server-side column wins: share unfurl, duels, and SQL stats all want it). One migration + seed from a static ISO→continent table (~250 rows, well-known data).
- Surfaces (no new UI concepts): Overview stats ("Europe 40% · 18/44"), milestone toasts on completions ("The Balkans: complete ✓" — the milestones hook exists), share card fact slot, duel scoreboard.
- Optional curated sub-regions later (Balkans, Scandinavia, Southeast Asia) as a constant list — the addictive granularity ("2 from finishing the Balkans") without a data project.

## 3. Daily puzzle ("which country is this?")

- The shapes are already client-side: the same TopoJSON the map renders. A silhouette page costs no new data.
- Mechanic (Worldle-proven): show a silhouette; free-text guess with autocomplete from the countries list; per wrong guess reveal distance + compass direction from guess to answer; 6 guesses. Daily country = deterministic hash of the UTC date over a curated list (exclude micro-states early on).
- Anonymous-friendly — no account needed — which makes it TOP of funnel, not just retention: the puzzle page can be the most-linkable thing on the site. CTA after solving: "Been there? Put it on your map."
- Shareable result: emoji grid (🟩🟥 + distance arrows), copy button. Streak counter stored locally (localStorage) — streaks fit a daily puzzle even though they don't fit travel logging.
- Route `/daily`, linked from the header or Where-next. Server involvement: none for v1 (fully client-side, same-for-everyone daily seed).

## 4. Sequencing & conflicts

Globe agent (in flight) owns TravelMap/CountriesLayer/JourneyHighlight/MapControlPanel — none of these three features touch those files if the duel map view is built on the SharedMapPage pattern (its own read-only map) and the puzzle renders its own silhouette component. Order: **duels → completion → puzzle** (duels smallest-to-value; completion piggybacks the continent migration; puzzle is standalone whenever).

## Open decisions

- D1 Social model: tokened 1v1 + saved-duels bookmarks (recommended) vs friends graph now.
- D2 Puzzle guessing: autocomplete + distance/direction hints (recommended) vs multiple-choice (easier, less addictive).
- D3 Completion granularity: continents only first (recommended) vs continents + curated regions from day one.
- D4 Duel OG unfurls in v1 (recommended — the crawler pipeline exists) vs later.
