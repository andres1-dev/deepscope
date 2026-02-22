// Service Worker para App - Versión optimizada para PWA
// Leer configuración de la app
importScripts('js/core/config.js');

// CORREGIDO: Eliminadas notificaciones duplicadas
const CACHE_NAME = `${CONFIG.APP_NAME}-v11.1`; // Network-First Strategy 100% Online

const BASE = (new URL('.', self.location)).href;

const RELATIVE_ASSETS = [
  './',
  'index.html',
  'manifest.json',
  /* CSS Core */
  'css/core/base.css',
  'css/core/layout.css',
  'css/core/content.css',
  /* CSS Modules */
  'css/modules/scanner.css',
  'css/modules/admin.css',
  'css/modules/upload.css',
  'css/modules/soportes.css',
  'css/modules/soportes_grid.css',
  'css/modules/historial.css',
  /* JS Core */
  'js/core/config.js',
  'js/core/database.js',
  'js/core/audio.js',
  'js/core/auth_check.js',
  'js/core/auth.js',
  'js/core/main_logic.js',
  'js/core/app_init.js',
  /* JS UI */
  'js/ui/interfaz.js',
  'js/ui/renderizado.js',
  /* JS Modules */
  'js/modules/scanner_camera.js',
  'js/modules/scanner_qr_lib.js',
  'js/modules/scanner_logic.js',
  'js/modules/history.js',
  'js/modules/upload_siesa.js',
  'js/modules/upload_queue.js',
  'js/modules/soportes_grid.js',
  'js/modules/soportes_grid_init.js',
  'js/modules/notifications.js',
  'js/modules/admin.js',
  /* Icons */
  'icons/icon-192.png',
  'icons/icon-256.png',
  'icons/icon-384.png',
  'icons/icon-512.png',
  'icons/icon-1024.png',
  'icons/favicon.ico'
];

const EXTERNAL_ASSETS = [
  'https://cdn.jsdelivr.net/npm/html5-qrcode@latest/dist/html5-qrcode.min.js',
  'https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap',
  'https://fonts.googleapis.com/css2?family=Inter:wght@500;700&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

const ASSETS_TO_CACHE = [
  ...RELATIVE_ASSETS.map(p => new URL(p, BASE).href)
];

let API_URL_POLLING = null;
let USER_ID_POLLING = null;

// ============================================
// VARIABLES ANTI-DUPLICADOS
// ============================================
let lastProcessedNotificationId = null;
let processingNotification = false;
const PROCESSING_LOCK_TIMEOUT = 5000; // 5 segundos de timeout para el lock

const DB_NAME = 'DeepSeekNotifications';
const DB_VERSION = 1;

// Inicializar IndexedDB
async function getDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('config')) {
        db.createObjectStore('config');
      }
    };
    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject(e.target.error);
  });
}

async function setPersistentValue(key, value) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('config', 'readwrite');
    tx.objectStore('config').put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getPersistentValue(key) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('config', 'readonly');
    const req = tx.objectStore('config').get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ============================================
// FUNCIÓN PARA CREAR ID ÚNICO DE NOTIFICACIÓN
// ============================================
function createNotificationId(notif) {
  if (!notif) return null;
  // Usar timestamp, título y cuerpo para crear un ID único
  // Si el servidor enviara un ID real, sería mejor
  const ts = notif.timestamp || Date.now();
  const title = notif.title || '';
  const body = notif.body || '';
  return `${ts}-${title}-${body}`.replace(/\s+/g, '_');
}

// ============================================
// INSTALACIÓN
// ============================================
self.addEventListener('install', (event) => {
  console.log('[SW] 🔧 Instalando Service Worker...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Cacheando assets locales...');
        return cache.addAll(ASSETS_TO_CACHE)
          .then(() => {
            console.log('[SW] Assets locales cacheados');
            return Promise.allSettled(
              EXTERNAL_ASSETS.map(url =>
                cache.add(url)
                  .then(() => console.log(`[SW] Cacheado: ${url}`))
                  .catch(err => {
                    console.warn(`[SW] No se pudo cachear ${url}:`, err.message);
                    return null;
                  })
              )
            );
          });
      })
      .then(() => {
        console.log('[SW] Instalación completada');
        return self.skipWaiting();
      })
      .catch(err => {
        console.error('[SW] Error durante instalación:', err);
      })
  );
});

// ============================================
// ACTIVACIÓN
// ============================================
self.addEventListener('activate', (event) => {
  console.log('[SW] Activando Service Worker...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            console.log('[SW] Eliminando cache antiguo:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => {
      console.log('[SW] Service Worker activado');
      return self.clients.claim();
    })
  );
});

