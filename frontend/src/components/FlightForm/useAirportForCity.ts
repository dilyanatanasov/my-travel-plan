import { useCallback } from 'react';
import { useLazySearchAirportsQuery } from '../../features/flights/flightsApi';
import type { Airport, CityRef } from '../../types';

/**
 * A city's own airport, if it has one - what lets "Mostar by car, then
 * fly home" resolve the flight's endpoint automatically instead of
 * making the user re-pick Mostar as an airport. Exact city-name match
 * first (the ranking already puts majors on top), prefix as fallback;
 * null means the city genuinely has no airport worth guessing.
 */
export function useAirportForCity(): (
  city: CityRef,
) => Promise<Airport | null> {
  const [trigger] = useLazySearchAirportsQuery();
  return useCallback(
    async (city: CityRef) => {
      try {
        const results = await trigger(city.name).unwrap();
        const name = city.name.toLowerCase();
        return (
          results.find(
            (airport) => airport.city?.toLowerCase() === name,
          ) ??
          results.find((airport) =>
            airport.city?.toLowerCase().startsWith(name),
          ) ??
          null
        );
      } catch {
        return null;
      }
    },
    [trigger],
  );
}
