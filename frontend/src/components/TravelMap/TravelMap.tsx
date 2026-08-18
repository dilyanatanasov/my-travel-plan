import { memo, useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { ComposableMap, ZoomableGroup } from 'react-simple-maps';
import {
  useGetVisitsQuery,
  useGetCountriesQuery,
} from '../../features/visits/visitsApi';
import { useVisitActions } from '../../features/visits/useVisitActions';
import { useToast } from '../Toast/ToastProvider';
import { track } from '../../lib/analytics';
import type { Visit, FlightJourney } from '../../types';
import {
  useGetFlightsQuery,
  useGetLegPhotoIdsQuery,
} from '../../features/flights/flightsApi';
import PostcardMarker from './PostcardMarker';
import { useUpdateVisitMutation } from '../../features/visits/visitsApi';
import { aggregateRoutes, extractUniqueAirports, countAirportVisits, legEndpoints } from '../FlightMap/routeUtils';
import { applyFilters, extractFilterOptions } from '../FlightMap/filterUtils';
import { DEFAULT_FILTERS, type FlightFilters } from '../FlightMap/filterTypes';
import FlightRoutes from '../FlightMap/FlightRoutes';
import AirportMarkers from '../FlightMap/AirportMarkers';
import RouteTooltip from '../FlightMap/RouteTooltip';
import JourneyHighlight from '../FlightMap/JourneyHighlight';
import ArrivalChip from '../FlightMap/ArrivalChip';
import SelectedJourneyCard from './SelectedJourneyCard';
import TripShareDialog from '../../features/share/TripShareDialog';
import MapControlPanel, { type TravelMapSettings } from './MapControlPanel';
import MapZoomControls from './MapZoomControls';
import MapLegend from './MapLegend';
import { useMapViewport } from './useMapViewport';
import { useMapFocus } from '../../features/map/MapFocusContext';
import { useMapColors } from '../../theme/mapColors';
import CountryTooltip from './CountryTooltip';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { buildCountryDisplayMap } from './countryColors';
import CountriesLayer from './CountriesLayer';
import CountryDetailCard from './CountryDetailCard';
import MapSearch from './MapSearch';
import { useJourneyReplay, journeyFlightSeconds } from './useJourneyReplay';
import { useReplayAudio } from './useReplayAudio';
import { useReplayOrchestration } from './useReplayOrchestration';
import { useSearchLanding } from './useSearchLanding';
import { useCountryInteraction } from './useCountryInteraction';
import ReplayControl from './ReplayControl';
import GlobeView from './GlobeView';
import type { AggregatedRoute } from '../FlightMap/routeUtils';
import { fitToPoints, type LonLat } from './fitBounds';


const MIN_ZOOM = 1;
/**
 * 24, raised twice from the original 8.
 *
 * Eight filled the screen with a continent; sixteen pulled apart a cluster
 * of European airports; twenty-four is for reading one metro area's routes.
 * The topology is world-atlas 110m, so coastlines are frankly polygonal up
 * here — an accepted trade, since what you are reading at this range is the
 * routes and the airport labels, not the shape of a bay.
 */
const MAX_ZOOM = 24;

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

/**
 * Globe mode persists like a display preference, not a session whim: someone
 * who chose to look at their world as a globe gets it back next visit.
 */
const GLOBE_MODE_KEY = 'contrail:globe-mode';

function TravelMap() {
  // Data queries
  const { data: visits = [] } = useGetVisitsQuery();
  const { data: countries = [] } = useGetCountriesQuery();
  const { data: flights = [] } = useGetFlightsQuery();

  // Mutations
  const [updateVisit] = useUpdateVisitMutation();
  const { addVisitForCountry, removeVisitWithUndo } = useVisitActions();
  const { showToast } = useToast();

  // State
  const [settings, setSettings] = useState<TravelMapSettings>(DEFAULT_SETTINGS);

  /*
    Globe mode is strictly additive: the flat map stays the default and the
    primary experience, and everything below this component's return branch
    is untouched by the mode being off. When it is on, GlobeView takes the
    canvas and this component keeps owning the data, settings, filters and
    the replay clock — so switching modes never loses state.
  */
  const [globeMode, setGlobeMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem(GLOBE_MODE_KEY) === '1';
    } catch {
      return false;
    }
  });
  const handleGlobeModeChange = useCallback((on: boolean) => {
    setGlobeMode(on);
    try {
      localStorage.setItem(GLOBE_MODE_KEY, on ? '1' : '0');
    } catch {
      /* private browsing; the mode simply does not persist */
    }
    // Which mode, never what it shows.
    track('map_interact', { kind: on ? 'globe-on' : 'globe-off' });
  }, []);
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
  const lastZoomRef = useRef(MIN_ZOOM);
  // Country centroids + bounding boxes, reported by the geography layer once
  // it loads. Bounds power search fit-zoom; centroids power data framing.
  const [countryCentroids, setCountryCentroids] = useState<
    Map<string, LonLat>
  >(new Map());
  const [countryBounds, setCountryBounds] = useState<
    Map<string, [LonLat, LonLat]>
  >(new Map());

  const handleCentroids = useCallback(
    (
      centroids: Map<string, LonLat>,
      bounds?: Map<string, [LonLat, LonLat]>,
    ) => {
      setCountryCentroids(centroids);
      if (bounds) setCountryBounds(bounds);
    },
    [],
  );
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

  /*
    Replay draws one journey at a time, in date order, reusing the same
    JourneyHighlight the map already uses for a selected route — so the plane,
    the arc and the direction all come for free.
  */
  const replay = useJourneyReplay(flights);

  /*
    The replay narrates EVERYTHING, so pressing Play clears whatever filters
    or hidden layers are active (user decision, 2026-08-13): replaying with
    routes filtered out animated a plane along paths that were not there.
    Only the UI's start is wrapped — effects keep the raw replay object.
  */
  const replayForUi = useMemo(
    () => ({
      ...replay,
      start: () => {
        setFilters(DEFAULT_FILTERS);
        setSettings(DEFAULT_SETTINGS);
        replay.start();
      },
    }),
    [replay],
  );

  // The journey highlighted by clicking one of its routes.
  const [selectedJourney, setSelectedJourney] = useState<FlightJourney | null>(
    null
  );
  /** The journey whose boarding-pass dialog is open (trip share). */
  const [shareJourney, setShareJourney] = useState<FlightJourney | null>(null);

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
      // One event per settled gesture; zoom vs pan by whether zoom changed.
      // Coordinates are never sent — where someone looks is travel data.
      track('map_interact', {
        kind: position.zoom !== lastZoomRef.current ? 'zoom' : 'pan',
      });
      lastZoomRef.current = position.zoom;
      setZoom(position.zoom);
      setCenter(position.coordinates);
      setHasMovedMap(true);
    },
    []
  );

  /* Search landings (camera fit, country blink, airport ping) live in
     useSearchLanding; framing a result counts as a deliberate move, so the
     data framing stops overriding it. */
  /*
    The landing glides instead of cutting (2026-08-14, user request after
    feeling the globe's animated fly-to): the replay's transform transition
    is borrowed for just over one transition's length, then dropped so
    ordinary panning stays immediate. State, not a ref — the className has
    to re-render on and off.
  */
  const [searchGlide, setSearchGlide] = useState(false);
  const glideTimerRef = useRef<number | null>(null);
  const handleSearchFrame = useCallback((frameCenter: LonLat, frameZoom: number) => {
    setSearchGlide(true);
    if (glideTimerRef.current) window.clearTimeout(glideTimerRef.current);
    glideTimerRef.current = window.setTimeout(() => setSearchGlide(false), 750);
    setCenter(frameCenter);
    setZoom(frameZoom);
    setHasMovedMap(true);
  }, []);
  const { searchBlinkIso, searchPing, handleSearchGo } = useSearchLanding({
    countryBounds,
    onFrame: handleSearchFrame,
    onOpenCountry: setOpenCountryIso,
  });

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
    // The replay owns the map while it runs — same rule the countries
    // follow. Selecting a route mid-replay stacked a second highlighted
    // journey on top of the narration.
    if (replay.isActive) return;
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
  }, [replay.isActive]);

  // Build country display map from visits
  const countryDisplayMap = useMemo(() => buildCountryDisplayMap(visits), [visits]);

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
      return type === 'trip' || type === 'home' || type === 'lived';
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

  /*
    What the map says to someone who cannot see it.

    Built from the same numbers the legend renders, so a change to one shows
    up in the other. The pointer to the Countries section is the important
    part: a description of a map is not equivalent access, but a route to the
    list that does the same job is.
  */
  const mapSummary = useMemo(() => {
    // Anonymous visitors get a 401 on /countries, so the total is 0 until
    // they write something. "0 of 0 countries visited" reads as a broken app
    // rather than an empty one.
    if (stats.totalCountries === 0) {
      return 'World map. No countries marked yet. Use the Countries section to add one.';
    }
    const parts = [
      `World map. ${stats.visitedCount} of ${stats.totalCountries} countries visited`,
    ];
    if (stats.transitCount > 0) {
      parts.push(`${stats.transitCount} visited in transit only`);
    }
    if (stats.flightRoutes > 0) {
      parts.push(
        `${stats.flightRoutes} flight ${stats.flightRoutes === 1 ? 'route' : 'routes'} across ${stats.airports} airports`
      );
    }
    return `${parts.join('. ')}. Use the Countries section to add, change or remove a country.`;
  }, [stats]);

  /* Tap-cycle and long-press editing live in useCountryInteraction; the
     drag/consumed refs stay here because the whole container shares them. */
  const { handleCountryClick, handleCountryLongPress } = useCountryInteraction({
    countryByIsoCode,
    visitByCountryId,
    addVisitForCountry,
    updateVisit,
    removeVisitWithUndo,
    showToast,
    hasSelectedJourney: Boolean(selectedJourney),
    replayActive: replay.isActive,
    wasDragRef,
    clickConsumedRef,
    onOpenCountry: setOpenCountryIso,
  });


  /*
    The replay's narration state — revealed countries, landing flash, airport
    pop, year chip, played-so-far routes — lives in useReplayOrchestration.
  */
  // Stops with photos, so the replay can schedule their postcards.
  const { data: legPhotoData } = useGetLegPhotoIdsQuery();
  const photoLegIds = useMemo(
    () => new Set(legPhotoData?.legIds ?? []),
    [legPhotoData],
  );

  const {
    landedIsoCode,
    popAirport,
    yearChip,
    postcard,
    replayCountryDisplayMap,
    replayRoutes,
    replayMaxRouteCount,
    replayAirports,
  } = useReplayOrchestration(replay, countries, photoLegIds);

  /*
    Cockpit ambience: hum while flying, seatbelt chime per arrival. The
    chime rides the popAirport beat, so both map modes get it for free.
  */
  const { muted, toggleMuted, chime } = useReplayAudio(replay.isActive);
  const popKey = popAirport?.key;
  useEffect(() => {
    if (replay.isActive && popKey !== undefined) chime();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [popKey]);

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
      const endpoints = legEndpoints(leg);
      if (!endpoints) continue;
      points.push([endpoints.departure.longitude, endpoints.departure.latitude]);
      points.push([endpoints.arrival.longitude, endpoints.arrival.latitude]);
    }
    // fill 0.58 tightens the camera for immersion while still leaving margin
    // for the arc's bow; the fitter only zooms as deep as the points allow,
    // so the raised cap (6 → 10, land travel 2026-08-18) changes nothing on
    // a continental flight and finally frames a city-to-city drive as a
    // trip instead of a speck. Endpoints stay in frame either way.
    const framing = fitToPoints(points, { maxZoom: 10, fill: 0.58 });
    if (!framing) return;
    setCenter(framing.center);
    setZoom(framing.zoom);
    setHasMovedMap(true);
  }, [replay.isActive, replay.current]);

  const openCountry = useMemo(() => {
    if (!openCountryIso) return null;
    const countryId = countryByIsoCode.get(openCountryIso);
    if (!countryId) return null;
    const visit = visitByCountryId.get(countryId) ?? null;
    // No visit is a valid card now (long-press stopped auto-adding): the
    // name and alpha-2 come from the countries table instead.
    const country =
      visit?.country ?? countries.find((c) => c.id === countryId) ?? null;
    return {
      countryId,
      // Alpha-2, which is what the airports table stores. The map's own key
      // is alpha-3, and joining on it matched nothing.
      isoAlpha2: country?.isoCode2 ?? null,
      visit,
      name: country?.name ?? openCountryIso,
    };
  }, [openCountryIso, countryByIsoCode, visitByCountryId, countries]);

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

    (The state itself is declared near the top of the component because the
    search handler needs the bounds before this framing code runs.)
  */

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

  /*
    One card for both modes (D8): the flat map renders it in place, the globe
    receives it as a slot. Same berth as the journey card — they are never
    open together (and the globe has no journey selection at all).
  */
  const countryDetailCard = openCountry && !selectedJourney && (
    <div className="absolute z-20 left-3 right-3 sm:right-auto bottom-20 lg:bottom-4 lg:left-auto lg:right-20">
      <CountryDetailCard
        countryName={openCountry.name}
        isoAlpha2={openCountry.isoAlpha2}
        visit={openCountry.visit}
        journeys={flights}
        onClose={() => setOpenCountryIso(null)}
        onChangeType={(type) => {
          // Picking a type on a country that is not on the map yet is what
          // adds it - with exactly that type, no silent 'visited' default.
          if (openCountry.visit) {
            void updateVisit({
              id: openCountry.visit.id,
              data: { visitType: type },
            });
          } else {
            void addVisitForCountry(openCountry.countryId, openCountry.name, type);
          }
        }}
        onRemove={() => {
          setOpenCountryIso(null);
          if (openCountry.visit) void removeVisitWithUndo(openCountry.visit);
        }}
        onShowJourney={(journeyId) => {
          const journey = flights.find((f) => f.id === journeyId);
          if (!journey) return;
          setOpenCountryIso(null);
          setSelectedJourney(journey);
          // Journey highlighting lives on the flat map; land the viewer
          // where the thing they asked to see exists.
          if (globeMode) handleGlobeModeChange(false);
        }}
      />
    </div>
  );

  if (globeMode) {
    return (
      <GlobeView
        containerRef={containerRef}
        width={width}
        height={height}
        markerScale={markerScale}
        mapSummary={mapSummary}
        countryDisplayMap={
          replay.isActive ? replayCountryDisplayMap : countryDisplayMap
        }
        settings={settings}
        onSettingsChange={setSettings}
        filters={filters}
        onFiltersChange={setFilters}
        filterAirports={filterOptions.airports}
        filterYears={filterOptions.years}
        isControlPanelOpen={isControlPanelOpen}
        onControlPanelOpenChange={setIsControlPanelOpen}
        onGlobeModeChange={handleGlobeModeChange}
        routes={replay.isActive ? replayRoutes : routes}
        maxRouteCount={replay.isActive ? replayMaxRouteCount : maxRouteCount}
        airports={replay.isActive ? replayAirports : airports}
        airportVisitCounts={airportVisitCounts}
        countries={countries}
        countryCentroids={countryCentroids}
        countryBounds={countryBounds}
        onCentroids={handleCentroids}
        replay={replayForUi}
        onCountryClick={handleCountryClick}
        onCountryLongPress={handleCountryLongPress}
        detailCard={countryDetailCard || undefined}
        postcard={postcard}
        audioMuted={muted}
        onToggleAudioMuted={toggleMuted}
        landedIsoCode={landedIsoCode}
        popAirport={popAirport}
        yearChip={yearChip}
        stats={stats}
        homeCenter={openingCenter}
      />
    );
  }

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
      {/*
        The map as a screen reader meets it.

        role="img" with a summary, rather than a tree of 177 nameless paths.
        Everything the map can do — marking a country, changing its type,
        removing it — is also in the Countries section as a searchable list
        and an editable list, so this is a genuine equivalent rather than a
        shrug. `mapSummary` carries the same counts the legend shows, so the
        two cannot drift.
      */}
      <ComposableMap
        width={width}
        height={height}
        projectionConfig={{
          rotate: [-10, 0, 0],
          scale,
        }}
        role="img"
        aria-label={mapSummary}
        className={`w-full h-full ${replay.isActive || searchGlide ? 'replay-camera' : ''}`}
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
            /*
              Withheld during replay, which also switches the layer's hover
              and pressed styles off — a country that lights up under the
              cursor is promising something the guards then refuse.
            */
            onCountryClick={replay.isActive ? undefined : handleCountryClick}
            onCountryHover={canHover ? handleCountryHover : undefined}
            onCentroids={handleCentroids}
            onCountryLongPress={replay.isActive ? undefined : handleCountryLongPress}
            landedIsoCode={landedIsoCode}
            blinkIsoCode={searchBlinkIso}
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
                  /*
                    Per-leg, so the whole chain lands inside the replay step.
                    The plane now flies every leg in one pass, so a three-leg
                    journey at the flat per-leg duration would take three
                    times the step and be cut off twice.
                  */
                  legDurationSeconds={
                    replay.isActive
                      ? journeyFlightSeconds(replay.current ?? selectedJourney!) /
                        Math.max((replay.current ?? selectedJourney!).legs.length, 1)
                      : undefined
                  }
                  sizeScale={markerScale}
                  loop={!replay.isActive}
                  onClear={clearSelection}
                />
              )}
            </>
          )}

          {/* Search ping: blinks thrice at the found airport's exact spot. */}
          {searchPing && (
            <g className="map-ping" pointerEvents="none">
              <ArrivalChip
                key={searchPing.key}
                label={searchPing.label}
                lon={searchPing.lon}
                lat={searchPing.lat}
                showDot
              />
            </g>
          )}

          {/* Airport Markers */}
          {settings.showAirports && settings.showFlights && (
            <AirportMarkers
              airports={replay.isActive ? replayAirports : visibleAirports}
              visitCounts={airportVisitCounts}
              highlightedAirports={highlightedAirports}
              sizeScale={markerScale}
              popIata={replay.isActive ? popAirport?.iata : undefined}
              popKey={popAirport?.key}
            />
          )}

          {/* The postcard, above the arrival city (trip photos). */}
          {replay.isActive && postcard && (
            <PostcardMarker postcard={postcard} />
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
      {/*
        One column: search on top, filters beneath. Positioning them
        separately put both in the same corner and the search hid the filters
        entirely.

        Both are withheld during replay. Searching flies the camera and
        filtering changes which routes exist, either of which fights the
        replay for control of the same map — and the replay has no way to take
        it back.
      */}
      {/* Year chapter: a beat between journeys when the replay crosses
          into a new year — gives a long history its rhythm. */}
      {replay.isActive && yearChip && (
        <div
          key={yearChip}
          aria-hidden="true"
          className="year-chip absolute top-16 left-1/2 z-40 map-glass rounded-2xl border shadow-xl
            px-6 py-2 font-display text-3xl pointer-events-none"
        >
          {yearChip}
        </div>
      )}

      {!replay.isActive && (
      <div className="absolute top-3 left-3 right-3 md:right-auto md:w-[30rem] z-30 flex flex-col gap-2">
        <MapSearch
          countries={countries}
          countryCentroids={countryCentroids}
          onGo={handleSearchGo}
        />

        <MapControlPanel
          settings={settings}
          onSettingsChange={setSettings}
          filters={filters}
          onFiltersChange={setFilters}
          airports={filterOptions.airports}
          years={filterOptions.years}
          isOpen={isControlPanelOpen}
          onOpenChange={setIsControlPanelOpen}
        />
      </div>
      )}

      {/*
        Always visible. The panel caps its own height, so it clears these
        rather than needing them hidden. On a landscape phone the canvas is
        short enough that an open panel can still reach the legend, which is
        accepted: the panel is dismissible and this is a rare orientation for
        a world map.
      */}
      {/* Hidden during replay (density budget): the map is the show. */}
      {!replay.isActive && (
        <MapLegend showFlights={settings.showFlights} stats={stats} />
      )}

      {/*
        Transport controls appear only while replaying, and take the slot the
        search and filter cards vacate — which is exactly the space they were
        occupying anyway. At the bottom they covered the map on a phone, where
        vertical room is the scarce thing.
      */}
      {replay.isActive && (
        <div className="absolute z-30 top-3 left-3 right-3 md:right-auto md:w-[30rem]">
          <ReplayControl
            replay={replayForUi}
            muted={muted}
            onToggleMuted={toggleMuted}
          />
        </div>
      )}

      <MapZoomControls
        yieldOnMobile={Boolean(countryDetailCard)}
        extraTool={!replay.isActive ? <ReplayControl replay={replayForUi} compact /> : null}
        bottomTool={
          /* The mode toggle lives with the map tools, not the filters (the
             settings-gear lesson), in the bottom-anchored slot that never
             shifts under the finger. Panel keeps its labeled switch. */
          <button
            type="button"
            onClick={() => handleGlobeModeChange(true)}
            aria-label="View as globe"
            title="View as globe"
            className="w-11 h-11 flex items-center justify-center map-glass map-glass-hover
              last:rounded-b-lg focus:outline-none focus-visible:ring-2
              focus-visible:ring-inset focus-visible:ring-brand-400"
          >
            <svg
              className="w-5 h-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="9" />
              <ellipse cx="12" cy="12" rx="4" ry="9" />
              <path d="M3.6 9h16.8M3.6 15h16.8" />
            </svg>
          </button>
        }
        zoom={zoom}
        minZoom={MIN_ZOOM}
        maxZoom={MAX_ZOOM}
        /*
          Stepped from the zoom actually on screen, not from the zoom state.
          Until the map has been moved it renders openingZoom and ignores
          zoom entirely, so these buttons wrote to a value nothing was
          reading and appeared to be broken on first use.
        */
        onZoomIn={() => {
          setZoom(Math.min(effectiveZoom * 1.5, MAX_ZOOM));
          setHasMovedMap(true);
        }}
        onZoomOut={() => {
          setZoom(Math.max(effectiveZoom / 1.5, MIN_ZOOM));
          setHasMovedMap(true);
        }}
        // Every path that changes the view sets hasMovedMap, so this is the
        // whole condition: Reset offers to undo a move that happened.
        canReset={hasMovedMap}
        onReset={handleResetView}
      />

      {selectedJourney && (
        <SelectedJourneyCard
          journey={selectedJourney}
          onClose={() => setSelectedJourney(null)}
          onShare={() => setShareJourney(selectedJourney)}
        />
      )}

      {shareJourney && (
        <TripShareDialog
          journey={shareJourney}
          onClose={() => setShareJourney(null)}
        />
      )}

      {/* Same berth as the journey card — they are never open together. */}
      {countryDetailCard}

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
