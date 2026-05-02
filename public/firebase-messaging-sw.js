/* ═══════════════════════════════════════════════════
   firebase-messaging-sw.js
   Service Worker — Recebe notificações Web Push
   ═══════════════════════════════════════════════════ */

importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

// ═══════════════════════════════════════════════════
// LISTENERS NO TOP-LEVEL (ANTES DE TUDO)
// ═══════════════════════════════════════════════════

self.addEventListener('install', () => {
  console.log('[SW] Instalando...');
  self.skipWaiting();
});

self.addEventListener('activate', () => {
  console.log('[SW] Ativando...');
  self.clients.claim();
});

// PUSH EVENT - CRÍTICO
self.addEventListener('push', (event) => {
  console.log('[SW] Push recebido');
  
  if (!event.data) {
    console.warn('[SW] Push sem payload');
    return;
  }

  try {
    const data = event.data.json();
    const title = data.notification?.title || 'Nova Notificação';
    const options = {
      body: data.notification?.body || '',
      icon: data.notification?.icon || '/favicon.ico',
      badge: '/favicon.ico',
      tag: data.notification?.tag || 'notificacao-assent',
      requireInteraction: false,
      data: data.data || {},
    };

    event.waitUntil(
      self.registration.showNotification(title, options)
        .then(() => console.log('[SW] Notificação exibida'))
        .catch(err => console.error('[SW] Erro ao exibir:', err))
    );
  } catch (err) {
    console.error('[SW] Erro ao parsear push:', err);
  }
});

// NOTIFICATION CLICK
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notificação clicada');
  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        for (let client of clientList) {
          if (client.url === urlToOpen && 'focus' in client) {
            return client.focus();
          }
        }
        return clients.openWindow?.(urlToOpen);
      })
      .catch(err => console.error('[SW] Erro ao abrir URL:', err))
  );
});

self.addEventListener('notificationclose', (event) => {
  console.log('[SW] Notificação fechada');
});

// ═══════════════════════════════════════════════════
// FIREBASE INIT (SEM INDEXEDDB, SEM POSTMESSAGE)
// ═══════════════════════════════════════════════════

const firebaseConfig = {
  apiKey: 'AIzaSyDW-yKxxxxxxxxxxxxxxxxxxx',
  authDomain: 'seu-projeto.firebaseapp.com',
  projectId: 'seu-projeto',
  storageBucket: 'seu-projeto.appspot.com',
  messagingSenderId: '123456789',
  appId: '1:123456789:web:xxxxxxxxxxxxxxxx'
};

let messaging = null;

(async () => {
  try {
    firebase.initializeApp(firebaseConfig);
    messaging = firebase.messaging();
    
    // HANDLER CRITICAL - Registrar ANTES de retornar
    messaging.onBackgroundMessage((payload) => {
      console.log('[SW] FCM background:', payload.notification?.title);
    });

    console.log('[SW] Firebase OK ✓');
  } catch (err) {
    console.warn('[SW] Firebase skip:', err.message);
  }
})();
