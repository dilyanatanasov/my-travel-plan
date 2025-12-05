import type { FlightJourney, FlightLeg, Airport } from '../../types';
import type { FlightFilters, DistanceRange } from './filterTypes';
import { getContinent, type Continent } from './continentUtils';

/**
 * Check if a leg matches the distance range filter
 */
function matchesDistanceRange(distanceKm: number, range: DistanceRange): boolean {
  if (range === 'all') return true;
  if (range === 'short') return distanceKm < 1500;
  if (range === 'medium') return distanceKm >= 1500 && distanceKm <= 4000;
  if (range === 'long') return distanceKm > 4000;
  return true;
}

/**
 * Check if a leg is domestic (same country) or international
 */
function isDomesticFlight(leg: FlightLeg): boolean {
  const depCountry = leg.departureAirport.countryIso;
  const arrCountry = leg.arrivalAirport.countryIso;
  return depCountry === arrCountry && depCountry !== null;
}

/**
 * Check if a leg involves any of the selected continents
 */
function matchesContinents(leg: FlightLeg, continents: Continent[]): boolean {
  if (continents.length === 0) return true;

  const depContinent = getContinent(leg.departureAirport.countryIso);
  const arrContinent = getContinent(leg.arrivalAirport.countryIso);

  return continents.includes(depContinent) || continents.includes(arrContinent);
}

/**
 * Check if a leg matches the airport filter (origin or destination)
 */
function matchesAirport(
  leg: FlightLeg,
  originAirport: string | null,
  destinationAirport: string | null
): boolean {
  if (originAirport && leg.departureAirport.iataCode !== originAirport) {
    return false;
  }
  if (destinationAirport && leg.arrivalAirport.iataCode !== destinationAirport) {
    return false;
  }
  return true;
}

/**
 * Check if a journey matches the year filter
 */
function matchesYear(journey: FlightJourney, year: number | null): boolean {
  if (year === null) return true;
  if (!journey.journeyDate) return false;
  return new Date(journey.journeyDate).getFullYear() === year;
}

/**
 * Check if a leg matches the route type filter
 */
function matchesRouteType(
  leg: FlightLeg,
  routeType: 'all' | 'domestic' | 'international'
): boolean {
  if (routeType === 'all') return true;
  const isDomestic = isDomesticFlight(leg);
  return routeType === 'domestic' ? isDomestic : !isDomestic;
}

/**
 * Apply all filters to a list of flights
 * Returns filtered flights with only matching legs
 */
export function applyFilters(
  flights: FlightJourney[],
  filters: FlightFilters
): FlightJourney[] {
  const { originAirport, destinationAirport, continents, year, distanceRange, routeType } =
    filters;

  // Check if any filters are active
  const hasFilters =
    originAirport !== null ||
    destinationAirport !== null ||
    continents.length > 0 ||
    year !== null ||
    distanceRange !== 'all' ||
    routeType !== 'all';

  if (!hasFilters) return flights;

  return flights
    .filter((journey) => matchesYear(journey, year))
    .map((journey) => {
      const filteredLegs = journey.legs.filter((leg) => {
        return (
          matchesAirport(leg, originAirport, destinationAirport) &&
          matchesContinents(leg, continents) &&
          matchesDistanceRange(leg.distanceKm, distanceRange) &&
          matchesRouteType(leg, routeType)
        );
      });

      if (filteredLegs.length === 0) return null;

      return {
        ...journey,
        legs: filteredLegs,
      };
    })
    .filter((journey): journey is FlightJourney => journey !== null);
}

/**
 * Extract unique airports from flights (for filter dropdowns)
 */
export function extractFilterOptions(flights: FlightJourney[]) {
  const originAirports = new Map<string, Airport>();
  const destinationAirports = new Map<string, Airport>();
  const years = new Set<number>();

  flights.forEach((journey) => {
    if (journey.journeyDate) {
      years.add(new Date(journey.journeyDate).getFullYear());
    }

    journey.legs.forEach((leg) => {
      originAirports.set(leg.departureAirport.iataCode, leg.departureAirport);
      destinationAirports.set(leg.arrivalAirport.iataCode, leg.arrivalAirport);
    });
  });

  // Combine all airports for both dropdowns (any airport can be origin or destination)
  const allAirports = new Map([...originAirports, ...destinationAirports]);

  return {
    airports: Array.from(allAirports.values()).sort((a, b) =>
      a.iataCode.localeCompare(b.iataCode)
    ),
    years: Array.from(years).sort((a, b) => b - a),
  };
}

/**
 * Count active filters for display
 */
export function countActiveFilters(filters: FlightFilters): number {
  let count = 0;
  if (filters.originAirport) count++;
  if (filters.destinationAirport) count++;
  if (filters.continents.length > 0) count++;
  if (filters.year !== null) count++;
  if (filters.distanceRange !== 'all') count++;
  if (filters.routeType !== 'all') count++;
  return count;
}
