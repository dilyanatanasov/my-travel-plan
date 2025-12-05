import { memo } from 'react';
import { useMapContext, useZoomPanContext } from 'react-simple-maps';
import type { AggregatedRoute } from './routeUtils';
import { calculateArcPath, getStrokeWidth, getZoomAdjustedSize } from './routeUtils';

interface FlightRoutesProps {
  routes: AggregatedRoute[];
  maxCount: number;
  hoveredRouteKey: string | null;
  onHover: (route: AggregatedRoute | null, event?: React.MouseEvent) => void;
}

function FlightRoutes({
  routes,
  maxCount,
  hoveredRouteKey,
  onHover,
}: FlightRoutesProps) {
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

        const pathD = calculateArcPath(
          from as [number, number],
          to as [number, number]
        );
        const baseStrokeWidth = getStrokeWidth(route.count, maxCount);
        const isHovered = hoveredRouteKey === route.key;
        const strokeWidth = getZoomAdjustedSize(
          isHovered ? baseStrokeWidth + 1 : baseStrokeWidth,
          zoom
        );

        return (
          <path
            key={route.key}
            d={pathD}
            fill="none"
            stroke={isHovered ? '#1d4ed8' : '#3b82f6'}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeOpacity={isHovered ? 1 : 0.7}
            style={{
              cursor: 'pointer',
              transition: 'stroke 0.15s, stroke-width 0.15s, stroke-opacity 0.15s',
            }}
            onMouseEnter={(e) => onHover(route, e)}
            onMouseLeave={() => onHover(null)}
          />
        );
      })}
    </g>
  );
}

export default memo(FlightRoutes);
