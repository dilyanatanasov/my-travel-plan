import { FlightResultDto, FlightLegDto } from '../../../types';

interface FlightCardProps {
  flight: FlightResultDto;
}

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

const getStopsText = (stops: number): string => {
  if (stops === 0) return 'Direct';
  if (stops === 1) return '1 stop';
  return `${stops} stops`;
};

const FlightLegDisplay: React.FC<{ leg: FlightLegDto; label: string }> = ({ leg, label }) => {
  return (
    <div className="mb-4">
      <div className="text-xs text-gray-500 mb-2 uppercase tracking-wide">{label}</div>
      <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-center">
        {/* Departure */}
        <div className="text-left">
          <div className="text-xl font-bold">{formatTime(leg.departureTime)}</div>
          <div className="text-sm text-gray-600">{leg.departureAirport}</div>
          <div className="text-xs text-gray-400 truncate">{leg.departureAirportName}</div>
        </div>

        {/* Duration & Stops */}
        <div className="text-center px-4">
          <div className="text-sm text-gray-600">{formatDuration(leg.durationMinutes)}</div>
          <div className="relative flex items-center justify-center my-1">
            <div className="w-full h-px bg-gray-300"></div>
            <div className="absolute">
              {leg.stopCount > 0 ? (
                <span className="bg-white px-1 text-xs text-orange-600">
                  {getStopsText(leg.stopCount)}
                </span>
              ) : (
                <span className="bg-white px-1 text-xs text-green-600">Direct</span>
              )}
            </div>
          </div>
          <div className="text-xs text-gray-500">
            {leg.carriers.map((c) => c.name).join(', ')}
          </div>
        </div>

        {/* Arrival */}
        <div className="text-right">
          <div className="text-xl font-bold">{formatTime(leg.arrivalTime)}</div>
          <div className="text-sm text-gray-600">{leg.arrivalAirport}</div>
          <div className="text-xs text-gray-400 truncate">{leg.arrivalAirportName}</div>
        </div>
      </div>

      {/* Layovers */}
      {leg.layovers.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {leg.layovers.map((layover, idx) => (
            <span key={idx} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
              {layover.airport}: {formatDuration(layover.durationMinutes)} layover
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

export const FlightCard: React.FC<FlightCardProps> = ({ flight }) => {
  const bookingLink = flight.pricingOptions.length > 0
    ? flight.pricingOptions[0].deepLink
    : '#';

  const { safetyWarnings } = flight;
  const hasWarnings = safetyWarnings.hasBannedCarrier || safetyWarnings.hasCautionCarrier;

  return (
    <div className="bg-white rounded-lg shadow-md p-4 hover:shadow-lg transition-shadow">
      {/* Safety Warnings */}
      {hasWarnings && (
        <div className="mb-4 p-3 rounded-lg bg-gray-50 border border-gray-200">
          <div className="text-sm font-medium text-gray-700 mb-2">Safety Warnings</div>
          <div className="flex flex-wrap gap-2">
            {safetyWarnings.carriers.map((carrier, idx) => {
              const isBanned = carrier.warning === 'banned';
              const bgColor = isBanned ? 'bg-red-100' : 'bg-yellow-100';
              const textColor = isBanned ? 'text-red-700' : 'text-yellow-700';
              return (
                <span
                  key={idx}
                  className={`${bgColor} ${textColor} text-xs px-2 py-1 rounded flex items-center gap-1`}
                >
                  <span className="font-medium">{carrier.name}</span>
                  <span>({isBanned ? 'EU Banned' : 'Caution'})</span>
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Outbound Leg */}
      <FlightLegDisplay leg={flight.outboundLeg} label="Outbound" />

      {/* Return Leg */}
      {flight.returnLeg && (
        <>
          <hr className="border-gray-200 my-4" />
          <FlightLegDisplay leg={flight.returnLeg} label="Return" />
        </>
      )}

      {/* Price and Booking */}
      <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
        <div>
          <div className="text-2xl font-bold text-blue-600">
            ${flight.lowestPrice.toFixed(2)}
          </div>
          <div className="text-xs text-gray-500">
            {flight.pricingOptions.length} booking option{flight.pricingOptions.length !== 1 ? 's' : ''}
          </div>
        </div>
        <a
          href={bookingLink}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors font-medium"
        >
          Book
        </a>
      </div>
    </div>
  );
};

export default FlightCard;
