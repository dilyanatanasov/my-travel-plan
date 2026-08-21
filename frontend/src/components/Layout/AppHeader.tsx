import { Link } from 'react-router-dom';
import AccountMenu from '../../features/auth/AccountMenu';
import BrandMark from '../BrandMark';
import { useAuth } from '../../features/auth/authApi';
import { useGetDailyStatsQuery } from '../../features/daily/dailyApi';
import { loadStats } from '../../features/daily/dailyPuzzle';

/** The two-tone lockup, shared by the app header and satellite pages. */
export function BrandLockup() {
  return (
    <Link to="/" className="flex items-center gap-2 min-h-11 min-w-0">
      {/* Bigger where it stands alone (owner eye, 2026-08-21): with the
          wordmark hidden on phones, a 32px mark beside 44px controls read
          as the smallest thing in the row - the one element that should
          never look subordinate. It steps back down at sm, where the
          wordmark returns and carries the weight. */}
      <span className="flex items-center justify-center w-10 h-10 sm:w-8 sm:h-8 rounded-lg bg-brand-600 text-white flex-shrink-0">
        <BrandMark className="w-6 h-6 sm:w-5 sm:h-5" />
      </span>
      <span className="flex flex-col justify-center min-w-0">
        {/* Two-tone lockup: "my" is the possessive whisper, "Contrail"
            the brand voice. Screen readers read it as one word. */}
        {/*
          The mark carries the brand on phones (owner call, 2026-08-21).
          A signed-out phone header holds the discovery chip, the games
          chip and a wide "Save map" CTA, and at 360px the wordmark had
          nowhere left to go - it did not wrap or truncate, it sat UNDER
          the chip beside it. The mark alone is the standard answer at
          this width, and the full lockup returns at sm.
        */}
        <h1 className="font-display font-normal text-xl sm:text-2xl text-ink leading-tight">
          {/* sr-only rather than hidden: display:none would take the
              page's only h1 away from screen readers on phones. This
              keeps the heading, and only its pixels step aside. */}
          <span className="sr-only sm:not-sr-only">
            <span className="text-base sm:text-lg text-brand-600">my</span>
            Contrail
          </span>
        </h1>
        {/* Subtitle only where there is room for it */}
        <p className="hidden lg:block text-xs text-ink-subtle leading-tight">
          You leave a trail. See it.
        </p>
      </span>
    </Link>
  );
}

/**
 * The signed-in app header, extracted from Layout (2026-08-14 coherence
 * pass) so satellite pages — the daily puzzle, duels — can wear the real
 * chrome when a session exists instead of inventing their own.
 */
function AppHeader() {
  /*
    The streak on the Play chip. Server value when a session has one (it
    survives new devices and cleared caches), the local tally otherwise -
    the same precedence the daily card itself uses.
  */
  const { user } = useAuth();
  const { data: serverStats } = useGetDailyStatsQuery(undefined, {
    skip: !user || user.isGuest,
  });
  const playStreak = (serverStats ?? loadStats()).streak;

  return (
    /* Installed as a PWA there is no browser chrome above this, so the
       header itself has to clear the status bar / notch. */
    <header
      className="flex-shrink-0 bg-surface border-b border-line z-40"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div className="px-3 sm:px-4 lg:px-6 h-14 sm:h-16 flex items-center justify-between gap-3">
        <BrandLockup />
        <div className="flex items-center gap-2 flex-shrink-0">
          {/*
            Entry point for the "Where to next?" discovery page. /search
            used to be the hidden flight search; it now hosts destination
            discovery, which is meant to be found — icon-only below sm to
            keep the header inside h-14.
          */}
          {/* The discovery entry wears the secondary teal (owner,
              2026-08-18): exploration is a different verb than the
              terracotta record-keeping actions around it. */}
          <Link
            to="/search"
            aria-label="Where to next? (beta)"
            className="flex items-center gap-1.5 min-h-11 px-3 rounded-lg border border-secondary-600/40
              bg-secondary-soft/60 text-sm font-medium text-secondary-text hover:bg-secondary-soft"
          >
            <svg
              className="w-4 h-4 flex-shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
            </svg>
            <span className="hidden sm:block">Where to next?</span>
            {/* Flight search is beta: fares are cached observations, not
                live quotes — label it so nobody mistakes it for a booking
                engine. Hidden below sm with the label it qualifies. */}
            <span className="hidden sm:inline-block px-1.5 py-0.5 rounded-full bg-secondary-600 text-white text-[10px] font-semibold uppercase tracking-wide">
              Beta
            </span>
          </Link>
          {/*
            The games' entry, PHONES ONLY (owner call, 2026-08-21). This
            reverses the 2026-08-14 "no header entry" decision, and the
            reason it changes is that there are two games now, both
            genuinely hard to find: the daily sat below the fold in
            Overview and the duel hid itself entirely until you had a
            share link. Desktop gets a sixth rail entry instead, so this
            disappears at lg where the rail takes over - measured, the
            header has 117px spare at 390px and this spends about 52 of
            it. The streak rides along because a number you might lose
            is what actually brings people back.
          */}
          <Link
            to="/"
            state={{ section: 'play' }}
            aria-label={
              playStreak > 0
                ? `Play - ${playStreak} day streak`
                : 'Play the daily country'
            }
            /* Fixed square, icon only (owner report, 2026-08-21: it
               crowded the wordmark). A label plus a streak pill made the
               chip grow with the number, which is the one thing a header
               this tight cannot afford - so the streak rides as a corner
               badge and the width never changes. */
            className="lg:hidden relative flex items-center justify-center w-11 h-11 rounded-lg border border-line
              bg-surface text-ink-muted hover:text-ink"
          >
            <svg
              className="w-4 h-4 flex-shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M7.5 9.5h3M9 8v3M15.2 9.6h.01M17 12.2h.01M9.2 5.5h5.6a5 5 0 014.9 4l.8 5.2a2.7 2.7 0 01-2.7 3.1c-1 0-1.9-.5-2.4-1.4l-.5-.9H8.1l-.5.9c-.5.9-1.4 1.4-2.4 1.4a2.7 2.7 0 01-2.7-3.1l.8-5.2a5 5 0 014.9-4z" />
            </svg>
            {playStreak > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-secondary-600 text-white text-[10px] font-semibold tabular-nums">
                {playStreak}
              </span>
            )}
          </Link>
          {/* Settings stays inside the account menu: a header gear was
              tried (2026-08-13) and crowded the mobile header out. */}
          <AccountMenu />
        </div>
      </div>
    </header>
  );
}

export default AppHeader;
