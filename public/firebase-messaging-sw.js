/* ═══════════════════════════════════════════════════
   firebase-messaging-sw.js
   Service Worker — Recebe e exibe notificações Web Push
   Coloque em: public/firebase-messaging-sw.js
   ═══════════════════════════════════════════════════ */

// Importa Firebase no contexto do SW
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

// Config Firebase — MESMO DO SEU firebase.js
const firebaseConfig = {
  apiKey: 'YOUR_API_KEY',
  authDomain: 'YOUR_AUTH_DOMAIN',
  projectId: 'YOUR_PROJECT_ID',
  storageBucket: 'YOUR_STORAGE_BUCKET',
  messagingSenderId: 'YOUR_MESSAGING_SENDER_ID',
  appId: 'YOUR_APP_ID',
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// ── Handler: Notificação recebida com app em background ──
messaging.onBackgroundMessage((payload) => {
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: payload.notification.icon || '/favicon.ico',
    badge: '/favicon.ico',
    tag: 'notificacao-assent', // agrupa notificações (max 1 por tag)
    requireInteraction: false, // fecha sozinha
    data: payload.data || {}, // dados customizados
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// ── Handler: Click na notificação ──
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  // Abre/foca a aba se existir
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (let client of clientList) {
        if (client.url === '/' && 'focus' in client) {
          return client.focus();
        }
      }
      // Se não achar aba aberta, abre nova
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});
