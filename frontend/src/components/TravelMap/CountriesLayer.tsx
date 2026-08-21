import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Geographies, Geography } from 'react-simple-maps';
import { geoBounds, geoCentroid } from 'd3-geo';
import { feature as topoFeature } from 'topojson-client';
import { numericToAlpha3, nameToAlpha3 } from './isoCodes';
import {
  getCountryColor,
  getCountryHoverColor,
  getCountryPressedColor,
  type CountryDisplayInfo,
} from './countryColors';
import { useMapColors } from '../../theme/mapColors';

// The loader and URL live in lib/worldAtlas so the daily puzzle can share
// the identical world without importing react-simple-maps.
import { loadWorldAtlas, loadWorldAtlasCoarse } from '../../lib/worldAtlas';

/**
 * A feature's alpha-3, by numeric id or - for id-less features like
 * Kosovo - by name. Undefined means "no country row can ever match":
 * the shape stays plain land.
 */
function geoToAlpha3(geo: {
  id?: string;
  properties?: { name?: string };
}): string | undefined {
  const byId = numericToAlpha3[String(parseInt(geo.id ?? '', 10))];
  if (byId) return byId;
  const name = geo.properties?.name;
  return name ? nameToAlpha3[name] : undefined;
}

const RADIANS = Math.PI / 180;

/** Great-circle angle between two lon/lat points, in degrees. */
function angularDistance(
  [lonA, latA]: [number, number],
  [lonB, latB]: [number, number],
): number {
  const phiA = latA * RADIANS;
  const phiB = latB * RADIANS;
  const cosine =
    Math.sin(phiA) * Math.sin(phiB) +
    Math.cos(phiA) * Math.cos(phiB) * Math.cos((lonB - lonA) * RADIANS);
  return Math.acos(Math.min(1, Math.max(-1, cosine))) / RADIANS;
}

/*
  Culling runs off a rounded rotation, and the horizon test carries a
  margin wider than that rounding.

  The rounding is what makes it affordable: <Geographies> re-runs its
  whole pipeline whenever the collection it is given changes identity, so
  a set recomputed every frame would cost more than the culling saves.
  Rounded to 10 degrees, the visible set only changes every few frames of
  a spin. The margin then guarantees the coarse rounding can never hide
  something that belongs on screen - a country is dropped only when it is
  comfortably round the back.
*/
const CULL_BUCKET_DEG = 10;
const CULL_MARGIN_DEG = 15;

interface FeatureCollectionish {
  features: { id?: string; properties?: { name?: string } }[];
}

/** A converted atlas plus the measurements the culler needs from it. */
interface DerivedAtlas {
  collection: FeatureCollectionish;
  shapes: ({ centre: [number, number]; radius: number } | null)[];
}

interface CountriesLayerProps {
  countryDisplayMap: Map<string, CountryDisplayInfo>;
  /** When false, every country renders as plain land. */
  showVisitColors?: boolean;
  /**
   * Geometry level of detail (2026-08-19): 'coarse' projects the 110m
   * atlas - a seventh of the fine geometry - which is what keeps a
   * spinning globe at frame rate. The caller flips it back to 'fine'
   * (the default) when the camera settles; until the coarse file has
   * loaded, fine keeps rendering so the world never blanks.
   */
  detail?: 'fine' | 'coarse';
  /**
   * Pressed-state fill on pointer-down. The globe turns this off: every
   * press there is potentially the start of a rotation, so the flash
   * read as "country blinks selected on each swipe" - its tap-cycle
   * already answers with the actual fill change.
   */
  pressFeedback?: boolean;
  /** Omit to render a read-only map — used by the public shared view. */
  onCountryClick?: (isoCode: string) => void;
  /**
   * Hover reporting for the country tooltip. Omitted on touch, where there is
   * no hover and a cursor-following label has nothing to follow.
   */
  onCountryHover?: (name: string | null, event?: React.MouseEvent) => void;
  /**
   * Reports each country's centroid once the geography has loaded, keyed by
   * alpha-3.
   *
   * Countries carry no coordinates in our database — only the TopoJSON knows
   * where they are — so anything that needs to frame a view around visited
   * countries has to learn it from here.
   */
  onCentroids?: (
    centroids: Map<string, [number, number]>,
    /** [minLon,minLat],[maxLon,maxLat] per country — lets search fit-zoom
        a whole country instead of landing at a fixed continental distance. */
    bounds?: Map<string, [[number, number], [number, number]]>,
  ) => void;
  /**
   * Press and hold a country.
   *
   * Gives the visit-type control a route that does not involve opening a
   * panel: hold anywhere on the map and set trip / transit / home right
   * there.
   */
  onCountryLongPress?: (isoCode: string) => void;
  /**
   * The globe's camera rotation, which turns on horizon culling.
   *
   * On a sphere roughly half the countries are behind the planet, and
   * clipAngle(90) discards them - but only AFTER paying to rotate and
   * clip every one of their points. Handing over the rotation lets this
   * layer drop them before the projection ever sees them. Omitted by the
   * flat map, where every country is genuinely on screen.
   */
  horizonRotation?: [number, number];
  /** Alpha-3 of a country the replay has just landed in; pulses once. */
  landedIsoCode?: string | null;
  /** Search landing: this country blinks three times so it can be found. */
  blinkIsoCode?: string | null;
  /**
   * Hold borders at a constant on-screen width regardless of zoom.
   *
   * Right for anything a person can zoom, and wrong for the export canvas:
   * that SVG is rasterised at its own size and then upscaled into the share
   * card, so a stroke pinned to device pixels comes out a faint hairline
   * rather than a border.
   */
  constantBorderWidth?: boolean;
}

