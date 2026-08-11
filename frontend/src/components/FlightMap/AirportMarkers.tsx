import { memo } from 'react';
import { useMapContext, useZoomPanContext } from 'react-simple-maps';
import type { Airport } from '../../types';
import { getZoomAdjustedSize } from './routeUtils';
import { MAP } from '../../theme/mapColors';

interface AirportMarkersProps {
  airports: Airport[];
  visitCounts: Map<string, number>;
  highlightedAirports: string[];
  /** Trims marker size on small screens, where dots otherwise swamp the map. */
  sizeScale?: number;
}

function AirportMarkers({
  airports,
  visitCounts,
  highlightedAirports,
  sizeScale = 1,
}: AirportMarkersProps) {
  const { projection } = useMapContext();
  const { k: zoom } = useZoomPanContext();

  // Calculate max visit count for scaling
  const maxVisits = Math.max(...Array.from(visitCounts.values()), 1);

  /**
   * Marker radius by visit count. Smaller than it was (3–6): with 39 airports
   * clustered over Europe the dots merged into one mass and hid the countries
   * beneath them.
   */
  const getRadius = (iataCode: string): number => {
    const count = visitCounts.get(iataCode) || 1;
    const normalized = (count - 1) / Math.max(maxVisits - 1, 1);
    return (2 + normalized * 2.2) * sizeScale; // Range: 2 to 4.2
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
        const strokeWidth = getZoomAdjustedSize(0.7 * sizeScale, zoom);
        const highlightOffset = getZoomAdjustedSize(3, zoom);
        const highlightStroke = getZoomAdjustedSize(2, zoom);
        const fontSize = getZoomAdjustedSize(10, zoom);
        const labelOffset = getZoomAdjustedSize(baseRadius + 5, zoom);

        return (
          <g key={airport.iataCode}>
            {/* Outer ring for highlighted airports */}
            {isHighlighted && (
              <circle
                cx={x}
                cy={y}
                r={radius + highlightOffset}
                fill="none"
                stroke={MAP.selected}
                strokeWidth={highlightStroke}
                strokeOpacity={0.8}
              />
            )}
            {/*
              Main marker. White fill with a dark ring rather than a hue: these
              sit on top of visited countries, and the old red-on-green was the
              app's worst colour-vision failure. Lightness contrast works for
              everyone.
            */}
            <circle
              cx={x}
              cy={y}
              r={radius}
              fill={isHighlighted ? MAP.selected : MAP.airportFill}
              stroke={isHighlighted ? MAP.selected : MAP.airportRing}
              strokeWidth={strokeWidth * 1.5}
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
                fill={MAP.airportRing}
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
