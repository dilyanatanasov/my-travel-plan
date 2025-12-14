import type { ExplorationFlightOptionDto } from '../../../../types';

interface HighlightCardsProps {
  highlights: {
    recommended: ExplorationFlightOptionDto | null;
    cheapest: ExplorationFlightOptionDto | null;
    fastest: ExplorationFlightOptionDto | null;
  };
}

function HighlightCards({ highlights }: HighlightCardsProps) {
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

  const cards = [
    {
      type: 'recommended',
      title: 'Recommended',
      icon: '⭐',
      option: highlights.recommended,
      color: 'blue',
    },
    {
      type: 'cheapest',
      title: 'Cheapest',
      icon: '💰',
      option: highlights.cheapest,
      color: 'green',
    },
    {
      type: 'fastest',
      title: 'Fastest',
      icon: '⚡',
      option: highlights.fastest,
      color: 'orange',
    },
  ];

  const colorClasses: Record<string, { bg: string; border: string; text: string }> = {
    blue: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-600' },
    green: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-600' },
    orange: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-600' },
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {cards.map((card) => {
        const option = card.option;
        if (!option) return null;

        const colors = colorClasses[card.color];

        return (
          <div
            key={card.type}
            className={`${colors.bg} ${colors.border} border-2 rounded-lg p-4 hover:shadow-md transition-shadow`}
          >
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl">{card.icon}</span>
              <span className={`font-semibold ${colors.text}`}>{card.title}</span>
            </div>

            <div className="space-y-3">
              {/* Date */}
              <p className="text-sm font-medium text-gray-700">{option.dateLabel}</p>

              {/* Price */}
              <p className="text-2xl font-bold text-gray-900">
                ${option.totalPrice.toFixed(0)}
                <span className="text-sm font-normal text-gray-500 ml-1">total</span>
              </p>

              {/* Flight details */}
              <div className="space-y-2">
                {/* Outbound */}
                <div className="flex items-center justify-between text-sm">
                  <div>
                    <p className="font-medium">
                      {option.outbound.departureAirport} → {option.outbound.arrivalAirport}
                    </p>
                    <p className="text-gray-500">
                      {formatTime(option.outbound.departureTime)} - {formatTime(option.outbound.arrivalTime)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-gray-600">{formatDuration(option.outbound.durationMinutes)}</p>
                    <p className="text-gray-500">
                      {option.outbound.stopCount === 0 ? 'Direct' : `${option.outbound.stopCount} stop${option.outbound.stopCount > 1 ? 's' : ''}`}
                    </p>
                  </div>
                </div>

                {/* Return */}
                {option.return && (
                  <div className="flex items-center justify-between text-sm">
                    <div>
                      <p className="font-medium">
                        {option.return.departureAirport} → {option.return.arrivalAirport}
                      </p>
                      <p className="text-gray-500">
                        {formatTime(option.return.departureTime)} - {formatTime(option.return.arrivalTime)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-gray-600">{formatDuration(option.return.durationMinutes)}</p>
                      <p className="text-gray-500">
                        {option.return.stopCount === 0 ? 'Direct' : `${option.return.stopCount} stop${option.return.stopCount > 1 ? 's' : ''}`}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Score */}
              <div className="flex items-center gap-1 pt-2 border-t border-gray-200">
                <span className="text-xs text-gray-500">Score:</span>
                <span className="text-sm font-semibold text-gray-700">{option.score}/100</span>
              </div>

              {/* Book button */}
              <a
                href={option.bookingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`block w-full text-center py-2 rounded-lg font-medium text-white transition-colors ${
                  card.color === 'blue' ? 'bg-blue-600 hover:bg-blue-700' :
                  card.color === 'green' ? 'bg-green-600 hover:bg-green-700' :
                  'bg-orange-600 hover:bg-orange-700'
                }`}
              >
                View Deal
              </a>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default HighlightCards;
