import { describe, it, expect } from 'vitest';
import {
  moveStop,
  moveStopWithModes,
  loopStatus,
  syncStopsWithMode,
  resolveFlightEndpoints,
  type EditableStop,
  conformStopsToModes,
  requiredStopKind,
  kindForNewStop,
} from './stopChain';
import type { Airport, CityRef } from '../../types';

const airport = (id: number) => ({ id }) as unknown as Airport;

describe('moveStop', () => {
  const chain = [airport(1), airport(2), airport(3)];

  it('swaps a stop with its neighbour, immutably', () => {
    const up = moveStop(chain, 1, -1);
    expect(up.map((a) => a?.id)).toEqual([2, 1, 3]);
    const down = moveStop(chain, 1, 1);
    expect(down.map((a) => a?.id)).toEqual([1, 3, 2]);
    // The original is untouched.
    expect(chain.map((a) => a?.id)).toEqual([1, 2, 3]);
  });

  it('refuses to move past either end', () => {
    expect(moveStop(chain, 0, -1)).toBe(chain);
    expect(moveStop(chain, 2, 1)).toBe(chain);
    expect(moveStop(chain, -1, 1)).toBe(chain);
    expect(moveStop(chain, 3, -1)).toBe(chain);
  });

  it('moves empty rows like any other stop', () => {
    const withNull = [airport(1), null, airport(3)];
    expect(moveStop(withNull, 1, 1).map((a) => a?.id)).toEqual([1, 3, undefined]);
  });
});

describe('syncStopsWithMode', () => {
  const mostar = { id: 7, name: 'Mostar' } as unknown as CityRef;
  const london = { id: 9, name: 'London' } as unknown as CityRef;
  const omo = { id: 42, iataCode: 'OMO', city: 'Mostar' } as unknown as Airport;
  const lhr = { id: 43, iataCode: 'LHR', city: 'London' } as unknown as Airport;
  const airportStop = (a: Airport | null): EditableStop => ({
    kind: 'airport',
    airport: a,
    city: null,
  });
  const cityStop = (c: CityRef | null): EditableStop => ({
    kind: 'city',
    airport: null,
    city: c,
  });
  const resolvers = {
    airportForCity: async (city: CityRef) => (city.name === 'Mostar' ? omo : null),
    cityForAirport: async (airport: Airport) =>
      airport.iataCode === 'LHR' ? london : null,
  };

  it('resolves a chosen city to its airport when the hop becomes a flight', async () => {
    const stops = [cityStop(mostar), airportStop(null)];
    const { stops: next, conversions } = await syncStopsWithMode(
      stops,
      ['flight'],
      0,
      resolvers,
    );
    expect(next[0].kind).toBe('airport');
    expect(next[0].airport).toBe(omo);
    expect(conversions).toEqual(['Mostar → OMO']);
    // The original is untouched.
    expect(stops[0].kind).toBe('city');
  });

  it('keeps a city without an airport, so validation can explain', async () => {
    const stops = [cityStop(mostar), airportStop(null)];
    const { stops: next, conversions } = await syncStopsWithMode(
      stops,
      ['flight'],
      0,
      { ...resolvers, airportForCity: async () => null },
    );
    expect(next[0].kind).toBe('city');
    expect(next[0].city).toBe(mostar);
    expect(conversions).toEqual([]);
  });

  it('turns a filled airport into its city when the hop becomes a drive', async () => {
    // Owner rule (2026-10-03): not a plane means a city - even for stops
    // already chosen, which the old rule left as IATA codes under a car.
    const { stops: next, conversions, unresolved } = await syncStopsWithMode(
      [airportStop(lhr), airportStop(null)],
      ['car'],
      0,
      resolvers,
    );
    expect(next[0].kind).toBe('city');
    expect(next[0].city).toBe(london);
    expect(next[1].kind).toBe('city');
    expect(conversions).toEqual(['LHR → London']);
    expect(unresolved).toEqual([]);
  });

  it('clears an airport it cannot place and names it', async () => {
    const { stops: next, unresolved } = await syncStopsWithMode(
      [airportStop(omo), airportStop(null)],
      ['train'],
      0,
      resolvers,
    );
    expect(next[0]).toEqual(cityStop(null));
    expect(unresolved).toEqual(['OMO']);
  });

  it('keeps the airport where a flight meets a drive', async () => {
    // VAR -> LHR by plane, LHR -> London by car: LHR is the airport.
    const { stops: next } = await syncStopsWithMode(
      [airportStop(airport(1)), airportStop(lhr), cityStop(null)],
      ['flight', 'car'],
      1,
      resolvers,
    );
    expect(next[1].kind).toBe('airport');
    expect(next[1].airport).toBe(lhr);
  });

  it('flips an empty city stop back to an airport for a flight', async () => {
    const air = await syncStopsWithMode(
      [cityStop(null), airportStop(null)],
      ['flight'],
      0,
      resolvers,
    );
    expect(air.stops[0].kind).toBe('airport');
  });
});

