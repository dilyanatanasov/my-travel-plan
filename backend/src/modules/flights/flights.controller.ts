import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { FlightsService } from './flights.service';
import { FlightsStatsService, FlightStats } from './flights-stats.service';
import { FlightSearchService } from './services/flight-search.service';
import { FlightExplorationService } from './services/flight-exploration.service';
import { FilterService, SortOption } from './services/filter.service';
import { CreateFlightDto } from './dto/create-flight.dto';
import { UpdateFlightDto } from './dto/update-flight.dto';
import { SearchFlightsDto } from './dto/search-flights.dto';
import { FlexibleSearchDto } from './dto/flexible-search.dto';
import { FilterOptionsDto } from './dto/filter-options.dto';
import { FlightSearchResultDto } from './dto/flight-result.dto';
import { FlightExplorationResultDto } from './dto/flight-exploration-result.dto';
import { FlightJourney } from './entities/flight-journey.entity';

@Controller('flights')
export class FlightsController {
  constructor(
    private readonly flightsService: FlightsService,
    private readonly flightsStatsService: FlightsStatsService,
    private readonly flightSearchService: FlightSearchService,
    private readonly flightExplorationService: FlightExplorationService,
    private readonly filterService: FilterService,
  ) {}

  @Post('search')
  async searchFlights(
    @Body() searchFlightsDto: SearchFlightsDto,
    @Query('sortBy') sortBy?: SortOption,
  ): Promise<FlightSearchResultDto> {
    const results = await this.flightSearchService.searchFlights(searchFlightsDto);

    // Apply filters if provided
    if (searchFlightsDto.filters || sortBy) {
      return this.filterService.applyFilters(
        results,
        searchFlightsDto.filters || {},
        sortBy,
      );
    }

    return results;
  }

  @Post('explore')
  async exploreFlights(
    @Body() flexibleSearchDto: FlexibleSearchDto,
  ): Promise<FlightExplorationResultDto> {
    return this.flightExplorationService.explore(flexibleSearchDto);
  }

  @Get()
  async findAll(): Promise<FlightJourney[]> {
    return this.flightsService.findAll();
  }

  @Get('stats')
  async getStats(): Promise<FlightStats> {
    return this.flightsStatsService.getStats();
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<FlightJourney> {
    return this.flightsService.findOne(id);
  }

  @Post()
  async create(@Body() createFlightDto: CreateFlightDto): Promise<FlightJourney> {
    return this.flightsService.create(createFlightDto);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateFlightDto: UpdateFlightDto,
  ): Promise<FlightJourney> {
    return this.flightsService.update(id, updateFlightDto);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.flightsService.remove(id);
  }
}
