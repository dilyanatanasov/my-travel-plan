import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { FlightJourney } from './entities/flight-journey.entity';
import { FlightLeg, type TravelMode } from './entities/flight-leg.entity';
import { Airport } from '../airports/entities/airport.entity';
import { City } from '../cities/entities/city.entity';
import { CreateFlightDto, type TravelStopDto } from './dto/create-flight.dto';
import { UpdateFlightDto } from './dto/update-flight.dto';
import type { ImportJourneyDto, ImportResultDto } from './dto/import-flights.dto';
import { calculateAirportDistance } from '../../common/utils/haversine';
import { splitChainAtGroundTransfers } from './flight-chain.util';
import { VisitsService } from '../visits/visits.service';
import { VisitType } from '../visits/entities/visit.entity';

@Injectable()
export class FlightsService {
  constructor(
    @InjectRepository(FlightJourney)
    private readonly journeyRepository: Repository<FlightJourney>,
    @InjectRepository(FlightLeg)
    private readonly legRepository: Repository<FlightLeg>,
    @InjectRepository(Airport)
    private readonly airportRepository: Repository<Airport>,
    @InjectRepository(City)
    private readonly cityRepository: Repository<City>,
    private readonly visitsService: VisitsService,
  ) {}

  async findAll(userId: number): Promise<FlightJourney[]> {
    return this.journeyRepository.find({
      where: { userId },
      relations: ['legs', 'legs.departureAirport', 'legs.arrivalAirport'],
      // sortIndex breaks same-date ties (user-controlled, ASC = plays
      // first); it is unique per user's rows, so createdAt is not needed.
      order: { journeyDate: 'DESC', sortIndex: 'ASC' },
    });
  }

  async findOne(userId: number, id: number): Promise<FlightJourney> {
    const journey = await this.journeyRepository.findOne({
      where: { id, userId },
      relations: ['legs', 'legs.departureAirport', 'legs.arrivalAirport'],
    });
    if (!journey) {
      // 404 rather than 403 - do not confirm that another user's row exists.
      throw new NotFoundException(`Flight journey with ID ${id} not found`);
    }
    return journey;
  }

  async create(
    userId: number,
    createFlightDto: CreateFlightDto,
  ): Promise<FlightJourney> {
    // Mixed-mode chain (land travel): its own path - endpoints may be
    // cities and the ground-transfer splitter does not apply, because the
    // user declared what each hop was.
    if (createFlightDto.stops && createFlightDto.stops.length >= 2) {
      return this.createMixed(userId, createFlightDto);
    }

    // Build legs from either explicit legs or airportIds chain
    let legData: { departureAirportId: number; arrivalAirportId: number }[] = [];

    if (createFlightDto.legs && createFlightDto.legs.length > 0) {
      legData = createFlightDto.legs;
    } else if (createFlightDto.airportIds && createFlightDto.airportIds.length >= 2) {
      // Convert chain of airport IDs to legs
      for (let i = 0; i < createFlightDto.airportIds.length - 1; i++) {
        legData.push({
          departureAirportId: createFlightDto.airportIds[i],
          arrivalAirportId: createFlightDto.airportIds[i + 1],
        });
      }
    } else {
      throw new BadRequestException(
        'Must provide either legs array or airportIds array with at least 2 airports',
      );
    }

    // If round trip, add reverse legs
    if (createFlightDto.isRoundTrip) {
      const reverseLegs = [...legData].reverse().map((leg) => ({
        departureAirportId: leg.arrivalAirportId,
        arrivalAirportId: leg.departureAirportId,
      }));
      legData = [...legData, ...reverseLegs];
    }

    // Validate all airports exist and get their data for distance calculation
    const airportIds = new Set<number>();
    legData.forEach((leg) => {
      airportIds.add(leg.departureAirportId);
      airportIds.add(leg.arrivalAirportId);
    });

    const airports = await this.airportRepository.findByIds([...airportIds]);
    const airportMap = new Map(airports.map((a) => [a.id, a]));

    if (airports.length !== airportIds.size) {
      throw new BadRequestException('One or more airports not found');
    }

    // Split the chain at ground transfers - see flight-chain.util.ts, where
    // the rules live and are tested.
    const segments = splitChainAtGroundTransfers(legData, airportMap);
    if (segments.length === 0) {
      throw new BadRequestException(
        'Every hop in this chain is a ground transfer - nothing to record as a flight',
      );
    }

    // A split round trip is not a round trip: each segment is one-way.
    const isRoundTrip =
      segments.length === 1 && (createFlightDto.isRoundTrip || false);

    let firstJourneyId: number | null = null;
    for (const [segmentIndex, segment] of segments.entries()) {
      const journey = this.journeyRepository.create({
        userId,
        // The entered date belongs to the first segment; the ones after a
        // ground transfer happened later, on a date we do not know. Copying
        // it would assert a history the user never entered (same rule the
        // replay follows for undated journeys).
        journeyDate:
          segmentIndex === 0 && createFlightDto.journeyDate
            ? new Date(createFlightDto.journeyDate)
            : null,
        datePrecision:
          segmentIndex === 0 && createFlightDto.journeyDate
            ? (createFlightDto.datePrecision ?? 'day')
            : 'day',
        isRoundTrip,
        notes: createFlightDto.notes || null,
      });
      const savedJourney = await this.journeyRepository.save(journey);
      firstJourneyId ??= savedJourney.id;
      // sortIndex = own id: monotonic creation order without a counter
      // table. Reordering later swaps values between two rows.
      await this.journeyRepository.update(savedJourney.id, {
        sortIndex: savedJourney.id,
      });

      const legs: FlightLeg[] = [];
      for (let i = 0; i < segment.length; i++) {
        const departureAirport = airportMap.get(segment[i].departureAirportId)!;
        const arrivalAirport = airportMap.get(segment[i].arrivalAirportId)!;

        const distance = calculateAirportDistance(
          departureAirport,
          arrivalAirport,
        );

        legs.push(
          this.legRepository.create({
            journeyId: savedJourney.id,
            legOrder: i + 1,
            departureAirportId: segment[i].departureAirportId,
            arrivalAirportId: segment[i].arrivalAirportId,
            distanceKm: distance,
          }),
        );
      }

      await this.legRepository.save(legs);

      // Auto-create visits for countries in this segment
      await this.createVisitsFromLegs(
        userId,
        legs,
        airportMap,
        savedJourney.id,
        createFlightDto.journeyDate,
      );
    }

    // Return the first journey; splitInto is additive so clients that don't
    // know about it see a plain journey, and the form can explain the split.
    const first = await this.findOne(userId, firstJourneyId!);
    return Object.assign(first, {
      splitInto: segments.length > 1 ? segments.length : undefined,
    });
  }

