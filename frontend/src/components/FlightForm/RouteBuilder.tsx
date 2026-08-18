import { Fragment, useState } from 'react';
import AirportSearch from '../AirportSearch';
import CitySearch from '../CitySearch/CitySearch';
import type { CreateFlightDto, TravelMode } from '../../types';
import ModeIcon, { CityIcon } from '../ui/ModeIcon';
import {
  type EditableStop,
  emptyStop,
  stopFilled,
  stopLabel,
  syncStopsWithMode,
  resolveFlightEndpoints,
  HOP_MODES,
  MODE_LABEL,
} from '../FlightList/stopChain';
import { useAirportForCity } from './useAirportForCity';
import { useToast } from '../Toast/ToastProvider';
import { MONTH_NAMES } from '../../utils/journeyDate';

interface RouteBuilderProps {
  onSubmit: (data: CreateFlightDto) => void;
  isLoading?: boolean;
}

/*
  Land travel (2026-08-17): a journey is a chain of stops - airports or
  cities - with a travel mode per hop. The default walk-through is
  identical to the old flight-only form (airport stops, plane hops); the
  mode chips between stops unlock "Varna ✈ Geneva 🚆 Basel 🚗 Colmar" as
  one journey. The stop model is shared with FlightCard's edit form
  (stopChain.ts) so add and edit cannot drift apart.
*/
function RouteBuilder({ onSubmit, isLoading }: RouteBuilderProps) {
  const [stops, setStops] = useState<EditableStop[]>([emptyStop(), emptyStop()]);
  const [modes, setModes] = useState<TravelMode[]>(['flight']);
  const [dateYear, setDateYear] = useState('');
  const [dateMonth, setDateMonth] = useState('');
  const [dateDay, setDateDay] = useState('');
  const [isRoundTrip, setIsRoundTrip] = useState(false);
  const [notes, setNotes] = useState('');

  const setStop = (index: number, patch: Partial<EditableStop>) => {
    setStops((current) =>
      current.map((stop, i) => (i === index ? { ...stop, ...patch } : stop)),
    );
  };

  const resolveAirport = useAirportForCity();
  const { showToast } = useToast();

  /*
    Picking a mode teaches the stops (owner ask, 2026-08-18): a land hop
    flips its empty endpoints to city search, a flight hop flips them to
    airport search - and a city already chosen resolves to its own
    airport when it has one, announced rather than silent.
  */
  const setMode = async (index: number, mode: TravelMode) => {
    setModes((current) => current.map((m, i) => (i === index ? mode : m)));
    const { stops: synced, conversions } = await syncStopsWithMode(
      stops,
      index,
      mode,
      resolveAirport,
    );
    setStops(synced);
    if (conversions.length > 0) {
      showToast(`Picked the airport for the flight: ${conversions.join(', ')}`, {
        key: 'stop-kind-sync',
      });
    }
  };

  const addLeg = () => {
    setStops((current) => [...current, emptyStop()]);
    setModes((current) => [...current, 'flight']);
  };

  const removeLeg = (index: number) => {
    if (stops.length <= 2) return;
    setStops((current) => current.filter((_, i) => i !== index));
    // Removing stop i removes the hop before it (or the first hop for i=0),
    // keeping modes exactly one shorter than stops.
    const modeIndex = Math.max(index - 1, 0);
    setModes((current) => current.filter((_, i) => i !== modeIndex));
  };

  const allFilled = stops.every(stopFilled);
  // A plane cannot land in a city centre - but submit tries to fix this
  // itself (resolveFlightEndpoints), so it only warns, never disables.
  const flightHopViolation = modes.some(
    (mode, i) =>
      mode === 'flight' &&
      (stops[i]?.kind !== 'airport' || stops[i + 1]?.kind !== 'airport'),
  );
  const isValid = allFilled && stops.length >= 2;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;

    // Flight hops ending in a chosen city resolve to that city's airport
    // right here - modes default to flight, so no chip click ever fires
    // the sync on the common "drove there, flew home" chain.
    let chainStops = stops;
    if (flightHopViolation) {
      const resolved = await resolveFlightEndpoints(
        stops,
        modes,
        resolveAirport,
      );
      if (!resolved.ok) {
        showToast(
          'A flight needs airports at both ends - pick the nearest airport or change that hop to train, car or bus',
          { tone: 'error' },
        );
        return;
      }
      chainStops = resolved.stops;
      setStops(chainStops);
      if (resolved.conversions.length > 0) {
        showToast(
          `Picked the airport for the flight: ${resolved.conversions.join(', ')}`,
          { key: 'stop-kind-sync' },
        );
      }
    }

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

    const base = { journeyDate, datePrecision, isRoundTrip, notes: notes || undefined };
    const allFlight = modes.every((mode) => mode === 'flight');
    const allAirports = chainStops.every((stop) => stop.kind === 'airport');
    if (allFlight && allAirports) {
      // The legacy shape keeps the server's ground-transfer typo guard.
      onSubmit({ ...base, airportIds: chainStops.map((s) => s.airport!.id) });
    } else {
      onSubmit({
        ...base,
        stops: chainStops.map((stop) =>
          stop.kind === 'airport'
            ? { airportId: stop.airport!.id }
            : { cityId: stop.city!.id },
        ),
        modes,
      });
    }

    setStops([emptyStop(), emptyStop()]);
    setModes(['flight']);
    setDateYear('');
    setDateMonth('');
    setDateDay('');
    setIsRoundTrip(false);
    setNotes('');
  };

  // Only exclude the previous stop's id to prevent consecutive duplicates
  // (VAR → VAR) while allowing a return later (VAR → SOF → VAR).
  const excludeIdsFor = (index: number, kind: 'airport' | 'city'): number[] => {
    const prev = index > 0 ? stops[index - 1] : null;
    if (!prev || prev.kind !== kind) return [];
    const id = kind === 'airport' ? prev.airport?.id : prev.city?.id;
    return id != null ? [id] : [];
  };

  const labels = stops.map(stopLabel);
  const previewReady = labels.every(Boolean) && labels.length >= 2;

  /** Labels interleaved with each hop's mode icon. */
  const previewRow = (rowLabels: (string | null)[], rowModes: TravelMode[]) => (
    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 font-mono text-lg">
      {rowLabels.map((label, i) => (
        <Fragment key={i}>
          {i > 0 && (
            <ModeIcon mode={rowModes[i - 1]} className="w-4 h-4 opacity-60" />
          )}
          <span>{label}</span>
        </Fragment>
      ))}
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        {stops.map((stop, index) => (
          <div key={index}>
            {/* The hop's mode, between its two stops. */}
            {index > 0 && (
              <div className="flex items-center gap-1 ml-10 mb-2">
                {HOP_MODES.map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    aria-pressed={modes[index - 1] === mode}
                    onClick={() => setMode(index - 1, mode)}
                    className={`min-h-8 px-2.5 rounded-full text-xs font-medium transition-colors inline-flex items-center gap-1.5 ${
                      modes[index - 1] === mode
                        ? 'bg-brand-600 text-white'
                        : 'bg-surface-sunken text-ink-muted hover:text-ink'
                    }`}
                  >
                    <ModeIcon mode={mode} className="w-4 h-4" />
                    {MODE_LABEL[mode]}
                  </button>
                ))}
              </div>
            )}
            <div className="flex items-center gap-2">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-brand-100 text-brand-text flex items-center justify-center text-sm font-medium">
                {index + 1}
              </div>
              <div className="flex-1">
                {stop.kind === 'airport' ? (
                  <AirportSearch
                    value={stop.airport}
                    onChange={(airport) => setStop(index, { airport })}
                    placeholder={index === 0 ? 'Start from...' : 'Then to...'}
                    excludeIds={excludeIdsFor(index, 'airport')}
                  />
                ) : (
                  <CitySearch
                    value={stop.city}
                    onChange={(city) => setStop(index, { city })}
                    placeholder={index === 0 ? 'Start from...' : 'Then to...'}
                    excludeIds={excludeIdsFor(index, 'city')}
                  />
                )}
              </div>
              {/* Airport or city, per stop: a train can leave from either. */}
              <button
                type="button"
                onClick={() =>
                  setStop(index, {
                    kind: stop.kind === 'airport' ? 'city' : 'airport',
                    airport: null,
                    city: null,
                  })
                }
                title={
                  stop.kind === 'airport'
                    ? 'This stop is an airport - switch to a city'
                    : 'This stop is a city - switch to an airport'
                }
                className="flex-shrink-0 min-h-8 px-2 rounded-lg bg-surface-sunken text-ink-muted hover:text-ink"
              >
                {stop.kind === 'airport' ? (
                  <ModeIcon mode="flight" className="w-4 h-4" />
                ) : (
                  <CityIcon className="w-4 h-4" />
                )}
              </button>
              {stops.length > 2 && (
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

      {flightHopViolation && (
        <p className="text-sm text-ink-muted">
          A flight hop ends in a city - saving will switch it to that
          city&rsquo;s airport automatically when it has one.
        </p>
      )}

      {labels.some(Boolean) && (
        <div className="p-3 bg-surface-sunken rounded-lg">
          <div className="text-sm text-ink-muted">Route preview:</div>
          {previewReady ? (
            <div className="text-ink">{previewRow(labels, modes)}</div>
          ) : (
            <div className="font-mono text-lg text-ink">
              {labels.filter(Boolean).join(' → ')}
            </div>
          )}
          {isRoundTrip && previewReady && (
            <div className="text-ink-muted mt-1">
              {previewRow([...labels].reverse(), [...modes].reverse())}
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
        {isLoading ? 'Adding...' : 'Add journey'}
      </button>
    </form>
  );
}

export default RouteBuilder;
