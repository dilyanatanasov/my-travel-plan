import { useMemo } from 'react';
import type { FlightJourney } from '../../types';
import type { ReplayState } from './useJourneyReplay';
import {
  journeyRouteLabel as routeLabel,
  legEndpoints,
} from '../FlightMap/routeUtils';
import { useToast } from '../Toast/ToastProvider';

function monthLabel(journey: FlightJourney): string {
  if (!journey.journeyDate) return '';
  const date = new Date(journey.journeyDate);
  if (Number.isNaN(date.getTime())) return '';
  // Year-precision journeys narrate as just the year — "Mar 2016" would
  // assert a month the user never gave.
  if (journey.datePrecision === 'year') return String(date.getFullYear());
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
  /** Cockpit-audio mute (2026-08-14); rendered only when both are given. */
  muted?: boolean;
  onToggleMuted?: () => void;
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
function ReplayControl({
  replay,
  compact = false,
  muted,
  onToggleMuted,
}: ReplayControlProps) {
  const { showToast } = useToast();

  /*
    The story gets a score: kilometres and countries accumulate as the
    replay progresses. Derived from what has actually been played so far,
    so pausing or stepping keeps the numbers honest.
  */
  const totals = useMemo(() => {
    let km = 0;
    const countries = new Set<string>();
    for (const journey of replay.played) {
      for (const leg of journey.legs ?? []) {
        km += Number(leg.distanceKm) || 0;
        const endpoints = legEndpoints(leg);
        if (endpoints?.departure.countryIso)
          countries.add(endpoints.departure.countryIso);
        if (endpoints?.arrival.countryIso)
          countries.add(endpoints.arrival.countryIso);
      }
    }
    return { km: Math.round(km), countries: countries.size };
  }, [replay.played]);

  /*
    Present but disabled below two journeys, rather than absent.

    Hiding it meant the feature simply did not exist for anyone who had not
    yet earned it — no hint that it was there, and no idea what to do to get
    it. A disabled control that says what it needs is a signpost; a missing
    one is a dead end.
  */
  if (replay.total < 2) {
    // Dates no longer gate the replay — undated journeys play in entry
    // order — so the only thing left to ask for is flights themselves.
    const reason =
      replay.total === 1
        ? 'Log one more flight to replay your travels'
        : 'Log two flights to replay your travels';

    /*
      aria-disabled + toast, not the disabled attribute: a disabled button
      swallows taps, which on a phone (no hover, no title tooltip) leaves no
      way to learn why it is off. Tapping now answers.
    */
    const explain = () => showToast(reason, { durationMs: 5000 });

    if (compact) {
      return (
        <button
          type="button"
          aria-disabled
          onClick={explain}
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
        aria-disabled
        onClick={explain}
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
        /* Replay is an explore verb, so its play mark speaks teal. */
        className="w-11 h-11 flex items-center justify-center map-glass map-glass-hover
          text-secondary-text first:rounded-t-lg focus:outline-none focus-visible:ring-2
          focus-visible:ring-inset focus-visible:ring-secondary-600"
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
          text-secondary-text focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary-600"
      >
        <PlayIcon />
        <span className="text-sm font-medium">Replay</span>
      </button>
    );
  }

  const trip = replay.current;

  return (
    <div
      className="map-glass rounded-xl border shadow-lg px-3 py-2 w-full"
      role="group"
      aria-label="Replay controls"
    >
      {/*
        The replay narrates itself.

        Everything the replay communicates is visual — a plane crossing arcs,
        countries lighting up — so without this a screen reader user starts it
        and hears nothing at all for the next several minutes. aria-live on
        the trip label turns it into "Sofia to Vienna, March 2024", once per
        journey, which is the replay's actual content rather than a
        description of the animation.

        polite, not assertive: it should wait its turn behind anything the
        user is doing, and it is narration, not an alert.
      */}
      {trip && (
        <p
          className="text-xs font-mono font-bold truncate"
          aria-live="polite"
          aria-atomic="true"
        >
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
        {/* Hidden on phones: as a flex item it refuses to shrink below its
            content, which shoved the buttons (mute included) off the card's
            edge — "there is no mute button". The step counter stays. */}
        <span className="hidden sm:inline min-w-0 text-[11px] map-glass-muted tabular-nums truncate ml-1.5">
          {totals.km.toLocaleString()} km ·{' '}
          {totals.countries}{' '}
          {totals.countries === 1 ? 'country' : 'countries'}
        </span>

        <div className="flex-1" />

        {onToggleMuted && (
          <button
            type="button"
            onClick={onToggleMuted}
            aria-label={muted ? 'Turn replay sound on' : 'Mute replay sound'}
            aria-pressed={!muted}
            className={buttonClass}
          >
            {muted ? (
              <svg {...iconProps}>
                <path d="M4 9v6h4l5 4V5L8 9H4z" />
                <path
                  d="M16 9l5 6m0-6l-5 6"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  fill="none"
                />
              </svg>
            ) : (
              <svg {...iconProps}>
                <path d="M4 9v6h4l5 4V5L8 9H4z" />
                <path
                  d="M16.5 8.5a5 5 0 010 7M19 6a8.5 8.5 0 010 12"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  fill="none"
                />
              </svg>
            )}
          </button>
        )}

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
