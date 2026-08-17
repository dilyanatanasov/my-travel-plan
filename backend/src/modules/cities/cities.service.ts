import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { City } from './entities/city.entity';

@Injectable()
export class CitiesService {
  constructor(
    @InjectRepository(City)
    private readonly cityRepository: Repository<City>,
  ) {}

  /**
   * City typeahead for land-travel endpoints. Population does the ranking:
   * with 130k rows, "var" must put Varna above Varnja, and size is the
   * only signal the dataset carries that matches what people mean.
   * Prefix match, not substring - "sof" means Sofia, not Isofjorden -
   * against both the native and diacritic-free spellings.
   *
   * lower(...) LIKE, not ILIKE: the migration indexes
   * lower(ascii_name) with text_pattern_ops precisely so this prefix
   * scan is an index range, not 130k row comparisons per keystroke.
   */
  async search(query: string, limit = 10): Promise<City[]> {
    const trimmed = query.trim();
    if (trimmed.length < 2) return [];
    // % and _ are LIKE operators, not typo material.
    const prefix = `${trimmed.toLowerCase().replace(/[\\%_]/g, '\\$&')}%`;
    return this.cityRepository
      .createQueryBuilder('city')
      .where('lower(city.ascii_name) LIKE :prefix', { prefix })
      .orWhere('lower(city.name) LIKE :prefix', { prefix })
      .orderBy('city.population', 'DESC')
      .take(limit)
      .getMany();
  }

  async findByIds(ids: number[]): Promise<City[]> {
    if (ids.length === 0) return [];
    return this.cityRepository.findByIds(ids);
  }
}
