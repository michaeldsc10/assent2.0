/* ═══════════════════════════════════════════════════
   public/firebase-messaging-sw.js - DEBUG
   ═══════════════════════════════════════════════════ */

self.addEventListener('install', (event) => {
  console.log('[SW] install');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[SW] activate');
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  console.log('[SW] push recebido', event.data?.text());

  const show = async () => {
    let title = 'Nova Notificação';
    let body = '';

    try {
      const data = event.data?.json();
      title = data?.notification?.title || data?.data?.title || title;
      body  = data?.notification?.body  || data?.data?.body  || body;
    } catch {
      body = event.data?.text() || '';
    }

    console.log('[SW] exibindo:', title, body);
    await self.registration.showNotification(title, {
      body,
      icon:  '/icons/icon-192x192.png',
      badge: '/icons/badge-72x72.png',
      tag: `notif-assent-${Date.now()}`,
    });
    console.log('[SW] notificação exibida');
  };

  event.waitUntil(show());
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
