import type { FlightJourney } from '../../types';
import type { ReplayState } from './useJourneyReplay';

/** SOF → AMS → KEF, from the leg chain. */
function routeLabel(journey: FlightJourney): string {
  const legs = [...journey.legs].sort((a, b) => a.legOrder - b.legOrder);
  if (legs.length === 0) return '';
  const stops = [legs[0].departureAirport.iataCode];
  for (const leg of legs) stops.push(leg.arrivalAirport.iataCode);
  return stops.join(' → ');
}

function monthLabel(journey: FlightJourney): string {
  if (!journey.journeyDate) return '';
  const date = new Date(journey.journeyDate);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}

interface ReplayControlProps {
  replay: ReplayState;
  /**
   * Icon-only, sized to sit in the zoom stack.
   *
   * Used for the idle state, where replay is one map tool among several
   * rather than a banner across the canvas.
   */
  compact?: boolean;
}

const iconProps = {
  className: 'w-4 h-4 flex-shrink-0',
  fill: 'currentColor',
  viewBox: '0 0 24 24',
  'aria-hidden': true,
} as const;

function PlayIcon() {
  return (
    <svg {...iconProps}>
      <path d="M8 5.5v13a1 1 0 001.53.85l10-6.5a1 1 0 000-1.7l-10-6.5A1 1 0 008 5.5z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg {...iconProps}>
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </svg>
  );
}

const buttonClass =
  'map-glass-hover flex items-center justify-center min-w-11 min-h-11 px-2 rounded-lg ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400';

/**
 * Transport controls for the journey replay.
 *
 * Play alone is not enough once someone has forty journeys: at a few seconds
 * each that is minutes of watching with no way to hurry it along or get out.
 * Pause, step and skip make the length of someone's history a feature rather
 * than a hostage situation.
 *
 * Hidden below two journeys — replaying one flight is just drawing it.
 */
function ReplayControl({ replay, compact = false }: ReplayControlProps) {
  /*
    Present but disabled below two journeys, rather than absent.

    Hiding it meant the feature simply did not exist for anyone who had not
    yet earned it — no hint that it was there, and no idea what to do to get
    it. A disabled control that says what it needs is a signpost; a missing
    one is a dead end.
  */
  if (replay.total < 2) {
    const reason =
      replay.total === 0
        ? 'Log two flights with dates to replay your travels'
        : 'Log one more dated flight to replay your travels';

    if (compact) {
      return (
        <button
          type="button"
          disabled
          aria-label={reason}
          title={reason}
          className="w-11 h-11 flex items-center justify-center map-glass
            first:rounded-t-lg opacity-40 cursor-not-allowed"
        >
          <PlayIcon />
        </button>
      );
    }

    return (
      <button
        type="button"
        disabled
        aria-label={reason}
        title={reason}
        className="map-glass flex items-center gap-2 min-h-11 px-3 rounded-xl border
          shadow-lg opacity-40 cursor-not-allowed"
      >
        <PlayIcon />
        <span className="text-sm font-medium">Replay</span>
      </button>
    );
  }

  if (!replay.isActive && compact) {
    return (
      <button
        type="button"
        onClick={replay.start}
        aria-label={`Replay ${replay.total} journeys in order`}
        title="Replay your journeys"
        /* Matches the zoom buttons exactly, so the stack reads as one
           control rather than a button with a lodger. */
        className="w-11 h-11 flex items-center justify-center map-glass map-glass-hover
          first:rounded-t-lg focus:outline-none focus-visible:ring-2
          focus-visible:ring-inset focus-visible:ring-brand-400"
      >
        <PlayIcon />
      </button>
    );
  }

  if (!replay.isActive) {
    return (
      <button
        type="button"
        onClick={replay.start}
        aria-label={`Replay ${replay.total} journeys in order`}
        className="map-glass map-glass-hover flex items-center gap-2 min-h-11 px-3 rounded-xl border shadow-lg
          focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
      >
        <PlayIcon />
        <span className="text-sm font-medium">Replay</span>
      </button>
    );
  }

  const trip = replay.current;

  return (
    <div
      className="map-glass rounded-xl border shadow-lg px-3 py-2 w-[17rem] max-w-[calc(100vw-1.5rem)]"
      role="group"
      aria-label="Replay controls"
    >
      {trip && (
        <p className="text-xs font-mono font-bold truncate">
          {routeLabel(trip)}
          <span className="map-glass-muted font-sans font-normal">
            {monthLabel(trip) ? ` · ${monthLabel(trip)}` : ''}
          </span>
        </p>
      )}

      <div className="flex items-center gap-1 mt-1">
        {/* tabular-nums so the counter does not jitter as it climbs. */}
        <span className="text-sm font-medium tabular-nums flex-shrink-0">
          {replay.index} / {replay.total}
        </span>

        <div className="flex-1" />

        <button
          type="button"
          onClick={replay.togglePause}
          aria-label={replay.isPaused ? 'Resume replay' : 'Pause replay'}
          className={buttonClass}
        >
          {replay.isPaused ? <PlayIcon /> : <PauseIcon />}
        </button>

        <button
          type="button"
          onClick={replay.next}
          disabled={replay.index >= replay.total}
          aria-label="Next journey"
          className={`${buttonClass} disabled:opacity-35`}
        >
          <svg {...iconProps}>
            <path d="M7 5.5v13a1 1 0 001.53.85l8-6.5a1 1 0 000-1.7l-8-6.5A1 1 0 007 5.5z" />
            <rect x="17" y="5" width="2.5" height="14" rx="1" />
          </svg>
        </button>

        <button
          type="button"
          onClick={replay.stopReplay}
          aria-label="Stop the replay and show the whole map"
          className={`${buttonClass} text-sm font-medium`}
        >
          Stop
        </button>
      </div>
    </div>
  );
}

export default ReplayControl;
