import { describe, it, expect } from 'vitest';
import { moveStop, loopStatus } from './stopChain';
import type { Airport } from '../../types';

const airport = (id: number) => ({ id }) as unknown as Airport;

describe('moveStop', () => {
  const chain = [airport(1), airport(2), airport(3)];

  it('swaps a stop with its neighbour, immutably', () => {
    const up = moveStop(chain, 1, -1);
    expect(up.map((a) => a?.id)).toEqual([2, 1, 3]);
    const down = moveStop(chain, 1, 1);
    expect(down.map((a) => a?.id)).toEqual([1, 3, 2]);
    // The original is untouched.
    expect(chain.map((a) => a?.id)).toEqual([1, 2, 3]);
  });

  it('refuses to move past either end', () => {
    expect(moveStop(chain, 0, -1)).toBe(chain);
    expect(moveStop(chain, 2, 1)).toBe(chain);
    expect(moveStop(chain, -1, 1)).toBe(chain);
    expect(moveStop(chain, 3, -1)).toBe(chain);
  });

  it('moves empty rows like any other stop', () => {
    const withNull = [airport(1), null, airport(3)];
    expect(moveStop(withNull, 1, 1).map((a) => a?.id)).toEqual([1, 3, undefined]);
  });
});

describe('loopStatus', () => {
  it('is a loop when the chain ends where it started', () => {
    expect(loopStatus([airport(1), airport(2), airport(1)])).toBe('loop');
  });

  it('is broken when both ends are known and differ', () => {
    expect(loopStatus([airport(1), airport(2)])).toBe('broken');
  });

  it('is unknown while either end is empty or the chain is short', () => {
    expect(loopStatus([])).toBe('unknown');
    expect(loopStatus([airport(1)])).toBe('unknown');
    expect(loopStatus([null, airport(2)])).toBe('unknown');
    expect(loopStatus([airport(1), null])).toBe('unknown');
  });
});
