import type { FlightJourney, FlightLeg, Airport, TravelMode } from '../../types';
import { modeMedium, terrainWaypointsSync } from '../../lib/terrainRoute';

/*
  Land travel (2026-08-17): a leg's endpoint is an airport OR a city.
  Rather than teaching every map layer two shapes, a city poses as an
  Airport whose "iataCode" is its name - the marker label slot - with a
  negative id so it can never collide with a real airport. Everything
  downstream (markers, routes, framing, export) keeps one vocabulary.
*/
export function cityAsAirport(
  city: NonNullable<FlightLeg['departureCity']>,
): Airport {
  return {
    id: -city.id,
    iataCode: city.name,
    icaoCode: null,
    name: city.name,
    city: null,
    country: null,
    countryIso: city.countryIso,
    latitude: Number(city.latitude),
    longitude: Number(city.longitude),
    createdAt: '',
  };
}

/** A leg's endpoints in the map's one vocabulary; null if data is torn. */
export function legEndpoints(
  leg: FlightLeg,
): { departure: Airport; arrival: Airport } | null {
  const departure =
    leg.departureAirport ??
    (leg.departureCity ? cityAsAirport(leg.departureCity) : null);
  const arrival =
    leg.arrivalAirport ?? (leg.arrivalCity ? cityAsAirport(leg.arrivalCity) : null);
  if (!departure || !arrival) return null;
  return { departure, arrival };
}

export function legMode(leg: FlightLeg): TravelMode {
  return leg.travelMode ?? 'flight';
}

/**
 * The geographic points a camera must keep in frame for this leg: the
 * endpoints, plus the terrain route's waypoints when the router has
 * them (owner report, 2026-08-18: framing on endpoints alone cropped
 * the ferry's detour around the cape out of the share). Reads the
 * module cache synchronously - callers that must not race the router
 * pair this with useTerrainRoutes/ensureTerrainWaypoints.
 */
export function legFramingPoints(leg: FlightLeg): [number, number][] {
  const endpoints = legEndpoints(leg);
  if (!endpoints) return [];
  const from: [number, number] = [
    Number(endpoints.departure.longitude),
    Number(endpoints.departure.latitude),
  ];
  const to: [number, number] = [
    Number(endpoints.arrival.longitude),
    Number(endpoints.arrival.latitude),
  ];
  const medium = modeMedium(legMode(leg));
  const waypoints = medium ? terrainWaypointsSync(from, to, medium) : null;
  return waypoints ?? [from, to];
}


/**
 * "SOF → Plovdiv → KEF" - endpoint labels from the leg chain. IATA for
 * airports, names for cities; previously copy-pasted in three components.
 */
export function journeyRouteLabel(journey: FlightJourney): string {
  const legs = [...journey.legs].sort((a, b) => a.legOrder - b.legOrder);
  const stops: string[] = [];
  for (const leg of legs) {
    const endpoints = legEndpoints(leg);
    if (!endpoints) continue;
    if (stops.length === 0) stops.push(endpoints.departure.iataCode);
    stops.push(endpoints.arrival.iataCode);
  }
  return stops.join(' → ');
}

export interface AggregatedRoute {
  key: string;
  departure: Airport;
  arrival: Airport;
  count: number;
  totalDistance: number;
  flights: FlightJourney[];
  /** 'flight' unless every aggregated leg was this land mode. */
  mode: TravelMode;
}

/**
 * Generate a unique key for a route (direction-agnostic for aggregation).
 * Mode is part of the key: a flown and a trained SOF-PDV are two routes,
 * not one blob. Ids, not labels - two cities may share a name.
 */
export function getRouteKey(
  dep: Airport,
  arr: Airport,
  mode: TravelMode = 'flight',
): string {
  const ids = [dep.id, arr.id].sort((a, b) => a - b);
  return `${ids[0]}-${ids[1]}|${mode}`;
}

/**
 * Generate a directional key for a route
 */
export function getDirectionalRouteKey(dep: Airport, arr: Airport): string {
  return `${dep.iataCode}-${arr.iataCode}`;
}

/**
 * Extract all unique endpoints (airports and posing cities) from flights
 */
export function extractUniqueAirports(flights: FlightJourney[]): Airport[] {
  const airportMap = new Map<string, Airport>();

  flights.forEach((journey) => {
    journey.legs.forEach((leg) => {
      const endpoints = legEndpoints(leg);
      if (!endpoints) return;
      airportMap.set(endpoints.departure.iataCode, endpoints.departure);
      airportMap.set(endpoints.arrival.iataCode, endpoints.arrival);
    });
  });

  return Array.from(airportMap.values());
}

/**
 * Count how many times each endpoint appears in flights
 */
