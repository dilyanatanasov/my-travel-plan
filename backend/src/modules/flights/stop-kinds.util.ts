/**
 * Which kind of place each stop of a chain must be (owner rule,
 * 2026-10-03): a flight needs an airport at both ends, and any other hop
 * (train, car, bus, ferry) runs between cities. A stop touched by both a
 * flight and a land hop is the airport - you land and drive on from it.
 *
 * Shared by the server's chain validation and, in spirit, by the editor's
 * stop sync; this is the copy that cannot be bypassed.
 */
export interface StopKindInput {
  airportId?: number | null;
  cityId?: number | null;
}

/** The kinds of hop touching stop `index`; empty for a lone stop. */
function touchingModes(modes: string[], index: number): string[] {
  return [modes[index - 1], modes[index]].filter(
    (mode): mode is string => mode !== undefined,
  );
}

export function requiredStopKind(
  modes: string[],
  index: number,
): 'airport' | 'city' {
  const touching = touchingModes(modes, index);
  if (touching.length === 0) return 'airport';
  return touching.includes('flight') ? 'airport' : 'city';
}

/**
 * The first stop that breaks the rule, as the message to show, or null.
 * Flight hops with city ends are reported separately (and first) by the
 * caller; this covers the other direction - an airport under a land hop.
 */
export function stopKindViolation(
  stops: StopKindInput[],
  modes: string[],
  airportCode: (airportId: number) => string | undefined,
): string | null {
  for (let i = 0; i < stops.length; i++) {
    const stop = stops[i];
    if (stop.airportId == null) continue;
    if (requiredStopKind(modes, i) === 'airport') continue;
    const code = airportCode(stop.airportId) ?? 'that airport';
    return `Train, car, bus and ferry hops run between cities - pick the city for ${code} or change the mode`;
  }
  return null;
}
