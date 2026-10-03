import { UnauthorizedException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { AuthService } from './auth.service';
import { User } from '../users/entities/user.entity';
import { UserIdentity } from './entities/user-identity.entity';
import { GoogleProfile, safeNext } from './google-auth.service';

/**
 * The resolution order is the whole security story of Google sign-in:
 * subject first, verified email second, the requesting guest third, a new
 * account last - and never anything for an unverified email. Pinned here
 * against a fake transaction manager.
 */

const profile = (overrides: Partial<GoogleProfile> = {}): GoogleProfile => ({
  subject: 'g-123',
  email: 'Ana@Example.com',
  emailVerified: true,
  name: 'Ana',
  ...overrides,
});

interface Fake {
  identities: Partial<UserIdentity>[];
  users: Partial<User>[];
  manager: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
  };
}

function fakeDb(users: Partial<User>[], identities: Partial<UserIdentity>[] = []): Fake {
  let nextId = 100;
  const manager = {
    findOne: jest.fn(async (entity: unknown, options: any) => {
      const where = options.where;
      if (entity === UserIdentity) {
        return (
          identities.find(
            (i) =>
              i.provider === where.provider &&
              i.providerSubject === where.providerSubject,
          ) ?? null
        );
      }
      return (
        users.find((u) =>
          Object.entries(where).every(([k, v]) => (u as any)[k] === v),
        ) ?? null
      );
    }),
    create: jest.fn((_entity: unknown, data: object) => ({ ...data })),
    save: jest.fn(async (row: any) => {
      if ('providerSubject' in row) {
        const saved = { id: nextId++, ...row };
        identities.push(saved);
        return saved;
      }
      if (row.id === undefined) row.id = nextId++;
      const index = users.findIndex((u) => u.id === row.id);
      if (index === -1) users.push(row);
      else users[index] = row;
      // The reload after linking expects identities on the user.
      row.identities = identities.filter((i) => i.userId === row.id);
      return row;
    }),
    update: jest.fn(async (_entity: unknown, where: any, patch: object) => {
      const user = users.find((u) => u.id === where.id);
      if (user) Object.assign(user, patch);
    }),
  };
  // findOne with relations: attach identities for the final reload.
  const originalFindOne = manager.findOne;
  manager.findOne = jest.fn(async (entity: unknown, options: any) => {
    const row = await originalFindOne(entity, options);
    if (row && entity === User && options.relations) {
      (row as any).identities = identities.filter((i) => i.userId === row.id);
    }
    return row;
  });
  return { identities, users, manager };
}

function serviceWith(db: Fake): AuthService {
  const dataSource = {
    transaction: jest.fn((fn: (m: unknown) => unknown) => fn(db.manager)),
  };
  const jwt = { sign: jest.fn(() => 'token') };
  return new AuthService(
    {} as never,
    jwt as never,
    {} as unknown as Repository<User>,
    dataSource as unknown as DataSource,
    {} as never,
    {} as never,
  );
}

describe('AuthService.signInWithGoogle', () => {
  it('refuses an unverified Google email before touching the database', async () => {
    const db = fakeDb([]);
    await expect(
      serviceWith(db).signInWithGoogle(profile({ emailVerified: false })),
    ).rejects.toThrow(UnauthorizedException);
    expect(db.manager.findOne).not.toHaveBeenCalled();
  });

  it('signs in the account already linked to this Google subject', async () => {
    const db = fakeDb(
      [{ id: 1, email: 'other@example.com', passwordHash: null, isGuest: false, emailVerified: true }],
      [{ id: 50, userId: 1, provider: 'google', providerSubject: 'g-123' }],
    );
    const result = await serviceWith(db).signInWithGoogle(profile());
    expect(result.outcome).toBe('login');
    expect(result.user.id).toBe(1);
    expect(result.user.providers).toEqual(['google']);
    expect(result.user.hasPassword).toBe(false);
    expect(db.identities).toHaveLength(1);
  });

  it('links to an existing password account with the same email and verifies it', async () => {
    const db = fakeDb([
      { id: 2, email: 'ana@example.com', passwordHash: 'hash', isGuest: false, emailVerified: false },
    ]);
    const result = await serviceWith(db).signInWithGoogle(profile());
    expect(result.outcome).toBe('login');
    expect(result.user.id).toBe(2);
    expect(result.user.hasPassword).toBe(true);
    expect(result.user.providers).toEqual(['google']);
    expect(db.users[0].emailVerified).toBe(true);
    expect(db.identities[0]).toMatchObject({ userId: 2, providerSubject: 'g-123' });
  });

  it('upgrades the requesting guest in place, keeping its id', async () => {
    const db = fakeDb([
      { id: 9, email: null, passwordHash: null, isGuest: true, emailVerified: false, displayName: null },
    ]);
    const result = await serviceWith(db).signInWithGoogle(profile(), 9);
    expect(result.outcome).toBe('guest_convert');
    expect(result.user.id).toBe(9);
    expect(result.user.isGuest).toBe(false);
    expect(result.user.email).toBe('ana@example.com');
    expect(result.user.emailVerified).toBe(true);
    expect(result.user.displayName).toBe('Ana');
    expect(db.identities[0]).toMatchObject({ userId: 9 });
  });

  it('ignores a guest id that is not a guest row', async () => {
    const db = fakeDb([
      { id: 3, email: 'someone@example.com', passwordHash: 'hash', isGuest: false, emailVerified: true },
    ]);
    const result = await serviceWith(db).signInWithGoogle(profile(), 3);
    expect(result.outcome).toBe('signup');
    expect(result.user.id).not.toBe(3);
  });

  it('creates a new verified, passwordless account otherwise', async () => {
    const db = fakeDb([]);
    const result = await serviceWith(db).signInWithGoogle(profile());
    expect(result.outcome).toBe('signup');
    expect(result.user.email).toBe('ana@example.com');
    expect(result.user.emailVerified).toBe(true);
    expect(result.user.hasPassword).toBe(false);
    expect(result.user.isGuest).toBe(false);
    expect(result.accessToken).toBe('token');
  });
});

describe('safeNext', () => {
  it.each([
    ['/', '/'],
    ['/settings', '/settings'],
    ['/search?x=1', '/search?x=1'],
    ['//evil.example', '/'],
    ['https://evil.example', '/'],
    ['/\\evil.example', '/'],
    [undefined, '/'],
    [42, '/'],
  ])('%p -> %p', (input, expected) => {
    expect(safeNext(input)).toBe(expected);
  });
});
