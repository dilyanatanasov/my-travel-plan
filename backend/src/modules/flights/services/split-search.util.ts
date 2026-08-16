import { FlightLegDto, FlightResultDto } from '../dto/flight-result.dto';
import { PricePoint } from '../providers/flight-provider.interface';
import { nightsBetween } from './search-funnel.util';

/**
 * The split-ticket tier's pure half (user decision 2026-08-16): a
 * separate-booking combination via a positioning hub IS a route — VAR⇄SOF
 * on one ticket plus SOF⇄KEF on another is how you actually get from
 * Varna to Iceland — so it is priced end-to-end and judged on the same
 * Pareto front as any through-ticket. The only honest difference is risk,
 * which the composed result carries in `selfTransfer` for the UI to say
 * out loud.
 */

/**
 * Positioning hubs for an origin: the nearest majors, because "how do I
 * actually leave Varna" is a geography question. Origin and destination
 * themselves are excluded — a hub you are already at is not positioning.
 */
export function nearestHubCodes(
  origin: { latitude: number; longitude: number; iataCode: string },
  hubs: { iataCode: string; latitude: number; longitude: number }[],
  destinationIata: string,
  count = 3,
): string[] {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const distance = (hub: { latitude: number; longitude: number }) => {
    const dLat = toRad(hub.latitude - origin.latitude);
    const dLon = toRad(hub.longitude - origin.longitude);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(origin.latitude)) *
        Math.cos(toRad(hub.latitude)) *
        Math.sin(dLon / 2) ** 2;
    return 2 * Math.asin(Math.sqrt(a));
  };
  return hubs
    .filter(
      (hub) =>
        hub.iataCode !== origin.iataCode && hub.iataCode !== destinationIata,
    )
    .sort((a, b) => distance(a) - distance(b))
    .slice(0, count)
    .map((hub) => hub.iataCode);
}

/** Same-day connections need breathing room; a night in the hub city is fine. */
const MIN_CONNECT_MS = 4 * 60 * 60 * 1000;
/** Beyond this the "connection" is a separate holiday. */
const MAX_CONNECT_MS = 36 * 60 * 60 * 1000;

export interface SplitComboCandidate {
  hub: string;
  /** origin⇄hub round trip, surface estimate. */
  legA: { departureDate: string; returnDate: string; price: number };
  /** hub⇄destination round trip, surface estimate. */
  legB: { departureDate: string; returnDate: string; price: number };
  estimatedTotal: number;
}

function dayAfter(date: string): string {
  return new Date(Date.parse(date) + 86_400_000).toISOString().slice(0, 10);
}

/**
 * Date-aligned combos from two legs' price surfaces. The positioning leg
 * departs the same day or the day before the main leg (sleep in the hub
 * city), and returns the same day or the day after the main leg lands
 * back. Seasonality needs no special case: a month the hub route does not
 * fly simply contributes no points and no combos.
 */
export function composeSurfaceCombos(
  hub: string,
  legAPoints: PricePoint[],
  legBPoints: PricePoint[],
  options: { minNights?: number; maxNights?: number; k?: number },
): SplitComboCandidate[] {
  const k = options.k ?? 2;
  const combos: SplitComboCandidate[] = [];

  const legBByDeparture = new Map<string, PricePoint[]>();
  for (const point of legBPoints) {
    if (!point.returnDate) continue;
    const list = legBByDeparture.get(point.departureDate) ?? [];
    list.push(point);
    legBByDeparture.set(point.departureDate, list);
  }

  for (const a of legAPoints) {
    if (!a.returnDate) continue;
    for (const bDeparture of [a.departureDate, dayAfter(a.departureDate)]) {
      for (const b of legBByDeparture.get(bDeparture) ?? []) {
        const nights = nightsBetween(b.departureDate, b.returnDate!);
        if (options.minNights !== undefined && nights < options.minNights)
          continue;
        if (options.maxNights !== undefined && nights > options.maxNights)
          continue;
        // The positioning ticket must still be in the hub city to fly home:
        // its return leaves the same day the main leg lands, or the next.
        if (
          a.returnDate !== b.returnDate &&
          a.returnDate !== dayAfter(b.returnDate!)
        )
          continue;
        combos.push({
          hub,
          legA: {
            departureDate: a.departureDate,
            returnDate: a.returnDate,
            price: a.price,
          },
          legB: {
            departureDate: b.departureDate,
            returnDate: b.returnDate!,
            price: b.price,
          },
          estimatedTotal: a.price + b.price,
        });
      }
    }
  }

  return combos
    .sort((x, y) => x.estimatedTotal - y.estimatedTotal)
    .slice(0, k);
}

function connectionMs(arrive: string, departNext: string): number {
  return Date.parse(departNext) - Date.parse(arrive);
}

