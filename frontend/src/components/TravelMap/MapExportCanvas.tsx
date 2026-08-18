import { useEffect, useMemo, useState } from 'react';
import { ComposableMap, ZoomableGroup } from 'react-simple-maps';
import type { FlightJourney } from '../../types';
import {
  useGetVisitsQuery,
  useGetCountriesQuery,
} from '../../features/visits/visitsApi';
import { useGetFlightsQuery } from '../../features/flights/flightsApi';
import type { Alpha3 } from '../../types';
import type { CountryDisplayInfo } from './countryColors';
import {
  aggregateRoutes,
  extractUniqueAirports,
  countAirportVisits,
  legEndpoints,
  legFramingPoints,
  legMode,
} from '../FlightMap/routeUtils';
import { modeMedium, type TerrainRequest } from '../../lib/terrainRoute';
import { useTerrainRoutes } from '../../hooks/useTerrainRoutes';
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
  /**
   * Frame ONE leg instead of the whole journey (animated video camera,
   * 2026-08-18): the video captures a scene per leg, so a 35 km drive
   * gets its own sharp close-up instead of a speck on the continental
   * frame. 1-based legOrder; null/undefined frames the whole journey.
   */
  focusLegOrder?: number | null;
  /** Distinct id so a trip canvas cannot collide with the map-card one. */
  svgId?: string;
}

function MapExportCanvas({
  theme,
  height = EXPORT_HEIGHT,
  journey,
  focusLegOrder,
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
      <MapExportCanvasInner
        height={height}
        journey={journey}
        focusLegOrder={focusLegOrder}
        svgId={svgId}
      />
    </ThemeContext.Provider>
  );
}

