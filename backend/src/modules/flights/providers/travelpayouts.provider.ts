import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  FlightProvider,
  PricePoint,
  SurfaceQuery,
} from './flight-provider.interface';

/**
 * Travelpayouts Data API v2 month-matrix: cached aggregate prices for a
 * whole month in one free call — the price surface's workhorse.
 *
 * Everything here is an ESTIMATE by definition (aggregated bookings data,
 * hours-to-days old), which is exactly what a surface needs and exactly
 * what may never be shown as a bookable quote. Unset TRAVELPAYOUTS_TOKEN
 * = provider reports unconfigured and the orchestrator skips it — the
 * MailService unset-env pattern.
 */

/** The month-matrix rows the API returns; only what we read. */
export interface TpMatrixRow {
  depart_date: string;
  return_date?: string;
  value: number;
  found_at?: string;
}

export function mapMatrixRows(
  rows: TpMatrixRow[],
  query: SurfaceQuery,
  observedAt: string,
): PricePoint[] {
  return rows
    .filter((row) => Number.isFinite(row.value) && row.value > 0)
    .filter((row) => (query.roundTrip ? Boolean(row.return_date) : true))
    .map((row) => ({
      origin: query.origin,
      destination: query.destination,
      departureDate: row.depart_date,
      returnDate: row.return_date ?? null,
      price: row.value,
      currency: 'USD',
      provider: 'travelpayouts' as const,
      observedAt: row.found_at ?? observedAt,
      isEstimate: true,
    }));
}

@Injectable()
export class TravelpayoutsProvider implements FlightProvider {
  readonly name = 'travelpayouts' as const;
  readonly costPerCall = 0; // free tier of the Data API
  private readonly logger = new Logger(TravelpayoutsProvider.name);

  constructor(private readonly configService: ConfigService) {}

  private get token(): string | undefined {
    return this.configService.get<string>('TRAVELPAYOUTS_TOKEN');
  }

  isConfigured(): boolean {
    return Boolean(this.token);
  }

  async getPriceSurface(query: SurfaceQuery): Promise<PricePoint[]> {
    if (!this.isConfigured()) return [];

    const params = new URLSearchParams({
      currency: 'usd',
      origin: query.origin,
      destination: query.destination,
      month: query.month,
      show_to_affiliates: 'false',
      token: this.token!,
    });
    const url = `https://api.travelpayouts.com/v2/prices/month-matrix?${params}`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        this.logger.warn(`month-matrix ${response.status} for ${query.origin}-${query.destination}`);
        return [];
      }
      const body = (await response.json()) as { data?: TpMatrixRow[] };
      return mapMatrixRows(body.data ?? [], query, new Date().toISOString());
    } catch (error) {
      // A dead surface provider degrades the search, never fails it.
      this.logger.warn(`month-matrix failed: ${(error as Error).message}`);
      return [];
    }
  }
}
