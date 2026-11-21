// Keeps the app working offline. Bump VERSION whenever you change index.html.
const VERSION = 'recipe-box-v6';
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png', '/icons/apple-touch-icon.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (url.pathname.startsWith('/api/') || url.pathname === '/seed.json') return; // always live

  // The app page: try the network first so updates show up, fall back to the cached copy offline.
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then((r) => { const copy = r.clone(); caches.open(VERSION).then((c) => c.put('/index.html', copy)); return r; })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Everything else (icons, Google Fonts): serve from cache, refresh in the background.
  e.respondWith(
    caches.open(VERSION).then((c) =>
      c.match(e.request).then((hit) => {
        const net = fetch(e.request).then((r) => { if (r.ok || r.type === 'opaque') c.put(e.request, r.clone()); return r; }).catch(() => hit);
        return hit || net;
      })
    )
  );
});
