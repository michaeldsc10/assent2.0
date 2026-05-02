/* ═══════════════════════════════════════════════════
   firebase-messaging-sw.js
   Service Worker — Recebe notificações Web Push
   ═══════════════════════════════════════════════════ */

importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

let messaging = null;

// ═══════════════════════════════════════════════════
// REGISTRAR TODOS OS LISTENERS NO TOP-LEVEL
// ═══════════════════════════════════════════════════

// 1. Lifecycle
self.addEventListener('install', () => {
  console.log('[SW] Instalando...');
  self.skipWaiting();
});

self.addEventListener('activate', () => {
  console.log('[SW] Ativando...');
  self.clients.claim();
});

// 2. Push events
self.addEventListener('push', (event) => {
  console.log('[SW] Push recebido');
});

self.addEventListener('pushsubscriptionchange', (event) => {
  console.log('[SW] Subscription mudou');
});

// 3. Notificações
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notificação clicada');
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

self.addEventListener('notificationclose', (event) => {
  console.log('[SW] Notificação fechada');
});

// 4. Mensagens do main thread
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'INIT_FIREBASE') {
    const config = event.data.config;

    try {
      firebase.initializeApp(config);
      messaging = firebase.messaging();

      // Handler para mensagens em background
      messaging.onBackgroundMessage((payload) => {
        console.log('[SW] FCM recebido em background:', payload.notification?.title);
        
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
      event.ports[0].postMessage({ status: 'ready' });
    } catch (err) {
      console.error('[SW] Erro ao inicializar Firebase:', err);
      event.ports[0].postMessage({ status: 'error', error: err.message });
    }
  }
});
