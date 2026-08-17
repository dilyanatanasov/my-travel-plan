import { memo } from 'react';
import { useMapContext, useZoomPanContext } from 'react-simple-maps';
import type { AggregatedRoute } from './routeUtils';
import { calculateArcPath, getStrokeWidth, getZoomAdjustedSize } from './routeUtils';
import { useMapColors } from '../../theme/mapColors';

interface FlightRoutesProps {
  routes: AggregatedRoute[];
  maxCount: number;
  hoveredRouteKey: string | null;
  onHover: (route: AggregatedRoute | null, event?: React.MouseEvent) => void;
  /** Trims line weight on small screens, where the same width covers far more map. */
  sizeScale?: number;
  /** Omit to render non-interactive routes, as the public shared map does. */
  onSelect?: (route: AggregatedRoute) => void;
  /**
   * When a journey is selected the other routes fade almost to nothing so the
   * selection stands alone — but they stay clickable, so switching to another
   * journey is one tap rather than "clear, then click again".
   */
  faded?: boolean;
}

function FlightRoutes({
  routes,
  maxCount,
  hoveredRouteKey,
  onHover,
  sizeScale = 1,
  onSelect,
  faded = false,
}: FlightRoutesProps) {
  const { map: colors } = useMapColors();
  const { projection } = useMapContext();
  const { k: zoom } = useZoomPanContext();

  return (
    <g className="flight-routes">
      {routes.map((route) => {
        const from = projection([
          route.departure.longitude,
          route.departure.latitude,
        ]);
        const to = projection([route.arrival.longitude, route.arrival.latitude]);

        // Skip if projection fails
        if (!from || !to) return null;

        // Land routes are straight dashed chords - things on the ground
        // do not bow through the sky, and the dash is the overland
        // signature everywhere (highlight, export video, shared map).
        const isLand = (route.mode ?? 'flight') !== 'flight';
        const pathD = calculateArcPath(
          from as [number, number],
          to as [number, number],
          isLand ? 0 : 0.2
        );
        const baseStrokeWidth = getStrokeWidth(route.count, maxCount, sizeScale);
        const isHovered = hoveredRouteKey === route.key;
        const strokeWidth = getZoomAdjustedSize(
          isHovered ? baseStrokeWidth * 1.6 : baseStrokeWidth,
          zoom
        );

        return (
          <g key={route.key}>
            {/*
              Invisible fat stroke purely as a hit target. The visible line is
              1–2px, which is unhittable with a finger and fiddly with a mouse.
            */}
            <path
              d={pathD}
              fill="none"
              stroke="transparent"
              strokeWidth={getZoomAdjustedSize(22, zoom)}
              strokeLinecap="round"
              style={{ cursor: onSelect ? 'pointer' : 'default' }}
              onMouseEnter={(e) => onHover(route, e)}
              onMouseLeave={() => onHover(null)}
              onClick={() => onSelect?.(route)}
            />
            <path
              d={pathD}
              fill="none"
              data-travel-mode={route.mode ?? 'flight'}
              stroke={isHovered ? colors.routeHighlight : colors.route}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={
                isLand
                  ? `${getZoomAdjustedSize(5, zoom)} ${getZoomAdjustedSize(4, zoom)}`
                  : undefined
              }
              strokeOpacity={faded ? 0.1 : isHovered ? 1 : 0.65}
              pointerEvents="none"
              style={{
                transition:
                  'stroke 0.15s, stroke-width 0.15s, stroke-opacity 0.15s',
              }}
            />
          </g>
        );
      })}
    </g>
  );
}

export default memo(FlightRoutes);
