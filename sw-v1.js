// sw-v1.js — Phoenix Bar (network-first for HTML, cache-first for assets)
const CACHE = 'phoenix-static-v1';
const ASSETS = [
  'styles.css?v=2',
  'app.js?v=2',
  'light-oak.jpg',
  'pattern.png',
  'hero.jpg',
  'icon-192.png',
  'icon-512.png',
  'manifest.webmanifest?v=2'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))),
  );
  self.clients.claim();
});

// network-first for navigations (HTML) so fresh edits show
self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
        return res;
      }).catch(() => caches.match(req))
    );
    return;
  }
  // cache-first for same-origin assets
  if (url.origin === location.origin) {
    event.respondWith(
      caches.match(req).then(cached => cached || fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
        return res;
      }))
    );
  }
});
