import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
  type RefCallback,
} from 'react';
import * as ReactSimpleMaps from 'react-simple-maps';
import {
  ComposableMap,
  Graticule,
  Sphere,
  useMapContext,
  type ProjectionFunction,
} from 'react-simple-maps';
import { geoDistance, geoOrthographic } from 'd3-geo';
import type { LineString } from 'geojson';
import type { Airport, Country } from '../../types';
import { track } from '../../lib/analytics';
import { useMapColors } from '../../theme/mapColors';
import { useTheme } from '../../features/theme/ThemeContext';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { getStrokeWidth, type AggregatedRoute } from '../FlightMap/routeUtils';
import AirportMarkers from '../FlightMap/AirportMarkers';
import ArrivalChip from '../FlightMap/ArrivalChip';
import type { FlightFilters } from '../FlightMap/filterTypes';
import CountriesLayer from './CountriesLayer';
import MapSearch, { type SearchTarget } from './MapSearch';
import { useSearchLanding } from './useSearchLanding';
import CountryTooltip from './CountryTooltip';
import GlobeJourney from './GlobeJourney';
import PostcardMarker from './PostcardMarker';
import type { ReplayPostcard } from './useReplayOrchestration';
import MapControlPanel, { type TravelMapSettings } from './MapControlPanel';
import MapLegend from './MapLegend';
import MapZoomControls from './MapZoomControls';
import ReplayControl from './ReplayControl';
import type { ReplayState } from './useJourneyReplay';
import type { CountryDisplayInfo } from './countryColors';
import type { LonLat } from './fitBounds';
import {
  MIN_GLOBE_ZOOM,
  MAX_GLOBE_ZOOM,
  buildJourneyTimeline,
  cameraCenter,
  chaseCamera,
  clampGlobeZoom,
  clampLat,
  isOnVisibleSide,
  samplePlaneFrame,
  searchFraming,
  type GlobeCamera,
  type PlaneFrame,
} from './globeUtils';
import { legEndpoints, legMode } from '../FlightMap/routeUtils';
import { modeMedium, type TerrainRequest } from '../../lib/terrainRoute';
import { useTerrainRoutes } from '../../hooks/useTerrainRoutes';

/*
  ZoomPanProvider is exported by react-simple-maps at runtime but missing from
  @types/react-simple-maps. The globe renders map layers without a
  ZoomableGroup (its pan/zoom semantics are wrong for a sphere), and those
  layers read useZoomPanContext() for their zoom factor — without a provider
  that context is undefined and they crash on destructuring. This shim
  provides the context with k=1: on the globe, magnification lives in the
  projection scale, so screen-pixel sizes need no zoom correction at all.
*/
const ZoomPanProvider = (
  ReactSimpleMaps as unknown as {
    ZoomPanProvider: ComponentType<{
      value?: { x: number; y: number; k: number; transformString: string };
      children?: ReactNode;
    }>;
  }
).ZoomPanProvider;

const STATIC_ZOOM_PAN = {
  x: 0,
  y: 0,
  k: 1,
  transformString: 'translate(0 0) scale(1)',
};

/**
 * Degrees of rotation per pixel of drag, scaled by the projection's pixel
 * scale — the classic d3 orthographic-drag constant. At a 250px globe this is
 * 0.3°/px, and zooming in slows the rotation proportionally, so a drag always
 * moves the ground under the cursor by roughly the same visual amount.
 */
const ROTATE_SENSITIVITY = 75;

/** The globe's diameter as a fraction of the container's short side. */
const GLOBE_FILL = 0.9;

/**
 * Chase rate for a search flight. Brisker than the replay's 3.2 cameraman
 * trail: exponential decay from a worst-case antipodal start (180° down to
 * the 0.11° arrival threshold) takes ln(180/0.11)/4.6 ≈ 1.6s, safely inside
 * the airport ping's 2.6s on-screen life.
 */
const SEARCH_CHASE_RATE = 4.6;

/** Arrived: within ~0.11° of the target, in radians (geoDistance's unit). */
const ARRIVAL_RADIANS = 0.002;

/** Deep-space backdrop behind the sphere, per theme. */
const SPACE_BACKDROP = { dark: '#0d0c0b', light: '#e9dbc2' };

const NO_HIGHLIGHTS: string[] = [];

interface GlobeRoutesProps {
  routes: AggregatedRoute[];
  maxCount: number;
  sizeScale: number;
  faded: boolean;
}

/**
 * Aggregate routes as great circles.
 *
 * Deliberately not the flat FlightRoutes: that component bends a quadratic
 * arc between two *projected* points, which on a globe produces curves that
 * neither follow the sphere nor stop at the horizon. A GeoJSON LineString
 * through geoPath gets both right for free — d3 samples the great circle and
 * clips it at clipAngle 90.
 *
 * Non-interactive for v1: hover tooltips and tap-to-select a journey stay on
 * the flat map, so these draw with pointer events off rather than promising
 * a selection the globe cannot yet honour.
 */
