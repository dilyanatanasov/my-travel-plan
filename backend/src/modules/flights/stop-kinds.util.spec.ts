import { requiredStopKind, stopKindViolation } from './stop-kinds.util';

/**
 * The stop-kind rule the editor and the server share: a plane needs an
 * airport at both ends, everything else runs between cities, and the
 * stop where you land and drive on stays the airport.
 */
describe('requiredStopKind', () => {
  it('needs airports around a flight', () => {
    expect(requiredStopKind(['flight'], 0)).toBe('airport');
    expect(requiredStopKind(['flight'], 1)).toBe('airport');
  });

  it('needs cities around a land hop', () => {
    expect(requiredStopKind(['car'], 0)).toBe('city');
    expect(requiredStopKind(['train'], 1)).toBe('city');
  });

  it('keeps the airport where a flight meets a drive', () => {
    // VAR -> SOF by plane, SOF -> Plovdiv by car: stop 1 is the airport.
    expect(requiredStopKind(['flight', 'car'], 0)).toBe('airport');
    expect(requiredStopKind(['flight', 'car'], 1)).toBe('airport');
    expect(requiredStopKind(['flight', 'car'], 2)).toBe('city');
  });

  it('defaults a lone stop to an airport', () => {
    expect(requiredStopKind([], 0)).toBe('airport');
  });
});

describe('stopKindViolation', () => {
  const code = (id: number) => ({ 1: 'VAR', 2: 'SOF' })[id];

  it('accepts cities under land hops and airports under flights', () => {
    expect(
      stopKindViolation(
        [{ airportId: 1 }, { airportId: 2 }, { cityId: 9 }],
        ['flight', 'car'],
        code,
      ),
    ).toBeNull();
  });

  it('names the airport sitting under a land hop', () => {
    expect(
      stopKindViolation([{ airportId: 1 }, { airportId: 2 }], ['car'], code),
    ).toBe(
      'Train, car, bus and ferry hops run between cities - pick the city for VAR or change the mode',
    );
  });

  it('reports the first offender only, with a fallback name', () => {
    expect(
      stopKindViolation(
        [{ cityId: 5 }, { airportId: 77 }],
        ['bus'],
        () => undefined,
      ),
    ).toBe(
      'Train, car, bus and ferry hops run between cities - pick the city for that airport or change the mode',
    );
  });
});
