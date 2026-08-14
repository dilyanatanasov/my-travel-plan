import { Link } from 'react-router-dom';
import AccountMenu from '../../features/auth/AccountMenu';
import BrandMark from '../BrandMark';

/** The two-tone lockup, shared by the app header and satellite pages. */
export function BrandLockup() {
  return (
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
  );
}

/**
 * The signed-in app header, extracted from Layout (2026-08-14 coherence
 * pass) so satellite pages — the daily puzzle, duels — can wear the real
 * chrome when a session exists instead of inventing their own.
 */
function AppHeader() {
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
          {/* The daily guesser deliberately has no header entry (density
              budget, 2026-08-14): it lives as a card in the Overview
              section and travels by shared links. */}
          {/* Settings stays inside the account menu: a header gear was
              tried (2026-08-13) and crowded the mobile header out. */}
          <AccountMenu />
        </div>
      </div>
    </header>
  );
}

export default AppHeader;