  /**
   * Resolve a stops chain to its airports and cities, validating shape:
   * each stop exactly one endpoint kind, every id real, every flight hop
   * between airports (planes do not land in city centres), no zero-length
   * hops. Returns everything the leg builder and the visits pass need.
   */
  private async resolveStops(
    stops: TravelStopDto[],
    modes: TravelMode[],
  ): Promise<{
    airportById: Map<number, Airport>;
    cityById: Map<number, City>;
    pointOf: (stop: TravelStopDto) => {
      latitude: number;
      longitude: number;
      countryIso: string | null;
    };
  }> {
    for (const stop of stops) {
      const kinds =
        Number(stop.airportId != null) + Number(stop.cityId != null);
      if (kinds !== 1) {
        throw new BadRequestException(
          'Each stop must be exactly one of: an airport or a city',
        );
      }
    }
    if (modes.length !== stops.length - 1) {
      throw new BadRequestException('Provide one travel mode per hop');
    }
    for (let i = 0; i < stops.length - 1; i++) {
      if (
        modes[i] === 'flight' &&
        (stops[i].airportId == null || stops[i + 1].airportId == null)
      ) {
        throw new BadRequestException(
          'A flight hop needs airports at both ends - pick the nearest airport or change the mode',
        );
      }
      const sameAirport =
        stops[i].airportId != null &&
        stops[i].airportId === stops[i + 1].airportId;
      const sameCity =
        stops[i].cityId != null && stops[i].cityId === stops[i + 1].cityId;
      if (sameAirport || sameCity) {
        throw new BadRequestException('A hop needs two different places');
      }
    }

    const airportIds = [
      ...new Set(
        stops.flatMap((s) => (s.airportId != null ? [s.airportId] : [])),
      ),
    ];
    const cityIds = [
      ...new Set(stops.flatMap((s) => (s.cityId != null ? [s.cityId] : []))),
    ];
    const [airports, cities] = await Promise.all([
      airportIds.length
        ? this.airportRepository.findByIds(airportIds)
        : Promise.resolve<Airport[]>([]),
      cityIds.length
        ? this.cityRepository.findByIds(cityIds)
        : Promise.resolve<City[]>([]),
    ]);
    const airportById = new Map(airports.map((a) => [a.id, a]));
    const cityById = new Map(cities.map((c) => [c.id, c]));
    if (airportById.size !== airportIds.length) {
      throw new BadRequestException('One or more airports not found');
    }
    if (cityById.size !== cityIds.length) {
      throw new BadRequestException('One or more cities not found');
    }

    const pointOf = (stop: TravelStopDto) => {
      const place =
        stop.airportId != null
          ? airportById.get(stop.airportId)!
          : cityById.get(stop.cityId!)!;
      return {
        latitude: Number(place.latitude),
        longitude: Number(place.longitude),
        countryIso: place.countryIso ?? null,
      };
    };
    return { airportById, cityById, pointOf };
  }

