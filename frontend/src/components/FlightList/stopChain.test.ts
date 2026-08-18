import { describe, it, expect } from 'vitest';
import {
  moveStop,
  loopStatus,
  syncStopsWithMode,
  resolveFlightEndpoints,
  type EditableStop,
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
  const omo = { id: 42, iataCode: 'OMO', city: 'Mostar' } as unknown as Airport;
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

  it('resolves a chosen city to its airport when the hop becomes a flight', async () => {
    const stops = [cityStop(mostar), airportStop(airport(1))];
    const { stops: next, conversions } = await syncStopsWithMode(
      stops,
      0,
      'flight',
      async () => omo,
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
      0,
      'flight',
      async () => null,
    );
    expect(next[0].kind).toBe('city');
    expect(next[0].city).toBe(mostar);
    expect(conversions).toEqual([]);
  });

  it('flips empty stops to the mode’s kind, never filled ones', async () => {
    // Land hop: the empty airport stop becomes a city search...
    const land = await syncStopsWithMode(
      [airportStop(airport(1)), airportStop(null)],
      0,
      'train',
      async () => null,
    );
    expect(land.stops[0].kind).toBe('airport'); // filled airport stays -
    expect(land.stops[0].airport?.id).toBe(1); // trains leave airports too
    expect(land.stops[1].kind).toBe('city');

    // ...and a flight hop flips an empty city stop back to airports.
    const air = await syncStopsWithMode(
      [cityStop(null), airportStop(null)],
      0,
      'flight',
      async () => null,
    );
    expect(air.stops[0].kind).toBe('airport');
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
    expect(result.conversions).toEqual(['Mostar → OMO']);
  });

  it('reports not-ok when a flight endpoint city has no airport', async () => {
    const stops = [cityStop(nowhere), airportStop(airport(1))];
    const result = await resolveFlightEndpoints(stops, ['flight'], resolver);
    expect(result.ok).toBe(false);
    expect(result.conversions).toEqual([]);
  });

  it('leaves land hops entirely alone', async () => {
    const stops = [cityStop(mostar), cityStop(nowhere)];
    const result = await resolveFlightEndpoints(stops, ['car'], resolver);
    expect(result.ok).toBe(true);
    expect(result.stops[0].kind).toBe('city');
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
