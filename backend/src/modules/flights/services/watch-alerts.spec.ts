import { shouldAlert, alertCopy } from './watch-alerts.util';

/**
 * The alert rules: threshold, trend, the 24h muzzle, and "only news is
 * news" — a price that isn't better than the last announcement is not an
 * announcement.
 */
describe('shouldAlert', () => {
  const now = new Date('2026-08-16T03:00:00Z');
  const base = {
    bestPrice: 450,
    thresholdPrice: null as number | null,
    trailingMin: null as number | null,
    lastNotifiedPrice: null as number | null,
    lastNotifiedAt: null as Date | null,
    now,
  };

  it('fires under the user threshold', () => {
    expect(shouldAlert({ ...base, thresholdPrice: 500 })).toBe(true);
    expect(shouldAlert({ ...base, thresholdPrice: 400 })).toBe(false);
  });

  it('fires more than 10% under the trailing minimum', () => {
    expect(shouldAlert({ ...base, trailingMin: 520 })).toBe(true); // 450 < 468
    expect(shouldAlert({ ...base, trailingMin: 480 })).toBe(false); // 450 > 432
  });

  it('never fires with no rule satisfied', () => {
    expect(shouldAlert(base)).toBe(false);
  });

  it('the 24h debounce muzzles even a qualifying drop', () => {
    expect(
      shouldAlert({
        ...base,
        thresholdPrice: 500,
        lastNotifiedAt: new Date('2026-08-15T10:00:00Z'),
        lastNotifiedPrice: 490,
      }),
    ).toBe(false);
  });

  it('after the debounce, only a better price than last announced fires', () => {
    const old = new Date('2026-08-13T03:00:00Z');
    expect(
      shouldAlert({
        ...base,
        thresholdPrice: 500,
        lastNotifiedAt: old,
        lastNotifiedPrice: 440, // 450 is worse news than 440
      }),
    ).toBe(false);
    expect(
      shouldAlert({
        ...base,
        thresholdPrice: 500,
        lastNotifiedAt: old,
        lastNotifiedPrice: 460,
      }),
    ).toBe(true);
  });
});

describe('alertCopy', () => {
  it('says the route, the month and the price', () => {
    const copy = alertCopy({
      origin: 'SOF',
      destination: 'NRT',
      month: '2026-10',
      bestPrice: 512.4,
    });
    expect(copy.title).toContain('SOF → NRT');
    expect(copy.body).toContain('October');
    expect(copy.body).toContain('$512');
  });
});
