import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Country } from './entities/country.entity';

@Injectable()
export class CountriesService {
  constructor(
    @InjectRepository(Country)
    private readonly countryRepository: Repository<Country>,
  ) {}

  async findAll(): Promise<Country[]> {
    return this.countryRepository.find({
      order: { name: 'ASC' },
    });
  }

  async findOne(id: number): Promise<Country> {
    return this.countryRepository.findOneBy({ id });
  }

  async findByIsoCode(isoCode: string): Promise<Country> {
    return this.countryRepository.findOneBy({ isoCode });
  }

  async findByIsoCode2(isoCode2: string): Promise<Country> {
    return this.countryRepository.findOneBy({ isoCode2 });
  }
}
