/* ═══════════════════════════════════════════════════
   public/firebase-messaging-sw.js
   Service Worker — Web Push sem SDK compat
   ═══════════════════════════════════════════════════ */

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// PUSH — recebe payload FCM direto
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data = {};
  try {
    data = event.data.json();
  } catch {
    return;
  }

  // FCM envia em data.notification ou data.data
  const notif = data.notification || {};
  const extra = data.data || {};

  const title = notif.title || extra.title || 'Nova Notificação';
  const options = {
    body: notif.body || extra.body || '',
    icon: notif.icon || '/favicon.ico',
    badge: '/favicon.ico',
    tag: notif.tag || extra.tag || 'notif-assent',
    requireInteraction: false,
    data: {
      url: extra.url || notif.click_action || '/',
      ...extra,
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((list) => {
        for (const client of list) {
          if (client.url === url && 'focus' in client) return client.focus();
        }
        return self.clients.openWindow(url);
      })
  );
});

self.addEventListener('notificationclose', () => {});
