import { describe, it, expect } from 'vitest';
import { geoDistance } from 'd3-geo';
import {
  buildJourneyTimeline,
  samplePlaneFrame,
  chaseCamera,
  cameraCenter,
  clampLat,
  clampGlobeZoom,
  isOnVisibleSide,
  MIN_GLOBE_ZOOM,
  MAX_GLOBE_ZOOM,
  type GlobeCamera,
} from './globeUtils';
import { legFlightSeconds, STOP_PAUSE_SECONDS } from './useJourneyReplay';
import type { FlightJourney } from '../../types';

/**
 * The globe replay is rAF-sampled rather than SMIL, so its correctness lives
 * entirely in these pure functions: where the plane is at second t, when the
 * ground pauses happen, and how the camera chases. Fixtures use the API's
 * real shape — Postgres numerics arrive as strings.
 */

interface LegSpec {
  from: [number, number];
  to: [number, number];
  km: number;
}

const journeyOf = (specs: LegSpec[], legOrderReversed = false): FlightJourney =>
  ({
    legs: specs.map((spec, i) => ({
      legOrder: legOrderReversed ? specs.length - i : i + 1,
      distanceKm: String(spec.km),
      departureAirport: {
        longitude: String(spec.from[0]),
        latitude: String(spec.from[1]),
      },
      arrivalAirport: {
        longitude: String(spec.to[0]),
        latitude: String(spec.to[1]),
      },
    })),
  }) as unknown as FlightJourney;

// Sofia → Vienna → Tokyo-ish: one short and one long leg.
const twoLegs: LegSpec[] = [
  { from: [23.4, 42.7], to: [16.6, 48.1], km: 800 },
  { from: [16.6, 48.1], to: [139.8, 35.5], km: 9100 },
];

describe('buildJourneyTimeline', () => {
  it('returns null when there is nothing to fly', () => {
    expect(buildJourneyTimeline({} as unknown as FlightJourney)).toBeNull();
    expect(buildJourneyTimeline(journeyOf([]))).toBeNull();
  });

  it('lays legs end to end with a pause at every intermediate stop only', () => {
    const timeline = buildJourneyTimeline(journeyOf(twoLegs))!;
    const [first, second] = timeline.segments;
    const flight1 = legFlightSeconds(800);
    const flight2 = legFlightSeconds(9100);

    expect(first.startS).toBe(0);
    expect(first.endS).toBeCloseTo(flight1, 10);
    expect(first.pauseEndS).toBeCloseTo(flight1 + STOP_PAUSE_SECONDS, 10);
    expect(second.startS).toBeCloseTo(first.pauseEndS, 10);
    // The last leg gets no pause — the journey ends at touchdown.
    expect(second.pauseEndS).toBeCloseTo(second.endS, 10);
    expect(timeline.totalS).toBeCloseTo(
      flight1 + STOP_PAUSE_SECONDS + flight2,
      10,
    );
  });

  it('flies legs in legOrder even when the API returns them shuffled', () => {
    const timeline = buildJourneyTimeline(journeyOf(twoLegs, true))!;
    // Reversed legOrder means the long leg comes first now.
    expect(timeline.segments[0].from[0]).toBeCloseTo(16.6, 5);
    expect(timeline.segments[0].to[0]).toBeCloseTo(139.8, 5);
  });

  it('skips legs with missing or garbage airports rather than dying', () => {
    const journey = journeyOf(twoLegs) as unknown as {
      legs: Record<string, unknown>[];
    };
    journey.legs[0].departureAirport = undefined;
    journey.legs.push({
      legOrder: 3,
      distanceKm: '100',
      departureAirport: { longitude: 'not-a-number', latitude: '0' },
      arrivalAirport: { longitude: '0', latitude: '0' },
    });
    const timeline = buildJourneyTimeline(journey as unknown as FlightJourney)!;
    expect(timeline.segments).toHaveLength(1);
  });

  it('frames short hops close and long hauls wide, inside the clamps', () => {
    const hop = buildJourneyTimeline(
      journeyOf([{ from: [23.4, 42.7], to: [24.5, 43.2], km: 120 }]),
    )!;
    const haul = buildJourneyTimeline(
      journeyOf([{ from: [-122.4, 37.6], to: [151.2, -33.9], km: 12000 }]),
    )!;
    expect(hop.zoomTarget).toBe(3);
    expect(haul.zoomTarget).toBeCloseTo(1.15, 10);
    for (const z of [hop.zoomTarget, haul.zoomTarget]) {
      expect(z).toBeGreaterThanOrEqual(MIN_GLOBE_ZOOM);
      expect(z).toBeLessThanOrEqual(MAX_GLOBE_ZOOM);
    }
  });
});

