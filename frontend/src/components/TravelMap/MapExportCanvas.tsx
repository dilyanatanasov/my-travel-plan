import { useMemo } from 'react';
import { ComposableMap, ZoomableGroup } from 'react-simple-maps';
import { useGetVisitsQuery } from '../../features/visits/visitsApi';
import { useGetFlightsQuery } from '../../features/flights/flightsApi';
import {
  aggregateRoutes,
  extractUniqueAirports,
  countAirportVisits,
} from '../FlightMap/routeUtils';
import FlightRoutes from '../FlightMap/FlightRoutes';
import AirportMarkers from '../FlightMap/AirportMarkers';
import CountriesLayer from './CountriesLayer';
import { buildCountryDisplayMap } from './countryColors';
import { useMapColors } from '../../theme/mapColors';
import { ThemeContext, useTheme } from '../../features/theme/ThemeContext';
import type { ResolvedTheme } from '../../features/theme/ThemeContext';

export const EXPORT_WIDTH = 1600;
export const EXPORT_HEIGHT = 800;
export const EXPORT_SVG_ID = 'map-export-canvas';

// Fit the whole world to the export width: 2π·scale is the world's width.
const EXPORT_SCALE = (EXPORT_WIDTH * 0.98) / (2 * Math.PI);

/**
 * An off-screen 2:1 world map, rendered solely to be exported as an image.
 *
 * The on-screen map deliberately *covers* its container — it overflows and
 * crops so it fills the canvas rather than floating in ocean. Serialising
 * that produced a cropped export. This renders the same layers at a fixed
 * aspect with zoom 1 and the whole world in frame, so a shared image is
 * always complete regardless of how the user has panned or zoomed.
 *
 * Positioned off-screen rather than `display: none`: a hidden element has no
 * layout box, and the SVG needs real dimensions to serialise.
 */
interface MapExportCanvasProps {
  /**
   * Pin the map's colours regardless of the app's theme.
   *
   * The share card's style decides this, not the user's theme: the Ink card
   * is dark, and drawing a cream map inside it looks like a pasted screenshot
   * from a different app.
   */
  theme?: ResolvedTheme;
}

function MapExportCanvas({ theme }: MapExportCanvasProps) {
  const outer = useTheme();

  /*
    The provider is always rendered, even when the theme already matches.
    Branching between a wrapped and an unwrapped child changes the element
    type at that position, so React unmounts and rebuilds the whole map —
    which threw away the loaded geography every time the card style changed,
    and left the render polling a detached SVG until it timed out.
  */
  return (
    <ThemeContext.Provider
      value={{ ...outer, resolved: theme ?? outer.resolved }}
    >
      <MapExportCanvasInner />
    </ThemeContext.Provider>
  );
}

function MapExportCanvasInner() {
  const { map: colors } = useMapColors();
  const { data: visits = [] } = useGetVisitsQuery();
  const { data: flights = [] } = useGetFlightsQuery();

  const countryDisplayMap = useMemo(
    () => buildCountryDisplayMap(visits),
    [visits]
  );
  const routes = useMemo(() => aggregateRoutes(flights), [flights]);
  const airports = useMemo(() => extractUniqueAirports(flights), [flights]);
  const airportVisitCounts = useMemo(() => countAirportVisits(flights), [flights]);
  const maxRouteCount = Math.max(...routes.map((r) => r.count), 1);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed top-0 -left-[20000px]"
      style={{ width: EXPORT_WIDTH, height: EXPORT_HEIGHT }}
    >
      <ComposableMap
        id={EXPORT_SVG_ID}
        width={EXPORT_WIDTH}
        height={EXPORT_HEIGHT}
        projectionConfig={{ rotate: [-10, 0, 0], scale: EXPORT_SCALE }}
        style={{ width: EXPORT_WIDTH, height: EXPORT_HEIGHT }}
      >
        <ZoomableGroup zoom={1} center={[0, 0]}>
          <rect
            x={-EXPORT_WIDTH}
            y={-EXPORT_HEIGHT}
            width={EXPORT_WIDTH * 3}
            height={EXPORT_HEIGHT * 3}
            fill={colors.ocean}
          />
          <CountriesLayer countryDisplayMap={countryDisplayMap} />
          {routes.length > 0 && (
            <FlightRoutes
              routes={routes}
              maxCount={maxRouteCount}
              hoveredRouteKey={null}
              onHover={() => undefined}
            />
          )}
          {airports.length > 0 && (
            <AirportMarkers
              airports={airports}
              visitCounts={airportVisitCounts}
              highlightedAirports={[]}
            />
          )}
        </ZoomableGroup>
      </ComposableMap>
    </div>
  );
}

export default MapExportCanvas;
