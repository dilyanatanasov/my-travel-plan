import type { Continent } from './continentUtils';

export type DistanceRange = 'all' | 'short' | 'medium' | 'long';
export type RouteType = 'all' | 'domestic' | 'international';
/** How the leg travelled: air, ground (train/car/bus) or sea (ferry). */
export type TravelKind = 'all' | 'air' | 'ground' | 'sea';

export interface FlightFilters {
  originAirport: string | null; // IATA code
  destinationAirport: string | null; // IATA code
  continents: Continent[];
  year: number | null;
  distanceRange: DistanceRange;
  routeType: RouteType;
  travelKind: TravelKind;
}

export const DEFAULT_FILTERS: FlightFilters = {
  originAirport: null,
  destinationAirport: null,
  continents: [],
  year: null,
  distanceRange: 'all',
  routeType: 'all',
  travelKind: 'all',
};

/* A mixed map gets cluttered (owner report, 2026-08-18) - one chip row
   splits it by how you travelled. */
export const TRAVEL_KINDS: { value: TravelKind; label: string }[] = [
  { value: 'all', label: 'All Travel' },
  { value: 'air', label: 'Flights' },
  { value: 'ground', label: 'Ground' },
  { value: 'sea', label: 'Sea' },
];

export const DISTANCE_RANGES: { value: DistanceRange; label: string; range: string }[] = [
  { value: 'all', label: 'All Distances', range: '' },
  { value: 'short', label: 'Short-haul', range: '< 1,500 km' },
  { value: 'medium', label: 'Medium-haul', range: '1,500 - 4,000 km' },
  { value: 'long', label: 'Long-haul', range: '> 4,000 km' },
];

export const ROUTE_TYPES: { value: RouteType; label: string }[] = [
  { value: 'all', label: 'All Routes' },
  { value: 'domestic', label: 'Domestic' },
  { value: 'international', label: 'International' },
];
