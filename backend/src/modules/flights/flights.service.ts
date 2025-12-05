import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FlightJourney } from './entities/flight-journey.entity';
import { FlightLeg } from './entities/flight-leg.entity';
import { Airport } from '../airports/entities/airport.entity';
import { CreateFlightDto } from './dto/create-flight.dto';
import { UpdateFlightDto } from './dto/update-flight.dto';
import { calculateAirportDistance } from '../../common/utils/haversine';
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
    private readonly visitsService: VisitsService,
  ) {}

  async findAll(): Promise<FlightJourney[]> {
    return this.journeyRepository.find({
      relations: ['legs', 'legs.departureAirport', 'legs.arrivalAirport'],
      order: { journeyDate: 'DESC', createdAt: 'DESC' },
    });
  }

  async findOne(id: number): Promise<FlightJourney> {
    const journey = await this.journeyRepository.findOne({
      where: { id },
      relations: ['legs', 'legs.departureAirport', 'legs.arrivalAirport'],
    });
    if (!journey) {
      throw new NotFoundException(`Flight journey with ID ${id} not found`);
    }
    return journey;
  }

  async create(createFlightDto: CreateFlightDto): Promise<FlightJourney> {
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

    // Create the journey
    const journey = this.journeyRepository.create({
      journeyDate: createFlightDto.journeyDate
        ? new Date(createFlightDto.journeyDate)
        : null,
      isRoundTrip: createFlightDto.isRoundTrip || false,
      notes: createFlightDto.notes || null,
    });

    const savedJourney = await this.journeyRepository.save(journey);

    // Create legs with calculated distances
    const legs: FlightLeg[] = [];
    for (let i = 0; i < legData.length; i++) {
      const departureAirport = airportMap.get(legData[i].departureAirportId)!;
      const arrivalAirport = airportMap.get(legData[i].arrivalAirportId)!;

      const distance = calculateAirportDistance(departureAirport, arrivalAirport);

      const leg = this.legRepository.create({
        journeyId: savedJourney.id,
        legOrder: i + 1,
        departureAirportId: legData[i].departureAirportId,
        arrivalAirportId: legData[i].arrivalAirportId,
        distanceKm: distance,
      });

      legs.push(leg);
    }

    await this.legRepository.save(legs);

    // Auto-create visits for countries in this flight
    await this.createVisitsFromLegs(
      legs,
      airportMap,
      savedJourney.id,
      createFlightDto.journeyDate,
    );

    // Return the complete journey with relations
    return this.findOne(savedJourney.id);
  }

  /**
   * Create visit records for countries visited in this flight
   * Detects transit countries (consecutive legs in same country)
   */
  private async createVisitsFromLegs(
    legs: FlightLeg[],
    airportMap: Map<number, Airport>,
    journeyId: number,
    journeyDate?: string,
  ): Promise<void> {
    // Detect transit countries: if we arrive and depart from same country in consecutive legs
    const transitCountries = new Set<string>();
    for (let i = 0; i < legs.length - 1; i++) {
      const arrivalAirport = airportMap.get(legs[i].arrivalAirportId);
      const nextDepartureAirport = airportMap.get(legs[i + 1].departureAirportId);

      if (
        arrivalAirport?.countryIso &&
        nextDepartureAirport?.countryIso &&
        arrivalAirport.countryIso === nextDepartureAirport.countryIso
      ) {
        transitCountries.add(arrivalAirport.countryIso);
      }
    }

    // Collect all countries from legs
    const countriesInFlight = new Map<string, VisitType>();

    for (const leg of legs) {
      const departureAirport = airportMap.get(leg.departureAirportId);
      const arrivalAirport = airportMap.get(leg.arrivalAirportId);

      // Add departure country
      if (departureAirport?.countryIso) {
        const iso = departureAirport.countryIso;
        // If not already marked as trip, determine type
        if (!countriesInFlight.has(iso) || countriesInFlight.get(iso) === 'transit') {
          countriesInFlight.set(
            iso,
            transitCountries.has(iso) ? 'transit' : 'trip',
          );
        }
      }

      // Add arrival country
      if (arrivalAirport?.countryIso) {
        const iso = arrivalAirport.countryIso;
        if (!countriesInFlight.has(iso) || countriesInFlight.get(iso) === 'transit') {
          countriesInFlight.set(
            iso,
            transitCountries.has(iso) ? 'transit' : 'trip',
          );
        }
      }
    }

    // First and last airports are definitely trips, not transit
    const firstAirport = airportMap.get(legs[0].departureAirportId);
    const lastAirport = airportMap.get(legs[legs.length - 1].arrivalAirportId);

    if (firstAirport?.countryIso) {
      countriesInFlight.set(firstAirport.countryIso, 'trip');
    }
    if (lastAirport?.countryIso) {
      countriesInFlight.set(lastAirport.countryIso, 'trip');
    }

    // Create visits for each country
    for (const [countryIso, visitType] of countriesInFlight) {
      await this.visitsService.createOrUpdateFromFlight(
        countryIso,
        visitType,
        journeyId,
        journeyDate,
      );
    }
  }

  async update(id: number, updateFlightDto: UpdateFlightDto): Promise<FlightJourney> {
    const journey = await this.findOne(id);

    if (updateFlightDto.journeyDate !== undefined) {
      journey.journeyDate = updateFlightDto.journeyDate
        ? new Date(updateFlightDto.journeyDate)
        : null;
    }
    if (updateFlightDto.isRoundTrip !== undefined) {
      journey.isRoundTrip = updateFlightDto.isRoundTrip;
    }
    if (updateFlightDto.notes !== undefined) {
      journey.notes = updateFlightDto.notes;
    }

    await this.journeyRepository.save(journey);
    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    const journey = await this.findOne(id);
    await this.journeyRepository.remove(journey);
  }
}
