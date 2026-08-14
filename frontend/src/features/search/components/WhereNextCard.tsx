import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useGetVisitsQuery } from '../../visits/visitsApi';
import { HOME_ORIGIN, getMonthMatrix } from '../fixtures/priceMatrix';
import { deriveRows, visitedIsoSet } from '../discovery';
import { defaultMonth, nextTwelveMonths } from '../months';
import CountryFlag from '../../../components/ui/CountryFlag';

const euro = new Intl.NumberFormat(undefined, {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

/**
 * The Overview teaser and universal entry point for discovery, per Q1: the
 * three cheapest countries you have not been to, and the way into the rest.
 *
 * Built to sit directly under RegionProgress and extend its psychology —
 * that card says "3 of 5 in Oceania", this one says what going costs.
 *
 * C builds it, A places it in OverviewPanel (agreed in COORDINATION.md Q1).
 */
function WhereNextCard() {
  const { data: visits = [], isLoading } = useGetVisitsQuery();
  const month = defaultMonth();

  const top = useMemo(() => {
    if (isLoading) return [];
    const { rows } = deriveRows(getMonthMatrix(HOME_ORIGIN.iata, month), visitedIsoSet(visits));
    return rows.sort((a, b) => a.cheapest.value - b.cheapest.value).slice(0, 3);
  }, [isLoading, month, visits]);

  // No fares, nothing to tease — the full page explains the why; a stub
  // card here would just be furniture.
  if (top.length === 0) return null;

  const monthLabel =
    nextTwelveMonths().find((option) => option.value === month)?.label ?? month;

  return (
    <div className="bg-surface border border-line rounded-2xl p-4 shadow-sm">
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <h3 className="text-sm font-semibold text-ink flex items-center gap-1.5">
          Where to next?
          <span className="px-1.5 py-0.5 rounded-full bg-brand-50 text-brand-700 text-[10px] font-semibold uppercase tracking-wide">
            Beta
          </span>
        </h3>
        <span className="text-[11px] text-ink-subtle">
          {monthLabel}, from {HOME_ORIGIN.iata}
        </span>
      </div>
      <p className="text-xs text-ink-muted mb-3">
        Cheapest countries you haven&apos;t been to. Indicative prices.
      </p>
      <ul className="space-y-1.5">
        {top.map((row) => (
          <li key={row.iata} className="flex items-baseline justify-between gap-2 text-sm">
            <span className="text-ink font-medium truncate">
              <CountryFlag iso2={row.countryIso2} className="mr-1.5 align-baseline" />
              {row.countryName}
            </span>
            <span className="text-ink-muted tabular-nums flex-shrink-0">
              from {euro.format(row.cheapest.value)}
            </span>
          </li>
        ))}
      </ul>
      <Link
        to="/search"
        className="inline-flex items-center min-h-9 mt-2 -ml-1 px-1 rounded-lg text-sm font-medium text-brand-700 hover:bg-brand-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
      >
        Explore all →
      </Link>
    </div>
  );
}

export default WhereNextCard;