export function countAirportVisits(flights: FlightJourney[]): Map<string, number> {
  const counts = new Map<string, number>();

  flights.forEach((journey) => {
    journey.legs.forEach((leg) => {
      const endpoints = legEndpoints(leg);
      if (!endpoints) return;
      const depCode = endpoints.departure.iataCode;
      const arrCode = endpoints.arrival.iataCode;
      counts.set(depCode, (counts.get(depCode) || 0) + 1);
      counts.set(arrCode, (counts.get(arrCode) || 0) + 1);
    });
  });

  return counts;
}

/**
 * Aggregate legs into unique routes with counts, per mode.
 */
export function aggregateRoutes(flights: FlightJourney[]): AggregatedRoute[] {
  const routeMap = new Map<string, AggregatedRoute>();

  flights.forEach((journey) => {
    journey.legs.forEach((leg) => {
      const endpoints = legEndpoints(leg);
      if (!endpoints) return;
      const mode = legMode(leg);
      const key = getRouteKey(endpoints.departure, endpoints.arrival, mode);
      const existing = routeMap.get(key);

      if (existing) {
        existing.count += 1;
        existing.totalDistance += Number(leg.distanceKm) || 0;
        if (!existing.flights.includes(journey)) {
          existing.flights.push(journey);
        }
      } else {
        routeMap.set(key, {
          key,
          departure: endpoints.departure,
          arrival: endpoints.arrival,
          count: 1,
          totalDistance: Number(leg.distanceKm) || 0,
          flights: [journey],
          mode,
        });
      }
    });
  });

  return Array.from(routeMap.values());
}

/**
 * Calculate SVG arc path between two projected coordinates
 * Uses quadratic bezier curves for smooth arcs
 */
export function calculateArcPath(
  from: [number, number],
  to: [number, number],
  curvature: number = 0.2
): string {
  const [x1, y1] = from;
  const [x2, y2] = to;

  // Calculate midpoint
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;

  // Calculate distance and perpendicular offset for control point
  const dx = x2 - x1;
  const dy = y2 - y1;
  const distance = Math.sqrt(dx * dx + dy * dy);

  // Control point offset (perpendicular to the line)
  const offset = distance * curvature;

  // Calculate control point (perpendicular to midpoint)
  // Negative dy and positive dx give us a point "above" the line
  const controlX = midX - (dy / distance) * offset;
  const controlY = midY + (dx / distance) * offset;

  // Return quadratic bezier curve path
  return `M ${x1} ${y1} Q ${controlX} ${controlY} ${x2} ${y2}`;
}

/**
 * A polyline with rounded corners (terrain routes, 2026-08-18): straight
 * runs between waypoints, each interior corner cut with a small quadratic
 * so the ship steers around a cape rather than ricocheting off it. Radius
 * is in map user units, so the rounding scales with the map like the
 * route itself, and is clamped to half of each adjoining segment.
 */
export function roundedPolylinePath(
  points: [number, number][],
  radius = 4,
): string {
  if (points.length < 2) return '';
  if (points.length === 2)
    return `M ${points[0][0]} ${points[0][1]} L ${points[1][0]} ${points[1][1]}`;

  let d = `M ${points[0][0]} ${points[0][1]}`;
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const corner = points[i];
    const next = points[i + 1];
    const inLen = Math.hypot(corner[0] - prev[0], corner[1] - prev[1]);
    const outLen = Math.hypot(next[0] - corner[0], next[1] - corner[1]);
    if (inLen === 0 || outLen === 0) continue;
    const r = Math.min(radius, inLen / 2, outLen / 2);
    const inX = corner[0] - ((corner[0] - prev[0]) / inLen) * r;
    const inY = corner[1] - ((corner[1] - prev[1]) / inLen) * r;
    const outX = corner[0] + ((next[0] - corner[0]) / outLen) * r;
    const outY = corner[1] + ((next[1] - corner[1]) / outLen) * r;
    d += ` L ${inX} ${inY} Q ${corner[0]} ${corner[1]} ${outX} ${outY}`;
  }
  const last = points[points.length - 1];
  d += ` L ${last[0]} ${last[1]}`;
  return d;
}

/**
 * A wavy stroke along a waypoint chain (owner ask, 2026-08-18: "watter
 * can be wavy") - the ferry's trail signature. The chain is resampled at
 * half-wavelength intervals and each half-wave bows to alternating sides
 * with a quadratic. Only the DRAWN trail waves; the ship itself sails
 * the smooth path, or it would wobble its heading the whole crossing.
 */
