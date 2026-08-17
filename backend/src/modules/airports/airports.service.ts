import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { Airport } from './entities/airport.entity';
import { KNOWN_HUBS } from '../flights/data/hubs';

const HUB_CODES = new Set(KNOWN_HUBS.map((hub) => hub.code));

/**
 * Search ranking (friend feedback 2026-08-17): searching "Italy" used to
 * list Italian airports alphabetically, minors first — every flight app
 * puts Rome and Milan on top. With no traffic data in the table, the
 * ranking is a heuristic: exact code, then the majors we know (hub list,
 * "International" in the name), then the rest.
 */
export function rankAirports(airports: Airport[], query: string): Airport[] {
  const needle = query.trim().toLowerCase();
  const score = (airport: Airport): number => {
    let value = 0;
    if (airport.iataCode.toLowerCase() === needle) value -= 1000;
    // Typing a city means that city, whatever the hub list thinks.
    if (airport.city?.toLowerCase().startsWith(needle)) value -= 500;
    if (HUB_CODES.has(airport.iataCode)) value -= 100;
    if (/international/i.test(airport.name)) value -= 10;
    return value;
  };
  return [...airports].sort(
    (a, b) => score(a) - score(b) || a.name.localeCompare(b.name),
  );
}

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

    // Over-fetch, rank in memory, trim: the DB has no notion of "major".
    const matches = await this.airportRepository.find({
      where: [
        { iataCode: ILike(searchQuery) },
        { name: ILike(searchQuery) },
        { city: ILike(searchQuery) },
        { country: ILike(searchQuery) },
      ],
      take: limit * 5,
    });

    return rankAirports(matches, query).slice(0, limit);
  }
}
