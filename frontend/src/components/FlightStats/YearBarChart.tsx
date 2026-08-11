import type { YearStats } from '../../types';

interface YearBarChartProps {
  byYear: YearStats[];
  strongestYear: YearStats | null;
}

/**
 * Flights per year.
 *
 * The one thing the stats screen was missing: every other card states a
 * number, so there was nothing that showed a shape. `byYear` was already
 * being returned by the API and thrown away by the UI.
 *
 * Bars are a single brand colour at varying opacity rather than steps down a
 * colour ramp, because the ramp is inverted between light and dark in
 * tokens.css — picking brand-300..600 would read as a gradient in one theme
 * and a reversed one in the other. Opacity behaves the same in both.
 */
function YearBarChart({ byYear, strongestYear }: YearBarChartProps) {
  // One bar is not a chart, it is a rectangle.
  if (byYear.length < 2) return null;

  const years = [...byYear].sort((a, b) => a.year - b.year);
  const maxFlights = Math.max(...years.map((y) => y.flights));
  // Not strongestYear: that is picked by distance, and this chart plots
  // flights. Emphasising it would bold the label under a shorter bar.
  const busiestYear = years.find((y) => y.flights === maxFlights)?.year;

  return (
    <div className="bg-surface border border-line rounded-2xl p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-ink mb-4">Flights by year</h3>

      {/*
        Bars and labels are two rows sharing the same flex-1 columns, so they
        stay aligned. The bars must live in a container with a resolved
        height: a percentage height inside an auto-height flex child computes
        to zero, which renders an empty chart.
      */}
      <div
        className="flex items-end gap-2.5 h-28"
        role="img"
        aria-label={years
          .map((y) => `${y.year}: ${y.flights} flight${y.flights === 1 ? '' : 's'}`)
          .join(', ')}
      >
        {years.map((year) => {
          const isBusiest = year.year === busiestYear;
          // Floor the height so a single-flight year is still a visible bar
          // rather than a sliver that looks like a rendering artefact.
          const heightPct = Math.max(12, (year.flights / maxFlights) * 100);
          return (
            <div
              key={year.year}
              className="flex-1 bg-brand-500 rounded-t-xl rounded-b-md min-w-0"
              style={{
                height: `${heightPct}%`,
                opacity: isBusiest ? 1 : 0.45 + (year.flights / maxFlights) * 0.35,
              }}
            />
          );
        })}
      </div>

      <div className="flex gap-2.5 mt-2">
        {years.map((year) => (
          <span
            key={year.year}
            className={`flex-1 min-w-0 text-center text-[11px] tabular-nums truncate ${
              year.year === busiestYear ? 'font-bold text-ink' : 'text-ink-muted'
            }`}
          >
            {year.year}
          </span>
        ))}
      </div>

      {strongestYear && (
        <p className="text-xs text-ink-muted mt-3">
          <span className="font-semibold text-ink">{strongestYear.year}</span> is
          your strongest year: {strongestYear.flights}{' '}
          {strongestYear.flights === 1 ? 'flight' : 'flights'},{' '}
          {Math.round(strongestYear.distanceKm).toLocaleString()} km.
        </p>
      )}
    </div>
  );
}

export default YearBarChart;
