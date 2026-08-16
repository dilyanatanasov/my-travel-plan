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
import { LegPhoto } from './entities/leg-photo.entity';
import { BannedAirline } from './entities/banned-airline.entity';
import { PriceObservation } from './entities/price-observation.entity';
import { ApiSpend } from './entities/api-spend.entity';
import { TripWatch } from './entities/trip-watch.entity';
import { Airport } from '../airports/entities/airport.entity';
import { VisitsModule } from '../visits/visits.module';
import { PushModule } from '../push/push.module';
import { MailModule } from '../mail/mail.module';
import { LegPhotosService } from './leg-photos.service';
import { ImageProcessingService } from '../../common/services/image-processing.service';
import { BudgetService } from './services/budget.service';
import { TravelpayoutsProvider } from './providers/travelpayouts.provider';
import { SerpapiProvider } from './providers/serpapi.provider';
import { KiwiProvider } from './providers/kiwi.provider';
import { PriceObservationsService } from './services/price-observations.service';
import { SearchOrchestratorService } from './services/search-orchestrator.service';
import { SearchStreamRegistry } from './services/search-stream.registry';
import { WatchesService } from './services/watches.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      FlightJourney,
      FlightLeg,
      LegPhoto,
      BannedAirline,
      PriceObservation,
      ApiSpend,
      TripWatch,
      Airport,
    ]),
    VisitsModule,
    PushModule,
    MailModule,
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
    LegPhotosService,
    ImageProcessingService,
    BudgetService,
    TravelpayoutsProvider,
    SerpapiProvider,
    KiwiProvider,
    PriceObservationsService,
    SearchOrchestratorService,
    SearchStreamRegistry,
    WatchesService,
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
