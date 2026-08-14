import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import AppHeader, { BrandLockup } from './AppHeader';
import { useAuth } from '../../features/auth/authApi';

/**
 * Chrome for satellite pages — the daily puzzle, duels (2026-08-14
 * coherence pass, owner: "lets do it properly").
 *
 * A session gets the REAL app header, so these pages are rooms in the
 * same house rather than kiosks outside it. Strangers get one shared
 * slim header — brand lockup plus a conversion action — replacing the
 * three ad-hoc mini-headers these pages had each grown.
 */
function SatelliteShell({
  children,
  anonymousAction,
}: {
  children: ReactNode;
  /** Right-side action for signed-out viewers; a register CTA by default. */
  anonymousAction?: ReactNode;
}) {
  const { user } = useAuth();

  if (user) {
    return (
      <div className="h-[100dvh] min-h-0 flex flex-col overflow-hidden bg-canvas">
        <AppHeader />
        <main className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className="scroll-page bg-canvas">
      <header
        className="bg-surface border-b border-line"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="max-w-6xl mx-auto px-3 sm:px-4 h-14 sm:h-16 flex items-center justify-between gap-3">
          <BrandLockup />
          <div className="flex-shrink-0">
            {anonymousAction ?? (
              <Link
                to="/register"
                className="inline-flex items-center min-h-11 px-3 sm:px-4 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700"
              >
                Make your own map
              </Link>
            )}
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}

export default SatelliteShell;
