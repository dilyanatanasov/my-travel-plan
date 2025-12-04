import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { Airport } from './entities/airport.entity';

@Injectable()
export class AirportsService {
  constructor(
    @InjectRepository(Airport)
    private readonly airportRepository: Repository<Airport>,
  ) {}

  async findAll(): Promise<Airport[]> {
    return this.airportRepository.find({
      order: { name: 'ASC' },
      take: 100, // Limit to 100 by default
    });
  }

  async findOne(id: number): Promise<Airport | null> {
    return this.airportRepository.findOneBy({ id });
  }

  async findByIataCode(iataCode: string): Promise<Airport | null> {
    return this.airportRepository.findOneBy({
      iataCode: iataCode.toUpperCase()
    });
  }

  async search(query: string, limit = 20): Promise<Airport[]> {
    if (!query || query.length < 2) {
      return [];
    }

    const searchQuery = `%${query}%`;

    return this.airportRepository.find({
      where: [
        { iataCode: ILike(searchQuery) },
        { name: ILike(searchQuery) },
        { city: ILike(searchQuery) },
        { country: ILike(searchQuery) },
      ],
      order: {
        // Prioritize exact IATA matches, then by name
        iataCode: 'ASC',
        name: 'ASC'
      },
      take: limit,
    });
  }
}
