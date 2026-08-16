import { useMemo } from 'react';
import type { Country, Visit } from '../../types';
import { continentProgress } from '../../features/stats/continentProgress';

interface RegionProgressProps {
  countries: Country[];
  visits: Visit[];
}

/**
 * How much of each continent you have seen.
 *
 * A single global percentage is a number you read once; per-region progress
 * is a list of unfinished things, which is what actually pulls people back.
 * "3 of 5 in Oceania" suggests a next trip in a way that "7% of the world"
 * never does.
 *
 * The row computation (including the transit-doesn't-count rule) lives in
 * features/stats/continentProgress, shared with the milestone celebrations.
 */
function RegionProgress({ countries, visits }: RegionProgressProps) {
  const rows = useMemo(
    () => continentProgress(countries, visits),
    [countries, visits],
  );

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
          const remaining = row.total - row.visited;
          // "2 to go" only when the finish line is genuinely near: a short
          // count on a mostly-full bar is a plan, on an empty one it's noise.
          const nearlyDone =
            remaining > 0 && remaining <= 3 && row.visited / row.total >= 0.5;
          return (
            <li key={row.continent}>
              <div className="flex items-baseline justify-between gap-2 text-xs">
                <span className="text-ink font-medium truncate">
                  {row.continent}
                </span>
                <span className="text-ink-muted tabular-nums flex-shrink-0">
                  {row.visited} of {row.total}
                  {nearlyDone && (
                    <span className="text-brand-text font-medium">
                      {' '}
                      · {remaining} to go
                    </span>
                  )}
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
