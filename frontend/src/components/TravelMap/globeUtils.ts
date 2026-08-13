import { geoDistance, geoInterpolate } from 'd3-geo';
import type { FlightJourney } from '../../types';
import { legFlightSeconds, STOP_PAUSE_SECONDS } from './useJourneyReplay';

/** d3 rotation, [lambda, phi]. The camera faces [-lambda, -phi]. */
export type GlobeRotation = [number, number];

export interface GlobeCamera {
  rotation: GlobeRotation;
  /** 1 = the whole globe in frame; multiplies the orthographic scale. */
  zoom: number;
}

export const MIN_GLOBE_ZOOM = 1;
export const MAX_GLOBE_ZOOM = 8;

const DEG = 180 / Math.PI;

export function clampLat(value: number): number {
  return Math.max(-90, Math.min(90, value));
}

export function clampGlobeZoom(value: number): number {
  return Math.max(MIN_GLOBE_ZOOM, Math.min(MAX_GLOBE_ZOOM, value));
}

/** The point the camera is looking at, from its rotation. */
export function cameraCenter(rotation: GlobeRotation): [number, number] {
  return [-rotation[0], -rotation[1]];
}

/**
 * Whether a place is on the visible hemisphere.
 *
 * The raw orthographic projection function happily projects the far side of
 * the sphere onto the same disk (clipAngle only affects geoPath), so anything
 * positioned with `projection([lon, lat])` — markers, labels, the plane —
 * needs this check or it renders a mirror image of the hidden hemisphere.
 * A hair under 90° so nothing sits exactly on the rim.
 */
export function isOnVisibleSide(
  point: [number, number],
  center: [number, number],
): boolean {
  return geoDistance(point, center) < Math.PI / 2 - 0.01;
}

interface TimelineSegment {
  from: [number, number];
  to: [number, number];
  interpolate: (t: number) => [number, number];
  /** Seconds into the journey when this leg takes off. */
  startS: number;
  /** Touchdown. */
  endS: number;
  /** End of the ground stop that follows (equals endS on the last leg). */
  pauseEndS: number;
}

export interface JourneyTimeline {
  segments: TimelineSegment[];
  totalS: number;
  /** Camera zoom that frames the journey's longest leg comfortably. */
  zoomTarget: number;
}

/**
 * The same clock the flat replay flies on — per-leg sqrt-distance seconds
 * with a ground stop at every intermediate airport — expressed as geographic
 * segments so the globe can sample the plane's position each frame.
 *
 * geoInterpolate gives the great-circle track, which is the whole reason the
 * globe exists: the flat map's screen-space quadratic arcs are wrong on a
 * sphere, both in shape and in where the horizon should cut them.
 */
export function buildJourneyTimeline(
  journey: FlightJourney,
): JourneyTimeline | null {
  const legs = [...(journey.legs ?? [])].sort((a, b) => a.legOrder - b.legOrder);
  const segments: TimelineSegment[] = [];
  let t = 0;
  let maxLegDeg = 0;

  for (let i = 0; i < legs.length; i++) {
    const leg = legs[i];
    const dep = leg.departureAirport;
    const arr = leg.arrivalAirport;
    if (!dep || !arr) continue;
    // Postgres numerics arrive as strings; d3 wants numbers.
    const from: [number, number] = [Number(dep.longitude), Number(dep.latitude)];
    const to: [number, number] = [Number(arr.longitude), Number(arr.latitude)];
    if (!from.every(Number.isFinite) || !to.every(Number.isFinite)) continue;

    const flight = legFlightSeconds(Number(leg.distanceKm) || 0);
    const isLast = i === legs.length - 1;
    segments.push({
      from,
      to,
      interpolate: geoInterpolate(from, to),
      startS: t,
      endS: t + flight,
      pauseEndS: t + flight + (isLast ? 0 : STOP_PAUSE_SECONDS),
    });
    t = segments[segments.length - 1].pauseEndS;
    maxLegDeg = Math.max(maxLegDeg, geoDistance(from, to) * DEG);
  }

  if (segments.length === 0) return null;

  /*
    Frame the longest leg at roughly a third of the visible disk: 60° of
    great-circle arc across a 180° hemisphere. Clamped so a short hop never
    slams into the ground and a transpacific haul never zooms out past the
    whole globe.
  */
  const zoomTarget = clampGlobeZoom(
    Math.max(1.15, Math.min(3, 60 / Math.max(maxLegDeg, 1))),
  );

  return { segments, totalS: t, zoomTarget };
}

