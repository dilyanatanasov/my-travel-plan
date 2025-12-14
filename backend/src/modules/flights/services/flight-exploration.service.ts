import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { FlexibleSearchDto, DateType } from '../dto/flexible-search.dto';
import { CabinClass } from '../dto/search-flights.dto';
import {
  FlightExplorationResultDto,
  ExplorationFlightOptionDto,
  DateGroupDto,
  RouteGroupDto,
  InsightDto,
  PriceTrendDto,
  FlightLegDto,
} from '../dto/flight-exploration-result.dto';
import { FlightResultDto, FlightSearchResultDto, CarrierDto } from '../dto/flight-result.dto';
import { DateSamplingService, DateSample } from './date-sampling.service';
import { HubService } from './hub.service';
import { SafetyService } from './safety.service';
import { ApiKeyManagerService } from './api-key-manager.service';
import { Hub } from '../data/hubs';
import {
  KiwiSearchResponse,
  KiwiItinerary,
  KiwiSector,
  KiwiSectorSegment,
} from '../interfaces/kiwi.interface';

interface OneWayFlight {
  legId: string;
  origin: string;
  destination: string;
  departureDate: string;
  departureTime: string;
  arrivalTime: string;
  durationMinutes: number;
  stopCount: number;
  price: number;
  carriers: CarrierDto[];
  bookingUrl: string;
  leg: FlightLegDto;
}

interface CombinedRoute {
  outboundToHub: OneWayFlight;
  hubToDestination: OneWayFlight;
  returnFromDestination: OneWayFlight;
  returnFromHub: OneWayFlight;
  hub: string;
  totalPrice: number;
  totalDurationOutbound: number;
  totalDurationReturn: number;
}

@Injectable()
export class FlightExplorationService {
  private readonly logger = new Logger(FlightExplorationService.name);

  private readonly MAX_CONCURRENT = 3;
  private readonly DELAY_BETWEEN_BATCHES_MS = 300;

  constructor(
    private readonly dateSamplingService: DateSamplingService,
    private readonly hubService: HubService,
    private readonly safetyService: SafetyService,
    private readonly apiKeyManager: ApiKeyManagerService,
  ) {}

