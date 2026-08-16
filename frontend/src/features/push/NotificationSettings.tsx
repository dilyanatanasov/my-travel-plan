import { useToast } from '../../components/Toast/ToastProvider';
import Button from '../../components/ui/Button';
import { useTestPushMutation } from './pushApi';
import { usePushNotifications } from './usePushNotifications';

/**
 * The Settings "Notifications" block. Rendered for registered users only —
 * the server refuses guest subscriptions anyway (a push endpoint would
 * outlive the guest account), this just keeps the UI honest about it.
 */
function NotificationSettings() {
  const { support, enabled, busy, enable, disable } = usePushNotifications();
  const { showToast } = useToast();
  const [testPush, { isLoading: isTesting }] = useTestPushMutation();

  const handleTest = async () => {
    try {
      await testPush().unwrap();
      showToast('Test sent — it should pop up in a moment', {
        tone: 'success',
      });
    } catch {
      showToast('Could not send the test — try again', { tone: 'error' });
    }
  };

  const handleToggle = async () => {
    if (enabled) {
      await disable();
      showToast('Notifications turned off');
      return;
    }
    const failure = await enable();
    if (failure) {
      showToast(failure, { tone: 'error' });
    } else {
      showToast('Notifications are on', { tone: 'success' });
    }
  };

  return (
    <section
      aria-labelledby="notifications-heading"
      className="bg-surface border border-line rounded-xl p-4 sm:p-5 mt-4"
    >
      <h2
        id="notifications-heading"
        className="text-base font-semibold text-ink"
      >
        Notifications
      </h2>
      <p className="text-sm text-ink-muted mt-1">
        Trip anniversaries, as they come around — &ldquo;one year ago you
        landed in Tokyo.&rdquo; Nothing else, and only on devices where you
        turn it on.
      </p>

      {support === 'ios-install' && (
        <p className="text-xs text-ink-subtle mt-3 leading-relaxed">
          On iPhone and iPad, notifications only work once myContrail is
          installed: open the Share menu and choose{' '}
          <span className="font-medium text-ink-muted">
            Add to Home Screen
          </span>
          , then turn them on from the installed app.
        </p>
      )}

      {support === 'unsupported' && (
        <p className="text-xs text-ink-subtle mt-3">
          This browser doesn&rsquo;t support web notifications.
        </p>
      )}

      {support === 'ready' && (
        <>
          <Button
            variant={enabled ? 'neutral' : 'outline'}
            fullWidth
            className="mt-3"
            onClick={handleToggle}
            disabled={busy}
            aria-pressed={enabled}
          >
            {busy
              ? 'One moment…'
              : enabled
                ? 'Turn off on this device'
                : 'Turn on notifications'}
          </Button>
          {enabled && (
            <Button
              variant="ghost"
              size="sm"
              fullWidth
              className="mt-2"
              onClick={handleTest}
              disabled={isTesting}
            >
              {isTesting ? 'Sending…' : 'Send a test notification'}
            </Button>
          )}
        </>
      )}
    </section>
  );
}

export default NotificationSettings;