function MapExportCanvasInner({
  height,
  journey,
  focusLegOrder,
  svgId,
}: {
  height: number;
  journey?: FlightJourney;
  focusLegOrder?: number | null;
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

  const { data: countries = [] } = useGetCountriesQuery();

  const fullDisplayMap = useMemo(
    () => buildCountryDisplayMap(visits),
    [visits]
  );

  /*
    Trip mode highlights the countries this journey touches (user request,
    2026-08-14) — the rest stay plain land, so the trip reads as the story
    against a quiet world. Airports carry alpha-2; the map keys on alpha-3,
    same join the replay orchestration does.
  */
  const countryDisplayMap = useMemo(() => {
    if (!journey) return fullDisplayMap;
    const alpha2ToAlpha3 = new Map(
      countries.map((c) => [c.isoCode2, c.isoCode]),
    );
    const map = new Map<string, CountryDisplayInfo>();
    for (const leg of journey.legs ?? []) {
      // legEndpoints, not raw airports: a train or drive ends in a CITY,
      // and reading airports alone left land-visited countries unpainted
      // on the shared trip (owner report, 2026-08-18).
      const endpoints = legEndpoints(leg);
      if (!endpoints) continue;
      for (const place of [endpoints.departure, endpoints.arrival]) {
        const iso3 = place.countryIso
          ? alpha2ToAlpha3.get(place.countryIso)
          : undefined;
        if (!iso3 || map.has(iso3)) continue;
        map.set(iso3, {
          isoCode: iso3 as Alpha3,
          visitType: 'trip',
          isHome: false,
          hasFlights: true,
          visit: null,
        });
      }
    }
    return map;
  }, [journey, fullDisplayMap, countries]);
  /*
    Journey mode keeps one DIRECTED route per leg, in leg order.
    Aggregation is direction-agnostic - built so an out-and-back draws as
    one thicker line - which collapsed Burgas→London→Burgas to a single
    path and the trip video flew only half the trip, backwards (owner
    report, 2026-08-17). The video samples these paths in DOM order, so
    leg order here IS the flight plan.
  */
  const routes = useMemo(() => {
    if (journey) {
      return [...(journey.legs ?? [])]
        .sort((a, b) => a.legOrder - b.legOrder)
        .flatMap((leg, index) => {
          const endpoints = legEndpoints(leg);
          if (!endpoints) return [];
          return [
            {
              key: `leg-${leg.id ?? index}`,
              departure: endpoints.departure,
              arrival: endpoints.arrival,
              count: 1,
              totalDistance: Number(leg.distanceKm) || 0,
              flights: [journey],
              mode: legMode(leg),
            },
          ];
        });
    }
    return aggregateRoutes(shownFlights);
  }, [journey, shownFlights]);
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
  const hasCountries = !journey && countryDisplayMap.size > 0;

  /*
    The framing must know the terrain routes (owner report, 2026-08-18):
    fitting endpoints alone cropped the ferry's detour around the cape
    out of the share. The hook re-renders when the router answers, and
    legFramingPoints folds the waypoints into every fit below.
  */
  const terrainRequests = useMemo<TerrainRequest[]>(() => {
    if (!journey) return [];
    return (journey.legs ?? []).flatMap((leg) => {
      const medium = modeMedium(legMode(leg));
      const endpoints = legEndpoints(leg);
      if (!medium || !endpoints) return [];
      return [
        {
          from: [
            Number(endpoints.departure.longitude),
            Number(endpoints.departure.latitude),
          ] as [number, number],
          to: [
            Number(endpoints.arrival.longitude),
            Number(endpoints.arrival.latitude),
          ] as [number, number],
          medium,
        },
      ];
    });
  }, [journey]);
  const terrainVersion = useTerrainRoutes(terrainRequests);

  const framing = useMemo(() => {
    // Scene capture: one leg fills the frame - endpoints plus its
    // terrain waypoints, so a routed detour stays inside the shot.
    if (journey && focusLegOrder != null) {
      const leg = (journey.legs ?? []).find(
        (l) => l.legOrder === focusLegOrder,
      );
      const scenePoints = leg ? legFramingPoints(leg) : [];
      if (scenePoints.length > 0) {
        return fitToPoints(scenePoints as LonLat[], { maxZoom: 48, fill: 0.6 });
      }
    }
    const points: LonLat[] = journey
      ? (journey.legs ?? []).flatMap((leg) => legFramingPoints(leg) as LonLat[])
      : airports.map((a) => [a.longitude, a.latitude]);
    if (!journey) {
      for (const [iso, info] of countryDisplayMap) {
        if (info.visitType === 'transit') continue;
        const centroid = countryCentroids.get(iso);
        if (centroid) points.push(centroid);
      }
    }
    // A single trip affords a closer camera than the whole life map.
    // The trip cap is rendering sanity, not framing policy: the fitter
    // derives zoom from the trip's own span, so flights sit at their
    // usual 2-5 while a short drive zooms until its line fills the
    // boarding-pass strip. 48 keeps 50m coastlines this side of mush.
    return journey
      ? fitToPoints(points, { maxZoom: 48, fill: 0.72 })
      : fitToPoints(points, { maxZoom: 3.2, fill: 0.82 });
    // terrainVersion: resolved waypoints change what must stay in frame.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    airports,
    countryDisplayMap,
    countryCentroids,
    journey,
    focusLegOrder,
    terrainVersion,
  ]);

  /*
    ZoomableGroup applies zoom/center when the props CHANGE, not on mount.
    The map card always framed late (centroids arrive → change); trip mode
    computed its framing on the first render, so the group never moved and
    the card showed an untransformed world (Rome–Varna bug, 2026-08-14).
    Routing the framing through post-mount state makes it a change in both
    modes, and readiness waits two rAFs past its application.
  */
  const [appliedFraming, setAppliedFraming] = useState<typeof framing>(null);
  const [transformSettled, setTransformSettled] = useState(false);
  useEffect(() => {
    if (!framing) return;
    setAppliedFraming(framing);
    setTransformSettled(false);
    let inner: number | null = null;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setTransformSettled(true));
    });
    return () => {
      cancelAnimationFrame(outer);
      if (inner !== null) cancelAnimationFrame(inner);
    };
  }, [framing]);

  const centroidsSettled =
    (!hasCountries || countryCentroids.size > 0) &&
    (framing === null || (appliedFraming === framing && transformSettled));

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
            /* In trip mode this map holds only the trip's countries. */
            countryDisplayMap={countryDisplayMap}
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
              /*
                A journey export labels its airports with IATA codes -
                enough to say where the plane goes. City names were tried
                (labelZoom 8) and read as smudge at card scale ("not very
                visible, maybe remove"), so the zoom sits between the two
                thresholds: codes yes, city names no. The whole-map export
                keeps its quiet dots.
              */
              labelZoom={journey ? 3 : undefined}
            />
          )}
        </ZoomableGroup>
      </ComposableMap>
    </div>
  );
}

export default MapExportCanvas;
