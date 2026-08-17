import type { Airport, CityRef, FlightJourney, TravelMode } from '../../types';
import { legMode } from '../FlightMap/routeUtils';

/**
 * Helpers for editing a journey's stop chain (2026-08-14): stops can be
 * reordered in place, and the Round trip label must stay honest — a chain
 * that no longer ends where it started is not a round trip, whatever the
 * checkbox said before the edit.
 *
 * Since land travel (2026-08-17) a stop is an airport OR a city, and the
 * chain carries a travel mode per hop. This model is shared by the add
 * form (RouteBuilder) and the edit form (FlightCard) so the two cannot
 * drift apart.
 */

export interface EditableStop {
  kind: 'airport' | 'city';
  airport: Airport | null;
  city: CityRef | null;
}

export const emptyStop = (): EditableStop => ({
  kind: 'airport',
  airport: null,
  city: null,
});

/** The modes the UI offers; ferry is schema-ready but not surfaced yet. */
export const HOP_MODES: TravelMode[] = ['flight', 'train', 'car', 'bus'];

export const MODE_LABEL: Record<TravelMode, string> = {
  flight: 'Flight',
  train: 'Train',
  car: 'Car',
  bus: 'Bus',
  ferry: 'Ferry',
};

export function stopFilled(stop: EditableStop): boolean {
  return stop.kind === 'airport' ? stop.airport !== null : stop.city !== null;
}

/** IATA for airports, the name for cities; null while unfilled. */
export function stopLabel(stop: EditableStop): string | null {
  if (stop.kind === 'airport') return stop.airport?.iataCode ?? null;
  return stop.city?.name ?? null;
}

/** A collision-safe identity - airport and city ids live in different
    namespaces, so a bare number cannot tell VAR from city #1. */
export function stopIdentity(stop: EditableStop): string | null {
  if (stop.kind === 'airport') {
    return stop.airport ? `a${stop.airport.id}` : null;
  }
  return stop.city ? `c${stop.city.id}` : null;
}

/** A journey's legs as an editable chain: stops plus one mode per hop. */
export function journeyToStops(journey: FlightJourney): {
  stops: EditableStop[];
  modes: TravelMode[];
} {
  const sorted = [...journey.legs].sort((a, b) => a.legOrder - b.legOrder);
  const toStop = (
    airport: Airport | null,
    city: CityRef | null | undefined,
  ): EditableStop =>
    airport
      ? { kind: 'airport', airport, city: null }
      : { kind: 'city', airport: null, city: city ?? null };

  const stops: EditableStop[] = [];
  const modes: TravelMode[] = [];
  sorted.forEach((leg, index) => {
    if (index === 0) stops.push(toStop(leg.departureAirport, leg.departureCity));
    stops.push(toStop(leg.arrivalAirport, leg.arrivalCity));
    modes.push(legMode(leg));
  });
  if (stops.length === 0) {
    return { stops: [emptyStop(), emptyStop()], modes: ['flight'] };
  }
  return { stops, modes };
}

/** A new array with the stop at `index` moved one step in `direction`. */
export function moveStop<T>(stops: T[], index: number, direction: -1 | 1): T[] {
  const target = index + direction;
  if (index < 0 || index >= stops.length) return stops;
  if (target < 0 || target >= stops.length) return stops;
  const next = [...stops];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

/**
 * Whether the chain is a closed loop. 'unknown' while either end is still
 * empty — the honesty rule only fires on what the user has actually said,
 * never on a row they are mid-way through editing.
 */
export function loopStatus(
  stops: (Airport | null)[],
): 'loop' | 'broken' | 'unknown' {
  if (stops.length < 2) return 'unknown';
  const first = stops[0];
  const last = stops[stops.length - 1];
  if (!first || !last) return 'unknown';
  return first.id === last.id ? 'loop' : 'broken';
}

/** loopStatus for the mixed-mode chain, keyed on stop identity. */
export function stopLoopStatus(
  stops: EditableStop[],
): 'loop' | 'broken' | 'unknown' {
  if (stops.length < 2) return 'unknown';
  const first = stopIdentity(stops[0]);
  const last = stopIdentity(stops[stops.length - 1]);
  if (!first || !last) return 'unknown';
  return first === last ? 'loop' : 'broken';
}
