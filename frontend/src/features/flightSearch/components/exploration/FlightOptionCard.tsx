import type { ExplorationFlightOptionDto } from '../../../../types';

interface FlightOptionCardProps {
  option: ExplorationFlightOptionDto;
  compact?: boolean;
}

function FlightOptionCard({ option, compact = false }: FlightOptionCardProps) {
  const formatDuration = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const formatTime = (isoString: string): string => {
    return new Date(isoString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  };

  const badges = [];
  if (option.isRecommended) badges.push({ label: 'Best', color: 'bg-blue-100 text-blue-700' });
  if (option.isCheapest) badges.push({ label: 'Cheapest', color: 'bg-green-100 text-green-700' });
  if (option.isFastest) badges.push({ label: 'Fastest', color: 'bg-orange-100 text-orange-700' });

  if (compact) {
    return (
      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
        <div className="flex items-center gap-4">
          {/* Badges */}
          {badges.length > 0 && (
            <div className="flex gap-1">
              {badges.slice(0, 1).map((badge) => (
                <span key={badge.label} className={`${badge.color} text-xs px-2 py-0.5 rounded-full font-medium`}>
                  {badge.label}
                </span>
              ))}
            </div>
          )}

          {/* Date */}
          <span className="text-sm font-medium text-gray-700">{option.dateLabel}</span>

          {/* Duration & Stops */}
          <span className="text-sm text-gray-500">
            {formatDuration(option.outbound.durationMinutes)}
            {option.outbound.stopCount > 0 && (
              <> • {option.outbound.stopCount} stop{option.outbound.stopCount > 1 ? 's' : ''}</>
            )}
          </span>

          {/* Carriers */}
          <span className="text-xs text-gray-400">
            {option.carriers.map((c) => c.code).join(', ')}
          </span>
        </div>

        <div className="flex items-center gap-4">
          <span className="font-semibold text-gray-900">${option.totalPrice.toFixed(0)}</span>
          <a
            href={option.bookingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-700 text-sm font-medium"
          >
            View →
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-4 hover:shadow-lg transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-gray-800">{option.dateLabel}</span>
            {badges.map((badge) => (
              <span key={badge.label} className={`${badge.color} text-xs px-2 py-0.5 rounded-full font-medium`}>
                {badge.label}
              </span>
            ))}
          </div>
          <p className="text-sm text-gray-500">
            {option.nightsAtDestination} night{option.nightsAtDestination !== 1 ? 's' : ''} at destination
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-gray-900">${option.totalPrice.toFixed(0)}</p>
          <p className="text-xs text-gray-500">${option.pricePerPerson.toFixed(0)}/person</p>
        </div>
      </div>

      {/* Flight Legs */}
      <div className="space-y-3">
        {/* Outbound */}
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-800">
                  {formatTime(option.outbound.departureTime)}
                </p>
                <p className="text-sm text-gray-500">{option.outbound.departureAirport}</p>
              </div>

              <div className="flex-1 mx-4">
                <div className="relative">
                  <div className="border-t border-gray-300" />
                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white px-2">
                    <p className="text-xs text-gray-500">{formatDuration(option.outbound.durationMinutes)}</p>
                    <p className="text-xs text-gray-400 text-center">
                      {option.outbound.stopCount === 0 ? 'Direct' : `${option.outbound.stopCount} stop`}
                    </p>
                  </div>
                </div>
              </div>

              <div className="text-right">
                <p className="font-medium text-gray-800">
                  {formatTime(option.outbound.arrivalTime)}
                </p>
                <p className="text-sm text-gray-500">{option.outbound.arrivalAirport}</p>
              </div>
            </div>

            {/* Layover info */}
            {option.outbound.layovers.length > 0 && (
              <p className="text-xs text-gray-400 mt-1">
                via {option.outbound.layovers.map((l) => l.airport).join(', ')}
              </p>
            )}
          </div>
        </div>

        {/* Return */}
        {option.return && (
          <div className="flex items-center gap-4 pt-3 border-t border-gray-100">
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-800">
                    {formatTime(option.return.departureTime)}
                  </p>
                  <p className="text-sm text-gray-500">{option.return.departureAirport}</p>
                </div>

                <div className="flex-1 mx-4">
                  <div className="relative">
                    <div className="border-t border-gray-300" />
                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white px-2">
                      <p className="text-xs text-gray-500">{formatDuration(option.return.durationMinutes)}</p>
                      <p className="text-xs text-gray-400 text-center">
                        {option.return.stopCount === 0 ? 'Direct' : `${option.return.stopCount} stop`}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <p className="font-medium text-gray-800">
                    {formatTime(option.return.arrivalTime)}
                  </p>
                  <p className="text-sm text-gray-500">{option.return.arrivalAirport}</p>
                </div>
              </div>

              {/* Layover info */}
              {option.return.layovers.length > 0 && (
                <p className="text-xs text-gray-400 mt-1">
                  via {option.return.layovers.map((l) => l.airport).join(', ')}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
        <div className="flex items-center gap-4">
          {/* Carriers */}
          <div className="flex items-center gap-1">
            {option.carriers.slice(0, 3).map((carrier) => (
              <span
                key={carrier.code}
                className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded"
                title={carrier.name}
              >
                {carrier.code}
              </span>
            ))}
          </div>

          {/* Score */}
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-500">Score:</span>
            <span className="text-sm font-medium text-gray-700">{option.score}</span>
          </div>

          {/* Warnings */}
          {option.hasLongLayover && (
            <span className="text-xs text-yellow-600 bg-yellow-50 px-2 py-1 rounded">
              Long layover
            </span>
          )}
          {option.hasBannedCarrier && (
            <span className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded">
              Safety warning
            </span>
          )}
        </div>

        <a
          href={option.bookingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
        >
          View Deal
        </a>
      </div>
    </div>
  );
}

export default FlightOptionCard;
