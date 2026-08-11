import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth, hasKnownAccount } from './authApi';

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
 * Signing up is not a prerequisite for using the app, and neither is having a
 * session: an unrecognised visitor is dropped straight onto the map with no
 * account at all. The account row is created lazily by the base query the
 * first time they write something, so looking around costs nothing.
 *
 * While /auth/me is in flight we render a placeholder rather than acting on
 * the result, otherwise a hard refresh would bounce a signed-in user before
 * the session check completes.
 */
function RequireAuth() {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <LoadingScreen message="Loading your map…" />;
  }

  // A device that has held an account gets the login screen rather than an
  // empty map, because a fresh empty map is indistinguishable from data loss.
  if (!isAuthenticated && hasKnownAccount()) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}

export default RequireAuth;