function connectionOk(arrive: string, departNext: string): boolean {
  const gap = connectionMs(arrive, departNext);
  return gap >= MIN_CONNECT_MS && gap <= MAX_CONNECT_MS;
}

function elapsedMinutes(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / 60_000);
}

function composeLeg(first: FlightLegDto, second: FlightLegDto): FlightLegDto {
  return {
    legId: `${first.legId}+${second.legId}`,
    departureAirport: first.departureAirport,
    departureAirportName: first.departureAirportName,
    arrivalAirport: second.arrivalAirport,
    arrivalAirportName: second.arrivalAirportName,
    departureTime: first.departureTime,
    arrivalTime: second.arrivalTime,
    durationMinutes: elapsedMinutes(first.departureTime, second.arrivalTime),
    stopCount: first.stopCount + second.stopCount + 1,
    segments: [...first.segments, ...second.segments],
    layovers: [
      ...first.layovers,
      {
        airport: first.arrivalAirport,
        airportName: first.arrivalAirportName,
        durationMinutes: elapsedMinutes(
          first.arrivalTime,
          second.departureTime,
        ),
      },
      ...second.layovers,
    ],
    carriers: [
      ...first.carriers,
      ...second.carriers.filter(
        (carrier) => !first.carriers.some((c) => c.code === carrier.code),
      ),
    ],
  };
}

/**
 * One bookable pair → one composed itinerary, or null when the real
 * flight times break the connection rule in either direction. `a` is the
 * positioning round trip (origin⇄hub), `b` the main one (hub⇄dest).
 */
export function composeSplitItinerary(
  hub: string,
  a: FlightResultDto,
  b: FlightResultDto,
): FlightResultDto | null {
  if (!a.returnLeg || !b.returnLeg) return null;
  if (!connectionOk(a.outboundLeg.arrivalTime, b.outboundLeg.departureTime))
    return null;
  if (!connectionOk(b.returnLeg.arrivalTime, a.returnLeg.departureTime))
    return null;

  const outboundLeg = composeLeg(a.outboundLeg, b.outboundLeg);
  const returnLeg = composeLeg(b.returnLeg, a.returnLeg);
  const totalPrice = a.lowestPrice + b.lowestPrice;
  const aLink = a.pricingOptions[0]?.deepLink ?? '';
  const bLink = b.pricingOptions[0]?.deepLink ?? '';

  return {
    itineraryId: `split:${hub}:${a.itineraryId}:${b.itineraryId}`,
    outboundLeg,
    returnLeg,
    totalDurationMinutes:
      outboundLeg.durationMinutes + returnLeg.durationMinutes,
    totalStops: outboundLeg.stopCount + returnLeg.stopCount,
    pricingOptions: [
      {
        price: totalPrice,
        currency: a.currency,
        agentName: 'two bookings',
        deepLink: bLink || aLink,
        cabinClass: undefined,
        fareFamily: undefined,
      },
    ],
    lowestPrice: totalPrice,
    currency: a.currency,
    safetyWarnings: {
      hasBannedCarrier:
        a.safetyWarnings.hasBannedCarrier || b.safetyWarnings.hasBannedCarrier,
      hasCautionCarrier:
        a.safetyWarnings.hasCautionCarrier ||
        b.safetyWarnings.hasCautionCarrier,
      carriers: [...a.safetyWarnings.carriers, ...b.safetyWarnings.carriers],
    },
    selfTransfer: {
      hub,
      bookings: [
        {
          label: `${a.outboundLeg.departureAirport} ⇄ ${hub}`,
          price: a.lowestPrice,
          deepLink: aLink,
        },
        {
          label: `${hub} ⇄ ${b.outboundLeg.arrivalAirport}`,
          price: b.lowestPrice,
          deepLink: bLink,
        },
      ],
    },
  };
}

/**
 * Best composed itineraries from two result sets: try the cheapest few of
 * each side, keep pairs whose real times connect, cheapest total first.
 */
export function composeSplitResults(
  hub: string,
  aResults: FlightResultDto[],
  bResults: FlightResultDto[],
  limit = 2,
): FlightResultDto[] {
  const tryTop = 4;
  const cheapest = (results: FlightResultDto[]) =>
    [...results].sort((x, y) => x.lowestPrice - y.lowestPrice).slice(0, tryTop);

  const composed: FlightResultDto[] = [];
  for (const a of cheapest(aResults)) {
    for (const b of cheapest(bResults)) {
      const itinerary = composeSplitItinerary(hub, a, b);
      if (itinerary) composed.push(itinerary);
    }
  }
  return composed
    .sort((x, y) => x.lowestPrice - y.lowestPrice)
    .slice(0, limit);
}
