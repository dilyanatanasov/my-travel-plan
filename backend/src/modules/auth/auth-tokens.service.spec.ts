import { createHash } from 'crypto';
import { IsNull, Repository } from 'typeorm';
import { AuthTokensService, TOKEN_TTL_MS } from './auth-tokens.service';
import { AuthToken } from './entities/auth-token.entity';

/**
 * Security-critical invariants: tokens are stored only as hashes, issuing
 * invalidates the previous email's link, and redemption is single-use even
 * when two requests race. The repository is mocked — these tests pin the
 * service's contract, not TypeORM.
 */

type MockRepo = {
  update: jest.Mock;
  save: jest.Mock;
  create: jest.Mock;
  findOne: jest.Mock;
};

const sha256 = (raw: string) => createHash('sha256').update(raw).digest('hex');

describe('AuthTokensService', () => {
  let repo: MockRepo;
  let service: AuthTokensService;

  beforeEach(() => {
    repo = {
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      save: jest.fn().mockImplementation(async (entity) => entity),
      create: jest.fn().mockImplementation((entity) => entity),
      findOne: jest.fn(),
    };
    service = new AuthTokensService(
      repo as unknown as Repository<AuthToken>,
    );
  });

  describe('issue', () => {
    it('invalidates every outstanding token of the same type first', async () => {
      await service.issue(7, 'reset');
      expect(repo.update).toHaveBeenCalledWith(
        { userId: 7, type: 'reset', usedAt: IsNull() },
        { usedAt: expect.any(Date) },
      );
    });

    it('stores only the SHA-256, never the raw token', async () => {
      const raw = await service.issue(7, 'verify');
      const saved = repo.save.mock.calls[0][0];
      expect(saved.tokenHash).toBe(sha256(raw));
      expect(saved.tokenHash).not.toBe(raw);
      expect(JSON.stringify(saved)).not.toContain(raw);
    });

    it('issues high-entropy url-safe tokens', async () => {
      const raw = await service.issue(7, 'verify');
      // 32 bytes → 43 base64url chars, no padding or unsafe characters.
      expect(raw).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(raw).not.toBe(await service.issue(7, 'verify'));
    });

    it('applies the per-type TTL: tight for reset, a day for verify', async () => {
      for (const type of ['reset', 'verify'] as const) {
        repo.save.mockClear();
        const before = Date.now();
        await service.issue(7, type);
        const saved = repo.save.mock.calls[0][0];
        const ttl = saved.expiresAt.getTime() - before;
        expect(ttl).toBeGreaterThan(TOKEN_TTL_MS[type] - 5000);
        expect(ttl).toBeLessThanOrEqual(TOKEN_TTL_MS[type] + 5000);
      }
    });
  });

  describe('redeem', () => {
    const raw = 'some-raw-token';
    const validToken = () => ({
      id: 42,
      userId: 7,
      expiresAt: new Date(Date.now() + 60_000),
    });

    it('looks tokens up by hash and type, unused only', async () => {
      repo.findOne.mockResolvedValue(validToken());
      await service.redeem(raw, 'reset');
      expect(repo.findOne).toHaveBeenCalledWith({
        where: { tokenHash: sha256(raw), type: 'reset', usedAt: IsNull() },
      });
    });

    it('returns the owner and burns the token on success', async () => {
      repo.findOne.mockResolvedValue(validToken());
      await expect(service.redeem(raw, 'reset')).resolves.toBe(7);
      expect(repo.update).toHaveBeenCalledWith(
        { id: 42, usedAt: IsNull() },
        { usedAt: expect.any(Date) },
      );
    });

    it('rejects unknown tokens with null, not an explanation', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.redeem(raw, 'reset')).resolves.toBeNull();
    });

    it('rejects expired tokens without burning anything', async () => {
      repo.findOne.mockResolvedValue({
        ...validToken(),
        expiresAt: new Date(Date.now() - 1000),
      });
      await expect(service.redeem(raw, 'reset')).resolves.toBeNull();
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('loses the race gracefully: second claim of the same token fails', async () => {
      repo.findOne.mockResolvedValue(validToken());
      // The concurrent request already flipped usedAt — affected: 0.
      repo.update.mockResolvedValue({ affected: 0 });
      await expect(service.redeem(raw, 'reset')).resolves.toBeNull();
    });
  });
});
