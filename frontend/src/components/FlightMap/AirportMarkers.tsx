import { memo } from 'react';
import { useMapContext, useZoomPanContext } from 'react-simple-maps';
import type { Airport } from '../../types';
import { getZoomAdjustedSize, getZoomEmphasisedSize } from './routeUtils';
import { useMapColors } from '../../theme/mapColors';

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
  const { map: colors } = useMapColors();
  const { projection } = useMapContext();
  const { k: zoom } = useZoomPanContext();

  /*
    Past this zoom the map has stopped being a world overview and become a
    regional one, where the question changes from "where have I been" to
    "which airport is that". Below it, labelling 39 airports clustered over
    Europe would be a wall of text.
  */
  const showLabels = zoom >= 2.5;
  // City names need more room than a 3-letter code, so they wait for more zoom.
  const useCityNames = zoom >= 4.5;

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
        // Emphasised rather than merely constant: zooming in is a request for
        // detail, and a dot that holds exactly still reads as less important
        // the closer you get to it.
        const radius = getZoomEmphasisedSize(baseRadius, zoom);
        const strokeWidth = getZoomAdjustedSize(0.7 * sizeScale, zoom);
        const highlightOffset = getZoomAdjustedSize(3, zoom);
        const highlightStroke = getZoomAdjustedSize(2, zoom);
        const fontSize = getZoomAdjustedSize(isHighlighted ? 11 : 10, zoom);
        const labelOffset = radius + getZoomAdjustedSize(6, zoom);
        const label = useCityNames
          ? airport.city || airport.iataCode
          : airport.iataCode;

        return (
          <g key={airport.iataCode}>
            {/* Outer ring for highlighted airports */}
            {isHighlighted && (
              <circle
                cx={x}
                cy={y}
                r={radius + highlightOffset}
                fill="none"
                stroke={colors.selected}
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
              fill={isHighlighted ? colors.selected : colors.airportFill}
              stroke={isHighlighted ? colors.selected : colors.airportRing}
              strokeWidth={strokeWidth * 1.5}
              style={{
                transition: 'fill 0.15s',
              }}
            />
            {/*
              Labels appear once zoomed in, and always for a highlighted
              airport. paintOrder + a stroke in the ocean colour gives each
              one a halo, which is what keeps it readable where it crosses a
              coastline or another route rather than needing a solid plate
              behind it.
            */}
            {(showLabels || isHighlighted) && (
              <text
                x={x}
                y={y - labelOffset}
                textAnchor="middle"
                fontSize={fontSize}
                fontWeight={isHighlighted ? 700 : 600}
                fill={colors.label}
                stroke={colors.ocean}
                strokeWidth={getZoomAdjustedSize(2.5, zoom)}
                paintOrder="stroke"
                strokeLinejoin="round"
                style={{ pointerEvents: 'none' }}
              >
                {label}
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
}

export default memo(AirportMarkers);
