import { FlightLegDto, FlightResultDto } from '../dto/flight-result.dto';
import { CandidatePick } from './search-funnel.util';
import { SplitComboCandidate } from './split-search.util';

/**
 * Estimate cards (2026-08-16, the night Kiwi's data API died under us):
 * when no precise provider can answer, the surface's real date pairs
 * become results anyway — an indicative total and a deep link that opens
 * the live search for exactly those dates. Honest about what they are
 * (isEstimate), useless for Pareto (no durations — the judgement skips
 * them), and they still earn: the deep links carry the affiliate marker.
 */

function estimateLeg(
  origin: string,
  destination: string,
  date: string,
): FlightLegDto {
  const midnight = `${date}T00:00:00Z`;
  return {
    legId: `est-${origin}-${destination}-${date}`,
    departureAirport: origin,
    departureAirportName: origin,
    arrivalAirport: destination,
    arrivalAirportName: destination,
    departureTime: midnight,
    arrivalTime: midnight,
    durationMinutes: 0,
    stopCount: 0,
    segments: [],
    layovers: [],
    carriers: [],
  };
}

function baseEstimate(
  origin: string,
  destination: string,
  departureDate: string,
  returnDate: string | null,
  price: number,
  deepLink: string,
): FlightResultDto {
  return {
    itineraryId: `estimate:${origin}-${destination}:${departureDate}`,
    outboundLeg: estimateLeg(origin, destination, departureDate),
    returnLeg: returnDate
      ? estimateLeg(destination, origin, returnDate)
      : undefined,
    totalDurationMinutes: 0,
    totalStops: 0,
    pricingOptions: [
      {
        price,
        currency: 'USD',
        agentName: 'Kiwi.com',
        deepLink,
        cabinClass: undefined,
        fareFamily: undefined,
      },
    ],
    lowestPrice: price,
    currency: 'USD',
    safetyWarnings: {
      hasBannedCarrier: false,
      hasCautionCarrier: false,
      carriers: [],
    },
    isEstimate: true,
  };
}

export function directEstimate(
  origin: string,
  destination: string,
  candidate: CandidatePick,
  deepLink: string,
): FlightResultDto {
  return baseEstimate(
    origin,
    destination,
    candidate.departureDate,
    candidate.returnDate,
    candidate.surfacePrice,
    deepLink,
  );
}

/** A split combo as an estimate: two tickets, two links, one honest total. */
export function splitEstimate(
  origin: string,
  destination: string,
  combo: SplitComboCandidate,
  legALink: string,
  legBLink: string,
): FlightResultDto {
  const estimate = baseEstimate(
    origin,
    destination,
    combo.legA.departureDate,
    combo.legA.returnDate,
    combo.estimatedTotal,
    legBLink,
  );
  return {
    ...estimate,
    itineraryId: `estimate-split:${combo.hub}:${combo.legA.departureDate}`,
    selfTransfer: {
      hub: combo.hub,
      bookings: [
        {
          label: `${origin} ⇄ ${combo.hub}`,
          price: combo.legA.price,
          deepLink: legALink,
        },
        {
          label: `${combo.hub} ⇄ ${destination}`,
          price: combo.legB.price,
          deepLink: legBLink,
        },
      ],
    },
  };
}
