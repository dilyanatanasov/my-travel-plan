import { Controller, Get, Query } from '@nestjs/common';
import { CitiesService } from './cities.service';
import { City } from './entities/city.entity';
import { Public } from '../../common/decorators/public.decorator';

// Shared reference data, same stance as airports: the city typeahead is
// world geography, not user data - readable without a session.
@Public()
@Controller('cities')
export class CitiesController {
  constructor(private readonly citiesService: CitiesService) {}

  @Get()
  async search(@Query('q') query?: string): Promise<City[]> {
    if (!query) return [];
    return this.citiesService.search(query);
  }
}
