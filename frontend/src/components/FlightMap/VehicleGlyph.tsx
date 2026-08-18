import {
  VEHICLE_PATHS,
  VEHICLE_LIGHTS,
  HEADLIGHT_COLOR,
  HEADLIGHT_BEAM_COLOR,
  BEAM_LENGTH,
  BEAM_SPREAD,
  HALO_WIDTH,
  HALO_INNER_WIDTH,
  VEHICLE_INK,
  HALO_COLOR,
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
      {/* The ferry's wake and steam, starting astern of the halo (the
          first cut hid under the hull) - ink shadow beneath sticker-white
          foam so the churn reads on any sea. Motion via CSS (.ferry-*). */}
      {mode === 'ferry' && (
        <g fill="none" strokeLinecap="round">
          {[
            { stroke: VEHICLE_INK, width: 1.8, opacity: 0.45 },
            { stroke: HALO_COLOR, width: 1, opacity: 1 },
          ].map((layer) => (
            <g
              key={layer.stroke}
              stroke={layer.stroke}
              strokeWidth={layer.width}
              opacity={layer.opacity}
            >
              <path
                className="ferry-wake ferry-wake-a"
                d="M0.2 10.9 L2 11.5 M0.2 13.1 L2 12.5"
              />
              <path
                className="ferry-wake ferry-wake-b"
                d="M0.2 10.4 L2 11.2 M0.2 13.6 L2 12.8"
              />
              <path
                className="ferry-wake ferry-wake-c"
                d="M0.2 9.9 L2 10.9 M0.2 14.1 L2 13.1"
              />
            </g>
          ))}
          {[
            { className: 'ferry-steam ferry-steam-a', cy: 11.6 },
            { className: 'ferry-steam ferry-steam-b', cy: 12.4 },
            { className: 'ferry-steam ferry-steam-c', cy: 12 },
          ].map((puff) => (
            <circle
              key={puff.className}
              className={puff.className}
              cx={-0.6}
              cy={puff.cy}
              r={1}
              fill={HALO_COLOR}
              stroke={VEHICLE_INK}
              strokeWidth={0.25}
            />
          ))}
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
