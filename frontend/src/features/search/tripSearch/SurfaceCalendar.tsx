import { useMemo } from 'react';
import type { Candidate, SurfacePoint } from './useSmartSearch';

interface SurfaceCalendarProps {
  month: string; // YYYY-MM
  surface: SurfacePoint[];
  candidates: Candidate[];
}

/**
 * The month as a price heat-map: one cell per departure day, tinted by
 * where its cheapest observed price sits in the month's terciles. Ringed
 * days are the candidates the funnel chose to price precisely. Estimates
 * only — the cards below carry the bookable numbers.
 */
function SurfaceCalendar({ month, surface, candidates }: SurfaceCalendarProps) {
  const { cells, low, high } = useMemo(() => {
    const cheapestByDay = new Map<string, number>();
    for (const point of surface) {
      const existing = cheapestByDay.get(point.departureDate);
      if (existing === undefined || point.price < existing) {
        cheapestByDay.set(point.departureDate, point.price);
      }
    }
    const prices = [...cheapestByDay.values()].sort((a, b) => a - b);
    const tercile = (fraction: number) =>
      prices.length
        ? prices[Math.min(prices.length - 1, Math.floor(prices.length * fraction))]
        : 0;
    const lowCut = tercile(1 / 3);
    const midCut = tercile(2 / 3);

    const [year, monthNumber] = month.split('-').map(Number);
    const daysInMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
    // Monday-first column for the 1st.
    const firstWeekday =
      (new Date(Date.UTC(year, monthNumber - 1, 1)).getUTCDay() + 6) % 7;
    const candidateDays = new Set(candidates.map((c) => c.departureDate));

    const dayCells = Array.from({ length: daysInMonth }, (_, index) => {
      const date = `${month}-${String(index + 1).padStart(2, '0')}`;
      const price = cheapestByDay.get(date);
      const bucket =
        price === undefined
          ? null
          : price <= lowCut
            ? 'low'
            : price <= midCut
              ? 'mid'
              : 'high';
      return {
        date,
        day: index + 1,
        price,
        bucket,
        isCandidate: candidateDays.has(date),
      };
    });
    return {
      cells: { firstWeekday, dayCells },
      low: prices[0],
      high: prices[prices.length - 1],
    };
  }, [month, surface, candidates]);

  if (surface.length === 0) return null;

  const bucketClass = (bucket: string | null) =>
    bucket === 'low'
      ? 'bg-brand-200 text-brand-900'
      : bucket === 'mid'
        ? 'bg-brand-400 text-white'
        : bucket === 'high'
          ? 'bg-brand-600 text-white'
          : 'bg-surface-sunken text-ink-subtle';

  return (
    <div className="bg-surface border border-line rounded-2xl p-4">
      <div className="flex items-baseline justify-between gap-2 mb-3">
        <h3 className="text-sm font-semibold text-ink">Departure days</h3>
        <span className="text-[11px] text-ink-subtle">
          indicative prices · ${Math.round(low)}–${Math.round(high)}
        </span>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((label, index) => (
          <div
            key={index}
            className="text-center text-[10px] text-ink-subtle font-medium"
          >
            {label}
          </div>
        ))}
        {Array.from({ length: cells.firstWeekday }).map((_, index) => (
          <div key={`pad-${index}`} />
        ))}
        {cells.dayCells.map((cell) => (
          <div
            key={cell.date}
            title={
              cell.price !== undefined
                ? `${cell.date}: ~$${Math.round(cell.price)}`
                : `${cell.date}: no recent price`
            }
            className={`rounded-md min-h-10 flex flex-col items-center justify-center text-[11px] leading-tight ${bucketClass(
              cell.bucket,
            )} ${cell.isCandidate ? 'ring-2 ring-ink/60' : ''}`}
          >
            <span className="font-medium">{cell.day}</span>
            {cell.price !== undefined && (
              <span className="tabular-nums">${Math.round(cell.price)}</span>
            )}
          </div>
        ))}
      </div>
      <p className="text-[11px] text-ink-subtle mt-2">
        Ringed days are being priced precisely below.
      </p>
    </div>
  );
}

export default SurfaceCalendar;
