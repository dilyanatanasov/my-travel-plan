import { describe, expect, it } from 'vitest';
import type { FlightResultDto } from '../../../types';
import type { SearchJudgement } from './useSmartSearch';
import { DEFAULT_VIEW, sortAndFilterResults } from './resultsView';

/**
 * The result view's opinions: "Best" keeps the funnel's judgement on top,
 * the stops filter reads the WORST direction, and "protected only" hides
 * split tickets without touching anything else.
 */

function flight(
  id: string,
  price: number,
  duration: number,
  stops: [number, number],
  split = false,
): FlightResultDto {
  return {
    itineraryId: id,
    lowestPrice: price,
    totalDurationMinutes: duration,
    outboundLeg: { stopCount: stops[0] } as FlightResultDto['outboundLeg'],
    returnLeg: { stopCount: stops[1] } as FlightResultDto['returnLeg'],
    ...(split
      ? { selfTransfer: { hub: 'IST', bookings: [] } }
      : {}),
  } as FlightResultDto;
}

const judged = new Map<string, SearchJudgement>([
  ['rec', { itineraryId: 'rec', role: 'recommended', whyRecommended: '' }],
  ['cheap', { itineraryId: 'cheap', role: 'cheapest', whyRecommended: '' }],
]);

const results = [
  flight('other', 500, 900, [1, 1]),
  flight('cheap', 400, 1200, [2, 1], true),
  flight('rec', 450, 800, [1, 0]),
];

describe('sortAndFilterResults', () => {
  it('"Best" puts the recommendation first, then judged, then cheapest', () => {
    const view = sortAndFilterResults(results, judged, DEFAULT_VIEW);
    expect(view.map((f) => f.itineraryId)).toEqual(['rec', 'cheap', 'other']);
  });

  it('price and duration sorts ignore the judgement', () => {
    expect(
      sortAndFilterResults(results, judged, { ...DEFAULT_VIEW, sort: 'price' }).map(
        (f) => f.itineraryId,
      ),
    ).toEqual(['cheap', 'rec', 'other']);
    expect(
      sortAndFilterResults(results, judged, {
        ...DEFAULT_VIEW,
        sort: 'duration',
      }).map((f) => f.itineraryId),
    ).toEqual(['rec', 'other', 'cheap']);
  });

  it('the stops filter judges the worst direction', () => {
    const view = sortAndFilterResults(results, judged, {
      ...DEFAULT_VIEW,
      maxStops: 1,
    });
    // 'cheap' has 2 stops outbound — out, even though its return has 1.
    expect(view.map((f) => f.itineraryId)).toEqual(['rec', 'other']);
  });

  it('protected-only hides split tickets', () => {
    const view = sortAndFilterResults(results, judged, {
      ...DEFAULT_VIEW,
      protectedOnly: true,
    });
    expect(view.map((f) => f.itineraryId)).toEqual(['rec', 'other']);
  });
});
