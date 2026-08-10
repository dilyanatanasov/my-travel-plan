import { Controller, Get, Post, Delete, Param } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ShareService } from './share.service';
import { PublicMapDto } from './dto/public-map.dto';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('share')
export class ShareController {
  constructor(private readonly shareService: ShareService) {}

  @Get('status')
  async status(@CurrentUser('id') userId: number) {
    return this.shareService.getStatus(userId);
  }

  @Post('enable')
  async enable(@CurrentUser('id') userId: number) {
    return this.shareService.enable(userId);
  }

  @Delete()
  async disable(@CurrentUser('id') userId: number) {
    return this.shareService.disable(userId);
  }

  /**
   * The public map. Unauthenticated, so it is rate limited more tightly than
   * the app's own endpoints and returns a payload built specifically for this
   * route — never a Visit or FlightJourney entity, which carry private notes.
   *
   * Declared last so it cannot shadow /share/status.
   */
  @Public()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Get(':token')
  async publicMap(@Param('token') token: string): Promise<PublicMapDto> {
    return this.shareService.getPublicMap(token);
  }
}
