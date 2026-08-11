import { memo, useState, useCallback, useMemo } from 'react';
import { ComposableMap, ZoomableGroup } from 'react-simple-maps';
import {
  useGetVisitsQuery,
  useGetCountriesQuery,
  useSetHomeCountryMutation,
} from '../../features/visits/visitsApi';
import { useVisitActions } from '../../features/visits/useVisitActions';
import { useToast } from '../Toast/ToastProvider';
import type { Visit } from '../../types';
import { useGetFlightsQuery } from '../../features/flights/flightsApi';
import { aggregateRoutes, extractUniqueAirports, countAirportVisits } from '../FlightMap/routeUtils';
import { applyFilters, extractFilterOptions } from '../FlightMap/filterUtils';
import { DEFAULT_FILTERS, type FlightFilters } from '../FlightMap/filterTypes';
import FlightRoutes from '../FlightMap/FlightRoutes';
import AirportMarkers from '../FlightMap/AirportMarkers';
import RouteTooltip from '../FlightMap/RouteTooltip';
import MapControlPanel, { type TravelMapSettings } from './MapControlPanel';
import MapZoomControls from './MapZoomControls';
import MapLegend from './MapLegend';
import { useMapViewport } from './useMapViewport';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { MAP } from '../../theme/mapColors';
import { buildCountryDisplayMap } from './countryColors';
import CountriesLayer from './CountriesLayer';
import type { AggregatedRoute } from '../FlightMap/routeUtils';


const MIN_ZOOM = 1;
const MAX_ZOOM = 8;

const DEFAULT_SETTINGS: TravelMapSettings = {
  showCountries: true,
  showFlights: true,
  showAirports: true,
};