/**
 * The country geography layer, shared by the interactive map and the public
 * read-only one. Kept separate so the two cannot drift apart visually.
 */
function CountriesLayer({
  countryDisplayMap,
  showVisitColors = true,
  onCountryClick,
  onCountryHover,
  onCentroids,
  onCountryLongPress,
  landedIsoCode,
  blinkIsoCode,
  constantBorderWidth = true,
  detail = 'fine',
  pressFeedback = true,
  horizonRotation,
}: CountriesLayerProps) {
  const isInteractive = Boolean(onCountryClick);
  const vectorEffect = constantBorderWidth ? 'non-scaling-stroke' : undefined;
  // Reported once per geography load, not once per render.
  const reportedRef = useRef(false);

  /*
    Long-press plumbing.

    A hold has to cancel if the finger moves, or every pan of the map would
    fire it. The timer is also cleared on pointerup, and a fired press
    swallows the click that follows it so the tap handler does not run too.
  */
  const pressTimerRef = useRef<number | null>(null);
  const pressFiredRef = useRef(false);
  const pressOriginRef = useRef<{ x: number; y: number } | null>(null);

  const cancelPress = () => {
    if (pressTimerRef.current !== null) {
      window.clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  };

  const [geography, setGeography] = useState<unknown>(null);
  useEffect(() => {
    let active = true;
    loadWorldAtlas()
      .then((data) => {
        if (active) setGeography(data);
      })
      .catch(() => {
        /* The map simply stays empty; there is no useful recovery here. */
      });
    return () => {
      active = false;
    };
  }, []);

  // The coarse world loads lazily, the first time motion asks for it.
  const [coarseGeography, setCoarseGeography] = useState<unknown>(null);
  useEffect(() => {
    if (detail !== 'coarse' || coarseGeography) return;
    let active = true;
    loadWorldAtlasCoarse()
      .then((data) => {
        if (active) setCoarseGeography(data);
      })
      .catch(() => {
        /* Fine detail keeps rendering; motion is merely less smooth. */
      });
    return () => {
      active = false;
    };
  }, [detail, coarseGeography]);

  const activeGeography =
    detail === 'coarse' && coarseGeography ? coarseGeography : geography;

  /*
    Hand <Geographies> GeoJSON, not the raw topology (2026-08-21).

    Given a topology it does two things per render, and one of them is
    pure waste for us. It converts the topology to features - fine, but
    it also builds the outline and borders MESHES and runs both through
    the projection. Its memo is keyed on the path function, which is a
    new function on every camera change, so a spinning globe re-projected
    the whole world three times a frame: once as countries, once as an
    outline, once as a border mesh. This layer draws its own per-country
    paths and has never rendered either mesh.

    getMesh() returns null for anything that is not a Topology, so
    converting here - once per atlas, memoised - makes prepareMesh a
    no-op and leaves only the projection work we actually use.
  */
  /*
    Derived per atlas and kept, not recomputed on every swap.

    useMemo remembers exactly one result, and the LOD flips between two
    atlases - so every swap threw the other one's work away and redid it.
    That work is not small: converting the topology, and then measuring
    each country's centroid and bounding box for the culler, walks all
    80,000 points of the fine world. Both atlases are computed once each
    and held in a Map keyed on the topology object, so a swap costs
    nothing beyond the render itself.
  */
  const derivedRef = useRef(new Map<unknown, DerivedAtlas>());
  const deriveAtlas = (topology: unknown): DerivedAtlas | null => {
    if (!topology) return null;
    const cached = derivedRef.current.get(topology);
    if (cached) return cached;
    const source = topology as { objects: Record<string, never> };
    const collection = topoFeature(
      source as never,
      source.objects.countries ??
        source.objects[Object.keys(source.objects)[0]],
    ) as unknown as FeatureCollectionish;

    /*
      Each country's centroid and angular radius. The radius is the
      widest reach from the centroid to a corner of its bounding box, so
      the horizon test can ask whether ANY part of the country could
      still be in front - Russia stays on screen long after its centroid
      has gone round the back.
    */
    const shapes = collection.features.map((geo) => {
      const centre = geoCentroid(geo as never) as [number, number];
      if (!Number.isFinite(centre[0]) || !Number.isFinite(centre[1])) {
        return null;
      }
      const box = geoBounds(geo as never);
      const corners: [number, number][] = [
        [box[0][0], box[0][1]],
        [box[0][0], box[1][1]],
        [box[1][0], box[0][1]],
        [box[1][0], box[1][1]],
      ];
      let radius = 0;
      for (const corner of corners) {
        const reach = angularDistance(centre, corner);
        if (Number.isFinite(reach)) radius = Math.max(radius, reach);
      }
      // An unmeasurable shape is never culled: wrong on screen is worse
      // than slow.
      return Number.isFinite(radius) ? { centre, radius } : null;
    });

    const entry: DerivedAtlas = { collection, shapes };
    derivedRef.current.set(topology, entry);
    return entry;
  };

  const activeAtlas = deriveAtlas(activeGeography);
  const featureCollection = activeAtlas?.collection ?? null;
  const cullGeometry = activeAtlas?.shapes ?? null;

  /*
    Centroids are reported from the FINE atlas, in full, regardless of
    what is currently drawn (2026-08-21).

    This used to run inside the Geographies render callback over whatever
    was on screen. Two things now make that wrong: horizon culling means
    the visible set is a fraction of the world, and the coarse atlas is
    missing microstates entirely - so anything framing a view around a
    visited country could have learned a partial map, or none. Reading
    the fine collection directly also keeps this work out of the render
    path it used to sit in.
  */
  const fineFeatures = deriveAtlas(geography)?.collection.features ?? null;

  useEffect(() => {
    if (!onCentroids || !fineFeatures || reportedRef.current) return;
    reportedRef.current = true;
    const centroids = new Map<string, [number, number]>();
    const bounds = new Map<string, [[number, number], [number, number]]>();
    for (const geo of fineFeatures) {
      const iso = geoToAlpha3(geo);
      if (!iso) continue;
      const centre = geoCentroid(geo as never);
      if (Number.isFinite(centre[0]) && Number.isFinite(centre[1])) {
        centroids.set(iso, [centre[0], centre[1]]);
      }
      const box = geoBounds(geo as never);
      if (box.every((corner) => corner.every(Number.isFinite))) {
        bounds.set(iso, [
          [box[0][0], box[0][1]],
          [box[1][0], box[1][1]],
        ]);
      }
    }
    onCentroids(centroids, bounds);
  }, [onCentroids, fineFeatures]);

  /*
    Drop the countries that are entirely behind the planet. Identity is
    keyed on the ROUNDED rotation, so the collection handed to
    <Geographies> holds still for a bucket's worth of spin.
  */
  const bucketLon = horizonRotation
    ? Math.round(horizonRotation[0] / CULL_BUCKET_DEG)
    : 0;
  const bucketLat = horizonRotation
    ? Math.round(horizonRotation[1] / CULL_BUCKET_DEG)
    : 0;
  const visibleCollection = useMemo(() => {
    if (!featureCollection) return null;
    if (!horizonRotation || !cullGeometry) return featureCollection;
    // A d3 rotation is the negation of the point facing the camera.
    const viewCentre: [number, number] = [
      -bucketLon * CULL_BUCKET_DEG,
      -bucketLat * CULL_BUCKET_DEG,
    ];
    const collection = featureCollection as unknown as { features: unknown[] };
    const visible = collection.features.filter((_, index) => {
      const shape = cullGeometry[index];
      if (!shape) return true;
      return (
        angularDistance(viewCentre, shape.centre) - shape.radius <=
        90 + CULL_MARGIN_DEG
      );
    });
    return { ...collection, features: visible };
    // horizonRotation itself is deliberately absent: the bucket is what
    // may change identity here, not every degree of a drag.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [featureCollection, cullGeometry, Boolean(horizonRotation), bucketLon, bucketLat]);

  /*
    The wash-in transition (fill 400ms) exists so ADDING a country reads
    as an event - but an LOD swap remounts every path, and the remount
    re-ran the wash on the whole world: every visited country blinked on
    each swipe (owner report, 2026-08-19). Transitions sleep while
    coarse, stay off through the settle remount, and re-arm a beat
    later so the tap-cycle keeps its wash.
  */
  const [transitionsArmed, setTransitionsArmed] = useState(true);
  useEffect(() => {
    if (detail === 'coarse') {
      setTransitionsArmed(false);
      return;
    }
    const timer = window.setTimeout(() => setTransitionsArmed(true), 250);
    return () => window.clearTimeout(timer);
  }, [detail]);
  const fillTransition =
    detail === 'coarse' || !transitionsArmed
      ? 'none'
      : 'fill 400ms ease-out';
  const { map: colors, hover, pressed } = useMapColors();

  /*
    Render nothing until the world has arrived. An empty placeholder topology
    is not a safe stand-in: Geographies reads the first object's type and
    throws on undefined, which took the whole map down.
  */
  if (!visibleCollection) return null;

  return (
    <Geographies geography={visibleCollection}>
      {({
        geographies,
      }: {
        geographies: {
          id: string;
          rsmKey: string;
          properties?: { name?: string };
        }[];
      }) => {
        return geographies.map((geo) => {
          const isoCode = geoToAlpha3(geo);
          const displayInfo = isoCode
            ? countryDisplayMap.get(isoCode)
            : undefined;
          const visitType = displayInfo?.visitType || 'none';
          const isHome = displayInfo?.isHome || false;

          const fillColor = showVisitColors
            ? getCountryColor(colors, visitType, isHome)
            : colors.land;
          const hoverColor = showVisitColors
            ? getCountryHoverColor(hover, visitType, isHome)
            : hover.land;
          const pressedColor = showVisitColors
            ? getCountryPressedColor(pressed, visitType, isHome)
            : pressed.land;

          const clickable = isInteractive && Boolean(isoCode) && showVisitColors;

          /*
            The landing flash.

            A drop-shadow halo alone was invisible: a terracotta country on a
            near-black map has nothing for a glow to read against. Changing
            the fill is what says "you arrived here". The 400ms fill
            transition already on this element washes it in and back out.

            colors.home is the flash colour because it inverts with the theme —
            near-white on the dark map, near-black on the light one — so it is
            the highest-contrast thing available against land in both. The
            first attempt used colors.selected, which is a muted salmon barely
            distinguishable from an already-terracotta country.
          */
          const isLanded = Boolean(isoCode && isoCode === landedIsoCode);
          // Opacity animation, not fill: fill is inline-styled per state
          // above, and opacity blinks read against both land and visited
          // colors without fighting it.
          const isBlinking = Boolean(isoCode && isoCode === blinkIsoCode);

          return (
            <Geography
              key={geo.rsmKey}
              geography={geo}
              className={isBlinking ? 'country-blink' : undefined}
              /*
                Out of the tab order.

                react-simple-maps puts tabIndex={0} on every Geography, which
                gave the map 177 tab stops. Each one was unnamed (a screen
                reader announces nothing useful for a bare <path>), had no
                role, and — measured, not assumed — did nothing when
                activated: onClick is a mouse handler, and SVG shapes have no
                default Enter/Space behaviour, so a keyboard user tabbed
                through 177 countries and could not select one.

                Naming them all would fix the announcement and leave the
                interaction broken and the tab order unusable. The countries
                are reachable, searchable and editable in the Countries
                section, so the honest fix is to stop pretending these are
                controls: the parent <svg> carries role="img" and a summary
                that points there.
              */
              tabIndex={-1}
              aria-hidden="true"
              /* The tap chooser reads the country under an ambiguous tap
                 via elementsFromPoint (2026-08-18). */
              data-country-iso={isoCode ?? undefined}
              onClick={() => {
                // The hold already acted; do not also treat it as a tap.
                if (pressFiredRef.current) {
                  pressFiredRef.current = false;
                  return;
                }
                if (clickable && isoCode) onCountryClick?.(isoCode);
              }}
              onPointerDown={(event) => {
                if (!onCountryLongPress || !isoCode) return;
                pressFiredRef.current = false;
                pressOriginRef.current = { x: event.clientX, y: event.clientY };
                cancelPress();
                // 500ms: long enough not to fire on a slow tap, short enough
                // not to feel like the app has hung.
                pressTimerRef.current = window.setTimeout(() => {
                  pressFiredRef.current = true;
                  onCountryLongPress(isoCode);
                }, 500);
              }}
              onPointerMove={(event) => {
                const origin = pressOriginRef.current;
                if (!origin) return;
                const moved = Math.hypot(
                  event.clientX - origin.x,
                  event.clientY - origin.y
                );
                // Same slop as the tap guard: a hold that drifts is a pan.
                if (moved > 14) cancelPress();
              }}
              onPointerUp={cancelPress}
              onPointerLeave={cancelPress}
              /*
                Desktop mirror of the mobile long-press (friend feedback,
                2026-08-17): right-click opens the country card instead of
                the browser menu. pressFired stops the click that some
                browsers deliver after contextmenu from also cycling.
              */
              onContextMenu={(event) => {
                if (!onCountryLongPress || !isoCode || !clickable) return;
                event.preventDefault();
                cancelPress();
                pressFiredRef.current = true;
                onCountryLongPress(isoCode);
              }}
              onMouseEnter={(event) =>
                onCountryHover?.(geo.properties?.name ?? null, event)
              }
              onMouseLeave={() => onCountryHover?.(null)}
              style={{
                default: {
                  // Blink borrows the landing flash's color logic: home is
                  // the highest-contrast value against land in both themes —
                  // opacity alone faded dark-on-dark and was easy to miss.
                  fill: isLanded || isBlinking ? colors.home : fillColor,
                  stroke:
                    isLanded || isBlinking
                      ? colors.home
                      : visitType !== 'none'
                        ? colors.visitedBorder
                        : colors.countryBorder,
                  strokeWidth: isLanded || isBlinking ? 1.5 : 0.5,
                  /*
                    Borders in screen pixels, not map units.

                    ZoomableGroup scales this whole layer, so a plain 0.5
                    stroke painted at 4px once you reached zoom 8 — the
                    borders grew heaviest exactly when you were zooming in to
                    pick detail apart, and swallowed the airports and routes
                    between them. Everything on the flight layer already holds
                    a constant screen size through getZoomAdjustedSize; this
                    is the CSS equivalent, and unlike recomputing a width from
                    the zoom level it costs no re-render of 180 geographies
                    per frame.
                  */
                  vectorEffect,
                  outline: 'none',
                  // Countries wash in and out instead of snapping, so adding
                  // one reads as something happening rather than a repaint.
                  // (Suspended around LOD swaps - see fillTransition above.)
                  transition: fillTransition,
                },
                hover: {
                  // A read-only map should not suggest the countries
                  // respond - and neither should a map IN MOTION: the
                  // LOD swap remounts every path, re-firing enter events
                  // under the cursor, which flashed the country on every
                  // swipe (owner report, 2026-08-19).
                  fill:
                    isInteractive && detail !== 'coarse'
                      ? hoverColor
                      : fillColor,
                  stroke: colors.countryBorder,
                  strokeWidth: 0.5,
                  vectorEffect,
                  outline: 'none',
                  cursor: clickable ? 'pointer' : 'default',
                },
                pressed: {
                  fill:
                    isInteractive && pressFeedback && detail !== 'coarse'
                      ? pressedColor
                      : fillColor,
                  stroke: colors.countryBorder,
                  strokeWidth: 0.5,
                  vectorEffect,
                  outline: 'none',
                },
              }}
            />
          );
        });
      }}
    </Geographies>
  );
}

export default memo(CountriesLayer);
