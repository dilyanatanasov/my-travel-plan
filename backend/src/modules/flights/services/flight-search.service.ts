import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SearchFlightsDto, CabinClass } from '../dto/search-flights.dto';
import { withAffiliate } from '../providers/affiliate.util';
import {
  FlightSearchResultDto,
  FlightResultDto,
  FlightLegDto,
  FlightSegmentDto,
  CarrierDto,
  LayoverDto,
  PricingOptionDto,
  FilterStatsDto,
} from '../dto/flight-result.dto';
import {
  KiwiSearchResponse,
  KiwiItinerary,
  KiwiSector,
  KiwiSectorSegment,
  KiwiSegmentCarrier,
} from '../interfaces/kiwi.interface';
import { SafetyService } from './safety.service';
import { ApiKeyManagerService } from './api-key-manager.service';

@Injectable()
export class FlightSearchService {
  private readonly logger = new Logger(FlightSearchService.name);

  constructor(
    private readonly safetyService: SafetyService,
    private readonly apiKeyManager: ApiKeyManagerService,
    private readonly configService: ConfigService,
  ) {}

  /** Kiwi booking links carry the Travelpayouts marker when one is set. */
  private branded(url: string): string {
    return withAffiliate(
      url,
      this.configService.get<string>('TRAVELPAYOUTS_MARKER'),
    );
  }

