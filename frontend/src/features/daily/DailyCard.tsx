import { Link } from 'react-router-dom';
import {
  todayUtc,
  puzzleNumber,
  loadDayState,
  loadStats,
} from './dailyPuzzle';

/**
 * The daily guesser's home inside the app (owner decision 2026-08-14:
 * Overview card, no header entry). Everything here is localStorage — the
 * card renders your streak and today's state without any request.
 */
function DailyCard() {
  const date = todayUtc();
  const number = puzzleNumber(date);
  const state = loadDayState(date);
  const stats = loadStats();

  const status =
    state?.status === 'won'
      ? `Solved in ${state.guesses.length} — back tomorrow`
      : state?.status === 'lost'
        ? 'Revealed — revenge tomorrow'
        : 'Guess the country from its shape';

  return (
    <Link
      to="/daily"
      className="block bg-surface border border-line rounded-2xl p-4 shadow-sm hover:border-brand-400 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
    >
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <h3 className="text-sm font-semibold text-ink">Daily country</h3>
        <span className="text-[11px] text-ink-subtle">#{number}</span>
      </div>
      <p className="text-xs text-ink-muted">{status}</p>
      {stats.streak > 0 && (
        <p className="text-xs text-brand-700 font-medium mt-1.5">
          🔥 {stats.streak}-day streak
          {stats.maxStreak > stats.streak ? ` · best ${stats.maxStreak}` : ''}
        </p>
      )}
    </Link>
  );
}

export default DailyCard;
