const CACHE_NAME = 'egg-inventory-cache-v29';
const APP_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './sync-config.js',
  './HEAD.png',
  './YOLK..png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).then(response => {
        const responseCopy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseCopy));
        return response;
      }).catch(() => caches.match('./index.html'))
    );
    return;
  }

  if (event.request.url.endsWith('/sync-config.js')) {
    event.respondWith(
      fetch(event.request).then(response => {
        const responseCopy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseCopy));
        return response;
      }).catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) return cachedResponse;

      return fetch(event.request).then(response => {
        if (event.request.url.startsWith(self.location.origin)) {
          const responseCopy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseCopy));
        }
        return response;
      }).catch(() => caches.match('./index.html'));
    })
  );
});
