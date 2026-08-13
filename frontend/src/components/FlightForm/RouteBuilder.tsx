import { useState } from 'react';
import AirportSearch from '../AirportSearch';
import type { Airport } from '../../types';
import { MONTH_NAMES } from '../../utils/journeyDate';

interface RouteBuilderProps {
  onSubmit: (data: {
    airportIds: number[];
    journeyDate?: string;
    datePrecision?: 'day' | 'month' | 'year';
    isRoundTrip: boolean;
    notes?: string;
  }) => void;
  isLoading?: boolean;
}

function RouteBuilder({ onSubmit, isLoading }: RouteBuilderProps) {
  const [airports, setAirports] = useState<(Airport | null)[]>([null, null]);
  const [dateYear, setDateYear] = useState('');
  const [dateMonth, setDateMonth] = useState('');
  const [dateDay, setDateDay] = useState('');
  const [isRoundTrip, setIsRoundTrip] = useState(false);
  const [notes, setNotes] = useState('');

  const handleAirportChange = (index: number, airport: Airport | null) => {
    const newAirports = [...airports];
    newAirports[index] = airport;
    setAirports(newAirports);
  };

  const addLeg = () => {
    setAirports([...airports, null]);
  };

  const removeLeg = (index: number) => {
    if (airports.length <= 2) return;
    const newAirports = airports.filter((_, i) => i !== index);
    setAirports(newAirports);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validAirports = airports.filter((a): a is Airport => a !== null);
    if (validAirports.length < 2) return;

    // The date is stored as the first day of the asserted period; precision
    // records how much of it the user actually claimed.
    const year = dateYear.trim();
    const journeyDate = year
      ? `${year.padStart(4, '0')}-${dateMonth || '01'}-${dateDay || '01'}`
      : undefined;
    const datePrecision = year
      ? dateDay
        ? ('day' as const)
        : dateMonth
          ? ('month' as const)
          : ('year' as const)
      : undefined;

    onSubmit({
      airportIds: validAirports.map((a) => a.id),
      journeyDate,
      datePrecision,
      isRoundTrip,
      notes: notes || undefined,
    });

    // Reset form
    setAirports([null, null]);
    setDateYear('');
    setDateMonth('');
    setDateDay('');
    setIsRoundTrip(false);
    setNotes('');
  };

  const validAirports = airports.filter((a): a is Airport => a !== null);
  const isValid = validAirports.length >= 2;

  // Only exclude the previous airport to prevent consecutive duplicates (VAR → VAR)
  // but allow returning to the same airport later (VAR → SOF → VAR)
  const getExcludeIds = (index: number): number[] => {
    const prevAirport = index > 0 ? airports[index - 1] : null;
    return prevAirport ? [prevAirport.id] : [];
  };

  // Build route preview
  const routePreview = validAirports.map((a) => a.iataCode).join(' → ');
  const returnPreview = isRoundTrip && validAirports.length >= 2
    ? [...validAirports].reverse().map((a) => a.iataCode).join(' → ')
    : null;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-3">
        {airports.map((airport, index) => (
          <div key={index} className="flex items-center gap-2">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-brand-100 text-brand-text flex items-center justify-center text-sm font-medium">
              {index + 1}
            </div>
            <div className="flex-1">
              <AirportSearch
                value={airport}
                onChange={(a) => handleAirportChange(index, a)}
                placeholder={index === 0 ? 'Start from...' : `Then to...`}
                excludeIds={getExcludeIds(index)}
              />
            </div>
            {airports.length > 2 && (
              <button
                type="button"
                onClick={() => removeLeg(index)}
                className="flex-shrink-0 p-2 text-red-500 hover:bg-danger-soft rounded-lg"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>
            )}
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addLeg}
        className="flex items-center gap-2 text-brand-text hover:text-brand-700 text-sm font-medium"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 4v16m8-8H4"
          />
        </svg>
        Add stop
      </button>

      {routePreview && (
        <div className="p-3 bg-surface-sunken rounded-lg">
          <div className="text-sm text-ink-muted">Route preview:</div>
          <div className="font-mono text-lg text-ink">{routePreview}</div>
          {returnPreview && (
            <div className="font-mono text-lg text-ink-muted mt-1">
              + {returnPreview}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Full row: three date fields never fit half a desktop grid cell —
            they either collapsed (min-w-0) or wrapped (min-widths). */}
        <div className="md:col-span-2">
          {/* htmlFor/id, not proximity: a label that only sits above an input
              is a visual convention, not an association, and this one left
              the date field with no accessible name at all. */}
          <label
            htmlFor="journey-year"
            className="block text-sm font-medium text-ink mb-1"
          >
            When (optional — year is enough)
          </label>
          {/*
            Progressive, not all-or-nothing: "May 2019" and "2016" are real
            memories, and the exact-date picker forced people to either
            invent a day or skip the date entirely (user request, 2026-08-13).
          */}
          {/* flex-wrap + real minimum widths: the previous min-w-0 let the
              month select shrink to a bare chevron inside this narrow grid
              cell. Short month names keep the closed select compact. */}
          <div className="flex flex-wrap gap-1.5">
            <input
              id="journey-year"
              type="number"
              inputMode="numeric"
              min={1930}
              max={2100}
              placeholder="Year"
              value={dateYear}
              onChange={(e) => setDateYear(e.target.value)}
              className="w-20 min-h-11 px-2 border border-line rounded-lg bg-surface text-ink placeholder:text-ink-subtle focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <select
              aria-label="Month (optional)"
              value={dateMonth}
              disabled={!dateYear}
              onChange={(e) => {
                setDateMonth(e.target.value);
                if (!e.target.value) setDateDay('');
              }}
              className="min-w-[5.5rem] flex-1 min-h-11 px-2 border border-line rounded-lg bg-surface text-ink disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">Month?</option>
              {MONTH_NAMES.map((name, i) => (
                <option key={name} value={String(i + 1).padStart(2, '0')}>
                  {name.slice(0, 3)}
                </option>
              ))}
            </select>
            <select
              aria-label="Day (optional)"
              value={dateDay}
              disabled={!dateMonth}
              onChange={(e) => setDateDay(e.target.value)}
              className="min-w-[4.5rem] min-h-11 px-2 border border-line rounded-lg bg-surface text-ink disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">Day?</option>
              {Array.from({ length: 31 }, (_, i) => (
                <option key={i + 1} value={String(i + 1).padStart(2, '0')}>
                  {i + 1}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex items-end">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isRoundTrip}
              onChange={(e) => setIsRoundTrip(e.target.checked)}
              className="w-4 h-4 text-brand-text rounded focus:ring-brand-500"
            />
            <span className="text-sm text-ink">Round trip</span>
          </label>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-ink mb-1">
          Notes (optional)
        </label>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g., Business trip, vacation..."
          className="w-full min-h-11 px-3 border border-line rounded-lg bg-surface text-ink placeholder:text-ink-subtle focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>

      <button
        type="submit"
        disabled={!isValid || isLoading}
        /*
          text-white belongs to the enabled branch, not the base. Left on the
          base it collided with the disabled colour — both are `color`
          utilities, so which one won depended on their order in the generated
          stylesheet rather than on the order written here, and white won:
          1.23:1 on the disabled surface.
        */
        className={`w-full py-2 px-4 rounded-lg font-medium transition-colors ${
          isValid && !isLoading
            ? 'bg-brand-600 text-white hover:bg-brand-700'
            : 'bg-surface-sunken text-ink-muted cursor-not-allowed'
        }`}
      >
        {isLoading ? 'Adding...' : 'Add Flight'}
      </button>
    </form>
  );
}

export default RouteBuilder;
