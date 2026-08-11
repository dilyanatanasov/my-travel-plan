import { memo } from 'react';
import { useMapContext, useZoomPanContext } from 'react-simple-maps';
import { calculateArcPath, getZoomAdjustedSize } from './routeUtils';
import { MAP } from '../../theme/mapColors';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import type { FlightJourney } from '../../types';

interface JourneyHighlightProps {
  journey: FlightJourney;
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
  sizeScale = 1,
  onClear,
}: JourneyHighlightProps) {
  const { projection } = useMapContext();
  const { k: zoom } = useZoomPanContext();
  const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');

  const legs = [...(journey.legs ?? [])].sort((a, b) => a.legOrder - b.legOrder);
  // Slow enough to be ambient rather than agitating, and staggered so a
  // multi-leg journey reads as a sequence instead of moving in lockstep.
  const legDuration = 5;

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
        const dotRadius = getZoomAdjustedSize(3.4 * sizeScale, zoom);
        const delay = (index * legDuration) / Math.max(legs.length, 1);

        return (
          <g key={leg.id ?? `${leg.legOrder}-${dep.iataCode}-${arr.iataCode}`}>
            {/* Soft outer glow, so the line separates from whatever is under it */}
            <path
              d={pathD}
              fill="none"
              stroke={MAP.selectedGlow}
              strokeWidth={width * 2.6}
              strokeLinecap="round"
              strokeOpacity={0.28}
              pointerEvents="none"
            />
            {/* Solid base so the leg is legible with motion disabled */}
            <path
              d={pathD}
              fill="none"
              stroke={MAP.selected}
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
              <circle
                r={dotRadius}
                fill="#ffffff"
                stroke={MAP.selected}
                strokeWidth={dotRadius * 0.45}
                pointerEvents="none"
              >
                <animateMotion
                  dur={`${legDuration}s`}
                  begin={`${delay}s`}
                  repeatCount="indefinite"
                  path={pathD}
                  rotate="auto"
                />
              </circle>
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
