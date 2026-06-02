/* ═══════════════════════════════════════════════════
   public/firebase-messaging-sw.js v6
   Push handler puro — sem Firebase SDK no SW
   (o SDK causava warnings de registro assíncrono)
   ═══════════════════════════════════════════════════ */

self.addEventListener('install',  () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  const show = async () => {
    let title = 'Assent Gestão';
    let body  = '';
    let url   = self.location.origin + '/';

    try {
      const raw = event.data?.json();
      // Suporta payload notification{} (FCM padrão) e data{}
      title = raw?.notification?.title || raw?.data?.title || title;
      body  = raw?.notification?.body  || raw?.data?.body  || body;
      url   = raw?.data?.url || raw?.fcmOptions?.link || url;
    } catch {
      body = event.data?.text() || '';
    }

    await self.registration.showNotification(title, {
      body,
      icon:     '/logo.png',
      badge:    '/icons/badge-72x72.png',
      tag:      'notif-assent',
      renotify: true,
      data:     { url },
    });
  };
  event.waitUntil(show());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || self.location.origin + '/';
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((list) => {
        for (const c of list) {
          if (c.url.includes(self.location.origin) && 'focus' in c) return c.focus();
        }
        return self.clients.openWindow(url);
      })
  );
});

self.addEventListener('notificationclose', () => {});
