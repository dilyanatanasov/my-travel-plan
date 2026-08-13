import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { Visit } from '../visits/entities/visit.entity';
import { FlightJourney } from '../flights/entities/flight-journey.entity';
import { Country } from '../countries/entities/country.entity';
import { ShareCard } from './entities/share-card.entity';
import { SavedDuel } from './entities/saved-duel.entity';
import { ShareService } from './share.service';
import { ShareController } from './share.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Visit,
      FlightJourney,
      Country,
      ShareCard,
      SavedDuel,
    ]),
  ],
  controllers: [ShareController],
  providers: [ShareService],
})
export class ShareModule {}
