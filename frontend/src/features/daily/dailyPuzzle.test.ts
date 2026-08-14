import { describe, it, expect } from 'vitest';
import {
  puzzleNumber,
  dailyIndex,
  bearingArrow,
  evaluateGuess,
  guessSquares,
  shareText,
  applyResult,
  EMPTY_STATS,
} from './dailyPuzzle';

describe('puzzleNumber', () => {
  it('counts from launch day as #1', () => {
    expect(puzzleNumber('2026-08-13')).toBe(1);
    expect(puzzleNumber('2026-08-14')).toBe(2);
    expect(puzzleNumber('2026-09-13')).toBe(32);
  });
});

describe('dailyIndex', () => {
  it('is deterministic for a date and bounded by count', () => {
    const a = dailyIndex('2026-08-14', 177);
    expect(dailyIndex('2026-08-14', 177)).toBe(a);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThan(177);
  });

  it('varies across days (no repeating Monday country)', () => {
    const week = Array.from({ length: 7 }, (_, i) =>
      dailyIndex(`2026-08-${15 + i}`, 177),
    );
    expect(new Set(week).size).toBeGreaterThan(3);
  });
});

describe('bearingArrow', () => {
  it('points the compass sensibly from Sofia', () => {
    const sofia: [number, number] = [23.3, 42.7];
    expect(bearingArrow(sofia, [24.94, 60.17])).toBe('⬆️'); // Helsinki
    expect(bearingArrow(sofia, [139.7, 35.7])).toBe('↗️'); // Tokyo (great circle)
    expect(bearingArrow(sofia, [31.2, 30.0])).toBe('↘️'); // Cairo
    expect(bearingArrow(sofia, [-9.14, 38.7])).toBe('⬅️'); // Lisbon
  });
});

describe('evaluateGuess', () => {
  const sofia: [number, number] = [23.3, 42.7];
  const tokyo: [number, number] = [139.7, 35.7];

  it('marks the correct answer with a bullseye at zero km', () => {
    const hit = evaluateGuess('Japan', tokyo, 'Japan', tokyo);
    expect(hit).toMatchObject({ correct: true, km: 0, arrow: '🎯', proximity: 1 });
  });

  it('measures a miss in km with an arrow toward the answer', () => {
    const miss = evaluateGuess('Bulgaria', sofia, 'Japan', tokyo);
    expect(miss.correct).toBe(false);
    // Sofia–Tokyo is ~9,100km give or take the centroid.
    expect(miss.km).toBeGreaterThan(8500);
    expect(miss.km).toBeLessThan(9800);
    expect(miss.proximity).toBeGreaterThan(0.4);
    expect(miss.proximity).toBeLessThan(0.6);
  });
});

describe('guessSquares', () => {
  it('renders proximity as fifths', () => {
    expect(guessSquares(1)).toBe('🟩🟩🟩🟩🟩');
    expect(guessSquares(0)).toBe('⬜⬜⬜⬜⬜');
    expect(guessSquares(0.5)).toBe('🟩🟩🟨⬜⬜');
    expect(guessSquares(0.9)).toBe('🟩🟩🟩🟩🟨');
  });
});

describe('shareText', () => {
  it('builds the Wordle-style block', () => {
    const guesses = [
      evaluateGuess('Bulgaria', [23.3, 42.7], 'Japan', [139.7, 35.7]),
      evaluateGuess('Japan', [139.7, 35.7], 'Japan', [139.7, 35.7]),
    ];
    const text = shareText(2, guesses, true, 'https://mycontrail.com/daily');
    const lines = text.split('\n');
    expect(lines[0]).toBe('myContrail daily #2 — 2/6');
    expect(lines).toHaveLength(4);
    expect(lines[2]).toBe('🟩🟩🟩🟩🟩 🎯');
    expect(lines[3]).toContain('/daily');
  });
});

describe('applyResult (streaks)', () => {
  it('starts and extends a streak across consecutive days', () => {
    let stats = applyResult(EMPTY_STATS, '2026-08-14', true);
    expect(stats).toMatchObject({ played: 1, won: 1, streak: 1, maxStreak: 1 });
    stats = applyResult(stats, '2026-08-15', true);
    expect(stats.streak).toBe(2);
    expect(stats.maxStreak).toBe(2);
  });

  it('resets the streak after a missed day, keeping maxStreak', () => {
    let stats = applyResult(EMPTY_STATS, '2026-08-14', true);
    stats = applyResult(stats, '2026-08-15', true);
    stats = applyResult(stats, '2026-08-18', true);
    expect(stats.streak).toBe(1);
    expect(stats.maxStreak).toBe(2);
  });

  it('a loss zeroes the streak but still counts as played', () => {
    let stats = applyResult(EMPTY_STATS, '2026-08-14', true);
    stats = applyResult(stats, '2026-08-15', false);
    expect(stats).toMatchObject({ played: 2, won: 1, streak: 0, maxStreak: 1 });
  });

  it('handles the month boundary in yesterday math', () => {
    let stats = applyResult(EMPTY_STATS, '2026-08-31', true);
    stats = applyResult(stats, '2026-09-01', true);
    expect(stats.streak).toBe(2);
  });
});
