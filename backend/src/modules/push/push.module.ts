import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PushController } from './push.controller';
import { PushService } from './push.service';
import { PushSubscription } from './push-subscription.entity';

@Module({
  imports: [TypeOrmModule.forFeature([PushSubscription])],
  controllers: [PushController],
  providers: [PushService],
  // The anniversary sweep (M2) will import this module to send.
  exports: [PushService],
})
export class PushModule {}
