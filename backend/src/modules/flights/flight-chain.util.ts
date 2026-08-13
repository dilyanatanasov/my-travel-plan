import { calculateAirportDistance } from '../../common/utils/haversine';

export interface ChainLeg {
  departureAirportId: number;
  arrivalAirportId: number;
}

interface AirportPoint {
  latitude: number;
  longitude: number;
}

/** No commercial flight is shorter than this — it is a train, bus or taxi. */
export const GROUND_TRANSFER_KM = 100;

/**
 * Split a leg chain at ground transfers (user decision, 2026-08-13).
 *
 * A chain like SOF→AMS→NRT · HND→CDG→AMS→SOF encodes one real trip, but
 * NRT→HND is a train across Tokyo — no commercial flight is this short.
 * Distance, not city names, is the detector: Narita's city field says
 * "Narita" while Haneda's says "Tokyo", so string matching would miss
 * exactly the case that prompted this. Each run of genuine flights becomes
 * its own journey.
 *
 * Returns the runs of genuine flights, in order. An empty result means every
 * hop was a ground transfer — the caller decides what that error looks like.
 * Every airport id in `legData` must resolve in `airportMap`; the service
 * validates that before calling.
 */
export function splitChainAtGroundTransfers<T extends ChainLeg>(
  legData: T[],
  airportMap: Map<number, AirportPoint>,
): T[][] {
  const segments: T[][] = [];
  let currentSegment: T[] = [];
  for (const leg of legData) {
    const from = airportMap.get(leg.departureAirportId)!;
    const to = airportMap.get(leg.arrivalAirportId)!;
    const isGroundTransfer =
      leg.departureAirportId !== leg.arrivalAirportId &&
      calculateAirportDistance(from, to) < GROUND_TRANSFER_KM;
    if (isGroundTransfer) {
      if (currentSegment.length > 0) segments.push(currentSegment);
      currentSegment = [];
    } else {
      currentSegment.push(leg);
    }
  }
  if (currentSegment.length > 0) segments.push(currentSegment);
  return segments;
}
