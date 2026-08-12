/*
  Two ISO conventions live in this app and they are not interchangeable:
  countries are keyed by alpha-3 ("BGR"), because that is what the map's
  TopoJSON gives us, while airports store alpha-2 ("BG").

  Comparing one to the other compiles fine and matches nothing, which is
  exactly what happened in the country detail card: a country with flights
  showed no airports and no journeys, with no error anywhere. Branding them
  makes that a type error instead of a silent empty list.

  They are still strings at runtime — the brand exists only at compile time.
*/
/** [longitude, latitude], the order d3 and GeoJSON use. */
export type LonLatTuple = [number, number];

export type Alpha2 = string & { readonly __iso: 'alpha2' };
export type Alpha3 = string & { readonly __iso: 'alpha3' };

/** Assert a raw string is alpha-2. Use only where the source guarantees it. */
export const asAlpha2 = (code: string): Alpha2 => code as Alpha2;
/** Assert a raw string is alpha-3. Use only where the source guarantees it. */
export const asAlpha3 = (code: string): Alpha3 => code as Alpha3;

export interface Country {
  id: number;
  name: string;
  /** Alpha-3, matching the map's geography keys. */
  isoCode: Alpha3;
  /** Alpha-2, matching what airports store. */
  isoCode2: Alpha2;
  createdAt: string;
}

export type VisitType = 'trip' | 'transit' | 'home';
export type VisitSource = 'manual' | 'flight';

