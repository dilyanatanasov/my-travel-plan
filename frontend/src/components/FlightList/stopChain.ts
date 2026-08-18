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

/**
 * Make the chain agree with a hop's new mode (owner ask, 2026-08-18:
 * "if i pick train the search should switch to city, if i pick flight
 * auto pick the airport").
 *
 * For a FLIGHT hop both endpoints must be airports: empty stops switch
 * kind; a stop already holding a city resolves to that city's airport
 * when one exists (Mostar -> OMO), reported in `conversions` so the form
 * can say so out loud. A city with no airport stays put - the form's
 * validation message explains better than silently clearing a choice.
 *
 * For a LAND hop only EMPTY airport stops switch to city mode: a filled
 * airport is a legitimate land endpoint (the train from Geneva Airport),
 * and clearing someone's chosen stop is never the helpful move.
 */
export async function syncStopsWithMode(
  stops: EditableStop[],
  hopIndex: number,
  mode: TravelMode,
  resolveAirport: (city: CityRef) => Promise<Airport | null>,
): Promise<{ stops: EditableStop[]; conversions: string[] }> {
  const next = [...stops];
  const conversions: string[] = [];
  for (const index of [hopIndex, hopIndex + 1]) {
    const stop = next[index];
    if (!stop) continue;
    if (mode === 'flight') {
      if (stop.kind === 'city' && stop.city) {
        const airport = await resolveAirport(stop.city);
        if (airport) {
          next[index] = { kind: 'airport', airport, city: null };
          conversions.push(`${stop.city.name} → ${airport.iataCode}`);
        }
      } else if (stop.kind === 'city') {
        next[index] = emptyStop();
      }
    } else if (stop.kind === 'airport' && !stop.airport) {
      next[index] = { kind: 'city', airport: null, city: null };
    }
  }
  return { stops: next, conversions };
}

/**
 * The submit-time sweep of the same rule: every flight hop's city
 * endpoints resolve to their airports where possible. Needed because
 * modes DEFAULT to flight - nobody clicks the chip they already have,
 * so the chip-click sync alone never fires on the common "drove to
 * Mostar, flew home" ending. `ok` is false when some flight hop still
 * lacks an airport on either end after the sweep.
 */
export async function resolveFlightEndpoints(
  stops: EditableStop[],
  modes: TravelMode[],
  resolveAirport: (city: CityRef) => Promise<Airport | null>,
): Promise<{ stops: EditableStop[]; conversions: string[]; ok: boolean }> {
  const next = [...stops];
  const conversions: string[] = [];
  for (let i = 0; i < modes.length; i++) {
    if (modes[i] !== 'flight') continue;
    for (const index of [i, i + 1]) {
      const stop = next[index];
      if (stop?.kind === 'city' && stop.city) {
        const airport = await resolveAirport(stop.city);
        if (airport) {
          next[index] = { kind: 'airport', airport, city: null };
          conversions.push(`${stop.city.name} → ${airport.iataCode}`);
        }
      }
    }
  }
  const ok = modes.every(
    (mode, i) =>
      mode !== 'flight' ||
      (next[i]?.kind === 'airport' &&
        next[i].airport !== null &&
        next[i + 1]?.kind === 'airport' &&
        next[i + 1].airport !== null),
  );
  return { stops: next, conversions, ok };
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
