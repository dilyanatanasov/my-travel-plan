import type { Airport } from '../../types';

/**
 * Helpers for editing a journey's stop chain (2026-08-14): stops can be
 * reordered in place, and the Round trip label must stay honest — a chain
 * that no longer ends where it started is not a round trip, whatever the
 * checkbox said before the edit.
 */

/** A new array with the stop at `index` moved one step in `direction`. */
export function moveStop(
  stops: (Airport | null)[],
  index: number,
  direction: -1 | 1,
): (Airport | null)[] {
  const target = index + direction;
  if (index < 0 || index >= stops.length) return stops;
  if (target < 0 || target >= stops.length) return stops;
  const next = [...stops];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

/**
 * Whether the chain is a closed loop. 'unknown' while either end is still
 * empty — the honesty rule only fires on what the user has actually said,
 * never on a row they are mid-way through editing.
 */
export function loopStatus(
  stops: (Airport | null)[],
): 'loop' | 'broken' | 'unknown' {
  if (stops.length < 2) return 'unknown';
  const first = stops[0];
  const last = stops[stops.length - 1];
  if (!first || !last) return 'unknown';
  return first.id === last.id ? 'loop' : 'broken';
}
