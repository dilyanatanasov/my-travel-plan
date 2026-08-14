import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { geoAzimuthalEqualArea, geoCentroid, geoPath } from 'd3-geo';
import { loadGeography } from '../components/TravelMap/CountriesLayer';
import { numericToAlpha3 } from '../components/TravelMap/isoCodes';
import { feature } from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import Button from '../components/ui/Button';
import TextInput from '../components/ui/TextInput';
import { useToast } from '../components/Toast/ToastProvider';
import { track } from '../lib/analytics';
import {
  todayUtc,
  puzzleNumber,
  dailyIndex,
  evaluateGuess,
  guessSquares,
  shareText,
  applyResult,
  loadDayState,
  saveDayState,
  loadStats,
  saveStats,
  type DayState,
  type GuessResult,
  type LonLat,
} from '../features/daily/dailyPuzzle';

interface Candidate {
  name: string;
  iso3: string;
  centroid: LonLat;
  geometry: GeoJSON.Feature;
}

const MAX_GUESSES = 6;

/** ms until the next UTC midnight — when tomorrow's country arrives. */
function msToNextUtcMidnight(now = new Date()): number {
  const next = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
  );
  return next - now.getTime();
}

function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = String(Math.floor(total / 3600)).padStart(2, '0');
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
  const s = String(total % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

/**
 * The daily country guesser (/daily, 2026-08-14): one silhouette per UTC
 * day, six guesses, distance + direction hints. Deliberately playable by
 * anyone — no account, streaks in localStorage; the game IS the funnel,
 * and the nudge under a finished puzzle points at the map.
 */
function DailyPage() {
  const { showToast } = useToast();
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const date = todayUtc();
  const number = puzzleNumber(date);

  useEffect(() => {
    let active = true;
    loadGeography()
      .then((topology) => {
        if (!active) return;
        const topo = topology as unknown as Topology;
        const collection = feature(
          topo,
          topo.objects.countries as GeometryCollection,
        ) as unknown as { features: GeoJSON.Feature[] };
        const list: Candidate[] = [];
        for (const geometry of collection.features) {
          const iso3 =
            numericToAlpha3[String(parseInt(String(geometry.id), 10))];
          const name = (geometry.properties as { name?: string })?.name;
          const centroid = geoCentroid(geometry);
          if (!iso3 || !name) continue;
          if (!Number.isFinite(centroid[0]) || !Number.isFinite(centroid[1]))
            continue;
          list.push({ name, iso3, centroid: [centroid[0], centroid[1]], geometry });
        }
        list.sort((a, b) => a.name.localeCompare(b.name));
        setCandidates(list);
      })
      .catch(() => {
        if (active) setCandidates([]);
      });
    return () => {
      active = false;
    };
  }, []);

  const answer = useMemo(() => {
    if (!candidates || candidates.length === 0) return null;
    return candidates[dailyIndex(date, candidates.length)];
  }, [candidates, date]);

  // The silhouette, projected alone and centered on itself.
  const silhouettePath = useMemo(() => {
    if (!answer) return null;
    const projection = geoAzimuthalEqualArea()
      .rotate([-answer.centroid[0], -answer.centroid[1]])
      .fitExtent(
        [
          [16, 16],
          [384, 284],
        ],
        answer.geometry as never,
      );
    return geoPath(projection)(answer.geometry as never);
  }, [answer]);

  const [state, setState] = useState<DayState>(() =>
    loadDayState(date) ?? { date, guesses: [], status: 'playing' },
  );
  const [query, setQuery] = useState('');
  const [stats, setStats] = useState(loadStats);
  const [countdown, setCountdown] = useState(msToNextUtcMidnight());

  useEffect(() => {
    if (state.status === 'playing') return;
    const timer = window.setInterval(
      () => setCountdown(msToNextUtcMidnight()),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [state.status]);

  const guessedNames = useMemo(
    () => new Set(state.guesses.map((guess) => guess.name)),
    [state.guesses],
  );

  const suggestions = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed || !candidates || state.status !== 'playing') return [];
    return candidates
      .filter(
        (candidate) =>
          candidate.name.toLowerCase().includes(trimmed) &&
          !guessedNames.has(candidate.name),
      )
      .slice(0, 8);
  }, [query, candidates, guessedNames, state.status]);

  const finish = (guesses: GuessResult[], won: boolean) => {
    const nextState: DayState = {
      date,
      guesses,
      status: won ? 'won' : 'lost',
    };
    setState(nextState);
    saveDayState(nextState);
    const nextStats = applyResult(stats, date, won);
    setStats(nextStats);
    saveStats(nextStats);
    // Result and try-count only — never which country it was.
    track('daily_play', { result: won ? 'won' : 'lost', tries: guesses.length });
  };

  const submitGuess = (candidate: Candidate) => {
    if (!answer || state.status !== 'playing') return;
    const result = evaluateGuess(
      candidate.name,
      candidate.centroid,
      answer.name,
      answer.centroid,
    );
    const guesses = [...state.guesses, result];
    setQuery('');
    if (result.correct) {
      finish(guesses, true);
    } else if (guesses.length >= MAX_GUESSES) {
      finish(guesses, false);
    } else {
      const nextState: DayState = { date, guesses, status: 'playing' };
      setState(nextState);
      saveDayState(nextState);
    }
  };

  const handleShare = async () => {
    const text = shareText(
      number,
      state.guesses,
      state.status === 'won',
      `${window.location.origin}/daily?ref=daily`,
    );
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ text });
        return;
      } catch (error) {
        if ((error as Error)?.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      showToast('Result copied — paste it anywhere', { tone: 'success' });
    } catch {
      showToast(text, { durationMs: 12000 });
    }
  };

  const done = state.status !== 'playing';

  return (
    <div className="scroll-page bg-canvas">
      <div className="max-w-md mx-auto px-4 py-6 sm:py-10">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h1 className="font-display font-normal text-2xl text-ink">
              Daily country
            </h1>
            <p className="text-xs text-ink-subtle">
              #{number} · guess the shape in {MAX_GUESSES}
            </p>
          </div>
          <Link to="/" className="font-display text-lg text-ink flex-shrink-0">
            <span className="text-brand-600 text-sm">my</span>Contrail
          </Link>
        </div>

        {/* The shape. currentColor keeps it honest in both themes. */}
        <div className="bg-surface border border-line rounded-2xl shadow-sm p-2 text-brand-600">
          {silhouettePath ? (
            <svg viewBox="0 0 400 300" className="w-full" aria-label="Mystery country silhouette">
              <path d={silhouettePath} fill="currentColor" />
            </svg>
          ) : (
            <div className="aspect-[4/3] flex items-center justify-center text-sm text-ink-muted">
              {candidates?.length === 0
                ? 'Could not load the world — try a reload.'
                : 'Drawing today’s mystery…'}
            </div>
          )}
        </div>

        {/* Guesses so far. */}
        <ul className="mt-4 space-y-1.5">
          {state.guesses.map((guess, index) => (
            <li
              key={index}
              className="flex items-center gap-2 bg-surface border border-line rounded-lg px-3 min-h-10 text-sm"
            >
              <span className="tracking-tight">{guessSquares(guess.proximity)}</span>
              <span className="font-medium text-ink truncate flex-1">
                {guess.name}
              </span>
              {!guess.correct && (
                <span className="text-ink-muted tabular-nums flex-shrink-0">
                  {guess.km.toLocaleString()} km {guess.arrow}
                </span>
              )}
              {guess.correct && <span className="flex-shrink-0">🎯</span>}
            </li>
          ))}
          {!done &&
            Array.from(
              { length: MAX_GUESSES - state.guesses.length },
              (_, i) => (
                <li
                  key={`empty-${i}`}
                  className="border border-dashed border-line rounded-lg min-h-10"
                />
              ),
            )}
        </ul>

        {!done && (
          <div className="relative mt-3">
            <TextInput
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Which country is this?"
              aria-label="Guess the country"
              autoComplete="off"
              disabled={!answer}
            />
            {suggestions.length > 0 && (
              <ul className="absolute z-10 left-0 right-0 top-full mt-1 bg-surface border border-line rounded-lg shadow-lg overflow-hidden">
                {suggestions.map((candidate) => (
                  <li key={candidate.iso3}>
                    <button
                      type="button"
                      onClick={() => submitGuess(candidate)}
                      className="w-full text-left px-3 min-h-10 text-sm text-ink hover:bg-surface-sunken"
                    >
                      {candidate.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {done && answer && (
          <div className="mt-4 bg-surface border border-line rounded-2xl p-4 text-center space-y-3">
            <p className="text-sm text-ink">
              {state.status === 'won' ? (
                <>
                  Got it — <span className="font-semibold">{answer.name}</span>{' '}
                  in {state.guesses.length}.
                </>
              ) : (
                <>
                  It was <span className="font-semibold">{answer.name}</span>.
                  Tomorrow&rsquo;s revenge awaits.
                </>
              )}
            </p>
            <p className="text-xs text-ink-subtle tabular-nums">
              Streak {stats.streak} · best {stats.maxStreak} · played{' '}
              {stats.played} · next in {formatCountdown(countdown)}
            </p>
            <Button fullWidth onClick={handleShare}>
              Share result
            </Button>
            <p className="text-xs text-ink-muted pt-1">
              Been to {answer.name}?{' '}
              <Link
                to="/register?ref=daily"
                className="text-brand-700 font-medium hover:underline"
              >
                Put it on your own travel map
              </Link>
              .
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default DailyPage;
