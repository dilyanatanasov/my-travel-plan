import type { FlightJourney } from '../../types';

interface FlightCardProps {
  journey: FlightJourney;
  onDelete: (id: number) => void;
}

function FlightCard({ journey, onDelete }: FlightCardProps) {
  const routeString = journey.legs
    .map((leg, index) => {
      if (index === 0) {
        return `${leg.departureAirport.iataCode} → ${leg.arrivalAirport.iataCode}`;
      }
      return leg.arrivalAirport.iataCode;
    })
    .join(' → ');

  const totalDistance = journey.legs.reduce(
    (sum, leg) => sum + (Number(leg.distanceKm) || 0),
    0
  );

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'No date';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-lg font-semibold text-gray-900">
              {routeString}
            </span>
            {journey.isRoundTrip && (
              <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full">
                Round trip
              </span>
            )}
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <span>{formatDate(journey.journeyDate)}</span>
            <span>{Math.round(totalDistance).toLocaleString()} km</span>
            <span>
              {journey.legs.length} {journey.legs.length === 1 ? 'flight' : 'flights'}
            </span>
          </div>
          {journey.notes && (
            <p className="mt-2 text-sm text-gray-600">{journey.notes}</p>
          )}
        </div>
        <button
          onClick={() => onDelete(journey.id)}
          className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
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
      </div>

      {/* Leg details (collapsed by default, expandable in future) */}
      <div className="mt-3 pt-3 border-t border-gray-100">
        <div className="flex flex-wrap gap-2">
          {journey.legs.map((leg, index) => (
            <div
              key={leg.id}
              className="flex items-center gap-1 text-xs text-gray-500"
            >
              <span className="font-mono">{leg.departureAirport.iataCode}</span>
              <svg
                className="w-3 h-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 8l4 4m0 0l-4 4m4-4H3"
                />
              </svg>
              <span className="font-mono">{leg.arrivalAirport.iataCode}</span>
              <span className="text-gray-400">
                ({Math.round(Number(leg.distanceKm) || 0)} km)
              </span>
              {index < journey.legs.length - 1 && (
                <span className="text-gray-300 mx-1">|</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default FlightCard;
