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
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { NonGuestGuard } from '../auth/guards/non-guest.guard';
import { FlightsService } from './flights.service';
import { FlightsStatsService, FlightStats } from './flights-stats.service';
import { FlightSearchService } from './services/flight-search.service';
import { FlightExplorationService } from './services/flight-exploration.service';
import { FilterService, SortOption } from './services/filter.service';
import { CreateFlightDto } from './dto/create-flight.dto';
import { UpdateFlightDto } from './dto/update-flight.dto';
import { SearchFlightsDto } from './dto/search-flights.dto';
import { FlexibleSearchDto } from './dto/flexible-search.dto';
import { FlightSearchResultDto } from './dto/flight-result.dto';
import { FlightExplorationResultDto } from './dto/flight-exploration-result.dto';
import { ImportFlightsDto, type ImportResultDto } from './dto/import-flights.dto';
import { ReorderFlightsDto } from './dto/reorder-flights.dto';
import { FlightJourney } from './entities/flight-journey.entity';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('flights')
export class FlightsController {
  constructor(
    private readonly flightsService: FlightsService,
    private readonly flightsStatsService: FlightsStatsService,
    private readonly flightSearchService: FlightSearchService,
    private readonly flightExplorationService: FlightExplorationService,
    private readonly filterService: FilterService,
  ) {}

  /**
   * Live flight search. Each call hits the paid RapidAPI upstream, so it is
   * gated to registered accounts (not free guest sessions) and throttled well
   * below the global ceiling — one script must not be able to burn the API
   * quota or run up a bill.
   */
  @UseGuards(NonGuestGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
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

  /**
   * Flexible exploration fans out to ~80 upstream calls per request, so it is
   * gated and throttled harder than plain search: registered accounts only,
   * a few per minute.
   */
  @UseGuards(NonGuestGuard)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('explore')
  async exploreFlights(
    @Body() flexibleSearchDto: FlexibleSearchDto,
  ): Promise<FlightExplorationResultDto> {
    return this.flightExplorationService.explore(flexibleSearchDto);
  }

  /**
   * Bulk import. Idempotent: re-uploading the same file skips rows that are
   * already present rather than duplicating them.
   *
   * Declared above the parameterless @Post so route matching is unambiguous.
   */
  @Post('import')
  async importFlights(
    @CurrentUser('id') userId: number,
    @Body() dto: ImportFlightsDto,
  ): Promise<ImportResultDto> {
    return this.flightsService.importJourneys(userId, dto.journeys);
  }

  @Get()
  async findAll(@CurrentUser('id') userId: number): Promise<FlightJourney[]> {
    return this.flightsService.findAll(userId);
  }

  /** Swap the replay order of two same-date (or both-undated) journeys. */
  @Post('reorder')
  async reorder(
    @CurrentUser('id') userId: number,
    @Body() dto: ReorderFlightsDto,
  ): Promise<void> {
    return this.flightsService.reorder(userId, dto.aId, dto.bId);
  }

  /**
   * Just the totals the map's initial view needs, computed with COUNT/SUM in
   * the DB. Kept ahead of `/:id` so the literal path wins the route match.
   */
  @Get('summary')
  async getSummary(@CurrentUser('id') userId: number) {
    return this.flightsStatsService.getSummary(userId);
  }

  @Get('stats')
  async getStats(@CurrentUser('id') userId: number): Promise<FlightStats> {
    return this.flightsStatsService.getStats(userId);
  }

  @Get(':id')
  async findOne(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<FlightJourney> {
    return this.flightsService.findOne(userId, id);
  }

  @Post()
  async create(
    @CurrentUser('id') userId: number,
    @Body() createFlightDto: CreateFlightDto,
  ): Promise<FlightJourney> {
    return this.flightsService.create(userId, createFlightDto);
  }

  @Patch(':id')
  async update(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() updateFlightDto: UpdateFlightDto,
  ): Promise<FlightJourney> {
    return this.flightsService.update(userId, id, updateFlightDto);
  }

  @Delete(':id')
  async remove(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<void> {
    return this.flightsService.remove(userId, id);
  }
}
