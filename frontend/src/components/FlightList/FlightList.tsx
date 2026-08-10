import { useMemo, useState } from 'react';
import {
  useGetFlightsQuery,
  useRemoveFlightMutation,
} from '../../features/flights/flightsApi';
import { useToast } from '../Toast/ToastProvider';
import FlightCard from './FlightCard';
import type { FlightJourney } from '../../types';

const UNDATED = 'Undated';

/** Group journeys by year, newest first, with undated ones last. */
function groupByYear(journeys: FlightJourney[]): [string, FlightJourney[]][] {
  const groups = new Map<string, FlightJourney[]>();

  journeys.forEach((journey) => {
    const key = journey.journeyDate
      ? String(new Date(journey.journeyDate).getFullYear())
      : UNDATED;
    const existing = groups.get(key);
    if (existing) existing.push(journey);
    else groups.set(key, [journey]);
  });

  return [...groups.entries()].sort(([a], [b]) => {
    if (a === UNDATED) return 1;
    if (b === UNDATED) return -1;
    return Number(b) - Number(a);
  });
}

/** Match against every IATA code, city and note on the journey. */
function matchesQuery(journey: FlightJourney, query: string): boolean {
  const haystack = [
    journey.notes ?? '',
    ...journey.legs.flatMap((leg) => [
      leg.departureAirport.iataCode,
      leg.arrivalAirport.iataCode,
      leg.departureAirport.city ?? '',
      leg.arrivalAirport.city ?? '',
    ]),
  ]
    .join(' ')
    .toLowerCase();
  return haystack.includes(query);
}

function FlightList() {
  const { data: journeys = [], isLoading, error } = useGetFlightsQuery();
  const [removeFlight] = useRemoveFlightMutation();
  const { showToast } = useToast();

  const [query, setQuery] = useState('');
  // Year sections start collapsed apart from the newest: 41 journeys rendered
  // flat produced a 7,700px page.
  const [collapsedYears, setCollapsedYears] = useState<Set<string>>(new Set());
  const [hasTouchedCollapse, setHasTouchedCollapse] = useState(false);

  const filtered = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return journeys;
    return journeys.filter((journey) => matchesQuery(journey, trimmed));
  }, [journeys, query]);

  const grouped = useMemo(() => groupByYear(filtered), [filtered]);

  const isCollapsed = (year: string, index: number) => {
    // While searching, show everything — hidden matches are useless.
    if (query.trim()) return false;
    if (hasTouchedCollapse) return collapsedYears.has(year);
    return index > 0;
  };

  const toggleYear = (year: string) => {
    setHasTouchedCollapse(true);
    setCollapsedYears((current) => {
      const next = new Set(current);
      // First interaction inherits the default: only the newest was open.
      if (!hasTouchedCollapse) {
        grouped.forEach(([y], i) => {
          if (i > 0) next.add(y);
        });
      }
      if (next.has(year)) next.delete(year);
      else next.add(year);
      return next;
    });
  };

  const handleDelete = async (id: number) => {
    const journey = journeys.find((j) => j.id === id);
    const label = journey
      ? journey.legs.map((leg) => leg.departureAirport.iataCode).join(' → ')
      : 'Flight';

    if (!window.confirm(`Delete ${label}? This cannot be undone.`)) return;

    try {
      await removeFlight(id).unwrap();
      showToast(`Deleted ${label}`, { tone: 'success' });
    } catch {
      showToast('Could not delete that flight', { tone: 'error' });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-white border border-gray-200 rounded-lg p-4 animate-pulse"
          >
            <div className="h-6 bg-gray-200 rounded w-2/3 mb-2" />
            <div className="h-4 bg-gray-200 rounded w-1/3" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-red-600">
        Failed to load flights. Please try again.
      </div>
    );
  }

  if (journeys.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-300">
        <svg
          className="w-12 h-12 mx-auto text-gray-400 mb-3"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
          />
        </svg>
        <h3 className="text-gray-900 font-medium mb-1">No flights yet</h3>
        <p className="text-gray-500 text-sm">
          Add your first flight to start tracking your journey!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="text-lg font-semibold text-gray-900">
          Your Flights
          <span className="ml-2 text-sm font-normal text-gray-500">
            ({journeys.length} {journeys.length === 1 ? 'journey' : 'journeys'})
          </span>
        </h2>
        <label className="relative sm:w-56">
          <span className="sr-only">Search flights</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search route, city, note…"
            className="w-full min-h-11 pl-9 pr-3 border border-gray-300 rounded-lg text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </label>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-gray-500 py-6 text-center">
          No flights match “{query}”.
        </p>
      ) : (
        grouped.map(([year, yearJourneys], index) => {
          const collapsed = isCollapsed(year, index);
          const distance = yearJourneys.reduce(
            (sum, journey) =>
              sum +
              journey.legs.reduce(
                (legSum, leg) => legSum + (Number(leg.distanceKm) || 0),
                0
              ),
            0
          );

          return (
            <section key={year}>
              <button
                type="button"
                onClick={() => toggleYear(year)}
                aria-expanded={!collapsed}
                className="w-full flex items-center gap-2 min-h-11 px-1 text-left border-b border-gray-200 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand-500 rounded"
              >
                <svg
                  className={`w-4 h-4 text-gray-400 transition-transform ${
                    collapsed ? '-rotate-90' : ''
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
                <span className="font-semibold text-gray-900">{year}</span>
                <span className="text-sm text-gray-500">
                  {yearJourneys.length}{' '}
                  {yearJourneys.length === 1 ? 'journey' : 'journeys'}
                </span>
                <span className="ml-auto text-sm text-gray-400 tabular-nums">
                  {Math.round(distance).toLocaleString()} km
                </span>
              </button>

              {!collapsed && (
                <div className="space-y-3 pt-3">
                  {yearJourneys.map((journey) => (
                    <FlightCard
                      key={journey.id}
                      journey={journey}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              )}
            </section>
          );
        })
      )}
    </div>
  );
}

export default FlightList;