// ============================================
// FETCH STRATEGY
// ============================================
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  if (!req.url.startsWith('http') || req.method !== 'GET') return;

  if (url.hostname.includes('sheets.googleapis.com') || url.hostname.includes('script.google.com')) return;

  const isIcon = url.pathname.includes('/icons/') || url.pathname.includes('favicon.ico');
  const isExternal = EXTERNAL_ASSETS.some(cdn => req.url.startsWith(cdn));

  if (isIcon || isExternal) {
    // Network First behavior with Cache fallback
    event.respondWith(
      fetch(req).then(response => {
        if (response && response.status === 200) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
        }
        return response;
      }).catch(() => {
        return caches.match(req);
      })
    );
  } else {
    // Para el resto de los archivos, Network First estricto
    event.respondWith(
      fetch(req).then(response => {
        if (response && response.status === 200) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
        }
        return response;
      }).catch(() => {
        return caches.match(req);
      })
    );
  }
});

// ============================================
// MENSAJES DEL CLIENTE
// ============================================
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'CHECK_VERSION') {
    event.ports[0].postMessage({ version: CACHE_NAME });
  }

  if (event.data && event.data.type === 'SET_POLLING_CONFIG') {
    const url = event.data.url;
    const userId = event.data.userId;
    const ts = event.data.lastTs || 0;

    setPersistentValue('pollingUrl', url);
    setPersistentValue('pollingUserId', userId);

    const currentTs = getPersistentValue('lastNotifTs') || 0;
    if (ts > currentTs) {
      setPersistentValue('lastNotifTs', ts);
    }

    API_URL_POLLING = url;
    USER_ID_POLLING = userId;
    console.log('[SW] URL de Polling y User ID configurados');
    startBackgroundPolling();
  }

  if (event.data && event.data.type === 'CHECK_NOW') {
    checkNotifications();
  }

  // Resetear el ID de última notificación (útil para pruebas)
  if (event.data && event.data.type === 'RESET_NOTIFICATION_ID') {
    lastProcessedNotificationId = null;
    console.log('[SW] ID de última notificación reseteado');
  }
});

let pollingActive = false;

// ============================================
// POLLING CORREGIDO - SIN DUPLICADOS
// ============================================
async function startBackgroundPolling() {
  if (pollingActive) return;
  pollingActive = true;

  if (!API_URL_POLLING) {
    API_URL_POLLING = await getPersistentValue('pollingUrl');
  }
  if (!USER_ID_POLLING) {
    USER_ID_POLLING = await getPersistentValue('pollingUserId');
  }

  console.log('[SW] Iniciando ciclo de polling en segundo plano (cada 2 minutos)...');

  // Aumentado a 2 minutos para reducir verificaciones
  setInterval(async () => {
    await checkNotifications();
  }, 120000); // 2 minutos

  // Verificación inicial
  await checkNotifications();
}

async function checkNotifications() {
  // Evitar ejecuciones concurrentes
  if (processingNotification) {
    console.log('[SW Polling] Ya hay una verificación en curso, omitiendo...');
    return;
  }

  // Timeout de seguridad para el lock
  const lockTimeout = setTimeout(() => {
    processingNotification = false;
    console.log('[SW Polling] Timeout de lock liberado');
  }, PROCESSING_LOCK_TIMEOUT);

  const url = API_URL_POLLING || await getPersistentValue('pollingUrl');
  if (!url) {
    console.log('[SW Polling] Sin URL configurada, abortando check.');
    clearTimeout(lockTimeout);
    return;
  }

  processingNotification = true;

  try {
    const lastTs = (await getPersistentValue('lastNotifTs')) || 0;
    const fetchUrl = `${url}?action=get-latest-notification&_cb=${Date.now()}`;

    console.log('[SW Polling] Consultando servidor...');
    const res = await fetch(fetchUrl);
    const data = await res.json();

    if (data.success && data.notification) {
      const notif = data.notification;
      const ts = parseInt(notif.timestamp) || 0;

      // Crear un ID único para esta notificación
      const notificationId = createNotificationId(notif);

      // Solo mostrar si:
      // 1. El timestamp es más reciente Y
      // 2. No es la misma notificación que ya procesamos
      if (ts > lastTs && notificationId !== lastProcessedNotificationId) {
        console.log('[SW Polling] ¡Nueva notificación detectada!');

        // Guardar el ID de esta notificación
        lastProcessedNotificationId = notificationId;

        // Actualizar el timestamp solo después de procesar
        await setPersistentValue('lastNotifTs', ts);

        await self.registration.showNotification(notif.title || CONFIG.APP_NAME, {
          body: notif.body || 'Nuevo aviso del sistema',
          icon: './icons/icon-192.png',
          badge: './icons/icon-192.png',
          tag: 'app-notif',
          vibrate: [200, 100, 200],
          data: { url: './', timestamp: ts }
        });

        console.log('[SW Polling] Notificación mostrada correctamente');
      } else {
        console.log('[SW Polling] Sin cambios o notificación ya mostrada', {
          tsMayor: ts > lastTs,
          idDistinto: notificationId !== lastProcessedNotificationId,
          lastTs,
          currentTs: ts,
          lastId: lastProcessedNotificationId,
          currentId: notificationId
        });
      }
    }
  } catch (e) {
    console.warn('[SW Polling] Error de conexión:', e.message);
  } finally {
    clearTimeout(lockTimeout);
    processingNotification = false;
  }
}

