import { useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useVerifyEmailMutation } from '../features/auth/authApi';
import AuthLayout from '../features/auth/AuthLayout';
import { getApiErrorMessage } from '../features/auth/authStyles';

/**
 * Landing page for the emailed verify link. Submits the token on mount —
 * the user's only job was clicking the link.
 */
function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [verifyEmail, { isSuccess, isError, error }] = useVerifyEmailMutation();

  // Guard against React 18 StrictMode double-mount: the token is single-use,
  // so a second automatic POST would report failure after a success.
  const fired = useRef(false);
  useEffect(() => {
    if (!token || fired.current) return;
    fired.current = true;
    void verifyEmail({ token });
  }, [token, verifyEmail]);

  const body = !token ? (
    <p className="text-sm text-ink-muted leading-relaxed">
      This link is missing its token — try copying the whole link from the
      email into the address bar.
    </p>
  ) : isSuccess ? (
    <div className="space-y-3">
      <p className="text-sm text-ink leading-relaxed" role="status">
        Your email is verified — sharing is unlocked.
      </p>
      <Link
        to="/"
        className="flex items-center justify-center w-full min-h-11 rounded-xl bg-brand-600 text-white text-sm font-medium hover:bg-brand-700"
      >
        Back to your map
      </Link>
    </div>
  ) : isError ? (
    <div className="space-y-3">
      <div
        role="alert"
        className="bg-danger-soft border border-danger/30 text-danger px-3 py-2 rounded-lg text-sm"
      >
        {getApiErrorMessage(error, 'This link is invalid or has expired')}
      </div>
      <p className="text-xs text-ink-muted leading-relaxed">
        Links work once and expire after 24 hours. Sign in and use the resend
        button to get a fresh one.
      </p>
    </div>
  ) : (
    <p className="text-sm text-ink-muted" role="status">
      Verifying…
    </p>
  );

  return (
    <AuthLayout
      title="Email verification"
      subtitle="One click, and done"
      footer={
        <Link
          to="/"
          className="text-brand-text hover:text-brand-700 font-medium"
        >
          Back to the map
        </Link>
      }
    >
      {body}
    </AuthLayout>
  );
}

export default VerifyEmailPage;
