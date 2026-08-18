import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth, hasKnownAccount } from './authApi';
import ContrailLoader from '../../components/ContrailLoader';

/* The most-seen loading state in the app (every hard load passes the
   session check), so it wears the brand: the contrail drawing itself. */
function LoadingScreen({ message }: { message: string }) {
  return (
    <div
      className="scroll-page bg-canvas flex items-center justify-center"
      aria-live="polite"
    >
      <ContrailLoader label={message} />
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
