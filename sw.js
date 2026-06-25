// Taiwan Crash Atlas — Service Worker
// Strategy: cache-first for .bin (large, immutable per deploy)
//           network-first for meta.json (small, may update)
//           stale-while-revalidate for index.html / support.js

const CACHE = 'acc-atlas-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', e => {
  const { pathname } = new URL(e.request.url);

  // Only intercept same-origin data fetches
  if (e.request.method !== 'GET') return;

  if (pathname.endsWith('.bin')) {
    // Cache-first: binary accident files never change for a given deploy
    e.respondWith(
      caches.open(CACHE).then(cache =>
        cache.match(e.request).then(hit => {
          if (hit) return hit;
          return fetch(e.request).then(r => {
            if (r.ok) cache.put(e.request, r.clone());
            return r;
          });
        })
      )
    );
    return;
  }

  if (pathname.endsWith('meta.json')) {
    // Network-first: always try fresh, fall back to cache
    e.respondWith(
      fetch(e.request)
        .then(r => {
          if (r.ok) caches.open(CACHE).then(c => c.put(e.request, r.clone()));
          return r;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  if (pathname.endsWith('index.html') || pathname.endsWith('support.js')) {
    // Stale-while-revalidate for app shell
    e.respondWith(
      caches.open(CACHE).then(cache =>
        cache.match(e.request).then(hit => {
          const fetchPromise = fetch(e.request).then(r => {
            if (r.ok) cache.put(e.request, r.clone());
            return r;
          });
          return hit || fetchPromise;
        })
      )
    );
  }
});
