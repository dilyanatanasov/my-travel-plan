import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FlightJourney } from '../../types';

/** How long each journey holds the screen. */
const STEP_MS = 2600;

export interface ReplayState {
  isPlaying: boolean;
  /** The journey currently being drawn, or null when idle. */
  current: FlightJourney | null;
  /** 1-based position, for "3 of 12". */
  index: number;
  total: number;
  start: () => void;
  stop: () => void;
}

/**
 * Play a traveller's journeys back in the order they happened.
 *
 * A map shows everywhere at once, which is accurate and completely flat: it
 * cannot show that you went to Iceland before Japan, or that one year was
 * busier than the next. Replaying restores the sequence, which is the part
 * worth watching — and the part worth posting.
 *
 * Undated journeys are excluded rather than guessed at. Placing them at an
 * arbitrary point would quietly assert a history the user never entered.
 */
export function useJourneyReplay(journeys: FlightJourney[]): ReplayState {
  const [index, setIndex] = useState(-1);
  const timerRef = useRef<number | null>(null);

  const ordered = useMemo(
    () =>
      journeys
        .filter((journey) => journey.journeyDate)
        .sort((a, b) => (a.journeyDate ?? '').localeCompare(b.journeyDate ?? '')),
    [journeys],
  );

  const clear = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    clear();
    setIndex(-1);
  }, [clear]);

  const start = useCallback(() => {
    if (ordered.length === 0) return;
    clear();
    setIndex(0);
    timerRef.current = window.setInterval(() => {
      setIndex((current) => {
        const next = current + 1;
        if (next >= ordered.length) {
          // Stop on the last one rather than looping: a replay that never
          // ends is a screensaver, and it keeps the map hostage.
          clear();
          return -1;
        }
        return next;
      });
    }, STEP_MS);
  }, [ordered.length, clear]);

  // Never leave an interval running behind a closed panel.
  useEffect(() => clear, [clear]);

  /*
    Editing flights mid-replay would leave the index pointing at a journey
    that has moved or gone. Stopping is the honest response.
  */
  useEffect(() => {
    clear();
    setIndex(-1);
  }, [ordered, clear]);

  return {
    isPlaying: index >= 0,
    current: index >= 0 ? (ordered[index] ?? null) : null,
    index: index + 1,
    total: ordered.length,
    start,
    stop,
  };
}
