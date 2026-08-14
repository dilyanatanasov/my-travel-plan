import { useEffect, useMemo, useState } from 'react';
import { ComposableMap, ZoomableGroup } from 'react-simple-maps';
import type { FlightJourney } from '../../types';
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
import { fitToPoints, type LonLat } from './fitBounds';
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
  /**
   * Canvas height (2026-08-14): the consumer matches this to the aspect of
   * the slot the map will occupy. A 2:1 world strip contained into the
   * Warm/Ink cards' near-square block shrank to less than half the block and
   * left empty band above and below — the "small map with gaps". Rendering
   * at the slot's own aspect makes contain a no-op. fitToPoints' lat span
   * assumes a 2:1 view, which on a taller canvas is conservative — the frame
   * can only be a little wider than optimal, never cropped.
   */
  height?: number;
  /**
   * Trip mode (2026-08-14): draw only this journey — its route, its
   * airports, plain land underneath (the trip is the highlight, not the
   * visit colours) — framed on its own legs.
   */
  journey?: FlightJourney;
  /** Distinct id so a trip canvas cannot collide with the map-card one. */
  svgId?: string;
}

function MapExportCanvas({
  theme,
  height = EXPORT_HEIGHT,
  journey,
  svgId,
}: MapExportCanvasProps) {
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
      <MapExportCanvasInner height={height} journey={journey} svgId={svgId} />
    </ThemeContext.Provider>
  );
}

function MapExportCanvasInner({
  height,
  journey,
  svgId,
}: {
  height: number;
  journey?: FlightJourney;
  svgId?: string;
}) {
  const { map: colors } = useMapColors();
  const { data: visits = [] } = useGetVisitsQuery();
  const { data: flights = [] } = useGetFlightsQuery();

  // Trip mode narrows every layer to the one journey.
  const shownFlights = useMemo(
    () => (journey ? [journey] : flights),
    [journey, flights],
  );

  const countryDisplayMap = useMemo(
    () => buildCountryDisplayMap(visits),
    [visits]
  );
  const routes = useMemo(() => aggregateRoutes(shownFlights), [shownFlights]);
  const airports = useMemo(
    () => extractUniqueAirports(shownFlights),
    [shownFlights],
  );
  const airportVisitCounts = useMemo(
    () => countAirportVisits(shownFlights),
    [shownFlights],
  );
  const maxRouteCount = Math.max(...routes.map((r) => r.count), 1);

  /*
    Frame the card on where the user has been, exactly as the live map does.
    A shared image of the whole globe with three dots over Belgium says far
    less than one framed on the trip.

    fill is tighter than the live map's: the card has no floating controls to
    dodge, so the geography can run closer to the edges.
  */
  const [countryCentroids, setCountryCentroids] = useState<Map<string, LonLat>>(
    new Map(),
  );
  // Trip mode frames on the journey's own airports, so it never waits for
  // centroids. It must still wait for ZoomableGroup to APPLY that framing:
  // reporting ready on the mount render let the serializer catch frame zero
  // — an untransformed world of plain outlines instead of the trip
  // (Rome–Varna bug, 2026-08-14). Two rAFs span the transform's effect.
  const [transformSettled, setTransformSettled] = useState(false);
  useEffect(() => {
    let inner: number | null = null;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setTransformSettled(true));
    });
    return () => {
      cancelAnimationFrame(outer);
      if (inner !== null) cancelAnimationFrame(inner);
    };
  }, []);
  const hasCountries = !journey && countryDisplayMap.size > 0;
  const centroidsSettled =
    (!hasCountries || countryCentroids.size > 0) && transformSettled;

  const framing = useMemo(() => {
    const points: LonLat[] = airports.map((a) => [a.longitude, a.latitude]);
    if (!journey) {
      for (const [iso, info] of countryDisplayMap) {
        if (info.visitType === 'transit') continue;
        const centroid = countryCentroids.get(iso);
        if (centroid) points.push(centroid);
      }
    }
    // A single trip affords a closer camera than the whole life map.
    return journey
      ? fitToPoints(points, { maxZoom: 5, fill: 0.72 })
      : fitToPoints(points, { maxZoom: 3.2, fill: 0.82 });
  }, [airports, countryDisplayMap, countryCentroids, journey]);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed top-0 -left-[20000px]"
      style={{ width: EXPORT_WIDTH, height }}
    >
      <ComposableMap
        id={svgId ?? EXPORT_SVG_ID}
        width={EXPORT_WIDTH}
        height={height}
        projectionConfig={{ rotate: [-10, 0, 0], scale: EXPORT_SCALE }}
        data-framed={centroidsSettled ? '1' : '0'}
        style={{ width: EXPORT_WIDTH, height }}
      >
        <ZoomableGroup
          zoom={framing?.zoom ?? 1}
          center={framing?.center ?? [0, 0]}
        >
          <rect
            x={-EXPORT_WIDTH}
            y={-height}
            width={EXPORT_WIDTH * 3}
            height={height * 3}
            fill={colors.ocean}
          />
          <CountriesLayer
            countryDisplayMap={countryDisplayMap}
            /* Trip mode: plain land — the route is the story. */
            showVisitColors={!journey}
            onCentroids={setCountryCentroids}
            /*
              Borders scale with the map here, unlike the live views. This SVG
              is serialised, rasterised at its own size and then upscaled into
              a 1080-wide card, so a stroke pinned to device pixels would come
              out a hairline nobody can see.
            */
            constantBorderWidth={false}
          />
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
