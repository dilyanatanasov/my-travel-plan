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

/**
 * Route stays on one unbreakable line; the day/duration detail wraps
 * underneath on narrow screens instead of shattering the route text —
 * the mobile breakage from the 2026-08-16 design review.
 */
function LegRow({ leg, label }: { leg: FlightLegDto; label: string }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-sm">
      <span className="w-10 flex-shrink-0 text-[11px] uppercase tracking-wide text-ink-subtle">
        {label}
      </span>
      <span className="font-mono font-semibold text-ink whitespace-nowrap">
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
 * One streamed itinerary. A split-ticket result is a first-class route —
 * same badges, same front — but it says what it is: separate bookings via
 * a positioning hub, no missed-connection protection, one Book button per
 * ticket.
 */
function TripResultCard({ flight, judgement }: TripResultCardProps) {
  const split = flight.selfTransfer;
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
      {(judgement || split) && (
        <div className="flex flex-wrap items-baseline gap-2 mb-2">
          {judgement && (
            <span className="px-2 py-0.5 rounded-full bg-brand-600 text-white text-[10px] font-semibold uppercase tracking-wide">
              {ROLE_LABEL[judgement.role]}
            </span>
          )}
          {split && (
            <span className="px-2 py-0.5 rounded-full bg-surface-sunken text-ink-muted text-[10px] font-semibold uppercase tracking-wide">
              Self-transfer via {split.hub}
            </span>
          )}
          {judgement && (
            <span className="text-xs text-ink-muted">
              {judgement.whyRecommended}
            </span>
          )}
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="space-y-1.5 min-w-0">
          <LegRow leg={flight.outboundLeg} label="Out" />
          {flight.returnLeg && <LegRow leg={flight.returnLeg} label="Back" />}
          <p className="text-xs text-ink-subtle">{carriers.join(', ')}</p>
          {split && (
            <p className="text-xs text-ink-muted">
              Two separate tickets — a delay on the first isn&rsquo;t
              protected on the second. Book both, in this order.
            </p>
          )}
          {flight.safetyWarnings?.hasBannedCarrier && (
            <p className="text-xs text-danger">
              Includes a carrier on the EU air-safety list.
            </p>
          )}
        </div>

        <div className="flex-shrink-0 sm:text-right">
          <div className="flex items-baseline justify-between sm:justify-end gap-2">
            <p className="text-2xl font-bold text-ink tabular-nums">
              ${Math.round(flight.lowestPrice)}
            </p>
            <p className="text-[11px] text-ink-subtle">
              {formatDuration(flight.totalDurationMinutes)} total
            </p>
          </div>
          {split ? (
            <div className="mt-2 flex flex-col gap-1.5">
              {split.bookings.map((ticket) => (
                <a
                  key={ticket.label}
                  href={ticket.deepLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center min-h-9 px-3 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 whitespace-nowrap"
                >
                  {ticket.label} · ${Math.round(ticket.price)}
                </a>
              ))}
            </div>
          ) : (
            booking && (
              <a
                href={booking.deepLink}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center justify-center min-h-9 px-3 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 whitespace-nowrap"
              >
                Book on {booking.agentName}
              </a>
            )
          )}
        </div>
      </div>
    </div>
  );
}

export default TripResultCard;
