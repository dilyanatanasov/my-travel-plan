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
  if (!import.meta.env.PROD) return;
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error) => {
      // Not fatal: the app works fine without it, it just is not installable.
      console.warn('Service worker registration failed:', error);
    });
  });
}
