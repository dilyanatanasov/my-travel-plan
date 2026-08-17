import type { FlightResultDto } from '../../../types';
import type { SearchJudgement } from './useSmartSearch';

/**
 * How the streamed results are ordered and filtered for display — pure,
 * because a sort order is an opinion and opinions get tests.
 */

export type ResultSort = 'best' | 'price' | 'duration';

export interface ResultViewOptions {
  sort: ResultSort;
  /** null = any number of stops (per direction leg). */
  maxStops: number | null;
  /** Hide separate-booking (self-transfer) itineraries. */
  protectedOnly: boolean;
}

export const DEFAULT_VIEW: ResultViewOptions = {
  sort: 'best',
  maxStops: null,
  protectedOnly: false,
};

/**
 * "Best" keeps the funnel's own opinion on top: the recommended pick,
 * then the other judged roles, then everything else cheapest-first.
 */
export function sortAndFilterResults(
  results: FlightResultDto[],
  judgementById: Map<string, SearchJudgement>,
  view: ResultViewOptions,
): FlightResultDto[] {
  const filtered = results.filter((flight) => {
    if (view.protectedOnly && flight.selfTransfer) return false;
    if (view.maxStops !== null) {
      const worstLeg = Math.max(
        flight.outboundLeg.stopCount,
        flight.returnLeg?.stopCount ?? 0,
      );
      if (worstLeg > view.maxStops) return false;
    }
    return true;
  });

  const judgedRank = (id: string) => {
    const role = judgementById.get(id)?.role;
    return role === 'recommended' ? 0 : role ? 1 : 2;
  };

  // An estimate card has no real duration; letting its zero win "Fastest"
  // would crown a card that never flew.
  const duration = (flight: FlightResultDto) =>
    flight.isEstimate ? Number.POSITIVE_INFINITY : flight.totalDurationMinutes;

  return [...filtered].sort((a, b) => {
    if (view.sort === 'price') return a.lowestPrice - b.lowestPrice;
    if (view.sort === 'duration') return duration(a) - duration(b);
    return (
      judgedRank(a.itineraryId) - judgedRank(b.itineraryId) ||
      a.lowestPrice - b.lowestPrice
    );
  });
}
