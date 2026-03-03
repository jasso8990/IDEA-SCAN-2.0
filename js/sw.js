/* ═══════════════════════════════════════════════════════
   sw.js — Service Worker (PWA)
   Estrategia: Cache-first para assets, Network-first para API
   ═══════════════════════════════════════════════════════ */

const APP_VERSION  = 'wms-v2.0.0';
const STATIC_CACHE = `${APP_VERSION}-static`;
const DATA_CACHE   = `${APP_VERSION}-data`;

// ── Assets a cachear en install ───────────────────────────
const STATIC_ASSETS = [
  '/login.html',
  '/inventario.html',
  '/salidas.html',
  '/ai-entry.html',
  '/martech-entry.html',
  '/config.html',
  '/mapa.html',
  '/reportes.html',
  '/ordenes.html',
  '/paqueteria.html',
  '/src/css/base.css',
  '/src/css/layout.css',
  '/src/css/components.css',
  '/src/css/utilities.css',
  '/src/css/pages/login.css',
  '/src/css/pages/inventario.css',
  '/src/css/pages/salidas.css',
  '/src/css/pages/ai-entry.css',
  '/src/css/pages/config.css',
  '/src/css/pages/mapa.css',
  '/src/css/pages/reportes.css',
  '/src/css/pages/ordenes.css',
  '/src/css/pages/paqueteria.css',
  '/src/js/core/config.js',
  '/src/js/core/auth.js',
  '/src/js/core/db.js',
  '/src/js/core/utils.js',
  '/src/js/core/nav.js',
  '/src/js/modules/camera.js',
  '/src/js/modules/vision.js',
  '/src/js/modules/sku.js',
  '/src/js/modules/export.js',
  '/src/js/pages/login.js',
  '/src/js/pages/inventario.js',
  '/src/js/pages/salidas.js',
  '/src/js/pages/ai-entry.js',
  '/src/js/pages/martech.js',
  '/src/js/pages/config-admin.js',
  '/src/js/pages/mapa.js',
  '/src/js/pages/reportes.js',
  '/src/js/pages/ordenes.js',
  '/src/js/pages/paqueteria.js',
  '/manifest.json',
  '/icon192.png',
];

// ── Install: cachear todos los assets ─────────────────────
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log('[SW] Cacheando assets estáticos...');
      return cache.addAll(STATIC_ASSETS.map(url => new Request(url, { cache: 'reload' })))
        .catch(err => console.warn('[SW] Algunos assets fallaron al cachear:', err));
    })
  );
});

// ── Activate: limpiar caches viejos ───────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter(key => key !== STATIC_CACHE && key !== DATA_CACHE)
          .map(key => {
            console.log('[SW] Eliminando cache viejo:', key);
            return caches.delete(key);
          })
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: estrategia por tipo de recurso ─────────────────
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // ── 1. Supabase API → siempre Network, sin cache ──────
  if (url.hostname.includes('supabase.co')) {
    event.respondWith(
      fetch(event.request).catch(() =>
        new Response(JSON.stringify({ error: 'Sin conexión — datos no disponibles offline' }),
          { status: 503, headers: { 'Content-Type': 'application/json' } })
      )
    );
    return;
  }

  // ── 2. CDN (SheetJS, Supabase SDK, etc.) → Cache-first ─
  if (url.hostname !== self.location.hostname) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(STATIC_CACHE).then(cache => cache.put(event.request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // ── 3. Assets locales → Cache-first, Network fallback ──
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response.ok && event.request.method === 'GET') {
          const clone = response.clone();
          caches.open(STATIC_CACHE).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // Fallback para navegación: devolver login.html
        if (event.request.mode === 'navigate') {
          return caches.match('/login.html');
        }
      });
    })
  );
});

// ── Mensajes desde la app ─────────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
  if (event.data?.type === 'CLEAR_CACHE') {
    caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))))
      .then(() => console.log('[SW] Cache limpiado'));
  }
});
