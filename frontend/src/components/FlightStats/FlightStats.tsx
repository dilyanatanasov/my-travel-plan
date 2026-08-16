import { useMemo } from 'react';
import {
  useGetFlightsQuery,
  useGetFlightStatsQuery,
} from '../../features/flights/flightsApi';
import { computeTravelRecords } from '../../features/stats/records';
import YearBarChart from './YearBarChart';
import StatsCard from './StatsCard';

/** Shared shell for "nothing here yet" and "that did not load". */
function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="bg-surface border border-line rounded-2xl px-6 py-12 text-center shadow-sm">
      <span className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-surface-sunken text-ink-subtle mb-4">
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.8}
            d="M3 13h2l1 2h12l1-2h2M5 19h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
          />
        </svg>
      </span>
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      <p className="text-sm text-ink-muted mt-1.5 max-w-sm mx-auto leading-relaxed">
        {body}
      </p>
    </div>
  );
}

function FlightStats() {
  const { data: stats, isLoading, error } = useGetFlightStatsQuery();
  // Personal records derive from the journey list the Flights tab already
  // caches; a one-entry "streak" is just a trip, so records only render
  // once they say something.
  const { data: journeys = [] } = useGetFlightsQuery();
  const records = useMemo(() => computeTravelRecords(journeys), [journeys]);
  const newCountryStreak =
    records.newCountryStreak && records.newCountryStreak.years >= 2
      ? records.newCountryStreak
      : null;
  const maxContinents =
    records.maxContinentsInYear && records.maxContinentsInYear.continents >= 2
      ? records.maxContinentsInYear
      : null;

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-pulse">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <div key={i} className="bg-surface-sunken h-24 rounded-xl" />
        ))}
      </div>
    );
  }

  /*
    Both of these used to `return null`, so anyone who opened Statistics
    before logging a flight — which is everyone on their first visit — got a
    blank panel and no way to tell a working empty app from a broken one.
  */
  if (error || !stats) {
    return (
      <EmptyState
        title="Statistics are unavailable"
        body="We couldn't load your flight stats just now. Refreshing usually sorts it."
      />
    );
  }

  if (stats.totalFlights === 0) {
    return (
      <EmptyState
        title="No flights logged yet"
        body="Add a flight from the Flights tab and this fills up: distance flown, time in the air, your busiest year, and how far up to the Moon you've got."
      />
    );
  }

  const formatNumber = (n: number) => n.toLocaleString();

  const getMonthName = (month: number) => {
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    return months[month - 1] || '';
  };

  return (
    <div className="space-y-6">
      {/* Main Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatsCard
          title="Total Flights"
          value={formatNumber(stats.totalFlights)}
          subtitle={`${stats.totalJourneys} journeys`}
          color="blue"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          }
        />
        <StatsCard
          title="Distance Traveled"
          value={`${formatNumber(Math.round(stats.totalDistanceKm))} km`}
          subtitle={`${stats.earthCircumferences.toFixed(1)}× around Earth`}
          color="green"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" />
            </svg>
          }
        />
        <StatsCard
          title="Airports Visited"
          value={stats.uniqueAirports}
          subtitle={`in ${stats.uniqueCountries} countries`}
          color="purple"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          }
        />
        <StatsCard
          title="Flight Hours"
          value={`~${Math.round(stats.estimatedFlightHours)}h`}
          subtitle="estimated time in air"
          color="orange"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
      </div>

      {/* Creative Stats */}
      <div className="bg-panel-accent rounded-2xl p-6 text-white shadow-md">
        <h3 className="text-lg font-semibold mb-4">Fun Facts</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-white/85 text-sm">Distance to Moon</p>
            <p className="font-display font-normal text-3xl">{stats.moonDistancePercent.toFixed(1)}%</p>
          </div>
          <div>
            <p className="text-white/85 text-sm">If you walked instead...</p>
            <p className="font-display font-normal text-3xl">{stats.walkingYears.toFixed(1)} years</p>
          </div>
          <div>
            <p className="text-white/85 text-sm">Earth Circumferences</p>
            <p className="font-display font-normal text-3xl">{stats.earthCircumferences.toFixed(2)}×</p>
          </div>
        </div>
      </div>

      <YearBarChart byYear={stats.byYear} strongestYear={stats.strongestYear} />

      {/* Records */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {stats.longestFlight && (
          <div className="bg-surface rounded-xl border border-line p-4">
            <h4 className="text-sm text-ink-muted mb-2">Longest Flight</h4>
            <p className="font-mono text-lg font-semibold text-ink">
              {stats.longestFlight.departureIata} → {stats.longestFlight.arrivalIata}
            </p>
            <p className="text-sm text-ink-muted">
              {stats.longestFlight.departureCity} to {stats.longestFlight.arrivalCity}
            </p>
            <p className="text-brand-text font-semibold mt-1">
              {formatNumber(Math.round(stats.longestFlight.distanceKm))} km
            </p>
          </div>
        )}
        {stats.shortestFlight && (
          <div className="bg-surface rounded-xl border border-line p-4">
            <h4 className="text-sm text-ink-muted mb-2">Shortest Flight</h4>
            <p className="font-mono text-lg font-semibold text-ink">
              {stats.shortestFlight.departureIata} → {stats.shortestFlight.arrivalIata}
            </p>
            <p className="text-sm text-ink-muted">
              {stats.shortestFlight.departureCity} to {stats.shortestFlight.arrivalCity}
            </p>
            <p className="text-brand-text font-semibold mt-1">
              {formatNumber(Math.round(stats.shortestFlight.distanceKm))} km
            </p>
          </div>
        )}
      </div>

      {/* Strongest Period */}
      {(stats.strongestYear || stats.strongestMonth) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {stats.strongestYear && (
            <div className="bg-surface rounded-xl border border-line p-4">
              <h4 className="text-sm text-ink-muted mb-2">Strongest Year</h4>
              <p className="text-2xl font-bold text-ink">
                {stats.strongestYear.year}
              </p>
              <p className="text-sm text-ink-muted">
                {stats.strongestYear.flights} flights ·{' '}
                {formatNumber(Math.round(stats.strongestYear.distanceKm))} km
              </p>
            </div>
          )}
          {stats.strongestMonth && (
            <div className="bg-surface rounded-xl border border-line p-4">
              <h4 className="text-sm text-ink-muted mb-2">Strongest Month</h4>
              <p className="text-2xl font-bold text-ink">
                {getMonthName(stats.strongestMonth.month)} {stats.strongestMonth.year}
              </p>
              <p className="text-sm text-ink-muted">
                {stats.strongestMonth.flights} flights ·{' '}
                {formatNumber(Math.round(stats.strongestMonth.distanceKm))} km
              </p>
            </div>
          )}
        </div>
      )}

      {/* Personal records: you against your own map, nobody else's. */}
      {(newCountryStreak || maxContinents) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {newCountryStreak && (
            <div className="bg-surface rounded-xl border border-line p-4">
              <h4 className="text-sm text-ink-muted mb-2">
                New-Country Streak
              </h4>
              <p className="text-2xl font-bold text-ink">
                {newCountryStreak.years} years in a row
              </p>
              <p className="text-sm text-ink-muted">
                somewhere new every year, {newCountryStreak.start}–
                {newCountryStreak.end}
              </p>
            </div>
          )}
          {maxContinents && (
            <div className="bg-surface rounded-xl border border-line p-4">
              <h4 className="text-sm text-ink-muted mb-2">
                Most Continents in a Year
              </h4>
              <p className="text-2xl font-bold text-ink">
                {maxContinents.continents} continents
              </p>
              <p className="text-sm text-ink-muted">
                all inside {maxContinents.year}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Most Visited Airports */}
      {stats.mostVisitedAirports.length > 0 && (
        <div className="bg-surface rounded-xl border border-line p-4">
          <h4 className="text-sm text-ink-muted mb-3">Most Visited Airports</h4>
          <div className="flex flex-wrap gap-2">
            {stats.mostVisitedAirports.slice(0, 5).map((airport, index) => (
              <div
                key={airport.airportId}
                className="flex items-center gap-2 bg-surface-sunken rounded-lg px-3 py-2"
              >
                <span className="text-xs text-ink-subtle">#{index + 1}</span>
                <span className="font-mono font-semibold text-ink">
                  {airport.iataCode}
                </span>
                <span className="text-sm text-ink-muted">{airport.city}</span>
                <span className="text-xs text-brand-text font-medium">
                  {airport.visitCount}×
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Countries */}
      {stats.countriesVisited.length > 0 && (
        <div className="bg-surface rounded-xl border border-line p-4">
          <h4 className="text-sm text-ink-muted mb-3">
            Countries Reached ({stats.countriesVisited.length})
          </h4>
          <div className="flex flex-wrap gap-2">
            {stats.countriesVisited.map((country) => (
              <span
                key={country}
                className="bg-surface-sunken text-ink text-sm px-2 py-1 rounded"
              >
                {country}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default FlightStats;
