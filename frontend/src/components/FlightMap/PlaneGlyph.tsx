import { PLANE_PATH, PLANE_LIGHTS } from '../../lib/planeSprite';

interface PlaneGlyphProps {
  /** Applied to the whole group - the callers own scale and centring. */
  transform: string;
  fill: string;
  outline: string;
}

/**
 * The aircraft the live map and the globe fly: the shared silhouette plus
 * its navigation lights - port red, starboard green, white tail strobe.
 * The blink lives in CSS (.plane-light-* in index.css), so it costs no
 * re-renders and switches off cleanly under prefers-reduced-motion.
 */
function PlaneGlyph({ transform, fill, outline }: PlaneGlyphProps) {
  return (
    <g transform={transform}>
      <path
        d={PLANE_PATH}
        fill={fill}
        stroke={outline}
        strokeWidth={1.8}
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
