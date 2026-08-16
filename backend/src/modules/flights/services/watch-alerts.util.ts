/**
 * The alert rules, pure (search v2 M4). A watch fires when the best
 * current price either dips under the user's own threshold, or undercuts
 * the route's 30-day trailing minimum by more than 10% — "cheaper than
 * anything this month has seen". Both are muzzled by a 24h debounce and
 * by never re-announcing a price that isn't better than the last one
 * announced.
 */

export interface AlertInput {
  bestPrice: number;
  thresholdPrice: number | null;
  /** Route's trailing 30-day minimum, null when history is empty. */
  trailingMin: number | null;
  lastNotifiedPrice: number | null;
  lastNotifiedAt: Date | null;
  now: Date;
}

const DEBOUNCE_MS = 24 * 60 * 60 * 1000;
const TREND_DROP = 0.1;

export function shouldAlert(input: AlertInput): boolean {
  if (
    input.lastNotifiedAt !== null &&
    input.now.getTime() - input.lastNotifiedAt.getTime() < DEBOUNCE_MS
  ) {
    return false;
  }
  // Only news is news: the price must beat the last one we announced.
  if (
    input.lastNotifiedPrice !== null &&
    input.bestPrice >= input.lastNotifiedPrice
  ) {
    return false;
  }

  const underThreshold =
    input.thresholdPrice !== null && input.bestPrice <= input.thresholdPrice;
  const underTrend =
    input.trailingMin !== null &&
    input.bestPrice < input.trailingMin * (1 - TREND_DROP);

  return underThreshold || underTrend;
}

export function alertCopy(watch: {
  origin: string;
  destination: string;
  month: string;
  bestPrice: number;
}): { title: string; body: string } {
  const monthName = new Date(`${watch.month}-01T00:00:00Z`).toLocaleDateString(
    'en-US',
    { month: 'long', timeZone: 'UTC' },
  );
  return {
    title: `✈️ ${watch.origin} → ${watch.destination} dropped`,
    body: `${monthName} trips from $${Math.round(watch.bestPrice)}. Prices move fast — worth a look.`,
  };
}
