import { memo, useEffect, useMemo, useRef } from 'react';
import type { Airport, FlightJourney } from '../../types';
import { journeyRouteLabel, legEndpoints } from '../FlightMap/routeUtils';
import { formatJourneyDate } from '../../utils/journeyDate';
import CountryFlag from '../ui/CountryFlag';

interface StopDetailCardProps {
  /** The tapped stop, in the map's one vocabulary - a city poses as an
      Airport (negative id, name in the iataCode slot). */
  stop: Airport;
  journeys: FlightJourney[];
  onShowJourney: (journeyId: number) => void;
  onClose: () => void;
}

/**
 * The stop card (owner ask, 2026-08-19: "should we allow clicking on
 * cities? like we do for country"). Tapping an airport or city marker
 * opens this - the country card's little sibling: where the stop is,
 * and every journey that passes through it, each tappable to fly it.
 * It shares the country/journey card berth and is never open beside
 * them; TravelMap enforces that, the same way the other two do.
 */
function StopDetailCard({
  stop,
  journeys,
  onShowJourney,
  onClose,
}: StopDetailCardProps) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    cardRef.current?.focus({ preventScroll: true });
  }, [stop.iataCode]);

  const isCity = stop.id < 0;
  const touching = useMemo(
    () =>
      journeys.filter((journey) =>
        (journey.legs ?? []).some((leg) => {
          const endpoints = legEndpoints(leg);
          return (
            endpoints?.departure.iataCode === stop.iataCode ||
            endpoints?.arrival.iataCode === stop.iataCode
          );
        }),
      ),
    [journeys, stop.iataCode],
  );

  return (
    <div
      ref={cardRef}
      tabIndex={-1}
      role="dialog"
      aria-label={`${stop.iataCode} details`}
      className="map-glass rounded-2xl border shadow-xl p-4 w-full max-w-sm [max-height:min(100%,60dvh)] sm:[max-height:100%] overflow-y-auto overscroll-contain pointer-events-auto focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
      onKeyDown={(event) => {
        if (event.key === 'Escape') onClose();
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-display font-normal text-xl leading-tight truncate">
            {stop.countryIso && (
              <CountryFlag iso2={stop.countryIso} className="mr-2 align-baseline" />
            )}
            {stop.iataCode}
          </h3>
          <p className="text-xs map-glass-muted mt-0.5 truncate">
            {isCity
              ? 'City stop'
              : [stop.name, stop.city].filter(Boolean).join(' · ')}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="map-glass-hover flex-shrink-0 w-9 h-9 -mr-1 -mt-1 flex items-center justify-center rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
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

      {touching.length > 0 ? (
        <div className="mt-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide map-glass-muted">
            {touching.length} {touching.length === 1 ? 'journey' : 'journeys'}{' '}
            through here
          </p>
          <ul className="mt-1.5 space-y-1 max-h-36 overflow-y-auto overscroll-contain pr-1">
            {touching.map((journey) => (
              <li key={journey.id}>
                <button
                  type="button"
                  onClick={() => onShowJourney(journey.id)}
                  className="map-glass-hover w-full text-left px-2 py-1.5 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
                >
                  <span className="font-mono font-bold text-xs">
                    {journeyRouteLabel(journey)}
                  </span>
                  <span className="block text-[11px] map-glass-muted">
                    {formatJourneyDate(journey) ?? 'No date'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-xs map-glass-muted mt-3">
          No journeys through here yet.
        </p>
      )}
    </div>
  );
}

export default memo(StopDetailCard);