  async searchFlights(dto: SearchFlightsDto): Promise<FlightSearchResultDto> {
    if (!this.apiKeyManager.hasAvailableKey()) {
      throw new HttpException(
        'Flight search is not configured. Missing RAPIDAPI_KEY.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    try {
      // Map cabin class to Kiwi format
      const cabinClassMap: Record<CabinClass, string> = {
        [CabinClass.ECONOMY]: 'ECONOMY',
        [CabinClass.PREMIUM_ECONOMY]: 'PREMIUM_ECONOMY',
        [CabinClass.BUSINESS]: 'BUSINESS',
        [CabinClass.FIRST]: 'FIRST',
      };

      // Build query params for Kiwi API
      // Kiwi uses format like City:london_gb or airport:LGW
      const source = `airport:${dto.origin.toUpperCase()}`;
      const destination = `airport:${dto.destination.toUpperCase()}`;

      const params = new URLSearchParams({
        source,
        destination,
        departureDate: dto.departureDate, // YYYY-MM-DD format
        currency: 'usd',
        locale: 'en',
        adults: dto.passengers.toString(),
        children: '0',
        infants: '0',
        handbags: '1',
        holdbags: '0',
        cabinClass: cabinClassMap[dto.cabinClass],
        sortBy: 'QUALITY',
        sortOrder: 'ASCENDING',
        applyMixedClasses: 'true',
        allowReturnFromDifferentCity: 'false',
        allowChangeInboundDestination: 'false',
        allowChangeInboundSource: 'false',
        allowDifferentStationConnection: 'true',
        enableSelfTransfer: 'true',
        allowOvernightStopover: 'true',
        enableTrueHiddenCity: 'false',
        enableThrowAwayTicketing: 'false',
        transportTypes: 'FLIGHT',
        limit: '50',
      });

      // Add return date for round-trip
      if (dto.returnDate) {
        params.append('returnDate', dto.returnDate);
      }

      // Determine endpoint based on trip type
      const isRoundTrip = !!dto.returnDate;
      const endpoint = isRoundTrip ? 'round-trip' : 'one-way';

      const url = `https://${this.apiKeyManager.getHost()}/${endpoint}?${params.toString()}`;

      this.logger.log(
        `Searching flights: ${dto.origin} -> ${dto.destination} (${endpoint})`,
      );

      // Use API key manager with automatic rotation
      const response = await this.apiKeyManager.fetchWithRotation(url, {
        method: 'GET',
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`Kiwi API error: ${response.status} - ${errorText}`);
        throw new HttpException(
          'Failed to search flights. Please try again later.',
          HttpStatus.BAD_GATEWAY,
        );
      }

      const data: KiwiSearchResponse = await response.json();

      if (!data.itineraries || data.itineraries.length === 0) {
        return this.createEmptyResult(dto);
      }

      return this.transformResponse(data, dto);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error('Flight search error:', error);
      throw new HttpException(
        'Failed to search flights. Please try again later.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private transformResponse(
    response: KiwiSearchResponse,
    dto: SearchFlightsDto,
  ): FlightSearchResultDto {
    const results: FlightResultDto[] = [];

    for (const itinerary of response.itineraries) {
      try {
        const result = this.transformItinerary(itinerary);
        if (result) {
          results.push(result);
        }
      } catch (error) {
        this.logger.warn(
          `Failed to transform itinerary ${itinerary.id}:`,
          error,
        );
      }
    }

    // Sort by lowest price
    results.sort((a, b) => a.lowestPrice - b.lowestPrice);

    return {
      searchId: response.itineraries[0]?.legacyId || '',
      origin: dto.origin.toUpperCase(),
      destination: dto.destination.toUpperCase(),
      departureDate: dto.departureDate,
      returnDate: dto.returnDate,
      passengers: dto.passengers,
      cabinClass: dto.cabinClass,
      results,
      totalResults: results.length,
      filterStats: this.calculateFilterStats(results),
    };
  }

  private transformItinerary(itinerary: KiwiItinerary): FlightResultDto | null {
    // One-way flights use 'sector', round-trips use 'outbound/inbound'
    const outboundSector = itinerary.outbound || itinerary.sector;
    if (!outboundSector) {
      return null;
    }

    const outboundLeg = this.transformSector(outboundSector);
    if (!outboundLeg) {
      return null;
    }

    let returnLeg: FlightLegDto | undefined;
    if (itinerary.inbound) {
      returnLeg = this.transformSector(itinerary.inbound) || undefined;
    }

    const pricingOptions = this.transformPricingOptions(itinerary);
    if (pricingOptions.length === 0) {
      return null;
    }

    const lowestPrice = Math.min(...pricingOptions.map((p) => p.price));
    const allCarriers = [...outboundLeg.carriers];
    if (returnLeg) {
      allCarriers.push(...returnLeg.carriers);
    }

    // Deduplicate carriers
    const uniqueCarriers = allCarriers.reduce(
      (acc, carrier) => {
        if (!acc.find((c) => c.code === carrier.code)) {
          acc.push(carrier);
        }
        return acc;
      },
      [] as CarrierDto[],
    );

    const safetyWarnings = {
      hasBannedCarrier: uniqueCarriers.some((c) => c.safetyWarning === 'banned'),
      hasCautionCarrier: uniqueCarriers.some(
        (c) => c.safetyWarning === 'caution',
      ),
      carriers: uniqueCarriers
        .filter((c) => c.safetyWarning !== 'safe')
        .map((c) => ({
          code: c.code,
          name: c.name,
          warning: c.safetyWarning,
        })),
    };

    return {
      itineraryId: itinerary.id,
      outboundLeg,
      returnLeg,
      totalDurationMinutes:
        outboundLeg.durationMinutes + (returnLeg?.durationMinutes || 0),
      totalStops: outboundLeg.stopCount + (returnLeg?.stopCount || 0),
      pricingOptions,
      lowestPrice,
      currency: 'USD',
      safetyWarnings,
    };
  }

  private transformSector(sector: KiwiSector): FlightLegDto | null {
    if (!sector.sectorSegments || sector.sectorSegments.length === 0) {
      return null;
    }

    const segments = sector.sectorSegments
      .map((ss) => this.transformSegment(ss))
      .filter((s): s is FlightSegmentDto => s !== null);

    if (segments.length === 0) {
      return null;
    }

    const layovers = this.calculateLayovers(sector.sectorSegments);
    const carriers = this.extractCarriers(sector.sectorSegments);

    const firstSegment = sector.sectorSegments[0].segment;
    const lastSegment =
      sector.sectorSegments[sector.sectorSegments.length - 1].segment;

    return {
      legId: sector.id,
      departureAirport: firstSegment.source.station.code,
      departureAirportName: firstSegment.source.station.name,
      arrivalAirport: lastSegment.destination.station.code,
      arrivalAirportName: lastSegment.destination.station.name,
      departureTime: firstSegment.source.utcTime,
      arrivalTime: lastSegment.destination.utcTime,
      durationMinutes: Math.round(sector.duration / 60), // Kiwi returns seconds
      stopCount: segments.length - 1,
      segments,
      layovers,
      carriers,
    };
  }

  private transformSegment(
    sectorSegment: KiwiSectorSegment,
  ): FlightSegmentDto | null {
    const segment = sectorSegment.segment;
    if (!segment) {
      return null;
    }

    return {
      segmentId: segment.id,
      flightNumber: `${segment.carrier.code}${segment.code}`,
      departureAirport: segment.source.station.code,
      departureAirportName: segment.source.station.name,
      arrivalAirport: segment.destination.station.code,
      arrivalAirportName: segment.destination.station.name,
      departureTime: segment.source.utcTime,
      arrivalTime: segment.destination.utcTime,
      durationMinutes: Math.round(segment.duration / 60), // Kiwi returns seconds
      marketingCarrier: this.transformCarrier(segment.carrier),
      operatingCarrier: this.transformCarrier(segment.operatingCarrier),
      cabinClass: segment.cabinClass,
    };
  }

  private transformCarrier(carrier: KiwiSegmentCarrier): CarrierDto {
    const code = carrier?.code || 'Unknown';
    const name = carrier?.name || 'Unknown Airline';

    // Check airline against banned list
    const safetyCheck = this.safetyService.checkAirlineSafety(code, undefined, name);

    return {
      code,
      name,
      logoUrl: undefined, // Kiwi doesn't provide logo URLs in segment data
      safetyWarning: safetyCheck.warning,
    };
  }

  private calculateLayovers(sectorSegments: KiwiSectorSegment[]): LayoverDto[] {
    const layovers: LayoverDto[] = [];

    for (let i = 0; i < sectorSegments.length - 1; i++) {
      const currentSegment = sectorSegments[i].segment;
      const nextSegment = sectorSegments[i + 1].segment;
      const layoverInfo = sectorSegments[i].layover;

      const arrivalTime = new Date(currentSegment.destination.utcTime).getTime();
      const departureTime = new Date(nextSegment.source.utcTime).getTime();
      const layoverMinutes = layoverInfo
        ? Math.round(layoverInfo.duration / 60)
        : Math.round((departureTime - arrivalTime) / 60000);

      layovers.push({
        airport: currentSegment.destination.station.code,
        airportName: currentSegment.destination.station.name,
        durationMinutes: layoverMinutes,
      });
    }

    return layovers;
  }

  private extractCarriers(sectorSegments: KiwiSectorSegment[]): CarrierDto[] {
    const carrierMap = new Map<string, CarrierDto>();

    for (const ss of sectorSegments) {
      const segment = ss.segment;
      if (segment.carrier && !carrierMap.has(segment.carrier.code)) {
        carrierMap.set(
          segment.carrier.code,
          this.transformCarrier(segment.carrier),
        );
      }
      if (
        segment.operatingCarrier &&
        !carrierMap.has(segment.operatingCarrier.code)
      ) {
        carrierMap.set(
          segment.operatingCarrier.code,
          this.transformCarrier(segment.operatingCarrier),
        );
      }
    }

    return Array.from(carrierMap.values()).filter((c) => c.code !== 'Unknown');
  }

  private transformPricingOptions(itinerary: KiwiItinerary): PricingOptionDto[] {
    const options: PricingOptionDto[] = [];

    // Main price from itinerary
    const mainPrice = parseFloat(itinerary.price.amount);
    if (!isNaN(mainPrice)) {
      // Get booking URL from booking options
      const bookingUrl =
        itinerary.bookingOptions?.edges?.[0]?.node?.bookingUrl || '';
      const deepLink = this.branded(
        bookingUrl.startsWith('http')
          ? bookingUrl
          : `https://www.kiwi.com${bookingUrl}`,
      );

      options.push({
        price: mainPrice,
        currency: 'USD',
        agentName: itinerary.provider?.name || 'Kiwi.com',
        agentLogoUrl: undefined,
        deepLink,
        cabinClass: this.extractCabinClass(itinerary),
        fareFamily: undefined,
      });
    }

    // Add additional booking options if available
    if (itinerary.bookingOptions?.edges) {
      for (const edge of itinerary.bookingOptions.edges.slice(1)) {
        const node = edge.node;
        const price = parseFloat(node.price.amount);
        if (!isNaN(price) && price !== mainPrice) {
          const deepLink = this.branded(
            node.bookingUrl.startsWith('http')
              ? node.bookingUrl
              : `https://www.kiwi.com${node.bookingUrl}`,
          );

          options.push({
            price,
            currency: 'USD',
            agentName: node.itineraryProvider?.name || 'Kiwi.com',
            agentLogoUrl: undefined,
            deepLink,
            cabinClass: this.extractCabinClass(itinerary),
            fareFamily: undefined,
          });
        }
      }
    }

    return options.sort((a, b) => a.price - b.price);
  }

  private extractCabinClass(itinerary: KiwiItinerary): string | undefined {
    const firstSegment = itinerary.outbound?.sectorSegments?.[0]?.segment;
    return firstSegment?.cabinClass;
  }

  private calculateFilterStats(results: FlightResultDto[]): FilterStatsDto {
    if (results.length === 0) {
      return {
        minPrice: 0,
        maxPrice: 0,
        minDuration: 0,
        maxDuration: 0,
        airlines: [],
        stopCounts: [],
      };
    }

    const prices = results.map((r) => r.lowestPrice);
    const durations = results.map((r) => r.outboundLeg.durationMinutes);

    // Count airlines
    const airlineCount = new Map<string, { name: string; count: number }>();
    for (const result of results) {
      for (const carrier of result.outboundLeg.carriers) {
        const existing = airlineCount.get(carrier.code);
        if (existing) {
          existing.count++;
        } else {
          airlineCount.set(carrier.code, { name: carrier.name, count: 1 });
        }
      }
    }

    // Count stops
    const stopsCount = new Map<number, number>();
    for (const result of results) {
      const stops = result.outboundLeg.stopCount;
      stopsCount.set(stops, (stopsCount.get(stops) || 0) + 1);
    }

    return {
      minPrice: Math.min(...prices),
      maxPrice: Math.max(...prices),
      minDuration: Math.min(...durations),
      maxDuration: Math.max(...durations),
      airlines: Array.from(airlineCount.entries())
        .map(([code, data]) => ({ code, name: data.name, count: data.count }))
        .sort((a, b) => b.count - a.count),
      stopCounts: Array.from(stopsCount.entries())
        .map(([stops, count]) => ({ stops, count }))
        .sort((a, b) => a.stops - b.stops),
    };
  }

  private createEmptyResult(dto: SearchFlightsDto): FlightSearchResultDto {
    return {
      searchId: '',
      origin: dto.origin.toUpperCase(),
      destination: dto.destination.toUpperCase(),
      departureDate: dto.departureDate,
      returnDate: dto.returnDate,
      passengers: dto.passengers,
      cabinClass: dto.cabinClass,
      results: [],
      totalResults: 0,
      filterStats: {
        minPrice: 0,
        maxPrice: 0,
        minDuration: 0,
        maxDuration: 0,
        airlines: [],
        stopCounts: [],
      },
    };
  }
}
