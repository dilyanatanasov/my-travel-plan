import { memo } from 'react';
import { useMapContext, useZoomPanContext } from 'react-simple-maps';
import type { Airport } from '../../types';
import { getZoomAdjustedSize } from './routeUtils';

interface AirportMarkersProps {
  airports: Airport[];
  visitCounts: Map<string, number>;
  highlightedAirports: string[];
}

function AirportMarkers({
  airports,
  visitCounts,
  highlightedAirports,
}: AirportMarkersProps) {
  const { projection } = useMapContext();
  const { k: zoom } = useZoomPanContext();

  // Calculate max visit count for scaling
  const maxVisits = Math.max(...Array.from(visitCounts.values()), 1);

  // Calculate marker radius based on visit count
  const getRadius = (iataCode: string): number => {
    const count = visitCounts.get(iataCode) || 1;
    const normalized = (count - 1) / Math.max(maxVisits - 1, 1);
    return 3 + normalized * 3; // Range: 3 to 6
  };

  return (
    <g className="airport-markers">
      {airports.map((airport) => {
        const coords = projection([airport.longitude, airport.latitude]);

        if (!coords) return null;

        const [x, y] = coords;
        const isHighlighted = highlightedAirports.includes(airport.iataCode);
        const baseRadius = getRadius(airport.iataCode);
        const radius = getZoomAdjustedSize(baseRadius, zoom);
        const strokeWidth = getZoomAdjustedSize(1, zoom);
        const highlightOffset = getZoomAdjustedSize(3, zoom);
        const highlightStroke = getZoomAdjustedSize(2, zoom);
        const fontSize = getZoomAdjustedSize(10, zoom);
        const labelOffset = getZoomAdjustedSize(baseRadius + 5, zoom);

        return (
          <g key={airport.iataCode}>
            {/* Outer glow for highlighted airports */}
            {isHighlighted && (
              <circle
                cx={x}
                cy={y}
                r={radius + highlightOffset}
                fill="none"
                stroke="#fbbf24"
                strokeWidth={highlightStroke}
                strokeOpacity={0.8}
              />
            )}
            {/* Main marker */}
            <circle
              cx={x}
              cy={y}
              r={radius}
              fill={isHighlighted ? '#fbbf24' : '#ef4444'}
              stroke="#fff"
              strokeWidth={strokeWidth}
              style={{
                transition: 'fill 0.15s',
              }}
            />
            {/* IATA label for highlighted airports */}
            {isHighlighted && (
              <text
                x={x}
                y={y - labelOffset}
                textAnchor="middle"
                fontSize={fontSize}
                fontWeight="bold"
                fill="#1f2937"
                style={{ pointerEvents: 'none' }}
              >
                {airport.iataCode}
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
}

export default memo(AirportMarkers);
