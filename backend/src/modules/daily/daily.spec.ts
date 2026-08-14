import { BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';
import {
  computeStats,
  todayUtc,
  DailyService,
} from './daily.service';
import { DailyResult } from './daily-result.entity';

/**
 * The streak math and the two anti-cheat rules: only today is writable,
 * and the first result of a day is the result of record.
 */

describe('computeStats', () => {
  const today = '2026-08-20';

  it('is empty for a new player', () => {
    expect(computeStats([], today)).toEqual({
      played: 0,
      won: 0,
      streak: 0,
      maxStreak: 0,
      lastWonDate: null,
    });
  });

  it('counts a live streak anchored at today', () => {
    const rows = [
      { date: '2026-08-18', won: true },
      { date: '2026-08-19', won: true },
      { date: '2026-08-20', won: true },
    ];
    expect(computeStats(rows, today)).toMatchObject({
      streak: 3,
      maxStreak: 3,
      won: 3,
    });
  });

  it('keeps the streak alive when today is not yet played', () => {
    const rows = [
      { date: '2026-08-18', won: true },
      { date: '2026-08-19', won: true },
    ];
    expect(computeStats(rows, today).streak).toBe(2);
  });

  it('a loss today ends the current streak but history keeps the max', () => {
    const rows = [
      { date: '2026-08-17', won: true },
      { date: '2026-08-18', won: true },
      { date: '2026-08-19', won: false },
      { date: '2026-08-20', won: true },
    ];
    expect(computeStats(rows, today)).toMatchObject({
      streak: 1,
      maxStreak: 2,
    });
  });

  it('a gap of unplayed days breaks the chain', () => {
    const rows = [
      { date: '2026-08-15', won: true },
      { date: '2026-08-16', won: true },
      { date: '2026-08-20', won: true },
    ];
    expect(computeStats(rows, today)).toMatchObject({
      streak: 1,
      maxStreak: 2,
    });
  });
});

describe('DailyService.record', () => {
  const execute = jest.fn().mockResolvedValue(undefined);
  const insertChain = {
    insert: () => insertChain,
    values: () => insertChain,
    orIgnore: () => insertChain,
    execute,
  };
  const repo = {
    createQueryBuilder: () => insertChain,
    find: jest.fn().mockResolvedValue([]),
  };
  const service = new DailyService(repo as unknown as Repository<DailyResult>);

  it('refuses any date that is not the server’s today', async () => {
    await expect(service.record(7, '2020-01-01', true, 3)).rejects.toThrow(
      BadRequestException,
    );
    expect(execute).not.toHaveBeenCalled();
  });

  it('records today and returns stats', async () => {
    const stats = await service.record(7, todayUtc(), true, 3);
    expect(execute).toHaveBeenCalled();
    expect(stats.played).toBe(0); // mocked empty read-back
  });
});
