/**
 * The public shape of a shared map.
 *
 * Deliberately assembled by hand rather than reusing the Visit / FlightJourney
 * entities: both carry user-written `notes` ("Trip to see Camp Nou", "Team
 * building"), and reusing them would leak that free text the moment someone
 * shares a link. Nothing here identifies the account beyond a display name the
 * user chose.
 */

export interface PublicCountryDto {
  isoCode: string;
  isoCode2: string;
  name: string;
  // 'lived' is public history like 'trip'; only wishlist stays private.
  visitType: 'trip' | 'transit' | 'home' | 'lived';
}

export interface PublicAirportDto {
  /** Marker label: IATA for airports; the city's name for land endpoints. */
  iataCode: string;
  city: string | null;
  latitude: number;
  longitude: number;
}

export interface PublicRouteDto {
  from: PublicAirportDto;
  to: PublicAirportDto;
  count: number;
  distanceKm: number;
  /** Absent means flight - older cached payloads predate land travel. */
  mode?: 'flight' | 'train' | 'car' | 'bus' | 'ferry';
}

export interface PublicMapStatsDto {
  countriesVisited: number;
  transitCount: number;
  totalCountries: number;
  worldPercent: number;
  journeys: number;
  flights: number;
  distanceKm: number;
}

export interface PublicMapDto {
  displayName: string;
  countries: PublicCountryDto[];
  airports: PublicAirportDto[];
  routes: PublicRouteDto[];
  stats: PublicMapStatsDto;
}
