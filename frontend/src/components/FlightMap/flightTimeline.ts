import { legFlightSeconds, STOP_PAUSE_SECONDS } from '../TravelMap/useJourneyReplay';

/**
 * The SMIL timeline for one journey's plane: fly a leg (time from its own
 * distance), land, pause on the ground, fly the next.
 *
 * Built as parallel keyPoints (position as a fraction of on-screen path
 * length) and keyTimes (fractions of total time), with a pause encoded as the
 * same keyPoint twice. The altitude profile rides the same clock: climb to a
 * held 1.9× cruise inside each leg's slice, ground size through every stop.
 * The contrail's tip tracks the plane: dashoffset is 1 - lengthFraction.
 *
 * Replay mode (legDurationSeconds provided) times legs by real distance; the
 * ambient selected-route loop keeps its flat per-leg pace (it is scenery,
 * not narration).
 *
 * Pure on purpose — extracted from JourneyHighlight (2026-08-13) so the list
 * invariants SMIL cares about (monotonic keyTimes, lists ending exactly at
 * "1", pause duplicates) are testable without an SVG renderer.
 */

export interface TimelineLeg {
  /** Projected chord length on screen — the weight mapping time to position. */
  screenLen: number;
  /** Great-circle distance, used for per-leg speed in replay mode. */
  distanceKm: number;
}

export interface FlightTimeline {
  totalSeconds: number;
  motionKeyPoints: string;
  motionKeyTimes: string;
  altitudeValues: string;
  altitudeKeyTimes: string;
  contrailValues: string;
}

const CRUISE_SCALE = '1.9';

export function buildFlightTimeline(
  legs: TimelineLeg[],
  options: { legDurationSeconds?: number; ambientLegSeconds?: number } = {},
): FlightTimeline {
  const { legDurationSeconds, ambientLegSeconds = 9 } = options;

  const legSeconds = legs.map(({ distanceKm }) =>
    legDurationSeconds !== undefined
      ? legFlightSeconds(distanceKm)
      : ambientLegSeconds,
  );
  const totalSeconds =
    legSeconds.reduce((a, b) => a + b, 0) +
    STOP_PAUSE_SECONDS * Math.max(legs.length - 1, 0);
  const totalScreenLen = legs.reduce((a, d) => a + d.screenLen, 0) || 1;

  const keyPoints: string[] = ['0'];
  const keyTimes: string[] = ['0'];
  const altitudeValuesArr: string[] = ['1'];
  const altitudeKeyTimesArr: string[] = ['0'];
  let t = 0;
  let len = 0;
  legs.forEach((d, i) => {
    const legT = legSeconds[i];
    altitudeValuesArr.push(CRUISE_SCALE, CRUISE_SCALE, '1');
    altitudeKeyTimesArr.push(
      ((t + 0.3 * legT) / totalSeconds).toFixed(4),
      ((t + 0.7 * legT) / totalSeconds).toFixed(4),
      ((t + legT) / totalSeconds).toFixed(4),
    );
    t += legT;
    len += d.screenLen;
    keyPoints.push((len / totalScreenLen).toFixed(4));
    keyTimes.push((t / totalSeconds).toFixed(4));
    if (i < legs.length - 1) {
      t += STOP_PAUSE_SECONDS;
      keyPoints.push((len / totalScreenLen).toFixed(4));
      keyTimes.push((t / totalSeconds).toFixed(4));
      altitudeValuesArr.push('1');
      altitudeKeyTimesArr.push((t / totalSeconds).toFixed(4));
    }
  });
  // Guard against rounding: SMIL wants the lists to end exactly at 1.
  keyPoints[keyPoints.length - 1] = '1';
  keyTimes[keyTimes.length - 1] = '1';
  altitudeKeyTimesArr[altitudeKeyTimesArr.length - 1] = '1';

  return {
    totalSeconds,
    motionKeyPoints: keyPoints.join(';'),
    motionKeyTimes: keyTimes.join(';'),
    altitudeValues: altitudeValuesArr.join(';'),
    altitudeKeyTimes: altitudeKeyTimesArr.join(';'),
    contrailValues: keyPoints.map((p) => (1 - Number(p)).toFixed(4)).join(';'),
  };
}
