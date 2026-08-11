import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth, useLogoutMutation } from './authApi';

function AccountMenu() {
  const { user } = useAuth();
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

  const label = user.displayName || user.email;
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
        className="flex items-center gap-2 min-h-11 px-2 rounded-lg hover:bg-surface-sunken focus:outline-none focus:ring-2 focus:ring-brand-500"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label={`Account menu for ${label}`}
      >
        <span className="w-8 h-8 rounded-full bg-brand-600 text-white flex items-center justify-center text-sm font-semibold flex-shrink-0">
          {initial}
        </span>
        <span className="hidden sm:block text-sm text-ink max-w-[10rem] truncate">
          {label}
        </span>
      </button>

      {isOpen && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-56 bg-surface border border-line rounded-lg shadow-lg py-1 z-50"
        >
          <div className="px-3 py-2 border-b border-line">
            <p className="text-sm font-medium text-ink truncate">
              {user.displayName || 'Signed in'}
            </p>
            <p className="text-xs text-ink-muted truncate">{user.email}</p>
          </div>
          <Link
            to="/settings"
            role="menuitem"
            onClick={() => setIsOpen(false)}
            className="block px-3 py-2.5 text-sm text-ink hover:bg-surface-sunken"
          >
            Settings
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={handleLogout}
            disabled={isLoading}
            className="w-full text-left px-3 py-2.5 text-sm text-ink hover:bg-surface-sunken disabled:opacity-50"
          >
            {isLoading ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      )}
    </div>
  );
}

export default AccountMenu;
