import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FlightsController } from './flights.controller';
import { FlightsService } from './flights.service';
import { FlightsStatsService } from './flights-stats.service';
import { FlightJourney } from './entities/flight-journey.entity';
import { FlightLeg } from './entities/flight-leg.entity';
import { Airport } from '../airports/entities/airport.entity';
import { VisitsModule } from '../visits/visits.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([FlightJourney, FlightLeg, Airport]),
    VisitsModule,
  ],
  controllers: [FlightsController],
  providers: [FlightsService, FlightsStatsService],
  exports: [FlightsService, FlightsStatsService],
})
export class FlightsModule {}
