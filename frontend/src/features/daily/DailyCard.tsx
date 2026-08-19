import { Link } from 'react-router-dom';
import {
  todayUtc,
  puzzleNumber,
  loadDayState,
  loadStats,
} from './dailyPuzzle';
import { useGetDailyStatsQuery } from './dailyApi';
import { useAuth } from '../auth/authApi';

/**
 * The daily guesser's home inside the app (owner decision 2026-08-14:
 * Overview card, no header entry). Everything here is localStorage - the
 * card renders your streak and today's state without any request.
 */
function DailyCard() {
  const date = todayUtc();
  const number = puzzleNumber(date);
  const state = loadDayState(date);
  // Server streak when the session has one (survives new devices and
  // cleared caches); localStorage otherwise.
  const { user } = useAuth();
  const { data: serverStats } = useGetDailyStatsQuery(undefined, {
    skip: !user,
  });
  const stats = serverStats ?? loadStats();

  const status =
    state?.status === 'won'
      ? `Solved in ${state.guesses.length} - back tomorrow`
      : state?.status === 'lost'
        ? 'Revealed - revenge tomorrow'
        : 'Guess the country from its shape';

  // Play is an explore verb, so the card speaks teal (2026-08-18).
  return (
    <Link
      to="/daily"
      className="block bg-secondary-soft/40 border border-secondary-600/30 rounded-2xl p-4 shadow-sm hover:border-secondary-600/70 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary-600"
    >
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <h3 className="text-sm font-semibold text-ink">Daily country</h3>
        <span className="text-[11px] text-ink-subtle">#{number}</span>
      </div>
      <p className="text-xs text-ink-muted">{status}</p>
      {stats.streak > 0 && (
        <p className="text-xs text-secondary-text font-medium mt-1.5 flex items-center gap-1">
          {/* SVG flame, not the fire emoji (owner rule: no emoji in UI). */}
          <svg
            className="w-3.5 h-3.5 flex-shrink-0"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M12 2c1.2 3-0.6 4.8-1.8 6.3C8.9 9.9 7.5 11.6 7.5 14a4.5 4.5 0 0 0 9 0c0-1.1-.3-2-.8-2.9-.5.7-1.1 1.2-1.9 1.6.5-2.7-.2-7-1.8-10.7z" />
          </svg>
          <span>
            {stats.streak}-day streak
            {stats.maxStreak > stats.streak ? ` · best ${stats.maxStreak}` : ''}
          </span>
        </p>
      )}
    </Link>
  );
}

export default DailyCard;
