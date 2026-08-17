import { VEHICLE_PATHS } from '../../lib/planeSprite';
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
 * lights; land modes get their silhouettes. One component so the replay
 * and the globe swap vehicles mid-journey by just changing `mode`.
 */
function VehicleGlyph({ mode, transform, fill, outline }: VehicleGlyphProps) {
  if (mode === 'flight') {
    return <PlaneGlyph transform={transform} fill={fill} outline={outline} />;
  }
  return (
    <g transform={transform}>
      <path
        d={VEHICLE_PATHS[mode]}
        fill={fill}
        stroke={outline}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
    </g>
  );
}

export default VehicleGlyph;
