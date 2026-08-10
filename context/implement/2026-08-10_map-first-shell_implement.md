# Implementation: Map-First App Shell

Date: 2026-08-10
Plan: `context/plan/2026-08-10_map-first-shell_plan.md`
Branch: `feat/user-accounts-auth`
Status: **Complete and verified**

## The two reported problems, and what fixed them

**"Hidden parts you have to scroll to see."** The app is now a fixed `100dvh` shell that never
scrolls as a page. The map is a persistent canvas; sections open beside it (desktop) or over
it (mobile). Nothing lives below a fold.

**"The map zooms when my cursor is on top and I scroll."** Fixed at the root rather than
patched. Wheel-over-map only *steals* scrolling if there is page scroll to steal — in a fixed
shell there is none, so zoom-on-wheel is simply correct. This also let the
`isCoarsePointer` tap-to-activate scrim from item 2 be **deleted** instead of joined by a
second workaround for mouse users.

## What shipped

| File | Change |
|---|---|
| `components/AppShell/sections.tsx` | **New.** Section definitions; `fullView` marks Statistics |
| `components/AppShell/SectionRail.tsx` | **New.** Desktop icon rail with hover labels |
| `components/AppShell/MobileTabBar.tsx` | **New.** Bottom tab bar, safe-area aware |
| `components/AppShell/SectionPanel.tsx` | **New.** `variant="sheet"` (mobile, over the map) or `"dock"` (desktop, beside it) |
| `components/AppShell/MapPeekBar.tsx` | **New.** Headline stats pinned to the canvas floor on mobile |
| `components/TravelMap/MapZoomControls.tsx` | **New.** Explicit +/−/reset |
| `components/TravelMap/MapLegend.tsx` | **New.** Legend moved to the bottom-left map corner |
| `components/TravelMap/useMapViewport.ts` | Rewritten: `ResizeObserver` measurement, cover-not-fit scaling |
| `components/TravelMap/TravelMap.tsx` | Fills the canvas; controlled zoom/center; scrim deleted; chrome floats |
| `components/TravelMap/MapControlPanel.tsx` | Floating card, collapsed by default, legend removed, filters regrouped |
| `pages/TravelMapPage.tsx` | Rewritten as the shell host |
| `components/Layout/Layout.tsx` | Fixed `100dvh` flex column, compact header |
| `components/CountryList/CountryList.tsx` | Card chrome and inner scroller removed; 44px row controls |
| `components/CountrySelector/CountrySelector.tsx` | Search input to 44px |
| `index.css` | Fixed shell; `.scroll-page` opt-in for real documents |
| `AuthLayout`, `RequireAuth`, `SharedMapPage`, `FlightSearchPage` | Opt into `.scroll-page` |

## Adjustments made from live feedback during the build

1. **Filters were cramped.** The panel became a floating ~30rem card, so the old five-across
   filter row left each select about 75px. Split into two grids: the two airport selects
   two-up, the three short selects three-up.
2. **Toggle labels were cramped.** "Show on map" shared a two-column grid with Home country,
   giving labels ~76px. Now full width, `inline-flex` so each sizes to its own text.
3. **Legend moved to the bottom-left corner**, out of the control panel. It is reference
   material, not a control, and it no longer costs vertical space.
4. **Landmass overlapped the top-left controls.** Initial centre shifted to `[-12, 0]`, plus
   the control panel now starts collapsed — the latter is what actually removes the overlap,
   without cropping anything.
5. **Empty space left and right at default zoom.** A real bug in the scale formula: it took
   the *smaller* of the width- and height-derived scales, so on a short wide window height
   decided and left hundreds of pixels of ocean down each side. Now scales to **cover**,
   filling the width and cropping top and bottom — where the first thing lost is the Arctic
   and Antarctica. A horizontal overflow cap (1.35×) keeps the same formula sane in portrait,
   where covering outright would throw away a third of the world's longitudes.

## Verification (390×844 unless noted)

| Check | Result |
|---|---|
| Page scrolls | **No** — `scrollHeight === clientHeight`, both axes |
| Map visible with sheet open | **307px** of map above the sheet, and it updates live behind it |
| Nested scrollbars in the sheet | **0** (was 1: `CountryList` had its own `max-h-[400px]`) |
| Interactive elements under 44px | **0** |
| Wide window (1600×800) | Map fills edge to edge, no side gaps |
| Statistics | Replaces the map as a full scrolling view, with "Back to map" |
| `tsc --noEmit` | Clean |

## Notes

- `100dvh`, not `100vh` — iOS Safari's URL bar makes `100vh` taller than the visible viewport,
  which would push the bottom tab bar off screen.
- `overscroll-behavior: none` stops pull-to-refresh and rubber-banding on a shell that cannot
  scroll.
- Selecting the active section again closes it, on both the rail and the tab bar, so the map
  can be cleared without hunting for a close control.
- The mobile sheet is deliberately **not** modal and has no confirm step: toggling countries is
  repeated and exploratory, and watching each one fill in on the live map behind the sheet is
  the point.

## Follow-ups

- Portrait still has vertical ocean above and below the map. Unavoidable while showing every
  longitude on a 2:1 world in a tall box; the peek bar reclaims part of it.
- `filterZoomEvent` is available (and its `@types` signature is wrong — it receives the d3
  event, not an element) if plain-wheel zoom ever needs a modifier again.
- The desktop rail is icon-only with hover labels; an expanded-label variant would be kinder
  to first-time users.
