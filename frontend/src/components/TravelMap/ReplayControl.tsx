import type { ReplayState } from './useJourneyReplay';

interface ReplayControlProps {
  replay: ReplayState;
}

/**
 * Start and stop the journey replay.
 *
 * Hidden below two journeys: replaying a single flight is just drawing it,
 * and offering a "play" that does nothing is worse than not offering one.
 */
function ReplayControl({ replay }: ReplayControlProps) {
  if (replay.total < 2) return null;

  return (
    <button
      type="button"
      onClick={replay.isPlaying ? replay.stop : replay.start}
      aria-label={
        replay.isPlaying
          ? `Stop replay, showing journey ${replay.index} of ${replay.total}`
          : `Replay ${replay.total} journeys in order`
      }
      className="map-glass map-glass-hover flex items-center gap-2 min-h-11 px-3 rounded-xl border shadow-lg
        focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
    >
      {replay.isPlaying ? (
        <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <rect x="6" y="5" width="4" height="14" rx="1" />
          <rect x="14" y="5" width="4" height="14" rx="1" />
        </svg>
      ) : (
        <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M8 5.5v13a1 1 0 001.53.85l10-6.5a1 1 0 000-1.7l-10-6.5A1 1 0 008 5.5z" />
        </svg>
      )}
      <span className="text-sm font-medium">
        {replay.isPlaying ? (
          /* tabular-nums so the counter does not jitter as it climbs. */
          <span className="tabular-nums">
            {replay.index} / {replay.total}
          </span>
        ) : (
          'Replay'
        )}
      </span>
    </button>
  );
}

export default ReplayControl;
