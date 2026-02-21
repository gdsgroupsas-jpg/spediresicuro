/**
 * Service Worker per SpedireSicuro PWA
 * - Cache offline-first
 * - Background sync
 * - Push notifications
 */

const CACHE_NAME = 'spediresicuro-v1';
const RUNTIME_CACHE = 'spediresicuro-runtime';
const STATIC_ASSETS = ['/', '/index.html', '/manifest.json', '/offline.html'];

// Installa il service worker
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Caching static assets');
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Attiva il service worker e pulisci cache vecchi
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Network first, fallback to cache per API calls
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // API calls: network first
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clonedResponse = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => {
            cache.put(request, clonedResponse);
          });
          return response;
        })
        .catch(() => {
          return caches.match(request).then((response) => {
            return (
              response ||
              new Response(
                JSON.stringify({ offline: true, error: 'API non disponibile offline' }),
                { headers: { 'Content-Type': 'application/json' } }
              )
            );
          });
        })
    );
    return;
  }

  // Static assets: cache first
  if (
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.woff2') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.jpg')
  ) {
    event.respondWith(
      caches.match(request).then((response) => {
        return (
          response ||
          fetch(request).then((response) => {
            const clonedResponse = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, clonedResponse);
            });
            return response;
          })
        );
      })
    );
    return;
  }

  // HTML pages: network first, fallback to cache
  event.respondWith(
    fetch(request)
      .then((response) => {
        const clonedResponse = response.clone();
        caches.open(RUNTIME_CACHE).then((cache) => {
          cache.put(request, clonedResponse);
        });
        return response;
      })
      .catch(() => {
        return caches.match(request).then((response) => {
          return response || caches.match('/offline.html');
        });
      })
  );
});

// Push notifications
self.addEventListener('push', (event) => {
  console.log('Push notification received:', event);

  const options = {
    body: event.data?.text() || 'Notifica da SpedireSicuro',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    tag: 'spediresicuro-notification',
    requireInteraction: false,
    actions: [
      {
        action: 'open',
        title: 'Apri',
        icon: '/icons/open.png',
      },
      {
        action: 'close',
        title: 'Chiudi',
        icon: '/icons/close.png',
      },
    ],
  };

  const data = event.data?.json?.() || {};
  if (data.title) options.title = data.title;
  if (data.url) options.data = { url: data.url };

  event.waitUntil(self.registration.showNotification('SpedireSicuro', options));
});

// Click su notifica
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event);
  event.notification.close();

  const url = event.notification.data?.url || '/';

  if (event.action === 'close') {
    return;
  }

  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((windowClients) => {
      // Controlla se è già aperta una finestra
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url === url && 'focus' in client) {
          return client.focus();
        }
      }
      // Altrimenti apri una nuova finestra
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

// Background sync per salvataggio offline
self.addEventListener('sync', (event) => {
  console.log('Background sync event:', event.tag);

  if (event.tag === 'sync-tracking-data') {
    event.waitUntil(
      caches.open(RUNTIME_CACHE).then((cache) => {
        return cache.match('/api/tracking').then((response) => {
          if (response) {
            return fetch('/api/sync-tracking', {
              method: 'POST',
              body: response.clone(),
              headers: { 'Content-Type': 'application/json' },
            });
          }
        });
      })
    );
  }
});
