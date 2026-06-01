/* ═══════════════════════════════════════════════════
   public/firebase-messaging-sw.js v4
   ═══════════════════════════════════════════════════ */

importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

// Busca config do servidor para não expor credenciais no SW
async function getConfig() {
  try {
    const res = await fetch('/api/firebase-config');
    return await res.json();
  } catch { return null; }
}

async function initMessaging() {
  const config = await getConfig();
  if (!config?.apiKey) return null;
  if (!firebase.apps.length) firebase.initializeApp(config);
  return firebase.messaging();
}

// Notificação em background via Firebase Messaging SDK
// — substitui o comportamento padrão do Chrome (sino azul)
self.addEventListener('push', (event) => {
  const show = async () => {
    let title = 'Assent Gestão';
    let body  = '';
    let url   = '/';

    try {
      const raw = event.data?.json();
      // payload pode vir em notification{} ou data{}
      title = raw?.notification?.title || raw?.data?.title || title;
      body  = raw?.notification?.body  || raw?.data?.body  || body;
      url   = raw?.data?.url           || raw?.fcmOptions?.link || url;
    } catch {
      body = event.data?.text() || '';
    }

    await self.registration.showNotification(title, {
      body,
      icon:  '/logo.png',
      badge: '/icons/badge-72x72.png',
      tag:   'notif-assent',
      renotify: true,
      data:  { url },
    });
  };
  event.waitUntil(show());
});

// Ao clicar na notificação, abre o app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
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

// Inicializa Firebase Messaging no SW para interceptar mensagens em background
event => { /* placeholder para initMessaging ser chamado */ };
getConfig().then(config => {
  if (!config?.apiKey) return;
  if (!firebase.apps.length) firebase.initializeApp(config);
  const messaging = firebase.messaging();
  messaging.onBackgroundMessage((payload) => {
    const title = payload?.notification?.title || payload?.data?.title || 'Assent Gestão';
    const body  = payload?.notification?.body  || payload?.data?.body  || '';
    const url   = payload?.data?.url || '/';
    return self.registration.showNotification(title, {
      body,
      icon:  '/logo.png',
      badge: '/icons/badge-72x72.png',
      tag:   'notif-assent',
      renotify: true,
      data:  { url },
    });
  });
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