describe('samplePlaneFrame', () => {
  const timeline = buildJourneyTimeline(journeyOf(twoLegs))!;
  const flight1 = legFlightSeconds(800);

  it('starts parked at the origin at ground size', () => {
    const frame = samplePlaneFrame(timeline, 0);
    expect(frame.position[0]).toBeCloseTo(23.4, 5);
    expect(frame.position[1]).toBeCloseTo(42.7, 5);
    expect(frame.altitude).toBe(1);
    expect(frame.done).toBe(false);
  });

  it('cruises at 1.9x mid-leg, between the endpoints', () => {
    const frame = samplePlaneFrame(timeline, flight1 / 2);
    expect(frame.altitude).toBe(1.9);
    const toFrom = geoDistance(frame.position, [23.4, 42.7]);
    const toTo = geoDistance(frame.position, [16.6, 48.1]);
    expect(toFrom).toBeCloseTo(toTo, 5);
  });

  it('sits on the ground at the stop through the pause', () => {
    const frame = samplePlaneFrame(timeline, flight1 + STOP_PAUSE_SECONDS / 2);
    expect(frame.position[0]).toBeCloseTo(16.6, 5);
    expect(frame.altitude).toBe(1);
    expect(frame.done).toBe(false);
  });

  it('parks done at the destination once the clock runs out', () => {
    const frame = samplePlaneFrame(timeline, timeline.totalS + 1);
    expect(frame.position[0]).toBeCloseTo(139.8, 5);
    expect(frame.done).toBe(true);
  });

  it('grows the contrail monotonically and keeps it finite', () => {
    const early = samplePlaneFrame(timeline, flight1 / 4);
    const late = samplePlaneFrame(timeline, timeline.totalS - 0.1);
    expect(late.trail.length).toBeGreaterThan(early.trail.length);
    for (const [lon, lat] of late.trail) {
      expect(Number.isFinite(lon)).toBe(true);
      expect(Number.isFinite(lat)).toBe(true);
    }
  });

  it('crosses the antimeridian without producing NaN', () => {
    const pacific = buildJourneyTimeline(
      journeyOf([{ from: [170, 10], to: [-170, 10], km: 2200 }]),
    )!;
    const frame = samplePlaneFrame(pacific, legFlightSeconds(2200) / 2);
    expect(Number.isFinite(frame.position[0])).toBe(true);
    expect(Number.isFinite(frame.position[1])).toBe(true);
    // Midpoint of a 170→-170 hop sits on the antimeridian itself.
    expect(Math.abs(frame.position[0])).toBeCloseTo(180, 3);
  });
});

describe('chaseCamera', () => {
  const camera: GlobeCamera = { rotation: [-10, -20], zoom: 1.5 };

  it('closes on the target without overshooting', () => {
    const target: [number, number] = [40, 10];
    const before = geoDistance(cameraCenter(camera.rotation), target);
    const next = chaseCamera(camera, target, 2, 1 / 60);
    const after = geoDistance(cameraCenter(next.rotation), target);
    expect(after).toBeLessThan(before);
    expect(after).toBeGreaterThan(0);
  });

  it('is frame-rate independent: two half-steps equal one full step', () => {
    const target: [number, number] = [40, 10];
    const oneStep = chaseCamera(camera, target, 2, 1);
    const halfStep = chaseCamera(chaseCamera(camera, target, 2, 0.5), target, 2, 0.5);
    expect(halfStep.zoom).toBeCloseTo(oneStep.zoom, 10);
    expect(halfStep.rotation[0]).toBeCloseTo(oneStep.rotation[0], 5);
    expect(halfStep.rotation[1]).toBeCloseTo(oneStep.rotation[1], 5);
  });

  it('never emits NaN, even for an antipodal target', () => {
    const antipode: [number, number] = [-170, 20];
    const looking: GlobeCamera = { rotation: [-10, 20], zoom: 1 };
    const next = chaseCamera(looking, antipode, 2, 1 / 60);
    expect(Number.isFinite(next.rotation[0])).toBe(true);
    expect(Number.isFinite(next.rotation[1])).toBe(true);
  });

  it('keeps the camera latitude inside the poles', () => {
    const next = chaseCamera(
      { rotation: [0, -89.9], zoom: 1 },
      [0, 90],
      1,
      10,
    );
    expect(next.rotation[1]).toBeGreaterThanOrEqual(-90);
    expect(next.rotation[1]).toBeLessThanOrEqual(90);
  });
});

describe('clamps and visibility', () => {
  it('clampLat pins to the poles', () => {
    expect(clampLat(120)).toBe(90);
    expect(clampLat(-95)).toBe(-90);
    expect(clampLat(45)).toBe(45);
  });

  it('clampGlobeZoom pins to the mode range', () => {
    expect(clampGlobeZoom(0.2)).toBe(MIN_GLOBE_ZOOM);
    expect(clampGlobeZoom(99)).toBe(MAX_GLOBE_ZOOM);
  });

  it('isOnVisibleSide hides the far hemisphere and the rim itself', () => {
    expect(isOnVisibleSide([0, 0], [0, 0])).toBe(true);
    expect(isOnVisibleSide([180, 0], [0, 0])).toBe(false);
    // Exactly on the rim: cut, not mirrored.
    expect(isOnVisibleSide([90, 0], [0, 0])).toBe(false);
  });
});
