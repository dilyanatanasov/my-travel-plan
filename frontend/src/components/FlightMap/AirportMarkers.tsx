import { memo } from 'react';
import { useMapContext, useZoomPanContext } from 'react-simple-maps';
import type { Airport } from '../../types';
import {
  clusterByScreenDistance,
  stopClusterAnchor,
  getZoomAdjustedSize,
  getZoomEmphasisedSize,
} from './routeUtils';
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
  /**
   * Tap a marker to open its stop card (owner ask, 2026-08-19: cities
   * clickable like countries). The caller passes a gesture-guarded
   * handler; omitted on non-interactive surfaces (exports, shares).
   */
  onSelectStop?: (stops: Airport[]) => void;
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
  onSelectStop,
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
  const getRadius = (count: number): number => {
    const normalized = (Math.max(count, 1) - 1) / Math.max(maxVisits - 1, 1);
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

  /*
    Stops that overlap on screen draw as ONE place (owner ask,
    2026-08-20: Varna and Varna Airport are the same place until you
    zoom in). The cluster is anchored on a member, so the dot always
    sits on a real stop rather than in the water between two.

    The whole cluster is what a tap selects, so what you see and what
    you tap never disagree - zoom past the split and each stop is its
    own dot and its own card again.
  */
  /*
    City names an actual city stop already owns. An airport borrows its
    city's name once zoomed in, which reads fine alone - but when the
    pair splits apart you got two dots both saying "Sofia" (caught in
    testing, 2026-08-20). Those airports keep their code, so a split
    pair names the airport and the city centre distinctly.
  */
  const cityStopNames = new Set(
    airports.filter((a) => a.id < 0).map((a) => a.iataCode),
  );

  const clusters = clusterByScreenDistance(
    orderedAirports.flatMap((airport) => {
      const coords = projection([airport.longitude, airport.latitude]);
      return coords
        ? [{ item: airport, x: coords[0], y: coords[1] }]
        : [];
    }),
    zoom,
  );

  return (
    <g className="airport-markers">
      {clusters.map(({ items, x, y }) => {
        /*
          The cluster speaks for its most-travelled member - and always
          for the one currently landing, so a replay arrival announces
          the airport it actually reached rather than a neighbour.
        */
        const cluster = stopClusterAnchor(items, visitCounts);
        const airport =
          items.find((member) => member.iataCode === popIata) ?? cluster.anchor;
        const merged = items.length > 1;
        const isHighlighted = items.some((member) =>
          highlightedAirports.includes(member.iataCode),
        );
        const isPopping = items.some((member) => member.iataCode === popIata);
        // A merged dot carries everything that happened in the area, so
        // it is sized by the sum rather than by its spokesman.
        const baseRadius = merged
          ? getRadius(
              items.reduce(
                (sum, member) => sum + (visitCounts.get(member.iataCode) ?? 1),
                0,
              ),
            )
          : getRadius(visitCounts.get(airport.iataCode) ?? 1);
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
        // the "you have landed in…" moment. A merged dot prefers the place
        // name over a terminal code: "Varna" describes the area, "VAR"
        // describes one building inside it.
        /*
          A merged dot is a PLACE, so it takes the city's own name when
          the cluster holds one - matching the card's title. A lone
          airport borrows its city name only while no city stop is using
          it, so a split pair never shows the same word twice.
        */
        // The popping arrival always names itself; otherwise the shared
        // rule decides, so the dot and its card never disagree.
        const namer = isPopping ? airport : cluster.namer;
        const placeName =
          namer.id < 0
            ? namer.iataCode
            : namer.city && !cityStopNames.has(namer.city)
              ? namer.city
              : namer.iataCode;
        const label =
          useCityNames || isPopping || merged ? placeName : airport.iataCode;

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
            {/* An invisible fat disc as the tap target: the dot itself
                is 2-4px, unhittable with a finger. */}
            {onSelectStop && (
              <circle
                cx={x}
                cy={y}
                r={Math.max(radius * 2, getZoomAdjustedSize(11, zoom))}
                fill="transparent"
                style={{ cursor: 'pointer' }}
                onClick={(event) => {
                  // The tap belongs to the stop, not to the country
                  // beneath it or the clear-selection fallthrough. The
                  // WHOLE cluster goes: tapping one blob asks about the
                  // area, not about whichever member drew the dot.
                  event.stopPropagation();
                  onSelectStop(items);
                }}
              />
            )}
            <circle
              cx={x}
              cy={y}
              r={radius}
              fill={isHighlighted ? colors.selected : colors.airportFill}
              stroke={isHighlighted ? colors.selected : colors.airportRing}
              strokeWidth={strokeWidth * 1.5}
              pointerEvents="none"
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
