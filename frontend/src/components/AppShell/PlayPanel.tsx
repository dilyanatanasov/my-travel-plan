import { Link } from 'react-router-dom';
import DailyCard from '../../features/daily/DailyCard';
import DuelSection from '../../features/share/DuelSection';
import { useAuth } from '../../features/auth/authApi';
import { useGetShareStatusQuery } from '../../features/share/shareApi';

/**
 * The games' home (owner ask, 2026-08-21: "they are a bit hidden").
 *
 * Both were reachable but neither was findable: the daily puzzle sat
 * below the region progress in Overview, and the duel was at the very
 * bottom of the Share panel behind a condition that hid it outright
 * until you had already made a share link. Putting them together gives
 * each an address, and gives the shell one place to point at.
 */
function PlayPanel() {
  const { user } = useAuth();
  const isGuest = user?.isGuest ?? false;
  // Duels ride the share token; asking for it here is what lets the
  // card explain itself instead of vanishing.
  const { data: shareStatus } = useGetShareStatusQuery(undefined, {
    skip: isGuest,
  });
  const token = shareStatus?.shareToken ?? null;

  return (
    <div className="space-y-5">
      {/* No heading here: the card titles itself, and two "Daily country"
          lines stacked looked like a rendering bug. */}
      <DailyCard />

      <section>
        <h3 className="text-sm font-medium text-ink mb-2">Duels</h3>
        {token ? (
          <DuelSection myToken={token} />
        ) : (
          /*
            The invitation the old gate swallowed: a duel needs a share
            link, so say that and offer the way there rather than
            hiding the whole feature from anyone who has not made one.
          */
          <div className="rounded-2xl border border-line bg-surface p-4">
            <p className="text-sm text-ink-muted">
              Duels put your map against a friend's, side by side. They
              travel on your share link, so you need one first.
            </p>
            {isGuest ? (
              <p className="text-xs text-ink-subtle mt-2">
                Create an account to share your map and start duelling.
              </p>
            ) : !user?.emailVerified ? (
              <p className="text-xs text-ink-subtle mt-2">
                Verify your email to unlock sharing, then come back here.
              </p>
            ) : (
              <Link
                to="/"
                state={{ section: 'share' }}
                className="inline-flex items-center mt-3 min-h-10 px-3 rounded-xl bg-secondary-600 text-white text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary-600"
              >
                Create a share link
              </Link>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

export default PlayPanel;
