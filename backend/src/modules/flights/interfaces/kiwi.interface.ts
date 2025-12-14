// Kiwi.com API Response Interfaces (RapidAPI version)

export interface KiwiSearchResponse {
  __typename: string;
  metadata: KiwiMetadata;
  itineraries: KiwiItinerary[];
}

export interface KiwiMetadata {
  carriers: KiwiCarrier[];
  itinerariesCount: number;
  hasMorePending: boolean;
  topResults?: {
    best?: KiwiTopResult;
    cheapest?: KiwiTopResult;
    fastest?: KiwiTopResult;
  };
}

export interface KiwiTopResult {
  __typename: string;
  duration: number;
  price: { amount: string };
  id: string;
}

export interface KiwiCarrier {
  id: string;
  code: string;
  name: string;
}

export interface KiwiItinerary {
  __typename: string;
  id: string;
  shareId: string;
  price: KiwiPrice;
  priceEur: KiwiPrice;
  provider: KiwiProvider;
  bagsInfo: KiwiBagsInfo;
  bookingOptions: KiwiBookingOptions;
  travelHack: KiwiTravelHack;
  legacyId: string;
  // One-way flights use 'sector', round-trips use 'outbound/inbound'
  sector?: KiwiSector;
  outbound?: KiwiSector;
  inbound?: KiwiSector;
  stopover?: KiwiStopover;
  lastAvailable?: { seatsLeft: number | null };
}

export interface KiwiPrice {
  amount: string;
  priceBeforeDiscount?: string;
}

export interface KiwiProvider {
  name: string;
  code: string;
  hasHighProbabilityOfPriceChange: boolean;
  contentProvider: { code: string };
  id: string;
}

export interface KiwiBagsInfo {
  includedCheckedBags: number;
  includedHandBags: number;
  hasNoBaggageSupported: boolean;
  hasNoCheckedBaggage: boolean;
  checkedBagTiers: KiwiBagTier[];
  handBagTiers: KiwiBagTier[];
}

export interface KiwiBagTier {
  tierPrice: { amount: string };
  bags: { weight: { value: number } }[];
}

export interface KiwiBookingOptions {
  edges: KiwiBookingEdge[];
}

export interface KiwiBookingEdge {
  node: KiwiBookingNode;
}

export interface KiwiBookingNode {
  bookingUrl: string;
  itineraryProvider: {
    code: string;
    name: string;
    subprovider: string | null;
    hasHighProbabilityOfPriceChange: boolean;
  };
  price: { amount: string };
}

export interface KiwiTravelHack {
  isTrueHiddenCity: boolean;
  isVirtualInterlining: boolean;
  isThrowawayTicket: boolean;
}

export interface KiwiSector {
  id: string;
  sectorSegments: KiwiSectorSegment[];
  duration: number; // in seconds
}

export interface KiwiSectorSegment {
  guarantee: unknown | null;
  segment: KiwiSegment;
  layover: KiwiLayover | null;
}

export interface KiwiSegment {
  id: string;
  source: KiwiLocation;
  destination: KiwiLocation;
  duration: number; // in seconds
  type: string; // "FLIGHT"
  code: string; // flight number
  carrier: KiwiSegmentCarrier;
  operatingCarrier: KiwiSegmentCarrier;
  cabinClass: string;
  hiddenDestination: unknown | null;
  throwawayDestination: unknown | null;
}

export interface KiwiLocation {
  localTime: string; // ISO datetime
  utcTime: string; // ISO datetime
  station: KiwiStation;
}

export interface KiwiStation {
  id: string;
  legacyId: string; // IATA code
  name: string;
  code: string; // IATA code
  type: string; // "AIRPORT"
  gps: { lat: number; lng: number };
  city: KiwiCity;
  country: { code: string; id: string };
}

export interface KiwiCity {
  legacyId: string;
  name: string;
  id: string;
}

export interface KiwiSegmentCarrier {
  id: string;
  name: string;
  code: string;
}

export interface KiwiLayover {
  duration: number; // in seconds
  isBaggageRecheck: boolean;
  isWalkingDistance: boolean;
  transferDuration: number;
  transferType: string;
}

export interface KiwiStopover {
  nightsCount: number;
  arrival: {
    type: string;
    city: { name: string; id: string };
    id: string;
  };
  departure: {
    type: string;
    id: string;
  };
  duration: number;
}
