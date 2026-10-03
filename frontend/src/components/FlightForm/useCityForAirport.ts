import { useCallback } from 'react';
import { useLazySearchCitiesQuery } from '../../features/cities/citiesApi';
import type { Airport, CityRef } from '../../types';

const EARTH_RADIUS_KM = 6371;
/** Further than this and the name match is a different place entirely. */
const MAX_MATCH_KM = 150;

function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
}

/**
 * The city an airport serves - the mirror of useAirportForCity, for the
 * owner's rule (2026-10-03) that a train, car, bus or ferry hop runs
 * between cities: switching a hop off "flight" turns its airport ends
 * into their cities instead of leaving IATA codes under a car icon.
 *
 * The airport's municipality is the search term (its first part - the
 * dataset writes "Manchester, Greater Manchester"), and the candidate
 * is the nearest result in the same country, so "London" for LHR is the
 * London 20 km away and not London, Ontario. Null when nothing plausible
 * is within range; the form then asks for the city rather than guessing.
 */
export function useCityForAirport(): (
  airport: Airport,
) => Promise<CityRef | null> {
  const [trigger] = useLazySearchCitiesQuery();
  return useCallback(
    async (airport: Airport) => {
      const name = airport.city?.split(',')[0]?.trim();
      if (!name) return null;
      try {
        const results = await trigger(name).unwrap();
        const ranked = results
          .map((city) => ({
            city,
            km: haversineKm(
              Number(airport.latitude),
              Number(airport.longitude),
              Number(city.latitude),
              Number(city.longitude),
            ),
          }))
          .sort((a, b) => a.km - b.km);
        const sameCountry = ranked.find(
          (entry) =>
            !airport.countryIso || entry.city.countryIso === airport.countryIso,
        );
        const pick = sameCountry ?? ranked[0];
        return pick && pick.km <= MAX_MATCH_KM ? pick.city : null;
      } catch {
        return null;
      }
    },
    [trigger],
  );
}
