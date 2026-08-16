import type { FlightLegDto, FlightResultDto } from '../../../types';
import type { SearchJudgement } from './useSmartSearch';

interface TripResultCardProps {
  flight: FlightResultDto;
  judgement?: SearchJudgement;
}

const ROLE_LABEL: Record<SearchJudgement['role'], string> = {
  recommended: 'Our pick',
  cheapest: 'Cheapest',
  fastest: 'Fastest',
};

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins ? `${hours}h ${mins}m` : `${hours}h`;
}

function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function LegRow({ leg, label }: { leg: FlightLegDto; label: string }) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-14 flex-shrink-0 text-[11px] uppercase tracking-wide text-ink-subtle">
        {label}
      </span>
      <span className="font-mono font-semibold text-ink">
        {leg.departureAirport} {formatTime(leg.departureTime)} →{' '}
        {leg.arrivalAirport} {formatTime(leg.arrivalTime)}
      </span>
      <span className="text-ink-muted text-xs whitespace-nowrap">
        {formatDay(leg.departureTime)} · {formatDuration(leg.durationMinutes)} ·{' '}
        {leg.stopCount === 0
          ? 'direct'
          : `${leg.stopCount} stop${leg.stopCount > 1 ? 's' : ''}`}
      </span>
    </div>
  );
}

/**
 * One streamed itinerary, in the app's own design language (the legacy
 * FlightCard predates the token system). The judgement badge and its
 * "why" line come from the funnel — real deltas, not marketing.
 */
function TripResultCard({ flight, judgement }: TripResultCardProps) {
  const booking = flight.pricingOptions[0];
  const carriers = [
    ...new Set(
      flight.outboundLeg.carriers
        .concat(flight.returnLeg?.carriers ?? [])
        .map((carrier) => carrier.name),
    ),
  ];

  return (
    <div
      className={`bg-surface border rounded-2xl p-4 ${
        judgement?.role === 'recommended'
          ? 'border-brand-500 shadow-md'
          : 'border-line'
      }`}
    >
      {judgement && (
        <div className="flex items-center gap-2 mb-2">
          <span className="px-2 py-0.5 rounded-full bg-brand-600 text-white text-[10px] font-semibold uppercase tracking-wide">
            {ROLE_LABEL[judgement.role]}
          </span>
          <span className="text-xs text-ink-muted">
            {judgement.whyRecommended}
          </span>
        </div>
      )}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1.5 min-w-0">
          <LegRow leg={flight.outboundLeg} label="Out" />
          {flight.returnLeg && <LegRow leg={flight.returnLeg} label="Back" />}
          <p className="text-xs text-ink-subtle truncate">
            {carriers.join(', ')}
          </p>
          {flight.safetyWarnings?.hasBannedCarrier && (
            <p className="text-xs text-danger">
              Includes a carrier on the EU air-safety list.
            </p>
          )}
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-2xl font-bold text-ink tabular-nums">
            ${Math.round(flight.lowestPrice)}
          </p>
          <p className="text-[11px] text-ink-subtle mb-2">
            {formatDuration(flight.totalDurationMinutes)} total
          </p>
          {booking && (
            <a
              href={booking.deepLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center min-h-9 px-3 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700"
            >
              Book on {booking.agentName}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

export default TripResultCard;
