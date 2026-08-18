import {
  PLANE_PATH,
  PLANE_LIGHTS,
  HALO_WIDTH,
  HALO_INNER_WIDTH,
} from '../../lib/planeSprite';

interface PlaneGlyphProps {
  /** Applied to the whole group - the callers own scale and centring. */
  transform: string;
  fill: string;
  /** Halo ring color - theme-aware, usually the ocean tone. */
  outline: string;
}

/**
 * The aircraft the live map and the globe fly: the shared silhouette plus
 * its navigation lights - port red, starboard green, white tail strobe.
 * The blink lives in CSS (.plane-light-* in index.css), so it costs no
 * re-renders and switches off cleanly under prefers-reduced-motion.
 * The sticker halo (wide ring + thin inner stroke) is what keeps the
 * glyph visible over selected countries.
 */
function PlaneGlyph({ transform, fill, outline }: PlaneGlyphProps) {
  return (
    <g transform={transform}>
      <path
        d={PLANE_PATH}
        fill="none"
        stroke={outline}
        strokeWidth={HALO_WIDTH}
        strokeLinejoin="round"
        opacity={0.95}
      />
      <path
        d={PLANE_PATH}
        fill={fill}
        stroke={outline}
        strokeWidth={HALO_INNER_WIDTH}
        strokeLinejoin="round"
      />
      <circle
        className="plane-light-port"
        cx={PLANE_LIGHTS.port.x}
        cy={PLANE_LIGHTS.port.y}
        r={1.5}
        fill={PLANE_LIGHTS.port.color}
      />
      <circle
        className="plane-light-stbd"
        cx={PLANE_LIGHTS.starboard.x}
        cy={PLANE_LIGHTS.starboard.y}
        r={1.5}
        fill={PLANE_LIGHTS.starboard.color}
      />
      <circle
        className="plane-light-strobe"
        cx={PLANE_LIGHTS.strobe.x}
        cy={PLANE_LIGHTS.strobe.y}
        r={1.2}
        fill={PLANE_LIGHTS.strobe.color}
      />
    </g>
  );
}

export default PlaneGlyph;
