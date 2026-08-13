interface MapFirstRunHintProps {
  /** Opens the Flights section, where a flight can be added or imported. */
  onAddFlights: () => void;
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
function MapFirstRunHint({ onAddFlights }: MapFirstRunHintProps) {
  /*
    Countries lead, flights follow (user decision, 2026-08-13): the first
    real user test read the old flights-first button as "the map is locked
    until I add flights". Tapping a country is the whole first interaction,
    so it gets the headline; flights are an invitation, not a prerequisite.
  */
  return (
    <div className="map-glass rounded-2xl border shadow-xl px-4 py-3 w-[19rem] max-w-[calc(100vw-1.5rem)]">
      <p className="text-sm font-semibold">Tap any country you've been to</p>
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
