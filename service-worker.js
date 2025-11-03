self.addEventListener('install', e => {
  e.waitUntil(
    caches.open('phoenix-cache').then(cache => {
      return cache.addAll([
        './',
        './index.html',
        './style.css',
        './app.js',
        './manifest.webmanifest',
        './Logo Phoenix.PNG',
        './Oak light.jpg',
        './Wallpaper.PNG',
        './Hero Phoenix.jpg'
      ]);
    })
  );
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(resp => resp || fetch(e.request))
  );
});
