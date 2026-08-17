import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { geoAzimuthalEqualArea, geoCentroid, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import Button from '../components/ui/Button';
import TextInput from '../components/ui/TextInput';
import SatelliteShell from '../components/Layout/SatelliteShell';
import { useToast } from '../components/Toast/ToastProvider';
import { useAuth } from '../features/auth/authApi';
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
  loadDailyGeography,
  type DayState,
  type GuessResult,
  type LonLat,
} from '../features/daily/dailyPuzzle';
import {
  useGetDailyStatsQuery,
  usePostDailyResultMutation,
} from '../features/daily/dailyApi';

interface Candidate {
  name: string;
  centroid: LonLat;
  geometry: GeoJSON.Feature;
}

const MAX_GUESSES = 6;

/** ms until the next UTC midnight - when tomorrow's country arrives. */
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
 * anyone - no account, streaks in localStorage; the game IS the funnel,
 * and the nudge under a finished puzzle points at the map.
 */
function DailyPage() {
  const { showToast } = useToast();
  // Auth-aware, not auth-gated: anonymous players are the point, but a
  // signed-in player must never be sent to a login they already passed.
  const { user, isGuest } = useAuth();
  const isSignedIn = Boolean(user) && !isGuest;
  /*
    Streaks of record: any session (guests included) mirrors results to the
    server, where first-write-wins per day makes cache-clearing pointless.
    Truly anonymous players keep localStorage - that is anonymity's deal.
  */
  const hasSession = Boolean(user);
  const { data: serverStats } = useGetDailyStatsQuery(undefined, {
    skip: !hasSession,
  });
  const [postDailyResult] = usePostDailyResultMutation();
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const date = todayUtc();
  const number = puzzleNumber(date);

  useEffect(() => {
    let active = true;
    // 50m atlas: the coarse map tier drops Malta-sized countries entirely.
    loadDailyGeography()
      .then((topology) => {
        if (!active) return;
        const topo = topology as unknown as Topology;
        const collection = feature(
          topo,
          topo.objects.countries as GeometryCollection,
        ) as unknown as { features: GeoJSON.Feature[] };
        const list: Candidate[] = [];
        const seen = new Set<string>();
        for (const geometry of collection.features) {
          const name = (geometry.properties as { name?: string })?.name;
          const centroid = geoCentroid(geometry);
          if (!name || seen.has(name)) continue;
          if (!Number.isFinite(centroid[0]) || !Number.isFinite(centroid[1]))
            continue;
          seen.add(name);
          list.push({ name, centroid: [centroid[0], centroid[1]], geometry });
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

  /*
    Guard against a shifted answer: saved guesses belong to the answer they
    were made against. A dataset change mid-day re-rolls the pick (seen
    once, 110m→50m: "I got Mongolia with my old answers"), so a state whose
    answerName no longer matches resets to a fresh board.
  */
  useEffect(() => {
    if (!answer || state.guesses.length === 0) return;
    if (state.answerName !== answer.name) {
      const fresh: DayState = {
        date,
        guesses: [],
        status: 'playing',
        answerName: answer.name,
      };
      setState(fresh);
      saveDayState(fresh);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answer?.name]);
  const [query, setQuery] = useState('');
  const [stats, setStats] = useState(loadStats);
  // The server's numbers win when a session has them; local is the fallback.
  const shownStats = serverStats ?? stats;
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
      answerName: answer?.name,
    };
    setState(nextState);
    saveDayState(nextState);
    const nextStats = applyResult(stats, date, won);
    setStats(nextStats);
    saveStats(nextStats);
    if (hasSession) {
      void postDailyResult({ date, won, tries: guesses.length })
        .unwrap()
        .catch(() => undefined); // local copy already has it
    }
    // Result and try-count only - never which country it was.
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
      const nextState: DayState = {
        date,
        guesses,
        status: 'playing',
        answerName: answer.name,
      };
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
      showToast('Result copied - paste it anywhere', { tone: 'success' });
    } catch {
      showToast(text, { durationMs: 12000 });
    }
  };

  const done = state.status !== 'playing';

  return (
    <SatelliteShell
      anonymousAction={
        <Link
          to="/register?ref=daily"
          className="inline-flex items-center min-h-11 px-3 sm:px-4 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700"
        >
          Make your own map
        </Link>
      }
    >
      <div className="max-w-md mx-auto px-4 py-6 sm:py-10">
        <div className="flex items-end justify-between gap-3 mb-4">
          <div>
            <h1 className="font-display font-normal text-2xl text-ink">
              Daily country
            </h1>
            {/* "in 6" read as "6 what?" (friend feedback 2026-08-17) —
                say tries, out loud. */}
            <p className="text-xs text-ink-subtle">
              #{number} · guess the country in {MAX_GUESSES} tries
              {shownStats.streak > 0 && ` · streak ${shownStats.streak}`}
            </p>
          </div>
          {/* The last week, newest right - the record of what you guessed. */}
          {serverStats?.recent && serverStats.recent.length > 0 && (
            <div
              className="flex gap-1 flex-shrink-0"
              aria-label="Your recent results"
            >
              {[...serverStats.recent]
                .slice(0, 7)
                .reverse()
                .map((day) => (
                  <span
                    key={day.date}
                    title={`${day.date} - ${day.won ? `won in ${day.tries}` : 'lost'}`}
                    className={`w-6 h-6 rounded flex items-center justify-center text-[10px] font-semibold ${
                      day.won
                        ? 'bg-brand-600 text-white'
                        : 'bg-danger-soft text-danger'
                    }`}
                  >
                    {day.won ? day.tries : '✕'}
                  </span>
                ))}
            </div>
          )}
        </div>

        {/* The shape. currentColor keeps it honest in both themes. */}
        {/* Capped height so shape + guesses + input fit a phone without
            scrolling (density budget applies off the map too). */}
        <div className="bg-surface border border-line rounded-2xl shadow-sm p-2 text-brand-600 flex justify-center">
          {silhouettePath ? (
            <svg
              viewBox="0 0 400 300"
              className="w-full max-h-[32vh]"
              aria-label="Mystery country silhouette"
            >
              <path d={silhouettePath} fill="currentColor" />
            </svg>
          ) : (
            <div className="h-[32vh] flex items-center justify-center text-sm text-ink-muted">
              {candidates?.length === 0
                ? 'Could not load the world - try a reload.'
                : 'Drawing today’s mystery…'}
            </div>
          )}
        </div>

        {/* Guesses so far. */}
        {state.guesses.length > 0 && (
          /* The squares/arrow read as decoration without a key (friend
             feedback 2026-08-17): one quiet line says the whole language. */
          <p className="mt-4 mb-1.5 text-[11px] text-ink-subtle">
            More green squares = a closer guess · the km and arrow point
            toward the answer
          </p>
        )}
        <ul className="space-y-1.5">
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
                  className="border border-dashed border-line rounded-lg min-h-6"
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
              /* Opens UPWARD: the input sits low on the page, so a downward
                 list fell off-screen behind the scroll (user report). */
              <ul className="absolute z-10 left-0 right-0 bottom-full mb-1 bg-surface border border-line rounded-lg shadow-lg overflow-hidden">
                {suggestions.map((candidate) => (
                  <li key={candidate.name}>
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
                  Got it - <span className="font-semibold">{answer.name}</span>{' '}
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
              Streak {shownStats.streak} · best {shownStats.maxStreak} ·
              played {shownStats.played} · next in {formatCountdown(countdown)}
            </p>
            <Button fullWidth onClick={handleShare}>
              Share result
            </Button>
            <p className="text-xs text-ink-muted pt-1">
              Been to {answer.name}?{' '}
              {isSignedIn ? (
                <Link
                  to="/"
                  className="text-brand-700 font-medium hover:underline"
                >
                  Mark it on your travel map
                </Link>
              ) : (
                <Link
                  to="/register?ref=daily"
                  className="text-brand-700 font-medium hover:underline"
                >
                  Put it on your own travel map
                </Link>
              )}
              .
            </p>
          </div>
        )}
      </div>
    </SatelliteShell>
  );
}

export default DailyPage;
