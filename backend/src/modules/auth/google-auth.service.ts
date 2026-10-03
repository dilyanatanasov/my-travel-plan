import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import { appUrl } from '../../common/app-url';

/** What we keep from Google's ID token: the stable id, and the email. */
export interface GoogleProfile {
  subject: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
}

/**
 * Only a same-origin path may follow a sign-in. Anything else - another
 * host, a protocol-relative `//evil`, a backslash trick - is an open
 * redirect through our login, so it collapses to the map.
 */
export function safeNext(next: unknown): string {
  if (typeof next !== 'string') return '/';
  if (!next.startsWith('/') || next.startsWith('//') || next.includes('\\')) {
    return '/';
  }
  return next;
}

/**
 * Google OpenID Connect, authorization-code flow (2026-10-03).
 *
 * The authorization URL is built by hand (it is four parameters); the code
 * exchange and the ID-token signature check go through google-auth-library,
 * which fetches and caches Google's signing keys. Unset client credentials
 * mean the feature is off: the frontend asks /auth/providers and hides the
 * button, so dev and CI never show a door that leads nowhere.
 */
@Injectable()
export class GoogleAuthService {
  constructor(private readonly config: ConfigService) {}

  private get clientId(): string | undefined {
    return this.config.get<string>('GOOGLE_CLIENT_ID') || undefined;
  }

  private get clientSecret(): string | undefined {
    return this.config.get<string>('GOOGLE_CLIENT_SECRET') || undefined;
  }

  isConfigured(): boolean {
    return Boolean(this.clientId && this.clientSecret);
  }

  /** Must match an authorized redirect URI on the Google OAuth client. */
  redirectUri(): string {
    return `${appUrl(this.config)}/api/auth/google/callback`;
  }

  authorizationUrl(state: string, nonce: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId ?? '',
      redirect_uri: this.redirectUri(),
      response_type: 'code',
      scope: 'openid email profile',
      state,
      nonce,
      // Always offer the account chooser: someone with two Google accounts
      // must be able to pick, and a silent re-login into the wrong one is
      // the confusing failure.
      prompt: 'select_account',
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  /** Trade the one-time code for a verified profile. */
  async exchange(code: string, nonce: string): Promise<GoogleProfile> {
    const client = new OAuth2Client({
      clientId: this.clientId,
      clientSecret: this.clientSecret,
      redirectUri: this.redirectUri(),
    });
    const { tokens } = await client.getToken(code);
    if (!tokens.id_token) {
      throw new UnauthorizedException('Google returned no identity token');
    }
    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: this.clientId,
    });
    const payload = ticket.getPayload();
    if (!payload?.sub || !payload.email) {
      throw new UnauthorizedException('Google returned no account');
    }
    // The nonce ties this token to the browser that started the flow.
    if (payload.nonce !== nonce) {
      throw new UnauthorizedException('Sign-in session mismatch');
    }
    return {
      subject: payload.sub,
      email: payload.email,
      emailVerified: payload.email_verified === true,
      name: payload.name ?? null,
    };
  }
}
