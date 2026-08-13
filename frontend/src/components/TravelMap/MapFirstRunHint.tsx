interface MapFirstRunHintProps {
  /** Opens the Flights section, where a flight can be added or imported. */
  onAddFlights: () => void;
  /** The hint floats over the map and can cover the very country someone is
      trying to tap — it has to be removable without obeying it. */
  onDismiss: () => void;
}

/**
 * What to do with an empty map.
 *
 * A world map with nothing on it looks finished — there is no spinner, no
 * gap, nothing obviously missing. Someone arriving for the first time has no
 * way to know that tapping a country is the whole interaction, so the app
 * reads as broken or pointless rather than empty.
 *
 * Shown only when there is genuinely nothing: one visit or one flight and it
 * disappears for good.
 */
function MapFirstRunHint({ onAddFlights, onDismiss }: MapFirstRunHintProps) {
  /*
    Countries lead, flights follow (user decision, 2026-08-13): the first
    real user test read the old flights-first button as "the map is locked
    until I add flights". Tapping a country is the whole first interaction,
    so it gets the headline; flights are an invitation, not a prerequisite.
  */
  return (
    <div className="map-glass rounded-2xl border shadow-xl px-4 py-3 w-[19rem] max-w-[calc(100vw-1.5rem)] relative">
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss hint"
        className="absolute top-1 right-1 w-9 h-9 flex items-center justify-center rounded-lg
          map-glass-muted hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
      <p className="text-sm font-semibold pr-8">Tap any country you've been to</p>
      <p className="text-xs map-glass-muted mt-1 leading-relaxed">
        That's all it takes — it turns into part of your map. Countries you
        tap are saved as visited.
      </p>
      <button
        type="button"
        onClick={onAddFlights}
        className="mt-2 text-xs font-medium text-brand-text hover:text-brand-700 underline
          min-h-8 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded"
      >
        Flown somewhere? Add your flights too
      </button>
    </div>
  );
}

export default MapFirstRunHint;
