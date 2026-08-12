import { memo, useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { ComposableMap, ZoomableGroup } from 'react-simple-maps';
import {
  useGetVisitsQuery,
  useGetCountriesQuery,
  useSetHomeCountryMutation,
} from '../../features/visits/visitsApi';
import { useVisitActions } from '../../features/visits/useVisitActions';
import { useToast } from '../Toast/ToastProvider';
import type { Alpha3, Visit, FlightJourney } from '../../types';
import { useGetFlightsQuery } from '../../features/flights/flightsApi';
import { useUpdateVisitMutation } from '../../features/visits/visitsApi';
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
import CountryTooltip from './CountryTooltip';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { buildCountryDisplayMap, type CountryDisplayInfo } from './countryColors';
import CountriesLayer from './CountriesLayer';
import CountryDetailCard from './CountryDetailCard';
import MapSearch, { type SearchTarget } from './MapSearch';
import { useJourneyReplay } from './useJourneyReplay';
import ReplayControl from './ReplayControl';
import type { AggregatedRoute } from '../FlightMap/routeUtils';
import { fitToPoints, type LonLat } from './fitBounds';


/**
 * Seconds the plane takes to fly a leg during replay.
 *
 * Comfortably inside the step, so it lands and the arrival registers before
 * the next journey begins.
 */
const REPLAY_FLIGHT_SECONDS = 3.6;

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
  const [updateVisit] = useUpdateVisitMutation();
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

  /**
   * Hover only exists on a pointer that can hover. On touch the browser fires
   * synthetic mouse events on tap, which made the cursor-following route
   * tooltip flash in a spot the finger was already covering — and the same
   * information is already in the card at the bottom.
   */
  const canHover = useMediaQuery('(pointer: fine)');
  const [hoveredCountry, setHoveredCountry] = useState<string | null>(null);

  const handleCountryHover = useCallback(
    (name: string | null, event?: React.MouseEvent) => {
      if (!canHover) return;
      setHoveredCountry(name);
      if (event && name) {
        setTooltipPosition({ x: event.clientX, y: event.clientY });
      }
    },
    [canHover]
  );


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

  /*
    The view the map opened with, so Reset can return to it.

    A ref rather than state: it is computed further down, after the airports
    and country centroids it depends on, but Reset is defined up here. Reading
    it through a ref avoids reordering half the component around a callback
    that only fires on a button press.
  */
  const openingViewRef = useRef<{ center: LonLat; zoom: number }>({
    center: defaultCenter,
    zoom: MIN_ZOOM,
  });

  /*
    The country whose detail card is open. Held as an ISO code rather than the
    visit, so the card survives the visit object being replaced when its type
    changes.
  */
  const [openCountryIso, setOpenCountryIso] = useState<string | null>(null);

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
  const pointerDownAtRef = useRef<{
    x: number;
    y: number;
    pointerType: string;
  } | null>(null);
  const wasDragRef = useRef(false);
  /** Set by handlers that acted on a click, so the container does not also clear. */
  const clickConsumedRef = useRef(false);

  const handlePointerDownCapture = useCallback((event: React.PointerEvent) => {
    pointerDownAtRef.current = {
      x: event.clientX,
      y: event.clientY,
      pointerType: event.pointerType,
    };
    wasDragRef.current = false;
  }, []);

  const handleClickCapture = useCallback((event: React.MouseEvent) => {
    const start = pointerDownAtRef.current;
    if (!start) return;
    const distance = Math.hypot(
      event.clientX - start.x,
      event.clientY - start.y
    );
    /**
     * A finger travels much further than a mouse on what the user means as a
     * single tap. At a flat 6px, ordinary thumb wobble was being read as a
     * pan, which silently swallowed taps — selecting and dismissing a journey
     * both failed intermittently on a phone while working perfectly with a
     * mouse. 14px is in line with the platform conventions (iOS ~10pt,
     * Android 8dp scaled), and still far below a deliberate drag.
     */
    const slop = start.pointerType === 'touch' ? 14 : 6;
    wasDragRef.current = distance > slop;
  }, []);

  const handleMoveEnd = useCallback(
    (position: { coordinates: [number, number]; zoom: number }) => {
      setZoom(position.zoom);
      setCenter(position.coordinates);
      setHasMovedMap(true);
    },
    []
  );

  const handleSearchGo = useCallback((target: SearchTarget) => {
    setCenter(target.center);
    setZoom(target.zoom);
    // Counts as a deliberate move, so the data framing stops overriding it.
    setHasMovedMap(true);
    // Landing on a country you have been to opens its card, which is the
    // question someone searching for it is usually asking.
    setOpenCountryIso(target.isoCode ?? null);
  }, []);

  const handleResetView = useCallback(() => {
    // Back to the view the map opened with, not [0,0] — otherwise "reset"
    // lands somewhere the user has never seen.
    const opening = openingViewRef.current;
    setZoom(opening.zoom);
    setHasMovedMap(false);
    setCenter(opening.center);
  }, []);

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
        /*
          Open the country rather than delete it. Tapping used to remove,
          which made the map's only interaction destructive — a stray tap at
          the end of a pan could quietly drop somewhere you had been. Removal
          now lives inside the card, behind a deliberate press.
        */
        setOpenCountryIso(isoCode);
      } else {
        await addVisitForCountry(countryId);
      }
    },
    [countryByIsoCode, visitByCountryId, addVisitForCountry, selectedJourney]
  );

  /*
    Resolve the open country from its ISO code on every render, rather than
    storing the visit itself. Changing the visit type replaces the visit
    object, and a card holding the old one would show a stale badge. Returning
    null once the country is no longer visited also closes the card after a
    removal, with no extra bookkeeping.
  */
  /*
    Hold a country to open its card, adding it first if it is not yet
    visited. That gives trip / transit / home a route that does not involve
    opening a panel — which matters most on a phone, where the panel covers
    the map you are pointing at.
  */
  const handleCountryLongPress = useCallback(
    async (isoCode: string) => {
      if (selectedJourney) return;
      const countryId = countryByIsoCode.get(isoCode);
      if (!countryId) return;

      clickConsumedRef.current = true;
      if (!visitByCountryId.get(countryId)) {
        await addVisitForCountry(countryId);
      }
      setOpenCountryIso(isoCode);
    },
    [countryByIsoCode, visitByCountryId, addVisitForCountry, selectedJourney]
  );

  /*
    Replay draws one journey at a time, in date order, reusing the same
    JourneyHighlight the map already uses for a selected route — so the plane,
    the arc and the direction all come for free.
  */
  const replay = useJourneyReplay(flights);

  /*
    During replay the map draws only what has been flown so far, so the trail
    accumulates instead of being fully present and merely dimmed. Recomputed
    per step, which is cheap: aggregateRoutes runs over a growing slice, not
    the whole history each time.
  */
  /*
    Countries revealed so far in this replay.

    The map starts blank: no visited fills at all, so the colour spreading is
    the story. A departure country appears as its journey begins — you were
    already there — and an arrival appears the moment the plane lands, which
    is when the flash fires. Flashing a country that was already orange was
    invisible, which is why this had to change rather than just get brighter.
  */
  const [revealedIsos, setRevealedIsos] = useState<Set<string>>(new Set());

  const replayCountryDisplayMap = useMemo(() => {
    const map = new Map<string, CountryDisplayInfo>();
    for (const iso of revealedIsos) {
      map.set(iso, {
        isoCode: iso as Alpha3,
        visitType: 'trip',
        isHome: false,
        hasFlights: true,
        visit: null,
      });
    }
    return map;
  }, [revealedIsos]);

  const replayRoutes = useMemo(
    () => (replay.isActive ? aggregateRoutes(replay.played) : []),
    [replay.isActive, replay.played]
  );
  const replayMaxRouteCount = Math.max(
    ...replayRoutes.map((route) => route.count),
    1
  );
  const replayAirports = useMemo(
    () => (replay.isActive ? extractUniqueAirports(replay.played) : []),
    [replay.isActive, replay.played]
  );

  /*
    Fly the camera to each journey as it plays.

    Watching a route draw itself while the whole world is in frame wastes the
    animation — at world zoom a European hop is a few pixels. Framing the
    journey is what makes it read as travel. The glide comes from a CSS
    transition on the zoom group; see .replay-camera.
  */
  useEffect(() => {
    if (!replay.isActive || !replay.current) return;
    const points: LonLat[] = [];
    for (const leg of replay.current.legs) {
      points.push([leg.departureAirport.longitude, leg.departureAirport.latitude]);
      points.push([leg.arrivalAirport.longitude, leg.arrivalAirport.latitude]);
    }
    // fill 0.5 leaves generous margin, so the arc's bow is not cropped.
    const framing = fitToPoints(points, { maxZoom: 4, fill: 0.5 });
    if (!framing) return;
    setCenter(framing.center);
    setZoom(framing.zoom);
    setHasMovedMap(true);
  }, [replay.isActive, replay.current]);

  /*
    Light up the destination as the plane arrives.

    Timed off the flight duration rather than an animation event: SMIL's
    endEvent is awkward to hang React state off, and the duration is already
    known exactly. The country's alpha-3 comes from the countries list, since
    airports store alpha-2 and the map keys on alpha-3.
  */
  const [landedIsoCode, setLandedIsoCode] = useState<string | null>(null);
  /*
    Countries already lit during this replay.

    The glow marks a discovery — the first time a flight puts you somewhere.
    Firing it on every landing means a home airport flashes on most steps,
    which turns a moment into a tic.
  */
  const landedBeforeRef = useRef<Set<string>>(new Set());


  useEffect(() => {
    if (!replay.isActive) {
      landedBeforeRef.current.clear();
      setRevealedIsos(new Set());
    }
  }, [replay.isActive]);

  const alpha2ToAlpha3 = useMemo(() => {
    const map = new Map<string, string>();
    for (const country of countries) map.set(country.isoCode2, country.isoCode);
    return map;
  }, [countries]);

  useEffect(() => {
    setLandedIsoCode(null);
    if (!replay.isActive || !replay.current) return;

    const legs = [...replay.current.legs].sort((a, b) => a.legOrder - b.legOrder);
    if (legs.length === 0) return;

    const timers: number[] = [];

    /**
     * Put a country on the map, flashing it the first time it is touched.
     *
     * "First time" is per replay, not per journey, so a home airport does not
     * strobe on every step — but every country still lights up once, whether
     * it is an origin, a connection or a destination.
     */
    const reveal = (iso3: string) => {
      setRevealedIsos((current) =>
        current.has(iso3) ? current : new Set(current).add(iso3)
      );
      if (landedBeforeRef.current.has(iso3)) return;
      landedBeforeRef.current.add(iso3);
      setLandedIsoCode(iso3);
      // Release it so the fill transitions back and reads as a flash rather
      // than a permanent state change.
      timers.push(
        window.setTimeout(() => setLandedIsoCode(null), 1400)
      );
    };

    const isoOf = (code: string | null) =>
      code ? alpha2ToAlpha3.get(code) : undefined;

    // You are already standing in the origin when the journey begins.
    const origin = isoOf(legs[0].departureAirport.countryIso);
    if (origin) reveal(origin);

    /*
      Every stop, in order, spread across the flight window — a connection is
      somewhere you were, and skipping it meant a two-leg journey lit up its
      origin and destination while the country in the middle stayed dark.
    */
    legs.forEach((leg, index) => {
      const iso3 = isoOf(leg.arrivalAirport.countryIso);
      if (!iso3) return;
      const at = ((index + 1) / legs.length) * REPLAY_FLIGHT_SECONDS * 1000;
      timers.push(window.setTimeout(() => reveal(iso3), at));
    });

    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [replay.isActive, replay.current, alpha2ToAlpha3]);

  const openCountry = useMemo(() => {
    if (!openCountryIso) return null;
    const countryId = countryByIsoCode.get(openCountryIso);
    if (!countryId) return null;
    const visit = visitByCountryId.get(countryId) ?? null;
    if (!visit) return null;
    return {
      // Alpha-2, which is what the airports table stores. The map's own key
      // is alpha-3, and joining on it matched nothing.
      isoAlpha2: visit.country?.isoCode2 ?? null,
      visit,
      name: visit.country?.name ?? openCountryIso,
    };
  }, [openCountryIso, countryByIsoCode, visitByCountryId]);

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
      if (hoveredRoute || hoveredCountry) {
        setTooltipPosition({ x: event.clientX, y: event.clientY });
      }
    },
    [hoveredRoute, hoveredCountry]
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

  /*
    Frame the opening view around where the user has actually been.

    A world map centred on the Atlantic is the right default for someone with
    no data and the wrong one for everyone else: a person who has only flown
    around Europe opened the app to a globe with their entire life in one
    corner. Centroids arrive with the geography, so this settles a moment
    after first paint rather than blocking it.
  */
  const [countryCentroids, setCountryCentroids] = useState<
    Map<string, LonLat>
  >(new Map());

  const dataFraming = useMemo(() => {
    const points: LonLat[] = [];
    for (const airport of airports) {
      points.push([airport.longitude, airport.latitude]);
    }
    for (const [iso, info] of countryDisplayMap) {
      // Transit-only countries are places you changed planes in, not places
      // you would call "been to" — they should not drag the frame.
      if (info.visitType === 'transit') continue;
      const centroid = countryCentroids.get(iso);
      if (centroid) points.push(centroid);
    }
    // maxZoom 3 keeps some surrounding context: a frame pulled tight around
    // two neighbouring countries loses the sense of where in the world it is.
    return fitToPoints(points, { maxZoom: 3, fill: isNarrow ? 0.55 : 0.7 });
  }, [airports, countryDisplayMap, countryCentroids, isNarrow]);

  const openingCenter = dataFraming?.center ?? defaultCenter;
  const openingZoom = dataFraming?.zoom ?? MIN_ZOOM;
  openingViewRef.current = { center: openingCenter, zoom: openingZoom };
  const effectiveCenter = hasMovedMap ? center : openingCenter;
  const effectiveZoom = hasMovedMap ? zoom : openingZoom;

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
        className={`w-full h-full ${replay.isActive ? 'replay-camera' : ''}`}
      >
        <ZoomableGroup
          zoom={effectiveZoom}
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
            countryDisplayMap={replay.isActive ? replayCountryDisplayMap : countryDisplayMap}
            showVisitColors={settings.showCountries}
            onCountryClick={handleCountryClick}
            onCountryHover={canHover ? handleCountryHover : undefined}
            onCentroids={setCountryCentroids}
            onCountryLongPress={handleCountryLongPress}
            landedIsoCode={landedIsoCode}
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
                routes={replay.isActive ? replayRoutes : routes}
                maxCount={replay.isActive ? replayMaxRouteCount : maxRouteCount}
                hoveredRouteKey={selectedJourney ? null : hoveredRoute?.key || null}
                onHover={selectedJourney ? () => undefined : handleRouteHover}
                onSelect={handleSelectRoute}
                sizeScale={markerScale}
                faded={Boolean(selectedJourney) || replay.isActive}
              />
              {(replay.current ?? selectedJourney) && (
                <JourneyHighlight
                  journey={replay.current ?? selectedJourney!}
                  legDurationSeconds={replay.isActive ? REPLAY_FLIGHT_SECONDS : undefined}
                  sizeScale={markerScale}
                  onClear={clearSelection}
                />
              )}
            </>
          )}

          {/* Airport Markers */}
          {settings.showAirports && settings.showFlights && (
            <AirportMarkers
              airports={replay.isActive ? replayAirports : visibleAirports}
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
      {/* One column: search on top, filters beneath. Positioning them
          separately put both in the same corner and the search hid the
          filters entirely. */}
      <div className="absolute top-3 left-3 right-3 md:right-auto md:w-[30rem] z-30 flex flex-col gap-2">
        <MapSearch
          countries={countries}
          countryCentroids={countryCentroids}
          onGo={handleSearchGo}
        />

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

      {/* Transport controls appear only while replaying, so nothing floats
          over the map when it is idle. */}
      {replay.isActive && (
        <div className="absolute z-20 bottom-36 lg:bottom-4 left-1/2 -translate-x-1/2">
          <ReplayControl replay={replay} />
        </div>
      )}

      <MapZoomControls
        extraTool={!replay.isActive ? <ReplayControl replay={replay} compact /> : null}
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

      {/* Same berth as the journey card — they are never open together. */}
      {openCountry && !selectedJourney && (
        <div className="absolute z-20 left-3 right-3 sm:right-auto bottom-20 lg:bottom-4 lg:left-auto lg:right-20">
          <CountryDetailCard
            countryName={openCountry.name}
            isoAlpha2={openCountry.isoAlpha2}
            visit={openCountry.visit}
            journeys={flights}
            onClose={() => setOpenCountryIso(null)}
            onChangeType={(type) => {
              void updateVisit({
                id: openCountry.visit.id,
                data: { visitType: type },
              });
            }}
            onRemove={() => {
              setOpenCountryIso(null);
              void removeVisitWithUndo(openCountry.visit);
            }}
            onShowJourney={(journeyId) => {
              const journey = flights.find((f) => f.id === journeyId);
              if (!journey) return;
              setOpenCountryIso(null);
              setSelectedJourney(journey);
            }}
          />
        </div>
      )}

      {/* Hover-only. On touch the route's details are in the card instead. */}
      {canHover && (
        <>
          <RouteTooltip route={hoveredRoute} position={tooltipPosition} />
          {!hoveredRoute && (
            <CountryTooltip name={hoveredCountry} position={tooltipPosition} />
          )}
        </>
      )}
    </div>
  );
}

export default memo(TravelMap);
