import type { Alpha3 } from '../../types';
import type { Visit, VisitType } from '../../types';
import type { MapPalette, MapStatePalette } from '../../theme/mapColors';

export interface CountryDisplayInfo {
  isoCode: Alpha3;
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
/** Maps a visit type onto the state palette entry that represents it. */
function pick(
  state: MapStatePalette,
  visitType: VisitType | 'none',
  isHome: boolean
): string {
  if (isHome) return state.home;
  if (visitType === 'none') return state.land;
  if (visitType === 'home') return state.home;
  if (visitType === 'transit') return state.transit;
  if (visitType === 'wishlist') return state.wishlist;
  return state.visited;
}

export function getCountryColor(
  palette: MapPalette,
  visitType: VisitType | 'none',
  isHome: boolean
): string {
  if (isHome) return palette.home;
  if (visitType === 'none') return palette.land;
  if (visitType === 'transit') return palette.transit;
  if (visitType === 'home') return palette.home;
  if (visitType === 'wishlist') return palette.wishlist;
  return palette.visited;
}

export function getCountryHoverColor(
  hover: MapStatePalette,
  visitType: VisitType | 'none',
  isHome: boolean
): string {
  return pick(hover, visitType, isHome);
}

export function getCountryPressedColor(
  pressed: MapStatePalette,
  visitType: VisitType | 'none',
  isHome: boolean
): string {
  return pick(pressed, visitType, isHome);
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
