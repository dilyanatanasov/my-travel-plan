import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Header,
  Param,
  Req,
  Res,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { ShareService } from './share.service';
import { PublicMapDto } from './dto/public-map.dto';
import { SaveDuelDto } from './dto/save-duel.dto';
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
   * Raw PNG body, not multipart: express.raw in main.ts hands it over as a
   * Buffer for image/png only, which saves a multer dependency for what is a
   * single fixed-format file. @Req rather than @Body so the global
   * ValidationPipe never tries to treat a Buffer as a DTO.
   */
  @Post('card')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async uploadCard(@CurrentUser('id') userId: number, @Req() req: Request) {
    return this.shareService.saveCard(userId, req.body);
  }

  /**
   * The stored card, addressed by share token so revoking sharing revokes
   * the image too. The .png suffix is for crawlers that sniff URLs before
   * fetching. Cache is long-lived but validated: the URL never changes (one
   * card per user), so the ETag on updated_at is what lets a regenerated
   * card replace a cached one.
   */
  @Public()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Get('card/:token.png')
  async card(
    @Param('token') token: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const card = await this.shareService.getCard(token);
    const etag = `"${card.updatedAt.getTime().toString(16)}"`;

    if (req.headers['if-none-match'] === etag) {
      res.status(304).end();
      return;
    }

    res
      .status(200)
      .set({
        'Content-Type': 'image/png',
        'Content-Length': String(card.image.length),
        ETag: etag,
        'Cache-Control': 'public, max-age=86400',
        // Helmet's global CORP is same-site; the card exists precisely to be
        // consumed by other origins' preview caches and proxies.
        'Cross-Origin-Resource-Policy': 'cross-origin',
      })
      .send(card.image);
  }

  /**
   * OG tags for link-preview crawlers. nginx's UA-split rewrites crawler
   * requests for /s/<token> here; browsers never see this route unless they
   * type it, in which case the meta-refresh sends them to the real page.
   */
  @Public()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Get('unfurl/:token')
  @Header('Content-Type', 'text/html; charset=utf-8')
  @Header('Cache-Control', 'public, max-age=300')
  async unfurl(@Param('token') token: string): Promise<string> {
    return this.shareService.getUnfurlHtml(token);
  }

  /** Saved duels: bookmarked opponents for the signed-in account. */
  @Get('duels')
  async savedDuels(@CurrentUser('id') userId: number) {
    return this.shareService.listSavedDuels(userId);
  }

  @Post('duels')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async saveDuel(
    @CurrentUser('id') userId: number,
    @Body() dto: SaveDuelDto,
  ) {
    return this.shareService.saveDuel(userId, dto.token);
  }

  @Delete('duels/:token')
  async removeDuel(
    @CurrentUser('id') userId: number,
    @Param('token') token: string,
  ) {
    return this.shareService.removeDuel(userId, token);
  }

  /** Two public maps, one payload — the duel view. */
  @Public()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Get('duel/:a/:b')
  async duel(@Param('a') a: string, @Param('b') b: string) {
    return this.shareService.getDuel(a, b);
  }

  /** Crawler HTML for duel links — the scoreline is the preview. */
  @Public()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Get('unfurl-duel/:a/:b')
  async unfurlDuel(
    @Param('a') a: string,
    @Param('b') b: string,
    @Res() res: Response,
  ): Promise<void> {
    const html = await this.shareService.getDuelUnfurlHtml(a, b);
    res.status(200).type('html').send(html);
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
