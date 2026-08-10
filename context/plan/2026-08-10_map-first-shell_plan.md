# Plan: Map-First App Shell

Date: 2026-08-10
Research: `context/research/2026-08-10_map-first-shell_research.md`

Brief from the user: *"the best mobile view possible and the best experience for a client"*,
no hidden content behind scrolling, and stop the map stealing the scroll wheel.

## Decisions

| Decision | Chosen | Why not the alternative |
|---|---|---|
| Shell | Fixed `100dvh`, non-scrolling; only panels scroll | A scrolling document is the cause of both complaints |
| Mobile panel | **Half-height sheet, map live above it** | A confirm-then-dismiss modal breaks repeated toggling — people tap six countries in a row, and seeing each one fill in *while* the sheet is open is the whole reward |
| Mobile dismissal | Swipe down, tap the map, or the close button | A confirm button implies a commit step that does not exist; changes are already saved |
| Desktop | Icon rail + docked panel, map fills the rest | Panel-over-map wastes a large screen |
| Statistics | Full view that **replaces** the map | 1,400px of dashboard in a 400px rail is unusable |
| Wheel zoom | Keep plain wheel zoom, **delete the scrim** | In a fixed shell there is no page scroll to steal, so wheel zoom is correct. `filterZoomEvent` stays available if that changes |
| Zoom controls | Explicit +/− and reset buttons | Pinch is undiscoverable on touch and unreachable by keyboard |

## Layout

```
Desktop (>=1024px)                      Mobile
┌──────────────────────────────┐        ┌────────────────┐
│ header                       │        │ header         │
├──┬─────────────────┬─────────┤        ├────────────────┤
│▣ │                 │ Panel   │        │                │
│◇ │      MAP        │ (400px, │        │      MAP       │  live
│✈ │    (fills)      │ scrolls)│        │                │
│▤ │                 │         │        ├────────────────┤
├──┴─────────────────┴─────────┤        │ ═══ Countries  │  sheet ~58dvh
└──────────────────────────────┘        ├────────────────┤
                                        │ ▣  ◇  ✈  ▤     │  tab bar
                                        └────────────────┘
```

## Work

1. **`index.css`** — `html, body, #root { height: 100%; overflow: hidden; overscroll-behavior: none }`.
   Drop the `min-height: 100vh` assumptions.
2. **`Layout.tsx`** — becomes the shell: `h-[100dvh] flex flex-col overflow-hidden`, compact
   header, `<main className="flex-1 min-h-0">`.
3. **`useMapViewport`** — stop returning breakpoint-pinned dimensions. Measure the container
   with `ResizeObserver` and derive the viewBox and projection scale from it, so the map fills
   whatever space the shell gives it.
4. **`TravelMap.tsx`** — fill the container; delete the `isCoarsePointer` scrim and
   `isTouchActivated` state; add zoom +/− / reset overlay; keep `MapControlPanel` as a
   collapsible overlay pinned top-left of the canvas rather than a bar above it.
5. **New `components/AppShell/`**
   - `SectionRail.tsx` — desktop icon rail, active state, labels via tooltip/`aria-label`.
   - `MobileTabBar.tsx` — bottom bar, 4 targets at 44px+, safe-area padding.
   - `SectionPanel.tsx` — docked panel on desktop, bottom sheet on mobile. Sheet gets a grab
     handle, swipe-to-dismiss, `Escape`, and a backdrop that does **not** block the map.
6. **`TravelMapPage.tsx`** — becomes the shell host: owns the active section, renders map +
   panel, and swaps to the full Statistics view when that section is active.
7. **Statistics** — full-canvas scrolling view replacing the map, with a back affordance.

## Verification

1. At 390×844: no page scroll anywhere; map visible at all times; sheet opens over a live map;
   toggling a country in the sheet visibly updates the map behind it.
2. Wheel over the map no longer moves the page (there is no page scroll) and zoom buttons work.
3. All tap targets ≥44px, including the new tab bar.
4. Desktop 1440: rail + map + panel, map fills, Statistics replaces the map.
5. `100dvh` respected with the iOS URL bar — checked by simulating a short viewport.
6. `tsc --noEmit` clean.
