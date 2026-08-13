import { useState } from 'react';
import { useAuth, useResendVerificationMutation } from './authApi';

/**
 * One-line nudge under the header while the account's email is unverified.
 * Verification only gates sharing, so this stays quiet and dismissible-by-
 * doing rather than modal: the app keeps working either way.
 */
function VerifyEmailBanner() {
  const { user, isGuest } = useAuth();
  const [resendVerification, { isLoading }] = useResendVerificationMutation();
  const [sent, setSent] = useState(false);

  if (!user || isGuest || user.emailVerified) {
    return null;
  }

  const handleResend = async () => {
    try {
      await resendVerification().unwrap();
      setSent(true);
    } catch {
      // Throttled or offline — the button stays enabled for another try.
    }
  };

  return (
    <div
      role="status"
      className="flex-shrink-0 bg-brand-50 border-b border-line px-3 sm:px-4 lg:px-6 py-2
        flex items-center justify-center gap-2 text-xs text-ink"
    >
      <span className="min-w-0 truncate">
        {sent
          ? `Verification email sent to ${user.email} — check your inbox.`
          : 'Verify your email to unlock sharing your map.'}
      </span>
      {!sent && (
        <button
          type="button"
          onClick={handleResend}
          disabled={isLoading}
          className="flex-shrink-0 font-medium text-brand-text hover:text-brand-700 underline
            disabled:opacity-50 min-h-8 px-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded"
        >
          {isLoading ? 'Sending…' : 'Resend email'}
        </button>
      )}
    </div>
  );
}

export default VerifyEmailBanner;
