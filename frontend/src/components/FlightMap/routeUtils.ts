import type { FlightJourney, Airport } from '../../types';

export interface AggregatedRoute {
  key: string;
  departure: Airport;
  arrival: Airport;
  count: number;
  totalDistance: number;
  flights: FlightJourney[];
}

/**
 * Generate a unique key for a route (direction-agnostic for aggregation)
 */
export function getRouteKey(dep: Airport, arr: Airport): string {
  // Sort by IATA code to make key direction-agnostic
  const codes = [dep.iataCode, arr.iataCode].sort();
  return `${codes[0]}-${codes[1]}`;
}

/**
 * Generate a directional key for a route
 */
export function getDirectionalRouteKey(dep: Airport, arr: Airport): string {
  return `${dep.iataCode}-${arr.iataCode}`;
}

/**
 * Extract all unique airports from flights
 */
export function extractUniqueAirports(flights: FlightJourney[]): Airport[] {
  const airportMap = new Map<string, Airport>();

  flights.forEach((journey) => {
    journey.legs.forEach((leg) => {
      airportMap.set(leg.departureAirport.iataCode, leg.departureAirport);
      airportMap.set(leg.arrivalAirport.iataCode, leg.arrivalAirport);
    });
  });

  return Array.from(airportMap.values());
}

/**
 * Count how many times each airport appears in flights
 */
export function countAirportVisits(flights: FlightJourney[]): Map<string, number> {
  const counts = new Map<string, number>();

  flights.forEach((journey) => {
    journey.legs.forEach((leg) => {
      const depCode = leg.departureAirport.iataCode;
      const arrCode = leg.arrivalAirport.iataCode;
      counts.set(depCode, (counts.get(depCode) || 0) + 1);
      counts.set(arrCode, (counts.get(arrCode) || 0) + 1);
    });
  });

  return counts;
}

/**
 * Aggregate flight legs into unique routes with counts
 */
export function aggregateRoutes(flights: FlightJourney[]): AggregatedRoute[] {
  const routeMap = new Map<string, AggregatedRoute>();

  flights.forEach((journey) => {
    journey.legs.forEach((leg) => {
      const key = getRouteKey(leg.departureAirport, leg.arrivalAirport);
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
          departure: leg.departureAirport,
          arrival: leg.arrivalAirport,
          count: 1,
          totalDistance: Number(leg.distanceKm) || 0,
          flights: [journey],
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
