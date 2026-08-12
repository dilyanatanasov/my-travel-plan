import { memo } from 'react';
import { useMapContext, useZoomPanContext } from 'react-simple-maps';
import { calculateArcPath, getZoomAdjustedSize } from './routeUtils';
import { useMapColors } from '../../theme/mapColors';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import type { FlightJourney } from '../../types';

/**
 * Plane silhouette in a 24x24 box, nose pointing right (+x).
 *
 * The direction matters: animateMotion's rotate="auto" aligns +x with the
 * path tangent, so a nose-up drawing would fly permanently sideways.
 */
const PLANE_PATH =
  'M2.5 12 L9 9.5 L9 4.2 A1.5 1.5 0 0 1 12 4.2 L12 8.4 L21.5 12 L12 15.6 L12 19.8 A1.5 1.5 0 0 1 9 19.8 L9 14.5 Z';

interface JourneyHighlightProps {
  journey: FlightJourney;
  /**
   * Seconds per leg.
   *
   * A selected route loops ambiently and can afford to be slow. During replay
   * the plane has to actually arrive before the step advances, or it is cut
   * off mid-ocean every time.
   */
  legDurationSeconds?: number;
  sizeScale?: number;
  /** Clicking the highlighted route clears it — one of several exits. */
  onClear?: () => void;
}

/**
 * Draws every leg of one journey on top of the aggregate routes, animated in
 * the direction it was actually flown.
 *
 * Direction matters here in a way it does not for the aggregate layer:
 * `aggregateRoutes` merges A→B with B→A under a sorted key, so its
 * departure/arrival do not reflect travel direction. A journey's legs do, and
 * they are drawn in `legOrder`, so an out-and-back reads as two arcs moving
 * opposite ways rather than one ambiguous line.
 *
 * The motion is a flowing dash plus a travelling dot. Both are suppressed
 * under prefers-reduced-motion (see index.css) — a looping animation is a
 * genuine problem for some vestibular conditions, and the highlight still
 * reads without it.
 */
function JourneyHighlight({
  journey,
  legDurationSeconds,
  sizeScale = 1,
  onClear,
}: JourneyHighlightProps) {
  const { map: colors } = useMapColors();
  const { projection } = useMapContext();
  const { k: zoom } = useZoomPanContext();
  const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');

  const legs = [...(journey.legs ?? [])].sort((a, b) => a.legOrder - b.legOrder);
  /*
    Slow enough to be ambient rather than agitating, and staggered so a
    multi-leg journey reads as a sequence rather than moving in lockstep.

    Nine seconds, not five: at five the plane crosses an ocean faster than the
    eye follows it, which reads as a loading spinner rather than a flight.
  */
  const legDuration = legDurationSeconds ?? 9;

  return (
    <g className="journey-highlight">
      {legs.map((leg, index) => {
        const dep = leg.departureAirport;
        const arr = leg.arrivalAirport;
        if (!dep || !arr) return null;

        const from = projection([Number(dep.longitude), Number(dep.latitude)]);
        const to = projection([Number(arr.longitude), Number(arr.latitude)]);
        if (!from || !to) return null;

        const pathD = calculateArcPath(
          from as [number, number],
          to as [number, number]
        );
        const width = getZoomAdjustedSize(2.4 * sizeScale, zoom);
        const dash = getZoomAdjustedSize(7, zoom);
        const gap = getZoomAdjustedSize(9, zoom);
        // The glyph is drawn in a 24-unit box, so this converts it to roughly
        // the diameter the old marker dot had.
        const planeScale = getZoomAdjustedSize(9 * sizeScale, zoom) / 24;
        const delay = (index * legDuration) / Math.max(legs.length, 1);

        return (
          <g key={leg.id ?? `${leg.legOrder}-${dep.iataCode}-${arr.iataCode}`}>
            {/* Soft outer glow, so the line separates from whatever is under it */}
            <path
              d={pathD}
              fill="none"
              stroke={colors.selectedGlow}
              strokeWidth={width * 2.6}
              strokeLinecap="round"
              strokeOpacity={0.28}
              pointerEvents="none"
            />
            {/* Solid base so the leg is legible with motion disabled */}
            <path
              d={pathD}
              fill="none"
              stroke={colors.selected}
              strokeWidth={width}
              strokeLinecap="round"
              pointerEvents="none"
            />
            {/* Flowing dashes: offset decreases, so they travel from the path
                start (departure) to its end (arrival). */}
            <path
              className="route-flow"
              d={pathD}
              fill="none"
              stroke="#ffffff"
              strokeWidth={width * 0.62}
              strokeLinecap="round"
              strokeDasharray={`${dash} ${gap}`}
              strokeOpacity={0.95}
              style={{ animationDelay: `${delay}s` }}
              pointerEvents="none"
            />
            {!prefersReducedMotion && (
              // A plane rather than a dot. rotate="auto" on animateMotion
              // turns it along the path tangent, so it banks into the arc and
              // always points the way the leg was flown. Drawn nose-right so
              // that rotation lines up with the direction of travel.
              <g pointerEvents="none">
                {/* animateMotion belongs on the group: putting it on the same
                    element as a transform attribute makes the two fight. The
                    group is moved and rotated; the path inside is only
                    scaled and centred on its own origin. */}
                <animateMotion
                  dur={`${legDuration}s`}
                  begin={`${delay}s`}
                  repeatCount="indefinite"
                  path={pathD}
                  rotate="auto"
                  /*
                    Constant ground speed. Without this the browser advances
                    along the curve's parameter rather than its arc length, so
                    the plane crawls out of the departure, accelerates through
                    the middle and decelerates into the arrival — which reads
                    as a stutter, not as flight.
                  */
                  calcMode="paced"
                />
                <path
                  d={PLANE_PATH}
                  fill={colors.selected}
                  stroke="#ffffff"
                  strokeWidth={1.2}
                  strokeLinejoin="round"
                  transform={`scale(${planeScale}) translate(-12 -12)`}
                />
              </g>
            )}
            {/* Clicking the highlighted route clears the selection. */}
            <path
              d={pathD}
              fill="none"
              stroke="transparent"
              strokeWidth={getZoomAdjustedSize(16, zoom)}
              strokeLinecap="round"
              style={{ cursor: onClear ? 'pointer' : 'default' }}
              onClick={() => onClear?.()}
            />
          </g>
        );
      })}
    </g>
  );
}

export default memo(JourneyHighlight);
