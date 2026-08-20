import { memo, useEffect, useMemo, useRef, useState } from 'react';
import type { Airport, FlightJourney } from '../../types';
import {
  journeyRouteLabel,
  legEndpoints,
  stopClusterAnchor,
} from '../FlightMap/routeUtils';
import { formatJourneyDate } from '../../utils/journeyDate';
import CountryFlag from '../ui/CountryFlag';

interface StopDetailCardProps {
  /**
   * The tapped dot's stops, in the map's one vocabulary - a city poses
   * as an Airport (negative id, name in the iataCode slot). Usually one;
   * more when the dot is a merged place (Varna and its airport at any
   * zoom where they overlap), and then the card answers for the area.
   */
  stops: Airport[];
  journeys: FlightJourney[];
  /** Shared with the marker layer, so the card titles itself with the
      same rule the dot labels itself. */
  visitCounts: Map<string, number>;
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
  stops,
  journeys,
  visitCounts,
  onShowJourney,
  onClose,
}: StopDetailCardProps) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  // The same rule the marker labels itself with - one definition in
  // routeUtils, so the dot and its card can never disagree.
  const stop = stopClusterAnchor(stops, visitCounts).namer;
  const merged = stops.length > 1;
  const identity = stops.map((member) => member.iataCode).join('|');
  useEffect(() => {
    cardRef.current?.focus({ preventScroll: true });
  }, [identity]);

  const isCity = stop.id < 0;
  /*
    Which member the list is answering for (owner ask, 2026-08-20):
    null is "the whole area", a code narrows to one facility. This is
    what makes magnification unnecessary - you can inspect just the
    airport at any zoom, merged dot or not.
  */
  const [focus, setFocus] = useState<string | null>(null);
  // A different dot is a different question; never inherit a filter.
  useEffect(() => setFocus(null), [identity]);

  const touching = useMemo(() => {
    const codes = new Set(
      focus ? [focus] : stops.map((member) => member.iataCode),
    );
    return journeys.filter((journey) =>
      (journey.legs ?? []).some((leg) => {
        const endpoints = legEndpoints(leg);
        return (
          (endpoints && codes.has(endpoints.departure.iataCode)) ||
          (endpoints && codes.has(endpoints.arrival.iataCode))
        );
      }),
    );
    // identity stands in for the stops array, rebuilt every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [journeys, identity, focus]);

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
            {merged
              ? `${stops.length} stops in this area`
              : isCity
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

      {/* What the merged dot stands for - named, so nothing hides behind
          a collapsed marker, and tappable, so one facility can be read
          on its own without zooming in to separate the dots. */}
      {merged && (
        <div
          role="group"
          aria-label="Filter journeys by stop"
          className="flex flex-wrap gap-1.5 mt-3"
        >
          {[null, ...stops.map((member) => member.iataCode)].map((code) => {
            const member = stops.find((item) => item.iataCode === code);
            const active = focus === code;
            return (
              <button
                key={code ?? 'all'}
                type="button"
                aria-pressed={active}
                onClick={() => setFocus(code)}
                className={`inline-flex items-baseline gap-1 px-2 py-1 rounded-lg text-xs transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 ${
                  active
                    ? 'bg-secondary-600 text-white'
                    : 'bg-current/10 map-glass-hover'
                }`}
              >
                {member ? (
                  <>
                    <span className="font-mono font-bold">
                      {member.iataCode}
                    </span>
                    {member.id > 0 && member.city && (
                      <span
                        className={
                          active ? 'text-white/75' : 'map-glass-muted'
                        }
                      >
                        {member.city}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="font-medium">All</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {touching.length > 0 ? (
        <div className="mt-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide map-glass-muted">
            {touching.length} {touching.length === 1 ? 'journey' : 'journeys'}{' '}
            through {focus ?? 'here'}
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
          No journeys through {focus ?? 'here'} yet.
        </p>
      )}
    </div>
  );
}

export default memo(StopDetailCard);
