import {
  VEHICLE_PATHS,
  VEHICLE_LIGHTS,
  HEADLIGHT_COLOR,
  HEADLIGHT_BEAM_COLOR,
  BEAM_LENGTH,
  BEAM_SPREAD,
  HALO_WIDTH,
  HALO_INNER_WIDTH,
} from '../../lib/planeSprite';
import type { TravelMode } from '../../types';
import PlaneGlyph from './PlaneGlyph';

interface VehicleGlyphProps {
  mode: TravelMode;
  /** Applied to the whole group - the callers own scale and centring. */
  transform: string;
  fill: string;
  outline: string;
}

/**
 * The leg's own vehicle for SVG surfaces: the plane keeps its navigation
 * lights; the train runs a central headlamp with a beam cone, the car
 * and bus a stacked pair. The glow breathes via CSS (.vehicle-* in
 * index.css) - zero re-renders, quiet under prefers-reduced-motion.
 */
function VehicleGlyph({ mode, transform, fill, outline }: VehicleGlyphProps) {
  if (mode === 'flight') {
    return <PlaneGlyph transform={transform} fill={fill} outline={outline} />;
  }
  const lights = VEHICLE_LIGHTS[mode] ?? [];
  return (
    <g transform={transform}>
      {/* The ferry's wake: diverging foam drifting astern via CSS. */}
      {mode === 'ferry' && (
        <g stroke="#f4fbfa" strokeWidth={1.1} strokeLinecap="round" fill="none">
          <path className="ferry-wake ferry-wake-a" d="M1.4 11 L3.4 11.6 M1.4 13 L3.4 12.4" />
          <path className="ferry-wake ferry-wake-b" d="M1.4 10.4 L3.4 11.2 M1.4 13.6 L3.4 12.8" />
          <path className="ferry-wake ferry-wake-c" d="M1.4 9.8 L3.4 10.8 M1.4 14.2 L3.4 13.2" />
        </g>
      )}
      {lights.map((light, index) => (
        <polygon
          key={`beam-${index}`}
          className="vehicle-beam"
          points={`${light.x + 0.2},${light.y} ${light.x + BEAM_LENGTH},${
            light.y - BEAM_SPREAD
          } ${light.x + BEAM_LENGTH},${light.y + BEAM_SPREAD}`}
          fill={HEADLIGHT_BEAM_COLOR}
        />
      ))}
      <path
        d={VEHICLE_PATHS[mode]}
        fill="none"
        stroke={outline}
        strokeWidth={HALO_WIDTH}
        strokeLinejoin="round"
        opacity={0.95}
      />
      <path
        d={VEHICLE_PATHS[mode]}
        fill={fill}
        fillRule="evenodd"
        stroke={outline}
        strokeWidth={HALO_INNER_WIDTH}
        strokeLinejoin="round"
      />
      {lights.map((light, index) => (
        <circle
          key={`lamp-${index}`}
          className="vehicle-headlight"
          cx={light.x}
          cy={light.y}
          r={1}
          fill={HEADLIGHT_COLOR}
        />
      ))}
    </g>
  );
}

export default VehicleGlyph;
