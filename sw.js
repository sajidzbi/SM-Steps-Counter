// SM Steps Counter Pro — Service Worker v4
// Handles: caching, offline, background step-data persistence

const CACHE = 'sm-steps-v4';
const CORE  = ['./', './index.html', './manifest.json',
               './icons/icon-192.png', './icons/icon-512.png'];

/* ── Install: pre-cache core assets ── */
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c =>
      Promise.allSettled(CORE.map(u => c.add(u).catch(()=>{})))
    ).then(() => self.skipWaiting())
  );
});

/* ── Activate: remove old caches ── */
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* ── Fetch: cache-first for static, network-first for rest ── */
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  if (e.request.url.startsWith('chrome-extension://')) return;

  const url = new URL(e.request.url);
  const isStatic = /\.(html|js|css|png|jpg|json|woff2?)$/.test(url.pathname)
    || url.hostname.includes('googleapis.com')
    || url.hostname.includes('gstatic.com')
    || url.hostname.includes('cdnjs.cloudflare.com');

  e.respondWith(isStatic ? cacheFirst(e.request) : netFirst(e.request));
});

async function cacheFirst(req) {
  const cached = await caches.match(req);
  if (cached) return cached;
  try {
    const res = await fetch(req);
    if (res.ok) (await caches.open(CACHE)).put(req, res.clone());
    return res;
  } catch { return offline(); }
}

async function netFirst(req) {
  try {
    const res = await fetch(req);
    if (res.ok) (await caches.open(CACHE)).put(req, res.clone());
    return res;
  } catch {
    return await caches.match(req) || offline();
  }
}

function offline() {
  return new Response(
    `<!DOCTYPE html><html><head>
    <meta charset=UTF-8>
    <meta name=viewport content="width=device-width,initial-scale=1">
    <title>SM Steps — Offline</title>
    <style>
      body{font-family:sans-serif;display:flex;flex-direction:column;align-items:center;
           justify-content:center;height:100vh;background:#f1f3f4;text-align:center;padding:20px;}
      h1{font-size:20px;font-weight:700;margin:12px 0 8px;}
      p{font-size:14px;color:#5f6368;line-height:1.6;}
      button{margin-top:20px;padding:11px 24px;background:#1a73e8;color:#fff;
             border:none;border-radius:24px;font-size:14px;font-weight:700;cursor:pointer;}
    </style></head>
    <body>
      <div style="font-size:56px;">📵</div>
      <h1>You're Offline</h1>
      <p>SM Steps is cached on your device.<br>
         Your step data is safe in local storage.<br>
         Sensor continues counting if it was active.</p>
      <button onclick="location.reload()">Try Again</button>
    </body></html>`,
    { headers: { 'Content-Type': 'text/html' } }
  );
}

/* ── Push notifications (future-ready) ── */
self.addEventListener('push', e => {
  const d = e.data ? e.data.json() : {};
  e.waitUntil(self.registration.showNotification(d.title||'SM Steps', {
    body:    d.body || "Don't forget your daily step goal! 🏃",
    icon:    './icons/icon-192.png',
    badge:   './icons/icon-72.png',
    tag:     'step-reminder',
    vibrate: [200,100,200]
  }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.openWindow('./index.html'));
});
