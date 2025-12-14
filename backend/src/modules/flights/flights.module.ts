import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FlightsController } from './flights.controller';
import { FlightsService } from './flights.service';
import { FlightsStatsService } from './flights-stats.service';
import { FlightSearchService } from './services/flight-search.service';
import { FlightExplorationService } from './services/flight-exploration.service';
import { DateSamplingService } from './services/date-sampling.service';
import { HubService } from './services/hub.service';
import { FilterService } from './services/filter.service';
import { SafetyService } from './services/safety.service';
import { ApiKeyManagerService } from './services/api-key-manager.service';
import { FlightJourney } from './entities/flight-journey.entity';
import { FlightLeg } from './entities/flight-leg.entity';
import { BannedAirline } from './entities/banned-airline.entity';
import { Airport } from '../airports/entities/airport.entity';
import { VisitsModule } from '../visits/visits.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([FlightJourney, FlightLeg, BannedAirline, Airport]),
    VisitsModule,
  ],
  controllers: [FlightsController],
  providers: [
    FlightsService,
    FlightsStatsService,
    ApiKeyManagerService,
    FlightSearchService,
    FlightExplorationService,
    DateSamplingService,
    HubService,
    FilterService,
    SafetyService,
  ],
  exports: [
    FlightsService,
    FlightsStatsService,
    ApiKeyManagerService,
    FlightSearchService,
    FlightExplorationService,
    DateSamplingService,
    HubService,
    FilterService,
    SafetyService,
  ],
})
export class FlightsModule {}
