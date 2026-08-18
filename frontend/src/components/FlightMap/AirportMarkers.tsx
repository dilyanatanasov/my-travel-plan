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
  /**
   * Replay arrival: this airport's own marker+label pops as the plane
   * reaches it — reusing the label that is already on the map instead of
   * stacking a second one on top (user decision, 2026-08-13).
   */
  popIata?: string | null;
  /** Changes per pop so the same airport can pop twice in one journey. */
  popKey?: number;
  /**
   * Zoom thresholds for labels — the defaults suit the flat map's zoom
   * scale (1–24); the globe's runs 1–8 and its horizon culling already
   * thins the field, so it labels much earlier.
   */
  labelsFromZoom?: number;
  cityNamesFromZoom?: number;
  /**
   * Zoom used for the LABEL decisions only. The globe pins the layers'
   * zoom-pan context at k=1 (its magnification lives in the projection
   * scale, so pixel sizes need no correction) — which also meant labels
   * could never appear there. It passes its camera zoom through this
   * instead; sizes keep using the context.
   */
  labelZoom?: number;
  /**
   * Multiplies label type size. The ticket surfaces draw this layer's
   * 1600px render at ~0.6x into the card strip, which shrank city names
   * to squint size in the trip video (owner report, 2026-08-18) - they
   * pass the reciprocal here so names land at full size.
   */
  labelScale?: number;
}

function AirportMarkers({
  airports,
  visitCounts,
  highlightedAirports,
  sizeScale = 1,
  popIata,
  popKey,
  labelsFromZoom = 2.5,
  cityNamesFromZoom = 4.5,
  labelZoom,
  labelScale = 1,
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
  const effectiveLabelZoom = labelZoom ?? zoom;
  const showLabels = effectiveLabelZoom >= labelsFromZoom;
  // City names need more room than a 3-letter code, so they wait for more zoom.
  const useCityNames = effectiveLabelZoom >= cityNamesFromZoom;

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

  /*
    SVG has no z-index — paint order is document order — so a popping
    airport rendered early got its pill overpainted by any neighbour's
    label drawn after it. The pop always paints last.
  */
  const orderedAirports = popIata
    ? [
        ...airports.filter((a) => a.iataCode !== popIata),
        ...airports.filter((a) => a.iataCode === popIata),
      ]
    : airports;

  return (
    <g className="airport-markers">
      {orderedAirports.map((airport) => {
        const coords = projection([airport.longitude, airport.latitude]);

        if (!coords) return null;

        const [x, y] = coords;
        const isHighlighted = highlightedAirports.includes(airport.iataCode);
        const isPopping = airport.iataCode === popIata;
        const baseRadius = getRadius(airport.iataCode);
        // Emphasised rather than merely constant: zooming in is a request for
        // detail, and a dot that holds exactly still reads as less important
        // the closer you get to it.
        const radius = getZoomEmphasisedSize(baseRadius, zoom);
        const strokeWidth = getZoomAdjustedSize(0.7 * sizeScale, zoom);
        const highlightOffset = getZoomAdjustedSize(3, zoom);
        const highlightStroke = getZoomAdjustedSize(2, zoom);
        const fontSize =
          getZoomAdjustedSize(isPopping ? 12 : isHighlighted ? 11 : 10, zoom) *
          labelScale;
        const labelOffset = radius + getZoomAdjustedSize(6 * labelScale, zoom);
        // A popping arrival announces the city even at world zoom — that is
        // the "you have landed in…" moment.
        const label =
          useCityNames || isPopping
            ? airport.city || airport.iataCode
            : airport.iataCode;

        return (
          <g
            key={
              isPopping ? `${airport.iataCode}-${popKey}` : airport.iataCode
            }
            className={isPopping ? 'airport-pop' : undefined}
          >
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
            {/* The pill behind a popping label — the "you have landed in…"
                moment reads as an announcement, not a stray caption. */}
            {isPopping && (
              <rect
                x={x - (label.length * fontSize * 0.62 + fontSize * 1.6) / 2}
                y={y - labelOffset - fontSize * 1.25}
                width={label.length * fontSize * 0.62 + fontSize * 1.6}
                height={fontSize * 1.8}
                rx={fontSize * 0.9}
                fill={colors.ocean}
                fillOpacity={0.88}
                stroke={colors.routeHighlight}
                strokeWidth={getZoomAdjustedSize(1, zoom)}
              />
            )}
            {(showLabels || isHighlighted || isPopping) && (
              <text
                x={x}
                y={y - labelOffset}
                textAnchor="middle"
                fontSize={fontSize}
                fontWeight={isHighlighted || isPopping ? 700 : 600}
                fill={colors.label}
                stroke={colors.ocean}
                strokeWidth={getZoomAdjustedSize(2.5 * labelScale, zoom)}
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
