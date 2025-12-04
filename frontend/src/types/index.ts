export interface Country {
  id: number;
  name: string;
  isoCode: string;
  isoCode2: string;
  createdAt: string;
}

export interface Visit {
  id: number;
  countryId: number;
  country: Country;
  visitedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateVisitDto {
  countryId: number;
  visitedAt?: string;
  notes?: string;
}

export interface UpdateVisitDto {
  visitedAt?: string;
  notes?: string;
}

// Airport types
export interface Airport {
  id: number;
  iataCode: string;
  icaoCode: string | null;
  name: string;
  city: string | null;
  country: string | null;
  countryIso: string | null;
  latitude: number;
  longitude: number;
  createdAt: string;
}

// Flight types
export interface FlightLeg {
  id: number;
  legOrder: number;
  departureAirport: Airport;
  arrivalAirport: Airport;
  distanceKm: number;
}

export interface FlightJourney {
  id: number;
  journeyDate: string | null;
  isRoundTrip: boolean;
  notes: string | null;
  legs: FlightLeg[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateFlightDto {
  journeyDate?: string;
  isRoundTrip?: boolean;
  notes?: string;
  airportIds: number[]; // Chain of airport IDs: [VAR_id, IST_id, LIS_id]
}

export interface UpdateFlightDto {
  journeyDate?: string;
  isRoundTrip?: boolean;
  notes?: string;
}

// Statistics types
export interface YearStats {
  year: number;
  flights: number;
  distanceKm: number;
}

export interface MonthStats {
  year: number;
  month: number;
  flights: number;
  distanceKm: number;
}

export interface AirportVisitCount {
  airportId: number;
  iataCode: string;
  name: string;
  city: string;
  country: string;
  visitCount: number;
}

export interface RouteCount {
  fromAirportId: number;
  fromIataCode: string;
  fromCity: string;
  toAirportId: number;
  toIataCode: string;
  toCity: string;
  count: number;
  distanceKm: number;
}

export interface FlightStats {
  // Core stats
  totalFlights: number;
  totalJourneys: number;
  totalDistanceKm: number;

  // Time-based
  byYear: YearStats[];
  byMonth: MonthStats[];
  strongestYear: YearStats | null;
  strongestMonth: MonthStats | null;

  // Records
  longestFlight: {
    departureIata: string;
    departureCity: string;
    arrivalIata: string;
    arrivalCity: string;
    distanceKm: number;
  } | null;
  shortestFlight: {
    departureIata: string;
    departureCity: string;
    arrivalIata: string;
    arrivalCity: string;
    distanceKm: number;
  } | null;
  mostVisitedAirports: AirportVisitCount[];
  mostCommonRoutes: RouteCount[];

  // Geographic
  uniqueAirports: number;
  uniqueCountries: number;
  countriesVisited: string[];

  // Creative
  earthCircumferences: number;
  moonDistancePercent: number;
  estimatedFlightHours: number;
  walkingYears: number;
}
