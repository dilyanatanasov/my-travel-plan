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
import { useMapViewport } from './useMapViewport';
import { MAP } from '../../theme/mapColors';
import { buildCountryDisplayMap } from './countryColors';
import CountriesLayer from './CountriesLayer';
import type { AggregatedRoute } from '../FlightMap/routeUtils';


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

  // On touch devices the map starts inert so a thumb-drag scrolls the page
  // instead of panning the map. Tapping the scrim arms it.
  const { scale, width, height, isCoarsePointer } = useMapViewport();
  const [isTouchActivated, setIsTouchActivated] = useState(false);

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
      className="bg-white rounded-lg shadow-md overflow-hidden relative"
      onMouseMove={handleMouseMove}
    >
      {/* Layers, filters and legend, collapsed into one panel */}
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
        stats={stats}
      />

      {/* Map */}
      <div className="relative">
        {/* Aspect ratios here must stay in step with MOBILE/DESKTOP in
            useMapViewport, or preserveAspectRatio letterboxes the map. */}
        <ComposableMap
          width={width}
          height={height}
          projectionConfig={{
            rotate: [-10, 0, 0],
            scale,
          }}
          // h-auto is required: the svg carries a height attribute from the
          // width/height props, and CSS aspect-ratio is ignored unless the
          // used height is auto.
          className="w-full h-auto aspect-[4/3] md:aspect-[2/1]"
        >
        <ZoomableGroup>
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
          Touch scroll-trap guard. d3-zoom inside ZoomableGroup swallows touch
          drags, so a full-width map mid-page becomes impossible to scroll past.
          The scrim intercepts the first touch and hands control over only once
          the user has asked for it.
        */}
        {isCoarsePointer && !isTouchActivated && (
          <button
            type="button"
            onClick={() => setIsTouchActivated(true)}
            className="absolute inset-0 z-10 flex items-end justify-center pb-6 bg-transparent"
            aria-label="Activate map interaction"
          >
            <span className="px-3 py-2 rounded-full bg-gray-900/75 text-white text-xs font-medium shadow-lg">
              Tap to interact with map
            </span>
          </button>
        )}
      </div>

      {/* Route Tooltip */}
      <RouteTooltip route={hoveredRoute} position={tooltipPosition} />
    </div>
  );
}

export default memo(TravelMap);
