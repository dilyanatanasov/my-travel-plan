import { Injectable } from '@nestjs/common';
import { FlightResultDto } from '../dto/flight-result.dto';
import { SearchFlightsDto } from '../dto/search-flights.dto';
import { ApiKeyManagerService } from '../services/api-key-manager.service';
import { FlightSearchService } from '../services/flight-search.service';
import {
  FlightProvider,
  PreciseQuery,
} from './flight-provider.interface';

/**
 * Kiwi as the precise tier. Deliberately a thin adapter over the existing
 * FlightSearchService rather than an extraction: the legacy /flights/search
 * endpoint keeps working untouched, the battle-tested Kiwi transform stays
 * where it is, and the funnel talks to the same code through the provider
 * interface. (The plan's "extract HTTP + transform" is satisfied at the
 * seam, not by moving 400 lines that already work.)
 */
@Injectable()
export class KiwiProvider implements FlightProvider {
  readonly name = 'kiwi' as const;
  // Pro tier: $5 / 20k requests.
  readonly costPerCall = 0.00025;

  constructor(
    private readonly flightSearchService: FlightSearchService,
    private readonly apiKeyManager: ApiKeyManagerService,
  ) {}

  isConfigured(): boolean {
    return this.apiKeyManager.hasAvailableKey();
  }

  async searchPrecise(query: PreciseQuery): Promise<FlightResultDto[]> {
    if (!this.isConfigured()) return [];
    const dto: SearchFlightsDto = {
      origin: query.origin,
      destination: query.destination,
      departureDate: query.departureDate,
      returnDate: query.returnDate,
      passengers: query.passengers,
      cabinClass: query.cabinClass,
    };
    const result = await this.flightSearchService.searchFlights(dto);
    return result.results;
  }
}
