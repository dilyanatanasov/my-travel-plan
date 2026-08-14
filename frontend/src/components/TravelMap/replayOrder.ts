import type { FlightJourney } from '../../types';

/**
 * The order the replay flies: dated journeys chronologically, same-date ties
 * broken by the user-controlled sortIndex (2026-08-14 — no hours on
 * journeys, order is adjusted by hand instead); undated journeys after all
 * dated ones, purely by sortIndex, which starts as creation order.
 *
 * createdAt is the final fallback so rows cached before sortIndex existed
 * keep a stable, sensible order.
 */
export function orderJourneysForReplay(
  journeys: FlightJourney[],
): FlightJourney[] {
  const bySortIndex = (a: FlightJourney, b: FlightJourney) =>
    (a.sortIndex ?? 0) - (b.sortIndex ?? 0) ||
    a.createdAt.localeCompare(b.createdAt);
  const dated = journeys
    .filter((journey) => journey.journeyDate)
    .sort(
      (a, b) =>
        (a.journeyDate ?? '').localeCompare(b.journeyDate ?? '') ||
        bySortIndex(a, b),
    );
  const undated = journeys
    .filter((journey) => !journey.journeyDate)
    .sort(bySortIndex);
  return [...dated, ...undated];
}
