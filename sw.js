const CACHE_NAME = 'litestream-v4';
const STATIC_ASSETS = [
  './',
  './index.html',
  './css/styles.css',
  './js/app.js',
  './manifest.json'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);

  if (url.pathname.endsWith('.m3u8') || url.pathname.endsWith('.ts') ||
      url.pathname.endsWith('.mp4') || url.pathname.endsWith('.m4s') ||
      url.pathname.endsWith('.vtt')) return;

  const isAppShell = e.request.mode === 'navigate' ||
      (url.origin === location.origin && (url.pathname.endsWith('.css') || url.pathname.endsWith('.js') || url.pathname.endsWith('.html')));
  const isData = url.pathname.includes('/data/') || url.pathname.endsWith('.json');

  if (isAppShell || isData) {
    const cacheKey = url.origin === location.origin ? (url.origin + url.pathname) : e.request;
    e.respondWith(
      fetch(e.request).then(r => {
        if (r && r.ok && url.origin === location.origin) {
          const clone = r.clone();
          caches.open(CACHE_NAME).then(c => c.put(cacheKey, clone));
        }
        return r;
      }).catch(() => caches.match(cacheKey, { ignoreSearch: true }))
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request).then(resp => {
      if (resp && resp.ok && url.origin === location.origin) {
        const clone = resp.clone();
        caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
      }
      return resp;
    }).catch(() => r))
  );
});
