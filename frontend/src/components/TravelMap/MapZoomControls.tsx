import { memo } from 'react';

interface MapZoomControlsProps {
  /**
   * Optional extra tool rendered above the zoom buttons.
   *
   * Replay belongs with the map's other controls rather than floating over
   * the canvas on its own: it is a nice thing to have, not the headline
   * feature, and a permanent pill in the middle of the map claimed far more
   * attention than it deserves.
   */
  extraTool?: React.ReactNode;
  /** Renders below the minus — the bottom-anchored, never-moving slot. */
  bottomTool?: React.ReactNode;
  zoom: number;
  minZoom: number;
  maxZoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  /**
   * Whether the view has moved away from the one the map opened with.
   *
   * Not the same as "zoomed in past the minimum": the map now opens framed on
   * the user's own countries, so the opening view is rarely the world view.
   * Comparing against minZoom left Reset permanently visible, offering to
   * return you to where you already were.
   */
  canReset: boolean;
}

const buttonClass =
  'w-11 h-11 flex items-center justify-center map-glass map-glass-hover ' +
  'first:rounded-t-lg last:rounded-b-lg ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-400 ' +
  // 60%, not 35: at 35 the glass button vanished entirely and the control
  // looked broken. The button stays visibly present; the dimming plus the
  // cursor say "exists, just not right now".
  'disabled:opacity-60 disabled:cursor-not-allowed';

/**
 * Explicit zoom controls.
 *
 * Pinch is undiscoverable on touch and unreachable by keyboard, so the map
 * needs real buttons regardless of gesture support. 44px targets to match the
 * rest of the app.
 */
function MapZoomControls({
  extraTool,
  bottomTool,
  canReset,
  zoom,
  minZoom,
  maxZoom,
  onZoomIn,
  onZoomOut,
  onReset,
}: MapZoomControlsProps) {
  // Only governs the zoom-out button: you genuinely cannot go below minZoom.
  const isFullyZoomedOut = zoom <= minZoom + 0.001;

  return (
    // bottom-20 on mobile clears the peek bar pinned to the canvas floor.
    <div className="absolute bottom-20 lg:bottom-4 right-3 z-20 flex flex-col rounded-lg overflow-hidden shadow-lg border border-current/15 divide-y divide-current/15">
      {extraTool}

      {/*
        Reset renders first, above the +/- pair.

        The stack is anchored by its bottom edge, so appending a third button
        grew the container upward and shifted + and - up under the cursor the
        moment you first zoomed. Putting the conditional button at the top
        means the two permanent ones never move.
      */}
      {canReset && (
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
        disabled={isFullyZoomedOut}
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

      {/* Bottom-anchored stack: this slot never moves, whatever appears
          above — the home for the globe/flat mode toggle. */}
      {bottomTool}
    </div>
  );
}

export default memo(MapZoomControls);
