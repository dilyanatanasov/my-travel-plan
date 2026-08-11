import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

interface MapFocusValue {
  /** Journey the map should fly, set after one is created. */
  focusedJourneyId: number | null;
  /** Ask the map to show and animate a journey. Clears the open section. */
  focusJourney: (journeyId: number) => void;
  clearFocus: () => void;
}

const MapFocusContext = createContext<MapFocusValue | null>(null);

/**
 * Lets a form deep in a panel tell the map to fly a route.
 *
 * Adding a flight and then seeing nothing happen is a flat moment — the map
 * is the reward, and on mobile it is not even on screen when you submit. This
 * carries the new journey's id back to the map, which selects and animates
 * it, and to the shell, which closes the panel so you are looking at the map
 * when it happens.
 */
export function MapFocusProvider({
  children,
  onFocus,
}: {
  children: ReactNode;
  /** Shell hook, used to close whatever section is open. */
  onFocus?: () => void;
}) {
  const [focusedJourneyId, setFocusedJourneyId] = useState<number | null>(null);

  const value = useMemo<MapFocusValue>(
    () => ({
      focusedJourneyId,
      focusJourney: (journeyId: number) => {
        setFocusedJourneyId(journeyId);
        onFocus?.();
      },
      clearFocus: () => setFocusedJourneyId(null),
    }),
    [focusedJourneyId, onFocus]
  );

  return (
    <MapFocusContext.Provider value={value}>{children}</MapFocusContext.Provider>
  );
}

/** Returns a no-op outside a provider, so components stay usable in isolation. */
export function useMapFocus(): MapFocusValue {
  return (
    useContext(MapFocusContext) ?? {
      focusedJourneyId: null,
      focusJourney: () => undefined,
      clearFocus: () => undefined,
    }
  );
}
