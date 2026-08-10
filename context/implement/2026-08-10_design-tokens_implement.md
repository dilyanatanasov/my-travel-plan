# Implementation: Design Tokens & Palette

Date: 2026-08-10
Plan: `context/plan/2026-08-10_design-tokens_plan.md`
Branch: `feat/user-accounts-auth`
Status: **Complete and verified**

## What shipped

| File | Change |
|---|---|
| `src/styles/tokens.css` | **New.** All tokens as CSS custom properties (bare RGB triplets so Tailwind alpha utilities work). Includes a `.dark` block as groundwork. |
| `tailwind.config.js` | **Was `theme: { extend: {} }`.** Now a real colour system: `brand`, `canvas`, `surface`, `line`, `ink`, `map`, `danger`. `darkMode: 'class'`. |
| `src/theme/mapColors.ts` | **New.** JS source of truth for map colours, since react-simple-maps takes strings not classes. |
| `components/TravelMap/countryColors.ts` | Consumes the tokens instead of hardcoded hexes. |
| `components/TravelMap/TravelMap.tsx` | Explicit ocean rect; land/border colours from tokens. |
| `components/FlightMap/AirportMarkers.tsx` | Red dots → white fill + dark ring. |
| `components/FlightMap/FlightRoutes.tsx` | Route colour from tokens. |
| 16 core components/pages | `blue-*` → `brand-*` (teal) for UI chrome. |
| `pages/TravelMapPage.tsx` | Overview cards now carry their map-semantic colours. |
| `components/CountryList/CountryList.tsx` | Visit-type badges match the map; "Flight" badge uses the route colour. |
| `src/index.css`, `src/main.tsx` | Body background from the canvas token; tokens imported ahead of Tailwind. |

## The resulting system

**One accent, one meaning per hue.**
- **Teal** = the app talking (actions, active states, focus). Never appears on the map.
- **Blue** = flight routes. Only that. Previously blue meant five unrelated things.
- **Violet / emerald / amber** = home / visited / transit, on the map *and* on any badge or
  stat card describing those categories, so the UI teaches its own legend.

**Map semantics are a lightness ramp, not just hues:**
home `#6d28d9` → visited `#059669` → transit `#fbbf24` → land `#cbd5e1` → ocean `#eef4f8`.

## Verification

| Check | Result |
|---|---|
| Greyscale render | Home / visited / transit remain clearly distinct; visited countries read darker than unvisited land; airports pop. Passing greyscale means passing every colour vision deficiency, which is why this test was used rather than simulating each type. |
| Airports over visited countries | White fill + dark ring — the red-on-green failure is gone entirely. |
| Land vs ocean vs page | Three distinct values; the map now has ground under it. |
| Button label contrast | **5.47:1** (AA pass) |
| Heading on surface | 17.74:1 |
| `ink-muted` on surface | 7.56:1 |
| `tsc --noEmit` | Clean |
| Layout | Unchanged — this pass touched colour only |

## Deviations from the plan

1. **Stat cards use map semantics, not one flat accent.** The plan said "one accent +
   neutrals". On implementation that was wrong: three of the four cards *are* map
   categories ("Countries visited", "Transit countries", "Home country"), so giving them
   the map's colours makes the card explain the legend. The accent is used only for the
   card that is not a map category ("% of the world"). Same underlying rule — hue is
   reserved for map semantics — applied more precisely.
2. **`brand-600` had to be darkened.** Teal-600 `#0d9488` measured **3.74:1** against white
   text, failing AA. Rather than change every call site, the ramp was shifted a step darker
   from 600 down, so `bg-brand-600` still names the filled-button colour and now measures
   5.47:1.

## Problems hit

1. **`@import './styles/tokens.css'` inside `index.css` silently did nothing.**
   `postcss-import` is not in the pipeline, so the variables never landed and every
   token-based utility computed to `transparent` — the primary button vanished. Fixed by
   importing `tokens.css` from `main.tsx` ahead of `index.css`.
2. **Tailwind does not pick up `tailwind.config.js` changes over the bind mount.** Even with
   the polling watcher added in item 2 (which covers source files), the config itself needed
   a container restart before the new utilities were generated. Worth knowing: if a new
   colour class appears to do nothing, restart before debugging the CSS.
3. **A JSX comment broke the build.** `{/* … */}` placed as a sibling inside
   `{cond && ( … )}` is two children with no parent. Moved above the conditional.

## Follow-ups

- **Dark mode is groundwork only.** Variables and `darkMode: 'class'` are in place, and no
  component hardcodes a colour any more, so enabling it is now a contained change: add a
  toggle, fill in the `.dark` block, and sweep the remaining `gray-*` utilities to `ink`/
  `surface`/`line` tokens.
- The `features/flightSearch/` internals still use raw `blue-*`. Left deliberately: roadmap
  item 7 decides whether that feature survives, and recolouring code that may be deleted is
  waste.
