import { memo, useEffect, useRef, useState } from 'react';
import { Geographies, Geography } from 'react-simple-maps';
import { geoCentroid } from 'd3-geo';
import { numericToAlpha3 } from './isoCodes';
import {
  getCountryColor,
  getCountryHoverColor,
  getCountryPressedColor,
  type CountryDisplayInfo,
} from './countryColors';
import { useMapColors } from '../../theme/mapColors';

export const GEO_URL =
  'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

/*
  Fetch the world once per page, not once per mount.

  <Geographies geography={url}> refetches whenever it mounts, and the shell
  unmounts the map to show a full-screen section — so opening Share threw the
  world away and asked for it again, leaving the share card waiting on a
  network round trip that the map had already completed. Handing the parsed
  object to <Geographies> instead skips fetching entirely.

  A module-level promise, so concurrent mounts share one request.
*/
let geographyPromise: Promise<unknown> | null = null;

export function loadGeography(): Promise<unknown> {
  geographyPromise ??= fetch(GEO_URL)
    .then((response) => {
      if (!response.ok) throw new Error(`Geography fetch failed: ${response.status}`);
      return response.json();
    })
    .catch((error) => {
      // Do not cache a failure: the next mount should be able to retry.
      geographyPromise = null;
      throw error;
    });
  return geographyPromise;
}

interface CountriesLayerProps {
  countryDisplayMap: Map<string, CountryDisplayInfo>;
  /** When false, every country renders as plain land. */
  showVisitColors?: boolean;
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
  onCentroids?: (centroids: Map<string, [number, number]>) => void;
  /**
   * Press and hold a country.
   *
   * Gives the visit-type control a route that does not involve opening a
   * panel: hold anywhere on the map and set trip / transit / home right
   * there.
   */
  onCountryLongPress?: (isoCode: string) => void;
  /** Alpha-3 of a country the replay has just landed in; pulses once. */
  landedIsoCode?: string | null;
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
}: CountriesLayerProps) {
  const isInteractive = Boolean(onCountryClick);
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
    loadGeography()
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
  const { map: colors, hover, pressed } = useMapColors();

  /*
    Render nothing until the world has arrived. An empty placeholder topology
    is not a safe stand-in: Geographies reads the first object's type and
    throws on undefined, which took the whole map down.
  */
  if (!geography) return null;

  return (
    <Geographies geography={geography}>
      {({
        geographies,
      }: {
        geographies: {
          id: string;
          rsmKey: string;
          properties?: { name?: string };
        }[];
      }) => {
        if (onCentroids && !reportedRef.current && geographies.length > 0) {
          reportedRef.current = true;
          const centroids = new Map<string, [number, number]>();
          for (const geo of geographies) {
            const iso = numericToAlpha3[String(parseInt(geo.id, 10))];
            if (!iso) continue;
            const centre = geoCentroid(geo as never);
            if (Number.isFinite(centre[0]) && Number.isFinite(centre[1])) {
              centroids.set(iso, [centre[0], centre[1]]);
            }
          }
          // Deferred: this runs inside Geographies' render callback, and
          // setting parent state during render warns and can loop.
          queueMicrotask(() => onCentroids(centroids));
        }

        return geographies.map((geo) => {
          const numericCode = String(parseInt(geo.id, 10));
          const isoCode = numericToAlpha3[numericCode];
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

          return (
            <Geography
              key={geo.rsmKey}
              geography={geo}
              /* Keyed by the landing too, so re-landing in the same country
                 restarts the animation instead of being ignored as an
                 unchanged class. */
              className={isoCode && isoCode === landedIsoCode ? 'country-landed' : undefined}
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
              onMouseEnter={(event) =>
                onCountryHover?.(geo.properties?.name ?? null, event)
              }
              onMouseLeave={() => onCountryHover?.(null)}
              style={{
                default: {
                  fill: fillColor,
                  stroke: colors.countryBorder,
                  strokeWidth: 0.5,
                  outline: 'none',
                  // Countries wash in and out instead of snapping, so adding
                  // one reads as something happening rather than a repaint.
                  transition: 'fill 400ms ease-out',
                },
                hover: {
                  // A read-only map should not suggest the countries respond.
                  fill: isInteractive ? hoverColor : fillColor,
                  stroke: colors.countryBorder,
                  strokeWidth: 0.5,
                  outline: 'none',
                  cursor: clickable ? 'pointer' : 'default',
                },
                pressed: {
                  fill: isInteractive ? pressedColor : fillColor,
                  stroke: colors.countryBorder,
                  strokeWidth: 0.5,
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
