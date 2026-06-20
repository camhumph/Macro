/* Macro — service worker: offline cache (cache-first for app shell) */
const CACHE = 'macro-v3';
const ASSETS = [
  './', './index.html', './styles.css', './manifest.json',
  './js/data.js', './js/store.js', './js/ui.js', './js/workout.js',
  './js/food.js', './js/scan.js', './js/barcode.js', './js/weight.js', './js/reminders.js', './js/stats.js', './js/app.js',
  './icons/icon.svg'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;
  e.respondWith(
    caches.match(request).then(cached => {
      const network = fetch(request).then(res => {
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(request, copy));
        }
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
