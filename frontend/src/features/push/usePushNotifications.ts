import { useCallback, useEffect, useState } from 'react';
import {
  useSubscribePushMutation,
  useUnsubscribePushMutation,
} from './pushApi';

export type PushSupport =
  | 'ready'
  /** iPhone/iPad in a plain browser tab: push exists only once the site is
   *  installed to the home screen, so the UI shows install steps instead. */
  | 'ios-install'
  | 'unsupported';

/** The browser hands out base64url; subscribe() wants raw bytes. */
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

function detectSupport(): PushSupport {
  const standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as { standalone?: boolean }).standalone === true;
  // iPadOS reports itself as a Mac; the touch check catches it.
  const isIos =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.userAgent.includes('Mac') && navigator.maxTouchPoints > 1);
  if (isIos && !standalone) return 'ios-install';
  if (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  ) {
    return 'ready';
  }
  return 'unsupported';
}

/**
 * One browser's push subscription, as toggle-shaped state.
 *
 * The browser is the source of truth for "enabled" — the server only mirrors
 * it — so state initializes from pushManager.getSubscription(), and enable()
 * must run inside a user gesture (the permission prompt requires one).
 */
export function usePushNotifications() {
  const [support] = useState<PushSupport>(detectSupport);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [subscribePush] = useSubscribePushMutation();
  const [unsubscribePush] = useUnsubscribePushMutation();

  useEffect(() => {
    if (support !== 'ready') return;
    let cancelled = false;
    navigator.serviceWorker.ready
      .then((registration) => registration.pushManager.getSubscription())
      .then((subscription) => {
        if (!cancelled) setEnabled(Boolean(subscription));
      })
      .catch(() => {
        /* stays disabled, which is honest */
      });
    return () => {
      cancelled = true;
    };
  }, [support]);

  /** Resolves to null on success, or a user-facing failure message. */
  const enable = useCallback(async (): Promise<string | null> => {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        return 'Notifications are blocked for this site in your browser settings.';
      }

      const base = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api';
      const response = await fetch(`${base}/push/public-key`);
      if (!response.ok) {
        return 'Notifications are not available right now.';
      }
      const { key } = (await response.json()) as { key: string };

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key),
      });

      const json = subscription.toJSON();
      try {
        await subscribePush({
          endpoint: subscription.endpoint,
          keys: { p256dh: json.keys!.p256dh, auth: json.keys!.auth },
        }).unwrap();
      } catch {
        // The server never learned about it; leaving the browser subscribed
        // would show the toggle on while nothing can ever arrive.
        await subscription.unsubscribe().catch(() => undefined);
        return 'Could not save the subscription — try again.';
      }

      setEnabled(true);
      return null;
    } catch {
      return 'Could not enable notifications — try again.';
    } finally {
      setBusy(false);
    }
  }, [subscribePush]);

  const disable = useCallback(async (): Promise<void> => {
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        // Server first: if the delete fails the browser side stays, and the
        // toggle honestly remains on.
        await unsubscribePush({ endpoint: subscription.endpoint }).unwrap();
        await subscription.unsubscribe().catch(() => undefined);
      }
      setEnabled(false);
    } catch {
      /* keep current state */
    } finally {
      setBusy(false);
    }
  }, [unsubscribePush]);

  return { support, enabled, busy, enable, disable };
}
