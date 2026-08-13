import { useMemo, useState } from 'react';
import type { DiscoveryRow, DiscoverySort } from '../types';
import { sortRows } from '../discovery';
import { useDiscovery } from '../useDiscovery';
import { defaultMonth, nextTwelveMonths } from '../months';
import MonthPills from './MonthPills';
import DestinationCard from './DestinationCard';

interface DiscoveryPanelProps {
  /** Provided only when a map is present to fly (docked mode, later). */
  onShowOnMap?: (row: DiscoveryRow) => void;
}

const SORTS: { value: DiscoverySort; label: string }[] = [
  { value: 'price', label: 'Cheapest' },
  { value: 'region', label: 'By region' },
  { value: 'name', label: 'A–Z' },
];

function SkeletonCard() {
  return (
    <li className="bg-surface border border-line rounded-2xl p-4 shadow-sm animate-pulse">
      <div className="h-4 w-2/3 rounded bg-surface-sunken" />
      <div className="h-3 w-1/2 rounded bg-surface-sunken mt-2" />
      <div className="h-7 rounded bg-surface-sunken mt-3" />
      <div className="h-3 w-3/4 rounded bg-surface-sunken mt-3" />
    </li>
  );
}

/**
 * The whole discovery experience: pick a month, see where you have not been,
 * priced from your airport, cheapest first.
 *
 * Self-contained on purpose — the same component is the standalone /search
 * page today and the panel A docks beside the map later; only the
 * `onShowOnMap` seam changes between the two.
 */
function DiscoveryPanel({ onShowOnMap }: DiscoveryPanelProps) {
  const [month, setMonth] = useState(defaultMonth);
  const [sort, setSort] = useState<DiscoverySort>('price');
  const { status, origin, rows, noData } = useDiscovery(month);

  const sorted = useMemo(() => sortRows(rows, sort), [rows, sort]);
  const monthLabel =
    nextTwelveMonths().find((option) => option.value === month)?.label ?? month;

  // Region sort earns actual region headings; the other sorts are one list.
  const regionGroups = useMemo(() => {
    if (sort !== 'region') return null;
    const groups = new Map<string, DiscoveryRow[]>();
    for (const row of sorted) {
      const group = groups.get(row.continent) ?? [];
      group.push(row);
      groups.set(row.continent, group);
    }
    return [...groups.entries()];
  }, [sort, sorted]);

  const gridClass =
    'grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-3 list-none';

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-ink-muted">
          Countries you haven&apos;t been to, priced from{' '}
          <span className="font-medium text-ink">
            {origin.city} <span className="font-mono">{origin.iata}</span>
          </span>
          {' '}— your home airport.
        </p>
        {/*
          The honesty line D1 requires. These are cached observations of other
          people's searches, up to a week old; presenting them as bookable
          fares would be lying with numbers.
        */}
        <p className="text-xs text-ink-subtle mt-1">
          This feature is in beta: prices are the cheapest fares other
          travellers found recently — indicative, not live quotes.
        </p>
      </div>

      <MonthPills selected={month} onSelect={setMonth} />

      <div
        role="radiogroup"
        aria-label="Sort destinations"
        className="inline-flex gap-1 p-1 rounded-xl bg-surface-sunken"
      >
        {SORTS.map((option) => {
          const isActive = sort === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={isActive}
              onClick={() => setSort(option.value)}
              className={`min-h-8 px-3 rounded-lg text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 ${
                isActive
                  ? 'bg-surface text-ink shadow-sm'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      {status === 'loading' ? (
        <ul className={gridClass} aria-hidden="true">
          {Array.from({ length: 6 }, (_, i) => (
            <SkeletonCard key={i} />
          ))}
        </ul>
      ) : sorted.length === 0 ? (
        /*
          Everything unvisited came back empty, or everything priced is
          somewhere you have already been. Either way this is a real state,
          not an error — say what happened and offer the obvious move.
        */
        <div className="bg-surface border border-line rounded-2xl p-6 text-center">
          <h3 className="font-display font-normal text-xl text-ink">
            No prices for {monthLabel} yet
          </h3>
          <p className="text-sm text-ink-muted mt-1.5 max-w-sm mx-auto">
            Fares here come from what other travellers searched recently, and
            nobody has priced these routes for {monthLabel} so far. Months
            closer to today usually have more.
          </p>
        </div>
      ) : regionGroups ? (
        <div className="space-y-5">
          {regionGroups.map(([continent, group]) => (
            <section key={continent} aria-label={continent}>
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-ink-subtle mb-2">
                {continent}
              </h3>
              <ul className={gridClass}>
                {group.map((row) => (
                  <DestinationCard key={row.iata} row={row} onShowOnMap={onShowOnMap} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <ul className={gridClass}>
          {sorted.map((row) => (
            <DestinationCard key={row.iata} row={row} onShowOnMap={onShowOnMap} />
          ))}
        </ul>
      )}

      {status === 'ready' && noData.length > 0 && (
        /*
          Thin routes with an empty cache. A designed strip instead of fake
          cards or silence: the honest "no data" state D1 makes a requirement.
        */
        <div className="border border-dashed border-line rounded-2xl p-4">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">
            No recent prices
          </h3>
          <p className="text-xs text-ink-muted mt-1">
            Nobody has searched these lately, so there is nothing honest to
            show for {monthLabel}:
          </p>
          <ul className="flex flex-wrap gap-1.5 mt-2 list-none">
            {noData.map((dest) => (
              <li
                key={dest.iata}
                className="px-2 py-1 rounded-lg bg-surface-sunken text-xs text-ink-muted"
              >
                {dest.countryName}
              </li>
            ))}
          </ul>
        </div>
      )}

      {status === 'ready' && sorted.length > 0 && (
        <p className="text-[11px] text-ink-subtle">
          Booking opens Aviasales in a new tab. myContrail may earn a commission
          on bookings once the affiliate programme is live.
        </p>
      )}
    </div>
  );
}

export default DiscoveryPanel;
