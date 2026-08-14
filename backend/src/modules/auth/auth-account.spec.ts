import { UnauthorizedException } from '@nestjs/common';
import { hash } from '@node-rs/argon2';
import { DataSource, Repository } from 'typeorm';
import { AuthService } from './auth.service';
import { User } from '../users/entities/user.entity';

/**
 * GDPR erasure is destructive and password-gated: a stolen session cookie
 * must not be enough to destroy an account. These specs pin the gate and
 * the cleanup order with mocked persistence.
 */

let passwordHash: string;
let userRepo: { findOne: jest.Mock; delete: jest.Mock; save: jest.Mock };
let dataSource: { query: jest.Mock };
let service: AuthService;

beforeAll(async () => {
  passwordHash = await hash('correct-horse');
});

beforeEach(() => {
  userRepo = { findOne: jest.fn(), delete: jest.fn(), save: jest.fn() };
  dataSource = { query: jest.fn() };
  service = new AuthService(
    {} as never,
    {} as never,
    userRepo as unknown as Repository<User>,
    dataSource as unknown as DataSource,
    {} as never,
    {} as never,
  );
});

const registered = () => ({ id: 7, passwordHash, isGuest: false });
const guest = () => ({ id: 9, passwordHash: null, isGuest: true });

describe('AuthService.deleteAccount', () => {

  it('refuses a registered account without the password', async () => {
    userRepo.findOne.mockResolvedValue(registered());
    await expect(service.deleteAccount(7)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(userRepo.delete).not.toHaveBeenCalled();
    expect(dataSource.query).not.toHaveBeenCalled();
  });

  it('refuses a wrong password without touching anything', async () => {
    userRepo.findOne.mockResolvedValue(registered());
    await expect(service.deleteAccount(7, 'wrong')).rejects.toThrow(
      UnauthorizedException,
    );
    expect(userRepo.delete).not.toHaveBeenCalled();
  });

  it('deletes a registered account with the right password, duels first', async () => {
    userRepo.findOne.mockResolvedValue(registered());
    await service.deleteAccount(7, 'correct-horse');
    expect(dataSource.query).toHaveBeenCalledWith(
      'DELETE FROM saved_duels WHERE user_id = $1',
      [7],
    );
    expect(userRepo.delete).toHaveBeenCalledWith(7);
  });

  it('lets a guest delete without any password', async () => {
    userRepo.findOne.mockResolvedValue(guest());
    await service.deleteAccount(9);
    expect(userRepo.delete).toHaveBeenCalledWith(9);
  });

  it('rejects an unknown session outright', async () => {
    userRepo.findOne.mockResolvedValue(null);
    await expect(service.deleteAccount(1)).rejects.toThrow(
      UnauthorizedException,
    );
  });
});

describe('AuthService.changePassword', () => {
  it('requires the current password to match', async () => {
    userRepo.findOne.mockResolvedValue(registered());
    await expect(
      service.changePassword(7, 'wrong', 'new-password-1'),
    ).rejects.toThrow(UnauthorizedException);
    expect(userRepo.save).not.toHaveBeenCalled();
  });

  it('stores a new hash — never the raw password', async () => {
    userRepo.findOne.mockResolvedValue(registered());
    await service.changePassword(7, 'correct-horse', 'new-password-1');
    const saved = userRepo.save.mock.calls[0][0];
    expect(saved.passwordHash).not.toBe(passwordHash);
    expect(saved.passwordHash).not.toContain('new-password-1');
  });

  it('refuses guests, who have no password to change', async () => {
    userRepo.findOne.mockResolvedValue(guest());
    await expect(
      service.changePassword(9, 'anything', 'new-password-1'),
    ).rejects.toThrow(UnauthorizedException);
  });
});
