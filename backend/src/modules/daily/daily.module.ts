import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DailyController } from './daily.controller';
import { DailyService } from './daily.service';
import { DailyResult } from './daily-result.entity';

@Module({
  imports: [TypeOrmModule.forFeature([DailyResult])],
  controllers: [DailyController],
  providers: [DailyService],
})
export class DailyModule {}