function TravelMap() {
  // Data queries
  const { data: visits = [] } = useGetVisitsQuery();
  const { data: countries = [] } = useGetCountriesQuery();
  const { data: flights = [] } = useGetFlightsQuery();

  // Mutations
  const [setHomeCountry] = useSetHomeCountryMutation();
  const { addVisitForCountry, removeVisitWithUndo } = useVisitActions();
  const { showToast } = useToast();

  // State
  const [settings, setSettings] = useState<TravelMapSettings>(DEFAULT_SETTINGS);
  const [filters, setFilters] = useState<FlightFilters>(DEFAULT_FILTERS);
  const [hoveredRoute, setHoveredRoute] = useState<AggregatedRoute | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

  // Collapsed by default: this is a card floating over the map, so opening it
  // by default would cover the thing the user came to look at.
  const [isControlPanelOpen, setIsControlPanelOpen] = useState(false);

  // The legend and zoom buttons share the canvas with the control panel. They
  // only need to yield when the viewport is too short for both to fit.
  const hasVerticalRoom = useMediaQuery('(min-height: 700px)');
  const showCornerControls = !isControlPanelOpen || hasVerticalRoom;

  // The map fills whatever the shell leaves it, so the viewBox follows the
  // measured container rather than a breakpoint preset.
  const { ref: containerRef, viewport } = useMapViewport<HTMLDivElement>();
  const { width, height, scale } = viewport;

  // Zoom is controlled so the +/- buttons and d3's own gestures stay in sync.
  const [zoom, setZoom] = useState(1);
  // Start slightly west of centre so the landmass sits right of the controls
  // pinned to the top-left. Longitude only: the map always overflows
  // horizontally (see useMapViewport), so panning sideways never exposes an
  // edge, whereas a vertical offset would open a gap on a portrait canvas.
  const [center, setCenter] = useState<[number, number]>([-12, 0]);

  const handleMoveEnd = useCallback(
    (position: { coordinates: [number, number]; zoom: number }) => {
      setZoom(position.zoom);
      setCenter(position.coordinates);
    },
    []
  );

  const handleResetView = useCallback(() => {
    setZoom(1);
    setCenter([0, 0]);
  }, []);

  // Build country display map from visits
  const countryDisplayMap = useMemo(() => buildCountryDisplayMap(visits), [visits]);

  // Find home country
  const homeVisit = useMemo(
    () => visits.find((v) => v.visitType === 'home'),
    [visits]
  );

  // Build lookup maps
  const countryByIsoCode = useMemo(() => {
    const map = new Map<string, number>();
    countries.forEach((c) => {
      map.set(c.isoCode, c.id);
    });
    return map;
  }, [countries]);

  // Keyed by country so a removal can be undone with the full record — the
  // date, notes and visit type would otherwise be lost on a single mis-tap.
  const visitByCountryId = useMemo(() => {
    const map = new Map<number, Visit>();
    visits.forEach((v) => {
      map.set(v.countryId, v);
    });
    return map;
  }, [visits]);

  // Flight data with filters
  const filterOptions = useMemo(() => extractFilterOptions(flights), [flights]);
  const filteredFlights = useMemo(
    () => applyFilters(flights, filters),
    [flights, filters]
  );
  const routes = useMemo(() => aggregateRoutes(filteredFlights), [filteredFlights]);
  const airports = useMemo(
    () => extractUniqueAirports(filteredFlights),
    [filteredFlights]
  );
  const airportVisitCounts = useMemo(
    () => countAirportVisits(filteredFlights),
    [filteredFlights]
  );
  const maxRouteCount = Math.max(...routes.map((r) => r.count), 1);

  // Stats
  const stats = useMemo(() => {
    const visitedCount = visits.filter((v) => {
      // Default to 'trip' for existing records without visitType
      const type = v.visitType || 'trip';
      return type === 'trip' || type === 'home';
    }).length;
    const transitCount = visits.filter((v) => v.visitType === 'transit').length;
    return {
      visitedCount,
      transitCount,
      totalCountries: countries.length,
      flightRoutes: routes.length,
      airports: airports.length,
    };
  }, [visits, countries, routes, airports]);

  // Handlers
  const handleCountryClick = useCallback(
    async (isoCode: string) => {
      const countryId = countryByIsoCode.get(isoCode);
      if (!countryId) return;

      const existingVisit = visitByCountryId.get(countryId);
      if (existingVisit) {
        await removeVisitWithUndo(existingVisit);
      } else {
        await addVisitForCountry(countryId);
      }
    },
    [countryByIsoCode, visitByCountryId, addVisitForCountry, removeVisitWithUndo]
  );

  const handleSetHomeCountry = useCallback(
    async (countryId: number) => {
      try {
        await setHomeCountry(countryId).unwrap();
      } catch {
        showToast('Could not set your home country', { tone: 'error' });
      }
    },
    [setHomeCountry, showToast]
  );

  const handleRouteHover = useCallback(
    (route: AggregatedRoute | null, event?: React.MouseEvent) => {
      setHoveredRoute(route);
      if (event && route) {
        setTooltipPosition({ x: event.clientX, y: event.clientY });
      }
    },
    []
  );

  const handleMouseMove = useCallback(
    (event: React.MouseEvent) => {
      if (hoveredRoute) {
        setTooltipPosition({ x: event.clientX, y: event.clientY });
      }
    },
    [hoveredRoute]
  );

  // Highlighted airports when hovering a route
  const highlightedAirports = hoveredRoute
    ? [hoveredRoute.departure.iataCode, hoveredRoute.arrival.iataCode]
    : [];

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden bg-map-ocean"
      onMouseMove={handleMouseMove}
    >
      {/* Map fills the canvas; chrome floats over it. */}
      <ComposableMap
        width={width}
        height={height}
        projectionConfig={{
          rotate: [-10, 0, 0],
          scale,
        }}
        className="w-full h-full"
      >
        <ZoomableGroup
          zoom={zoom}
          center={center}
          minZoom={MIN_ZOOM}
          maxZoom={MAX_ZOOM}
          onMoveEnd={handleMoveEnd}
        >
          {/*
            Explicit ocean. Without it the sea shows the white card through,
            so page, sea and unvisited land were three near-identical greys
            and the map had no ground to sit on.
          */}
          <rect
            x={-width * 2}
            y={-height * 2}
            width={width * 5}
            height={height * 5}
            fill={MAP.ocean}
          />

          {/* Countries */}
          <CountriesLayer
            countryDisplayMap={countryDisplayMap}
            showVisitColors={settings.showCountries}
            onCountryClick={handleCountryClick}
          />

          {/* Flight Routes */}
          {settings.showFlights && (
            <FlightRoutes
              routes={routes}
              maxCount={maxRouteCount}
              hoveredRouteKey={hoveredRoute?.key || null}
              onHover={handleRouteHover}
            />
          )}

          {/* Airport Markers */}
          {settings.showAirports && settings.showFlights && (
            <AirportMarkers
              airports={airports}
              visitCounts={airportVisitCounts}
              highlightedAirports={highlightedAirports}
            />
          )}
        </ZoomableGroup>
      </ComposableMap>

      {/*
        No tap-to-activate scrim any more. It existed because a full-width map
        inside a scrolling document swallowed touch drags and wheel events. The
        shell no longer scrolls, so there is nothing for the map to steal and
        pan/zoom can just work.
      */}

      {/* Layers, filters and legend, floating over the canvas */}
      {/* No scrolling here: the panel caps and scrolls its own content, so the
          header stays pinned instead of scrolling away with it. */}
      <div className="absolute top-3 left-3 right-3 md:right-auto md:w-[30rem] z-30">
        <MapControlPanel
          settings={settings}
          onSettingsChange={setSettings}
          countries={countries}
          homeCountryId={homeVisit?.countryId || null}
          onSetHomeCountry={handleSetHomeCountry}
          filters={filters}
          onFiltersChange={setFilters}
          airports={filterOptions.airports}
          years={filterOptions.years}
          isOpen={isControlPanelOpen}
          onOpenChange={setIsControlPanelOpen}
        />
      </div>

      {/*
        The panel caps its own height, so on a normal phone it clears the
        legend and zoom buttons and all three can coexist. Only on genuinely
        short viewports — a landscape phone, where the canvas is ~280px — is
        there not enough room, and there the corner controls yield.
      */}
      {showCornerControls && (
        <>
          <MapLegend showFlights={settings.showFlights} stats={stats} />

      <MapZoomControls
        zoom={zoom}
        minZoom={MIN_ZOOM}
        maxZoom={MAX_ZOOM}
        onZoomIn={() => setZoom((z) => Math.min(z * 1.5, MAX_ZOOM))}
        onZoomOut={() => setZoom((z) => Math.max(z / 1.5, MIN_ZOOM))}
            onReset={handleResetView}
          />
        </>
      )}

      {/* Route Tooltip */}
      <RouteTooltip route={hoveredRoute} position={tooltipPosition} />
    </div>
  );
}

export default memo(TravelMap);
