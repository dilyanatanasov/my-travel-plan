/**
 * Register the service worker.
 *
 * Production only. In dev, a service worker caching the shell fights Vite's
 * HMR and serves stale modules — exactly the class of bug that already cost
 * time on this project via the bind-mount watcher.
 *
 * Note for testing installability on a phone: browsers only register service
 * workers on a secure origin, which means HTTPS or localhost. Over a plain
 * http LAN address Chrome will not offer to install. iOS Safari's "Add to
 * Home Screen" is more permissive and honours the manifest and the
 * apple-mobile-web-app meta tags without a worker.
 */
export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  if (!import.meta.env.PROD) {
    void unregisterInDev();
    return;
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error) => {
      // Not fatal: the app works fine without it, it just is not installable.
      console.warn('Service worker registration failed:', error);
    });
  });
}

/**
 * Evict any worker left behind on a dev origin.
 *
 * Not registering one is not enough: a worker installed earlier — by a
 * production build served from this origin, or by an older version of this
 * file — keeps controlling the page forever. Its asset handler is cache-first
 * on the assumption that Vite fingerprints filenames, which only holds for a
 * build. In dev the module URLs are stable and mutable, so it serves stale
 * modules against fresh ones and the app fails to boot with no obvious cause.
 * Symptom: broken in the normal profile, fine in incognito.
 */
async function unregisterInDev() {
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    if (registrations.length === 0) return;

    await Promise.all(registrations.map((reg) => reg.unregister()));
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }

    // The page is still controlled by the old worker until it is reloaded, so
    // finish the job rather than leaving the user on a half-stale document.
    // Once per tab: if the cleanup somehow does not stick, a reload loop would
    // be a worse failure than the stale worker it is trying to fix.
    const RELOADED = 'contrail-sw-cleanup-reloaded';
    if (sessionStorage.getItem(RELOADED)) {
      console.warn('Stale service worker persisted after cleanup — not reloading again.');
      return;
    }
    sessionStorage.setItem(RELOADED, '1');
    console.warn('Removed a stale service worker from this dev origin — reloading.');
    window.location.reload();
  } catch {
    /* Best effort: never let cleanup break startup. */
  }
}
