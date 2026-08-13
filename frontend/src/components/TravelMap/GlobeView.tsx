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
import { geoOrthographic } from 'd3-geo';
import type { LineString } from 'geojson';
import type { Airport } from '../../types';
import { track } from '../../lib/analytics';
import { useMapColors } from '../../theme/mapColors';
import { useTheme } from '../../features/theme/ThemeContext';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { getStrokeWidth, type AggregatedRoute } from '../FlightMap/routeUtils';
import AirportMarkers from '../FlightMap/AirportMarkers';
import type { FlightFilters } from '../FlightMap/filterTypes';
import CountriesLayer from './CountriesLayer';
import CountryTooltip from './CountryTooltip';
import GlobeJourney from './GlobeJourney';
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
  type GlobeCamera,
  type PlaneFrame,
} from './globeUtils';

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
  replay: ReplayState;
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
  replay,
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
    if (hasMovedRef.current || replayActiveRef.current) return;
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
      event.currentTarget.setPointerCapture(event.pointerId);
      pointersRef.current.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY,
      });
      anchorGesture();
      setIsDragging(true);
    },
    [replay.isActive, anchorGesture],
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
        drag.moved = true;
        markMoved();
        scheduleCamera({
          rotation: drag.rotation,
          zoom: clampGlobeZoom(drag.zoom * (distance / drag.pinch)),
        });
        return;
      }

      const dx = event.clientX - drag.x;
      const dy = event.clientY - drag.y;
      if (!drag.moved && Math.abs(dx) + Math.abs(dy) < 3) return;
      drag.moved = true;
      markMoved();
      // Degrees per pixel shrink as the globe grows, so the ground tracks
      // the finger at any zoom.
      const k = ROTATE_SENSITIVITY / (baseRadius * drag.zoom);
      scheduleCamera({
        rotation: [
          drag.rotation[0] + dx * k,
          clampLat(drag.rotation[1] - dy * k),
        ],
        zoom: drag.zoom,
      });
    },
    [baseRadius, markMoved, scheduleCamera],
  );

  const handlePointerEnd = useCallback((event: React.PointerEvent) => {
    if (!pointersRef.current.delete(event.pointerId)) return;
    if (pointersRef.current.size === 0) {
      if (dragRef.current?.moved) {
        // Same privacy rule as the flat map: the gesture kind, never where
        // it looked.
        track('map_interact', { kind: 'globe-rotate' });
      }
      dragRef.current = null;
      setIsDragging(false);
    } else {
      anchorGesture();
    }
  }, [anchorGesture]);

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
      hasMovedRef.current = true;
      setHasMoved(true);
      setCamera((current) => ({
        ...current,
        zoom: clampGlobeZoom(current.zoom * Math.exp(-event.deltaY * 0.0015)),
      }));
    };
    element.addEventListener('wheel', onWheel, { passive: false });
    return () => element.removeEventListener('wheel', onWheel);
  }, [container, setCamera]);

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

  useEffect(() => {
    if (!replay.isActive || !replay.current) {
      setPlane(null);
      return;
    }
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
        chaseCamera(current, frame.position, timeline.zoomTarget, dt),
      );
      // Once parked, stop looping; the plane waits out the settle pause.
      if (!frame.done) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [replay.isActive, replay.current, setCamera]);

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
    hasMovedRef.current = false;
    setHasMoved(false);
    setCamera({
      rotation: [-homeCenter[0], clampLat(-homeCenter[1])],
      zoom: 1,
    });
  }, [homeCenter, setCamera]);

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
              No click or long-press: the tap-cycle edits real data, and v1
              defers country editing to the flat map. Omitting the handlers
              renders the layer read-only, so nothing lights up promising an
              interaction that is not there.
            */
            onCountryHover={canHover ? handleCountryHover : undefined}
            landedIsoCode={landedIsoCode}
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

          {settings.showAirports && settings.showFlights && (
            <AirportMarkers
              airports={visibleAirports}
              visitCounts={airportVisitCounts}
              highlightedAirports={NO_HIGHLIGHTS}
              sizeScale={markerScale}
              popIata={replay.isActive ? popAirport?.iata : undefined}
              popKey={popAirport?.key}
            />
          )}
        </ZoomPanProvider>
      </ComposableMap>

      {/* Year chapter beat, same as the flat replay. */}
      {replay.isActive && yearChip && (
        <div
          key={yearChip}
          aria-hidden="true"
          className="year-chip absolute top-16 left-1/2 z-30 map-glass rounded-2xl border shadow-xl
            px-6 py-2 font-display text-3xl pointer-events-none"
        >
          {yearChip}
        </div>
      )}

      {/*
        Same berth as the flat map's control column. Search is absent by
        design: fit-to-country framing is deferred to flat mode for v1.
      */}
      {!replay.isActive && (
        <div className="absolute top-3 left-3 right-3 md:right-auto md:w-[30rem] z-30 flex flex-col gap-2">
          <MapControlPanel
            settings={settings}
            onSettingsChange={onSettingsChange}
            filters={filters}
            onFiltersChange={onFiltersChange}
            airports={filterAirports}
            years={filterYears}
            isOpen={isControlPanelOpen}
            onOpenChange={onControlPanelOpenChange}
            globeMode
            onGlobeModeChange={onGlobeModeChange}
          />
        </div>
      )}

      <MapLegend showFlights={settings.showFlights} stats={stats} />

      {replay.isActive && (
        <div className="absolute z-30 top-3 left-3 right-3 md:right-auto md:w-[30rem]">
          <ReplayControl replay={replay} />
        </div>
      )}

      <MapZoomControls
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
