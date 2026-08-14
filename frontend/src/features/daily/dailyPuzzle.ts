import { geoDistance } from 'd3-geo';

/**
 * The puzzle uses the 50m-resolution atlas, not the map's 110m one: the
 * coarse tier silently drops microstates — Malta, Andorra, Liechtenstein —
 * which is unacceptable in a guessing game (typing "Malta" and finding
 * nothing reads as broken). ~240KB gzipped, fetched only on /daily, cached
 * per session like the map's own loader.
 */
const GEO_50M_URL =
  'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json';
let dailyGeographyPromise: Promise<unknown> | null = null;

export function loadDailyGeography(): Promise<unknown> {
  dailyGeographyPromise ??= fetch(GEO_50M_URL)
    .then((response) => {
      if (!response.ok)
        throw new Error(`Geography fetch failed: ${response.status}`);
      return response.json();
    })
    .catch((error) => {
      dailyGeographyPromise = null;
      throw error;
    });
  return dailyGeographyPromise;
}

/**
 * The daily country guesser's pure logic (2026-08-14, D6): deterministic
 * daily pick, Worldle-style hints (distance + compass direction +
 * proximity), localStorage streaks, emoji share grid. No backend — the
 * whole game derives from the UTC date and the map's own geography data.
 */

/** Launch day; puzzle #1. */
const EPOCH_UTC = Date.UTC(2026, 7, 13);
const EARTH_KM = 6371;
/** Antipodes are ~20,015km apart — the proximity scale's far end. */
const MAX_KM = 20000;

export type LonLat = [number, number];

/** "YYYY-MM-DD" for the current UTC day — the whole world plays the same one. */
export function todayUtc(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function puzzleNumber(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  const days = Math.round((Date.UTC(y, m - 1, d) - EPOCH_UTC) / 86_400_000);
  return days + 1;
}

/**
 * Stable index for the day. A tiny string hash (FNV-ish) rather than
 * Math.random: every visitor, every timezone, same country.
 */
export function dailyIndex(dateStr: string, count: number): number {
  let hash = 2166136261;
  for (let i = 0; i < dateStr.length; i++) {
    hash ^= dateStr.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash) % Math.max(count, 1);
}

const ARROWS = ['⬆️', '↗️', '➡️', '↘️', '⬇️', '↙️', '⬅️', '↖️'] as const;

/** Initial great-circle bearing from → to, snapped to 8 compass arrows. */
export function bearingArrow(from: LonLat, to: LonLat): string {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const [λ1, φ1] = [toRad(from[0]), toRad(from[1])];
  const [λ2, φ2] = [toRad(to[0]), toRad(to[1])];
  const Δλ = λ2 - λ1;
  const θ = Math.atan2(
    Math.sin(Δλ) * Math.cos(φ2),
    Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ),
  );
  const degrees = ((θ * 180) / Math.PI + 360) % 360;
  return ARROWS[Math.round(degrees / 45) % 8];
}

export interface GuessResult {
  name: string;
  km: number;
  arrow: string;
  /** 1 at the answer, 0 at the antipode. */
  proximity: number;
  correct: boolean;
}

export function evaluateGuess(
  guessName: string,
  guessCentroid: LonLat,
  answerName: string,
  answerCentroid: LonLat,
): GuessResult {
  const correct = guessName === answerName;
  const km = correct
    ? 0
    : Math.round(geoDistance(guessCentroid, answerCentroid) * EARTH_KM);
  return {
    name: guessName,
    km,
    arrow: correct ? '🎯' : bearingArrow(guessCentroid, answerCentroid),
    proximity: correct ? 1 : Math.max(0, 1 - km / MAX_KM),
    correct,
  };
}

/** Five squares per guess: greens by proximity, one yellow for a half. */
export function guessSquares(proximity: number): string {
  if (proximity >= 1) return '🟩🟩🟩🟩🟩';
  const fifths = proximity * 5;
  const greens = Math.floor(fifths);
  const yellow = fifths - greens >= 0.5 ? 1 : 0;
  return '🟩'.repeat(greens) + '🟨'.repeat(yellow) + '⬜'.repeat(5 - greens - yellow);
}

export function shareText(
  number: number,
  guesses: GuessResult[],
  won: boolean,
  url: string,
): string {
  const score = won ? `${guesses.length}/6` : 'X/6';
  const rows = guesses.map(
    (guess) => `${guessSquares(guess.proximity)} ${guess.arrow}`,
  );
  return [`myContrail daily #${number} — ${score}`, ...rows, url].join('\n');
}

/* ------------------------- persistence ------------------------- */

export interface DayState {
  date: string;
  guesses: GuessResult[];
  status: 'playing' | 'won' | 'lost';
  /**
   * The answer this state was played against. If the candidate dataset
   * ever changes mid-day (it did once, 110m→50m), the pick shifts — and
   * old guesses must not render against a new answer.
   */
  answerName?: string;
}

export interface DailyStats {
  played: number;
  won: number;
  streak: number;
  maxStreak: number;
  lastWonDate: string | null;
}

const STATE_KEY = 'contrail:daily-state';
const STATS_KEY = 'contrail:daily-stats';

export const EMPTY_STATS: DailyStats = {
  played: 0,
  won: 0,
  streak: 0,
  maxStreak: 0,
  lastWonDate: null,
};

function yesterdayOf(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d) - 86_400_000)
    .toISOString()
    .slice(0, 10);
}

/** Streak survives only consecutive UTC days of wins. Pure for testing. */
export function applyResult(
  stats: DailyStats,
  dateStr: string,
  won: boolean,
): DailyStats {
  const streak = won
    ? stats.lastWonDate === yesterdayOf(dateStr)
      ? stats.streak + 1
      : 1
    : 0;
  return {
    played: stats.played + 1,
    won: stats.won + (won ? 1 : 0),
    streak,
    maxStreak: Math.max(stats.maxStreak, streak),
    lastWonDate: won ? dateStr : stats.lastWonDate,
  };
}

export function loadDayState(dateStr: string): DayState | null {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DayState;
    return parsed.date === dateStr ? parsed : null;
  } catch {
    return null;
  }
}

export function saveDayState(state: DayState): void {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
  } catch {
    /* private browsing: the game still plays, it just forgets */
  }
}

export function loadStats(): DailyStats {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    return raw ? { ...EMPTY_STATS, ...(JSON.parse(raw) as DailyStats) } : EMPTY_STATS;
  } catch {
    return EMPTY_STATS;
  }
}

export function saveStats(stats: DailyStats): void {
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  } catch {
    /* as above */
  }
}
