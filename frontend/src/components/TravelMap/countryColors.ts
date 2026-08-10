import type { Visit, VisitType } from '../../types';
import { MAP, MAP_HOVER, MAP_PRESSED } from '../../theme/mapColors';

export interface CountryDisplayInfo {
  isoCode: string;
  visitType: VisitType | 'none';
  isHome: boolean;
  hasFlights: boolean;
  visit: Visit | null;
}

/**
 * Visit-type colours, from the shared map tokens.
 *
 * The values are chosen for a monotonic lightness ramp rather than for hue
 * contrast alone — the previous green/orange pair was nearly identical in
 * greyscale and unreadable with red-green colour vision deficiency.
 */
export const COUNTRY_COLORS = {
  home: MAP.home,
  trip: MAP.visited,
  transit: MAP.transit,
  flightOnly: MAP.route,
  none: MAP.land,
} as const;

export const COUNTRY_COLORS_HOVER = {
  home: MAP_HOVER.home,
  trip: MAP_HOVER.visited,
  transit: MAP_HOVER.transit,
  flightOnly: MAP.routeHighlight,
  none: MAP_HOVER.land,
} as const;

export const COUNTRY_COLORS_PRESSED = {
  home: MAP_PRESSED.home,
  trip: MAP_PRESSED.visited,
  transit: MAP_PRESSED.transit,
  flightOnly: MAP.routeHighlight,
  none: MAP_PRESSED.land,
} as const;

export function getCountryColor(
  visitType: VisitType | 'none',
  isHome: boolean
): string {
  if (isHome) return COUNTRY_COLORS.home;
  if (visitType === 'none') return COUNTRY_COLORS.none;
  return COUNTRY_COLORS[visitType];
}

export function getCountryHoverColor(
  visitType: VisitType | 'none',
  isHome: boolean
): string {
  if (isHome) return COUNTRY_COLORS_HOVER.home;
  if (visitType === 'none') return COUNTRY_COLORS_HOVER.none;
  return COUNTRY_COLORS_HOVER[visitType];
}

export function getCountryPressedColor(
  visitType: VisitType | 'none',
  isHome: boolean
): string {
  if (isHome) return COUNTRY_COLORS_PRESSED.home;
  if (visitType === 'none') return COUNTRY_COLORS_PRESSED.none;
  return COUNTRY_COLORS_PRESSED[visitType];
}

/**
 * Build a map of ISO codes to display info from visits
 */
export function buildCountryDisplayMap(
  visits: Visit[]
): Map<string, CountryDisplayInfo> {
  const map = new Map<string, CountryDisplayInfo>();

  visits.forEach((visit) => {
    if (!visit.country?.isoCode) return;

    // Default to 'trip' for existing records without visitType
    const visitType = visit.visitType || 'trip';

    map.set(visit.country.isoCode, {
      isoCode: visit.country.isoCode,
      visitType: visitType,
      isHome: visitType === 'home',
      hasFlights: visit.source === 'flight',
      visit,
    });
  });

  return map;
}
