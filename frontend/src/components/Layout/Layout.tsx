import { Outlet, Link } from 'react-router-dom';
import AccountMenu from '../../features/auth/AccountMenu';
import ShareMenu from '../../features/share/ShareMenu';

function Layout() {
  return (
    // Fixed shell: the app fills the viewport and never scrolls as a page.
    // Only panels scroll. This is what stops content hiding below the fold and
    // what stops the map competing with the document for the scroll wheel.
    // 100dvh, not 100vh — iOS Safari's URL bar makes 100vh taller than what is
    // actually visible, which would push the bottom tab bar off screen.
    <div className="h-[100dvh] min-h-0 flex flex-col overflow-hidden bg-canvas">
      <header className="flex-shrink-0 bg-surface border-b border-line z-40">
        <div className="px-3 sm:px-4 lg:px-6 h-14 sm:h-16 flex items-center justify-between gap-3">
          <Link to="/" className="flex flex-col justify-center min-h-11 min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-ink leading-tight">
              Travel Tracker
            </h1>
            {/* Subtitle only where there is room for it */}
            <p className="hidden lg:block text-xs text-ink-subtle leading-tight">
              Track your journeys around the world
            </p>
          </Link>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Link
              to="/search"
              className="flex items-center gap-2 min-h-11 bg-brand-600 hover:bg-brand-700 text-white px-3 sm:px-4 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2"
            >
              <svg
                className="w-5 h-5 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              {/* Label hidden on phones so the button never wraps to two lines */}
              <span className="hidden sm:inline whitespace-nowrap">
                Search Flights
              </span>
              <span className="sr-only sm:hidden">Search Flights</span>
            </Link>
            <ShareMenu />
            <AccountMenu />
          </div>
        </div>
      </header>
      {/* min-h-0 is required for the flex child to be allowed to shrink, which
          is what lets inner panels scroll instead of the page. */}
      <main className="flex-1 min-h-0">
        <Outlet />
      </main>
    </div>
  );
}

export default Layout;
