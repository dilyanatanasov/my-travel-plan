import type { Country, Visit } from '../../types';
import {
  ALL_CONTINENTS,
  getContinent,
  type Continent,
} from '../../components/FlightMap/continentUtils';

export interface ContinentRow {
  continent: Continent;
  visited: number;
  total: number;
}

/**
 * How much of each continent has been seen. Extracted from RegionProgress
 * (M4, 2026-08-16) so the milestone celebrations read the exact same rows
 * the Overview bars show — one home for the rule that transit does not
 * count: changing planes in a country is not visiting it.
 *
 * Rows with no countries are dropped; the rest sort most-complete first,
 * because the regions closest to done are the ones that pull people back.
 */
export function continentProgress(
  countries: Country[],
  visits: Visit[],
): ContinentRow[] {
  const visitedIso = new Set(
    visits
      .filter((visit) => (visit.visitType || 'trip') !== 'transit')
      .map((visit) => visit.country?.isoCode2)
      .filter(Boolean),
  );

  const totals = new Map<Continent, { visited: number; total: number }>();
  for (const continent of ALL_CONTINENTS) {
    totals.set(continent, { visited: 0, total: 0 });
  }

  for (const country of countries) {
    const continent = getContinent(country.isoCode2);
    // Unmapped territories would otherwise form a meaningless seventh row.
    const bucket = totals.get(continent);
    if (!bucket) continue;
    bucket.total += 1;
    if (visitedIso.has(country.isoCode2)) bucket.visited += 1;
  }

  return ALL_CONTINENTS.map((continent) => ({
    continent,
    ...totals.get(continent)!,
  }))
    .filter((row) => row.total > 0)
    .sort((a, b) => b.visited / b.total - a.visited / a.total);
}
