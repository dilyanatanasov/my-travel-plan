import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { CountriesService } from './countries.service';
import { Country } from './entities/country.entity';
import { Public } from '../../common/decorators/public.decorator';

// Shared reference data, not user data — readable without a session.
@Public()
@Controller('countries')
export class CountriesController {
  constructor(private readonly countriesService: CountriesService) {}

  @Get()
  async findAll(): Promise<Country[]> {
    return this.countriesService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<Country> {
    return this.countriesService.findOne(id);
  }
}
