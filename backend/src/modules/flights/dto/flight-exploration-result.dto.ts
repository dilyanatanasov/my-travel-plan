import { DateType } from './flexible-search.dto';
import { FlightLegDto, CarrierDto, SafetyWarning } from './flight-result.dto';

// Re-export for convenience
export { FlightLegDto, CarrierDto };

/**
 * A single flight option in the exploration results
 */
export interface ExplorationFlightOptionDto {
  id: string;

  // Dates
  departureDate: string; // YYYY-MM-DD
  returnDate: string; // YYYY-MM-DD
  nightsAtDestination: number;
  dateLabel: string; // "Dec 13-15 (Fri-Sun)"

  // Journey details
  outbound: FlightLegDto;
  return?: FlightLegDto;

  // Pricing
  totalPrice: number;
  currency: string;
  pricePerPerson: number;

  // Booking
  bookingUrl: string;

  // Scoring (0-100)
  score: number;
  scoreBreakdown: {
    price: number;
    duration: number;
    convenience: number;
  };

  // Flags
  isRecommended: boolean;
  isCheapest: boolean;
  isFastest: boolean;
  hasLongLayover: boolean; // >4 hours
  hasBannedCarrier: boolean;

  // Carriers involved
  carriers: CarrierDto[];

  // Safety
  safetyWarnings: {
    hasBannedCarrier: boolean;
    hasCautionCarrier: boolean;
    carriers: { code: string; name: string; warning: SafetyWarning }[];
  };
}

/**
 * Results grouped by departure date range
 */
export interface DateGroupDto {
  dateRange: string; // "Dec 8-15"
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  optionCount: number;
  lowestPrice: number;
  averagePrice: number;
  bestDurationMinutes: number;
  options: ExplorationFlightOptionDto[];
}

/**
 * Results grouped by connection hub/route
 */
export interface RouteGroupDto {
  routeDescription: string; // "via Istanbul" or "Direct"
  connectionAirports: string[]; // ["IST"] or []
  optionCount: number;
  lowestPrice: number;
  averageDurationMinutes: number;
  options: ExplorationFlightOptionDto[];
}

/**
 * Insight/tip for the user
 */
export interface InsightDto {
  type: 'recommendation' | 'tip' | 'warning' | 'price_trend';
  icon: string; // emoji
  title: string;
  message: string;
  relatedOptionIds?: string[];
}

/**
 * Price trend data point
 */
export interface PriceTrendDto {
  date: string; // YYYY-MM-DD
  lowestPrice: number;
  optionCount: number;
}

/**
 * Main exploration result response
 */
export interface FlightExplorationResultDto {
  searchId: string;

  // Echo search parameters
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

  // Highlights - best options
  highlights: {
    recommended: ExplorationFlightOptionDto | null;
    cheapest: ExplorationFlightOptionDto | null;
    fastest: ExplorationFlightOptionDto | null;
  };

  // Grouped results
  byDate: DateGroupDto[];
  byRoute: RouteGroupDto[];

  // All results (for filtering)
  allOptions: ExplorationFlightOptionDto[];

  // Insights
  insights: InsightDto[];

  // Price trend over the search period
  priceTrend: PriceTrendDto[];

  // Metadata
  meta: {
    totalOptionsFound: number;
    searchesPerformed: number;
    searchDurationMs: number;
    sampledDates: string[]; // dates that were actually searched
  };
}

/**
 * Progress update during search (for streaming/polling)
 */
export interface ExplorationProgressDto {
  searchId: string;
  status: 'searching' | 'aggregating' | 'complete' | 'error';
  progress: number; // 0-100
  searchesCompleted: number;
  searchesTotal: number;
  currentlySearching?: string; // "Dec 13-15"
  preliminaryResults?: {
    optionsFound: number;
    lowestPrice: number;
  };
}
