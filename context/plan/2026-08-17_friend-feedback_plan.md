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

## Deferred — decide/schedule separately

5. **"Lived" visit type** — 5th `visitType` for countries you lived in;
   same shape as the want-to-go addition (enum + tap-cycle + map color +
   picker). Small migration-free backend change + map/legend work.
6. **Right-click categorize on desktop** — mirror mobile long-press via
   `contextmenu` in `useCountryInteraction`. Small, contained.
7. **Map onboarding tooltip** — one-time hint about tap / long-press /
   legend affordances. Needs a light design pass (when to show, how to
   dismiss, localStorage flag).
8. **OG map snapshot in share unfurls** — per-token OG previews already
   exist (2026-08-13); the ask is a rendered map image (or "Georgi has
   visited 16 countries" text) as og:image. Verify what today's unfurl
   actually shows before scoping.
9. **Mobile add/edit popups render poorly** — no repro yet; need a
   screenshot + device from the friend before touching anything.

## Verification (quick wins)
Backend jest 100/100 (3 new ranking specs), frontend vitest 98/98,
tsc/lint/build clean both sides.
