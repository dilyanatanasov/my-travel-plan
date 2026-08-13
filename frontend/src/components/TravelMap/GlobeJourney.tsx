import { memo } from 'react';
import { useMapContext } from 'react-simple-maps';
import type { LineString } from 'geojson';
import type { FlightJourney } from '../../types';
import { PLANE_PATH } from '../FlightMap/JourneyHighlight';
import { useMapColors } from '../../theme/mapColors';
import { cameraCenter, isOnVisibleSide, type PlaneFrame } from './globeUtils';

interface GlobeJourneyProps {
  journey: FlightJourney;
  /** Sampled each frame by GlobeView's replay loop. */
  plane: PlaneFrame;
  sizeScale?: number;
}

/**
 * The replay journey as seen from space: great-circle leg arcs, a contrail of
 * the track flown so far, and the plane itself.
 *
 * This is the one place the globe deliberately does NOT reuse the flat map's
 * JourneyHighlight. That component is built on SMIL — animateMotion along a
 * screen-space path that is computed once per journey. On the globe the
 * camera follows the plane, which means the projection changes every frame
 * and every path's `d` changes with it; a SMIL clock bound to a mutating
 * motion path is exactly the kind of undefined behaviour the flat map's
 * begin="indefinite" lesson warns about. Since the camera loop already knows
 * the plane's geographic position each frame, the plane is simply drawn
 * there: one source of truth, camera and plane can never drift apart. The
 * timeline math (per-leg sqrt-distance seconds, ground stops, the altitude
 * profile) is shared with the flat version via useJourneyReplay/globeUtils.
 */
function GlobeJourney({ journey, plane, sizeScale = 1 }: GlobeJourneyProps) {
  const { map: colors } = useMapColors();
  const { path, projection } = useMapContext();

  const legs = [...(journey.legs ?? [])].sort((a, b) => a.legOrder - b.legOrder);

  // geoPath samples the great circle and clips it at the horizon for free —
  // this is why routes on the globe are LineStrings, never screen-space arcs.
  const legLine = (leg: (typeof legs)[number]): string | null => {
    const dep = leg.departureAirport;
    const arr = leg.arrivalAirport;
    if (!dep || !arr) return null;
    const line: LineString = {
      type: 'LineString',
      coordinates: [
        [Number(dep.longitude), Number(dep.latitude)],
        [Number(arr.longitude), Number(arr.latitude)],
      ],
    };
    return path(line) || null;
  };

  const trailLine: LineString = {
    type: 'LineString',
    coordinates: plane.trail,
  };
  const trailD = plane.trail.length > 1 ? path(trailLine) : null;

  /*
    The raw projection maps the far hemisphere onto the same disk, so the
    glyph must be hidden explicitly when the plane is behind the globe —
    which can happen for a beat while the camera is still catching up with a
    journey that started on the other side of the world.
  */
  const rotate = projection.rotate ? projection.rotate() : [0, 0, 0];
  const center = cameraCenter([rotate[0], rotate[1]]);
  const planeVisible = isOnVisibleSide(plane.position, center);
  const pos = planeVisible ? projection(plane.position) : null;
  const aheadPos = planeVisible ? projection(plane.ahead) : null;

  let bearing = 0;
  if (pos && aheadPos) {
    const dx = aheadPos[0] - pos[0];
    const dy = aheadPos[1] - pos[1];
    if (dx !== 0 || dy !== 0) bearing = (Math.atan2(dy, dx) * 180) / Math.PI;
  }

  // Same size reasoning as the flat plane: a 24-unit glyph scaled to ~13px,
  // multiplied by the altitude illusion. k is 1 on the globe (no ZoomableGroup),
  // so no zoom adjustment is needed — projection scale handles magnification.
  const planeScale = ((13 * sizeScale) / 24) * plane.altitude;

  return (
    <g className="journey-highlight" pointerEvents="none">
      {legs.map((leg) => {
        const d = legLine(leg);
        if (!d) return null;
        const width = 2.4 * sizeScale;
        return (
          <g key={leg.id ?? `${leg.legOrder}`}>
            {/* Soft glow, then solid base — the flat highlight's layering. */}
            <path
              d={d}
              fill="none"
              stroke={colors.selectedGlow}
              strokeWidth={width * 2.6}
              strokeLinecap="round"
              strokeOpacity={0.28}
            />
            <path
              d={d}
              fill="none"
              stroke={colors.selected}
              strokeWidth={width}
              strokeLinecap="round"
            />
          </g>
        );
      })}

      {/* The contrail: the exact track flown so far, clipped at the horizon. */}
      {trailD && (
        <path
          d={trailD}
          fill="none"
          stroke={colors.routeHighlight}
          strokeWidth={1.3 * sizeScale}
          strokeLinecap="round"
          opacity={0.5}
        />
      )}

      {pos && (
        <g transform={`translate(${pos[0]}, ${pos[1]}) rotate(${bearing})`}>
          <path
            d={PLANE_PATH}
            fill={colors.routeHighlight}
            stroke={colors.planeOutline}
            strokeWidth={1.8}
            strokeLinejoin="round"
            transform={`scale(${planeScale}) translate(-12 -12)`}
          />
        </g>
      )}
    </g>
  );
}

export default memo(GlobeJourney);
