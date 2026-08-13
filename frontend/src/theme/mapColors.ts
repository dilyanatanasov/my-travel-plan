import { useTheme, type ResolvedTheme } from '../features/theme/ThemeContext';

/**
 * Colours for things drawn *on the map canvas*, per theme.
 *
 * react-simple-maps takes fills and strokes as JS strings rather than classes,
 * so these cannot live in Tailwind alone. Consume them with `useMapColors()`,
 * which subscribes to the theme — a static import would freeze the map on
 * whichever palette was current at module load.
 *
 * These are separate from the `--color-map-*` CSS variables. Those are the
 * same semantics tuned for *panel* surfaces (a stat tile, a country badge);
 * these are tuned for the map canvas, which is a different background in both
 * themes.
 *
 * In both palettes lightness moves monotonically from the background through
 * the categories — climbing on dark, descending on light. That ordering is
 * what keeps the map readable in greyscale and under red-green colour vision
 * deficiency, and it is the property to preserve if these are ever retuned.
 */
export interface MapPalette {
  ocean: string;
  land: string;
  countryBorder: string;
  /**
   * Border for countries with a visit color. One stroke value cannot read
   * against both dark land and bright terracotta: visited neighbours merged
   * into one blob. Colored countries take a border from the opposite end of
   * the lightness scale.
   */
  visitedBorder: string;
  home: string;
  visited: string;
  transit: string;
  /**
   * "Want to go". The one cool hue in a warm palette — deliberately an
   * outlier, because it is the one state that is not history. Desaturated so
   * it stays quieter than any visited color.
   */
  wishlist: string;
  route: string;
  routeHighlight: string;
  selected: string;
  selectedGlow: string;
  airportFill: string;
  airportRing: string;
  /** Text drawn onto the map, e.g. IATA labels. */
  label: string;
}

export interface MapStatePalette {
  home: string;
  visited: string;
  transit: string;
  /** "Want to go" — a dream, not a visit. */
  wishlist: string;
  land: string;
}

const DARK: MapPalette = {
  ocean: '#1a1817',
  land: '#3a352d',
  // Clearly lighter than land: the first value (#4a443a) was one shade off
  // and adjacent countries merged into a single landmass at a glance.
  countryBorder: '#6e6656',
  visitedBorder: '#1f1b18',
  home: '#ffe1d0',
  visited: '#b2622d',
  transit: '#aebf92',
  wishlist: '#5a7ba6',
  route: '#f6a06b',
  routeHighlight: '#ffe1d0',
  selected: '#e8836a',
  selectedGlow: '#c8543a',
  airportFill: '#f9f4ed',
  airportRing: '#201e1d',
  label: '#eee7db',
};

const DARK_HOVER: MapStatePalette = {
  home: '#fff2eb',
  visited: '#d67f48',
  transit: '#ccdbb2',
  wishlist: '#6f90bd',
  land: '#474238',
};

const DARK_PRESSED: MapStatePalette = {
  home: '#ffffff',
  visited: '#f6a06b',
  transit: '#e1eecc',
  wishlist: '#87a8d4',
  land: '#544d42',
};

const LIGHT: MapPalette = {
  ocean: '#f5ead8',
  land: '#e3d5bd',
  // A mid-tone line, not the ocean cream: cream-on-land read as a gap
  // between countries rather than a border, and disappeared entirely
  // between visited neighbours.
  countryBorder: '#b8a88c',
  visitedBorder: '#8c491a',
  // Darker than the dark theme's equivalents: these sit on pale land, so they
  // must descend in lightness rather than climb.
  home: '#402310',
  visited: '#f6a06b',
  transit: '#8fa073',
  wishlist: '#7d9bc4',
  route: '#8c491a',
  routeHighlight: '#402310',
  selected: '#a82d26',
  selectedGlow: '#d67f48',
  // Inverted from dark: a dark dot with a white ring reads on pale land the
  // way a white dot with a dark ring reads on a dark ocean.
  airportFill: '#8c491a',
  airportRing: '#f9f4ed',
  label: '#201e1d',
};

const LIGHT_HOVER: MapStatePalette = {
  home: '#643312',
  visited: '#d67f48',
  transit: '#728157',
  wishlist: '#5f7da8',
  land: '#dcd3c4',
};

const LIGHT_PRESSED: MapStatePalette = {
  home: '#2a1508',
  visited: '#b2622d',
  transit: '#56633f',
  wishlist: '#46618c',
  land: '#c0b6a5',
};

export interface MapColors {
  map: MapPalette;
  hover: MapStatePalette;
  pressed: MapStatePalette;
  legend: { label: string; color: string }[];
}

export function getMapColors(theme: ResolvedTheme): MapColors {
  const map = theme === 'dark' ? DARK : LIGHT;
  return {
    map,
    hover: theme === 'dark' ? DARK_HOVER : LIGHT_HOVER,
    pressed: theme === 'dark' ? DARK_PRESSED : LIGHT_PRESSED,
    legend: [
      { label: 'Home', color: map.home },
      { label: 'Visited', color: map.visited },
      { label: 'Transit', color: map.transit },
      { label: 'Want to go', color: map.wishlist },
    ],
  };
}

/** Map colours for the active theme. Re-renders consumers when it changes. */
export function useMapColors(): MapColors {
  const { resolved } = useTheme();
  return getMapColors(resolved);
}
