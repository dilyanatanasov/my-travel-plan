import { useMemo } from 'react';
import type { DiscoveryRow } from '../types';
import { freshnessLabel } from '../discovery';
import { buildDeepLink, trackOutboundClick } from '../affiliate';
import { HOME_ORIGIN } from '../fixtures/priceMatrix';

interface DestinationCardProps {
  row: DiscoveryRow;
  /** Provided only when a map is present to fly (docked mode, later). */
  onShowOnMap?: (row: DiscoveryRow) => void;
}

const euro = new Intl.NumberFormat(undefined, {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

/**
 * The month at a glance: one bar per day the cache knows, gaps where it
 * does not. The gaps are the point — hiding them would dress a patchy cache
 * up as a complete calendar, which is the dishonesty D1 rules out.
 */
function DayStrip({ row }: { row: DiscoveryRow }) {
  const bars = useMemo(() => {
    const byDay = new Map(row.days.map((d) => [Number(d.departDate.slice(-2)), d]));
    const values = row.days.map((d) => d.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = Math.max(max - min, 1);

    return Array.from({ length: row.daysInMonth }, (_, i) => {
      const day = byDay.get(i + 1);
      if (!day) return null;
      return {
        day: i + 1,
        // 25%..100%: even the cheapest day stays a visible bar.
        height: 25 + ((day.value - min) / span) * 75,
        isCheapest: day.value === row.cheapest.value,
      };
    });
  }, [row]);

  return (
    <div aria-hidden="true" className="flex items-end gap-px h-7">
      {bars.map((bar, i) =>
        bar ? (
          <div
            key={i}
            className={`flex-1 rounded-t-sm ${
              /* 300, not 200: on the cream card the lighter step disappears
                 and the strip read as noise in the light theme. */
              bar.isCheapest ? 'bg-brand-600' : 'bg-brand-300 dark:bg-brand-800'
            }`}
            style={{ height: `${bar.height}%` }}
          />
        ) : (
          <div key={i} className="flex-1" />
        ),
      )}
    </div>
  );
}

/** One unvisited country, priced. The card's job is to make "go here" feel
 *  concrete: a real date, a real fare, one tap to the booking site. */
function DestinationCard({ row, onShowOnMap }: DestinationCardProps) {
  const href = buildDeepLink(HOME_ORIGIN.iata, row.iata, row.cheapest.departDate);

  return (
    <li className="bg-surface border border-line rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow flex flex-col gap-2.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-ink leading-tight truncate">
            {row.countryName}
          </h3>
          <p className="text-xs text-ink-muted truncate">
            {row.city} <span className="font-mono">{row.iata}</span>
          </p>
        </div>
        <p className="flex-shrink-0 text-right">
          <span className="block text-[11px] text-ink-subtle leading-none">from</span>
          <span className="text-xl font-semibold text-ink tabular-nums leading-tight">
            {euro.format(row.cheapest.value)}
          </span>
        </p>
      </div>

      <DayStrip row={row} />

      <p className="text-[11px] text-ink-subtle leading-snug">
        Cheapest {formatDay(row.cheapest.departDate)} · priced on {row.pricedDayCount} of{' '}
        {row.daysInMonth} days · {freshnessLabel(row.cheapest.foundAt)}
      </p>

      <div className="flex items-center gap-1.5 mt-auto pt-0.5">
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackOutboundClick(row.iata, row.cheapest.value)}
          className="inline-flex items-center min-h-9 px-3 rounded-lg text-sm font-medium text-brand-700 hover:bg-brand-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
        >
          See flights
          <svg
            className="w-3.5 h-3.5 ml-1"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
            />
          </svg>
          <span className="sr-only">to {row.countryName} on Aviasales, opens in a new tab</span>
        </a>
        {onShowOnMap && (
          <button
            type="button"
            onClick={() => onShowOnMap(row)}
            className="inline-flex items-center min-h-9 px-3 rounded-lg text-sm font-medium text-ink-muted hover:bg-surface-sunken focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
          >
            Show on map
          </button>
        )}
      </div>
    </li>
  );
}

export default DestinationCard;
