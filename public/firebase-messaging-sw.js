/* ═══════════════════════════════════════════════════
   firebase-messaging-sw.js
   Service Worker — Recebe notificações Web Push
   ═══════════════════════════════════════════════════ */

importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

let messaging = null;

// ── Registra listeners ANTES de inicializar ──
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      for (let client of clientList) {
        if (client.url === '/' && 'focus' in client) {
          return client.focus();
        }
      }
      return clients.openWindow('/');
    })
  );
});

self.addEventListener('push', (event) => {
  // Handler padrão para push events (se não vier via FCM)
  console.log('[SW] Push event:', event);
});

self.addEventListener('pushsubscriptionchange', (event) => {
  // Handler para quando subscription expira
  console.log('[SW] Subscription changed:', event);
});

// ── Lifecycle ──
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', () => {
  self.clients.claim();
});

// ── Recebe config do main thread via postMessage ──
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'INIT_FIREBASE') {
    const config = event.data.config;

    try {
      firebase.initializeApp(config);
      messaging = firebase.messaging();

      // ── Handler FCM: Notificação em background ──
      messaging.onBackgroundMessage((payload) => {
        const title = payload.notification?.title || 'Nova Notificação';
        const options = {
          body: payload.notification?.body || '',
          icon: payload.notification?.icon || '/favicon.ico',
          badge: '/favicon.ico',
          tag: 'notificacao-assent',
          requireInteraction: false,
          data: payload.data || {},
        };

        self.registration.showNotification(title, options);
      });

      console.log('[SW] Firebase inicializado com sucesso');
    } catch (err) {
      console.error('[SW] Erro ao inicializar Firebase:', err);
    }
  }
});
