import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { apiSlice } from '../store/api/apiSlice';
import { rememberAccount } from '../features/auth/accountMemory';
import { track } from '../lib/analytics';
import ContrailLoader from '../components/ContrailLoader';

/**
 * Where a Google sign-in lands (2026-10-03). The cookie is already set by
 * the callback; this page does what the login and register mutations do
 * in onQueryStarted - remember that this device holds an account (or a
 * returning user with an expired session gets dropped on an empty guest
 * map), record the funnel event, drop whatever the previous session
 * cached, and continue to where they were headed.
 */
function AuthCompletePage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  useEffect(() => {
    rememberAccount();
    const outcome = params.get('outcome');
    if (outcome === 'signup') track('signup', { method: 'google' });
    else if (outcome === 'guest_convert') track('guest_convert');
    dispatch(apiSlice.util.resetApiState());

    // Same-origin paths only, mirroring the server's safeNext.
    const next = params.get('next') ?? '/';
    const safe = next.startsWith('/') && !next.startsWith('//') ? next : '/';
    navigate(safe, { replace: true });
    // Runs once: the params are fixed for the life of this landing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="scroll-page bg-canvas flex items-center justify-center"
      aria-live="polite"
    >
      <ContrailLoader label="Signing you in…" />
    </div>
  );
}

export default AuthCompletePage;
