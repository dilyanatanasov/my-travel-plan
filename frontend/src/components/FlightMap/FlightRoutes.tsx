import { memo, useMemo } from 'react';
import { useMapContext, useZoomPanContext } from 'react-simple-maps';
import type { AggregatedRoute } from './routeUtils';
import {
  calculateArcPath,
  getStrokeWidth,
  getZoomAdjustedSize,
  roundedPolylinePath,
  wavyPolylinePath,
} from './routeUtils';
import { useMapColors } from '../../theme/mapColors';
import {
  modeMedium,
  terrainWaypointsSync,
  type TerrainRequest,
} from '../../lib/terrainRoute';
import { useTerrainRoutes } from '../../hooks/useTerrainRoutes';

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

  /*
    Terrain-aware geometry (2026-08-18): ferries steer around coastlines,
    land modes around water. The hook re-renders this layer when the
    router answers; until then the straight chord below stands in.
  */
  const terrainRequests = useMemo<TerrainRequest[]>(
    () =>
      routes.flatMap((route) => {
        const medium = modeMedium(route.mode ?? 'flight');
        if (!medium) return [];
        return [
          {
            from: [
              Number(route.departure.longitude),
              Number(route.departure.latitude),
            ] as [number, number],
            to: [
              Number(route.arrival.longitude),
              Number(route.arrival.latitude),
            ] as [number, number],
            medium,
          },
        ];
      }),
    [routes],
  );
  useTerrainRoutes(terrainRequests);

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
        const mode = route.mode ?? 'flight';
        const isLand = mode !== 'flight';
        const isFerry = mode === 'ferry';
        let pathD = calculateArcPath(
          from as [number, number],
          to as [number, number],
          isLand ? 0 : 0.2
        );
        // Ferries follow the water, land modes the land - when the
        // terrain router has an answer, the chord becomes a rounded
        // polyline threading the coastline.
        const medium = modeMedium(mode);
        let chainPoints: [number, number][] = [
          from as [number, number],
          to as [number, number],
        ];
        if (medium) {
          const waypoints = terrainWaypointsSync(
            [Number(route.departure.longitude), Number(route.departure.latitude)],
            [Number(route.arrival.longitude), Number(route.arrival.latitude)],
            medium,
          );
          if (waypoints) {
            const projected = waypoints.map((point) => projection(point));
            if (projected.every((p): p is [number, number] => Boolean(p))) {
              pathD = roundedPolylinePath(projected);
              chainPoints = projected;
            }
          }
        }
        /*
          Trail signatures (owner ask, 2026-08-18): air solid, land
          dotted, water wavy. The wave is drawn geometry, so the ferry's
          visible line undulates while a smooth twin keeps carrying
          data-travel-mode for the video sampler - a wavy motion path
          would wobble the ship's heading.
        */
        const wavyD = isFerry
          ? wavyPolylinePath(
              chainPoints,
              getZoomAdjustedSize(1.7, zoom),
              getZoomAdjustedSize(10, zoom),
            )
          : null;
        // Trail colors by medium: terracotta air, gold ground, blue sea.
        const modeColor = isFerry
          ? colors.routeSea
          : isLand
            ? colors.routeLand
            : colors.route;
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
            {/* The smooth path always exists: hidden under a wavy ferry
                trail, it stays the honest track the video sampler reads. */}
            <path
              d={pathD}
              fill="none"
              data-travel-mode={route.mode ?? 'flight'}
              stroke={isHovered ? colors.routeHighlight : modeColor}
              strokeWidth={wavyD ? 0 : strokeWidth}
              strokeLinecap="round"
              strokeDasharray={
                isLand && !isFerry
                  ? `0.1 ${getZoomAdjustedSize(4.5, zoom)}`
                  : undefined
              }
              strokeOpacity={wavyD ? 0 : faded ? 0.1 : isHovered ? 1 : 0.65}
              pointerEvents="none"
              style={{
                transition:
                  'stroke 0.15s, stroke-width 0.15s, stroke-opacity 0.15s',
              }}
            />
            {wavyD && (
              <path
                d={wavyD}
                data-decorative="true"
                fill="none"
                stroke={isHovered ? colors.routeHighlight : modeColor}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeOpacity={faded ? 0.1 : isHovered ? 1 : 0.65}
                pointerEvents="none"
                style={{
                  transition:
                    'stroke 0.15s, stroke-width 0.15s, stroke-opacity 0.15s',
                }}
              />
            )}
          </g>
        );
      })}
    </g>
  );
}

export default memo(FlightRoutes);
