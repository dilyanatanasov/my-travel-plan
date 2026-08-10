import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './authApi';

/**
 * Gate for every route that renders user data.
 *
 * While /auth/me is in flight we render a placeholder rather than redirecting,
 * otherwise a hard refresh would bounce a logged-in user to /login before the
 * session check completes.
 */
function RequireAuth() {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
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
          <span className="text-sm text-gray-500">Loading your map…</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Navigate to="/login" replace state={{ from: location.pathname }} />
    );
  }

  return <Outlet />;
}

export default RequireAuth;
