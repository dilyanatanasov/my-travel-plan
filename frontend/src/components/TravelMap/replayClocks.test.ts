import { describe, it, expect } from 'vitest';
import {
  legFlightSeconds,
  journeyFlightSeconds,
  STOP_PAUSE_SECONDS,
} from './useJourneyReplay';
import type { FlightJourney } from '../../types';

/**
 * The replay's speed feel lives in these clamps: 1.45s floor so short hops
 * do not strobe, 5.4s cap so a long-haul does not stall the show, sqrt in
 * between so speed stays believable. Owner-tuned 2026-08-13 (0.062 factor);
 * these tests pin that tuning down.
 */

const journeyWith = (distances: (number | string)[]): FlightJourney =>
  ({
    legs: distances.map((distanceKm, i) => ({ legOrder: i, distanceKm })),
  }) as unknown as FlightJourney;

describe('legFlightSeconds', () => {
  it('clamps short hops to the 1.45s floor', () => {
    expect(legFlightSeconds(0)).toBe(1.45);
    expect(legFlightSeconds(100)).toBe(1.45);
    // 0.062·√547 ≈ 1.45 — the floor releases just past this distance.
    expect(legFlightSeconds(600)).toBeGreaterThan(1.45);
  });

  it('clamps long hauls to the 5.4s cap', () => {
    expect(legFlightSeconds(9000)).toBe(5.4);
    expect(legFlightSeconds(100000)).toBe(5.4);
  });

  it('scales with sqrt of distance between the clamps', () => {
    expect(legFlightSeconds(1000)).toBeCloseTo(0.062 * Math.sqrt(1000), 10);
    // sqrt: doubling distance multiplies time by √2, not 2.
    expect(legFlightSeconds(2000) / legFlightSeconds(1000)).toBeCloseTo(
      Math.SQRT2,
      5,
    );
  });

  it('treats garbage distances as zero rather than NaN', () => {
    expect(legFlightSeconds(-500)).toBe(1.45);
    expect(legFlightSeconds(NaN)).toBe(1.45);
  });
});

describe('journeyFlightSeconds', () => {
  it('sums per-leg clocks plus one ground pause per intermediate stop', () => {
    const journey = journeyWith([1000, 2000, 4000]);
    const expected =
      legFlightSeconds(1000) +
      legFlightSeconds(2000) +
      legFlightSeconds(4000) +
      2 * STOP_PAUSE_SECONDS;
    expect(journeyFlightSeconds(journey)).toBeCloseTo(expected, 10);
  });

  it('adds no pause for a nonstop', () => {
    expect(journeyFlightSeconds(journeyWith([3000]))).toBeCloseTo(
      legFlightSeconds(3000),
      10,
    );
  });

  it('is zero for a journey with no legs at all', () => {
    expect(journeyFlightSeconds(journeyWith([]))).toBe(0);
    expect(
      journeyFlightSeconds({} as unknown as FlightJourney),
    ).toBe(0);
  });

  it('coerces the API string distances the backend actually sends', () => {
    expect(journeyFlightSeconds(journeyWith(['1000']))).toBeCloseTo(
      legFlightSeconds(1000),
      10,
    );
  });
});