function GlobeRoutes({ routes, maxCount, sizeScale, faded }: GlobeRoutesProps) {
  const { map: colors } = useMapColors();
  const { path } = useMapContext();

  return (
    <g className="flight-routes" pointerEvents="none">
      {routes.map((route) => {
        const line: LineString = {
          type: 'LineString',
          coordinates: [
            [Number(route.departure.longitude), Number(route.departure.latitude)],
            [Number(route.arrival.longitude), Number(route.arrival.latitude)],
          ],
        };
        const d = path(line);
        if (!d) return null;
        return (
          <path
            key={route.key}
            d={d}
            fill="none"
            stroke={colors.route}
            strokeWidth={getStrokeWidth(route.count, maxCount, sizeScale)}
            strokeLinecap="round"
            strokeOpacity={faded ? 0.1 : 0.65}
          />
        );
      })}
    </g>
  );
}

interface GlobeViewProps {
  /** TravelMap's measured container ref — reused so the viewport math is shared. */
  containerRef: RefCallback<HTMLDivElement>;
  width: number;
  height: number;
  markerScale: number;
  mapSummary: string;
  countryDisplayMap: Map<string, CountryDisplayInfo>;
  settings: TravelMapSettings;
  onSettingsChange: (settings: TravelMapSettings) => void;
  filters: FlightFilters;
  onFiltersChange: (filters: FlightFilters) => void;
  filterAirports: Airport[];
  filterYears: number[];
  isControlPanelOpen: boolean;
  onControlPanelOpenChange: (open: boolean) => void;
  onGlobeModeChange: (on: boolean) => void;
  routes: AggregatedRoute[];
  maxRouteCount: number;
  airports: Airport[];
  airportVisitCounts: Map<string, number>;
  /* Search: the box and the geography it needs, owned by TravelMap. */
  countries: Country[];
  countryCentroids: Map<string, LonLat>;
  countryBounds: Map<string, [LonLat, LonLat]>;
  /*
    Globe mode persists across loads, so a globe-first session must still
    learn centroids and bounds from its own geography layer — otherwise
    search has nothing to offer until the user visits flat mode once.
  */
  onCentroids: (
    centroids: Map<string, LonLat>,
    bounds?: Map<string, [LonLat, LonLat]>,
  ) => void;
  replay: ReplayState;
  /*
    Country editing on the sphere (D8, 2026-08-14): the same tap-cycle and
    long-press handlers the flat map gets from useCountryInteraction. The
    globe guards them against its own rotate gesture before passing them on.
  */
  onCountryClick?: (isoCode: string) => void | Promise<void>;
  onCountryLongPress?: (isoCode: string) => void | Promise<void>;
  /** The country detail card, built and positioned by TravelMap. */
  detailCard?: ReactNode;
  /** The stop whose postcard is showing during replay (trip photos). */
  postcard?: ReplayPostcard | null;
  /** Cockpit-audio mute, owned by TravelMap with the audio itself. */
  audioMuted?: boolean;
  onToggleAudioMuted?: () => void;
  landedIsoCode: string | null;
  popAirport: { iata: string; key: number } | null;
  yearChip: string | null;
  stats: {
    visitedCount: number;
    transitCount: number;
    totalCountries: number;
    flightRoutes: number;
    airports: number;
  };
  /** Where the camera faces on open and on Reset — the user's own places. */
  homeCenter: LonLat;
}

/**
 * Globe mode: the same world, seen from space.
 *
 * A d3 orthographic projection handed straight to ComposableMap, so
 * CountriesLayer and AirportMarkers reproject without changes. What cannot be
 * reused is navigation (ZoomableGroup pans a plane; a sphere rotates) and
 * route geometry (screen-space arcs vs great circles) — both are owned here.
 *
 * The projection instance is rebuilt per render from camera state; that state
 * is only written through requestAnimationFrame, so the globe re-renders at
 * most once per frame however fast the pointer moves.
 */
