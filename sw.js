// Change VERSION on every release: it triggers the "update available" banner and refreshes the cache.
const VERSION = '2.0.1';
const CACHE = 'mylifts-' + VERSION, CDN = 'mylifts-cdn';
const FILES = ['./', 'index.html', 'styles.css', 'app.js', 'store.js', 'data.js', 'views.js', 'workout.js', 'stats.js', 'body.js', 'home.js', 'measure.js', 'tools.js', 'foods.js', 'food.js', 'demo.js', 'firebase-config.js', 'manifest.json',
  'icon-192.png', 'icon-512.png', 'icon-maskable.png'];

self.addEventListener('install', e => e.waitUntil(
  caches.open(CACHE).then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' }))))));

self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE && k !== CDN).map(k => caches.delete(k))))
    .then(() => self.clients.claim())));

self.addEventListener('message', e => {
  if (e.data === 'skip') self.skipWaiting();
  if (e.data === 'version') e.source.postMessage({ version: VERSION });
});

self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET') return;
  if (u.origin === location.origin) {
    if (u.pathname.endsWith('firebase-config.js')) { // always fetch the newest config, fall back to cache offline
      e.respondWith(fetch(r).catch(() => caches.match(r, { ignoreSearch: true })));
      return;
    }
    e.respondWith(caches.match(r, { ignoreSearch: true }).then(c => c || fetch(r).catch(() => caches.match('./'))));
  } else if (['www.gstatic.com', 'raw.githubusercontent.com'].includes(u.hostname)) { // Firebase SDK: cache so the app opens offline
    e.respondWith(caches.open(CDN).then(async c => {
      const m = await c.match(r);
      const n = fetch(r).then(x => { c.put(r, x.clone()); return x; }).catch(() => m);
      return m || n;
    }));
  }
});
