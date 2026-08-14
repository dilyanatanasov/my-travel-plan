import { useEffect, useRef } from 'react';
import { Outlet } from 'react-router-dom';
import VerifyEmailBanner from '../../features/auth/VerifyEmailBanner';
import AppHeader from './AppHeader';
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
      <AppHeader />
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
