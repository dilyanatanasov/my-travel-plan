import { FlightResultDto } from '../dto/flight-result.dto';
import { CabinClass } from '../dto/search-flights.dto';

/**
 * Search v2 provider abstraction (M1, plan
 * context/plan/2026-08-11_smart-trip-search_plan.md).
 *
 * The funnel is two-tier: a cheap, cached PRICE SURFACE (which dates look
 * cheap at all — Travelpayouts month-matrix, SerpApi calendar) feeding a
 * PRECISE tier (real bookable itineraries — Kiwi, SerpApi). Providers
 * implement whichever tiers they have; the orchestrator composes them and
 * pays per call through the budget ledger.
 */

export type ProviderName = 'travelpayouts' | 'kiwi' | 'serpapi';

/** One observed price for a date (pair). The surface's unit of truth. */
export interface PricePoint {
  origin: string;
  destination: string;
  departureDate: string; // YYYY-MM-DD
  returnDate: string | null;
  price: number;
  currency: string;
  provider: ProviderName;
  observedAt: string; // ISO
  /** Cached/aggregated numbers are estimates, never quotes. */
  isEstimate: boolean;
}

export interface SurfaceQuery {
  origin: string;
  destination: string;
  /** First day of the month to survey, YYYY-MM-01. */
  month: string;
  /** Round-trip surfaces only return pairs with a return date. */
  roundTrip: boolean;
}

export interface PreciseQuery {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string;
  passengers: number;
  cabinClass: CabinClass;
}

export interface FlightProvider {
  readonly name: ProviderName;
  /** Estimated $ per upstream call, for the spend ledger. */
  readonly costPerCall: number;
  /** False when the provider's credentials are absent — skip, don't fail. */
  isConfigured(): boolean;
  getPriceSurface?(query: SurfaceQuery): Promise<PricePoint[]>;
  searchPrecise?(query: PreciseQuery): Promise<FlightResultDto[]>;
}
