// Cachea la app para que abra sin red. Los datos nunca se cachean: van a IndexedDB o al nodo.
const CACHE = 'vigia-v8';
const ARCHIVOS = ['/', '/equipos', '/manifest.webmanifest', '/icono.svg', '/revision.js', '/reglas.js', '/esquema.js', '/verificar', '/verificar.js', '/sucursal', '/tablero'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARCHIVOS))); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))); self.clients.claim(); });
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.pathname.startsWith('/api/')) return;   // el API nunca se cachea
  e.respondWith(fetch(e.request).then(r => { if (r.ok && !r.redirected && url.origin === self.location.origin) { const copia = r.clone(); e.waitUntil(caches.open(CACHE).then(c => c.put(e.request, copia))); } return r; })
    .catch(() => caches.match(e.request).then(r => r ?? caches.match('/equipos'))));
});
