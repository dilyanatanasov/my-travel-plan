import type { Visit, VisitType } from '../../types';

export interface CountryDisplayInfo {
  isoCode: string;
  visitType: VisitType | 'none';
  isHome: boolean;
  hasFlights: boolean;
  visit: Visit | null;
}

// Color scheme for different visit types
export const COUNTRY_COLORS = {
  home: '#8b5cf6',        // Purple
  trip: '#22c55e',        // Green
  transit: '#f59e0b',     // Orange
  flightOnly: '#3b82f6',  // Blue (not used currently since we auto-create visits)
  none: '#d1d5db',        // Gray
} as const;

export const COUNTRY_COLORS_HOVER = {
  home: '#7c3aed',
  trip: '#16a34a',
  transit: '#d97706',
  flightOnly: '#2563eb',
  none: '#9ca3af',
} as const;

export const COUNTRY_COLORS_PRESSED = {
  home: '#6d28d9',
  trip: '#15803d',
  transit: '#b45309',
  flightOnly: '#1d4ed8',
  none: '#6b7280',
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
