import { useMapContext, useZoomPanContext } from 'react-simple-maps';
import { getZoomAdjustedSize } from '../FlightMap/routeUtils';
import { legPhotoUrl } from '../../features/flights/StopPhotoControl';
import type { ReplayPostcard } from './useReplayOrchestration';
import { wrapCaption } from './postcardCaption';

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
  const zoomPan = useZoomPanContext();
  const { k: zoom } = zoomPan;

  const point = projection([postcard.lon, postcard.lat]);
  if (!point) return null;
  const [x, y] = point;

  const photoW = getZoomAdjustedSize(150, zoom);
  const photoH = photoW * 0.7;
  const pad = photoW * 0.055;
  const lines = wrapCaption(postcard.caption);
  // The band grows for a second caption line instead of cutting it off.
  const band = photoW * (lines.length > 1 ? 0.32 : 0.2);
  const fontSize = photoW * 0.082;
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

  /*
    An SVG marker cannot z-index above the HTML replay bar, so a city near
    the top gets the equivalent: the postcard flips to hang BELOW it.
    Screen-space y = pan offset + zoom·projected (the globe pins the
    context at identity, so there it is just the projection).
  */
  const screenY = zoomPan.y + zoom * y;
  const screenCardTop = 38 + frameH; // constant on screen by construction
  // 230px clears even a tall two-line itinerary bar on a phone.
  const flipped = screenY - screenCardTop < 230;

  return (
    <g
      transform={`translate(${x}, ${flipped ? y + gap : y - gap})`}
      pointerEvents="none"
      aria-hidden="true"
    >
      {/* Keyed re-mount restarts the pop; CSS transform composes inside
          the positioned group (transform-box: fill-box in index.css). */}
      <g
        key={postcard.key}
        className={flipped ? 'postcard-pop postcard-pop-down' : 'postcard-pop'}
      >
        <g
          transform={
            flipped
              ? `translate(${-frameW / 2}, 0) rotate(${tilt}, ${frameW / 2}, 0)`
              : `translate(${-frameW / 2}, ${-frameH}) rotate(${tilt}, ${
                  frameW / 2
                }, ${frameH})`
          }
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
          {lines.map((lineText, i) => (
            <text
              key={i}
              x={frameW / 2}
              y={
                pad +
                photoH +
                (lines.length > 1
                  ? band * 0.36 + i * fontSize * 1.3
                  : band * 0.68)
              }
              textAnchor="middle"
              fontSize={fontSize}
              fontFamily="Caprasimo, Georgia, serif"
              fill="#201e1d"
            >
              {lineText}
            </text>
          ))}
        </g>
      </g>
    </g>
  );
}

export default PostcardMarker;
