// Service Worker - Rutas Relativas
const CACHE_NAME = 'ingresos-mp-v19-final';
const urlsToCache = [
  './',
  './index.html',
  './css/base.css',
  './css/layout.css',
  './css/components/cards.css',
  './css/components/trends.css',
  './css/components/loading.css',
  './css/components/pwa.css',
  './css/utils/animations.css',
  './js/config/constants.js',
  './js/utils/date_utils.js',
  './js/utils/formatters.js',
  './js/api/google_sheets.js',
  './js/core/metrics.js',
  './js/core/trends_logic.js',
  './js/ui/render.js',
  './js/ui/charts.js',
  './js/ui/events.js',
  './js/ui/capture.js',
  './js/ui/email.js',
  './js/ui/database.js',
  './js/pwa/sw_init.js',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

// Instalación
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Cache abierto');
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting())
  );
});

// Activación
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Eliminando cache antiguo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch - Network First con fallback a Cache
self.addEventListener('fetch', (event) => {
  // Solo cachear peticiones GET
  if (event.request.method !== 'GET') return;
  
  // Ignorar peticiones a APIs externas
  if (event.request.url.includes('googleapis.com') || 
      event.request.url.includes('google.com') ||
      event.request.url.includes('script.google.com')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Si la respuesta es válida, clonarla y guardarla en cache
        if (response && response.status === 200) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        // Si falla la red, intentar obtener del cache
        return caches.match(event.request).then((response) => {
          return response || caches.match('./index.html');
        });
      })
  );
});