// ============================================
// PUSH REAL CORREGIDO - SIN DUPLICADOS
// ============================================
const R1_GAS_URL = 'https://script.google.com/macros/s/AKfycbwreGMo-ZITm8PUkGJfMVu1cwKMsnUhfD1BZO18qFBa9CFcWd50VzBDKwDMKCubYhg5Cg/exec';

self.addEventListener('push', (event) => {
  console.log('[SW] Push real recibido');

  // Si ya estamos procesando, ignorar este push
  if (processingNotification) {
    console.log('[SW Push] Ya procesando una notificación, ignorando push...');
    event.waitUntil(Promise.resolve());
    return;
  }

  // Timeout de seguridad
  const lockTimeout = setTimeout(() => {
    processingNotification = false;
    console.log('[SW Push] Timeout de lock liberado');
  }, PROCESSING_LOCK_TIMEOUT);

  const getPayload = new Promise((resolve, reject) => {
    // Intentar leer payload directo (Android/Chrome)
    if (event.data) {
      try {
        const json = event.data.json();
        if (json && json.title) {
          console.log('[SW] Datos recibidos en payload directo');
          resolve(json);
          return;
        }
      } catch (e) {
        console.log('[SW] Payload no es JSON válido');
      }
    }

    // Sin payload (iOS tickle) → fetch desde r1
    console.log('[SW] Sin payload, obteniendo de r1...');
    const cacheBuster = '&t=' + Date.now();
    fetch(R1_GAS_URL + '?action=get-latest-notification' + cacheBuster)
      .then(res => res.json())
      .then(data => {
        if (data.success && data.notification) {
          resolve(data.notification);
        } else {
          reject('No hay notificaciones recientes');
        }
      })
      .catch(err => reject(err));
  });

  event.waitUntil(
    getPayload
      .then(async payload => {
        const ts = payload.timestamp || Date.now();
        const notificationId = createNotificationId(payload);

        // Verificar si esta notificación ya fue procesada por polling
        const lastTs = await getPersistentValue('lastNotifTs') || 0;

        // Evitar duplicados si:
        // 1. Ya tiene el mismo ID que la última procesada
        // 2. El timestamp no es más reciente que el último guardado
        if (notificationId === lastProcessedNotificationId || ts <= lastTs) {
          console.log('[SW Push] Notificación ya procesada anteriormente, ignorando', {
            motivo: notificationId === lastProcessedNotificationId ? 'mismo ID' : 'timestamp antiguo',
            lastTs,
            currentTs: ts
          });
          return;
        }

        // Marcar como procesada
        lastProcessedNotificationId = notificationId;
        await setPersistentValue('lastNotifTs', ts);
        processingNotification = true;

        const title = payload.title || CONFIG.APP_NAME;
        const options = {
          body: payload.body || 'Tienes un mensaje nuevo',
          icon: './icons/icon-192.png',
          badge: './icons/icon-192.png',
          vibrate: [200, 100, 200],
          tag: 'push-notif',
          data: {
            url: payload.url || './',
            timestamp: ts,
            id: notificationId
          }
        };

        console.log('[SW Push] Mostrando notificación:', title);
        return self.registration.showNotification(title, options);
      })
      .catch(err => {
        console.error('[SW] Error procesando push:', err);
        // Solo mostrar notificación genérica si es un error real
        if (err !== 'No hay notificaciones recientes') {
          return self.registration.showNotification(CONFIG.APP_NAME, {
            body: 'Abre la app para ver el mensaje',
            icon: './icons/icon-192.png',
            data: { url: './' }
          });
        }
      })
      .finally(() => {
        clearTimeout(lockTimeout);
        processingNotification = false;
      })
  );
});

// ============================================
// CLICK EN NOTIFICACIÓN
// ============================================
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = (event.notification.data && event.notification.data.url) ? event.notification.data.url : './';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        for (let client of windowClients) {
          if (client.url === urlToOpen && 'focus' in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

// ============================================
// PERIODIC SYNC
// ============================================
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'check-notif') {
    event.waitUntil(checkNotifications());
  }
});

// ============================================
// LIMPIEZA PERIÓDICA DEL ID (OPCIONAL)
// ============================================
// Cada hora, limpiar el ID para permitir notificaciones repetidas si es necesario
setInterval(() => {
  if (!processingNotification) {
    console.log('[SW] Limpiando ID de última notificación (timeout 5m)');
    lastProcessedNotificationId = null;
  }
}, 300000); // 5 minutos

console.log('[SW] Service Worker cargado - Versión:', CACHE_NAME);

// INICIO AUTOMÁTICO
startBackgroundPolling();
