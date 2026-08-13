import { useEffect, useRef } from 'react';
import { useToast } from '../components/Toast/ToastProvider';

/** Baked in by the Docker build (deploy SHA); empty in local builds. */
const BUILT_VERSION = import.meta.env.VITE_APP_VERSION as string | undefined;

const CHECK_INTERVAL_MS = 15 * 60 * 1000;

/**
 * Offer a reload when this tab is running a stale build.
 *
 * A deployed SPA cannot reach into tabs that are already open — a phone that
 * reopens the installed app hours later is still on last week's bundle with
 * no hint anything changed. The build's own SHA is compared against the
 * always-fresh /version.json, checked when the tab becomes visible (exactly
 * the reopen moment) and on a slow interval.
 *
 * A prompt, never an automatic reload: someone halfway through typing a
 * flight should not lose it to a deploy.
 */
export function useVersionCheck(): void {
  const { showToast } = useToast();
  // One prompt per discovered version — visibility flaps must not stack
  // toasts for the same deploy.
  const promptedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!BUILT_VERSION) return;

    let disposed = false;

    const check = async () => {
      try {
        const res = await fetch('/version.json', { cache: 'no-store' });
        if (!res.ok) return;
        const { version } = (await res.json()) as { version?: string };
        if (disposed || !version || version === BUILT_VERSION) return;
        if (promptedRef.current === version) return;
        promptedRef.current = version;
        showToast('A new version of myContrail is ready', {
          durationMs: 60_000,
          action: { label: 'Reload', onAction: () => window.location.reload() },
        });
      } catch {
        // Offline or mid-deploy; a later check will catch up.
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') void check();
    };

    void check();
    const timer = window.setInterval(() => void check(), CHECK_INTERVAL_MS);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      disposed = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [showToast]);
}
