/* ═══════════════════════════════════════════════════
   public/firebase-messaging-sw.js v5
   Event handlers registrados SINCRONAMENTE no topo
   ═══════════════════════════════════════════════════ */

importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

// ── Lifecycle ──────────────────────────────────────
self.addEventListener('install',  () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

// ── Push — registrado SINCRONAMENTE ───────────────
self.addEventListener('push', (event) => {
  const show = async () => {
    let title = 'Assent Gestão';
    let body  = '';
    let url   = self.location.origin + '/';

    try {
      const raw = event.data?.json();
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

// ── Clique na notificação — registrado SINCRONAMENTE ──
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

// ── Firebase Messaging SDK (onBackgroundMessage) ──
// Inicializado de forma assíncrona DEPOIS dos event listeners
// para não bloquear o registro síncrono acima
self.addEventListener('activate', (event) => {
  event.waitUntil(
    fetch('/api/firebase-config')
      .then(r => r.json())
      .then(config => {
        if (!config?.apiKey) return;
        if (!firebase.apps.length) firebase.initializeApp(config);
        firebase.messaging().onBackgroundMessage((payload) => {
          const title = payload?.notification?.title || payload?.data?.title || 'Assent Gestão';
          const body  = payload?.notification?.body  || payload?.data?.body  || '';
          const url   = payload?.data?.url || self.location.origin + '/';
          return self.registration.showNotification(title, {
            body,
            icon:     '/logo.png',
            badge:    '/icons/badge-72x72.png',
            tag:      'notif-assent',
            renotify: true,
            data:     { url },
          });
        });
      })
      .catch(() => {/* silencioso */})
  );
});
