// Internal Flight Result DTOs (normalized from Skyscanner response)

export type SafetyWarning = 'banned' | 'caution' | 'safe';

export interface FlightSegmentDto {
  segmentId: string;
  flightNumber: string;
  departureAirport: string; // IATA code
  departureAirportName: string;
  arrivalAirport: string; // IATA code
  arrivalAirportName: string;
  departureTime: string; // ISO datetime
  arrivalTime: string; // ISO datetime
  durationMinutes: number;
  marketingCarrier: CarrierDto;
  operatingCarrier: CarrierDto;
  cabinClass?: string;
}

export interface CarrierDto {
  code: string; // IATA code
  name: string;
  logoUrl?: string;
  safetyWarning: SafetyWarning;
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

export interface LayoverDto {
  airport: string; // IATA code
  airportName: string;
  durationMinutes: number;
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
  /**
   * Present when this itinerary is COMPOSED from separate bookings via a
   * positioning hub (split-ticket tier). Separate tickets carry no
   * missed-connection protection — the UI must say so, and each booking
   * gets its own link.
   */
  selfTransfer?: {
    hub: string;
    bookings: { label: string; price: number; deepLink: string }[];
  };
  /**
   * True when this card is built from the price SURFACE, not a live
   * itinerary: dates and an indicative total, no flight times or
   * carriers. The deep link opens the live search for those exact dates.
   */
  isEstimate?: boolean;
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

export interface FilterStatsDto {
  minPrice: number;
  maxPrice: number;
  minDuration: number;
  maxDuration: number;
  airlines: { code: string; name: string; count: number }[];
  stopCounts: { stops: number; count: number }[];
}
