import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { City } from './entities/city.entity';

/**
 * How much an exact name match is worth, expressed in population. Eight
 * puts Bath (101k) above Bathinda (285k) while leaving Varanasi (1.16M)
 * safely above Vār (4.8k) - the band where "the town I named" and "the
 * city everyone means" trade places.
 */
const EXACT_BOOST = 8;

@Injectable()
export class CitiesService {
  constructor(
    @InjectRepository(City)
    private readonly cityRepository: Repository<City>,
  ) {}

  /**
   * City typeahead for land-travel endpoints. Prefix match, not substring
   * - "sof" means Sofia, not Isofjorden - against both the native and
   * diacritic-free spellings.
   *
   * Ranking weighs exactness against size (friend feedback, 2026-08-21:
   * "the exact matches should come out on top"). Population alone had a
   * big city beat the town you actually named: "bath" listed Bathinda
   * (285k) above Bath (101k), and "nice" put Nicetown before Nice.
   *
   * A hard exact-first tier overcorrects, though - every query is a
   * complete word for one keystroke on the way to a longer one, so "var"
   * surfaced Vār (Iran, 4,808 people) above Varanasi and Varna. Instead
   * an exact match multiplies its population: it beats anything up to
   * EXACT_BOOST times its size, and loses to what dwarfs it. Bathinda is
   * 2.8x Bath, so Bath wins; Varanasi is 242x Vār, so Vār stays put.
   *
   * The weighting is an expression in ORDER BY, not a second query: the
   * WHERE is untouched, so this stays the same index range scan it was.
   *
   * lower(...) LIKE, not ILIKE: the migration indexes
   * lower(ascii_name) with text_pattern_ops precisely so this prefix
   * scan is an index range, not 130k row comparisons per keystroke.
   */
  async search(query: string, limit = 10): Promise<City[]> {
    const trimmed = query.trim();
    if (trimmed.length < 2) return [];
    const needle = trimmed.toLowerCase();
    // % and _ are LIKE operators, not typo material.
    const prefix = `${needle.replace(/[\\%_]/g, '\\$&')}%`;
    return this.cityRepository
      .createQueryBuilder('city')
      .where('lower(city.ascii_name) LIKE :prefix', { prefix })
      .orWhere('lower(city.name) LIKE :prefix', { prefix })
      .orderBy(
        `GREATEST(city.population, 1)
           * CASE WHEN lower(city.ascii_name) = :needle
                    OR lower(city.name) = :needle
                  THEN ${EXACT_BOOST} ELSE 1 END`,
        'DESC',
      )
      .setParameter('needle', needle)
      .take(limit)
      .getMany();
  }

  async findByIds(ids: number[]): Promise<City[]> {
    if (ids.length === 0) return [];
    return this.cityRepository.findByIds(ids);
  }
}
