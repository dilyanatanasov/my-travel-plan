import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Post,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Type } from 'class-transformer';
import {
  IsObject,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Public } from '../../common/decorators/public.decorator';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { PushService } from './push.service';

class SubscriptionKeysDto {
  @IsString()
  @MaxLength(255)
  p256dh: string;

  @IsString()
  @MaxLength(255)
  auth: string;
}

class SubscribeDto {
  /** Push-service URLs are always https; anything else is not one. */
  @Matches(/^https:\/\//)
  @MaxLength(2048)
  endpoint: string;

  @IsObject()
  @ValidateNested()
  @Type(() => SubscriptionKeysDto)
  keys: SubscriptionKeysDto;
}

class UnsubscribeDto {
  @Matches(/^https:\/\//)
  @MaxLength(2048)
  endpoint: string;
}

@Controller('push')
export class PushController {
  constructor(private readonly pushService: PushService) {}

  /**
   * Public: the browser needs the VAPID application key before it can even
   * ask for permission, and the key is by definition not a secret.
   */
  @Public()
  @Get('public-key')
  publicKey(): { key: string } {
    const key = this.pushService.publicKey();
    if (!key) throw new NotFoundException('Push is not configured');
    return { key };
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('subscribe')
  @HttpCode(204)
  async subscribe(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SubscribeDto,
  ): Promise<void> {
    await this.pushService.subscribe(
      user,
      dto.endpoint,
      dto.keys.p256dh,
      dto.keys.auth,
    );
  }

  @Delete('subscribe')
  @HttpCode(204)
  async unsubscribe(
    @CurrentUser('id') userId: number,
    @Body() dto: UnsubscribeDto,
  ): Promise<void> {
    await this.pushService.unsubscribe(userId, dto.endpoint);
  }

  /**
   * Fires a real notification through the real pipeline, to the caller's
   * own devices only — the way to see that the toggle did something before
   * an anniversary ever comes around. Tightly throttled; it is a doorbell,
   * not a megaphone.
   */
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('test')
  @HttpCode(204)
  async test(@CurrentUser('id') userId: number): Promise<void> {
    await this.pushService.sendToUser(userId, {
      title: '✈️ myContrail',
      body: 'Notifications are working on this device.',
      url: '/',
    });
  }
}
