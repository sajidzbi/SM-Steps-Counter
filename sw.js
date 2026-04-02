// SM Steps Counter Pro - Service Worker v3.1
// Cache-first strategy with network fallback

const CACHE_NAME = 'sm-steps-v3.1';
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  'https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800;900&family=Rubik:wght@400;500;600;700&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js'
];

// ─── INSTALL ───────────────────────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // Cache core assets; ignore failures for external CDN fonts
      return Promise.allSettled(
        STATIC_ASSETS.map(url =>
          cache.add(url).catch(err => console.warn('SW: Could not cache', url, err))
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// ─── ACTIVATE ──────────────────────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => {
            console.log('SW: Deleting old cache', key);
            return caches.delete(key);
          })
      )
    ).then(() => self.clients.claim())
  );
});

// ─── FETCH ─────────────────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  // Skip non-GET and chrome-extension requests
  if (event.request.method !== 'GET') return;
  if (event.request.url.startsWith('chrome-extension://')) return;

  const url = new URL(event.request.url);

  // Strategy: Cache-first for static assets, Network-first for everything else
  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(event.request));
  } else {
    event.respondWith(networkFirst(event.request));
  }
});

function isStaticAsset(url) {
  return (
    url.pathname.endsWith('.html') ||
    url.pathname.endsWith('.js')   ||
    url.pathname.endsWith('.css')  ||
    url.pathname.endsWith('.png')  ||
    url.pathname.endsWith('.jpg')  ||
    url.pathname.endsWith('.json') ||
    url.hostname === 'fonts.googleapis.com' ||
    url.hostname === 'fonts.gstatic.com'    ||
    url.hostname === 'cdnjs.cloudflare.com'
  );
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return offlineFallback();
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || offlineFallback();
  }
}

function offlineFallback() {
  return new Response(
    `<!DOCTYPE html><html><head><meta charset="UTF-8"/>
    <meta name="viewport" content="width=device-width,initial-scale=1"/>
    <title>SM Steps — Offline</title>
    <style>
      body{font-family:sans-serif;display:flex;flex-direction:column;align-items:center;
           justify-content:center;height:100vh;background:#f1f3f4;color:#202124;text-align:center;padding:20px;}
      .icon{font-size:64px;margin-bottom:16px;}
      h1{font-size:22px;font-weight:700;margin-bottom:8px;}
      p{font-size:14px;color:#5f6368;}
      button{margin-top:20px;padding:12px 28px;background:#1a73e8;color:#fff;
             border:none;border-radius:24px;font-size:15px;font-weight:700;cursor:pointer;}
    </style></head>
    <body>
      <div class="icon">📵</div>
      <h1>You're Offline</h1>
      <p>SM Steps Counter is cached and will resume when you're back online.<br/>
         Your step data is safely stored on your device.</p>
      <button onclick="location.reload()">Try Again</button>
    </body></html>`,
    { headers: { 'Content-Type': 'text/html' } }
  );
}

// ─── BACKGROUND SYNC (future-ready) ────────────────────────────────────────
self.addEventListener('sync', event => {
  if (event.tag === 'sync-steps') {
    event.waitUntil(syncStepData());
  }
});

async function syncStepData() {
  // Placeholder for future cloud sync
  console.log('SW: Background sync triggered');
}

// ─── PUSH NOTIFICATIONS ────────────────────────────────────────────────────
self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title || 'SM Steps Counter', {
      body: data.body || "Don't forget your daily step goal! 🏃",
      icon: './icons/icon-192.png',
      badge: './icons/icon-72.png',
      tag: 'step-reminder',
      renotify: true,
      vibrate: [200, 100, 200]
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(clients.openWindow('./index.html'));
});
