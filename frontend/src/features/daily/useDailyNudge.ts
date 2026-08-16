import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../components/Toast/ToastProvider';
import { useAuth } from '../auth/authApi';
import { useGetDailyStatsQuery } from './dailyApi';
import { loadDayState, loadStats, todayUtc } from './dailyPuzzle';
import {
  loadLastNudged,
  markNudged,
  nudgeMessage,
  shouldNudge,
} from './dailyNudge';

/** Long enough that the app has landed; short enough to still matter. */
const NUDGE_DELAY_MS = 5000;

/**
 * Remind a streak-holder that today's puzzle is still open.
 *
 * Mounted on the map page only — never on /daily itself (you are already
 * there) and never in satellite pages. One toast per UTC day at most,
 * marked spent the moment it shows, so dismissing it buys silence until
 * tomorrow. Anonymous players are covered by their localStorage streak.
 */
export function useDailyNudge() {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: serverStats } = useGetDailyStatsQuery(undefined, {
    skip: !user,
  });
  // The effect re-runs when server stats land; one nudge per mount is the cap.
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) return;

    const today = todayUtc();
    const localStats = loadStats();
    const streak = serverStats?.streak ?? localStats.streak;
    const wonToday =
      loadDayState(today)?.status === 'won' ||
      serverStats?.lastWonDate === today ||
      localStats.lastWonDate === today;

    if (!shouldNudge({ today, streak, wonToday, lastNudged: loadLastNudged() }))
      return;

    // Fired only inside the timeout: when server stats land mid-delay this
    // effect re-runs, the cleanup cancels the pending timer, and the fresh
    // evaluation schedules a new one — flagging earlier would cancel the
    // nudge outright.
    const timer = setTimeout(() => {
      firedRef.current = true;
      markNudged(today);
      showToast(nudgeMessage(streak), {
        durationMs: 10000,
        action: {
          label: 'Play',
          onAction: () => navigate('/daily'),
        },
      });
    }, NUDGE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [serverStats, showToast, navigate]);
}
