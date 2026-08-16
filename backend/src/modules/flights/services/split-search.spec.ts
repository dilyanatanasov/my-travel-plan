import { FlightLegDto, FlightResultDto } from '../dto/flight-result.dto';
import { PricePoint } from '../providers/flight-provider.interface';
import {
  composeSplitItinerary,
  composeSurfaceCombos,
  nearestHubCodes,
} from './split-search.util';

/**
 * The split-ticket rules: hubs come from geography, combos from aligned
 * dates (seasonality = absent points = no combos, for free), and a
 * composed itinerary only exists when the real times leave 4h+ or a night
 * in the hub city — in BOTH directions.
 */

const VARNA = { iataCode: 'VAR', latitude: 43.23, longitude: 27.83 };
const HUBS = [
  { iataCode: 'SOF', latitude: 42.69, longitude: 23.41 },
  { iataCode: 'IST', latitude: 41.28, longitude: 28.75 },
  { iataCode: 'OTP', latitude: 44.57, longitude: 26.09 },
  { iataCode: 'VIE', latitude: 48.11, longitude: 16.57 },
  { iataCode: 'FRA', latitude: 50.03, longitude: 8.57 },
];

describe('nearestHubCodes', () => {
  it('answers the geography question for Varna', () => {
    expect(nearestHubCodes(VARNA, HUBS, 'KEF', 3)).toEqual([
      'OTP',
      'IST',
      'SOF',
    ]);
  });

  it('never proposes the origin or the destination as a hub', () => {
    expect(nearestHubCodes(VARNA, HUBS, 'SOF', 3)).toEqual([
      'OTP',
      'IST',
      'VIE',
    ]);
  });
});

function point(
  origin: string,
  destination: string,
  dep: string,
  ret: string,
  price: number,
): PricePoint {
  return {
    origin,
    destination,
    departureDate: dep,
    returnDate: ret,
    price,
    currency: 'USD',
    provider: 'travelpayouts',
    observedAt: '2026-08-16T00:00:00Z',
    isEstimate: true,
  };
}

describe('composeSurfaceCombos', () => {
  const legA = [point('VAR', 'SOF', '2026-10-07', '2026-10-15', 60)];

  it('aligns dates: main leg departs same day or next, returns before the ride home', () => {
    const combos = composeSurfaceCombos(
      'SOF',
      legA,
      [
        point('SOF', 'KEF', '2026-10-07', '2026-10-14', 240), // same-day out, home day before A returns
        point('SOF', 'KEF', '2026-10-08', '2026-10-15', 230), // next-day out, same-day return
        point('SOF', 'KEF', '2026-10-10', '2026-10-14', 200), // departs too late
      ],
      {},
    );
    expect(combos.map((c) => c.estimatedTotal)).toEqual([290, 300]);
    expect(combos[0].hub).toBe('SOF');
  });

  it('a hub route with no prices that month yields no combos — seasonality for free', () => {
    expect(composeSurfaceCombos('SOF', legA, [], {})).toEqual([]);
  });

  it('honours the nights window on the destination stay', () => {
    const combos = composeSurfaceCombos(
      'SOF',
      legA,
      [point('SOF', 'KEF', '2026-10-07', '2026-10-14', 240)], // 7 nights
      { minNights: 8 },
    );
    expect(combos).toEqual([]);
  });
});

function leg(
  from: string,
  to: string,
  dep: string,
  arr: string,
): FlightLegDto {
  return {
    legId: `${from}-${to}-${dep}`,
    departureAirport: from,
    departureAirportName: from,
    arrivalAirport: to,
    arrivalAirportName: to,
    departureTime: dep,
    arrivalTime: arr,
    durationMinutes: Math.round((Date.parse(arr) - Date.parse(dep)) / 60_000),
    stopCount: 0,
    segments: [],
    layovers: [],
    carriers: [{ code: 'W6', name: 'Wizz Air', safetyWarning: 'safe' }],
  };
}

function booking(
  id: string,
  out: FlightLegDto,
  back: FlightLegDto,
  price: number,
): FlightResultDto {
  return {
    itineraryId: id,
    outboundLeg: out,
    returnLeg: back,
    totalDurationMinutes: out.durationMinutes + back.durationMinutes,
    totalStops: 0,
    pricingOptions: [
      { price, currency: 'USD', agentName: 'Kiwi.com', deepLink: `https://kiwi/${id}` },
    ],
    lowestPrice: price,
    currency: 'USD',
    safetyWarnings: {
      hasBannedCarrier: false,
      hasCautionCarrier: false,
      carriers: [],
    },
  };
}

describe('composeSplitItinerary', () => {
  const positioning = booking(
    'a1',
    leg('VAR', 'SOF', '2026-10-07T06:00:00Z', '2026-10-07T07:00:00Z'),
    leg('SOF', 'VAR', '2026-10-15T20:00:00Z', '2026-10-15T21:00:00Z'),
    60,
  );
  const main = booking(
    'b1',
    leg('SOF', 'KEF', '2026-10-07T12:00:00Z', '2026-10-07T16:30:00Z'),
    leg('KEF', 'SOF', '2026-10-15T08:00:00Z', '2026-10-15T14:30:00Z'),
    240,
  );

  it('composes when both directions connect (5h out, 5h30 back)', () => {
    const itinerary = composeSplitItinerary('SOF', positioning, main);
    expect(itinerary).not.toBeNull();
    expect(itinerary!.lowestPrice).toBe(300);
    expect(itinerary!.outboundLeg.departureAirport).toBe('VAR');
    expect(itinerary!.outboundLeg.arrivalAirport).toBe('KEF');
    // One ticket boundary = one extra stop each way.
    expect(itinerary!.outboundLeg.stopCount).toBe(1);
    expect(itinerary!.selfTransfer?.hub).toBe('SOF');
    expect(itinerary!.selfTransfer?.bookings).toHaveLength(2);
    expect(itinerary!.selfTransfer?.bookings[0].price).toBe(60);
  });

  it('rejects a tight same-day connection (under 4h)', () => {
    const tight = booking(
      'b2',
      leg('SOF', 'KEF', '2026-10-07T09:00:00Z', '2026-10-07T13:30:00Z'),
      main.returnLeg!,
      240,
    );
    expect(composeSplitItinerary('SOF', positioning, tight)).toBeNull();
  });

  it('accepts an overnight in the hub city', () => {
    const overnight = booking(
      'b3',
      leg('SOF', 'KEF', '2026-10-08T09:00:00Z', '2026-10-08T13:30:00Z'),
      main.returnLeg!,
      240,
    );
    expect(composeSplitItinerary('SOF', positioning, overnight)).not.toBeNull();
  });

  it('rejects when the ride home leaves before the main leg lands', () => {
    const lateBack = booking(
      'b4',
      main.outboundLeg,
      leg('KEF', 'SOF', '2026-10-15T18:00:00Z', '2026-10-15T23:30:00Z'),
      240,
    );
    // Positioning return departs 20:00; main lands 23:30 — impossible.
    expect(composeSplitItinerary('SOF', positioning, lateBack)).toBeNull();
  });
});