  async explore(dto: FlexibleSearchDto): Promise<FlightExplorationResultDto> {
    const startTime = Date.now();

    if (!this.apiKeyManager.hasAvailableKey()) {
      throw new HttpException(
        'Flight search is not configured. Missing RAPIDAPI_KEY.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    // 1. Generate date samples
    const samples = this.dateSamplingService.generateDateSamples(dto);
    this.logger.log(`Generated ${samples.length} date samples for exploration`);

    if (samples.length === 0) {
      throw new HttpException(
        'Could not generate date samples from the provided criteria',
        HttpStatus.BAD_REQUEST,
      );
    }

    // 2. Get relevant hubs for this route
    const hubs = this.hubService.getRelevantHubs(
      dto.origin,
      dto.destination,
      dto.preferredHubs,
      dto.excludeHubs,
      5, // max 5 hubs to search
    );

    this.logger.log(`Searching through ${hubs.length} hubs: ${hubs.map(h => h.code).join(', ')}`);

    // 3. Search through hubs for each date sample
    const allOptions: ExplorationFlightOptionDto[] = [];
    let searchesPerformed = 0;

    // Reduce samples for hub search (each date requires many API calls)
    const reducedSamples = this.reduceSamplesForHubSearch(samples, 4);

    for (const sample of reducedSamples) {
      const options = await this.searchDateWithHubs(dto, sample, hubs);
      allOptions.push(...options);
      searchesPerformed += hubs.length * 4; // 4 searches per hub (out+return for each leg)
    }

    this.logger.log(`Found ${allOptions.length} flight options through hub search`);

    // 4. Score and rank
    const scoredOptions = this.scoreAndRank(allOptions);

    // 5. Identify highlights
    const highlights = this.identifyHighlights(scoredOptions);

    // 6. Group results
    const byDate = this.groupByDate(scoredOptions);
    const byRoute = this.groupByRoute(scoredOptions);

    // 7. Generate insights
    const insights = this.generateInsights(scoredOptions, byDate, byRoute, hubs);

    // 8. Calculate price trend
    const priceTrend = this.calculatePriceTrend(scoredOptions);

    const searchDurationMs = Date.now() - startTime;
    this.logger.log(`Exploration completed in ${searchDurationMs}ms with ${scoredOptions.length} options`);

    return {
      searchId: this.generateSearchId(),
      origin: dto.origin.toUpperCase(),
      destination: dto.destination.toUpperCase(),
      dateType: dto.dateType,
      dateRange: this.getDateRange(dto, samples),
      duration: {
        minNights: dto.minNights || 0,
        maxNights: dto.maxNights || 0,
      },
      passengers: dto.passengers,
      highlights,
      byDate,
      byRoute,
      allOptions: scoredOptions,
      insights,
      priceTrend,
      meta: {
        totalOptionsFound: scoredOptions.length,
        searchesPerformed,
        searchDurationMs,
        sampledDates: reducedSamples.map((s) => s.departureDate),
      },
    };
  }

  private reduceSamplesForHubSearch(samples: DateSample[], maxSamples: number): DateSample[] {
    if (samples.length <= maxSamples) return samples;

    // Pick evenly distributed samples
    const step = samples.length / maxSamples;
    const reduced: DateSample[] = [];
    for (let i = 0; i < maxSamples; i++) {
      reduced.push(samples[Math.floor(i * step)]);
    }
    return reduced;
  }

  private async searchDateWithHubs(
    dto: FlexibleSearchDto,
    sample: DateSample,
    hubs: Hub[],
  ): Promise<ExplorationFlightOptionDto[]> {
    const options: ExplorationFlightOptionDto[] = [];

    for (const hub of hubs) {
      try {
        const hubOptions = await this.searchViaHub(dto, sample, hub);
        options.push(...hubOptions);
      } catch (error) {
        this.logger.warn(`Failed to search via ${hub.code}: ${error.message}`);
      }

      // Delay between hub searches
      await this.delay(this.DELAY_BETWEEN_BATCHES_MS);
    }

    return options;
  }

  private async searchViaHub(
    dto: FlexibleSearchDto,
    sample: DateSample,
    hub: Hub,
  ): Promise<ExplorationFlightOptionDto[]> {
    this.logger.log(`Searching ${dto.origin} -> ${hub.code} -> ${dto.destination} for ${sample.departureDate}`);

    // Search all 4 legs in parallel
    const [originToHub, hubToDestination, destinationToHub, hubToOrigin] = await Promise.all([
      this.searchOneWay(dto.origin, hub.code, sample.departureDate, dto),
      this.searchOneWay(hub.code, dto.destination, sample.departureDate, dto),
      this.searchOneWay(dto.destination, hub.code, sample.returnDate, dto),
      this.searchOneWay(hub.code, dto.origin, sample.returnDate, dto),
    ]);

    this.logger.log(`Hub ${hub.code}: ${dto.origin}->${hub.code}: ${originToHub.length} flights, ${hub.code}->${dto.destination}: ${hubToDestination.length} flights`);
    this.logger.log(`Hub ${hub.code}: ${dto.destination}->${hub.code}: ${destinationToHub.length} flights, ${hub.code}->${dto.origin}: ${hubToOrigin.length} flights`);

    if (originToHub.length > 0 && hubToDestination.length > 0) {
      this.logger.log(`First ${dto.origin}->${hub.code}: depart ${originToHub[0].departureTime}, arrive ${originToHub[0].arrivalTime}`);
      this.logger.log(`First ${hub.code}->${dto.destination}: depart ${hubToDestination[0].departureTime}, arrive ${hubToDestination[0].arrivalTime}`);
    }

    // Combine compatible flights
    return this.combineHubFlights(
      originToHub,
      hubToDestination,
      destinationToHub,
      hubToOrigin,
      hub,
      sample,
      dto,
    );
  }

  private async searchOneWay(
    origin: string,
    destination: string,
    date: string,
    dto: FlexibleSearchDto,
  ): Promise<OneWayFlight[]> {
    const cabinClassMap: Record<CabinClass, string> = {
      [CabinClass.ECONOMY]: 'ECONOMY',
      [CabinClass.PREMIUM_ECONOMY]: 'PREMIUM_ECONOMY',
      [CabinClass.BUSINESS]: 'BUSINESS',
      [CabinClass.FIRST]: 'FIRST',
    };

    const params = new URLSearchParams({
      source: `airport:${origin.toUpperCase()}`,
      destination: `airport:${destination.toUpperCase()}`,
      departureDate: date,
      currency: 'usd',
      locale: 'en',
      adults: dto.passengers.toString(),
      children: '0',
      infants: '0',
      handbags: '1',
      holdbags: '0',
      cabinClass: cabinClassMap[dto.cabinClass],
      sortBy: 'PRICE',
      sortOrder: 'ASCENDING',
      applyMixedClasses: 'true',
      allowDifferentStationConnection: 'true',
      enableSelfTransfer: 'true',
      allowOvernightStopover: 'true',
      transportTypes: 'FLIGHT',
      limit: '30', // Request more results to find flights on the requested dates
    });

    const url = `https://${this.apiKeyManager.getHost()}/one-way?${params.toString()}`;

    this.logger.log(`One-way URL: ${url.substring(0, 150)}...`);

    try {
      // Use API key manager with automatic rotation
      const response = await this.apiKeyManager.fetchWithRotation(url, {
        method: 'GET',
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.warn(`API error ${response.status} for ${origin}->${destination}: ${errorText.substring(0, 200)}`);
        return [];
      }

      const data: KiwiSearchResponse = await response.json();

      // Log raw response info
      if (!data.itineraries || data.itineraries.length === 0) {
        this.logger.log(`No itineraries for ${origin}->${destination} on ${date}`);
      } else {
        this.logger.log(`Got ${data.itineraries.length} itineraries for ${origin}->${destination}`);
      }

      const flights = this.transformToOneWayFlights(data, origin, destination, date);
      return flights; // Return all flights - we'll match by connection time in combineHubFlights
    } catch (error) {
      this.logger.warn(`One-way search ${origin}->${destination} failed: ${(error as Error).message}`);
      return [];
    }
  }

  private transformToOneWayFlights(
    response: KiwiSearchResponse,
    origin: string,
    destination: string,
    date: string,
  ): OneWayFlight[] {
    if (!response.itineraries) return [];

    const flights: OneWayFlight[] = [];
    // Note: The Kiwi API returns flights sorted by price, not by date.
    // We accept all flights and let the combination logic validate dates/durations.

    for (const itinerary of response.itineraries) {
      try {
        const sector = itinerary.sector || itinerary.outbound;
        if (!sector) continue;

        const leg = this.transformSector(sector);
        if (!leg) continue;

        const price = parseFloat(itinerary.price.amount);
        if (isNaN(price)) continue;

        const actualDepartureDate = new Date(leg.departureTime);
        const bookingUrl = itinerary.bookingOptions?.edges?.[0]?.node?.bookingUrl || '';
        const actualDateStr = actualDepartureDate.toISOString().split('T')[0];

        flights.push({
          legId: itinerary.id,
          origin,
          destination,
          departureDate: actualDateStr,
          departureTime: leg.departureTime,
          arrivalTime: leg.arrivalTime,
          durationMinutes: leg.durationMinutes,
          stopCount: leg.stopCount,
          price,
          carriers: leg.carriers,
          bookingUrl: bookingUrl.startsWith('http') ? bookingUrl : `https://www.kiwi.com${bookingUrl}`,
          leg,
        });
      } catch (error) {
        // Skip malformed itineraries
      }
    }

    this.logger.log(`${origin}->${destination}: ${flights.length} flights returned`);
    return flights;
  }

  private combineHubFlights(
    originToHub: OneWayFlight[],
    hubToDestination: OneWayFlight[],
    destinationToHub: OneWayFlight[],
    hubToOrigin: OneWayFlight[],
    hub: Hub,
    sample: DateSample,
    dto: FlexibleSearchDto,
  ): ExplorationFlightOptionDto[] {
    const options: ExplorationFlightOptionDto[] = [];
    const minConnection = hub.minConnectionMinutes;

    // Log combination attempt
    this.logger.log(`Combining via ${hub.code}: ${originToHub.length}x${hubToDestination.length} outbound, ${destinationToHub.length}x${hubToOrigin.length} return`);

    // Find valid outbound combinations (same-day or next-day connections at hub)
    const validOutboundPairs: { leg1: OneWayFlight; leg2: OneWayFlight; connectionMinutes: number }[] = [];

    for (const leg1 of originToHub) {
      for (const leg2 of hubToDestination) {
        const connectionMinutes = this.getConnectionMinutes(leg1.arrivalTime, leg2.departureTime);
        // Valid connection: min time to 24 hours (allow overnight)
        if (connectionMinutes >= minConnection && connectionMinutes <= 1440) {
          validOutboundPairs.push({ leg1, leg2, connectionMinutes });
        }
      }
    }

    this.logger.log(`Found ${validOutboundPairs.length} valid outbound pairs for ${hub.code}`);

    if (validOutboundPairs.length === 0) {
      // Log why no pairs found
      if (originToHub.length > 0 && hubToDestination.length > 0) {
        const sample1 = originToHub[0];
        const sample2 = hubToDestination[0];
        this.logger.log(`Sample connection: arrive ${sample1.arrivalTime} -> depart ${sample2.departureTime} = ${this.getConnectionMinutes(sample1.arrivalTime, sample2.departureTime).toFixed(0)} min`);
      }
      return [];
    }

    // Find valid return combinations
    const validReturnPairs: { leg3: OneWayFlight; leg4: OneWayFlight; connectionMinutes: number }[] = [];

    for (const leg3 of destinationToHub) {
      for (const leg4 of hubToOrigin) {
        const connectionMinutes = this.getConnectionMinutes(leg3.arrivalTime, leg4.departureTime);
        if (connectionMinutes >= minConnection && connectionMinutes <= 1440) {
          validReturnPairs.push({ leg3, leg4, connectionMinutes });
        }
      }
    }

    this.logger.log(`Found ${validReturnPairs.length} valid return pairs for ${hub.code}`);

    if (validReturnPairs.length === 0) {
      return [];
    }

    // Combine outbound and return - but only if outbound arrives before return departs
    let checkedCombinations = 0;
    let rejectedNegativeStay = 0;
    let rejectedTooShort = 0;
    let rejectedTooLong = 0;

    for (const outbound of validOutboundPairs.slice(0, 15)) { // Limit to top 15 outbound
      for (const returnPair of validReturnPairs.slice(0, 15)) { // Limit to top 15 return
        checkedCombinations++;
        // Check that return is after arrival at destination + min nights
        const arriveDestination = new Date(outbound.leg2.arrivalTime);
        const departDestination = new Date(returnPair.leg3.departureTime);
        const stayMinutes = (departDestination.getTime() - arriveDestination.getTime()) / (1000 * 60);
        const stayDays = stayMinutes / (60 * 24);

        // Must have at least minNights at destination (or 1 day minimum)
        const minStay = (dto.minNights || 1) * 24 * 60;
        const maxStay = ((dto.maxNights || 30) + 1) * 24 * 60; // +1 day buffer

        if (stayMinutes < 0) {
          rejectedNegativeStay++;
          continue; // Return departs before arrival - invalid
        }
        if (stayMinutes < minStay) {
          rejectedTooShort++;
          continue;
        }
        if (stayMinutes > maxStay) {
          rejectedTooLong++;
          continue;
        }

        // Valid combination found!
        if (options.length === 0) {
          this.logger.log(`First valid trip via ${hub.code}: arrive dest ${outbound.leg2.arrivalTime}, depart ${returnPair.leg3.departureTime}, stay ${stayDays.toFixed(1)} days`);
        }

        const option = this.createCombinedOption(
          outbound.leg1, outbound.leg2, returnPair.leg3, returnPair.leg4,
          hub, sample, dto,
          outbound.connectionMinutes, returnPair.connectionMinutes,
        );
        options.push(option);

        if (options.length >= 10) break; // Limit per hub
      }
      if (options.length >= 10) break;
    }

    this.logger.log(`${hub.code} combinations: ${checkedCombinations} checked, ${rejectedNegativeStay} negative stay, ${rejectedTooShort} too short, ${rejectedTooLong} too long`);
    this.logger.log(`Created ${options.length} complete options via ${hub.code}`);
    return options.sort((a, b) => a.totalPrice - b.totalPrice).slice(0, 10);
  }

  private getConnectionMinutes(arrivalTime: string, departureTime: string): number {
    const arrival = new Date(arrivalTime);
    const departure = new Date(departureTime);
    return (departure.getTime() - arrival.getTime()) / (1000 * 60);
  }

  private createCombinedOption(
    leg1: OneWayFlight,
    leg2: OneWayFlight,
    leg3: OneWayFlight,
    leg4: OneWayFlight,
    hub: Hub,
    sample: DateSample,
    dto: FlexibleSearchDto,
    outboundConnectionMinutes: number,
    returnConnectionMinutes: number,
  ): ExplorationFlightOptionDto {
    const totalPrice = leg1.price + leg2.price + leg3.price + leg4.price;
    const outboundDuration = leg1.durationMinutes + outboundConnectionMinutes + leg2.durationMinutes;
    const returnDuration = leg3.durationMinutes + returnConnectionMinutes + leg4.durationMinutes;

    // Create combined outbound leg
    const outboundLeg: FlightLegDto = {
      legId: `${leg1.legId}-${leg2.legId}`,
      departureAirport: leg1.leg.departureAirport,
      departureAirportName: leg1.leg.departureAirportName,
      arrivalAirport: leg2.leg.arrivalAirport,
      arrivalAirportName: leg2.leg.arrivalAirportName,
      departureTime: leg1.departureTime,
      arrivalTime: leg2.arrivalTime,
      durationMinutes: outboundDuration,
      stopCount: leg1.stopCount + 1 + leg2.stopCount, // +1 for hub
      segments: [...leg1.leg.segments, ...leg2.leg.segments],
      layovers: [
        ...leg1.leg.layovers,
        {
          airport: hub.code,
          airportName: hub.name,
          durationMinutes: Math.round(outboundConnectionMinutes),
        },
        ...leg2.leg.layovers,
      ],
      carriers: this.mergeCarriers(leg1.carriers, leg2.carriers),
    };

    // Create combined return leg
    const returnLeg: FlightLegDto = {
      legId: `${leg3.legId}-${leg4.legId}`,
      departureAirport: leg3.leg.departureAirport,
      departureAirportName: leg3.leg.departureAirportName,
      arrivalAirport: leg4.leg.arrivalAirport,
      arrivalAirportName: leg4.leg.arrivalAirportName,
      departureTime: leg3.departureTime,
      arrivalTime: leg4.arrivalTime,
      durationMinutes: returnDuration,
      stopCount: leg3.stopCount + 1 + leg4.stopCount,
      segments: [...leg3.leg.segments, ...leg4.leg.segments],
      layovers: [
        ...leg3.leg.layovers,
        {
          airport: hub.code,
          airportName: hub.name,
          durationMinutes: Math.round(returnConnectionMinutes),
        },
        ...leg4.leg.layovers,
      ],
      carriers: this.mergeCarriers(leg3.carriers, leg4.carriers),
    };

    const allCarriers = this.mergeCarriers(outboundLeg.carriers, returnLeg.carriers);
    const hasLongLayover = outboundConnectionMinutes > 240 || returnConnectionMinutes > 240;
    const hasBannedCarrier = allCarriers.some(c => c.safetyWarning === 'banned');

    // Use actual flight dates, not sample dates
    const actualDepartureDate = leg1.departureDate;
    const actualReturnDate = leg3.departureDate;
    const arriveDestination = new Date(leg2.arrivalTime);
    const departDestination = new Date(leg3.departureTime);
    const actualNightsAtDestination = Math.round(
      (departDestination.getTime() - arriveDestination.getTime()) / (1000 * 60 * 60 * 24)
    );

    return {
      id: `hub_${hub.code}_${leg1.legId}_${leg2.legId}_${leg3.legId}_${leg4.legId}`,
      departureDate: actualDepartureDate,
      returnDate: actualReturnDate,
      nightsAtDestination: actualNightsAtDestination,
      dateLabel: `${actualDepartureDate} - ${actualReturnDate}`,
      outbound: outboundLeg,
      return: returnLeg,
      totalPrice,
      currency: 'USD',
      pricePerPerson: totalPrice / dto.passengers,
      bookingUrl: '', // Multiple bookings needed - leave empty
      score: 0,
      scoreBreakdown: { price: 0, duration: 0, convenience: 0 },
      isRecommended: false,
      isCheapest: false,
      isFastest: false,
      hasLongLayover,
      hasBannedCarrier,
      carriers: allCarriers,
      safetyWarnings: {
        hasBannedCarrier,
        hasCautionCarrier: allCarriers.some(c => c.safetyWarning === 'caution'),
        carriers: allCarriers
          .filter(c => c.safetyWarning !== 'safe')
          .map(c => ({ code: c.code, name: c.name, warning: c.safetyWarning })),
      },
    };
  }

  private mergeCarriers(carriers1: CarrierDto[], carriers2: CarrierDto[]): CarrierDto[] {
    const map = new Map<string, CarrierDto>();
    for (const c of [...carriers1, ...carriers2]) {
      if (!map.has(c.code)) {
        map.set(c.code, c);
      }
    }
    return Array.from(map.values());
  }

  private transformSector(sector: KiwiSector): FlightLegDto | null {
    if (!sector.sectorSegments || sector.sectorSegments.length === 0) {
      return null;
    }

    const segments = sector.sectorSegments
      .map((ss) => this.transformSegment(ss))
      .filter((s) => s !== null);

    if (segments.length === 0) return null;

    const firstSegment = sector.sectorSegments[0].segment;
    const lastSegment = sector.sectorSegments[sector.sectorSegments.length - 1].segment;
    const carriers = this.extractCarriers(sector.sectorSegments);

    return {
      legId: sector.id,
      departureAirport: firstSegment.source.station.code,
      departureAirportName: firstSegment.source.station.name,
      arrivalAirport: lastSegment.destination.station.code,
      arrivalAirportName: lastSegment.destination.station.name,
      departureTime: firstSegment.source.utcTime,
      arrivalTime: lastSegment.destination.utcTime,
      durationMinutes: Math.round(sector.duration / 60),
      stopCount: segments.length - 1,
      segments,
      layovers: this.calculateLayovers(sector.sectorSegments),
      carriers,
    };
  }

  private transformSegment(sectorSegment: KiwiSectorSegment) {
    const segment = sectorSegment.segment;
    if (!segment) return null;

    return {
      segmentId: segment.id,
      flightNumber: `${segment.carrier.code}${segment.code}`,
      departureAirport: segment.source.station.code,
      departureAirportName: segment.source.station.name,
      arrivalAirport: segment.destination.station.code,
      arrivalAirportName: segment.destination.station.name,
      departureTime: segment.source.utcTime,
      arrivalTime: segment.destination.utcTime,
      durationMinutes: Math.round(segment.duration / 60),
      marketingCarrier: this.transformCarrier(segment.carrier),
      operatingCarrier: this.transformCarrier(segment.operatingCarrier),
      cabinClass: segment.cabinClass,
    };
  }

  private transformCarrier(carrier: { code: string; name: string }): CarrierDto {
    const code = carrier?.code || 'Unknown';
    const name = carrier?.name || 'Unknown Airline';
    const safetyCheck = this.safetyService.checkAirlineSafety(code, undefined, name);
    return { code, name, safetyWarning: safetyCheck.warning };
  }

  private extractCarriers(sectorSegments: KiwiSectorSegment[]): CarrierDto[] {
    const carrierMap = new Map<string, CarrierDto>();
    for (const ss of sectorSegments) {
      const segment = ss.segment;
      if (segment.carrier && !carrierMap.has(segment.carrier.code)) {
        carrierMap.set(segment.carrier.code, this.transformCarrier(segment.carrier));
      }
    }
    return Array.from(carrierMap.values());
  }

  private calculateLayovers(sectorSegments: KiwiSectorSegment[]) {
    const layovers = [];
    for (let i = 0; i < sectorSegments.length - 1; i++) {
      const currentSegment = sectorSegments[i].segment;
      const layoverInfo = sectorSegments[i].layover;
      const layoverMinutes = layoverInfo ? Math.round(layoverInfo.duration / 60) : 0;
      layovers.push({
        airport: currentSegment.destination.station.code,
        airportName: currentSegment.destination.station.name,
        durationMinutes: layoverMinutes,
      });
    }
    return layovers;
  }

  private scoreAndRank(options: ExplorationFlightOptionDto[]): ExplorationFlightOptionDto[] {
    if (options.length === 0) return [];

    const prices = options.map((o) => o.totalPrice);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const priceRange = maxPrice - minPrice || 1;

    const durations = options.map((o) => o.outbound.durationMinutes);
    const minDuration = Math.min(...durations);
    const maxDuration = Math.max(...durations);
    const durationRange = maxDuration - minDuration || 1;

    const scored = options.map((option) => {
      const priceScore = 100 - ((option.totalPrice - minPrice) / priceRange) * 100;
      const durationScore = 100 - ((option.outbound.durationMinutes - minDuration) / durationRange) * 100;

      let convenienceScore = 100;
      convenienceScore -= option.outbound.stopCount * 10;
      convenienceScore -= (option.return?.stopCount || 0) * 10;
      if (option.hasLongLayover) convenienceScore -= 15;
      if (option.hasBannedCarrier) convenienceScore -= 50;
      convenienceScore = Math.max(0, convenienceScore);

      const overallScore = priceScore * 0.4 + durationScore * 0.35 + convenienceScore * 0.25;

      return {
        ...option,
        score: Math.round(overallScore),
        scoreBreakdown: {
          price: Math.round(priceScore),
          duration: Math.round(durationScore),
          convenience: Math.round(convenienceScore),
        },
      };
    });

    return scored.sort((a, b) => b.score - a.score);
  }

  private identifyHighlights(options: ExplorationFlightOptionDto[]) {
    if (options.length === 0) {
      return { recommended: null, cheapest: null, fastest: null };
    }

    const recommended = { ...options[0], isRecommended: true };
    const cheapestOption = options.reduce((min, opt) => opt.totalPrice < min.totalPrice ? opt : min);
    const cheapest = { ...cheapestOption, isCheapest: true };
    const fastestOption = options.reduce((min, opt) => opt.outbound.durationMinutes < min.outbound.durationMinutes ? opt : min);
    const fastest = { ...fastestOption, isFastest: true };

    options.forEach((opt) => {
      if (opt.id === recommended.id) opt.isRecommended = true;
      if (opt.id === cheapest.id) opt.isCheapest = true;
      if (opt.id === fastest.id) opt.isFastest = true;
    });

    return { recommended, cheapest, fastest };
  }

  private groupByDate(options: ExplorationFlightOptionDto[]): DateGroupDto[] {
    const groups = new Map<string, ExplorationFlightOptionDto[]>();

    for (const option of options) {
      const date = new Date(option.departureDate);
      const weekStart = this.getWeekStart(date);
      const key = weekStart.toISOString().split('T')[0];
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(option);
    }

    return Array.from(groups.entries())
      .map(([startDate, groupOptions]) => {
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 6);
        const prices = groupOptions.map((o) => o.totalPrice);
        const durations = groupOptions.map((o) => o.outbound.durationMinutes);

        return {
          dateRange: this.formatWeekRange(new Date(startDate), endDate),
          startDate,
          endDate: endDate.toISOString().split('T')[0],
          optionCount: groupOptions.length,
          lowestPrice: Math.min(...prices),
          averagePrice: prices.reduce((a, b) => a + b, 0) / prices.length,
          bestDurationMinutes: Math.min(...durations),
          options: groupOptions.sort((a, b) => a.totalPrice - b.totalPrice),
        };
      })
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
  }

  private groupByRoute(options: ExplorationFlightOptionDto[]): RouteGroupDto[] {
    const groups = new Map<string, ExplorationFlightOptionDto[]>();

    for (const option of options) {
      // Get hub from layovers (the main connection point)
      const hubs = option.outbound.layovers.map((l) => l.airport);
      const key = hubs.length === 0 ? 'direct' : hubs.join('-');
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(option);
    }

    return Array.from(groups.entries())
      .map(([key, groupOptions]) => {
        const connectionAirports = key === 'direct' ? [] : key.split('-');
        const routeDescription = connectionAirports.length === 0 ? 'Direct' : `via ${connectionAirports.join(', ')}`;
        const prices = groupOptions.map((o) => o.totalPrice);
        const durations = groupOptions.map((o) => o.outbound.durationMinutes);

        return {
          routeDescription,
          connectionAirports,
          optionCount: groupOptions.length,
          lowestPrice: Math.min(...prices),
          averageDurationMinutes: durations.reduce((a, b) => a + b, 0) / durations.length,
          options: groupOptions.sort((a, b) => a.totalPrice - b.totalPrice),
        };
      })
      .sort((a, b) => a.lowestPrice - b.lowestPrice);
  }

  private generateInsights(
    options: ExplorationFlightOptionDto[],
    byDate: DateGroupDto[],
    byRoute: RouteGroupDto[],
    hubs: Hub[],
  ): InsightDto[] {
    const insights: InsightDto[] = [];

    if (options.length === 0) {
      insights.push({
        type: 'warning',
        icon: '🔍',
        title: 'No flights found',
        message: `We searched through ${hubs.length} connection hubs but couldn't find suitable combinations. Try different dates or a longer date range.`,
      });
      return insights;
    }

    // Hubs searched
    insights.push({
      type: 'tip',
      icon: '🌐',
      title: 'Hubs searched',
      message: `Found ${options.length} options via ${hubs.map(h => h.city).join(', ')}.`,
    });

    // Best route insight
    if (byRoute.length > 1) {
      const bestRoute = byRoute[0];
      insights.push({
        type: 'recommendation',
        icon: '✈️',
        title: `Best route: ${bestRoute.routeDescription}`,
        message: `${bestRoute.optionCount} flights from $${bestRoute.lowestPrice.toFixed(0)}, avg ${Math.round(bestRoute.averageDurationMinutes / 60)}h travel time.`,
      });
    }

    // Price range
    const prices = options.map((o) => o.totalPrice);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    if (maxPrice > minPrice * 1.3) {
      insights.push({
        type: 'tip',
        icon: '💰',
        title: 'Price varies by route',
        message: `Prices range from $${minPrice.toFixed(0)} to $${maxPrice.toFixed(0)}. Compare different connection hubs!`,
      });
    }

    return insights;
  }

  private calculatePriceTrend(options: ExplorationFlightOptionDto[]): PriceTrendDto[] {
    const byDate = new Map<string, number[]>();
    for (const option of options) {
      if (!byDate.has(option.departureDate)) byDate.set(option.departureDate, []);
      byDate.get(option.departureDate)!.push(option.totalPrice);
    }

    return Array.from(byDate.entries())
      .map(([date, prices]) => ({
        date,
        lowestPrice: Math.min(...prices),
        optionCount: prices.length,
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }

  private getDateRange(dto: FlexibleSearchDto, samples: DateSample[]): { from: string; to: string } {
    if (dto.dateType === DateType.SPECIFIC) {
      return { from: dto.departureDate || '', to: dto.returnDate || dto.departureDate || '' };
    }
    if (dto.dateType === DateType.MONTH && dto.month) {
      const [year, month] = dto.month.split('-').map(Number);
      const firstDay = new Date(year, month - 1, 1);
      const lastDay = new Date(year, month, 0);
      return { from: firstDay.toISOString().split('T')[0], to: lastDay.toISOString().split('T')[0] };
    }
    return { from: dto.dateRangeStart || '', to: dto.dateRangeEnd || '' };
  }

  private getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  }

  private formatWeekRange(start: Date, end: Date): string {
    const startMonth = start.toLocaleDateString('en-US', { month: 'short' });
    const endMonth = end.toLocaleDateString('en-US', { month: 'short' });
    if (startMonth === endMonth) return `${startMonth} ${start.getDate()}-${end.getDate()}`;
    return `${startMonth} ${start.getDate()} - ${endMonth} ${end.getDate()}`;
  }

  private generateSearchId(): string {
    return `exp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
