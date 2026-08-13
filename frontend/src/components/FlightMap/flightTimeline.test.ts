import { describe, it, expect } from 'vitest';
import { buildFlightTimeline } from './flightTimeline';
import {
  legFlightSeconds,
  STOP_PAUSE_SECONDS,
} from '../TravelMap/useJourneyReplay';

/**
 * SMIL is unforgiving: keyTimes must be monotonic, the lists must end at
 * exactly "1", and keyPoints/keyTimes must stay the same length — get any of
 * these wrong and the browser silently ignores the whole animation, which is
 * how the replay "froze" more than once on 2026-08-13.
 */

const split = (list: string) => list.split(';');
const nums = (list: string) => split(list).map(Number);
const last = (list: string) => split(list)[split(list).length - 1];

function expectMonotonic(values: number[]) {
  for (let i = 1; i < values.length; i++) {
    expect(values[i]).toBeGreaterThanOrEqual(values[i - 1]);
  }
}

describe('buildFlightTimeline', () => {
  describe('single leg (replay mode)', () => {
    const timeline = buildFlightTimeline([{ screenLen: 100, distanceKm: 1000 }], {
      legDurationSeconds: 1,
    });

    it('spans exactly the leg flight time — no pause for a nonstop', () => {
      expect(timeline.totalSeconds).toBeCloseTo(legFlightSeconds(1000), 10);
    });

    it('flies origin to destination with both lists ending at exactly "1"', () => {
      expect(timeline.motionKeyPoints).toBe('0;1');
      expect(timeline.motionKeyTimes).toBe('0;1');
    });

    it('climbs to cruise and returns to ground size', () => {
      expect(timeline.altitudeValues).toBe('1;1.9;1.9;1');
      expect(split(timeline.altitudeKeyTimes)[0]).toBe('0');
      expect(last(timeline.altitudeKeyTimes)).toBe('1');
    });

    it('contrail offset mirrors the plane position (1 - fraction)', () => {
      expect(timeline.contrailValues).toBe('1.0000;0.0000');
    });
  });

  describe('three legs (replay mode)', () => {
    const legs = [
      { screenLen: 100, distanceKm: 1000 },
      { screenLen: 50, distanceKm: 400 },
      { screenLen: 200, distanceKm: 9000 },
    ];
    const timeline = buildFlightTimeline(legs, { legDurationSeconds: 1 });
    const points = nums(timeline.motionKeyPoints);
    const times = nums(timeline.motionKeyTimes);

    it('totals per-leg sqrt clocks plus a ground pause per stop', () => {
      const expected =
        legFlightSeconds(1000) +
        legFlightSeconds(400) +
        legFlightSeconds(9000) +
        2 * STOP_PAUSE_SECONDS;
      expect(timeline.totalSeconds).toBeCloseTo(expected, 10);
    });

    it('encodes each ground pause as the same keyPoint twice', () => {
      // start + 3 arrivals + 2 pause duplicates
      expect(points).toHaveLength(6);
      expect(times).toHaveLength(6);
      // Arrival at stop 1 and the end of its pause hold the same position...
      expect(points[1]).toBe(points[2]);
      expect(points[3]).toBe(points[4]);
      // ...while the clock keeps moving.
      expect(times[2]).toBeGreaterThan(times[1]);
      expect(times[4]).toBeGreaterThan(times[3]);
    });

    it('places stops at screen-length fractions of the whole chain', () => {
      expect(points[1]).toBeCloseTo(100 / 350, 3);
      expect(points[3]).toBeCloseTo(150 / 350, 3);
    });

    it('keeps every list monotonic and ending at exactly "1"', () => {
      expectMonotonic(points);
      expectMonotonic(times);
      expectMonotonic(nums(timeline.altitudeKeyTimes));
      expect(last(timeline.motionKeyPoints)).toBe('1');
      expect(last(timeline.motionKeyTimes)).toBe('1');
      expect(last(timeline.altitudeKeyTimes)).toBe('1');
    });

    it('keeps the contrail list in lockstep with the motion list', () => {
      const contrail = nums(timeline.contrailValues);
      expect(contrail).toHaveLength(points.length);
      contrail.forEach((value, i) => {
        expect(value).toBeCloseTo(1 - points[i], 3);
      });
    });

    it('dips the altitude back to ground size through each pause', () => {
      // Per leg: climb, hold, descend (3 values) + a held "1" per pause.
      expect(split(timeline.altitudeValues)).toHaveLength(1 + 3 * 3 + 2);
    });
  });

  describe('ambient mode (no legDurationSeconds)', () => {
    it('uses the flat per-leg pace instead of distance', () => {
      const legs = [
        { screenLen: 10, distanceKm: 500 },
        { screenLen: 10, distanceKm: 12000 },
      ];
      const timeline = buildFlightTimeline(legs, { ambientLegSeconds: 9 });
      expect(timeline.totalSeconds).toBeCloseTo(18 + STOP_PAUSE_SECONDS, 10);
    });
  });

  describe('degenerate input', () => {
    it('does not crash or emit NaN on an empty journey', () => {
      const timeline = buildFlightTimeline([]);
      expect(timeline.totalSeconds).toBe(0);
      expect(timeline.motionKeyPoints).not.toContain('NaN');
      expect(timeline.motionKeyTimes).not.toContain('NaN');
    });

    it('survives zero-length screen chords (all airports co-located)', () => {
      const timeline = buildFlightTimeline(
        [
          { screenLen: 0, distanceKm: 100 },
          { screenLen: 0, distanceKm: 100 },
        ],
        { legDurationSeconds: 1 },
      );
      expect(timeline.motionKeyPoints).not.toContain('NaN');
      expect(last(timeline.motionKeyPoints)).toBe('1');
    });
  });
});
