import { useEffect, useRef } from 'react';
import { Outlet, Link } from 'react-router-dom';
import AccountMenu from '../../features/auth/AccountMenu';
import VerifyEmailBanner from '../../features/auth/VerifyEmailBanner';
import BrandMark from '../BrandMark';
import { useAuth } from '../../features/auth/authApi';
import { track } from '../../lib/analytics';

function Layout() {
  /*
    One session-kind beacon per load (2026-08-14): guest vs registered is
    the split the owner cannot otherwise see in Umami. A kind, never an
    identity — same privacy rule as every other event.
  */
  const { user } = useAuth();
  const kindReported = useRef(false);
  useEffect(() => {
    if (!user || kindReported.current) return;
    kindReported.current = true;
    track('app_session', { kind: user.isGuest ? 'guest' : 'registered' });
  }, [user]);

  return (
    // Fixed shell: the app fills the viewport and never scrolls as a page.
    // Only panels scroll. This is what stops content hiding below the fold and
    // what stops the map competing with the document for the scroll wheel.
    // 100dvh, not 100vh — iOS Safari's URL bar makes 100vh taller than what is
    // actually visible, which would push the bottom tab bar off screen.
    <div className="h-[100dvh] min-h-0 flex flex-col overflow-hidden bg-canvas">
      {/*
        Skip link — the first thing in the tab order, visible only once
        focused.

        Seven stops of chrome sit before the content on every route, and a
        section panel can put a list of 195 countries behind them. Jumping
        straight to <main> is the difference between reaching a country list
        in one keypress and reaching it in eight.

        `sr-only focus:not-sr-only` is the standard pattern: present for
        assistive tech always, painted only when it has focus.
      */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-2 focus:left-2
          focus:px-4 focus:py-2 focus:rounded-lg focus:bg-brand-600 focus:text-white
          focus:text-sm focus:font-medium focus:outline-none focus:ring-2 focus:ring-brand-500"
      >
        Skip to main content
      </a>
      {/* Installed as a PWA there is no browser chrome above this, so the
          header itself has to clear the status bar / notch. */}
      <header
        className="flex-shrink-0 bg-surface border-b border-line z-40"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="px-3 sm:px-4 lg:px-6 h-14 sm:h-16 flex items-center justify-between gap-3">
          <Link to="/" className="flex items-center gap-2 min-h-11 min-w-0">
            <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-brand-600 text-white flex-shrink-0">
              <BrandMark className="w-5 h-5" />
            </span>
            <span className="flex flex-col justify-center min-w-0">
              {/* Two-tone lockup: "my" is the possessive whisper, "Contrail"
                  the brand voice. Screen readers read it as one word. */}
              <h1 className="font-display font-normal text-xl sm:text-2xl text-ink leading-tight">
                <span className="text-base sm:text-lg text-brand-600">my</span>
                Contrail
              </h1>
              {/* Subtitle only where there is room for it */}
              <p className="hidden lg:block text-xs text-ink-subtle leading-tight">
                You leave a trail. See it.
              </p>
            </span>
          </Link>
          <div className="flex items-center gap-2 flex-shrink-0">
            {/*
              Entry point for the "Where to next?" discovery page. /search
              used to be the hidden flight search; it now hosts destination
              discovery, which is meant to be found — icon-only below sm to
              keep the header inside h-14.
            */}
            <Link
              to="/search"
              aria-label="Where to next? (beta)"
              className="flex items-center gap-1.5 min-h-11 px-3 rounded-lg border border-line
                text-sm font-medium text-ink hover:bg-canvas"
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
              <span className="hidden sm:inline-block px-1.5 py-0.5 rounded-full bg-brand-50 text-brand-700 text-[10px] font-semibold uppercase tracking-wide">
                Beta
              </span>
            </Link>
            {/* Settings stays inside the account menu: a header gear was
                tried (2026-08-13) and crowded the mobile header out. */}
            <AccountMenu />
          </div>
        </div>
      </header>
      <VerifyEmailBanner />
      {/* min-h-0 is required for the flex child to be allowed to shrink, which
          is what lets inner panels scroll instead of the page. */}
      {/*
        tabIndex={-1} so the skip link can actually move focus here. Without
        it the browser scrolls to the anchor but leaves focus on the link, and
        the next Tab returns to the header — the skip does nothing.
      */}
      <main id="main-content" tabIndex={-1} className="flex-1 min-h-0 focus:outline-none">
        <Outlet />
      </main>
    </div>
  );
}

export default Layout;