  /**
   * The mixed-mode create (land travel, 2026-08-17): Varna -> Geneva by
   * plane, Geneva -> Basel by train, on to Colmar by car - one journey,
   * one leg per hop, each carrying its own mode. No ground-transfer
   * splitting here: that rule guards against typos in all-flight chains,
   * and a short hop the user labelled 'train' is the feature itself.
   */
  private async createMixed(
    userId: number,
    dto: CreateFlightDto,
  ): Promise<FlightJourney> {
    let chain = dto.stops!;
    let modes: TravelMode[] =
      dto.modes && dto.modes.length > 0
        ? [...dto.modes]
        : Array<TravelMode>(chain.length - 1).fill('flight');

    if (dto.isRoundTrip) {
      chain = [...chain, ...[...chain].reverse().slice(1)];
      modes = [...modes, ...[...modes].reverse()];
    }

    const { pointOf } = await this.resolveStops(chain, modes);

    const journey = this.journeyRepository.create({
      userId,
      journeyDate: dto.journeyDate ? new Date(dto.journeyDate) : null,
      datePrecision: dto.journeyDate ? (dto.datePrecision ?? 'day') : 'day',
      isRoundTrip: dto.isRoundTrip || false,
      notes: dto.notes || null,
    });
    const saved = await this.journeyRepository.save(journey);
    await this.journeyRepository.update(saved.id, { sortIndex: saved.id });

    const legs: FlightLeg[] = [];
    const countries = new Set<string>();
    for (let i = 0; i < chain.length - 1; i++) {
      const from = pointOf(chain[i]);
      const to = pointOf(chain[i + 1]);
      if (from.countryIso) countries.add(from.countryIso);
      if (to.countryIso) countries.add(to.countryIso);
      legs.push(
        this.legRepository.create({
          journeyId: saved.id,
          legOrder: i + 1,
          travelMode: modes[i],
          departureAirportId: chain[i].airportId ?? null,
          departureCityId: chain[i].cityId ?? null,
          arrivalAirportId: chain[i + 1].airportId ?? null,
          arrivalCityId: chain[i + 1].cityId ?? null,
          distanceKm: calculateAirportDistance(from, to),
        }),
      );
    }
    await this.legRepository.save(legs);
    await this.createVisitsForCountries(
      userId,
      countries,
      saved.id,
      dto.journeyDate,
    );
    return this.findOne(userId, saved.id);
  }

  /**
   * Swap the replay order of two journeys (user decision, 2026-08-14: no
   * hours on journeys - same-date order is adjusted by hand instead).
   *
   * Undated journeys may swap freely; dated ones only with the exact same
   * stored date (precision may differ - two journeys sharing a stored date
   * are ambiguous enough that either order is a legitimate claim). A
   * cross-date swap would silently rewrite chronology, so it is refused:
   * changing the date is the honest way to move a dated journey.
   */
  async reorder(userId: number, aId: number, bId: number): Promise<void> {
    if (aId === bId) {
      throw new BadRequestException('Pick two different journeys to reorder');
    }
    const [a, b] = await Promise.all([
      this.findOne(userId, aId),
      this.findOne(userId, bId),
    ]);

    // The date column arrives as a string or Date depending on the driver
    // path; normalise both to YYYY-MM-DD (or null) before comparing.
    const dateKey = (journey: FlightJourney): string | null =>
      journey.journeyDate
        ? new Date(journey.journeyDate).toISOString().slice(0, 10)
        : null;
    if (dateKey(a) !== dateKey(b)) {
      throw new BadRequestException(
        'Only journeys on the same date (or both undated) can be reordered',
      );
    }

    // One transaction so a crash cannot leave both rows with the same index.
    await this.journeyRepository.manager.transaction(async (manager) => {
      await manager.update(FlightJourney, a.id, { sortIndex: b.sortIndex });
      await manager.update(FlightJourney, b.id, { sortIndex: a.sortIndex });
    });
  }

