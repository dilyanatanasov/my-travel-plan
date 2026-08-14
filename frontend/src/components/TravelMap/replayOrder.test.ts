import { describe, it, expect } from 'vitest';
import { orderJourneysForReplay } from './replayOrder';
import type { FlightJourney } from '../../types';

/**
 * The sequence the replay flies — now user-controlled through sortIndex
 * (2026-08-14), so its rules join the critical suite: dated chronologically
 * with sortIndex breaking same-date ties, undated after everything by
 * sortIndex alone.
 */

const journey = (
  id: number,
  journeyDate: string | null,
  sortIndex: number,
  createdAt = `2026-01-0${id}T00:00:00Z`,
): FlightJourney =>
  ({ id, journeyDate, sortIndex, createdAt }) as unknown as FlightJourney;

const ids = (list: FlightJourney[]) => list.map((j) => j.id);

describe('orderJourneysForReplay', () => {
  it('flies dated journeys chronologically, undated after them', () => {
    const out = orderJourneysForReplay([
      journey(1, null, 10),
      journey(2, '2026-07-01', 2),
      journey(3, '2025-03-15', 3),
    ]);
    expect(ids(out)).toEqual([3, 2, 1]);
  });

  it('breaks same-date ties by sortIndex, not creation or input order', () => {
    const out = orderJourneysForReplay([
      journey(1, '2026-05-10', 9, '2026-01-01T00:00:00Z'),
      journey(2, '2026-05-10', 4, '2026-01-05T00:00:00Z'),
    ]);
    // Lower sortIndex plays first even though it was created later.
    expect(ids(out)).toEqual([2, 1]);
  });

  it('orders undated journeys purely by sortIndex', () => {
    const out = orderJourneysForReplay([
      journey(1, null, 30),
      journey(2, null, 10),
      journey(3, null, 20),
    ]);
    expect(ids(out)).toEqual([2, 3, 1]);
  });

  it('falls back to createdAt for rows cached before sortIndex existed', () => {
    const legacy = (id: number, createdAt: string) =>
      ({ id, journeyDate: null, createdAt }) as unknown as FlightJourney;
    const out = orderJourneysForReplay([
      legacy(1, '2026-02-01T00:00:00Z'),
      legacy(2, '2026-01-01T00:00:00Z'),
    ]);
    expect(ids(out)).toEqual([2, 1]);
  });

  it('handles an empty list', () => {
    expect(orderJourneysForReplay([])).toEqual([]);
  });
});
