/**
 * The pure gate for the daily-puzzle reminder toast (M3, 2026-08-16).
 *
 * The audience decision: only someone with a live streak who has not won
 * today. People who never play are never nagged; the toast exists to
 * protect a thing its owner already cares about, not to advertise the game.
 */

export interface NudgeInput {
  /** todayUtc() at evaluation time. */
  today: string;
  /** Best-known streak: server when loaded, localStorage otherwise. */
  streak: number;
  /** True when today's puzzle is already won (either source). */
  wonToday: boolean;
  /** The last UTC day a nudge was shown, from localStorage. */
  lastNudged: string | null;
}

export function shouldNudge(input: NudgeInput): boolean {
  return input.streak >= 1 && !input.wonToday && input.lastNudged !== input.today;
}

export function nudgeMessage(streak: number): string {
  return streak === 1
    ? '🔥 Your streak is on the line - today’s country is waiting'
    : `🔥 ${streak}-day streak on the line - today’s country is waiting`;
}

const NUDGE_KEY = 'contrail:daily-nudged';

export function loadLastNudged(): string | null {
  try {
    return localStorage.getItem(NUDGE_KEY);
  } catch {
    return null;
  }
}

/** Shown = spent, dismissed or not: one nudge per UTC day, ever. */
export function markNudged(today: string): void {
  try {
    localStorage.setItem(NUDGE_KEY, today);
  } catch {
    /* private browsing: worst case is one extra nudge tomorrow */
  }
}
