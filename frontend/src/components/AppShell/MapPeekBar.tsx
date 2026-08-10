interface MapPeekBarProps {
  countriesVisited: number;
  worldPercent: number;
  flights: number;
  onOpenOverview: () => void;
}

/**
 * Compact stat strip pinned to the bottom of the map canvas on mobile.
 *
 * A whole world at every longitude is 2:1, and a portrait phone canvas is not,
 * so fitting the map horizontally always leaves vertical room. Rather than
 * leave that as empty ocean, it carries the headline numbers — which also
 * means the most common question ("how many countries?") is answered without
 * opening anything.
 */
function MapPeekBar({
  countriesVisited,
  worldPercent,
  flights,
  onOpenOverview,
}: MapPeekBarProps) {
  return (
    <button
      type="button"
      onClick={onOpenOverview}
      className="lg:hidden absolute inset-x-0 bottom-0 z-10 min-h-14 px-4 flex items-center justify-between gap-3 bg-surface/95 backdrop-blur border-t border-line text-left focus:outline-none focus:ring-2 focus:ring-inset focus:ring-brand-500"
    >
      <span className="flex items-baseline gap-3 min-w-0">
        <span className="flex items-baseline gap-1">
          <span className="text-lg font-bold text-ink">{countriesVisited}</span>
          <span className="text-xs text-ink-muted">countries</span>
        </span>
        <span className="text-line-strong" aria-hidden="true">
          ·
        </span>
        <span className="flex items-baseline gap-1">
          <span className="text-lg font-bold text-brand-700">
            {worldPercent}%
          </span>
          <span className="text-xs text-ink-muted">of world</span>
        </span>
        {flights > 0 && (
          <>
            <span className="text-line-strong" aria-hidden="true">
              ·
            </span>
            <span className="flex items-baseline gap-1">
              <span className="text-lg font-bold text-ink">{flights}</span>
              <span className="text-xs text-ink-muted">flights</span>
            </span>
          </>
        )}
      </span>
      <svg
        className="w-5 h-5 flex-shrink-0 text-ink-subtle"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 5l7 7-7 7"
        />
      </svg>
      <span className="sr-only">Open overview</span>
    </button>
  );
}

export default MapPeekBar;
