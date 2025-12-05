import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Visit, VisitType, VisitSource } from './entities/visit.entity';
import { CreateVisitDto } from './dto/create-visit.dto';
import { UpdateVisitDto } from './dto/update-visit.dto';
import { CountriesService } from '../countries/countries.service';

@Injectable()
export class VisitsService {
  constructor(
    @InjectRepository(Visit)
    private readonly visitRepository: Repository<Visit>,
    private readonly countriesService: CountriesService,
  ) {}

  async findAll(): Promise<Visit[]> {
    return this.visitRepository.find({
      relations: ['country'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: number): Promise<Visit> {
    const visit = await this.visitRepository.findOne({
      where: { id },
      relations: ['country'],
    });
    if (!visit) {
      throw new NotFoundException(`Visit with ID ${id} not found`);
    }
    return visit;
  }

  async findByCountryId(countryId: number): Promise<Visit | null> {
    return this.visitRepository.findOne({
      where: { countryId },
      relations: ['country'],
    });
  }

  async findByCountryIso2(isoCode2: string): Promise<Visit | null> {
    const country = await this.countriesService.findByIsoCode2(isoCode2);
    if (!country) return null;
    return this.findByCountryId(country.id);
  }

  async create(createVisitDto: CreateVisitDto): Promise<Visit> {
    let countryId = createVisitDto.countryId;

    // If countryIso provided instead of countryId, look up the country
    if (!countryId && createVisitDto.countryIso) {
      const country = await this.countriesService.findByIsoCode2(createVisitDto.countryIso);
      if (!country) {
        throw new BadRequestException(`Country with ISO code ${createVisitDto.countryIso} not found`);
      }
      countryId = country.id;
    }

    if (!countryId) {
      throw new BadRequestException('Either countryId or countryIso must be provided');
    }

    const visit = this.visitRepository.create({
      countryId,
      visitedAt: createVisitDto.visitedAt ? new Date(createVisitDto.visitedAt) : null,
      notes: createVisitDto.notes,
      visitType: createVisitDto.visitType || 'trip',
      source: createVisitDto.source || 'manual',
      flightJourneyId: createVisitDto.flightJourneyId || null,
    });

    const savedVisit = await this.visitRepository.save(visit);
    return this.findOne(savedVisit.id);
  }

  /**
   * Create a visit from a flight, or update existing visit if country already visited
   */
  async createOrUpdateFromFlight(
    countryIso2: string,
    visitType: VisitType,
    flightJourneyId: number,
    journeyDate?: string,
  ): Promise<Visit | null> {
    const country = await this.countriesService.findByIsoCode2(countryIso2);
    if (!country) {
      // Country not in our database, skip
      return null;
    }

    // Check if visit already exists for this country
    const existingVisit = await this.findByCountryId(country.id);

    if (existingVisit) {
      // If existing visit is manual 'trip' or 'home', don't downgrade to transit
      // But if it's a transit and new one is trip, upgrade it
      if (existingVisit.visitType === 'transit' && visitType === 'trip') {
        existingVisit.visitType = 'trip';
        return this.visitRepository.save(existingVisit);
      }
      // Already visited, no changes needed
      return existingVisit;
    }

    // Create new visit from flight
    return this.create({
      countryId: country.id,
      visitedAt: journeyDate,
      visitType,
      source: 'flight',
      flightJourneyId,
    });
  }

  /**
   * Set a country as the home country
   */
  async setHomeCountry(countryId: number): Promise<Visit> {
    // First, remove 'home' type from any existing home country
    const existingHome = await this.visitRepository.findOne({
      where: { visitType: 'home' },
    });
    if (existingHome) {
      existingHome.visitType = 'trip';
      await this.visitRepository.save(existingHome);
    }

    // Check if country already has a visit
    const existingVisit = await this.findByCountryId(countryId);
    if (existingVisit) {
      existingVisit.visitType = 'home';
      const saved = await this.visitRepository.save(existingVisit);
      return this.findOne(saved.id);
    }

    // Create new visit as home
    return this.create({
      countryId,
      visitType: 'home',
      source: 'manual',
    });
  }

  /**
   * Get the current home country visit
   */
  async getHomeCountry(): Promise<Visit | null> {
    return this.visitRepository.findOne({
      where: { visitType: 'home' },
      relations: ['country'],
    });
  }

  async update(id: number, updateVisitDto: UpdateVisitDto): Promise<Visit> {
    const visit = await this.findOne(id);
    Object.assign(visit, updateVisitDto);
    const saved = await this.visitRepository.save(visit);
    return this.findOne(saved.id);
  }

  async remove(id: number): Promise<void> {
    const visit = await this.findOne(id);
    await this.visitRepository.remove(visit);
  }
}
