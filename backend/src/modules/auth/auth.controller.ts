import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Query,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { Request, Response, CookieOptions } from 'express';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { AuthService, AuthResult } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { DeleteAccountDto } from './dto/delete-account.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ACCESS_TOKEN_COOKIE } from './jwt.strategy';
import { GoogleAuthService, safeNext } from './google-auth.service';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * The in-flight Google sign-in: state (CSRF), nonce (token binding) and
 * where to go afterwards. Scoped to the two Google routes and ten minutes,
 * so it is never sent anywhere else and cannot be replayed later.
 */
const GOOGLE_FLOW_COOKIE = 'google_oauth';
const GOOGLE_FLOW_PATH = '/api/auth/google';
const GOOGLE_FLOW_MAX_AGE_MS = 10 * 60 * 1000;

interface GoogleFlow {
  state: string;
  nonce: string;
  next: string;
}

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
    private readonly googleAuth: GoogleAuthService,
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

  /**
   * Always {ok:true}, whether or not the account exists — this endpoint must
   * not be a user-enumeration oracle. Throttled hardest of all: each real hit
   * sends an email on someone's behalf.
   */
  @Public()
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.authService.forgotPassword(dto.email);
    return { ok: true };
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPassword(dto.token, dto.password);
    return { ok: true };
  }

  /** @Public: the link is often opened in a browser with no session. */
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    await this.authService.verifyEmail(dto.token);
    return { ok: true };
  }

  /** Authenticated: resending is only meaningful for the logged-in account. */
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  async resendVerification(@CurrentUser('id') userId: number) {
    await this.authService.resendVerification(userId);
    return { ok: true };
  }

  /** Throttled like deletion: a wrong-password loop is a guessing oracle. */
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Patch('password')
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @CurrentUser('id') userId: number,
    @Body() dto: ChangePasswordDto,
  ) {
    await this.authService.changePassword(
      userId,
      dto.currentPassword,
      dto.newPassword,
    );
    return { ok: true };
  }

  /** GDPR portability: everything the account owns, as one JSON document. */
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Get('export')
  async exportData(@CurrentUser('id') userId: number) {
    return this.authService.exportMyData(userId);
  }

  /**
   * GDPR erasure. Registered accounts must confirm their password (enforced
   * in the service); the session cookie dies with the account. Throttled:
   * a wrong-password loop is a credential-guessing oracle.
   */
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Delete('account')
  @HttpCode(HttpStatus.OK)
  async deleteAccount(
    @CurrentUser('id') userId: number,
    @Body() dto: DeleteAccountDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.authService.deleteAccount(userId, dto.password);
    const { maxAge, ...options } = this.cookieOptions();
    res.clearCookie(ACCESS_TOKEN_COOKIE, options);
    return { ok: true };
  }

  /** Which outside sign-in methods this deployment offers. */
  @Public()
  @Get('providers')
  providers() {
    return { google: this.googleAuth.isConfigured() };
  }

  private googleFlowCookieOptions(): CookieOptions {
    return {
      ...this.cookieOptions(),
      maxAge: GOOGLE_FLOW_MAX_AGE_MS,
      path: GOOGLE_FLOW_PATH,
    };
  }

  /**
   * Begin a Google sign-in: remember state + nonce in a short-lived cookie
   * and send the browser to Google. Throttled like login: each hit is a
   * redirect to a third party on someone's behalf.
   */
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Get('google')
  startGoogle(@Query('next') next: string | undefined, @Res() res: Response) {
    if (!this.googleAuth.isConfigured()) {
      return res.redirect('/login?error=google-unavailable');
    }
    const flow: GoogleFlow = {
      state: randomBytes(24).toString('base64url'),
      nonce: randomBytes(24).toString('base64url'),
      next: safeNext(next),
    };
    res.cookie(
      GOOGLE_FLOW_COOKIE,
      JSON.stringify(flow),
      this.googleFlowCookieOptions(),
    );
    return res.redirect(this.googleAuth.authorizationUrl(flow.state, flow.nonce));
  }

  /**
   * Google sends the browser back here (a top-level GET, so our Lax
   * cookies arrive: the flow cookie and, for a guest, the session cookie
   * that lets the guest row be upgraded rather than orphaned). Every
   * failure lands on /login with a reason; nothing is ever returned as a
   * bare error page.
   */
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Get('google/callback')
  async googleCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') providerError: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const { maxAge, ...clearOptions } = this.googleFlowCookieOptions();
    res.clearCookie(GOOGLE_FLOW_COOKIE, clearOptions);
    const fail = (reason: string) => res.redirect(`/login?error=${reason}`);

    let flow: GoogleFlow | null = null;
    try {
      flow = JSON.parse(req.cookies?.[GOOGLE_FLOW_COOKIE] ?? 'null');
    } catch {
      flow = null;
    }
    if (providerError) return fail('google-denied');
    if (!flow?.state || !state || flow.state !== state || !code) {
      return fail('google');
    }

    try {
      const profile = await this.googleAuth.exchange(code, flow.nonce);
      const guestId = this.authService.userIdFromToken(
        req.cookies?.[ACCESS_TOKEN_COOKIE],
      );
      const result = await this.authService.signInWithGoogle(profile, guestId);
      this.setAuthCookie(res, result);
      const params = new URLSearchParams({
        next: flow.next,
        outcome: result.outcome,
      });
      return res.redirect(`/auth/complete?${params.toString()}`);
    } catch (err) {
      this.logger.warn(`Google sign-in failed: ${(err as Error)?.message}`);
      return fail(
        err instanceof UnauthorizedException ? 'google-unverified' : 'google',
      );
    }
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
