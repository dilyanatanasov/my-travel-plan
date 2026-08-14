import { Controller, Get, Post, Body } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsBoolean, IsInt, Matches, Max, Min } from 'class-validator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { DailyService, DailyStats } from './daily.service';

export class RecordDailyDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date: string;

  @IsBoolean()
  won: boolean;

  @IsInt()
  @Min(1)
  @Max(6)
  tries: number;
}

/**
 * Authenticated (guests included — they are users, and registering keeps
 * the row history). The anonymous /daily page simply never calls this.
 */
@Controller('daily')
export class DailyController {
  constructor(private readonly dailyService: DailyService) {}

  @Get('stats')
  async stats(@CurrentUser('id') userId: number): Promise<DailyStats> {
    return this.dailyService.stats(userId);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('result')
  async record(
    @CurrentUser('id') userId: number,
    @Body() dto: RecordDailyDto,
  ): Promise<DailyStats> {
    return this.dailyService.record(userId, dto.date, dto.won, dto.tries);
  }
}
