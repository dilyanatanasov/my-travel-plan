import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { createHash, randomBytes } from 'crypto';
import { AuthToken, AuthTokenType } from './entities/auth-token.entity';

export const TOKEN_TTL_MS: Record<AuthTokenType, number> = {
  // Reset is a credential in transit — keep its window tight.
  reset: 60 * 60 * 1000,
  // Verification emails get read whenever people get to them.
  verify: 24 * 60 * 60 * 1000,
};

/**
 * Issue and redeem the single-use tokens behind email verification and
 * password reset. Raw tokens are 32 random bytes; only the SHA-256 is
 * stored (they are high-entropy, so a slow hash would add nothing).
 */
@Injectable()
export class AuthTokensService {
  constructor(
    @InjectRepository(AuthToken)
    private readonly tokenRepository: Repository<AuthToken>,
  ) {}

  private hashToken(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  /**
   * Create a token for the user, invalidating any outstanding ones of the
   * same type — the emailed link is always the most recent one sent.
   * Returns the raw token; this is the only moment it exists server-side.
   */
  async issue(userId: number, type: AuthTokenType): Promise<string> {
    await this.tokenRepository.update(
      { userId, type, usedAt: IsNull() },
      { usedAt: new Date() },
    );

    const raw = randomBytes(32).toString('base64url');
    await this.tokenRepository.save(
      this.tokenRepository.create({
        userId,
        type,
        tokenHash: this.hashToken(raw),
        expiresAt: new Date(Date.now() + TOKEN_TTL_MS[type]),
        usedAt: null,
      }),
    );
    return raw;
  }

  /**
   * Redeem a raw token: must match, be of the right type, unexpired and
   * unused. Marks it used and returns the owning user id, or null — the
   * caller turns null into one uniform error, never a reason.
   */
  async redeem(raw: string, type: AuthTokenType): Promise<number | null> {
    const token = await this.tokenRepository.findOne({
      where: { tokenHash: this.hashToken(raw), type, usedAt: IsNull() },
    });
    if (!token || token.expiresAt.getTime() < Date.now()) {
      return null;
    }

    // Atomic claim: if two requests race, only the one that flips usedAt wins.
    const claimed = await this.tokenRepository.update(
      { id: token.id, usedAt: IsNull() },
      { usedAt: new Date() },
    );
    if (!claimed.affected) {
      return null;
    }
    return token.userId;
  }
}
