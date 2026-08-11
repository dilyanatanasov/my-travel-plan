import { memo } from 'react';
import { useMapContext, useZoomPanContext } from 'react-simple-maps';
import type { AggregatedRoute } from './routeUtils';
import { calculateArcPath, getStrokeWidth, getZoomAdjustedSize } from './routeUtils';
import { MAP } from '../../theme/mapColors';

interface FlightRoutesProps {
  routes: AggregatedRoute[];
  maxCount: number;
  hoveredRouteKey: string | null;
  onHover: (route: AggregatedRoute | null, event?: React.MouseEvent) => void;
  /** Trims line weight on small screens, where the same width covers far more map. */
  sizeScale?: number;
  /** Omit to render non-interactive routes, as the public shared map does. */
  onSelect?: (route: AggregatedRoute) => void;
  /** Routes belonging to the selected journey are dimmed here and redrawn on top. */
  dimmedRouteKeys?: Set<string>;
}

function FlightRoutes({
  routes,
  maxCount,
  hoveredRouteKey,
  onHover,
  sizeScale = 1,
  onSelect,
  dimmedRouteKeys,
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
        const baseStrokeWidth = getStrokeWidth(route.count, maxCount, sizeScale);
        const isHovered = hoveredRouteKey === route.key;
        const strokeWidth = getZoomAdjustedSize(
          isHovered ? baseStrokeWidth * 1.6 : baseStrokeWidth,
          zoom
        );
        // A selected journey redraws its own legs on top, so fade the
        // aggregate versions to stop the two fighting each other.
        const isDimmed = dimmedRouteKeys?.has(route.key) ?? false;

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
              stroke={isHovered ? MAP.routeHighlight : MAP.route}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeOpacity={isDimmed ? 0.15 : isHovered ? 1 : 0.65}
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
