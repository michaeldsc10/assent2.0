/* ═══════════════════════════════════════════════════
   firebase-messaging-sw.js
   Service Worker — Recebe notificações Web Push
   ═══════════════════════════════════════════════════ */

importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

let messaging = null;

// ═══════════════════════════════════════════════════
// CONFIG FIREBASE (EMBED INLINE)
// ═══════════════════════════════════════════════════

const firebaseConfig = {
  apiKey: 'AIzaSyDW-yKxxxxxxxxxxxxxxxxxxx',
  authDomain: 'seu-projeto.firebaseapp.com',
  projectId: 'seu-projeto',
  storageBucket: 'seu-projeto.appspot.com',
  messagingSenderId: '123456789',
  appId: '1:123456789:web:xxxxxxxxxxxxxxxx'
};

// ═══════════════════════════════════════════════════
// LISTENERS NO TOP-LEVEL (SÍNCRONO)
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

// 2. PUSH EVENT - CRÍTICO
self.addEventListener('push', (event) => {
  console.log('[SW] Push recebido:', event.data?.text());
  
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
        .then(() => console.log('[SW] Notificação exibida:', title))
        .catch(err => console.error('[SW] Erro ao exibir:', err))
    );
  } catch (err) {
    console.error('[SW] Erro ao parsear push:', err);
  }
});

// 3. PUSH SUBSCRIPTION CHANGE
self.addEventListener('pushsubscriptionchange', (event) => {
  console.log('[SW] Subscription mudou');
  
  if (!messaging) {
    console.warn('[SW] Messaging não inicializado ainda');
    return;
  }

  event.waitUntil(
    messaging.getToken()
      .then(newToken => {
        console.log('[SW] Novo token obtido:', newToken?.substring(0, 20) + '...');
        if (newToken) {
          // Notificar clients do novo token
          self.clients.matchAll().then(clients => {
            clients.forEach(client => {
              if (client.postMessage) {
                client.postMessage({
                  type: 'PUSH_TOKEN_RENEWED',
                  token: newToken,
                });
              }
            });
          });
        }
      })
      .catch(err => console.error('[SW] Erro ao renovar token:', err))
  );
});

// 4. NOTIFICATION CLICK
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notificação clicada:', event.notification.title);
  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        // Procura aba já aberta
        for (let client of clientList) {
          if (client.url === urlToOpen && 'focus' in client) {
            return client.focus();
          }
        }
        // Abre nova aba
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
      .catch(err => console.error('[SW] Erro ao abrir URL:', err))
  );
});

// 5. NOTIFICATION CLOSE
self.addEventListener('notificationclose', (event) => {
  console.log('[SW] Notificação fechada:', event.notification.title);
});

// 6. MESSAGE (fallback se houver comunicação do main thread)
self.addEventListener('message', (event) => {
  if (event.data?.type === 'INIT_FIREBASE') {
    console.log('[SW] Recebeu INIT_FIREBASE');
    // Já inicializado? Skip. Se não, pode inicializar aqui também.
  }
});

// ═══════════════════════════════════════════════════
// INICIALIZAR FIREBASE (ASYNC, MAS SÍNCRONO NO ESCOPO)
// ═══════════════════════════════════════════════════

(async () => {
  try {
    firebase.initializeApp(firebaseConfig);
    messaging = firebase.messaging();

    // Handler para mensagens em background
    messaging.onBackgroundMessage((payload) => {
      console.log('[SW] FCM em background:', payload.notification?.title);
      
      const title = payload.notification?.title || 'Nova Notificação';
      const options = {
        body: payload.notification?.body || '',
        icon: payload.notification?.icon || '/favicon.ico',
        badge: '/favicon.ico',
        tag: payload.notification?.tag || 'notificacao-assent',
        requireInteraction: false,
        data: payload.data || {},
      };

      return self.registration.showNotification(title, options);
    });

    console.log('[SW] Firebase inicializado ✓');
  } catch (err) {
    console.error('[SW] Erro ao inicializar Firebase:', err);
  }
})();
