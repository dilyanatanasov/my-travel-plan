import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response, CookieOptions } from 'express';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { AuthService, AuthResult } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ACCESS_TOKEN_COOKIE } from './jwt.strategy';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  private cookieOptions(): CookieOptions {
    const isProduction = this.configService.get('NODE_ENV') === 'production';
    return {
      httpOnly: true,
      secure: isProduction,
      // 'lax' assumes the frontend and API are same-site, which they are in
      // the intended deployment. Cross-domain hosting would require
      // sameSite:'none' + secure:true (and therefore HTTPS).
      sameSite: 'lax',
      maxAge: SEVEN_DAYS_MS,
      path: '/',
    };
  }

  private setAuthCookie(res: Response, result: AuthResult) {
    res.cookie(ACCESS_TOKEN_COOKIE, result.accessToken, this.cookieOptions());
  }

  /**
   * Start using the app without signing up.
   *
   * @Public because the caller has no session yet, and rate limited because
   * every call creates a row.
   */
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('guest')
  async guest(@Res({ passthrough: true }) res: Response) {
    const result = await this.authService.createGuest();
    this.setAuthCookie(res, result);
    return { user: result.user };
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    // @Public, so the guard leaves req.user empty even with a valid cookie.
    // Decode it here: if a guest is signing up, their existing row is
    // upgraded rather than orphaned.
    const guestId = this.authService.userIdFromToken(
      req.cookies?.[ACCESS_TOKEN_COOKIE],
    );
    const result = await this.authService.register(dto, guestId);
    this.setAuthCookie(res, result);
    return { user: result.user, claimed: result.claimed };
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(dto);
    this.setAuthCookie(res, result);
    return { user: result.user };
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@Res({ passthrough: true }) res: Response) {
    // maxAge omitted so the cookie is cleared rather than re-dated.
    const { maxAge, ...options } = this.cookieOptions();
    res.clearCookie(ACCESS_TOKEN_COOKIE, options);
    return { success: true };
  }

  /** Protected on purpose: the 401 is the frontend's "logged out" signal. */
  @Get('me')
  async me(@CurrentUser('id') userId: number) {
    const user = await this.authService.getProfile(userId);
    // Only guests need this: it is what stops the cleanup sweep from
    // collecting an anonymous account someone is still actively using.
    // Not awaited — a stale timestamp must never fail the request.
    if (user.isGuest) {
      void this.authService.touch(userId);
    }
    return { user };
  }
}
