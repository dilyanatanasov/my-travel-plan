import type { Airport, CityRef, FlightJourney, TravelMode } from '../../types';
import { legMode } from '../FlightMap/routeUtils';
import { isNearWater, modeMedium, terrainRouteKm } from '../../lib/terrainRoute';

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

/** Every mode the schema knows, ferry included (owner, 2026-08-18). */
export const HOP_MODES: TravelMode[] = ['flight', 'train', 'car', 'bus', 'ferry'];

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
 * Reorder a stop AND keep its arrival mode attached (owner report,
 * 2026-08-18: "Annecy by car" stayed glued to the bottom row when the
 * stop moved). A stop's arrival mode is modes[stop - 1]; swapping two
 * neighbouring stops swaps their arrival modes with them. The first
 * stop has no arrival, so a swap involving position 0 moves stops only.
 */
export function moveStopWithModes(
  stops: EditableStop[],
  modes: TravelMode[],
  index: number,
  direction: -1 | 1,
): { stops: EditableStop[]; modes: TravelMode[] } {
  const target = index + direction;
  const nextStops = moveStop(stops, index, direction);
  if (nextStops === stops) return { stops, modes };
  const low = Math.min(index, target);
  if (low < 1) return { stops: nextStops, modes };
  const nextModes = [...modes];
  [nextModes[low - 1], nextModes[low]] = [nextModes[low], nextModes[low - 1]];
  return { stops: nextStops, modes: nextModes };
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
 * Mostar, flew home" ending.
 *
 * Second rule (owner report, 2026-08-18, the Annecy case): a "flight"
 * hop between a CITY WITH NO AIRPORT and an airport is obviously the
 * ground transfer to that airport - you drove from Annecy to Geneva
 * and flew from there. Such hops flip to 'car' instead of erroring.
 * Only a flight hop between two unresolvable cities stays not-ok.
 */
export async function resolveFlightEndpoints(
  stops: EditableStop[],
  modes: TravelMode[],
  resolveAirport: (city: CityRef) => Promise<Airport | null>,
): Promise<{
  stops: EditableStop[];
  modes: TravelMode[];
  conversions: string[];
  ok: boolean;
}> {
  const next = [...stops];
  const nextModes = [...modes];
  const conversions: string[] = [];

  const isAirportEnd = (stop: EditableStop | undefined): boolean =>
    stop?.kind === 'airport' && stop.airport !== null;

  for (let i = 0; i < nextModes.length; i++) {
    if (nextModes[i] !== 'flight') continue;
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
    // Still a city on exactly one end: the ground-transfer reading.
    const depAir = isAirportEnd(next[i]);
    const arrAir = isAirportEnd(next[i + 1]);
    if (depAir !== arrAir) {
      const cityEnd = depAir ? next[i + 1] : next[i];
      if (cityEnd?.kind === 'city' && cityEnd.city) {
        nextModes[i] = 'car';
        conversions.push(`${cityEnd.city.name} hop marked as a drive`);
      }
    }
  }
  const ok = nextModes.every(
    (mode, i) =>
      mode !== 'flight' || (isAirportEnd(next[i]) && isAirportEnd(next[i + 1])),
  );
  return { stops: next, modes: nextModes, conversions, ok };
}

/**
 * Ferry endpoints that look landlocked (owner ask, 2026-08-18: ferries
 * connect coastal places). Checked against the atlas's water within
 * ~20 km. A WARNING, never a block: the atlas carries no lakes or
 * rivers, so Lake Geneva's ferries would fail a hard rule - the user
 * knows their trip better than the raster does.
 */
export async function ferryCoastWarnings(
  stops: EditableStop[],
  modes: TravelMode[],
): Promise<string[]> {
  const flagged = new Set<string>();
  for (let i = 0; i < modes.length; i++) {
    if (modes[i] !== 'ferry') continue;
    for (const stop of [stops[i], stops[i + 1]]) {
      if (!stop) continue;
      const place = stop.kind === 'city' ? stop.city : stop.airport;
      if (!place) continue;
      const near = await isNearWater(
        [Number(place.longitude), Number(place.latitude)],
        20,
      );
      // null = could not tell; only a confident "no water" warns.
      if (near === false) {
        flagged.add(stop.kind === 'city' ? place.name : (place as Airport).iataCode);
      }
    }
  }
  return [...flagged];
}

/**
 * Honest kilometres per hop (owner, 2026-08-19): the terrain route's
 * length for surface hops - the ferry around the cape, the train over
 * the bridge - sent alongside the chain so stats stop underselling
 * every surface leg. 0 = "no route known, keep the haversine" (all
 * flight hops, unrouted chains, torn stops).
 */
export async function hopRouteDistancesKm(
  stops: EditableStop[],
  modes: TravelMode[],
): Promise<number[]> {
  return Promise.all(
    modes.map(async (mode, i) => {
      const medium = modeMedium(mode);
      if (!medium) return 0;
      const fromStop = stops[i];
      const toStop = stops[i + 1];
      const from = fromStop?.kind === 'city' ? fromStop.city : fromStop?.airport;
      const to = toStop?.kind === 'city' ? toStop.city : toStop?.airport;
      if (!from || !to) return 0;
      try {
        const km = await terrainRouteKm(
          [Number(from.longitude), Number(from.latitude)],
          [Number(to.longitude), Number(to.latitude)],
          medium,
        );
        return km ?? 0;
      } catch {
        return 0;
      }
    }),
  );
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
