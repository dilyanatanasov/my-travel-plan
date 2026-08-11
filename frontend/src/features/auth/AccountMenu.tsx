import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth, useLogoutMutation } from './authApi';

function AccountMenu() {
  const { user, isGuest } = useAuth();
  const [logout, { isLoading }] = useLogoutMutation();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Close on outside click and on Escape.
  useEffect(() => {
    if (!isOpen) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen]);

  if (!user) return null;

  // A guest has no email, so there is no initial to show and nothing to
  // address them by.
  const label = user.displayName || user.email || 'Guest';
  const initial = label.charAt(0).toUpperCase();

  const handleLogout = async () => {
    setIsOpen(false);
    try {
      await logout().unwrap();
    } finally {
      // Navigate regardless: the cookie is cleared server-side, and staying
      // put would leave a shell with no data behind it.
      navigate('/login', { replace: true });
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className={
          isGuest
            ? // Deliberately styled as a call to action, not as an avatar. This
              // is the only always-visible reminder that nothing is saved yet,
              // and it costs no layout — a banner would eat scarce vertical
              // space on a phone, where the map is the product.
              'flex items-center gap-1.5 min-h-11 px-3 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500'
            : 'flex items-center gap-2 min-h-11 px-2 rounded-lg hover:bg-surface-sunken focus:outline-none focus:ring-2 focus:ring-brand-500'
        }
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label={isGuest ? 'Guest account — save your map' : `Account menu for ${label}`}
      >
        {isGuest ? (
          <>
            <svg
              className="w-4 h-4 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.8}
                d="M5 13l4 4L19 7"
              />
            </svg>
            <span>Save map</span>
          </>
        ) : (
          <>
            <span className="w-8 h-8 rounded-full bg-brand-600 text-white flex items-center justify-center text-sm font-semibold flex-shrink-0">
              {initial}
            </span>
            <span className="hidden sm:block text-sm text-ink max-w-[10rem] truncate">
              {label}
            </span>
          </>
        )}
      </button>

      {isOpen && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-64 bg-surface border border-line rounded-lg shadow-lg py-1 z-50"
        >
          {isGuest ? (
            <div className="px-3 py-3 border-b border-line">
              <p className="text-sm font-medium text-ink">
                You&rsquo;re not signed in
              </p>
              <p className="text-xs text-ink-muted mt-1 leading-relaxed">
                Your map lives on this device only. Clear your browser or
                switch phones and it&rsquo;s gone. An account keeps it, and
                lets you share it.
              </p>
              <Link
                to="/register"
                role="menuitem"
                onClick={() => setIsOpen(false)}
                className="mt-3 flex items-center justify-center w-full min-h-10 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700"
              >
                Create free account
              </Link>
              <Link
                to="/login"
                role="menuitem"
                onClick={() => setIsOpen(false)}
                className="mt-1 flex items-center justify-center w-full min-h-9 text-sm text-ink-muted hover:text-ink"
              >
                I already have one
              </Link>
            </div>
          ) : (
            <div className="px-3 py-2 border-b border-line">
              <p className="text-sm font-medium text-ink truncate">
                {user.displayName || 'Signed in'}
              </p>
              <p className="text-xs text-ink-muted truncate">{user.email}</p>
            </div>
          )}

          <Link
            to="/settings"
            role="menuitem"
            onClick={() => setIsOpen(false)}
            className="block px-3 py-2.5 text-sm text-ink hover:bg-surface-sunken"
          >
            Settings
          </Link>

          {/* No sign-out for a guest: there are no credentials to sign back
              in with, so it would silently discard everything they added. */}
          {!isGuest && (
            <button
              type="button"
              role="menuitem"
              onClick={handleLogout}
              disabled={isLoading}
              className="w-full text-left px-3 py-2.5 text-sm text-ink hover:bg-surface-sunken disabled:opacity-50"
            >
              {isLoading ? 'Signing out…' : 'Sign out'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default AccountMenu;
