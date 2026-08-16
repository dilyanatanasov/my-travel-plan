import { FlightResultDto } from '../dto/flight-result.dto';
import { PricePoint } from '../providers/flight-provider.interface';

/**
 * The funnel's pure half (M2): candidate selection from the price surface,
 * the Pareto front over (price, total duration), and judgement copy from
 * real deltas. No I/O here — this file is where the search's opinions
 * live, and opinions get unit tests.
 */

export function nightsBetween(departure: string, ret: string): number {
  return Math.round(
    (Date.parse(ret) - Date.parse(departure)) / 86_400_000,
  );
}

/** Freshness window for a cached surface price, by lead time. */
export function surfaceTtlHours(departureDate: string, today: string): number {
  const leadDays = Math.round(
    (Date.parse(departureDate) - Date.parse(today)) / 86_400_000,
  );
  if (leadDays > 60) return 48;
  if (leadDays >= 14) return 12;
  return 4;
}

export interface CandidatePick {
  departureDate: string;
  returnDate: string | null;
  surfacePrice: number;
}

/** ISO-ish week bucket, good enough to spread picks across a month. */
function weekOf(date: string): number {
  return Math.floor(Date.parse(date) / (7 * 86_400_000));
}

/**
 * Top-K date pairs worth paying a precise search for: cheapest first, but
 * at most one per calendar week until every week is represented — a month
 * where Tuesday is always cheapest should still probe more than Tuesdays.
 */
export function selectCandidates(
  points: PricePoint[],
  options: { minNights?: number; maxNights?: number; k?: number },
): CandidatePick[] {
  const k = options.k ?? 8;
  const eligible = points.filter((point) => {
    if (!point.returnDate) {
      return options.minNights === undefined;
    }
    const nights = nightsBetween(point.departureDate, point.returnDate);
    if (options.minNights !== undefined && nights < options.minNights)
      return false;
    if (options.maxNights !== undefined && nights > options.maxNights)
      return false;
    return true;
  });

  // Cheapest observation per date pair, then cheapest-first overall.
  const byPair = new Map<string, PricePoint>();
  for (const point of eligible) {
    const key = `${point.departureDate}|${point.returnDate ?? ''}`;
    const existing = byPair.get(key);
    if (!existing || point.price < existing.price) byPair.set(key, point);
  }
  const sorted = [...byPair.values()].sort((a, b) => a.price - b.price);

  const picks: PricePoint[] = [];
  const weeksUsed = new Set<number>();
  for (const point of sorted) {
    if (picks.length >= k) break;
    const week = weekOf(point.departureDate);
    if (weeksUsed.has(week)) continue;
    weeksUsed.add(week);
    picks.push(point);
  }
  // Weeks exhausted before K: fill with the next-cheapest regardless.
  for (const point of sorted) {
    if (picks.length >= k) break;
    if (!picks.includes(point)) picks.push(point);
  }

  return picks.map((point) => ({
    departureDate: point.departureDate,
    returnDate: point.returnDate,
    surfacePrice: point.price,
  }));
}

/**
 * Non-dominated set on (lowestPrice, totalDurationMinutes): a result
 * survives unless something is both cheaper AND faster. Fixes the old
 * outbound-only scoring — the flight home counts too.
 */
export function paretoFront(results: FlightResultDto[]): FlightResultDto[] {
  return results.filter(
    (candidate) =>
      !results.some(
        (other) =>
          other !== candidate &&
          other.lowestPrice <= candidate.lowestPrice &&
          other.totalDurationMinutes <= candidate.totalDurationMinutes &&
          (other.lowestPrice < candidate.lowestPrice ||
            other.totalDurationMinutes < candidate.totalDurationMinutes),
      ),
  );
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
}

export interface Judgement {
  itineraryId: string;
  role: 'recommended' | 'cheapest' | 'fastest';
  whyRecommended: string;
}

/**
 * Judgement copy from real deltas: cheapness is anchored to the route's
 * observed median for the period (not this result set's own min/max, which
 * grades on a curve), speed to the fastest option actually found.
 */
export function judge(
  front: FlightResultDto[],
  medianPrice: number | null,
): Judgement[] {
  if (front.length === 0) return [];
  const cheapest = [...front].sort((a, b) => a.lowestPrice - b.lowestPrice)[0];
  const fastest = [...front].sort(
    (a, b) => a.totalDurationMinutes - b.totalDurationMinutes,
  )[0];

  // Recommended = best price-per-hour trade inside the front: normalize both
  // axes to the front's own spread and take the smallest combined distance.
  const priceSpan =
    Math.max(...front.map((r) => r.lowestPrice)) - cheapest.lowestPrice || 1;
  const timeSpan =
    Math.max(...front.map((r) => r.totalDurationMinutes)) -
      fastest.totalDurationMinutes || 1;
  const recommended = [...front].sort(
    (a, b) =>
      (a.lowestPrice - cheapest.lowestPrice) / priceSpan +
      (a.totalDurationMinutes - fastest.totalDurationMinutes) / timeSpan -
      ((b.lowestPrice - cheapest.lowestPrice) / priceSpan +
        (b.totalDurationMinutes - fastest.totalDurationMinutes) / timeSpan),
  )[0];

  const reasons = (result: FlightResultDto): string => {
    const parts: string[] = [];
    if (medianPrice !== null) {
      const delta = Math.round(medianPrice - result.lowestPrice);
      if (delta > 0) parts.push(`$${delta} under the period median`);
      else if (delta < 0) parts.push(`$${-delta} over the period median`);
    }
    const slower = result.totalDurationMinutes - fastest.totalDurationMinutes;
    if (slower === 0) parts.push('fastest option found');
    else parts.push(`${formatDuration(slower)} slower than the fastest`);
    return parts.join(', ');
  };

  const judgements: Judgement[] = [
    {
      itineraryId: recommended.itineraryId,
      role: 'recommended',
      whyRecommended: reasons(recommended),
    },
  ];
  if (cheapest.itineraryId !== recommended.itineraryId) {
    judgements.push({
      itineraryId: cheapest.itineraryId,
      role: 'cheapest',
      whyRecommended: reasons(cheapest),
    });
  }
  if (
    fastest.itineraryId !== recommended.itineraryId &&
    fastest.itineraryId !== cheapest.itineraryId
  ) {
    judgements.push({
      itineraryId: fastest.itineraryId,
      role: 'fastest',
      whyRecommended: reasons(fastest),
    });
  }
  return judgements;
}
