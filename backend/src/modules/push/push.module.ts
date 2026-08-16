import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PushController } from './push.controller';
import { PushService } from './push.service';
import { PushSubscription } from './push-subscription.entity';
import { AnniversarySend } from './anniversary-send.entity';
import { AnniversaryService } from './anniversary.service';
import { FlightJourney } from '../flights/entities/flight-journey.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([PushSubscription, AnniversarySend, FlightJourney]),
  ],
  controllers: [PushController],
  providers: [PushService, AnniversaryService],
  exports: [PushService],
})
export class PushModule {}
