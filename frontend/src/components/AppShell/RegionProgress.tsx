import { useMemo } from 'react';
import type { Country, Visit } from '../../types';
import {
  ALL_CONTINENTS,
  getContinent,
  type Continent,
} from '../FlightMap/continentUtils';

interface RegionProgressProps {
  countries: Country[];
  visits: Visit[];
}

interface Row {
  continent: Continent;
  visited: number;
  total: number;
}

/**
 * How much of each continent you have seen.
 *
 * A single global percentage is a number you read once; per-region progress
 * is a list of unfinished things, which is what actually pulls people back.
 * "3 of 5 in Oceania" suggests a next trip in a way that "7% of the world"
 * never does.
 *
 * Transit does not count. Changing planes in a country is not visiting it,
 * and counting it would inflate the only number here that means anything.
 */
function RegionProgress({ countries, visits }: RegionProgressProps) {
  const rows = useMemo<Row[]>(() => {
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
      // Most-complete first: the regions you are closest to finishing are the
      // ones worth showing at the top.
      .sort((a, b) => b.visited / b.total - a.visited / a.total);
  }, [countries, visits]);

  if (rows.length === 0) return null;

  const anyVisited = rows.some((row) => row.visited > 0);

  return (
    <div className="bg-surface border border-line rounded-2xl p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-ink mb-3">By region</h3>
      {/*
        Six empty bars look like a loading state. Saying what fills them is
        both an explanation and the next action.
      */}
      {!anyVisited && (
        <p className="text-xs text-ink-muted mb-3 leading-relaxed">
          Mark a country on the map and these fill in — they track how much of
          each region you have seen.
        </p>
      )}
      <ul className="space-y-2.5">
        {rows.map((row) => {
          const percent = Math.round((row.visited / row.total) * 100);
          return (
            <li key={row.continent}>
              <div className="flex items-baseline justify-between gap-2 text-xs">
                <span className="text-ink font-medium truncate">
                  {row.continent}
                </span>
                <span className="text-ink-muted tabular-nums flex-shrink-0">
                  {row.visited} of {row.total}
                </span>
              </div>
              <div
                className="mt-1 h-2 rounded-full bg-surface-sunken overflow-hidden"
                role="progressbar"
                aria-valuenow={percent}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${row.continent}: ${row.visited} of ${row.total} countries`}
              >
                <div
                  className="h-full rounded-full bg-brand-500 transition-[width] duration-500"
                  /* A visited region should never read as empty, so anything
                     above zero keeps a sliver. */
                  style={{ width: `${row.visited === 0 ? 0 : Math.max(percent, 3)}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default RegionProgress;
