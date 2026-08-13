import { useCallback, useRef, useState } from 'react';
import type { SearchTarget } from './MapSearch';
import { fitToPoints, type LonLat } from './fitBounds';

/**
 * What happens when a search result is chosen: fly the camera to fit the
 * country, blink it so it can be told apart from its unlabeled neighbours,
 * ping the exact airport spot, and open the country's card.
 *
 * Extracted from TravelMap (2026-08-13 consolidation) as a pure move; the
 * camera and card are the map's own state, reached through the callbacks.
 */

export interface SearchPing {
  label: string;
  lon: number;
  lat: number;
  key: number;
}

export function useSearchLanding(options: {
  countryBounds: Map<string, [LonLat, LonLat]>;
  /** Point the camera: every search landing counts as a deliberate move. */
  onFrame: (center: LonLat, zoom: number) => void;
  onOpenCountry: (isoCode: string | null) => void;
}): {
  /** Search landing: the found country blinks so it can be told apart. */
  searchBlinkIso: string | null;
  /** Search landing for an airport: a blinking name-ping at the exact spot. */
  searchPing: SearchPing | null;
  handleSearchGo: (target: SearchTarget) => void;
} {
  const { countryBounds, onFrame, onOpenCountry } = options;

  const [searchBlinkIso, setSearchBlinkIso] = useState<string | null>(null);
  const blinkTimerRef = useRef<number | null>(null);
  const [searchPing, setSearchPing] = useState<SearchPing | null>(null);
  const pingTimerRef = useRef<number | null>(null);

  const handleSearchGo = useCallback(
    (target: SearchTarget) => {
      /*
        Fit the country, don't just approach it: the fixed zoom the search box
        suggests (2.5) kept every landing at continental distance. With the
        country's bounding box the camera gets close for a Malta and stays
        wide for a Brazil — fill 0.55 guarantees the whole country is visible,
        maxZoom 7 keeps tiny islands from slamming into max magnification.
      */
      const box = target.isoCode ? countryBounds.get(target.isoCode) : undefined;
      const framing = box
        ? fitToPoints([box[0], box[1]], { maxZoom: 7, minZoom: 2, fill: 0.55 })
        : null;
      onFrame(framing?.center ?? target.center, framing?.zoom ?? target.zoom);
      // Landing on a country you have been to opens its card, which is the
      // question someone searching for it is usually asking.
      onOpenCountry(target.isoCode ?? null);
      /*
        Blink the found country three times. Panning there is not enough:
        nothing on a map of unlabeled shapes says which one is Japan. This is
        for the searcher who does not already know the answer.
      */
      if (target.isoCode) {
        setSearchBlinkIso(target.isoCode);
        if (blinkTimerRef.current) window.clearTimeout(blinkTimerRef.current);
        blinkTimerRef.current = window.setTimeout(
          () => setSearchBlinkIso(null),
          2000,
        );
      }
      // Airports get a ping at the exact coordinates: many searched airports
      // have no marker (markers exist only for airports actually flown).
      if (target.airportLabel) {
        setSearchPing({
          label: target.airportLabel,
          lon: target.center[0],
          lat: target.center[1],
          key: Date.now(),
        });
        if (pingTimerRef.current) window.clearTimeout(pingTimerRef.current);
        pingTimerRef.current = window.setTimeout(
          () => setSearchPing(null),
          2600,
        );
      }
    },
    [countryBounds, onFrame, onOpenCountry],
  );

  return { searchBlinkIso, searchPing, handleSearchGo };
}
