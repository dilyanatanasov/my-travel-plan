import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseIntPipe,
} from '@nestjs/common';
import { FlightsService } from './flights.service';
import { FlightsStatsService, FlightStats } from './flights-stats.service';
import { CreateFlightDto } from './dto/create-flight.dto';
import { UpdateFlightDto } from './dto/update-flight.dto';
import { FlightJourney } from './entities/flight-journey.entity';

@Controller('flights')
export class FlightsController {
  constructor(
    private readonly flightsService: FlightsService,
    private readonly flightsStatsService: FlightsStatsService,
  ) {}

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
