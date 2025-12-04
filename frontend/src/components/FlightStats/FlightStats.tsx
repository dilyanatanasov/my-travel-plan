import { useGetFlightStatsQuery } from '../../features/flights/flightsApi';
import StatsCard from './StatsCard';

function FlightStats() {
  const { data: stats, isLoading, error } = useGetFlightStatsQuery();

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-pulse">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <div key={i} className="bg-gray-200 h-24 rounded-xl" />
        ))}
      </div>
    );
  }

  if (error || !stats) {
    return null;
  }

  if (stats.totalFlights === 0) {
    return null;
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
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl p-6 text-white">
        <h3 className="text-lg font-semibold mb-4">Fun Facts</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-blue-100 text-sm">Distance to Moon</p>
            <p className="text-2xl font-bold">{stats.moonDistancePercent.toFixed(1)}%</p>
          </div>
          <div>
            <p className="text-blue-100 text-sm">If you walked instead...</p>
            <p className="text-2xl font-bold">{stats.walkingYears.toFixed(1)} years</p>
          </div>
          <div>
            <p className="text-blue-100 text-sm">Earth Circumferences</p>
            <p className="text-2xl font-bold">{stats.earthCircumferences.toFixed(2)}×</p>
          </div>
        </div>
      </div>

      {/* Records */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {stats.longestFlight && (
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h4 className="text-sm text-gray-500 mb-2">Longest Flight</h4>
            <p className="font-mono text-lg font-semibold text-gray-900">
              {stats.longestFlight.departureIata} → {stats.longestFlight.arrivalIata}
            </p>
            <p className="text-sm text-gray-500">
              {stats.longestFlight.departureCity} to {stats.longestFlight.arrivalCity}
            </p>
            <p className="text-blue-600 font-semibold mt-1">
              {formatNumber(Math.round(stats.longestFlight.distanceKm))} km
            </p>
          </div>
        )}
        {stats.shortestFlight && (
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h4 className="text-sm text-gray-500 mb-2">Shortest Flight</h4>
            <p className="font-mono text-lg font-semibold text-gray-900">
              {stats.shortestFlight.departureIata} → {stats.shortestFlight.arrivalIata}
            </p>
            <p className="text-sm text-gray-500">
              {stats.shortestFlight.departureCity} to {stats.shortestFlight.arrivalCity}
            </p>
            <p className="text-green-600 font-semibold mt-1">
              {formatNumber(Math.round(stats.shortestFlight.distanceKm))} km
            </p>
          </div>
        )}
      </div>

      {/* Strongest Period */}
      {(stats.strongestYear || stats.strongestMonth) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {stats.strongestYear && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h4 className="text-sm text-gray-500 mb-2">Strongest Year</h4>
              <p className="text-2xl font-bold text-gray-900">
                {stats.strongestYear.year}
              </p>
              <p className="text-sm text-gray-500">
                {stats.strongestYear.flights} flights ·{' '}
                {formatNumber(Math.round(stats.strongestYear.distanceKm))} km
              </p>
            </div>
          )}
          {stats.strongestMonth && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h4 className="text-sm text-gray-500 mb-2">Strongest Month</h4>
              <p className="text-2xl font-bold text-gray-900">
                {getMonthName(stats.strongestMonth.month)} {stats.strongestMonth.year}
              </p>
              <p className="text-sm text-gray-500">
                {stats.strongestMonth.flights} flights ·{' '}
                {formatNumber(Math.round(stats.strongestMonth.distanceKm))} km
              </p>
            </div>
          )}
        </div>
      )}

      {/* Most Visited Airports */}
      {stats.mostVisitedAirports.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h4 className="text-sm text-gray-500 mb-3">Most Visited Airports</h4>
          <div className="flex flex-wrap gap-2">
            {stats.mostVisitedAirports.slice(0, 5).map((airport, index) => (
              <div
                key={airport.airportId}
                className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2"
              >
                <span className="text-xs text-gray-400">#{index + 1}</span>
                <span className="font-mono font-semibold text-gray-900">
                  {airport.iataCode}
                </span>
                <span className="text-sm text-gray-500">{airport.city}</span>
                <span className="text-xs text-blue-600 font-medium">
                  {airport.visitCount}×
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Countries */}
      {stats.countriesVisited.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h4 className="text-sm text-gray-500 mb-3">
            Countries Reached ({stats.countriesVisited.length})
          </h4>
          <div className="flex flex-wrap gap-2">
            {stats.countriesVisited.map((country) => (
              <span
                key={country}
                className="bg-gray-100 text-gray-700 text-sm px-2 py-1 rounded"
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
