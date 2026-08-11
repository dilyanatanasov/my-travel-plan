import { useEffect, useRef } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth, useCreateGuestMutation, hasKnownAccount } from './authApi';

function LoadingScreen({ message }: { message: string }) {
  return (
    <div
      className="scroll-page bg-canvas flex items-center justify-center"
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-col items-center gap-3">
        <svg
          className="w-8 h-8 text-brand-600 animate-spin"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
        <span className="text-sm text-ink-muted">{message}</span>
      </div>
    </div>
  );
}

/**
 * Gate for every route that renders user data.
 *
 * Signing up is not a prerequisite for using the app: an unrecognised visitor
 * is given an anonymous guest session and dropped straight onto the map. The
 * account only becomes necessary to keep that map permanently or to share it.
 *
 * While /auth/me is in flight we render a placeholder rather than acting on
 * the result, otherwise a hard refresh would bounce a signed-in user before
 * the session check completes.
 */
function RequireAuth() {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();
  const [createGuest, { isError: guestFailed }] = useCreateGuestMutation();

  // A device that has held an account gets the login screen instead of a new
  // guest map, because a fresh empty map is indistinguishable from data loss.
  const returning = hasKnownAccount();
  const shouldCreateGuest = !isLoading && !isAuthenticated && !returning;

  // Ref rather than mutation state: React 18 StrictMode runs effects twice in
  // development, and without this that means two accounts for one visitor.
  const requestedRef = useRef(false);

  useEffect(() => {
    if (shouldCreateGuest && !requestedRef.current) {
      requestedRef.current = true;
      void createGuest();
    }
  }, [shouldCreateGuest, createGuest]);

  if (isLoading) {
    return <LoadingScreen message="Loading your map…" />;
  }

  if (!isAuthenticated) {
    if (returning || guestFailed) {
      return <Navigate to="/login" replace state={{ from: location.pathname }} />;
    }
    return <LoadingScreen message="Setting up your map…" />;
  }

  return <Outlet />;
}

export default RequireAuth;
