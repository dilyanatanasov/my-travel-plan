import type { FlightJourney } from '../../types';
import { getContinent } from '../../components/FlightMap/continentUtils';

export interface TravelRecords {
  /** Consecutive calendar years that each added at least one new country. */
  newCountryStreak: { years: number; start: number; end: number } | null;
  /** The single year that touched the most continents. */
  maxContinentsInYear: { year: number; continents: number } | null;
}

/**
 * Personal records (M4, 2026-08-16): comparisons against yourself only —
 * privacy-perfect, derivable entirely from the journeys already loaded.
 *
 * Countries come from arrival airports, because arriving somewhere is what
 * travelling is; year-precision dates still carry a trustworthy year, so
 * every dated journey counts. "Busiest year" deliberately does not appear
 * here — the stats panel's Strongest Year already is that record.
 */
export function computeTravelRecords(
  journeys: FlightJourney[],
  today = new Date().toISOString().slice(0, 10),
): TravelRecords {
  const firstSeenYear = new Map<string, number>();
  const continentsByYear = new Map<number, Set<string>>();

  for (const journey of journeys) {
    if (!journey.journeyDate) continue;
    // A future-dated journey is a plan; records describe what happened.
    if (journey.journeyDate.slice(0, 10) > today) continue;
    const year = Number(String(journey.journeyDate).slice(0, 4));
    if (!Number.isFinite(year)) continue;

    for (const leg of journey.legs ?? []) {
      // Arriving by train or car reaches a country just as surely; only
      // the arrival matters here, so a leg with a torn departure still
      // counts its destination.
      const iso =
        leg.arrivalAirport?.countryIso ?? leg.arrivalCity?.countryIso;
      if (!iso) continue;

      const seen = firstSeenYear.get(iso);
      if (seen === undefined || year < seen) firstSeenYear.set(iso, year);

      const continent = getContinent(iso);
      if (continent !== 'Unknown') {
        const set = continentsByYear.get(year) ?? new Set<string>();
        set.add(continent);
        continentsByYear.set(year, set);
      }
    }
  }

  // Longest run of consecutive years, each with a first-ever country.
  const newCountryYears = [...new Set(firstSeenYear.values())].sort(
    (a, b) => a - b,
  );
  let best: { years: number; start: number; end: number } | null = null;
  let runStart: number | null = null;
  let previous: number | null = null;
  for (const year of newCountryYears) {
    if (previous === null || year !== previous + 1) runStart = year;
    previous = year;
    const length = year - (runStart as number) + 1;
    if (!best || length > best.years) {
      best = { years: length, start: runStart as number, end: year };
    }
  }

  let maxContinents: { year: number; continents: number } | null = null;
  for (const [year, set] of continentsByYear) {
    if (
      !maxContinents ||
      set.size > maxContinents.continents ||
      (set.size === maxContinents.continents && year > maxContinents.year)
    ) {
      maxContinents = { year, continents: set.size };
    }
  }

  return { newCountryStreak: best, maxContinentsInYear: maxContinents };
}
