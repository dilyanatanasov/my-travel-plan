import { useMapContext, useZoomPanContext } from 'react-simple-maps';
import { getZoomAdjustedSize } from '../FlightMap/routeUtils';
import { legPhotoUrl } from '../../features/flights/StopPhotoControl';
import type { ReplayPostcard } from './useReplayOrchestration';

/**
 * The replay postcard (trip photos, 2026-08-14): a tilted polaroid that
 * pops in ABOVE the arrival city — inside the map SVG, so it rides pans,
 * zooms and the globe's rotation like every other marker. The white band
 * carries the city and the trip's date. Screen-constant size via the same
 * zoom compensation the airport markers use (the globe pins k=1, where
 * magnification lives in the projection).
 */
function PostcardMarker({ postcard }: { postcard: ReplayPostcard }) {
  const { projection } = useMapContext();
  const { k: zoom } = useZoomPanContext();

  const point = projection([postcard.lon, postcard.lat]);
  if (!point) return null;
  const [x, y] = point;

  const photoW = getZoomAdjustedSize(150, zoom);
  const photoH = photoW * 0.7;
  const pad = photoW * 0.055;
  const band = photoW * 0.2;
  const frameW = photoW + pad * 2;
  const frameH = photoH + pad + band;
  // Clears the airport's popping name pill, which also lands above the
  // marker at the same moment (user report: they overlapped).
  const gap = getZoomAdjustedSize(38, zoom);
  /*
    Every card leans its own way (user call, 2026-08-14): direction and
    angle derive from the leg id, so a given stop's postcard is stable
    across replays while neighbouring stops differ — ±3° to ±5°.
  */
  const tilt =
    (postcard.legId % 2 === 0 ? 1 : -1) * (3 + (postcard.legId % 3));

  return (
    <g
      transform={`translate(${x}, ${y - gap})`}
      pointerEvents="none"
      aria-hidden="true"
    >
      {/* Keyed re-mount restarts the pop; CSS transform composes inside
          the positioned group (transform-box: fill-box in index.css). */}
      <g key={postcard.key} className="postcard-pop">
        <g
          transform={`translate(${-frameW / 2}, ${-frameH}) rotate(${tilt}, ${
            frameW / 2
          }, ${frameH})`}
        >
          {/* Soft drop shadow, then the paper. */}
          <rect
            x={frameW * 0.03}
            y={frameW * 0.04}
            width={frameW}
            height={frameH}
            rx={frameW * 0.025}
            fill="rgba(0,0,0,0.28)"
          />
          <rect
            width={frameW}
            height={frameH}
            rx={frameW * 0.025}
            fill="#ffffff"
            stroke="rgba(0,0,0,0.12)"
            strokeWidth={1}
          />
          <image
            href={legPhotoUrl(postcard.legId)}
            x={pad}
            y={pad}
            width={photoW}
            height={photoH}
            preserveAspectRatio="xMidYMid slice"
          />
          <text
            x={frameW / 2}
            y={pad + photoH + band * 0.68}
            textAnchor="middle"
            fontSize={photoW * 0.082}
            fontFamily="Caprasimo, Georgia, serif"
            fill="#201e1d"
          >
            {postcard.caption}
          </text>
        </g>
      </g>
    </g>
  );
}

export default PostcardMarker;
