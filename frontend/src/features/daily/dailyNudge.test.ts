import { describe, expect, it } from 'vitest';
import { nudgeMessage, shouldNudge } from './dailyNudge';

/**
 * The audience rule: only a live streak that has not banked today, and only
 * once per UTC day. Everything else stays quiet.
 */
describe('shouldNudge', () => {
  const base = {
    today: '2026-08-16',
    streak: 3,
    wonToday: false,
    lastNudged: null,
  };

  it('nudges a streak-holder who has not won today', () => {
    expect(shouldNudge(base)).toBe(true);
  });

  it('never nudges someone without a streak - non-players are left alone', () => {
    expect(shouldNudge({ ...base, streak: 0 })).toBe(false);
  });

  it('stays quiet once today is already won', () => {
    expect(shouldNudge({ ...base, wonToday: true })).toBe(false);
  });

  it('one nudge per day: a spent mark blocks the rest of the day', () => {
    expect(shouldNudge({ ...base, lastNudged: '2026-08-16' })).toBe(false);
  });

  it('yesterday’s mark does not block today', () => {
    expect(shouldNudge({ ...base, lastNudged: '2026-08-15' })).toBe(true);
  });
});

describe('nudgeMessage', () => {
  it('a one-day streak is not called a 1-day streak', () => {
    expect(nudgeMessage(1)).toContain('Your streak');
    expect(nudgeMessage(4)).toContain('4-day streak');
  });
});
