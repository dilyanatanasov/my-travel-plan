# Friend feedback — 2026-08-17

Source: first outside user-test (the user's friend, in Bulgarian; owner
clarified two items in session). Overall verdict: "very pleasant app,
clear potential"; loved the map interactivity, Daily Country, and Duels
("perfect for competitive spirits"); mobile long-press categorization
praised.

## Quick wins — SHIPPED this pass

1. **Daily "in 6 what?"** → header now says "guess the country in 6
   tries"; a caption above the guess list explains the color language:
   "More green squares = a closer guess · the km and arrow point toward
   the answer". (`DailyPage.tsx`)
2. **Home country "Not set" was a dead end** (owner clarification: friend
   wanted to set it from the Overview) → the tile is now a link to
   Settings with "set it →" copy when unset. (`OverviewPanel.tsx`)
3. **Future-dated flights counted in all stats** → future journeys are
   plans: excluded from `getSummary`, `getStats` and the frontend
   personal records; still visible in the list and the Overview's
   "next flight" card. Copy at the top of the Flights panel says the rule
   out loud. (`flights-stats.service.ts`, `records.ts`, `TravelMapPage`)
4. **Airport dropdown ordered minors-first on country searches** →
   ranking heuristic in `AirportsService.search` (exact IATA → city-name
   match → known hubs → "International" in name → alphabetical), spec'd.
   Honest limitation: no traffic data in the table, so it's a heuristic,
   not passenger-volume ordering.

## Second pass — SHIPPED

5. **"Lived" visit type** — DONE (deployed): plum in all palettes +
   legend, picker-only like Home, counts as visited everywhere history
   counts (overview, milestones, continent bars, shares, duels, public
   map). Bonus fix: continent bars no longer count want-to-go as
   progress.
6. **Right-click categorize on desktop** — DONE (deployed): contextmenu
   on the countries layer mirrors long-press, flat map and globe.
7. **Map onboarding hint** — DONE: one-time dismissible card ("Tap a
   country… Hold or right-click for details"), localStorage-gated, armed
   only after the visits query settles (loading must not read as the
   first tap), auto-retires on the first real interaction, suppressed
   while a country card is open, positioned above the legend on phones.
9. **Mobile add/edit popups** — investigated at 390px (Chromium):
   Countries panel, add-country dropdown, type selects, and the flight
   form all render cleanly; the one real collision found (the new hint
   covering the country card's controls) is fixed. If the friend's
   glitch persists, it is device-specific — still want their screenshot
   + phone model. Captures in `2026-08-17_friend-feedback_assets/`.

## Still open

8. **OG map snapshot in share unfurls** — needs the user's share link to
   check what crawlers currently see before scoping any work.

## Verification (quick wins)
Backend jest 100/100 (3 new ranking specs), frontend vitest 98/98,
tsc/lint/build clean both sides.
