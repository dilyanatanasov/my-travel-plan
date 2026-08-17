import { memo, useEffect, useRef } from 'react';
import { useMapContext, useZoomPanContext } from 'react-simple-maps';
import { calculateArcPath, getZoomAdjustedSize } from './routeUtils';
import { buildFlightTimeline } from './flightTimeline';
import { useMapColors } from '../../theme/mapColors';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import type { FlightJourney } from '../../types';

// The glyphs live in lib/planeSprite, shared with the canvas video
// renderers so every surface drives the same vehicles.
import VehicleGlyph from './VehicleGlyph';
import { legEndpoints, legMode } from './routeUtils';

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
  // One per leg on mixed-mode journeys: the glyph-swap opacity animates
  // share the same clock, so they begin in the same batch.
  const swapRefs = useRef<(Beginable | null)[]>([]);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const refs = [
        motionRef.current,
        altitudeRef.current,
        trailDrawRef.current,
        trailFadeRef.current,
        ...swapRefs.current,
      ];
      for (const element of refs) {
        try {
          element?.beginElement();
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
      const endpoints = legEndpoints(leg);
      if (!endpoints) return null;
      const { departure: dep, arrival: arr } = endpoints;
      const from = projection([Number(dep.longitude), Number(dep.latitude)]);
      const to = projection([Number(arr.longitude), Number(arr.latitude)]);
      if (!from || !to) return null;
      const mode = legMode(leg);
      return {
        leg,
        mode,
        // A land leg draws as a straight chord - things on the ground do
        // not bow through the sky. Curvature 0 keeps the same Q-path
        // shape, so the splice below still works.
        pathD: calculateArcPath(
          from as [number, number],
          to as [number, number],
          mode === 'flight' ? 0.2 : 0,
        ),
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
        mode: ReturnType<typeof legMode>;
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

  /* The journey's timeline lives in flightTimeline.ts, where it is tested. */
  const {
    totalSeconds: journeyDuration,
    motionKeyPoints,
    motionKeyTimes,
    altitudeValues,
    altitudeKeyTimes,
    contrailValues,
    legWindows,
  } = buildFlightTimeline(
    drawn.map(({ leg, mode, screenLen }) => ({
      screenLen,
      distanceKm: Number(leg.distanceKm) || 0,
      grounded: mode !== 'flight',
    })),
    { legDurationSeconds, ambientLegSeconds: legDuration },
  );

  /*
    Mixed-mode journeys swap the vehicle at each stop (owner ask,
    2026-08-17: Varna ✈ Geneva 🚆 Basel 🚗 Colmar must SHOW the plane,
    then the train, then the car). One glyph per leg rides the same
    moving group; discrete opacity keyframes hand the baton at each leg's
    takeoff. All-one-mode journeys (nearly all of them) skip the
    machinery and render a single glyph exactly as before.
  */
  const modes = drawn.map(({ mode }) => mode);
  const isMixed = new Set(modes).size > 1;
  const glyphWindows = modes.map((mode, index) => ({
    mode,
    // Visible from this leg's takeoff until the next leg's; the vehicle
    // that just landed keeps the stage through the stop pause.
    from: index === 0 ? 0 : legWindows[index].start,
    until: index === modes.length - 1 ? 1 : legWindows[index + 1].start,
  }));

  return (
    <g className="journey-highlight">
      {drawn.map(({ leg, mode, pathD }, index) => {
        const width = getZoomAdjustedSize(2.4 * sizeScale, zoom);
        const dash = getZoomAdjustedSize(7, zoom);
        const gap = getZoomAdjustedSize(9, zoom);
        // The glyph is drawn in a 24-unit box, so this converts it to roughly
        // the diameter the old marker dot had.
        const delay = (index * legDuration) / Math.max(legs.length, 1);

        return (
          <g key={leg.id ?? `${leg.legOrder}-${index}`}>
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
            {/* Solid base so the leg is legible with motion disabled.
                Land legs are dashed - the ground-travel signature, same
                language as the aggregate route layer. */}
            <path
              d={pathD}
              fill="none"
              stroke={colors.selected}
              strokeWidth={width}
              strokeLinecap="round"
              strokeDasharray={
                mode !== 'flight' ? `${dash * 0.8} ${gap * 0.55}` : undefined
              }
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
            {!isMixed ? (
              <VehicleGlyph
                mode={modes[0] ?? 'flight'}
                transform={`scale(${planeScaleShared}) translate(-12 -12)`}
                fill={colors.routeHighlight}
                outline={colors.planeOutline}
              />
            ) : (
              /*
                The baton pass: every leg's vehicle rides the same moving
                group; discrete opacity keyframes show exactly one at a
                time, swapping at each next leg's departure. The vehicle
                that just arrived keeps the stop pause - you watch the
                plane land in Geneva, then the train pulls out.
              */
              glyphWindows.map((window, index) => (
                <g key={index} opacity={index === 0 ? 1 : 0}>
                  {/* keyTimes must span 0..1 exactly or SMIL drops the
                      whole animation, hence the fixed four-point form. */}
                  <animate
                    ref={(el) => {
                      swapRefs.current[index] = el as unknown as
                        | (SVGElement & { beginElement: () => void })
                        | null;
                    }}
                    begin="indefinite"
                    attributeName="opacity"
                    values={
                      index === 0
                        ? '1;0;0'
                        : window.until >= 1
                          ? '0;1;1'
                          : '0;1;0;0'
                    }
                    keyTimes={
                      index === 0
                        ? `0;${window.until};1`
                        : window.until >= 1
                          ? `0;${window.from};1`
                          : `0;${window.from};${window.until};1`
                    }
                    calcMode="discrete"
                    dur={`${journeyDuration}s`}
                    repeatCount={repeat}
                    fill="freeze"
                  />
                  <VehicleGlyph
                    mode={window.mode}
                    transform={`scale(${planeScaleShared}) translate(-12 -12)`}
                    fill={colors.routeHighlight}
                    outline={colors.planeOutline}
                  />
                </g>
              ))
            )}
          </g>
        </g>
      )}
    </g>
  );
}

export default memo(JourneyHighlight);
