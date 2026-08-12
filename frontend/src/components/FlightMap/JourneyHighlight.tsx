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

  /*
    Geometry for every leg, computed before rendering so the whole chain is
    known up front — the single plane needs one continuous path, not one per
    leg.
  */
  const drawn = legs
    .map((leg) => {
      const dep = leg.departureAirport;
      const arr = leg.arrivalAirport;
      if (!dep || !arr) return null;
      const from = projection([Number(dep.longitude), Number(dep.latitude)]);
      const to = projection([Number(arr.longitude), Number(arr.latitude)]);
      if (!from || !to) return null;
      return {
        leg,
        pathD: calculateArcPath(from as [number, number], to as [number, number]),
      };
    })
    .filter((entry): entry is { leg: (typeof legs)[number]; pathD: string } =>
      entry !== null
    );

  /*
    One path for the whole journey.

    Each arc is "M x y Q cx cy x2 y2", and every leg starts exactly where the
    previous one ended, so dropping the M from all but the first splices them
    into a single continuous route. One plane then flies Varna → Vienna →
    Geneva → home in one pass, which is what a trip looks like; a plane per
    leg had three aircraft in the air at once on the same itinerary.
  */
  const journeyPath = drawn
    .map(({ pathD }, index) => (index === 0 ? pathD : pathD.replace(/^M[^Q]*/, '')))
    .join(' ');

  // Total time scales with the chain, so a three-leg trip is not flown at
  // three times the speed of a one-leg trip.
  const journeyDuration = legDuration * Math.max(drawn.length, 1);
  // 13, not 9: at 9 the glyph was ~8px and sat directly on top of a route
  // line of the same colour, which is why it vanished on the light map.
  const planeScaleShared = getZoomAdjustedSize(13 * sizeScale, zoom) / 24;

  return (
    <g className="journey-highlight">
      {drawn.map(({ leg, pathD }, index) => {
        const dep = leg.departureAirport;
        const arr = leg.arrivalAirport;
        const width = getZoomAdjustedSize(2.4 * sizeScale, zoom);
        const dash = getZoomAdjustedSize(7, zoom);
        const gap = getZoomAdjustedSize(9, zoom);
        // The glyph is drawn in a 24-unit box, so this converts it to roughly
        // the diameter the old marker dot had.
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

      {/*
        One aircraft for the whole trip, flying the legs end to end.

        rotate="auto" turns it along the path tangent, so it banks into each
        arc and always points the way it is travelling. animateMotion sits on
        the group rather than the path: putting it on an element that also
        carries a transform attribute makes the two fight, so the group is
        moved and rotated while the glyph inside is only scaled and centred.

        calcMode="paced" gives constant ground speed across the whole chain,
        including through the corners at each stop.
      */}
      {!prefersReducedMotion && journeyPath && (
        /*
          Keyed by journey, so switching journeys remounts the element and the
          animation restarts from the origin. Without it React reuses the same
          <animateMotion>, which keeps its own clock: the plane carried on
          from wherever it had got to and joined the next route mid-way.
        */
        <g key={journey.id} pointerEvents="none">
          <animateMotion
            dur={`${journeyDuration}s`}
            repeatCount="indefinite"
            path={journeyPath}
            rotate="auto"
            calcMode="paced"
          />
          {/*
            routeHighlight inverts with the theme — near-black on the light
            map, pale on the dark one — so the aircraft reads against the
            route beneath it either way. The halo is the ocean colour, which
            separates it from the line rather than blending into it as white
            did on cream.
          */}
          <path
            d={PLANE_PATH}
            fill={colors.routeHighlight}
            stroke={colors.ocean}
            strokeWidth={1.8}
            strokeLinejoin="round"
            transform={`scale(${planeScaleShared}) translate(-12 -12)`}
          />
        </g>
      )}
    </g>
  );
}

export default memo(JourneyHighlight);
