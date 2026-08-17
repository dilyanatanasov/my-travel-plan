import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
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
   */
  async search(query: string, limit = 10): Promise<City[]> {
    const trimmed = query.trim();
    if (trimmed.length < 2) return [];
    const prefix = `${trimmed}%`;
    return this.cityRepository.find({
      where: [{ name: ILike(prefix) }, { asciiName: ILike(prefix) }],
      order: { population: 'DESC' },
      take: limit,
    });
  }

  async findByIds(ids: number[]): Promise<City[]> {
    if (ids.length === 0) return [];
    return this.cityRepository.findByIds(ids);
  }
}