describe('conformStopsToModes on edit open', () => {
  const london = { id: 9, name: 'London' } as unknown as CityRef;
  const lhr = { id: 43, iataCode: 'LHR', city: 'London' } as unknown as Airport;
  const airportStop = (a: Airport | null): EditableStop => ({
    kind: 'airport',
    airport: a,
    city: null,
  });
  const resolvers = {
    airportForCity: async () => null,
    cityForAirport: async (a: Airport) => (a.iataCode === 'LHR' ? london : null),
  };

  it('converts what it can and leaves the rest untouched', async () => {
    const stops = [airportStop(lhr), airportStop(airport(1))];
    const result = await conformStopsToModes(stops, ['car'], resolvers, {
      keepUnresolved: true,
    });
    expect(result.stops[0].city).toBe(london);
    expect(result.stops[1]).toBe(stops[1]);
    expect(result.conversions).toEqual(['LHR → London']);
    expect(result.unresolved).toEqual([]);
  });
});

describe('requiredStopKind and kindForNewStop', () => {
  it('follows the hops touching the stop', () => {
    expect(requiredStopKind(['flight', 'car'], 0)).toBe('airport');
    expect(requiredStopKind(['flight', 'car'], 1)).toBe('airport');
    expect(requiredStopKind(['flight', 'car'], 2)).toBe('city');
    expect(requiredStopKind(['bus'], 0)).toBe('city');
  });

  it('starts a new stop as what the inherited mode needs', () => {
    expect(kindForNewStop(['flight'])).toBe('airport');
    expect(kindForNewStop(['flight', 'car'])).toBe('city');
    expect(kindForNewStop([])).toBe('airport');
  });
});

describe('resolveFlightEndpoints', () => {
  const mostar = { id: 7, name: 'Mostar' } as unknown as CityRef;
  const nowhere = { id: 8, name: 'Nowhere' } as unknown as CityRef;
  const omo = { id: 42, iataCode: 'OMO', city: 'Mostar' } as unknown as Airport;
  const resolver = async (city: CityRef) =>
    city.name === 'Mostar' ? omo : null;
  const airportStop = (a: Airport | null): EditableStop => ({
    kind: 'airport',
    airport: a,
    city: null,
  });
  const cityStop = (c: CityRef): EditableStop => ({
    kind: 'city',
    airport: null,
    city: c,
  });

  it("sweeps the drove-there-flew-home chain: the city's airport steps in", async () => {
    // Belgrade -> Mostar by car, Mostar -> Varna by (default) flight.
    const stops = [cityStop(mostar), airportStop(airport(1))];
    const result = await resolveFlightEndpoints(stops, ['flight'], resolver);
    expect(result.ok).toBe(true);
    expect(result.stops[0].airport).toBe(omo);
    expect(result.modes).toEqual(['flight']);
    expect(result.conversions).toEqual(['Mostar → OMO']);
  });

  it('the Annecy rule: a no-airport city hop to an airport becomes a drive', async () => {
    const stops = [cityStop(nowhere), airportStop(airport(1))];
    const result = await resolveFlightEndpoints(stops, ['flight'], resolver);
    expect(result.ok).toBe(true);
    expect(result.modes).toEqual(['car']);
    expect(result.stops[0].kind).toBe('city');
    expect(result.conversions).toEqual(['Nowhere hop marked as a drive']);
  });

  it('still refuses a flight between two airportless cities', async () => {
    const stops = [cityStop(nowhere), cityStop({ ...nowhere, id: 9 })];
    const result = await resolveFlightEndpoints(stops, ['flight'], resolver);
    expect(result.ok).toBe(false);
  });

  it('leaves land hops entirely alone', async () => {
    const stops = [cityStop(mostar), cityStop(nowhere)];
    const result = await resolveFlightEndpoints(stops, ['car'], resolver);
    expect(result.ok).toBe(true);
    expect(result.stops[0].kind).toBe('city');
    expect(result.modes).toEqual(['car']);
  });
});

describe('moveStopWithModes', () => {
  const stop = (id: number): EditableStop => ({
    kind: 'airport',
    airport: airport(id),
    city: null,
  });

  it('keeps a stop’s arrival mode attached when it moves', () => {
    // A ✈ B 🚗 C: moving C before B must keep "arrived by car" on C.
    const { stops, modes } = moveStopWithModes(
      [stop(1), stop(2), stop(3)],
      ['flight', 'car'],
      2,
      -1,
    );
    expect(stops.map((s) => s.airport?.id)).toEqual([1, 3, 2]);
    expect(modes).toEqual(['car', 'flight']);
  });

  it('moves stops only when the first position is involved', () => {
    const { stops, modes } = moveStopWithModes(
      [stop(1), stop(2), stop(3)],
      ['flight', 'car'],
      0,
      1,
    );
    expect(stops.map((s) => s.airport?.id)).toEqual([2, 1, 3]);
    expect(modes).toEqual(['flight', 'car']);
  });
});

describe('loopStatus', () => {
  it('is a loop when the chain ends where it started', () => {
    expect(loopStatus([airport(1), airport(2), airport(1)])).toBe('loop');
  });

  it('is broken when both ends are known and differ', () => {
    expect(loopStatus([airport(1), airport(2)])).toBe('broken');
  });

  it('is unknown while either end is empty or the chain is short', () => {
    expect(loopStatus([])).toBe('unknown');
    expect(loopStatus([airport(1)])).toBe('unknown');
    expect(loopStatus([null, airport(2)])).toBe('unknown');
    expect(loopStatus([airport(1), null])).toBe('unknown');
  });
});
