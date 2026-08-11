/**
 * Colours for things drawn *on the map canvas*, which is dark.
 *
 * react-simple-maps takes fills and strokes as JS strings rather than classes,
 * so these cannot live in Tailwind alone.
 *
 * These deliberately differ from the `--color-map-*` variables in
 * src/styles/tokens.css. Those are the same semantics tuned for the app's
 * *light* surfaces — a stat tile or a country badge — where these bright
 * values would fail contrast against white. Same meanings, two backgrounds,
 * two sets of values. Anything rendered onto the map uses this file; anything
 * rendered into a light panel uses the CSS tokens.
 *
 * Lightness still climbs monotonically from the background upward
 * (ocean → land → home → visited → transit), which is what keeps the map
 * readable in greyscale and under red-green colour vision deficiency. The
 * order is inverted from the light theme, but the property that matters —
 * every category separated by luminance, not only hue — is preserved.
 */
export const MAP = {
  /** Near-black navy. Dark enough that everything above it reads as lit. */
  ocean: '#0a1020',
  /**
   * Unvisited land. Chosen by measurement rather than eye: at #1f2b3e the
   * continents were only 1.33:1 against the ocean and barely separated from
   * it. This is 1.65:1, while still leaving visited at ~6:1 and home at
   * ~4.2:1 against it — every category stays obviously lit.
   */
  land: '#293a53',
  /** Hairlines between countries — lighter than land, never white. */
  countryBorder: '#3a4d6b',

  home: '#a78bfa',
  visited: '#34d399',
  transit: '#fcd34d',

  route: '#60a5fa',
  routeHighlight: '#bfdbfe',

  /**
   * A selected journey. Rose is the one strong hue the map does not already
   * spend on a category — violet is home, emerald visited, amber transit,
   * blue routes. It sits beside emerald, which is a red/green pairing, but
   * the selection is also the only animated element and the only one carrying
   * white dashes, so it never relies on hue alone.
   */
  selected: '#fb7185',
  selectedGlow: '#f43f5e',

  /** Airports read as shape and lightness, never hue. */
  airportFill: '#ffffff',
  airportRing: '#0a1020',
} as const;

/** Legend entries, shared by the map panel and the public shared map. */
export const COUNTRY_LEGEND = [
  { label: 'Home', color: MAP.home },
  { label: 'Visited', color: MAP.visited },
  { label: 'Transit', color: MAP.transit },
] as const;

/**
 * Hover state. On a dark map "highlight" means brighter, not darker — the
 * light theme's darken-on-hover would have read as the country switching off.
 */
export const MAP_HOVER = {
  home: '#c4b5fd',
  visited: '#6ee7b7',
  transit: '#fde68a',
  land: '#38496a',
} as const;

/** Pressed: brighter still, so the press is visible mid-tap. */
export const MAP_PRESSED = {
  home: '#ddd6fe',
  visited: '#a7f3d0',
  transit: '#fef3c7',
  land: '#45587c',
} as const;
