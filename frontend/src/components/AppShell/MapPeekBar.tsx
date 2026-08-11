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
      className="map-glass lg:hidden absolute inset-x-0 bottom-0 z-10 min-h-14 px-4 flex items-center justify-between gap-3 border-t text-left focus:outline-none focus:ring-2 focus:ring-inset focus:ring-brand-400"
    >
      {/*
        Each stat stacks its number over its label. Side by side they ran out
        of room and wrapped; stacked, they fit the same bar height because the
        two lines together are shorter than one line of 18px text plus its
        leading.
      */}
      <span className="flex items-center gap-5 min-w-0">
        <span className="flex flex-col leading-none">
          <span className="text-base font-bold">{countriesVisited}</span>
          <span className="text-[11px] map-glass-muted mt-0.5">countries</span>
        </span>
        <span className="flex flex-col leading-none">
          <span className="text-base font-bold text-brand-700">
            {worldPercent}%
          </span>
          <span className="text-[11px] map-glass-muted mt-0.5">of world</span>
        </span>
        {flights > 0 && (
          <span className="flex flex-col leading-none">
            <span className="text-base font-bold">{flights}</span>
            <span className="text-[11px] map-glass-muted mt-0.5">flights</span>
          </span>
        )}
      </span>
      <svg
        className="w-5 h-5 flex-shrink-0 map-glass-muted"
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
