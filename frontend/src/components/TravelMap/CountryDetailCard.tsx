import { useEffect, useMemo, useRef } from 'react';
import type { Alpha2, FlightJourney, Visit, VisitType } from '../../types';

interface CountryDetailCardProps {
  countryName: string;
  /**
   * Alpha-2, because that is what airports store.
   *
   * The map keys countries by alpha-3 (from the TopoJSON's numeric ids) while
   * the airports table holds alpha-2 — "BGR" against "BG" silently matched
   * nothing, so a country with flights showed neither its airports nor its
   * journeys.
   */
  isoAlpha2: Alpha2 | null;
  visit: Visit | null;
  journeys: FlightJourney[];
  onClose: () => void;
  onChangeType: (type: VisitType) => void;
  onRemove: () => void;
  /** Fly the map to a journey, as the Overview cards do. */
  onShowJourney: (journeyId: number) => void;
}

const TYPE_LABELS: Record<VisitType, string> = {
  trip: 'Visited',
  transit: 'Transit',
  wishlist: 'Want to go',
  home: 'Home',
};

function formatDate(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** Route chain, e.g. SOF → AMS → KEF. */
function routeLabel(journey: FlightJourney): string {
  const legs = [...journey.legs].sort((a, b) => a.legOrder - b.legOrder);
  if (legs.length === 0) return '—';
  const stops = [legs[0].departureAirport.iataCode];
  for (const leg of legs) stops.push(leg.arrivalAirport.iataCode);
  return stops.join(' → ');
}

/**
 * What you did in one country.
 *
 * Tapping a visited country used to delete it. That made the map's only
 * interaction destructive, and a stray tap while panning could quietly remove
 * somewhere you had been. Now a tap opens this, and removal is a deliberate
 * button inside it — the map becomes something you read, not just something
 * you edit.
 *
 * Everything here is derived from data already held: no new endpoint.
 */
function CountryDetailCard({
  countryName,
  isoAlpha2,
  visit,
  journeys,
  onClose,
  onChangeType,
  onRemove,
  onShowJourney,
}: CountryDetailCardProps) {
  const { touchingJourneys, airports, firstSeen, lastSeen } = useMemo(() => {
    const touching = isoAlpha2
      ? journeys.filter((journey) =>
          journey.legs.some(
            (leg) =>
              leg.departureAirport.countryIso === isoAlpha2 ||
              leg.arrivalAirport.countryIso === isoAlpha2,
          ),
        )
      : [];

    const airportSet = new Map<string, string>();
    for (const journey of touching) {
      for (const leg of journey.legs) {
        for (const airport of [leg.departureAirport, leg.arrivalAirport]) {
          if (airport.countryIso === isoAlpha2) {
            airportSet.set(airport.iataCode, airport.city || airport.name);
          }
        }
      }
    }

    // Dates come from flights and from the visit itself, whichever exist.
    const dates: number[] = [];
    for (const journey of touching) {
      if (journey.journeyDate) {
        const time = new Date(journey.journeyDate).getTime();
        if (!Number.isNaN(time)) dates.push(time);
      }
    }
    if (visit?.visitedAt) {
      const time = new Date(visit.visitedAt).getTime();
      if (!Number.isNaN(time)) dates.push(time);
    }
    dates.sort((a, b) => a - b);

    return {
      touchingJourneys: [...touching].sort((a, b) =>
        (b.journeyDate ?? '').localeCompare(a.journeyDate ?? ''),
      ),
      airports: [...airportSet.entries()],
      firstSeen: dates.length ? new Date(dates[0]).toISOString() : null,
      lastSeen: dates.length > 1 ? new Date(dates[dates.length - 1]).toISOString() : null,
    };
  }, [journeys, isoAlpha2, visit]);

  const currentType: VisitType = visit?.visitType ?? 'trip';

  /*
    Escape closes the card.

    It is reachable from the keyboard — searching a visited country opens it —
    and it was not dismissible from the keyboard, so the only way out was to
    find the close button. Escape is what anyone tries first on a thing that
    floats over the page.

    Listener on document rather than the card, so it works whether or not
    focus has moved inside.
  */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  /*
    Move focus to the card when it opens.

    Without this the card appears while focus is still on the search result
    that opened it, so a screen reader says nothing and Tab continues from
    behind the card. tabIndex={-1} makes it focusable without adding a tab
    stop of its own.
  */
  const cardRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    cardRef.current?.focus();
  }, [countryName]);

  return (
    <div
      ref={cardRef}
      tabIndex={-1}
      role="dialog"
      aria-label={`${countryName} details`}
      className="map-glass rounded-2xl border shadow-xl p-4 w-full max-w-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-display font-normal text-xl leading-tight truncate">
            {countryName}
          </h3>
          <p className="text-xs map-glass-muted mt-0.5">
            {firstSeen
              ? lastSeen
                ? `${formatDate(firstSeen)} – ${formatDate(lastSeen)}`
                : formatDate(firstSeen)
              : 'No date recorded'}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={`Close ${countryName}`}
          className="map-glass-hover flex-shrink-0 w-9 h-9 -mr-1 -mt-1 flex items-center justify-center rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Visit type as a 2×2 grid: four states no longer fit one row —
          "Want to go" wrapped and squeezed the others. */}
      <div
        role="radiogroup"
        aria-label={`How you visited ${countryName}`}
        className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-current/10 mt-3"
      >
        {(Object.keys(TYPE_LABELS) as VisitType[]).map((type) => {
          const isActive = currentType === type;
          return (
            <button
              key={type}
              type="button"
              role="radio"
              aria-checked={isActive}
              onClick={() => onChangeType(type)}
              className={`flex-1 min-h-9 px-2 rounded-lg text-xs font-medium transition-colors
                focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 ${
                isActive ? 'bg-brand-600 text-white' : 'map-glass-hover'
              }`}
            >
              {TYPE_LABELS[type]}
            </button>
          );
        })}
      </div>

      {airports.length > 0 && (
        <div className="mt-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide map-glass-muted">
            Airports
          </p>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {airports.map(([iata, city]) => (
              <span
                key={iata}
                className="inline-flex items-baseline gap-1 px-2 py-1 rounded-lg bg-current/10 text-xs"
              >
                <span className="font-mono font-bold">{iata}</span>
                <span className="map-glass-muted truncate max-w-[7rem]">{city}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {touchingJourneys.length > 0 && (
        <div className="mt-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide map-glass-muted">
            {touchingJourneys.length}{' '}
            {touchingJourneys.length === 1 ? 'journey' : 'journeys'} through here
          </p>
          {/* Capped: a well-travelled country would otherwise push the actions
              off a phone screen. */}
          <ul className="mt-1.5 space-y-1">
            {touchingJourneys.slice(0, 4).map((journey) => (
              <li key={journey.id}>
                <button
                  type="button"
                  onClick={() => onShowJourney(journey.id)}
                  className="map-glass-hover w-full text-left px-2 py-1.5 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
                >
                  <span className="font-mono font-bold text-xs">
                    {routeLabel(journey)}
                  </span>
                  <span className="block text-[11px] map-glass-muted">
                    {formatDate(journey.journeyDate) ?? 'No date'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {touchingJourneys.length > 4 && (
            <p className="text-[11px] map-glass-muted mt-1">
              and {touchingJourneys.length - 4} more
            </p>
          )}
        </div>
      )}

      {visit?.notes && (
        <p className="text-xs mt-3 leading-relaxed">{visit.notes}</p>
      )}

      <button
        type="button"
        onClick={onRemove}
        className="mt-3 w-full min-h-10 rounded-xl text-sm font-medium text-danger hover:bg-danger-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
      >
        Remove {countryName}
      </button>
    </div>
  );
}

export default CountryDetailCard;