  /**
   * Bulk import journeys given as IATA pairs.
   *
   * Codes are resolved here rather than trusted from the client, and every
   * journey goes through `create` so distances and the country visits it
   * derives are identical to a hand-entered flight - an import that produced
   * subtly different records would be worse than no import.
   *
   * Re-running the same file is safe: anything matching an existing date and
   * route is skipped rather than duplicated, because people re-export and
   * re-upload rather than tracking what they already loaded.
   */
  async importJourneys(
    userId: number,
    journeys: ImportJourneyDto[],
  ): Promise<ImportResultDto> {
    const result: ImportResultDto = { imported: 0, skipped: 0, failed: [] };

    // Resolve every distinct code in one query rather than per leg.
    const codes = new Set<string>();
    journeys.forEach((journey) =>
      journey.legs.forEach((leg) => {
        codes.add(leg.from.toUpperCase());
        codes.add(leg.to.toUpperCase());
      }),
    );

    const airports = await this.airportRepository.find({
      where: { iataCode: In([...codes]) },
    });
    const byCode = new Map(airports.map((a) => [a.iataCode.toUpperCase(), a]));

    // Signature of what the user already has, so a repeat import is a no-op.
    const existing = await this.journeyRepository.find({
      where: { userId },
      relations: ['legs', 'legs.departureAirport', 'legs.arrivalAirport'],
    });
    const signature = (date: string | null, route: string[]) =>
      `${date ?? 'undated'}|${route.join('>')}`;
    const seen = new Set(
      existing.map((journey) => {
        const legs = [...(journey.legs ?? [])].sort(
          (a, b) => a.legOrder - b.legOrder,
        );
        const route = legs.flatMap((leg, index) =>
          index === 0
            ? [leg.departureAirport?.iataCode ?? '', leg.arrivalAirport?.iataCode ?? '']
            : [leg.arrivalAirport?.iataCode ?? ''],
        );
        const date = journey.journeyDate
          ? new Date(journey.journeyDate).toISOString().slice(0, 10)
          : null;
        return signature(date, route);
      }),
    );

    for (const [index, journey] of journeys.entries()) {
      const route = journey.legs.flatMap((leg, i) =>
        i === 0 ? [leg.from.toUpperCase(), leg.to.toUpperCase()] : [leg.to.toUpperCase()],
      );
      const label = route.join(' → ');

      const unknown = route.find((code) => !byCode.has(code));
      if (unknown) {
        result.failed.push({
          row: index + 1,
          route: label,
          reason: `Unknown airport code ${unknown}`,
        });
        continue;
      }

      const key = signature(journey.date?.slice(0, 10) ?? null, route);
      if (seen.has(key)) {
        result.skipped += 1;
        continue;
      }

      try {
        await this.create(userId, {
          journeyDate: journey.date,
          notes: journey.notes,
          legs: journey.legs.map((leg) => ({
            departureAirportId: byCode.get(leg.from.toUpperCase())!.id,
            arrivalAirportId: byCode.get(leg.to.toUpperCase())!.id,
          })),
        });
        // Guards against duplicates *within* the same file, not just against
        // rows already in the database.
        seen.add(key);
        result.imported += 1;
      } catch (error) {
        result.failed.push({
          row: index + 1,
          route: label,
          reason: error instanceof Error ? error.message : 'Could not import',
        });
      }
    }

    return result;
  }

  /**
   * Create visit records for countries visited in this flight - every one
   * as a full visit ('trip'), never auto-transit.
   *
   * The old heuristic marked any arrive-then-depart country as transit,
   * which mislabelled every round trip's DESTINATION (VAR→BCN→VAR reads as
   * "passed through Spain"). Flying somewhere means you were there (user
   * decision, 2026-08-13); anyone who genuinely only changed planes demotes
   * the country to transit with one tap.
   */
  private async createVisitsFromLegs(
    userId: number,
    legs: FlightLeg[],
    airportMap: Map<number, Airport>,
    journeyId: number,
    journeyDate?: string,
  ): Promise<void> {
    const countries = new Set<string>();
    for (const leg of legs) {
      for (const airportId of [leg.departureAirportId, leg.arrivalAirportId]) {
        const iso = airportId != null
          ? airportMap.get(airportId)?.countryIso
          : null;
        if (iso) countries.add(iso);
      }
    }
    await this.createVisitsForCountries(
      userId,
      countries,
      journeyId,
      journeyDate,
    );
  }

  /** Being there counts, however you arrived: every touched country
      becomes a 'trip' visit, land legs the same as flights. */
  private async createVisitsForCountries(
    userId: number,
    countries: Set<string>,
    journeyId: number,
    journeyDate?: string,
  ): Promise<void> {
    for (const countryIso of countries) {
      await this.visitsService.createOrUpdateFromFlight(
        userId,
        countryIso,
        'trip' as VisitType,
        journeyId,
        journeyDate,
      );
    }
  }

