const CACHE_NAME = 'verdiq-cache-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/css/index.css',
  '/css/components.css',
  '/css/pages.css',
  '/js/app.js',
  '/js/store.js',
  '/js/utils.js',
  '/manifest.json',
  '/icon.svg'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
  );
});
