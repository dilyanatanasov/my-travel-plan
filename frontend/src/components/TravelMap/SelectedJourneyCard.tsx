import { useEffect } from 'react';
import type { FlightJourney } from '../../types';
import { formatJourneyDate } from '../../utils/journeyDate';

interface SelectedJourneyCardProps {
  journey: FlightJourney;
  onClose: () => void;
  /** Opens the trip boarding-pass dialog (trip share, 2026-08-14). */
  onShare?: () => void;
}

/**
 * Names the journey currently animating on the map.
 *
 * Without this the highlight is a pretty animation with no explanation — you
 * can see something is selected but not what, or how to get rid of it.
 */
function SelectedJourneyCard({
  journey,
  onClose,
  onShare,
}: SelectedJourneyCardProps) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const legs = [...(journey.legs ?? [])].sort(
    (a, b) => a.legOrder - b.legOrder
  );

  const route = legs.length
    ? [
        legs[0].departureAirport?.iataCode,
        ...legs.map((leg) => leg.arrivalAirport?.iataCode),
      ]
        .filter(Boolean)
        .join(' → ')
    : '';

  const distance = legs.reduce(
    (sum, leg) => sum + (Number(leg.distanceKm) || 0),
    0
  );

  const date = formatJourneyDate(journey);

  return (
    <div
      role="status"
      aria-live="polite"
      // The card sits inside the map, whose container clears the selection on
      // any unhandled click. Without this, reading the card would dismiss it.
      onClick={(event) => event.stopPropagation()}
      className="map-glass absolute z-20 left-3 right-3 sm:right-auto sm:max-w-sm bottom-20 lg:bottom-4 lg:left-auto lg:right-20 rounded-xl border shadow-xl px-3 py-2.5"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-sm font-semibold break-words leading-snug">
            {route}
          </p>
          <p className="text-xs map-glass-muted mt-0.5">
            {date ? `${date} · ` : ''}
            {legs.length} {legs.length === 1 ? 'leg' : 'legs'} ·{' '}
            {Math.round(distance).toLocaleString()} km
          </p>
          {journey.notes && (
            <p className="text-xs map-glass-muted mt-1 line-clamp-2">
              {journey.notes}
            </p>
          )}
        </div>
        {onShare && (
          <button
            type="button"
            onClick={onShare}
            aria-label="Share this trip"
            title="Share this trip"
            className="map-glass-hover flex-shrink-0 w-9 h-9 -mt-1 flex items-center justify-center rounded-lg map-glass-muted focus:outline-none focus:ring-2 focus:ring-brand-400"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8.684 13.342a3 3 0 100-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684zm0-9.316a3 3 0 105.368-2.684 3 3 0 00-5.368 2.684z"
              />
            </svg>
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label="Clear selected journey"
          className="map-glass-hover flex-shrink-0 w-9 h-9 -mr-1 -mt-1 flex items-center justify-center rounded-lg map-glass-muted focus:outline-none focus:ring-2 focus:ring-brand-400"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}

export default SelectedJourneyCard;
