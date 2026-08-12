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
  return (
    <div className="map-glass rounded-2xl border shadow-xl px-4 py-3 w-[19rem] max-w-[calc(100vw-1.5rem)]">
      <p className="text-sm font-semibold">Your map is empty</p>
      <p className="text-xs map-glass-muted mt-1 leading-relaxed">
        Tap any country to mark it visited. Add flights and the routes draw
        themselves between the airports.
      </p>
      <button
        type="button"
        onClick={onAddFlights}
        className="mt-2.5 w-full min-h-10 rounded-xl bg-brand-600 text-white text-sm font-medium
          hover:bg-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
      >
        Add your flights
      </button>
    </div>
  );
}

export default MapFirstRunHint;
