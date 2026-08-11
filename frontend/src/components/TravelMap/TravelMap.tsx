import { memo, useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { ComposableMap, ZoomableGroup } from 'react-simple-maps';
import {
  useGetVisitsQuery,
  useGetCountriesQuery,
  useSetHomeCountryMutation,
} from '../../features/visits/visitsApi';
import { useVisitActions } from '../../features/visits/useVisitActions';
import { useToast } from '../Toast/ToastProvider';
import type { Visit, FlightJourney } from '../../types';
import { useGetFlightsQuery } from '../../features/flights/flightsApi';
import { aggregateRoutes, extractUniqueAirports, countAirportVisits } from '../FlightMap/routeUtils';
import { applyFilters, extractFilterOptions } from '../FlightMap/filterUtils';
import { DEFAULT_FILTERS, type FlightFilters } from '../FlightMap/filterTypes';
import FlightRoutes from '../FlightMap/FlightRoutes';
import AirportMarkers from '../FlightMap/AirportMarkers';
import RouteTooltip from '../FlightMap/RouteTooltip';
import JourneyHighlight from '../FlightMap/JourneyHighlight';
import SelectedJourneyCard from './SelectedJourneyCard';
import MapControlPanel, { type TravelMapSettings } from './MapControlPanel';
import MapZoomControls from './MapZoomControls';
import MapLegend from './MapLegend';
import { useMapViewport } from './useMapViewport';
import { useMapFocus } from '../../features/map/MapFocusContext';
import { useMapColors } from '../../theme/mapColors';
import { buildCountryDisplayMap } from './countryColors';
import CountriesLayer from './CountriesLayer';
import type { AggregatedRoute } from '../FlightMap/routeUtils';


const MIN_ZOOM = 1;
const MAX_ZOOM = 8;

/**
 * Slightly west of centre on desktop, so the landmass sits right of the
 * control card pinned to the top-left corner. On a phone that card spans the
 * full width, so there is nothing to dodge and the map is simply centred.
 */
const DESKTOP_CENTER: [number, number] = [-12, 0];
const NARROW_CENTER: [number, number] = [0, 0];

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


  // The map fills whatever the shell leaves it, so the viewBox follows the
  // measured container rather than a breakpoint preset.
  const { map: colors } = useMapColors();
  const { ref: containerRef, viewport } = useMapViewport<HTMLDivElement>();
  const { width, height, scale, markerScale, isNarrow } = viewport;

  // Zoom is controlled so the +/- buttons and d3's own gestures stay in sync.
  const [zoom, setZoom] = useState(MIN_ZOOM);
  const [center, setCenter] = useState<[number, number]>(DESKTOP_CENTER);
  // Track whether the user has moved the map; until then, follow the
  // breakpoint's default centre rather than stranding a phone off-centre.
  const [hasMovedMap, setHasMovedMap] = useState(false);
  const defaultCenter = isNarrow ? NARROW_CENTER : DESKTOP_CENTER;
  const effectiveCenter = hasMovedMap ? center : defaultCenter;

  // The journey highlighted by clicking one of its routes.
  const [selectedJourney, setSelectedJourney] = useState<FlightJourney | null>(
    null
  );

  /**
   * Distinguishes a tap from the end of a drag.
   *
   * d3-zoom pans on pointer drag, and the browser still fires a click on
   * whatever sits under the finger when it lifts. Without this, panning the
   * map to look around toggled whichever country you happened to release
   * over. Measured in client pixels and evaluated in the capture phase, so it
   * is set before any child's own click handler runs.
   */
  const pointerDownAtRef = useRef<{ x: number; y: number } | null>(null);
  const wasDragRef = useRef(false);
  /** Set by handlers that acted on a click, so the container does not also clear. */
  const clickConsumedRef = useRef(false);

  const handlePointerDownCapture = useCallback((event: React.PointerEvent) => {
    pointerDownAtRef.current = { x: event.clientX, y: event.clientY };
    wasDragRef.current = false;
  }, []);

  const handleClickCapture = useCallback((event: React.MouseEvent) => {
    const start = pointerDownAtRef.current;
    if (!start) return;
    const distance = Math.hypot(
      event.clientX - start.x,
      event.clientY - start.y
    );
    // 6px of slop: fingers and trackpads wobble on a deliberate tap.
    wasDragRef.current = distance > 6;
  }, []);

  const handleMoveEnd = useCallback(
    (position: { coordinates: [number, number]; zoom: number }) => {
      setZoom(position.zoom);
      setCenter(position.coordinates);
      setHasMovedMap(true);
    },
    []
  );

  const handleResetView = useCallback(() => {
    setZoom(MIN_ZOOM);
    // Back to the view the map opened with, not [0,0] — otherwise "reset"
    // lands somewhere the user has never seen.
    setHasMovedMap(false);
    setCenter(defaultCenter);
  }, [defaultCenter]);

  const clearSelection = useCallback(() => {
    clickConsumedRef.current = true;
    setSelectedJourney(null);
  }, []);

  /**
   * Anything inside the map that did not deliberately handle the click clears
   * the selection.
   *
   * Previously only the ocean rect and countries cleared, so a tap that
   * landed on an airport dot — a circle with no handler — was swallowed and
   * the highlight appeared stuck. Handling it at the container means every
   * gap in the map behaves the same way, including gaps added later.
   */
  const handleContainerClick = useCallback(() => {
    const consumed = clickConsumedRef.current;
    clickConsumedRef.current = false;
    if (consumed || wasDragRef.current) return;
    setSelectedJourney(null);
  }, []);

  const handleSelectRoute = useCallback((route: AggregatedRoute) => {
    if (wasDragRef.current) return;
    // Stops the container handler below from immediately clearing what this
    // click just selected.
    clickConsumedRef.current = true;
    // A route can belong to several journeys; the most recent is the most
    // likely thing someone is asking about.
    const journey = [...route.flights].sort((a, b) => {
      const aDate = a.journeyDate ? new Date(a.journeyDate).getTime() : 0;
      const bDate = b.journeyDate ? new Date(b.journeyDate).getTime() : 0;
      return bDate - aDate;
    })[0];
    setSelectedJourney(journey ?? null);
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
      // A pan ends with a click on whatever is under the finger. Without this
      // guard, dragging the map to look around silently toggled a country.
      if (wasDragRef.current) return;

      // While a journey is highlighted the map is in "reading" mode: a tap
      // dismisses the highlight rather than editing your countries, so
      // missing a thin route cannot silently add one. The container handler
      // does the clearing; this just declines to toggle.
      if (selectedJourney) return;

      const countryId = countryByIsoCode.get(isoCode);
      if (!countryId) return;

      clickConsumedRef.current = true;
      const existingVisit = visitByCountryId.get(countryId);
      if (existingVisit) {
        await removeVisitWithUndo(existingVisit);
      } else {
        await addVisitForCountry(countryId);
      }
    },
    [
      countryByIsoCode,
      visitByCountryId,
      addVisitForCountry,
      removeVisitWithUndo,
      selectedJourney,
    ]
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

  /**
   * Fly a newly created journey.
   *
   * Depends on `flights` as well as the id, because the mutation invalidates
   * the Flight tag and the new journey only appears once that refetch lands —
   * looking it up on the id alone would find nothing.
   */
  const { focusedJourneyId, clearFocus } = useMapFocus();
  useEffect(() => {
    if (focusedJourneyId === null) return;
    const journey = flights.find((f) => f.id === focusedJourneyId);
    if (!journey) return;
    setSelectedJourney(journey);
    clearFocus();
  }, [focusedJourneyId, flights, clearFocus]);

  // Highlighted airports: every stop on a selected journey, otherwise the two
  // ends of whatever route is hovered.
  const highlightedAirports = useMemo(() => {
    if (selectedJourney) {
      return (selectedJourney.legs ?? []).flatMap((leg) => [
        leg.departureAirport?.iataCode,
        leg.arrivalAirport?.iataCode,
      ]).filter(Boolean) as string[];
    }
    return hoveredRoute
      ? [hoveredRoute.departure.iataCode, hoveredRoute.arrival.iataCode]
      : [];
  }, [selectedJourney, hoveredRoute]);

  // With a journey selected, show only its airports — leaving all 39 dots up
  // would undo the clarity gained by hiding the other routes.
  const visibleAirports = useMemo(() => {
    if (!selectedJourney) return airports;
    const onJourney = new Set(highlightedAirports);
    return airports.filter((airport) => onJourney.has(airport.iataCode));
  }, [airports, selectedJourney, highlightedAirports]);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden"
      style={{ backgroundColor: colors.ocean }}
      onMouseMove={handleMouseMove}
      onPointerDownCapture={handlePointerDownCapture}
      onClickCapture={handleClickCapture}
      onClick={handleContainerClick}
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
          center={effectiveCenter}
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
            fill={colors.ocean}
            // Clearing is handled once at the container, so open water needs
            // no handler of its own.
            style={{ cursor: selectedJourney ? 'pointer' : 'default' }}
          />

          {/* Countries */}
          <CountriesLayer
            countryDisplayMap={countryDisplayMap}
            showVisitColors={settings.showCountries}
            onCountryClick={handleCountryClick}
          />

          {/* Flight Routes */}
          {settings.showFlights && (
            <>
              {/*
                The other routes stay mounted while a journey is selected, at
                a tenth of their opacity. Unmounting them looked cleaner but
                left nothing to click, so switching journeys was impossible —
                a tap where another route sits did nothing, or cleared, and
                the old highlight appeared to be stuck.
              */}
              <FlightRoutes
                routes={routes}
                maxCount={maxRouteCount}
                hoveredRouteKey={selectedJourney ? null : hoveredRoute?.key || null}
                onHover={selectedJourney ? () => undefined : handleRouteHover}
                onSelect={handleSelectRoute}
                sizeScale={markerScale}
                faded={Boolean(selectedJourney)}
              />
              {selectedJourney && (
                <JourneyHighlight
                  journey={selectedJourney}
                  sizeScale={markerScale}
                  onClear={clearSelection}
                />
              )}
            </>
          )}

          {/* Airport Markers */}
          {settings.showAirports && settings.showFlights && (
            <AirportMarkers
              airports={visibleAirports}
              visitCounts={airportVisitCounts}
              highlightedAirports={highlightedAirports}
              sizeScale={markerScale}
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
        Always visible. The panel caps its own height, so it clears these
        rather than needing them hidden. On a landscape phone the canvas is
        short enough that an open panel can still reach the legend, which is
        accepted: the panel is dismissible and this is a rare orientation for
        a world map.
      */}
      <MapLegend showFlights={settings.showFlights} stats={stats} />

      <MapZoomControls
        zoom={zoom}
        minZoom={MIN_ZOOM}
        maxZoom={MAX_ZOOM}
        onZoomIn={() => setZoom((z) => Math.min(z * 1.5, MAX_ZOOM))}
        onZoomOut={() => setZoom((z) => Math.max(z / 1.5, MIN_ZOOM))}
        onReset={handleResetView}
      />

      {selectedJourney && (
        <SelectedJourneyCard
          journey={selectedJourney}
          onClose={() => setSelectedJourney(null)}
        />
      )}

      {/* Route Tooltip */}
      <RouteTooltip route={hoveredRoute} position={tooltipPosition} />
    </div>
  );
}

export default memo(TravelMap);
