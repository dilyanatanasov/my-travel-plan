import {
  splitChainAtGroundTransfers,
  GROUND_TRANSFER_KM,
} from './flight-chain.util';
import { calculateAirportDistance } from '../../common/utils/haversine';

/**
 * The detector that decides whether a user's chain becomes one journey or
 * several — it mutates what gets written, so its edges matter. One degree of
 * latitude ≈ 111 km, which makes distances easy to stage.
 */

// Synthetic airports along a meridian.
const airports = new Map<number, { latitude: number; longitude: number }>([
  [1, { latitude: 0, longitude: 0 }], // A
  [2, { latitude: 10, longitude: 0 }], // B — 1112 km from A
  [3, { latitude: 10.5, longitude: 0 }], // C — ~56 km from B (ground transfer)
  [4, { latitude: 20, longitude: 0 }], // D — far from everything
  [5, { latitude: 10.95, longitude: 0 }], // E — ~106 km from B (short but real)
]);

const leg = (departureAirportId: number, arrivalAirportId: number) => ({
  departureAirportId,
  arrivalAirportId,
});

// The real case that prompted the feature: Narita → Haneda is a train.
const realWorld = new Map<number, { latitude: number; longitude: number }>([
  [10, { latitude: 42.695, longitude: 23.406 }], // SOF
  [11, { latitude: 52.31, longitude: 4.764 }], // AMS
  [12, { latitude: 35.765, longitude: 140.386 }], // NRT
  [13, { latitude: 35.549, longitude: 139.78 }], // HND
  [14, { latitude: 49.013, longitude: 2.55 }], // CDG
]);

describe('splitChainAtGroundTransfers', () => {
  it('keeps a chain with no ground transfers as one segment', () => {
    const chain = [leg(1, 2), leg(2, 4)];
    expect(splitChainAtGroundTransfers(chain, airports)).toEqual([chain]);
  });

  it('splits at a mid-chain transfer, dropping the transfer hop itself', () => {
    const segments = splitChainAtGroundTransfers(
      [leg(1, 2), leg(2, 3), leg(3, 4)],
      airports,
    );
    expect(segments).toEqual([[leg(1, 2)], [leg(3, 4)]]);
  });

  it('splits the SOF→AMS→NRT · HND→CDG→AMS→SOF trip at the Tokyo train', () => {
    const segments = splitChainAtGroundTransfers(
      [leg(10, 11), leg(11, 12), leg(12, 13), leg(13, 14), leg(14, 11), leg(11, 10)],
      realWorld,
    );
    expect(segments).toEqual([
      [leg(10, 11), leg(11, 12)],
      [leg(13, 14), leg(14, 11), leg(11, 10)],
    ]);
  });

  it('drops a leading transfer without emitting an empty first segment', () => {
    const segments = splitChainAtGroundTransfers(
      [leg(2, 3), leg(3, 4)],
      airports,
    );
    expect(segments).toEqual([[leg(3, 4)]]);
  });

  it('drops a trailing transfer without emitting an empty last segment', () => {
    const segments = splitChainAtGroundTransfers(
      [leg(1, 2), leg(2, 3)],
      airports,
    );
    expect(segments).toEqual([[leg(1, 2)]]);
  });

  it('returns nothing when every hop is a ground transfer', () => {
    expect(splitChainAtGroundTransfers([leg(2, 3)], airports)).toEqual([]);
    expect(splitChainAtGroundTransfers([], airports)).toEqual([]);
  });

  it('keeps a short but genuine flight at ~106 km', () => {
    expect(calculateAirportDistance(airports.get(2)!, airports.get(5)!))
      .toBeGreaterThan(GROUND_TRANSFER_KM);
    const chain = [leg(1, 2), leg(2, 5)];
    expect(splitChainAtGroundTransfers(chain, airports)).toEqual([chain]);
  });

  it('never treats a same-airport hop as a transfer, whatever its distance', () => {
    // Zero km, but the ids match — the guard is on identity, not distance.
    const chain = [leg(1, 2), leg(2, 2), leg(2, 4)];
    expect(splitChainAtGroundTransfers(chain, airports)).toEqual([chain]);
  });
});