export interface Visit {
  id: number;
  countryId: number;
  country: Country;
  visitedAt: string | null;
  notes: string | null;
  visitType: VisitType;
  source: VisitSource;
  flightJourneyId: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateVisitDto {
  countryId?: number;
  countryIso?: string;
  visitedAt?: string;
  notes?: string;
  visitType?: VisitType;
  source?: VisitSource;
  flightJourneyId?: number;
}

export interface UpdateVisitDto {
  visitedAt?: string;
  notes?: string;
  visitType?: VisitType;
}

// Airport types
export interface Airport {
  id: number;
  iataCode: string;
  icaoCode: string | null;
  name: string;
  city: string | null;
  country: string | null;
  /** Alpha-2. Not the same convention as Country.isoCode. */
  countryIso: Alpha2 | null;
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

/**
 * The cheap subset of FlightStats the map's initial view needs. Served by
 * GET /flights/summary via a COUNT/SUM, so the home page no longer pulls the
 * full journey graph just to show a flight count and a distance.
 */
export interface FlightSummary {
  totalFlights: number;
  totalJourneys: number;
  totalDistanceKm: number;
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

// Flight Search Types
export type CabinClass = 'economy' | 'premium_economy' | 'business' | 'first';
export type SafetyWarning = 'banned' | 'caution' | 'safe';
export type SortOption = 'price_asc' | 'price_desc' | 'duration_asc' | 'duration_desc' | 'departure_asc' | 'departure_desc' | 'stops_asc';

export interface SearchFlightsDto {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string;
  passengers: number;
  cabinClass: CabinClass;
  filters?: FilterOptionsDto;
}

export interface FilterOptionsDto {
  maxStops?: number;
  minLayoverMinutes?: number;
  maxLayoverMinutes?: number;
  minPrice?: number;
  maxPrice?: number;
  airlines?: string[];
  excludeAirlines?: string[];
  maxDurationMinutes?: number;
  minDurationMinutes?: number;
}

export interface CarrierDto {
  code: string;
  name: string;
  logoUrl?: string;
  safetyWarning: SafetyWarning;
}

export interface LayoverDto {
  airport: string;
  airportName: string;
  durationMinutes: number;
}

export interface FlightSegmentDto {
  segmentId: string;
  flightNumber: string;
  departureAirport: string;
  departureAirportName: string;
  arrivalAirport: string;
  arrivalAirportName: string;
  departureTime: string;
  arrivalTime: string;
  durationMinutes: number;
  marketingCarrier: CarrierDto;
  operatingCarrier: CarrierDto;
  cabinClass?: string;
}

export interface FlightLegDto {
  legId: string;
  departureAirport: string;
  departureAirportName: string;
  arrivalAirport: string;
  arrivalAirportName: string;
  departureTime: string;
  arrivalTime: string;
  durationMinutes: number;
  stopCount: number;
  segments: FlightSegmentDto[];
  layovers: LayoverDto[];
  carriers: CarrierDto[];
}

export interface PricingOptionDto {
  price: number;
  currency: string;
  agentName: string;
  agentLogoUrl?: string;
  deepLink: string;
  cabinClass?: string;
  fareFamily?: string;
}

export interface FlightResultDto {
  itineraryId: string;
  outboundLeg: FlightLegDto;
  returnLeg?: FlightLegDto;
  totalDurationMinutes: number;
  totalStops: number;
  pricingOptions: PricingOptionDto[];
  lowestPrice: number;
  currency: string;
  safetyWarnings: {
    hasBannedCarrier: boolean;
    hasCautionCarrier: boolean;
    carriers: { code: string; name: string; warning: SafetyWarning }[];
  };
  eco?: {
    isEcoContender: boolean;
    co2Emission?: number;
  };
}

export interface FilterStatsDto {
  minPrice: number;
  maxPrice: number;
  minDuration: number;
  maxDuration: number;
  airlines: { code: string; name: string; count: number }[];
  stopCounts: { stops: number; count: number }[];
}

export interface FlightSearchResultDto {
  searchId: string;
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string;
  passengers: number;
  cabinClass: string;
  results: FlightResultDto[];
  totalResults: number;
  filterStats: FilterStatsDto;
}

// Flight Exploration Types (Flexible Search)
export type DateType = 'specific' | 'month' | 'range' | 'weekends';

export interface FlexibleSearchDto {
  origin: string;
  destination: string;
  dateType: DateType;
  // For specific dates
  departureDate?: string;
  returnDate?: string;
  // For month search
  month?: string; // "2025-03"
  // For range/weekends
  dateRangeStart?: string;
  dateRangeEnd?: string;
  // Duration (for flexible searches)
  minNights: number;
  maxNights: number;
  // Common
  passengers: number;
  cabinClass: CabinClass;
  // Optional preferences
  preferredHubs?: string[];
  excludeHubs?: string[];
  maxTravelTimeHours?: number;
  allowAsymmetricRouting?: boolean;
}

export interface ExplorationFlightOptionDto {
  id: string;
  departureDate: string;
  returnDate: string;
  nightsAtDestination: number;
  dateLabel: string;
  outbound: FlightLegDto;
  return?: FlightLegDto;
  totalPrice: number;
  currency: string;
  pricePerPerson: number;
  bookingUrl: string;
  score: number;
  scoreBreakdown: {
    price: number;
    duration: number;
    convenience: number;
  };
  isRecommended: boolean;
  isCheapest: boolean;
  isFastest: boolean;
  hasLongLayover: boolean;
  hasBannedCarrier: boolean;
  carriers: CarrierDto[];
  safetyWarnings: {
    hasBannedCarrier: boolean;
    hasCautionCarrier: boolean;
    carriers: { code: string; name: string; warning: SafetyWarning }[];
  };
}

export interface DateGroupDto {
  dateRange: string;
  startDate: string;
  endDate: string;
  optionCount: number;
  lowestPrice: number;
  averagePrice: number;
  bestDurationMinutes: number;
  options: ExplorationFlightOptionDto[];
}

export interface RouteGroupDto {
  routeDescription: string;
  connectionAirports: string[];
  optionCount: number;
  lowestPrice: number;
  averageDurationMinutes: number;
  options: ExplorationFlightOptionDto[];
}

export interface InsightDto {
  type: 'recommendation' | 'tip' | 'warning' | 'price_trend';
  icon: string;
  title: string;
  message: string;
  relatedOptionIds?: string[];
}

export interface PriceTrendDto {
  date: string;
  lowestPrice: number;
  optionCount: number;
}

export interface FlightExplorationResultDto {
  searchId: string;
  origin: string;
  destination: string;
  dateType: DateType;
  dateRange: {
    from: string;
    to: string;
  };
  duration: {
    minNights: number;
    maxNights: number;
  };
  passengers: number;
  highlights: {
    recommended: ExplorationFlightOptionDto | null;
    cheapest: ExplorationFlightOptionDto | null;
    fastest: ExplorationFlightOptionDto | null;
  };
  byDate: DateGroupDto[];
  byRoute: RouteGroupDto[];
  allOptions: ExplorationFlightOptionDto[];
  insights: InsightDto[];
  priceTrend: PriceTrendDto[];
  meta: {
    totalOptionsFound: number;
    searchesPerformed: number;
    searchDurationMs: number;
    sampledDates: string[];
  };
}
