import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FlightJourney } from '../../types';
import { track } from '../../lib/analytics';

/**
 * How long each journey holds the screen.
 *
 * Long enough for the camera to settle, the plane to fly and the arrival to
 * register — roughly the plane's own flight time. Shorter felt like channel
 * hopping. Next and Skip exist for anyone who does not want to wait.
 */
const STEP_MS = 5200;

export interface ReplayState {
  /** True from the moment replay starts until it is stopped or finishes. */
  isActive: boolean;
  isPaused: boolean;
  /** The journey being drawn right now. */
  current: FlightJourney | null;
  /**
   * Everything flown up to and including the current step.
   *
   * The map draws these instead of the full route set, so the trail builds up
   * rather than sitting there fully drawn from the start.
   */
  played: FlightJourney[];
  /** 1-based, for "3 of 41". */
  index: number;
  total: number;
  start: () => void;
  stop: () => void;
  togglePause: () => void;
  next: () => void;
  /** End the replay and restore the finished map. */
  stopReplay: () => void;
}

/**
 * Play a traveller's journeys back in the order they happened.
 *
 * A map shows everywhere at once, which is accurate and completely flat: it
 * cannot say that Iceland came before Japan, or that one year was busier than
 * the next. Replay restores the sequence — and it starts from an empty map
 * and accumulates, because watching the trail *grow* is the whole point.
 * Merely dimming the routes that have not happened yet still shows the
 * finished picture from the first frame.
 *
 * Undated journeys play too (user decision, 2026-08-13, revising the earlier
 * skip): they follow the dated ones, ordered by when they were entered. Entry
 * order is not a guess — it is a sequence the user personally produced — and
 * skipping meant anyone who logs flights without dates simply had no replay.
 */
export function useJourneyReplay(journeys: FlightJourney[]): ReplayState {
  const [index, setIndex] = useState(-1);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef<number | null>(null);

  const ordered = useMemo(() => {
    const dated = journeys
      .filter((journey) => journey.journeyDate)
      .sort((a, b) => (a.journeyDate ?? '').localeCompare(b.journeyDate ?? ''));
    const undated = journeys
      .filter((journey) => !journey.journeyDate)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return [...dated, ...undated];
  }, [journeys]);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  /** Advance one step, ending the replay after the last journey. */
  const advance = useCallback(() => {
    setIndex((current) => {
      const next = current + 1;
      if (next >= ordered.length) {
        clearTimer();
        // Count only — does anyone watch to the end? (Never which journeys.)
        track('replay_complete', { journeys: ordered.length });
        /*
          Leave replay entirely rather than parking on the last journey.

          Holding there kept isActive true forever: the transport bar never
          went away, the idle play button never came back, and the map stayed
          in its replay rendering — showing only the flown-so-far routes as
          though the rest did not exist. Returning to idle restores the full
          map, which is the actual payoff.
        */
        return -1;
      }
      return next;
    });
  }, [ordered.length, clearTimer]);

  const runTimer = useCallback(() => {
    clearTimer();
    timerRef.current = window.setInterval(advance, STEP_MS);
  }, [advance, clearTimer]);

  const start = useCallback(() => {
    if (ordered.length === 0) return;
    track('replay_start', { journeys: ordered.length });
    setIndex(0);
    setIsPaused(false);
    runTimer();
  }, [ordered.length, runTimer]);

  const stop = useCallback(() => {
    clearTimer();
    setIndex(-1);
    setIsPaused(false);
  }, [clearTimer]);

  /*
    Side effects stay out of the state updater.

    Starting and stopping the interval inside setIsPaused looked tidy, but
    React invokes updaters twice under StrictMode in development, so the timer
    was cleared and immediately restarted — pause appeared to do nothing.
  */
  const togglePause = useCallback(() => {
    if (isPaused) {
      setIsPaused(false);
      runTimer();
    } else {
      setIsPaused(true);
      clearTimer();
    }
  }, [isPaused, runTimer, clearTimer]);

  /*
    Stepping by hand restarts the clock, so you get a full interval to look at
    the journey you just asked for rather than a fragment of one.
  */
  const next = useCallback(() => {
    advance();
    if (!isPaused) runTimer();
  }, [advance, isPaused, runTimer]);

  const stopReplay = useCallback(() => {
    clearTimer();
    setIndex(-1);
    setIsPaused(false);
  }, [clearTimer]);

  // Never leave an interval running behind a closed panel.
  useEffect(() => clearTimer, [clearTimer]);

  /*
    Editing flights mid-replay would leave the index pointing at a journey
    that has moved or gone. Stopping is the honest response.
  */
  useEffect(() => {
    clearTimer();
    setIndex(-1);
    setIsPaused(false);
  }, [ordered, clearTimer]);

  const played = useMemo(
    () => (index >= 0 ? ordered.slice(0, index + 1) : []),
    [ordered, index],
  );

  return {
    isActive: index >= 0,
    isPaused,
    current: index >= 0 ? (ordered[index] ?? null) : null,
    played,
    index: index + 1,
    total: ordered.length,
    start,
    stop,
    togglePause,
    next,
    stopReplay,
  };
}
