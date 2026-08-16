import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  FlightProvider,
  PricePoint,
  SurfaceQuery,
} from './flight-provider.interface';

/**
 * SerpApi's Google Flights calendar engine, as the surface's fallback and
 * cross-check ($0.025/call — the budget ledger keeps it honest). Precise
 * search via SerpApi is deliberately NOT implemented in M1: Kiwi is the
 * precise tier, and paying SerpApi for itineraries only makes sense once
 * the orchestrator can prove Kiwi came up empty (M2 decides that).
 *
 * Unset SERPAPI_KEY = unconfigured = skipped, same pattern as the rest.
 */

/** The calendar grid rows; only what we read. */
export interface SerpCalendarRow {
  departure: string; // YYYY-MM-DD
  return?: string;
  price?: number;
}

export function mapCalendarRows(
  rows: SerpCalendarRow[],
  query: SurfaceQuery,
  observedAt: string,
): PricePoint[] {
  return rows
    .filter((row) => Number.isFinite(row.price) && (row.price as number) > 0)
    .filter((row) => (query.roundTrip ? Boolean(row.return) : true))
    .map((row) => ({
      origin: query.origin,
      destination: query.destination,
      departureDate: row.departure,
      returnDate: row.return ?? null,
      price: row.price as number,
      currency: 'USD',
      provider: 'serpapi' as const,
      observedAt,
      isEstimate: true,
    }));
}

/** Days in the queried month, clamped to the future (past days can't fly). */
export function monthDateRange(
  month: string,
  today: string,
): { from: string; to: string } | null {
  const [y, m] = month.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const from = month; // YYYY-MM-01
  const to = `${month.slice(0, 8)}${String(last).padStart(2, '0')}`;
  if (to < today) return null;
  return { from: from < today ? today : from, to };
}

@Injectable()
export class SerpapiProvider implements FlightProvider {
  readonly name = 'serpapi' as const;
  readonly costPerCall = 0.025;
  private readonly logger = new Logger(SerpapiProvider.name);

  constructor(private readonly configService: ConfigService) {}

  private get apiKey(): string | undefined {
    return this.configService.get<string>('SERPAPI_KEY');
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  async getPriceSurface(query: SurfaceQuery): Promise<PricePoint[]> {
    if (!this.isConfigured()) return [];

    const today = new Date().toISOString().slice(0, 10);
    const range = monthDateRange(query.month, today);
    if (!range) return [];

    const params = new URLSearchParams({
      engine: 'google_flights_calendar',
      departure_id: query.origin,
      arrival_id: query.destination,
      outbound_date: range.from,
      outbound_date_end: range.to,
      type: query.roundTrip ? '1' : '2',
      currency: 'USD',
      api_key: this.apiKey!,
    });

    try {
      const response = await fetch(`https://serpapi.com/search.json?${params}`);
      if (!response.ok) {
        this.logger.warn(`calendar ${response.status} for ${query.origin}-${query.destination}`);
        return [];
      }
      const body = (await response.json()) as {
        calendar?: { departure: string; return?: string; flight_prices?: { price: number }[] }[];
      };
      const rows: SerpCalendarRow[] = (body.calendar ?? []).map((cell) => ({
        departure: cell.departure,
        return: cell.return,
        price: cell.flight_prices?.[0]?.price,
      }));
      return mapCalendarRows(rows, query, new Date().toISOString());
    } catch (error) {
      this.logger.warn(`calendar failed: ${(error as Error).message}`);
      return [];
    }
  }
}