function GlobeView({
  containerRef,
  width,
  height,
  markerScale,
  mapSummary,
  countryDisplayMap,
  settings,
  onSettingsChange,
  filters,
  onFiltersChange,
  filterAirports,
  filterYears,
  isControlPanelOpen,
  onControlPanelOpenChange,
  onGlobeModeChange,
  routes,
  maxRouteCount,
  airports,
  airportVisitCounts,
  countries,
  countryCentroids,
  countryBounds,
  onCentroids,
  replay,
  onCountryClick,
  onCountryLongPress,
  detailCard,
  postcard = null,
  audioMuted,
  onToggleAudioMuted,
  landedIsoCode,
  popAirport,
  yearChip,
  stats,
  homeCenter,
}: GlobeViewProps) {
  const { map: colors } = useMapColors();
  const { resolved: theme } = useTheme();
  const canHover = useMediaQuery('(pointer: fine)');

  /*
    The container element, both forwarded to TravelMap's viewport measurement
    and held locally for the native wheel listener below.
  */
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const attachContainer = useCallback<RefCallback<HTMLDivElement>>(
    (node) => {
      setContainer(node);
      containerRef(node);
    },
    [containerRef],
  );

  const baseRadius = (Math.min(width, height) * GLOBE_FILL) / 2;

  /*
    Camera state, mirrored into a ref so pointer handlers and the replay loop
    can read the latest value without re-subscribing every frame.
  */
  const [camera, setCameraState] = useState<GlobeCamera>(() => ({
    rotation: [-homeCenter[0], clampLat(-homeCenter[1])],
    zoom: 1,
  }));
  const cameraRef = useRef(camera);
  const setCamera = useCallback(
    (next: GlobeCamera | ((current: GlobeCamera) => GlobeCamera)) => {
      const value =
        typeof next === 'function' ? next(cameraRef.current) : next;
      cameraRef.current = value;
      setCameraState(value);
    },
    [],
  );

  const [hasMoved, setHasMoved] = useState(false);
  const hasMovedRef = useRef(false);
  const markMoved = useCallback(() => {
    hasMovedRef.current = true;
    setHasMoved(true);
  }, []);

  const replayActiveRef = useRef(replay.isActive);
  useEffect(() => {
    replayActiveRef.current = replay.isActive;
  }, [replay.isActive]);

  /*
    Face the user's own places once the data framing settles — the globe
    equivalent of the flat map's opening view. Only until the user takes the
    camera themselves, and never while the replay is flying it.
  */
  useEffect(() => {
    if (hasMovedRef.current || editPinnedRef.current || replayActiveRef.current)
      return;
    setCamera((current) => ({
      ...current,
      rotation: [-homeCenter[0], clampLat(-homeCenter[1])],
    }));
  }, [homeCenter, setCamera]);

  const projection = useMemo(
    () =>
      geoOrthographic()
        .translate([width / 2, height / 2])
        .scale(baseRadius * camera.zoom)
        .rotate([camera.rotation[0], camera.rotation[1]])
        .clipAngle(90),
    [width, height, baseRadius, camera],
  );

  /*
    Drag-to-rotate and pinch-to-zoom, hand-rolled.

    v1 uses lon/lat deltas rather than versor dragging: horizontal drag spins
    longitude, vertical drag tilts latitude (clamped at the poles so the world
    cannot go upside down). It loses versor's grab-a-point-and-hold-it
    precision near the poles but feels natural everywhere people actually
    fly, and it keeps the whole gesture 20 lines with no new dependency.
  */
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  /** True from the end of a moved gesture until the next pointer-down. */
  const lastGestureMovedRef = useRef(false);
  /*
    Editing a country changes the visit data, which recomputes the framing
    behind homeCenter — and the follow effect below then nudged the camera a
    few degrees on every tap ("the earth tilts"). Once the user edits, the
    camera is theirs; only Reset re-follows.
  */
  const editPinnedRef = useRef(false);
  const dragRef = useRef<{
    rotation: [number, number];
    zoom: number;
    x: number;
    y: number;
    pinch: number | null;
    moved: boolean;
  } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // One camera write per animation frame, however many pointer events arrive.
  const rafRef = useRef<number | null>(null);
  const pendingRef = useRef<GlobeCamera | null>(null);
  const scheduleCamera = useCallback(
    (next: GlobeCamera) => {
      pendingRef.current = next;
      if (rafRef.current !== null) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        if (pendingRef.current) {
          setCamera(pendingRef.current);
          pendingRef.current = null;
        }
      });
    },
    [setCamera],
  );
  useEffect(
    () => () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  /*
    The search flight's own rAF loop, separate from the pointer batching
    above: a landing animates over ~a second with nothing driving it but
    time. Anything with a stronger claim to the camera — a press on the
    globe, a wheel tick, the replay — cancels it.
  */
  const flightRef = useRef<number | null>(null);
  const cancelFlight = useCallback(() => {
    if (flightRef.current !== null) {
      cancelAnimationFrame(flightRef.current);
      flightRef.current = null;
    }
  }, []);
  useEffect(() => cancelFlight, [cancelFlight]);

  /*
    Fidget-spinner physics (owner ask, 2026-08-19: "even if I swipe hard
    it moves just a bit"). A drag used to end where the finger stopped;
    now the release velocity carries the globe on, decaying with an
    exponential friction tuned so a hard flick spins for a few seconds.
    Longitude carries the spin; latitude is damped harder and dies at
    the pole clamp - a fidget spinner has one good axis. Any stronger
    claim on the camera (a press, a wheel tick, the replay, Reset)
    cancels it.
  */
  const inertiaRef = useRef<number | null>(null);
  const spinSamplesRef = useRef<
    { t: number; lon: number; lat: number }[]
  >([]);
  /*
    Motion = a moved drag or a live spin. While true the countries layer
    drops to the coarse atlas and the markers step aside - projecting a
    seventh of the geometry is what keeps the spin at frame rate
    (owner ask, 2026-08-19: "decrease the detail?"). Ref-deduped so
    pointer events do not spam renders.
  */
  const [inMotion, setInMotion] = useState(false);
  const inMotionRef = useRef(false);
  const setMotion = useCallback((value: boolean) => {
    if (inMotionRef.current === value) return;
    inMotionRef.current = value;
    setInMotion(value);
  }, []);
  const cancelInertia = useCallback(() => {
    if (inertiaRef.current !== null) {
      cancelAnimationFrame(inertiaRef.current);
      inertiaRef.current = null;
    }
    setMotion(false);
  }, [setMotion]);
  useEffect(() => cancelInertia, [cancelInertia]);

  const startInertia = useCallback(
    (velocity: [number, number]) => {
      cancelInertia();
      const spin: [number, number] = [...velocity];
      // The loop integrates its OWN position: reading the camera back
      // each frame stuttered whenever a React commit lagged a frame
      // behind, replaying the same base rotation twice.
      let lon = cameraRef.current.rotation[0];
      let lat = cameraRef.current.rotation[1];
      let last = performance.now();
      const tick = (now: number) => {
        // Capped dt so a background-tab stall cannot slingshot the globe.
        const dt = Math.min((now - last) / 1000, 0.05);
        last = now;
        const decay = Math.exp(-dt * 0.8);
        spin[0] *= decay;
        spin[1] *= decay;
        lon += spin[0] * dt;
        const rawLat = lat + spin[1] * dt;
        lat = clampLat(rawLat);
        if (lat !== rawLat) spin[1] = 0; // the pole is a wall, not a spring
        scheduleCamera({
          rotation: [lon, lat],
          zoom: cameraRef.current.zoom,
        });
        // 8°/s, not 3: below that each frame moves sub-pixel and the
        // long tail read as judder rather than glide.
        if (Math.hypot(spin[0], spin[1]) > 8) {
          inertiaRef.current = requestAnimationFrame(tick);
        } else {
          inertiaRef.current = null;
          setMotion(false);
        }
      };
      setMotion(true);
      inertiaRef.current = requestAnimationFrame(tick);
    },
    [cancelInertia, scheduleCamera, setMotion],
  );

  const anchorGesture = useCallback(() => {
    const points = [...pointersRef.current.values()];
    if (points.length === 0) {
      dragRef.current = null;
      return;
    }
    const wasMoved = dragRef.current?.moved ?? false;
    dragRef.current = {
      rotation: cameraRef.current.rotation,
      zoom: cameraRef.current.zoom,
      x: points[0].x,
      y: points[0].y,
      pinch:
        points.length >= 2
          ? Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y)
          : null,
      moved: wasMoved,
    };
  }, []);

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      // The replay owns the camera; fighting it mid-flight snaps the view.
      if (replay.isActive) return;
      /*
        Buttons first, then the map test: every control's ICON is itself an
        SVG, so "did the press land on an svg" was true for the zoom stack
        and the mode toggle too — a press on a button glyph started a drag,
        pointer capture ate the click, and the toggle only "worked" when the
        finger landed on the button's padding.
      */
      if (
        (event.target as Element).closest(
          'button, [role="switch"], input, select, a',
        )
      )
        return;
      // Only a press that lands on the map's own SVG starts a rotation.
      if (!(event.target as Element).closest('svg')) return;
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      // A press on the map takes the camera back from a search flight -
      // and catches a spinning globe.
      cancelFlight();
      cancelInertia();
      spinSamplesRef.current = [];
      /*
        No pointer capture here (D8): capture retargets every later event to
        the container, which starves the country paths — their click never
        fires (the tap-cycle went dead) and their long-press timer never gets
        the move/leave that would cancel it. Capture now happens in
        handlePointerMove, on the first movement past the slop: a clean tap
        never captures and reaches the country like on the flat map, while a
        real drag captures before it can leave the element.
      */
      lastGestureMovedRef.current = false;
      pointersRef.current.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY,
      });
      anchorGesture();
      setIsDragging(true);
    },
    [replay.isActive, anchorGesture, cancelFlight, cancelInertia],
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const point = pointersRef.current.get(event.pointerId);
      const drag = dragRef.current;
      if (!point || !drag) return;
      point.x = event.clientX;
      point.y = event.clientY;

      const points = [...pointersRef.current.values()];
      if (points.length >= 2 && drag.pinch) {
        const distance = Math.hypot(
          points[0].x - points[1].x,
          points[0].y - points[1].y,
        );
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.setPointerCapture(event.pointerId);
        }
        drag.moved = true;
        markMoved();
        setMotion(true);
        scheduleCamera({
          rotation: drag.rotation,
          zoom: clampGlobeZoom(drag.zoom * (distance / drag.pinch)),
        });
        return;
      }

      const dx = event.clientX - drag.x;
      const dy = event.clientY - drag.y;
      if (!drag.moved && Math.abs(dx) + Math.abs(dy) < 3) return;
      if (!drag.moved) {
        // The gesture has become a drag: take the pointer now (see the
        // pointer-down comment), which also fires pointerleave on the
        // country path and cancels its long-press timer.
        event.currentTarget.setPointerCapture(event.pointerId);
      }
      drag.moved = true;
      markMoved();
      setMotion(true);
      // Degrees per pixel shrink as the globe grows, so the ground tracks
      // the finger at any zoom.
      const k = ROTATE_SENSITIVITY / (baseRadius * drag.zoom);
      const nextLon = drag.rotation[0] + dx * k;
      const nextLat = clampLat(drag.rotation[1] - dy * k);
      // The spin gauge: recent positions, so release speed is measured
      // from the gesture's actual tail rather than its average.
      // Event time, not processing time: a heavy frame delays the
      // handler by hundreds of ms, and velocity must not care.
      const now = event.timeStamp;
      const samples = spinSamplesRef.current;
      samples.push({ t: now, lon: nextLon, lat: nextLat });
      // Last six samples, whatever their age: a time-window trim starved
      // on heavy frames (each move re-renders the whole globe), and a
      // slow-start average is handled at release by capping the window.
      while (samples.length > 6) samples.shift();
      scheduleCamera({
        rotation: [nextLon, nextLat],
        zoom: drag.zoom,
      });
    },
    [baseRadius, markMoved, scheduleCamera, setMotion],
  );

  const handlePointerEnd = useCallback((event: React.PointerEvent) => {
    if (!pointersRef.current.delete(event.pointerId)) return;
    if (pointersRef.current.size === 0) {
      if (dragRef.current?.moved) {
        // Same privacy rule as the flat map: the gesture kind, never where
        // it looked.
        track('map_interact', { kind: 'globe-rotate' });
      }
      // Survives the click that follows this pointerup, so the country
      // handlers can tell a tap from the end of a rotation.
      lastGestureMovedRef.current = dragRef.current?.moved ?? false;
      // A moved gesture that ended fast becomes a spin: velocity from
      // the last ~120ms of samples, capped at two revolutions a second.
      const samples = spinSamplesRef.current;
      spinSamplesRef.current = [];
      const lastSample = samples[samples.length - 1];
      if (
        dragRef.current?.moved &&
        samples.length >= 2 &&
        // A finger that STOPPED before lifting is a hold, not a flick -
        // judged by event timestamps, immune to processing lag. 200ms
        // keeps slow devices spinnable without turning holds into spins.
        event.timeStamp - lastSample.t < 200
      ) {
        // Velocity over the freshest ~400ms of the gesture - the flick's
        // tail, not its whole history.
        const first =
          samples.find((sample) => lastSample.t - sample.t <= 400) ?? samples[0];
        const seconds = (lastSample.t - first.t) / 1000;
        if (seconds > 0.008) {
          const lonV = (lastSample.lon - first.lon) / seconds;
          // Latitude flicks damped: a fidget spinner has one good axis.
          const latV = ((lastSample.lat - first.lat) / seconds) * 0.4;
          const speed = Math.hypot(lonV, latV);
          if (speed > 25) {
            /*
              1.7x launch boost (owner feel-test, 2026-08-19: "expected a
              lot faster rotation"): a fidget spinner leaves the hand
              faster than the hand was moving, and the measured tail
              velocity undersells the throw anyway. Capped at three
              revolutions a second.
            */
            const factor = 1.7 * Math.min(1, 1080 / (speed * 1.7));
            startInertia([lonV * factor, latV * factor]);
          }
        }
      }
      dragRef.current = null;
      setIsDragging(false);
      // The fine world returns when the hand lifts WITHOUT a spin;
      // startInertia keeps motion alive until the spin dies.
      if (inertiaRef.current === null) setMotion(false);
    } else {
      anchorGesture();
    }
  }, [anchorGesture, startInertia, setMotion]);

  /*
    Wheel zoom needs preventDefault, and React's root-level wheel listener is
    passive — so this one is attached natively. Exponential scaling keeps
    trackpad and mouse wheels feeling the same.
  */
  useEffect(() => {
    const element = container;
    if (!element) return;
    const onWheel = (event: WheelEvent) => {
      if (replayActiveRef.current) return;
      if (!(event.target as Element).closest('svg')) return;
      event.preventDefault();
      cancelFlight();
      hasMovedRef.current = true;
      setHasMoved(true);
      setCamera((current) => ({
        ...current,
        zoom: clampGlobeZoom(current.zoom * Math.exp(-event.deltaY * 0.0015)),
      }));
    };
    element.addEventListener('wheel', onWheel, { passive: false });
    return () => element.removeEventListener('wheel', onWheel);
  }, [container, setCamera, cancelFlight]);

  /*
    Search landings. The one-shot flight drives the same chaseCamera the
    replay flies on, then snaps exact on arrival so the framing never hangs
    a hair off target. Each tick re-checks who owns the camera: a drag that
    started after the click, or the replay taking off, ends the flight
    mid-arc rather than fighting for the wheel.
  */
  const flyTo = useCallback(
    (target: LonLat, zoomTarget: number) => {
      cancelFlight();
      cancelInertia();
      // A landing is a deliberate move: the data framing stops overriding.
      markMoved();
      let last = performance.now();
      const tick = (now: number) => {
        flightRef.current = null;
        if (replayActiveRef.current || dragRef.current) return;
        const dt = Math.min((now - last) / 1000, 0.1);
        last = now;
        const next = chaseCamera(
          cameraRef.current,
          target,
          zoomTarget,
          dt,
          SEARCH_CHASE_RATE,
        );
        const arrived =
          geoDistance(cameraCenter(next.rotation), target) < ARRIVAL_RADIANS &&
          Math.abs(next.zoom - zoomTarget) < 0.01;
        if (arrived) {
          setCamera({
            rotation: [-target[0], clampLat(-target[1])],
            zoom: zoomTarget,
          });
          return;
        }
        setCamera(next);
        flightRef.current = requestAnimationFrame(tick);
      };
      flightRef.current = requestAnimationFrame(tick);
    },
    [cancelFlight, cancelInertia, markMoved, setCamera],
  );

  const frameSearchTarget = useCallback(
    (target: SearchTarget, box: [LonLat, LonLat] | undefined) =>
      searchFraming(box, target.center),
    [],
  );
  // No detail card on the globe (D7/G1): the card would be the globe's first
  // interactive object, and that interaction is designed with taps, not here.
  const openCountryNoop = useCallback(() => {}, []);
  const { searchBlinkIso, searchPing, handleSearchGo } = useSearchLanding({
    countryBounds,
    frameTarget: frameSearchTarget,
    onFrame: flyTo,
    onOpenCountry: openCountryNoop,
  });

  /*
    "Rotate the globe to follow the planes" — the continuous version.

    While a journey plays, this loop samples where the plane is on its
    great-circle track (same per-leg clock as the flat replay) and eases the
    camera toward that point every frame, with the zoom easing toward a
    framing that fits the journey's longest leg. The camera deliberately
    trails the plane slightly — an exponential chase — which reads as a
    cameraman following an aircraft rather than the aircraft being nailed to
    the screen centre.

    The same loop drives the plane itself (see GlobeJourney for why SMIL is
    the wrong tool here), so the camera and the plane share one clock and
    cannot drift apart.
  */
  const [plane, setPlane] = useState<PlaneFrame | null>(null);

  /*
    Terrain routes for the replayed journey (2026-08-18): the globe has no
    FlightRoutes layer to warm the cache, so it asks the router itself.
    The version bump rebuilds the timeline below, swapping the straight
    interpolators for coast-following ones.
  */
  const replayTerrainRequests = useMemo<TerrainRequest[]>(() => {
    if (!replay.current) return [];
    return (replay.current.legs ?? []).flatMap((leg) => {
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
  }, [replay]);
  const terrainVersion = useTerrainRoutes(replayTerrainRequests);

  useEffect(() => {
    if (!replay.isActive || !replay.current) {
      setPlane(null);
      return;
    }
    // The replay's cameraman does not share the wheel with a spinning globe.
    cancelInertia();
    const timeline = buildJourneyTimeline(replay.current);
    if (!timeline) {
      setPlane(null);
      return;
    }
    // A drag in progress would fight the follow loop for the camera.
    pointersRef.current.clear();
    dragRef.current = null;
    setIsDragging(false);

    const startedAt = performance.now();
    let last = startedAt;
    let raf = 0;
    const tick = (now: number) => {
      const t = (now - startedAt) / 1000;
      // Capped so a background-tab stall cannot slingshot the camera.
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      const frame = samplePlaneFrame(timeline, t);
      setPlane(frame);
      setCamera((current) =>
        // Each leg brings its own zoom: swoop in for the drive, pull
        // back for the crossing (owner, 2026-08-18).
        chaseCamera(current, frame.position, frame.zoomTarget, dt),
      );
      // Once parked, stop looping; the plane waits out the settle pause.
      if (!frame.done) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // terrainVersion: a resolved terrain route swaps the leg interpolator,
    // so the replay clock restarts on the corrected track.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replay.isActive, replay.current, setCamera, terrainVersion]);

  /*
    Horizon culling for point markers: the raw projection maps the hidden
    hemisphere onto the same disk, so airports must be filtered by angular
    distance from the camera centre before AirportMarkers projects them.
  */
  const center = useMemo(() => cameraCenter(camera.rotation), [camera]);
  const visibleAirports = useMemo(
    () =>
      airports.filter((airport) =>
        isOnVisibleSide(
          [Number(airport.longitude), Number(airport.latitude)],
          center,
        ),
      ),
    [airports, center],
  );

  // Country-name tooltip, hover only — same gating as the flat map.
  const [hoveredCountry, setHoveredCountry] = useState<string | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const handleCountryHover = useCallback(
    (name: string | null, event?: React.MouseEvent) => {
      if (dragRef.current) return;
      setHoveredCountry(name);
      if (event && name) {
        setTooltipPosition({ x: event.clientX, y: event.clientY });
      }
    },
    [],
  );
  const handleMouseMove = useCallback(
    (event: React.MouseEvent) => {
      if (hoveredCountry) {
        setTooltipPosition({ x: event.clientX, y: event.clientY });
      }
    },
    [hoveredCountry],
  );

  const handleResetView = useCallback(() => {
    cancelInertia();
    hasMovedRef.current = false;
    editPinnedRef.current = false;
    setHasMoved(false);
    setCamera({
      rotation: [-homeCenter[0], clampLat(-homeCenter[1])],
      zoom: 1,
    });
  }, [homeCenter, setCamera, cancelInertia]);

  /*
    The flat map's tap-cycle and long-press, guarded against the globe's own
    gestures (D8, 2026-08-14). Click fires after the gesture ended, so it
    checks the flag the gesture left behind; the long-press timer fires
    mid-gesture, so it reads the live drag state instead.
  */
  const guardedCountryClick = useMemo(
    () =>
      onCountryClick
        ? (isoCode: string) => {
            if (lastGestureMovedRef.current) return;
            editPinnedRef.current = true;
            void onCountryClick(isoCode);
          }
        : undefined,
    [onCountryClick],
  );
  const guardedCountryLongPress = useMemo(
    () =>
      onCountryLongPress
        ? (isoCode: string) => {
            if (dragRef.current?.moved) return;
            editPinnedRef.current = true;
            void onCountryLongPress(isoCode);
          }
        : undefined,
    [onCountryLongPress],
  );

  const sphereRadius = baseRadius * camera.zoom;

  return (
    <div
      ref={attachContainer}
      className="relative w-full h-full overflow-hidden"
      style={{ backgroundColor: SPACE_BACKDROP[theme] }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onMouseMove={handleMouseMove}
    >
      <ComposableMap
        width={width}
        height={height}
        // The runtime accepts a d3 projection instance directly (it checks
        // `typeof projection === "function"`); the published types only admit
        // a factory signature, hence the cast.
        projection={projection as unknown as ProjectionFunction}
        role="img"
        aria-label={`${mapSummary} Shown as a globe; drag to rotate.`}
        className="w-full h-full"
        style={{
          cursor: replay.isActive
            ? 'default'
            : isDragging
              ? 'grabbing'
              : 'grab',
          /*
            On the SVG, not the container: the globe owns every touch on the
            map itself (otherwise the browser claims drags for scrolling and
            pinches for page zoom), but the overlay cards above it keep
            their own scrollable panels.
          */
          touchAction: 'none',
        }}
      >
        <ZoomPanProvider value={STATIC_ZOOM_PAN}>
          {/* A thin atmosphere: one soft ring just outside the limb. */}
          <circle
            cx={width / 2}
            cy={height / 2}
            r={sphereRadius + 5}
            fill="none"
            stroke={colors.selectedGlow}
            strokeWidth={10}
            strokeOpacity={0.18}
            pointerEvents="none"
          />
          {/* The ocean is the sphere itself. */}
          <Sphere
            id="globe-sphere"
            fill={colors.ocean}
            stroke={colors.countryBorder}
            strokeWidth={1}
          />
          {/* Faint graticule so open ocean still shows the rotation. */}
          <Graticule
            stroke={colors.countryBorder}
            strokeOpacity={0.18}
            strokeWidth={0.4}
            step={[30, 30]}
          />

          <CountriesLayer
            countryDisplayMap={countryDisplayMap}
            showVisitColors={settings.showCountries}
            /*
              The tap-cycle and long-press arrived with D8 (2026-08-14),
              guarded above against the rotate gesture. Withheld during
              replay, same as the flat map: the replay owns the globe.
            */
            onCountryClick={replay.isActive ? undefined : guardedCountryClick}
            onCountryLongPress={
              replay.isActive ? undefined : guardedCountryLongPress
            }
            onCountryHover={canHover ? handleCountryHover : undefined}
            onCentroids={onCentroids}
            landedIsoCode={landedIsoCode}
            blinkIsoCode={searchBlinkIso}
            // Coarse world while the globe is in motion - frame rate
            // over microstates; the fine world returns on settle.
            detail={inMotion ? 'coarse' : 'fine'}
            // Every press here may be the start of a rotation - no flash.
            pressFeedback={false}
          />

          {settings.showFlights && (
            <>
              <GlobeRoutes
                routes={routes}
                maxCount={maxRouteCount}
                sizeScale={markerScale}
                faded={replay.isActive}
              />
              {replay.current && plane && (
                <GlobeJourney
                  journey={replay.current}
                  plane={plane}
                  sizeScale={markerScale}
                />
              )}
            </>
          )}

          {/* Markers step aside while the globe is in motion: dots and
              halo-stroked labels are DOM the spin does not need. */}
          {settings.showAirports && settings.showFlights && !inMotion && (
            <AirportMarkers
              airports={visibleAirports}
              visitCounts={airportVisitCounts}
              highlightedAirports={NO_HIGHLIGHTS}
              sizeScale={markerScale}
              popIata={replay.isActive ? popAirport?.iata : undefined}
              popKey={popAirport?.key}
              // Globe zoom runs 1–8 and the horizon already culls half the
              // world, so labels come out much earlier than on the flat map.
              // labelZoom because the globe pins the context k at 1.
              labelZoom={camera.zoom}
              labelsFromZoom={1.3}
              cityNamesFromZoom={2.8}
            />
          )}

          {/* The postcard above its city — hemisphere-gated like the ping. */}
          {replay.isActive &&
            postcard &&
            isOnVisibleSide([postcard.lon, postcard.lat], center) && (
              <PostcardMarker postcard={postcard} />
            )}

          {/*
            Search ping, same chip as the flat map — gated by hemisphere:
            the raw projection happily maps the far side onto the same disk,
            so an unguarded chip would render mirrored while the flight is
            still bringing its airport around the limb.
          */}
          {searchPing &&
            isOnVisibleSide([searchPing.lon, searchPing.lat], center) && (
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
        </ZoomPanProvider>
      </ComposableMap>

      {/* Year chapter beat, same as the flat replay. */}
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

      {/*
        Same berth and order as the flat map's control column: search on
        top, filters beneath. Both are withheld during replay, which owns
        the camera outright.
      */}
      {!replay.isActive && (
        <div className="absolute top-3 left-3 right-3 md:right-auto md:w-[30rem] z-30 flex flex-col gap-2">
          <MapSearch
            countries={countries}
            countryCentroids={countryCentroids}
            onGo={handleSearchGo}
          />
          <MapControlPanel
            settings={settings}
            onSettingsChange={onSettingsChange}
            filters={filters}
            onFiltersChange={onFiltersChange}
            airports={filterAirports}
            years={filterYears}
            isOpen={isControlPanelOpen}
            onOpenChange={onControlPanelOpenChange}

          />
        </div>
      )}

      {/* Hidden during replay (density budget): the map is the show. */}
      {!replay.isActive && (
        <MapLegend showFlights={settings.showFlights} stats={stats} />
      )}

      {/* The country detail card, built and positioned by TravelMap (D8) —
          opened by tapping a home country or holding any country. */}
      {!replay.isActive && detailCard}


      {replay.isActive && (
        <div className="absolute z-30 top-3 left-3 right-3 md:right-auto md:w-[30rem]">
          <ReplayControl
            replay={replay}
            muted={audioMuted}
            onToggleMuted={onToggleAudioMuted}
          />
        </div>
      )}

      <MapZoomControls
        yieldOnMobile={Boolean(detailCard) && !replay.isActive}
        extraTool={!replay.isActive ? <ReplayControl replay={replay} compact /> : null}
        bottomTool={
          /* Back to flat, mirrored from the flat map's globe button. */
          <button
            type="button"
            onClick={() => onGlobeModeChange(false)}
            aria-label="View as flat map"
            title="View as flat map"
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
              <path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2z" />
              <path d="M9 4v14M15 6v14" />
            </svg>
          </button>
        }
        zoom={camera.zoom}
        minZoom={MIN_GLOBE_ZOOM}
        maxZoom={MAX_GLOBE_ZOOM}
        onZoomIn={() => {
          markMoved();
          setCamera((current) => ({
            ...current,
            zoom: clampGlobeZoom(current.zoom * 1.5),
          }));
        }}
        onZoomOut={() => {
          markMoved();
          setCamera((current) => ({
            ...current,
            zoom: clampGlobeZoom(current.zoom / 1.5),
          }));
        }}
        canReset={hasMoved}
        onReset={handleResetView}
      />

      {canHover && (
        <CountryTooltip name={hoveredCountry} position={tooltipPosition} />
      )}
    </div>
  );
}

export default memo(GlobeView);
