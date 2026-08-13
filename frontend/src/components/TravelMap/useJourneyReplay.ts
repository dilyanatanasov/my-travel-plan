import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FlightJourney } from '../../types';
import { track } from '../../lib/analytics';

/** Pause after landing before the next journey — camera settle + a breath. */
const SETTLE_MS = 1700;

/** Ground stop at each intermediate airport within a journey. */
export const STOP_PAUSE_SECONDS = 0.9;

/** One leg's flight time from its distance — same sqrt reasoning as below. */
export function legFlightSeconds(km: number): number {
  // 0.062, trimmed from 0.07 by owner feel-test: ~12% brisker everywhere,
  // clamps tightened to match so short hops and long hauls speed up too.
  return Math.min(5.4, Math.max(1.45, 0.062 * Math.sqrt(Math.max(km, 0))));
}

/**
 * Flight time scaled by the journey's real distance, clamped to taste.
 *
 * A flat duration meant Sofia→Vienna crawled while Sofia→Tokyo teleported —
 * the plane's apparent speed swung wildly between steps. Scaling by
 * kilometres keeps the speed *believable* while the clamp keeps a long-haul
 * from stalling the show and a hop from strobing past.
 */
/*
  sqrt per leg, not linear: true constant speed would flash a 400 km hop past
  in a fraction of a second or stall a 12,000 km haul for ages. Per LEG, so an
  out-and-back gives each direction its own honest time, with a ground stop at
  every intermediate airport — the plane lands in London before flying home.
*/
export function journeyFlightSeconds(journey: FlightJourney): number {
  const legs = journey.legs ?? [];
  const flying = legs.reduce(
    (sum, leg) => sum + legFlightSeconds(Number(leg.distanceKm) || 0),
    0,
  );
  return flying + STOP_PAUSE_SECONDS * Math.max(legs.length - 1, 0);
}

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

  /*
    Per-journey scheduling, as an effect rather than an interval: each step's
    length now depends on the journey being flown, so the clock is re-armed
    on every index change (which also gives a hand-stepped journey its full
    window). The effect shape sidesteps the StrictMode double-invoke problem
    the old interval start/stop-in-updater had.
  */
  useEffect(() => {
    if (index < 0 || isPaused) return;
    const journey = ordered[index];
    if (!journey) return;
    const stepMs = journeyFlightSeconds(journey) * 1000 + SETTLE_MS;
    timerRef.current = window.setTimeout(advance, stepMs);
    return clearTimer;
  }, [index, isPaused, ordered, advance, clearTimer]);

  const start = useCallback(() => {
    if (ordered.length === 0) return;
    track('replay_start', { journeys: ordered.length });
    setIndex(0);
    setIsPaused(false);
  }, [ordered.length]);

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
  // The scheduling effect above reacts to isPaused and index, so pause and
  // manual stepping need no timer bookkeeping of their own.
  const togglePause = useCallback(() => {
    setIsPaused((paused) => !paused);
  }, []);

  const next = useCallback(() => {
    advance();
  }, [advance]);

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
