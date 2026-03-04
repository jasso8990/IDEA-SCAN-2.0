/* ═══════════════════════════════════════════════════════
   sw.js — Service Worker (PWA) IDEA SCAN 2.0
   ═══════════════════════════════════════════════════════ */
const CACHE_NAME = 'ideascan-v2';
const ASSETS = [
  './login.html',
  './src/css/base.css',
  './src/css/layout.css',
  './src/css/components.css',
  './src/css/utilities.css',
  './src/css/pages/login.css',
  './src/js/core/config.js',
  './src/js/core/auth.js',
  './src/js/core/nav.js',
];

self.addEventListener('install',  e => e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS))));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))));
self.addEventListener('fetch',    e => e.respondWith(caches.match(e.request).then(r => r || fetch(e.request))));
