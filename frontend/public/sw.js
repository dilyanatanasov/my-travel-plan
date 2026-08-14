/* eslint-env serviceworker */
/**
 * Service worker.
 *
 * Chrome will not offer to install a PWA without one that has a fetch
 * handler, so this exists first and foremost to make the app installable.
 * Beyond that it keeps the shell available offline; it deliberately does not
 * cache API responses, because stale travel data presented as current is
 * worse than an honest failure.
 */
// Bump on any change to the app shell (manifest included!): the cache is
// consulted before the network, so a shell change without a version bump is
// invisible to every browser that has visited before — that is exactly how
// the myContrail rename failed to reach installed/returning visitors.
const CACHE = 'mycontrail-v2';

const APP_SHELL = [
  '/',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      // Individually, so one missing file cannot fail the whole install.
      .then((cache) => Promise.allSettled(APP_SHELL.map((url) => cache.add(url))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  // Never serve the API from cache: someone else's countries, or your own
  // from last week, shown as if current would be a correctness bug.
  if (url.pathname.startsWith('/api/')) return;

  // A request that opts out of caching (version.json above all) must reach
  // the network: `cache: 'no-store'` only bypasses the HTTP cache, not this
  // worker, and the cache-first branch below would otherwise freeze the
  // deploy stamp at whatever build first cached it — making every newer
  // build think it is stale and re-prompt for a reload that fixes nothing.
  if (request.cache === 'no-store') return;

  // Navigations: network first so a deploy is picked up immediately, with the
  // cached shell as the offline fallback.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put('/', copy));
          return response;
        })
        .catch(() => caches.match('/').then((cached) => cached || Response.error()))
    );
    return;
  }

  // Static assets: cache first. Vite fingerprints filenames, so a cached hit
  // is always the right content for that URL.
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((response) => {
          if (response.ok && response.type === 'basic') {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
    )
  );
});
