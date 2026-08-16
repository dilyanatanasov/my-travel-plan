import { useMemo, useState } from 'react';
import type { Airport } from '../../../types';
import AirportSearch from '../../../components/AirportSearch';
import Button from '../../../components/ui/Button';
import MonthPills from '../components/MonthPills';
import { defaultMonth } from '../months';
import SurfaceCalendar from './SurfaceCalendar';
import TripResultCard from './TripResultCard';
import WatchList from './WatchList';
import { useSmartSearch } from './useSmartSearch';
import { useCreateWatchMutation } from './watchesApi';
import { useToast } from '../../../components/Toast/ToastProvider';

/**
 * The v2 funnel's face: "May, Sofia to Tokyo, at least 5 nights" as a
 * form, then the stream — calendar first (which dates look cheap at all),
 * bookable results as they land, judgement badges when the funnel has
 * seen enough to have an opinion.
 */
function TripSearchPanel() {
  const [origin, setOrigin] = useState<Airport | null>(null);
  const [destination, setDestination] = useState<Airport | null>(null);
  const [month, setMonth] = useState(defaultMonth());
  const [minNights, setMinNights] = useState('');
  const [maxNights, setMaxNights] = useState('');
  const {
    phase,
    surface,
    candidates,
    results,
    judgements,
    meta,
    error,
    search,
  } = useSmartSearch();
  const [createWatch, { isLoading: isWatching }] = useCreateWatchMutation();
  const { showToast } = useToast();

  const handleWatch = async () => {
    if (!origin || !destination) return;
    try {
      await createWatch({
        origin: origin.iataCode,
        destination: destination.iataCode,
        month,
        minNights: minNights ? Number(minNights) : undefined,
        maxNights: maxNights ? Number(maxNights) : undefined,
      }).unwrap();
      showToast('Watching this route — you’ll hear when it drops', {
        tone: 'success',
      });
    } catch (watchError) {
      const message =
        (watchError as { data?: { message?: string } })?.data?.message ??
        'Could not create the watch';
      showToast(message, { tone: 'error' });
    }
  };

  const judgementById = useMemo(
    () => new Map(judgements.map((judgement) => [judgement.itineraryId, judgement])),
    [judgements],
  );
  const sortedResults = useMemo(
    () =>
      // Judged results first (in role order), then cheapest-first.
      [...results].sort((a, b) => {
        const rank = (id: string) => {
          const role = judgementById.get(id)?.role;
          return role === 'recommended' ? 0 : role ? 1 : 2;
        };
        return (
          rank(a.itineraryId) - rank(b.itineraryId) ||
          a.lowestPrice - b.lowestPrice
        );
      }),
    [results, judgementById],
  );

  const canSearch =
    origin !== null && destination !== null && phase !== 'starting';

  const handleSearch = () => {
    if (!origin || !destination) return;
    void search({
      origin: origin.iataCode,
      destination: destination.iataCode,
      month,
      minNights: minNights ? Number(minNights) : undefined,
      maxNights: maxNights ? Number(maxNights) : undefined,
    });
  };

  return (
    <div className="space-y-4">
      <div className="bg-surface border border-line rounded-2xl p-4 space-y-3">
        <MonthPills selected={month} onSelect={setMonth} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <AirportSearch
            value={origin}
            onChange={setOrigin}
            placeholder="From airport"
          />
          <AirportSearch
            value={destination}
            onChange={setDestination}
            placeholder="To airport"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-sm text-ink-muted" htmlFor="min-nights">
            Nights
          </label>
          <input
            id="min-nights"
            type="number"
            inputMode="numeric"
            min={1}
            max={60}
            placeholder="min"
            value={minNights}
            onChange={(event) => setMinNights(event.target.value)}
            className="w-20 min-h-10 px-2 border border-line rounded-lg bg-surface text-ink text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <span className="text-ink-subtle text-sm">–</span>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={90}
            placeholder="max"
            aria-label="Maximum nights"
            value={maxNights}
            onChange={(event) => setMaxNights(event.target.value)}
            className="w-20 min-h-10 px-2 border border-line rounded-lg bg-surface text-ink text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <div className="flex-1" />
          {/* Watching needs only the route+month — no search required. */}
          <Button
            variant="outline"
            onClick={handleWatch}
            disabled={!origin || !destination || isWatching}
          >
            {isWatching ? 'Saving…' : 'Watch prices'}
          </Button>
          <Button onClick={handleSearch} disabled={!canSearch}>
            {phase === 'starting' ? 'Starting…' : 'Find the right dates'}
          </Button>
        </div>
      </div>

      <WatchList />

      {error && (
        <p className="text-sm text-danger bg-danger-soft border border-danger/30 rounded-xl px-4 py-3">
          {error}
        </p>
      )}

      {surface.length > 0 && (
        <SurfaceCalendar
          month={month}
          surface={surface}
          candidates={candidates}
        />
      )}

      {phase === 'streaming' && (
        <p className="text-sm text-ink-muted animate-pulse">
          Pricing {candidates.length} candidate dates…
        </p>
      )}

      {phase === 'done' && surface.length === 0 && (
        <div className="bg-surface border border-line rounded-2xl px-5 py-8 text-center">
          <h3 className="text-base font-semibold text-ink">
            No recent prices for this route
          </h3>
          <p className="text-sm text-ink-muted mt-1 max-w-md mx-auto">
            The price surface has nothing fresh for this month yet
            {meta?.degraded
              ? ' and the live providers are unavailable right now'
              : ''}
            . Try a nearby month or check back later.
          </p>
        </div>
      )}

      {sortedResults.length > 0 && (
        <div className="space-y-2.5">
          {sortedResults.map((flight) => (
            <TripResultCard
              key={flight.itineraryId}
              flight={flight}
              judgement={judgementById.get(flight.itineraryId)}
            />
          ))}
        </div>
      )}

      {phase === 'done' && surface.length > 0 && results.length === 0 && (
        <p className="text-sm text-ink-muted">
          {meta?.degraded
            ? 'Live pricing is unavailable right now — the calendar above shows the indicative picture.'
            : 'No bookable itineraries came back for the candidate dates.'}
        </p>
      )}

      {phase === 'done' && meta && (
        <p className="text-[11px] text-ink-subtle">
          {meta.cacheHits > 0
            ? `${meta.cacheHits} cached prices`
            : 'fresh prices'}{' '}
          · {meta.upstreamCalls} live lookups ·{' '}
          {(meta.durationMs / 1000).toFixed(1)}s
        </p>
      )}
    </div>
  );
}

export default TripSearchPanel;
