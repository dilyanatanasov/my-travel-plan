import { useMemo, useState } from 'react';
import type { Candidate, SurfacePoint } from './useSmartSearch';

interface SurfaceCalendarProps {
  month: string; // YYYY-MM
  surface: SurfacePoint[];
  candidates: Candidate[];
}

function formatDay(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}

/**
 * The month as a price heat-map: one cell per departure day, tinted by
 * where its cheapest observed price sits in the month's terciles. Ringed
 * days are the candidates the funnel chose to price precisely.
 *
 * A cell's price quietly belongs to a date PAIR — tapping the day says the
 * whole sentence: "out Wed 7 Oct → back Wed 14 Oct · 7 nights · ~$489"
 * (the invisible-return-date finding from the design review).
 */
function SurfaceCalendar({ month, surface, candidates }: SurfaceCalendarProps) {
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const { cells, low, high, cheapestByDay } = useMemo(() => {
    const byDay = new Map<string, SurfacePoint>();
    for (const point of surface) {
      const existing = byDay.get(point.departureDate);
      if (!existing || point.price < existing.price) {
        byDay.set(point.departureDate, point);
      }
    }
    const prices = [...byDay.values()]
      .map((point) => point.price)
      .sort((a, b) => a - b);
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
      const point = byDay.get(date);
      const bucket =
        point === undefined
          ? null
          : point.price <= lowCut
            ? 'low'
            : point.price <= midCut
              ? 'mid'
              : 'high';
      return {
        date,
        day: index + 1,
        price: point?.price,
        bucket,
        isCandidate: candidateDays.has(date),
      };
    });
    return {
      cells: { firstWeekday, dayCells },
      low: prices[0],
      high: prices[prices.length - 1],
      cheapestByDay: byDay,
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

  const selected = selectedDay ? cheapestByDay.get(selectedDay) : undefined;
  const selectedNights =
    selected?.returnDate != null
      ? Math.round(
          (Date.parse(selected.returnDate) -
            Date.parse(selected.departureDate)) /
            86_400_000,
        )
      : null;

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
          <button
            key={cell.date}
            type="button"
            disabled={cell.price === undefined}
            onClick={() =>
              setSelectedDay((current) =>
                current === cell.date ? null : cell.date,
              )
            }
            aria-pressed={selectedDay === cell.date}
            aria-label={
              cell.price !== undefined
                ? `${formatDay(cell.date)}, about $${Math.round(cell.price)}`
                : `${formatDay(cell.date)}, no recent price`
            }
            className={`rounded-md min-h-10 flex flex-col items-center justify-center text-[11px] leading-tight transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${bucketClass(
              cell.bucket,
            )} ${cell.isCandidate ? 'ring-2 ring-ink/60' : ''} ${
              selectedDay === cell.date ? 'ring-2 ring-brand-700' : ''
            } ${cell.price === undefined ? 'cursor-default' : 'cursor-pointer'}`}
          >
            <span className="font-medium">{cell.day}</span>
            {cell.price !== undefined && (
              <span className="tabular-nums">${Math.round(cell.price)}</span>
            )}
          </button>
        ))}
      </div>
      {selected ? (
        <p className="text-xs text-ink mt-2">
          <span className="font-medium">
            out {formatDay(selected.departureDate)}
            {selected.returnDate && ` → back ${formatDay(selected.returnDate)}`}
          </span>
          {selectedNights !== null && (
            <span className="text-ink-muted"> · {selectedNights} nights</span>
          )}
          <span className="text-ink-muted">
            {' '}
            · ~${Math.round(selected.price)} estimated
          </span>
        </p>
      ) : (
        <p className="text-[11px] text-ink-subtle mt-2">
          Tap a day for its dates · ringed days are being priced precisely
          below.
        </p>
      )}
    </div>
  );
}

export default SurfaceCalendar;
