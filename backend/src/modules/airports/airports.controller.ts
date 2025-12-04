import {
  Controller,
  Get,
  Param,
  Query,
  ParseIntPipe,
  NotFoundException,
} from '@nestjs/common';
import { AirportsService } from './airports.service';
import { Airport } from './entities/airport.entity';

@Controller('airports')
export class AirportsController {
  constructor(private readonly airportsService: AirportsService) {}

  @Get()
  async findAll(@Query('q') query?: string): Promise<Airport[]> {
    if (query) {
      return this.airportsService.search(query);
    }
    return this.airportsService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<Airport> {
    const airport = await this.airportsService.findOne(id);
    if (!airport) {
      throw new NotFoundException(`Airport with ID ${id} not found`);
    }
    return airport;
  }

  @Get('iata/:code')
  async findByIataCode(@Param('code') code: string): Promise<Airport> {
    const airport = await this.airportsService.findByIataCode(code);
    if (!airport) {
      throw new NotFoundException(`Airport with IATA code ${code} not found`);
    }
    return airport;
  }
}
