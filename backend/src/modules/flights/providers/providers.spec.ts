import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { ApiSpend } from '../entities/api-spend.entity';
import { BudgetService, currentPeriod } from '../services/budget.service';
import { withAffiliate } from './affiliate.util';
import { mapMatrixRows } from './travelpayouts.provider';
import { mapCalendarRows, monthDateRange } from './serpapi.provider';
import { SurfaceQuery } from './flight-provider.interface';

/**
 * Search v2 M1: the provider mappers (everything a surface price must
 * carry), the affiliate rule (kiwi.com only, never break a link), and the
 * budget gate (caps enforced, uncapped means yes).
 */

const query: SurfaceQuery = {
  origin: 'SOF',
  destination: 'NRT',
  month: '2026-10-01',
  roundTrip: true,
};

describe('mapMatrixRows (Travelpayouts)', () => {
  it('maps rows and stamps them as estimates', () => {
    const points = mapMatrixRows(
      [{ depart_date: '2026-10-03', return_date: '2026-10-10', value: 512 }],
      query,
      '2026-08-16T00:00:00Z',
    );
    expect(points).toHaveLength(1);
    expect(points[0]).toMatchObject({
      origin: 'SOF',
      destination: 'NRT',
      departureDate: '2026-10-03',
      returnDate: '2026-10-10',
      price: 512,
      provider: 'travelpayouts',
      isEstimate: true,
    });
  });

  it('drops zero/invalid prices and one-way rows on a round-trip surface', () => {
    const points = mapMatrixRows(
      [
        { depart_date: '2026-10-03', value: 0 },
        { depart_date: '2026-10-04', value: NaN },
        { depart_date: '2026-10-05', value: 300 }, // no return_date
      ],
      query,
      '2026-08-16T00:00:00Z',
    );
    expect(points).toHaveLength(0);
  });
});

describe('mapCalendarRows (SerpApi)', () => {
  it('maps priced cells and skips the priceless', () => {
    const points = mapCalendarRows(
      [
        { departure: '2026-10-03', return: '2026-10-09', price: 640 },
        { departure: '2026-10-04', return: '2026-10-10' },
      ],
      query,
      '2026-08-16T00:00:00Z',
    );
    expect(points).toHaveLength(1);
    expect(points[0].provider).toBe('serpapi');
  });
});

describe('monthDateRange', () => {
  it('spans the month and clamps the start to today', () => {
    expect(monthDateRange('2026-10-01', '2026-08-16')).toEqual({
      from: '2026-10-01',
      to: '2026-10-31',
    });
    expect(monthDateRange('2026-08-01', '2026-08-16')).toEqual({
      from: '2026-08-16',
      to: '2026-08-31',
    });
  });

  it('a fully past month has no searchable days', () => {
    expect(monthDateRange('2026-07-01', '2026-08-16')).toBeNull();
  });
});

describe('withAffiliate', () => {
  it('marks kiwi.com links and only kiwi.com links', () => {
    expect(withAffiliate('https://www.kiwi.com/deep?flightsId=1', 'ctr123')).toContain(
      'affilid=ctr123',
    );
    expect(
      withAffiliate('https://www.airline.example/book', 'ctr123'),
    ).toBe('https://www.airline.example/book');
  });

  it('no marker or broken URL = link untouched', () => {
    expect(withAffiliate('https://www.kiwi.com/deep', undefined)).toBe(
      'https://www.kiwi.com/deep',
    );
    expect(withAffiliate('not a url', 'ctr123')).toBe('not a url');
  });
});

describe('BudgetService.canSpend', () => {
  function makeService(capEnv: Record<string, string>, used: number | null) {
    const config = {
      get: (key: string) => capEnv[key],
    } as unknown as ConfigService;
    const repo = {
      findOne: jest
        .fn()
        .mockResolvedValue(used === null ? null : { calls: used }),
    } as unknown as Repository<ApiSpend>;
    return new BudgetService(config, repo);
  }

  it('uncapped providers always may spend', async () => {
    const service = makeService({}, 19_999);
    await expect(service.canSpend('kiwi', 100)).resolves.toBe(true);
  });

  it('enforces the cap across the month, first call included', async () => {
    const service = makeService({ BUDGET_KIWI_CALLS: '100' }, 99);
    await expect(service.canSpend('kiwi', 1)).resolves.toBe(true);
    await expect(service.canSpend('kiwi', 2)).resolves.toBe(false);
    const fresh = makeService({ BUDGET_KIWI_CALLS: '100' }, null);
    await expect(fresh.canSpend('kiwi', 100)).resolves.toBe(true);
    await expect(fresh.canSpend('kiwi', 101)).resolves.toBe(false);
  });
});

describe('currentPeriod', () => {
  it('is the UTC year-month', () => {
    expect(currentPeriod(new Date('2026-08-16T23:59:59Z'))).toBe('2026-08');
  });
});
