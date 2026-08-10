/**
 * Map colour source of truth.
 *
 * react-simple-maps takes fills and strokes as JS strings rather than classes,
 * so these cannot live in Tailwind alone. Keep them in step with the
 * `--color-map-*` variables in src/styles/tokens.css, which the legend and
 * badges use.
 *
 * The visit-type values form a monotonic lightness ramp
 * (home darkest -> transit lightest -> land -> ocean). That is what makes the
 * map readable in greyscale and under red-green colour vision deficiency,
 * which the previous green/orange/red palette was not.
 */
export const MAP = {
  home: '#6d28d9',
  visited: '#059669',
  transit: '#fbbf24',
  land: '#cbd5e1',
  ocean: '#eef4f8',
  route: '#1d4ed8',
  routeHighlight: '#1e293b',
  /** Airports read as shape + lightness, never hue: red dots over green
      countries were the app's worst colourblind failure. */
  airportFill: '#ffffff',
  airportRing: '#0f172a',
  countryBorder: '#ffffff',
} as const;

/** Legend entries, shared by the app's map panel and the public shared map. */
export const COUNTRY_LEGEND = [
  { label: 'Home', color: MAP.home },
  { label: 'Visited', color: MAP.visited },
  { label: 'Transit', color: MAP.transit },
] as const;

/** Slightly darker variants for hover feedback. */
export const MAP_HOVER = {
  home: '#5b21b6',
  visited: '#047857',
  transit: '#f59e0b',
  land: '#94a3b8',
} as const;

/** Darker still, for the active/pressed state. */
export const MAP_PRESSED = {
  home: '#4c1d95',
  visited: '#065f46',
  transit: '#d97706',
  land: '#64748b',
} as const;
