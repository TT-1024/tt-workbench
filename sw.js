/* TT工作台 - Service Worker for offline support */
const CACHE_NAME = 'tt-workbench-v23-modal-vertical';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/idb.js',
  './js/store.js',
  './js/utils.js',
  './js/cloudsync.js',
  './js/ainews.js',
  './js/app.js',
  './js/planning.js',
  './js/learning.js',
  './js/podcast.js',
  './js/food.js',
  './js/album.js',
  './js/inspiration.js',
  './js/conversation.js',
  './assets/avatar.jpg',
  './data-backup.json'
];

// Install: cache all static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: cache-first strategy for static assets, network-first for others
self.addEventListener('fetch', (event) => {
  const req = event.request;
  
  // Only handle GET requests
  if (req.method !== 'GET') return;

  // Skip cross-origin requests
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  const networkFirst = req.mode === 'navigate' ||
    url.pathname.endsWith('/index.html') ||
    url.pathname.endsWith('/data-backup.json') ||
    url.pathname.endsWith('/js/cloudsync.js') ||
    url.pathname.endsWith('/js/store.js') ||
    url.pathname.endsWith('/js/app.js') ||
    url.pathname.endsWith('/js/ainews.js') ||
    url.pathname.endsWith('/css/style.css');

  if (networkFirst) {
    event.respondWith(
      fetch(req).then((res) => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, clone));
        }
        return res;
      }).catch(async () => {
        return (await caches.match(req)) || (await caches.match('./index.html'));
      })
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => cached || fetch(req).then((res) => {
      if (res.ok) {
        const clone = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(req, clone));
      }
      return res;
    }))
  );
});
