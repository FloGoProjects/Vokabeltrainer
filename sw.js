// Offline-Cache. Bei jeder Änderung an App-Dateien VERSION erhöhen, sonst sehen Geräte den alten Stand.
const VERSION = 'v2';
const CACHE = `vokabel-gold-${VERSION}`;
const APP_SHELL = [
  './', 'index.html', 'manifest.webmanifest',
  'styles/base.css', 'styles/themes.css',
  'src/app.js', 'src/answer.js', 'src/deck.js', 'src/gold.js', 'src/session.js', 'src/srs.js', 'src/store.js',
  'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('vokabel-gold-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Vokabeln: erst Netz (neue Units), sonst Cache. App: erst Cache (schnell, offline).
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  if (url.pathname.includes('/data/')) {
    e.respondWith(
      fetch(e.request)
        .then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return res; })
        .catch(() => caches.match(e.request, { ignoreSearch: true })),
    );
  } else {
    e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((hit) => hit ?? fetch(e.request)));
  }
});
