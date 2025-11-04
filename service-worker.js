// service-worker.js (v12) — cache with versioned core; refresh safely
const CACHE = 'phoenix-v12';
const CORE = [
  './',
  './index.html',
  './style.css?v=12',
  './app.js',
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
    caches.keys().then(keys => Promise.all(keys.map(k => k !== CACHE ? caches.delete(k) : null)))
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
