export type LonLat = [number, number];

export interface Framing {
  center: LonLat;
  zoom: number;
}

export interface FitOptions {
  /** Never zoom past this, however tight the data is. */
  maxZoom?: number;
  /** Never zoom below this — 1 is the whole world. */
  minZoom?: number;
  /** Fraction of the frame the data should occupy. */
  fill?: number;
}

/**
 * The visible span at zoom 1, in degrees. The projection is not linear in
 * latitude, so these are deliberately approximate: the result is padded and
 * clamped, and being a little too wide is invisible while being too tight
 * crops someone's trip off the edge.
 */
const WORLD_LON_SPAN = 360;
const WORLD_LAT_SPAN = 150;

/**
 * Longitudinal span that accounts for the antimeridian.
 *
 * Someone with Auckland and Los Angeles spans 200° the naive way and 160° the
 * short way, across the Pacific — which is also the way their flight actually
 * went. Taking the widest gap between consecutive longitudes and treating the
 * rest as the span gives the tighter, truer frame, and a centre in the ocean
 * between them rather than over Africa.
 */
function longitudeSpan(lons: number[]): { span: number; center: number } {
  const sorted = [...lons].sort((a, b) => a - b);

  let widestGap = -Infinity;
  let gapStart = 0;
  for (let i = 0; i < sorted.length; i++) {
    const current = sorted[i];
    const next = i === sorted.length - 1 ? sorted[0] + 360 : sorted[i + 1];
    const gap = next - current;
    if (gap > widestGap) {
      widestGap = gap;
      gapStart = current;
    }
  }

  const span = 360 - widestGap;
  // The frame runs from the end of the widest gap round to its start.
  let center = gapStart + widestGap + span / 2;
  center = ((center + 540) % 360) - 180;
  return { span, center };
}

/**
 * Frame a set of places.
 *
 * Returns null when there is nothing to frame, so callers can fall back to
 * their own default view rather than being handed a meaningless centre.
 */
export function fitToPoints(
  points: LonLat[],
  { maxZoom = 4, minZoom = 1, fill = 0.7 }: FitOptions = {},
): Framing | null {
  /*
    Coerce before validating.

    Postgres returns numeric columns as strings through pg, so an airport's
    longitude arrives as "23.4062" rather than 23.4062. Number.isFinite on a
    string is false, so every airport was being discarded here — silently,
    since the function just returns null and callers fall back to a default.
    That is why the replay camera never moved and why the opening view was
    framed on country centroids alone.
  */
  const valid = points
    .map(([lon, lat]) => [Number(lon), Number(lat)] as LonLat)
    .filter(
      ([lon, lat]) =>
        Number.isFinite(lon) && Number.isFinite(lat) && Math.abs(lat) <= 90,
    );
  if (valid.length === 0) return null;

  const lats = valid.map(([, lat]) => lat);
  const latMin = Math.min(...lats);
  const latMax = Math.max(...lats);
  const { span: lonSpan, center: lonCenter } = longitudeSpan(
    valid.map(([lon]) => lon),
  );

  const latSpan = latMax - latMin;
  const latCenter = (latMin + latMax) / 2;

  /*
    A single place, or several in one city, has no span to fit. Zooming to
    "infinity" there would drop someone into a featureless close-up, so it
    takes the max instead, which is a recognisable regional view.
  */
  const zoomForLon = lonSpan > 1 ? (WORLD_LON_SPAN * fill) / lonSpan : maxZoom;
  const zoomForLat = latSpan > 1 ? (WORLD_LAT_SPAN * fill) / latSpan : maxZoom;

  const zoom = Math.min(
    maxZoom,
    Math.max(minZoom, Math.min(zoomForLon, zoomForLat)),
  );

  return { center: [lonCenter, latCenter], zoom };
}
