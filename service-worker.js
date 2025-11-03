// service-worker.js (v11) — hard refresh all assets
const CACHE = 'phoenix-v11';
const CORE = [
  './',
  './index.html?v=11',
  './style.css?v=11',
  './app.js',
  './sync.js',       // harmless if missing
  './migrate.js',    // harmless if missing
  './manifest.webmanifest',
  './Logo Phoenix.PNG',
  './Oak light.jpg',
  './Wallpaper.PNG',
  './Hero Phoenix.jpg'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => (k !== CACHE ? caches.delete(k) : null)))
    )
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request).then(resp => {
      const copy = resp.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy));
      return resp;
    }))
  );
});
