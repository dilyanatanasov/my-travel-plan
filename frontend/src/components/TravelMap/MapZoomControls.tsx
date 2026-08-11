import { memo } from 'react';

interface MapZoomControlsProps {
  zoom: number;
  minZoom: number;
  maxZoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
}

const buttonClass =
  'w-11 h-11 flex items-center justify-center map-glass map-glass-hover ' +
  'focus:outline-none focus:ring-2 focus:ring-inset focus:ring-brand-400 ' +
  'disabled:opacity-35';

/**
 * Explicit zoom controls.
 *
 * Pinch is undiscoverable on touch and unreachable by keyboard, so the map
 * needs real buttons regardless of gesture support. 44px targets to match the
 * rest of the app.
 */
function MapZoomControls({
  zoom,
  minZoom,
  maxZoom,
  onZoomIn,
  onZoomOut,
  onReset,
}: MapZoomControlsProps) {
  const isDefaultView = zoom <= minZoom + 0.001;

  return (
    // bottom-20 on mobile clears the peek bar pinned to the canvas floor.
    <div className="absolute bottom-20 lg:bottom-4 right-3 z-20 flex flex-col rounded-lg overflow-hidden shadow-lg border border-white/10 divide-y divide-white/10">
      <button
        type="button"
        onClick={onZoomIn}
        disabled={zoom >= maxZoom - 0.001}
        className={buttonClass}
        aria-label="Zoom in"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 4v16m8-8H4"
          />
        </svg>
      </button>

      <button
        type="button"
        onClick={onZoomOut}
        disabled={isDefaultView}
        className={buttonClass}
        aria-label="Zoom out"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M20 12H4"
          />
        </svg>
      </button>

      {!isDefaultView && (
        <button
          type="button"
          onClick={onReset}
          className={buttonClass}
          aria-label="Reset map view"
          title="Reset view"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        </button>
      )}
    </div>
  );
}

export default memo(MapZoomControls);