export function wavyPolylinePath(
  points: [number, number][],
  amplitude = 1.6,
  wavelength = 9,
): string {
  if (points.length < 2) return '';
  const half = Math.max(wavelength / 2, 0.001);

  // Resample the chain at half-wave spacing, carrying the remainder
  // across corners so the rhythm never stutters at a waypoint.
  const samples: [number, number][] = [points[0]];
  let carried = 0;
  for (let i = 1; i < points.length; i++) {
    const [ax, ay] = points[i - 1];
    const [bx, by] = points[i];
    const segLen = Math.hypot(bx - ax, by - ay);
    if (segLen === 0) continue;
    let along = half - carried;
    while (along < segLen) {
      const t = along / segLen;
      samples.push([ax + (bx - ax) * t, ay + (by - ay) * t]);
      along += half;
    }
    carried = segLen - (along - half);
  }
  const last = points[points.length - 1];
  const tail = samples[samples.length - 1];
  if (Math.hypot(last[0] - tail[0], last[1] - tail[1]) < half * 0.35)
    samples[samples.length - 1] = last;
  else samples.push(last);

  if (samples.length < 3)
    return `M ${points[0][0]} ${points[0][1]} L ${last[0]} ${last[1]}`;

  let d = `M ${samples[0][0]} ${samples[0][1]}`;
  for (let i = 1; i < samples.length; i++) {
    const [ax, ay] = samples[i - 1];
    const [bx, by] = samples[i];
    const len = Math.hypot(bx - ax, by - ay);
    if (len === 0) continue;
    const side = i % 2 === 0 ? 1 : -1;
    const nx = (-(by - ay) / len) * amplitude * side;
    const ny = ((bx - ax) / len) * amplitude * side;
    d += ` Q ${(ax + bx) / 2 + nx} ${(ay + by) / 2 + ny} ${bx} ${by}`;
  }
  return d;
}

/** Projected length of a waypoint chain - the screenLen a polyline leg
    contributes to the replay timeline. */
export function polylineScreenLength(points: [number, number][]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += Math.hypot(
      points[i][0] - points[i - 1][0],
      points[i][1] - points[i - 1][1],
    );
  }
  return total;
}

/**
 * Drop a path's leading "M x y" so it can be spliced onto the previous
 * leg's path. Works for the Q-arcs and the rounded polylines alike: what
 * remains always starts with a drawing command (Q or L) that continues
 * from the previous leg's endpoint.
 */
export function stripLeadingMove(pathD: string): string {
  return pathD.replace(/^M[^A-Za-z]*/, '');
}

/**
 * Calculate stroke width based on flight count
 * Maps count to a range of 1-4 pixels
 */
/**
 * Route line thickness, by how often the route was flown.
 *
 * Thinner than it was (1.5–4). At this data density, heavy strokes merge into
 * a blob over Europe and hide the countries underneath, which are the point
 * of the map. `sizeScale` trims them further on small screens, where the same
 * width covers proportionally far more of the map.
 */
export function getStrokeWidth(
  count: number,
  maxCount: number,
  sizeScale = 1
): number {
  if (maxCount <= 1) return 1.2 * sizeScale;
  const normalized = (count - 1) / (maxCount - 1);
  return (0.9 + normalized * 1.5) * sizeScale; // Range: 0.9 to 2.4
}

/**
 * Project geographic coordinates to map coordinates
 * This is a wrapper to handle null projections
 */
export function projectCoordinates(
  longitude: number,
  latitude: number,
  projection: (coords: [number, number]) => [number, number] | null
): [number, number] | null {
  return projection([longitude, latitude]);
}

/**
 * Keep a size visually constant as the map zooms.
 *
 * Everything inside ZoomableGroup is multiplied by the zoom factor when it is
 * drawn, so dividing by that factor first cancels it out and the result is a
 * constant number of screen pixels.
 *
 * There is deliberately no floor. The old one clamped at 0.5 *user* units,
 * which the zoom then multiplied back up: a 2px dot held 2px on screen until
 * zoom 4, then grew — 4px at zoom 8, 8px at 16. Dots swelled exactly when you
 * were zooming in to see detail underneath them. A floor cannot protect
 * against disappearing here anyway, because the screen size never changes.
 */
export function getZoomAdjustedSize(size: number, zoom: number): number {
  return size / zoom;
}

/**
 * Grow a size gently as the map zooms in, in screen pixels.
 *
 * For things that should become *more* prominent close up rather than merely
 * holding still — airport dots, once you have zoomed past the point where the
 * map is a world overview and become a regional one. Logarithmic so it never
 * runs away: at zoom 8 a 2px dot is about 3px, not 16.
 */
export function getZoomEmphasisedSize(
  size: number,
  zoom: number,
  strength = 0.35
): number {
  const growth = 1 + Math.log2(Math.max(zoom, 1)) * strength;
  return (size * growth) / zoom;
}
