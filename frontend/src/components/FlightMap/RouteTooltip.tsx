import { memo } from 'react';
import type { AggregatedRoute } from './routeUtils';

interface RouteTooltipProps {
  route: AggregatedRoute | null;
  position: { x: number; y: number };
}

function RouteTooltip({ route, position }: RouteTooltipProps) {
  if (!route) return null;

  const { departure, arrival, count, totalDistance } = route;
  const avgDistance = Math.round(totalDistance / count);

  return (
    <div
      className="fixed z-50 pointer-events-none"
      style={{
        left: position.x + 12,
        top: position.y - 10,
      }}
    >
      <div className="bg-gray-900 text-white px-3 py-2 rounded-lg shadow-lg text-sm">
        {/* Route */}
        <div className="font-semibold text-blue-300">
          {departure.iataCode} → {arrival.iataCode}
        </div>

        {/* Cities */}
        <div className="text-gray-300 text-xs mt-0.5">
          {departure.city || departure.name} → {arrival.city || arrival.name}
        </div>

        {/* Stats */}
        <div className="flex gap-4 mt-1.5 text-xs">
          <div>
            <span className="text-gray-400">Flights: </span>
            <span className="font-medium">{count}</span>
          </div>
          <div>
            <span className="text-gray-400">Distance: </span>
            <span className="font-medium">
              {avgDistance.toLocaleString()} km
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default memo(RouteTooltip);
