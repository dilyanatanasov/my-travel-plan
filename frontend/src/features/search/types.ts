import type { Alpha2 } from '../../types';

/*
  These shapes mirror Travelpayouts' /v2/prices/month-matrix response
  semantics on purpose: one row per destination and month, holding whatever
  days the cache happens to know about. When the real provider is wired in
  (after deployment, per D3), the fixture module is swapped for an API slice
  and everything above this layer keeps working.
*/

/** One observed fare: the cheapest price someone recently saw for a day. */
export interface PriceDay {
  /** ISO date of the outbound departure. */
  departDate: string;
  /** Total price in EUR. Indicative — from a cache of other users' searches. */
  value: number;
  /** When the price was observed. Drives the freshness label. */
  foundAt: string;
}

/** A destination's known prices for one month, possibly sparse or empty. */
export interface DestinationPrices {
  iata: string;
  city: string;
  countryName: string;
  countryIso2: Alpha2;
  continent: string;
  /** "YYYY-MM". */
  month: string;
  /** Sorted by departDate. Missing days are simply absent — thin routes. */
  days: PriceDay[];
}

/** A card-ready row: one unvisited country, cheapest known fare first. */
export interface DiscoveryRow {
  iata: string;
  city: string;
  countryName: string;
  countryIso2: Alpha2;
  continent: string;
  cheapest: PriceDay;
  /** How many days of the month have any price at all. */
  pricedDayCount: number;
  daysInMonth: number;
  days: PriceDay[];
}

export type DiscoverySort = 'price' | 'region' | 'name';
