import { Outlet, Link } from 'react-router-dom';
import AccountMenu from '../../features/auth/AccountMenu';
import BrandMark from '../BrandMark';

function Layout() {
  return (
    // Fixed shell: the app fills the viewport and never scrolls as a page.
    // Only panels scroll. This is what stops content hiding below the fold and
    // what stops the map competing with the document for the scroll wheel.
    // 100dvh, not 100vh — iOS Safari's URL bar makes 100vh taller than what is
    // actually visible, which would push the bottom tab bar off screen.
    <div className="h-[100dvh] min-h-0 flex flex-col overflow-hidden bg-canvas">
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
              <h1 className="font-display font-normal text-xl sm:text-2xl text-ink leading-tight">
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
              Flight search is hidden from the nav, not removed. The route,
              the page and the whole backend still work at /search — this only
              takes it out of the way while the map is the product being
              shaped. Its differentiator is persistent personal constraints
              (preferred airports, minimum layover, departure hour), which no
              mainstream flight search offers, so it is worth keeping.
            */}
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
