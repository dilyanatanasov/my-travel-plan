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
export function getStrokeWidth(count: number, maxCount: number): number {
  if (maxCount <= 1) return 2;
  const normalized = (count - 1) / (maxCount - 1);
  return 1.5 + normalized * 2.5; // Range: 1.5 to 4
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
 * Adjust a size value to remain visually constant regardless of zoom level.
 * Divides by zoom factor and clamps to a minimum SVG size.
 */
export function getZoomAdjustedSize(
  size: number,
  zoom: number,
  minSize: number = 0.5
): number {
  return Math.max(size / zoom, minSize);
}
