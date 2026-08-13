# Engagement & motivators — product research

**Date:** 2026-08-13, launch day. Question: how does a travel log avoid being a 3-visits-a-year utility? Constraint: no engagement tricks that betray the product's privacy-first, personal character (no streaks, no noise notifications, no social feed).

## Framing

Travel logging is episodic by nature. The strategy is not to fight that but to (a) **create more episodes** — capture more kinds of travel — and (b) **own the between-trip moments**: planning and remembering, where most of travel's emotional value lives.

## Levers, ranked by fit × effort

1. **Multimodal journeys** (researched: `2026-08-13_multimodal-journeys_research.md`). Flights are 3×/year; trips in general are 10–20×/year in Europe. The single biggest capture-frequency lever; reframes the app from flight log to life trail.
2. **"Want to go" map state.** Third visit-type painted on the map: *someday*. Dreaming happens on random Tuesdays; feeds Where-next, gives the share card a second story ("31 visited · 42 to go"). Cheapest lever here.
3. **Price-watching on the wishlist** (extends the search-v2 plan). "Watch this destination" → weekly email when Sofia→X drops. The app writes to you between trips about something you explicitly asked for. Rides the live Resend infra.
4. **Memories + annual Wrapped.** "One year ago you landed in Tokyo" anniversary emails; year-end "Your 2026 trail" (replay + share card as ritual). Dates + email + replay all exist.
5. **Milestone celebrations.** `useMilestones` exists in code; extend to celebrate thresholds (25 countries, continent complete) and offer the share card at the moment of pride.

Deliberately NOT: social following/feeds — changes the privacy soul for uncertain gain; share links already do the social work.

## Motivator stats: the honesty ladder (user's ask: "more of Europe than 70% of users")

Percentiles need a population; the ladder starts without one.

**Rung 1 — fixed baselines, buildable at N=1 (recommended to build first):**
- Completion: "40% of Europe · 3 from completing the Balkans" (continent mapping derivable from countries table — also needed by multimodal/continent stats; one data task serves both).
- External constants: "most people visit <10 countries in a lifetime — you're at 25" (hand-curated, sourced once).
- Personal records: busiest year, longest new-country streak, most continents in a year — comparisons against yourself; privacy-perfect.
- Physical framings: exists (Earth circumferences); extend family (% to the Moon).

**Rung 2 — cohort percentiles, design now / enable later:**
- Nightly SQL job aggregates histograms (countries visited, per continent) into one aggregates table. Pure aggregates; no individual rows leave; consistent with the analytics privacy rule.
- **Display gate:** percentile lines render only when cohort ≥ ~100 users; below that the UI shows rung-1 framings. "Top 70% of 9 users" reads as exactly what it is.

All motivator output should flow into the three existing surfaces: stats panel, milestones, share card (and later the Wrapped email) — not new UI.

## Open decisions (for a future plan phase)

- D1: Continent dataset — add `continent` to the countries table (small migration + seed) vs frontend constant map. (Table recommended: share unfurl and future SQL stats want it server-side.)
- D2: Which lever ships first — "want to go" state (recommended: smallest, feeds most) vs milestones extension.
- D3: External baseline constants — which claims, and sources for them.

## Dream-tier (queued 2026-08-13): globe mode

A toggle rendering the same map as a d3 orthographic globe. Feasible in the
existing stack (react-simple-maps accepts any d3 projection; countries/
markers reproject free). Real work: drag-rotation instead of panning,
great-circle routes via geoPath (horizon clipping free), camera = rotate
globe to face target, horizon checks for plane/pops. Search-v1-sized;
prototype the rotation feel first. The replay is its killer feature.
