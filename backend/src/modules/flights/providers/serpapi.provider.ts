import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  FlightLegDto,
  FlightResultDto,
} from '../dto/flight-result.dto';
import { CabinClass } from '../dto/search-flights.dto';
import {
  FlightProvider,
  PreciseQuery,
  PricePoint,
  SurfaceQuery,
} from './flight-provider.interface';
import { kiwiDeepLink, withAffiliate } from './affiliate.util';

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

/** SerpApi's google_flights option rows; only what we read. */
export interface SerpFlightOption {
  flights: {
    departure_airport: { id: string; name?: string; time: string };
    arrival_airport: { id: string; name?: string; time: string };
    duration: number; // minutes
    airline?: string;
    flight_number?: string;
    travel_class?: string;
  }[];
  layovers?: { id: string; name?: string; duration: number }[];
  total_duration: number; // minutes, this direction
  price?: number; // round-trip total when type=1
}

/**
 * One Google Flights option → one result. Single-call simplification
 * (2026-08-16, after Kiwi's API died): the response describes the OUTBOUND
 * with a round-trip total price; the return options would cost a second
 * call per result via departure_token, which the free tier cannot afford.
 * So returnLeg stays undefined, durations compare outbound-to-outbound —
 * consistent within a search — and the booking button is the affiliate
 * Kiwi deep link for the exact dates.
 */
export function mapGoogleFlights(
  options: SerpFlightOption[],
  query: PreciseQuery,
  deepLink: string,
  limit = 8,
): FlightResultDto[] {
  return options.slice(0, limit).flatMap((option, index) => {
    const segments = option.flights ?? [];
    if (segments.length === 0 || !Number.isFinite(option.price)) return [];
    const first = segments[0];
    const last = segments[segments.length - 1];

    const carriers = [
      ...new Map(
        segments.map((segment) => {
          const name = segment.airline ?? 'Unknown airline';
          const code = segment.flight_number?.split(' ')[0] ?? name.slice(0, 2);
          return [code, { code, name, safetyWarning: 'safe' as const }];
        }),
      ).values(),
    ];

    const outboundLeg: FlightLegDto = {
      legId: `serp-${index}-${query.departureDate}`,
      departureAirport: first.departure_airport.id,
      departureAirportName: first.departure_airport.name ?? first.departure_airport.id,
      arrivalAirport: last.arrival_airport.id,
      arrivalAirportName: last.arrival_airport.name ?? last.arrival_airport.id,
      departureTime: first.departure_airport.time,
      arrivalTime: last.arrival_airport.time,
      durationMinutes: option.total_duration,
      stopCount: segments.length - 1,
      segments: [],
      layovers: (option.layovers ?? []).map((layover) => ({
        airport: layover.id,
        airportName: layover.name ?? layover.id,
        durationMinutes: layover.duration,
      })),
      carriers,
    };

    return [
      {
        itineraryId: `serp:${query.departureDate}:${index}`,
        outboundLeg,
        returnLeg: undefined,
        totalDurationMinutes: option.total_duration,
        totalStops: outboundLeg.stopCount,
        pricingOptions: [
          {
            price: option.price!,
            currency: 'USD',
            agentName: 'Kiwi.com',
            deepLink,
            cabinClass: undefined,
            fareFamily: undefined,
          },
        ],
        lowestPrice: option.price!,
        currency: 'USD',
        safetyWarnings: {
          hasBannedCarrier: false,
          hasCautionCarrier: false,
          carriers: [],
        },
      } satisfies FlightResultDto,
    ];
  });
}

const TRAVEL_CLASS: Record<CabinClass, string> = {
  [CabinClass.ECONOMY]: '1',
  [CabinClass.PREMIUM_ECONOMY]: '2',
  [CabinClass.BUSINESS]: '3',
  [CabinClass.FIRST]: '4',
};

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

  async searchPrecise(query: PreciseQuery): Promise<FlightResultDto[]> {
    if (!this.isConfigured()) return [];

    const params = new URLSearchParams({
      engine: 'google_flights',
      departure_id: query.origin,
      arrival_id: query.destination,
      outbound_date: query.departureDate,
      type: query.returnDate ? '1' : '2',
      adults: String(query.passengers),
      travel_class: TRAVEL_CLASS[query.cabinClass],
      currency: 'USD',
      api_key: this.apiKey!,
    });
    if (query.returnDate) params.set('return_date', query.returnDate);

    try {
      const response = await fetch(`https://serpapi.com/search.json?${params}`);
      if (!response.ok) {
        this.logger.warn(
          `google_flights ${response.status} for ${query.origin}-${query.destination}`,
        );
        return [];
      }
      const body = (await response.json()) as {
        best_flights?: SerpFlightOption[];
        other_flights?: SerpFlightOption[];
      };
      const deepLink = withAffiliate(
        kiwiDeepLink(
          query.origin,
          query.destination,
          query.departureDate,
          query.returnDate,
        ),
        this.configService.get<string>('TRAVELPAYOUTS_MARKER'),
      );
      return mapGoogleFlights(
        [...(body.best_flights ?? []), ...(body.other_flights ?? [])],
        query,
        deepLink,
      );
    } catch (error) {
      this.logger.warn(`google_flights failed: ${(error as Error).message}`);
      return [];
    }
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
