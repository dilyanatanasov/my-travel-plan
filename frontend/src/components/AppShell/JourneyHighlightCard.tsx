import type { FlightJourney } from '../../types';
import { journeyRouteLabel } from '../FlightMap/routeUtils';
import { useMapFocus } from '../../features/map/MapFocusContext';

interface JourneyHighlightCardProps {
  journey: FlightJourney;
  /** "Next flight" / "Last flight" — what this journey is to the user. */
  kicker: string;
  /** Days until departure, or since landing. Omitted when the date is unknown. */
  relativeDays: number | null;
  isUpcoming: boolean;
}

function routeLabel(journey: FlightJourney): string {
  return journeyRouteLabel(journey) || 'No route';
}

function relativeLabel(days: number | null, isUpcoming: boolean): string | null {
  if (days === null) return null;
  if (days === 0) return 'Today';
  if (days === 1) return isUpcoming ? 'Tomorrow' : 'Yesterday';
  if (days < 30) return isUpcoming ? `In ${days} days` : `${days} days ago`;
  const months = Math.round(days / 30);
  if (months < 24) {
    return isUpcoming
      ? `In ${months} month${months === 1 ? '' : 's'}`
      : `${months} month${months === 1 ? '' : 's'} ago`;
  }
  const years = Math.round(days / 365);
  return isUpcoming ? `In ${years} years` : `${years} years ago`;
}

/**
 * One journey, promoted to the Overview and clickable.
 *
 * The whole card focuses the map on that route, which also closes the panel —
 * so the answer to "where was that?" is the map flying it, not a list entry
 * you have to go and find.
 */
function JourneyHighlightCard({
  journey,
  kicker,
  relativeDays,
  isUpcoming,
}: JourneyHighlightCardProps) {
  const { focusJourney } = useMapFocus();

  const distanceKm = journey.legs.reduce((sum, leg) => sum + leg.distanceKm, 0);
  const total = journey.isRoundTrip ? distanceKm * 2 : distanceKm;
  const relative = relativeLabel(relativeDays, isUpcoming);

  const date = journey.journeyDate
    ? new Date(journey.journeyDate).toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : 'No date';

  return (
    <button
      type="button"
      onClick={() => focusJourney(journey.id)}
      className="w-full text-left bg-surface border border-line rounded-2xl p-4 shadow-sm
        hover:border-brand-400 transition-colors
        focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-brand-700">
          {kicker}
        </span>
        {relative && (
          <span className="text-[11px] text-ink-subtle flex-shrink-0">{relative}</span>
        )}
      </div>

      <p className="font-mono font-bold text-base text-ink mt-1.5 truncate">
        {routeLabel(journey)}
      </p>

      <p className="text-xs text-ink-muted mt-1">
        {date} · {Math.round(total).toLocaleString()} km ·{' '}
        {journey.legs.length} {journey.legs.length === 1 ? 'leg' : 'legs'}
        {journey.isRoundTrip && ' · return'}
      </p>

      <span className="inline-block text-xs font-medium text-brand-700 mt-2">
        Show on map →
      </span>
    </button>
  );
}

export default JourneyHighlightCard;
