/* TT工作台 - Service Worker for offline support */
const CACHE_NAME = 'tt-workbench-v3';
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

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) {
        // Return cached version and update in background
        fetch(req).then((res) => {
          if (res.ok) {
            caches.open(CACHE_NAME).then(cache => cache.put(req, res));
          }
        }).catch(() => {});
        return cached;
      }
      // Not in cache, try network
      return fetch(req).then((res) => {
        if (res.ok && url.origin === location.origin) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, clone));
        }
        return res;
      }).catch(() => {
        // Network failed, try to return index.html as fallback
        return caches.match('./index.html');
      });
    })
  );
});