export interface PlaneFrame {
  position: [number, number];
  /** A point slightly ahead on the track — projected, it gives the bearing. */
  ahead: [number, number];
  /** The flat map's altitude illusion: 1 on the ground, 1.9 at cruise. */
  altitude: number;
  /** Everything flown so far, sampled for the contrail. */
  trail: [number, number][];
  /** True once the journey is complete and the plane is parked. */
  done: boolean;
}

/** Points per leg for the contrail. Coarse is fine — geoPath resamples. */
const TRAIL_SAMPLES = 24;

function sampleArc(
  interpolate: (t: number) => [number, number],
  upTo: number,
  out: [number, number][],
): void {
  for (let i = 0; i <= TRAIL_SAMPLES; i++) {
    out.push(interpolate((i / TRAIL_SAMPLES) * upTo));
  }
}

/** Same shape as the flat plane's altitude keyframes: climb to 30%, cruise, descend from 70%. */
function altitudeAt(fraction: number): number {
  if (fraction < 0.3) return 1 + 0.9 * (fraction / 0.3);
  if (fraction < 0.7) return 1.9;
  return 1.9 - 0.9 * ((fraction - 0.7) / 0.3);
}

/** Where the plane is `t` seconds into the journey. */
export function samplePlaneFrame(
  timeline: JourneyTimeline,
  t: number,
): PlaneFrame {
  const { segments } = timeline;
  const trail: [number, number][] = [];
  const last = segments[segments.length - 1];

  for (const seg of segments) {
    if (t < seg.endS) {
      // In flight on this leg.
      const f = Math.max(0, (t - seg.startS) / (seg.endS - seg.startS));
      sampleArc(seg.interpolate, f, trail);
      return {
        position: seg.interpolate(f),
        ahead: seg.interpolate(Math.min(f + 0.01, 1.001)),
        altitude: altitudeAt(f),
        trail,
        done: false,
      };
    }
    sampleArc(seg.interpolate, 1, trail);
    if (t < seg.pauseEndS) {
      // On the ground at an intermediate stop.
      return {
        position: seg.to,
        ahead: seg.interpolate(1.001),
        altitude: 1,
        trail,
        done: false,
      };
    }
  }

  // Journey complete: parked at the destination.
  return {
    position: last.to,
    ahead: last.interpolate(1.001),
    altitude: 1,
    trail,
    done: t >= timeline.totalS,
  };
}

/**
 * Ease the camera toward a target point on the sphere.
 *
 * The chase runs along the great circle between where the camera looks now
 * and where the plane is — geoInterpolate is d3's spherical interpolation, so
 * this is a slerp without needing versor. The exponential form makes the
 * easing frame-rate independent: the camera covers the same fraction of the
 * remaining distance per second regardless of dt.
 */
export function chaseCamera(
  camera: GlobeCamera,
  target: [number, number],
  zoomTarget: number,
  dtSeconds: number,
): GlobeCamera {
  const alpha = 1 - Math.exp(-dtSeconds * 3.2);
  const current = cameraCenter(camera.rotation);
  let next = geoInterpolate(current, target)(alpha);
  // Antipodal points have no unique great circle; snap rather than NaN.
  if (!Number.isFinite(next[0]) || !Number.isFinite(next[1])) next = target;
  return {
    rotation: [-next[0], clampLat(-next[1])],
    zoom: camera.zoom + (zoomTarget - camera.zoom) * alpha,
  };
}
