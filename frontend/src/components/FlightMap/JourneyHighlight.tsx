import { memo, useEffect, useRef } from 'react';
import { useMapContext, useZoomPanContext } from 'react-simple-maps';
import { calculateArcPath, getZoomAdjustedSize } from './routeUtils';
import {
  legFlightSeconds,
  STOP_PAUSE_SECONDS,
} from '../TravelMap/useJourneyReplay';
import { useMapColors } from '../../theme/mapColors';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import type { FlightJourney } from '../../types';

/**
 * Airliner silhouette in a 24x24 box, nose pointing right (+x): tapered
 * fuselage, swept wings, tailplane and tail cone. Vector on purpose — the
 * glyph scales 1.9× mid-flight and recolors with the theme, both of which a
 * raster plane cannot survive.
 *
 * The direction matters: animateMotion's rotate="auto" aligns +x with the
 * path tangent, so a nose-up drawing would fly permanently sideways.
 */
const PLANE_PATH =
  'M21.8 12 C22 11.4 21 10.9 19.5 10.9 L14.5 10.9 L9.5 5.2 L7.6 5.2 L11.4 10.9 ' +
  'L5.8 10.9 L3.4 8.6 L2.2 8.6 L3.6 11.2 L2.6 11.6 L2.6 12.4 L3.6 12.8 ' +
  'L2.2 15.4 L3.4 15.4 L5.8 13.1 L11.4 13.1 L7.6 18.8 L9.5 18.8 L14.5 13.1 ' +
  'L19.5 13.1 C21 13.1 22 12.6 21.8 12 Z';

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
  /**
   * Loop the flight (ambient selected-route mode) or fly once and park at
   * the destination (replay mode). The replay's settle pause is longer than
   * the flight, and a looping plane visibly took off again right before the
   * step switched.
   */
  loop?: boolean;
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
  loop = true,
  onClear,
}: JourneyHighlightProps) {
  const repeat = loop ? 'indefinite' : '1';

  /*
    SMIL clocks start at DOCUMENT time zero, not element insertion. A journey
    mounted a minute into the session, playing once with fill=freeze, would
    consider itself long finished and render a frozen plane at the
    destination — which is exactly how the replay broke while the looping
    ambient mode kept working. begin="indefinite" + beginElement() on mount
    pins every animation's t=0 to the moment its journey appears.
  */
  type Beginable = SVGElement & { beginElement: () => void };
  const motionRef = useRef<Beginable | null>(null);
  const altitudeRef = useRef<Beginable | null>(null);
  const trailDrawRef = useRef<Beginable | null>(null);
  const trailFadeRef = useRef<Beginable | null>(null);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      for (const ref of [motionRef, altitudeRef, trailDrawRef, trailFadeRef]) {
        try {
          ref.current?.beginElement();
        } catch {
          /* detached mid-switch; the next mount will begin it */
        }
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [journey.id]);

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
        // Projected chord length: the weight that maps time onto keyPoints,
        // so a pause lands exactly on the airport rather than at a km-based
        // guess distorted by the projection.
        screenLen: Math.hypot(
          (to as [number, number])[0] - (from as [number, number])[0],
          (to as [number, number])[1] - (from as [number, number])[1],
        ),
      };
    })
    .filter(
      (
        entry,
      ): entry is {
        leg: (typeof legs)[number];
        pathD: string;
        screenLen: number;
      } => entry !== null,
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

  // 13, not 9: at 9 the glyph was ~8px and sat directly on top of a route
  // line of the same colour, which is why it vanished on the light map.
  const planeScaleShared = getZoomAdjustedSize(13 * sizeScale, zoom) / 24;

  /*
    The journey's timeline: fly a leg (time from its own distance), land,
    pause on the ground, fly the next. Built as parallel keyPoints (position
    as a fraction of on-screen path length) and keyTimes (fractions of total
    time), with a pause encoded as the same keyPoint twice. The altitude
    profile rides the same clock: climb to a held 1.9× cruise inside each
    leg's slice, ground size through every stop.

    Replay mode times legs by distance; the ambient selected-route loop keeps
    its flat per-leg pace (it is scenery, not narration).
  */
  const legSeconds = drawn.map(({ leg }) =>
    legDurationSeconds !== undefined
      ? legFlightSeconds(Number(leg.distanceKm) || 0)
      : legDuration,
  );
  const totalSeconds =
    legSeconds.reduce((a, b) => a + b, 0) +
    STOP_PAUSE_SECONDS * Math.max(drawn.length - 1, 0);
  const totalScreenLen = drawn.reduce((a, d) => a + d.screenLen, 0) || 1;

  const keyPoints: string[] = ['0'];
  const keyTimes: string[] = ['0'];
  const altitudeValuesArr: string[] = ['1'];
  const altitudeKeyTimesArr: string[] = ['0'];
  {
    let t = 0;
    let len = 0;
    drawn.forEach((d, i) => {
      const legT = legSeconds[i];
      altitudeValuesArr.push('1.9', '1.9', '1');
      altitudeKeyTimesArr.push(
        ((t + 0.3 * legT) / totalSeconds).toFixed(4),
        ((t + 0.7 * legT) / totalSeconds).toFixed(4),
        ((t + legT) / totalSeconds).toFixed(4),
      );
      t += legT;
      len += d.screenLen;
      keyPoints.push((len / totalScreenLen).toFixed(4));
      keyTimes.push((t / totalSeconds).toFixed(4));
      if (i < drawn.length - 1) {
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
  }
  const journeyDuration = totalSeconds;
  const motionKeyPoints = keyPoints.join(';');
  const motionKeyTimes = keyTimes.join(';');
  const altitudeValues = altitudeValuesArr.join(';');
  const altitudeKeyTimes = altitudeKeyTimesArr.join(';');
  // The contrail's tip tracks the plane: dashoffset is 1 - lengthFraction.
  const contrailValues = keyPoints
    .map((p) => (1 - Number(p)).toFixed(4))
    .join(';');

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
          {/*
            The contrail. The app is named after one; the plane finally
            leaves one. pathLength={1} normalises the whole chain so the
            dashoffset animation can track the plane without measuring the
            path, and the same ease as the motion keeps the trail's tip
            glued to the tail. It dissolves before landing — contrails do.
          */}
          <path
            d={journeyPath}
            fill="none"
            stroke={colors.routeHighlight}
            strokeWidth={getZoomAdjustedSize(1.3 * sizeScale, zoom)}
            strokeLinecap="round"
            pathLength={1}
            strokeDasharray="1"
            strokeDashoffset={1}
            opacity={0.5}
          >
            <animate
              ref={trailDrawRef as React.RefObject<SVGElement>}
              begin="indefinite"
              attributeName="stroke-dashoffset"
              values={contrailValues}
              keyTimes={motionKeyTimes}
              calcMode="linear"
              dur={`${journeyDuration}s`}
              repeatCount={repeat}
              fill="freeze"
            />
            <animate
              ref={trailFadeRef as React.RefObject<SVGElement>}
              begin="indefinite"
              attributeName="opacity"
              values="0.5;0.5;0"
              keyTimes="0;0.72;1"
              dur={`${journeyDuration}s`}
              repeatCount={repeat}
            fill="freeze"
            />
          </path>
          {/*
            linear over the timeline: fly, hold at the airport (same keyPoint
            twice), fly on. Per-leg speed comes from the timeline itself.
          */}
          <animateMotion
            ref={motionRef as React.RefObject<SVGElement>}
            begin="indefinite"
            dur={`${journeyDuration}s`}
            repeatCount={repeat}
            fill="freeze"
            path={journeyPath}
            rotate="auto"
            calcMode="linear"
            keyPoints={motionKeyPoints}
            keyTimes={motionKeyTimes}
          />
          {/*
            Altitude illusion: the glyph grows to cruise size mid-leg and
            shrinks for every landing — one climb-and-descent per leg, built
            from the leg count so a three-leg trip dips at each stop.
          */}
          <g>
            <animateTransform
              ref={altitudeRef as React.RefObject<SVGElement>}
              begin="indefinite"
              attributeName="transform"
              type="scale"
              values={altitudeValues}
              keyTimes={altitudeKeyTimes}
              calcMode="linear"
              dur={`${journeyDuration}s`}
              repeatCount={repeat}
            fill="freeze"
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
              stroke={colors.planeOutline}
              strokeWidth={1.8}
              strokeLinejoin="round"
              transform={`scale(${planeScaleShared}) translate(-12 -12)`}
            />
          </g>
        </g>
      )}
    </g>
  );
}

export default memo(JourneyHighlight);
