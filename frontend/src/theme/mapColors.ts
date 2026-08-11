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
  home: string;
  visited: string;
  transit: string;
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
  land: string;
}

const DARK: MapPalette = {
  ocean: '#0a1020',
  land: '#293a53',
  countryBorder: '#3a4d6b',
  home: '#a78bfa',
  visited: '#34d399',
  transit: '#fcd34d',
  route: '#60a5fa',
  routeHighlight: '#bfdbfe',
  selected: '#fb7185',
  selectedGlow: '#f43f5e',
  airportFill: '#ffffff',
  airportRing: '#0a1020',
  label: '#e2e8f0',
};

const DARK_HOVER: MapStatePalette = {
  home: '#c4b5fd',
  visited: '#6ee7b7',
  transit: '#fde68a',
  land: '#38496a',
};

const DARK_PRESSED: MapStatePalette = {
  home: '#ddd6fe',
  visited: '#a7f3d0',
  transit: '#fef3c7',
  land: '#45587c',
};

const LIGHT: MapPalette = {
  ocean: '#e8f0f7',
  land: '#cbd5e1',
  countryBorder: '#ffffff',
  // Darker than the dark theme's equivalents: these sit on pale land, so they
  // must descend in lightness rather than climb.
  home: '#6d28d9',
  visited: '#059669',
  transit: '#d97706',
  route: '#1d4ed8',
  routeHighlight: '#1e293b',
  selected: '#e11d48',
  selectedGlow: '#fb7185',
  // Inverted from dark: a dark dot with a white ring reads on pale land the
  // way a white dot with a dark ring reads on a dark ocean.
  airportFill: '#0f172a',
  airportRing: '#ffffff',
  label: '#0f172a',
};

const LIGHT_HOVER: MapStatePalette = {
  home: '#5b21b6',
  visited: '#047857',
  transit: '#b45309',
  land: '#94a3b8',
};

const LIGHT_PRESSED: MapStatePalette = {
  home: '#4c1d95',
  visited: '#065f46',
  transit: '#92400e',
  land: '#64748b',
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
    ],
  };
}

/** Map colours for the active theme. Re-renders consumers when it changes. */
export function useMapColors(): MapColors {
  const { resolved } = useTheme();
  return getMapColors(resolved);
}
