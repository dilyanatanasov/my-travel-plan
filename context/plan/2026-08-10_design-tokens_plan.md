# Plan: Design Tokens & Palette

Date: 2026-08-10
Research: `context/research/2026-08-10_design-tokens_research.md`

## Decisions (made autonomously; user approved the roadmap and is away)

| Decision | Chosen | Why not the alternative |
|---|---|---|
| Accent hue | **Teal** for UI actions | Keeps blue free to mean exactly one thing on the map (flight routes). Reusing blue for both is the current confusion. |
| Map semantics | Separated by **lightness as well as hue** | Hue-only fails for ~8% of men; greyscale-distinct values survive any colour vision deficiency. |
| Airports | White fill + dark ring, **no hue** | Removes the red-on-green problem entirely rather than trading it for a different clash. |
| Stat cards | One accent + neutrals | Four unrelated hues is the main "hobby project" signal. |
| Dark mode | **Groundwork only** — tokens as CSS variables, `darkMode: 'class'`, no theme shipped | A full dark theme is a per-component sweep; doing it half-way looks worse than not at all. Tokens make it a contained follow-up. |
| Token source | CSS variables **plus** a JS export | `react-simple-maps` takes colour strings in JS, so a CSS-only approach cannot reach the map. |

## Palette

### UI (neutral + one accent)
| Token | Light value | Use |
|---|---|---|
| `brand.50…900` | teal ramp, `600` = `#0d9488` | Primary actions, active states, focus rings |
| `surface` | `#ffffff` | Cards |
| `canvas` | `#f6f7f9` | Page background |
| `border` | `#e5e7eb` | Hairlines |
| `ink` / `ink-muted` / `ink-subtle` | `#111827` / `#4b5563` / `#9ca3af` | Text ramp |

### Map semantics — checked for greyscale separation
| Meaning | Value | Relative luminance | Distinct in greyscale? |
|---|---|---|---|
| Home | `#6d28d9` violet-700 | ~0.11 | darkest |
| Visited | `#059669` emerald-600 | ~0.28 | mid |
| Transit | `#fbbf24` amber-400 | ~0.60 | light |
| Unvisited land | `#cbd5e1` slate-300 | ~0.64 | light-neutral |
| Ocean | `#eef4f8` | ~0.87 | lightest |
| Route | `#1d4ed8` blue-700 | — | only blue in the system |
| Airport | `#ffffff` fill, `#0f172a` ring | — | shape, not hue |

Home → Visited → Transit → Unvisited → Ocean is a monotonic lightness ramp, so the map
stays readable in greyscale and under every common colour vision deficiency.

Ocean gets an explicit fill so land, sea and page stop merging into three greys.

## Changes

1. `tailwind.config.js` — real `theme.extend.colors` reading CSS variables with
   `<alpha-value>` support; `darkMode: 'class'`.
2. `src/styles/tokens.css` — `:root` variables (light) and a `.dark` block (groundwork).
3. `src/theme/mapColors.ts` — JS source of truth for map semantics, imported by
   `countryColors.ts`, `FlightRoutes.tsx`, `AirportMarkers.tsx`.
4. `countryColors.ts` — consume the tokens; keep the existing hover/pressed structure.
5. Add an explicit ocean rect behind the geographies in `TravelMap.tsx`.
6. `AirportMarkers.tsx` — white fill + dark ring instead of red.
7. Recolour to the accent: buttons, active tabs, focus rings, links, the auth screens.
8. Overview stat cards → one accent + neutral, hue reserved for the map.
9. `CountryList.tsx` badges → align with map semantics so a "Transit" badge matches the
   transit colour on the map.

## Out of scope
Shipping a working dark theme; restyling the flight-search feature's internals (item 7 may
remove it wholesale).

## Verification
1. Screenshots at 390 and 1440, light.
2. Greyscale screenshot — all three visit types still tellable apart.
3. Deuteranopia simulation — airports still visible over visited countries.
4. Contrast: body text and button labels ≥ 4.5:1.
5. `tsc --noEmit` clean; no visual regression in layout.
