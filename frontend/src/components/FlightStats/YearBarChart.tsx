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
  // Only emphasise a genuine winner. With ties, find() would bold whichever
  // year happens to sort first, which is arbitrary and reads as wrong.
  const leaders = years.filter((y) => y.flights === maxFlights);
  const busiestYear = leaders.length === 1 ? leaders[0].year : null;

  /*
    Labels are thinned rather than shrunk. Thirteen four-digit years in a side
    panel leaves about 14px a column, so every label truncated to "20…" — an
    axis of ellipses says less than no axis at all. Two-digit years buy back
    half the width, and past that we show every Nth, always keeping the first
    and last so the range stays readable.
  */
  const useShortYears = years.length > 8;
  const labelStep = years.length > 16 ? 3 : years.length > 10 ? 2 : 1;
  const showLabel = (index: number) =>
    index === 0 || index === years.length - 1 || index % labelStep === 0;

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
        // No role="img": that would make the bars presentational and hide the
        // per-year buttons that carry the actual values.
        className="flex items-end gap-2.5 h-28"
      >
        {years.map((year) => {
          const isBusiest = year.year === busiestYear;
          // Floor the height so a single-flight year is still a visible bar
          // rather than a sliver that looks like a rendering artefact.
          const heightPct = Math.max(12, (year.flights / maxFlights) * 100);
          const readout = `${year.year}: ${year.flights} ${
            year.flights === 1 ? 'flight' : 'flights'
          }, ${Math.round(year.distanceKm).toLocaleString()} km`;
          return (
            /*
              A button, not a div: the value has to be reachable by tap and by
              keyboard, not only by hovering a mouse. Without this the chart
              shows a shape with no way to read a number off it.
            */
            <button
              key={year.year}
              type="button"
              aria-label={readout}
              className="group relative flex-1 h-full min-w-0 flex items-end rounded-md
                focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
            >
              <span
                className="w-full bg-brand-500 rounded-t-xl rounded-b-md transition-opacity
                  group-hover:!opacity-100 group-focus-visible:!opacity-100"
                style={{
                  height: `${heightPct}%`,
                  opacity: isBusiest ? 1 : 0.45 + (year.flights / maxFlights) * 0.35,
                }}
              />
              {/*
                Sits above the bar and is allowed to escape the chart box.
                pointer-events-none so it can never sit between the cursor and
                the bar that summoned it.
              */}
              <span
                role="tooltip"
                className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-10
                  whitespace-nowrap rounded-lg bg-panel-accent px-2 py-1 text-[11px] font-medium text-white
                  opacity-0 shadow-md transition-opacity
                  group-hover:opacity-100 group-focus-visible:opacity-100"
              >
                {year.flights} {year.flights === 1 ? 'flight' : 'flights'}
                <span className="text-white/70">
                  {' · '}
                  {Math.round(year.distanceKm).toLocaleString()} km
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex gap-2.5 mt-2">
        {years.map((year, index) => (
          <span
            key={year.year}
            className={`flex-1 min-w-0 text-center text-[11px] tabular-nums overflow-visible ${
              year.year === busiestYear ? 'font-bold text-ink' : 'text-ink-muted'
            }`}
          >
            {showLabel(index)
              ? useShortYears
                ? `'${String(year.year).slice(2)}`
                : year.year
              : ''}
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