  async update(
    userId: number,
    id: number,
    updateFlightDto: UpdateFlightDto,
  ): Promise<FlightJourney> {
    const journey = await this.findOne(userId, id);

    if (updateFlightDto.journeyDate !== undefined) {
      journey.journeyDate = updateFlightDto.journeyDate
        ? new Date(updateFlightDto.journeyDate)
        : null;
      // A cleared date has no precision worth keeping.
      if (!updateFlightDto.journeyDate) journey.datePrecision = 'day';
    }
    if (updateFlightDto.datePrecision !== undefined) {
      journey.datePrecision = updateFlightDto.datePrecision;
    }
    if (updateFlightDto.isRoundTrip !== undefined) {
      journey.isRoundTrip = updateFlightDto.isRoundTrip;
    }
    if (updateFlightDto.notes !== undefined) {
      journey.notes = updateFlightDto.notes;
    }

    /*
      Route editing: a new airport chain replaces the legs wholesale, with
      distances recomputed and auto-visits created for newly touched
      countries. Visits from the old route stay - they record where the
      user has been, which editing a typo does not undo (same policy as
      deleting a journey). Ground transfers are rejected rather than
      silently split: splitting an existing journey in place would have to
      invent a second journey mid-edit.
    */
    // Mixed-mode replacement chain, mirroring create's option 3. The two
    // shapes are exclusive; stops wins when both are somehow present.
    if (updateFlightDto.stops && updateFlightDto.stops.length >= 2) {
      const chain = updateFlightDto.stops;
      const modes: TravelMode[] =
        updateFlightDto.modes && updateFlightDto.modes.length > 0
          ? [...updateFlightDto.modes]
          : Array<TravelMode>(chain.length - 1).fill('flight');
      const { pointOf } = await this.resolveStops(chain, modes);

      const legs: FlightLeg[] = [];
      const countries = new Set<string>();
      for (let i = 0; i < chain.length - 1; i++) {
        const from = pointOf(chain[i]);
        const to = pointOf(chain[i + 1]);
        if (from.countryIso) countries.add(from.countryIso);
        if (to.countryIso) countries.add(to.countryIso);
        legs.push(
          this.legRepository.create({
            journeyId: id,
            legOrder: i + 1,
            travelMode: modes[i],
            departureAirportId: chain[i].airportId ?? null,
            departureCityId: chain[i].cityId ?? null,
            arrivalAirportId: chain[i + 1].airportId ?? null,
            arrivalCityId: chain[i + 1].cityId ?? null,
            distanceKm: calculateAirportDistance(from, to),
          }),
        );
      }
      await this.legRepository.delete({ journeyId: id });
      await this.legRepository.save(legs);
      await this.createVisitsForCountries(userId, countries, id, undefined);
    } else if (
      updateFlightDto.airportIds &&
      updateFlightDto.airportIds.length >= 2
    ) {
      const chain = updateFlightDto.airportIds;
      const airports = await this.airportRepository.findByIds([
        ...new Set(chain),
      ]);
      const airportMap = new Map(airports.map((a) => [a.id, a]));
      if (airportMap.size !== new Set(chain).size) {
        throw new BadRequestException('One or more airports not found');
      }

      const legs: FlightLeg[] = [];
      for (let i = 0; i < chain.length - 1; i++) {
        const from = airportMap.get(chain[i])!;
        const to = airportMap.get(chain[i + 1])!;
        const distance = calculateAirportDistance(from, to);
        if (chain[i] !== chain[i + 1] && distance < 100) {
          throw new BadRequestException(
            `${from.iataCode} to ${to.iataCode} looks like a ground transfer, not a flight - record the parts before and after it as separate journeys`,
          );
        }
        legs.push(
          this.legRepository.create({
            journeyId: id,
            legOrder: i + 1,
            departureAirportId: chain[i],
            arrivalAirportId: chain[i + 1],
            distanceKm: distance,
          }),
        );
      }

      await this.legRepository.delete({ journeyId: id });
      await this.legRepository.save(legs);
      await this.createVisitsFromLegs(userId, legs, airportMap, id, undefined);
    }

    await this.journeyRepository.save(journey);
    return this.findOne(userId, id);
  }

  async remove(userId: number, id: number): Promise<void> {
    const journey = await this.findOne(userId, id);
    await this.journeyRepository.remove(journey);
  }
}
