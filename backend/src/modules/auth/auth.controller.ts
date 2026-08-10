import {
  Controller,
  Post,
  Get,
  Body,
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Response, CookieOptions } from 'express';
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

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.register(dto);
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
    return { user: await this.authService.getProfile(userId) };
  }
}
