/* ═══════════════════════════════════════════════════
   lib/fcm.js
   Firebase Cloud Messaging setup
   ═══════════════════════════════════════════════════ */

import { getMessaging, getToken, onMessage } from 'firebase/messaging';

let messagingInstance = null;
let swRegistration = null;

export function initFCM() {
  if (!('serviceWorker' in navigator)) {
    console.warn('[FCM] Service Workers não suportados');
    return null;
  }
  try {
    messagingInstance = getMessaging();
    return messagingInstance;
  } catch (err) {
    console.error('[FCM] Erro ao inicializar:', err);
    return null;
  }
}

async function getSwRegistration() {
  if (swRegistration?.active) return swRegistration;

  // Registra se necessário (idempotente — não duplica se já existir)
  swRegistration = await navigator.serviceWorker.register(
    '/firebase-messaging-sw.js',
    { scope: '/' }
  );

  // Aguarda SW activated + controlling antes de qualquer getToken
  await navigator.serviceWorker.ready;

  // Se após ready ainda não há controller, força claim via SW
  if (!navigator.serviceWorker.controller) {
    console.warn('[FCM] SW ativo mas não controlling — aguardando controllerchange');
    await new Promise((resolve) => {
      navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true });
    });
  }

  console.log('[FCM] SW pronto e controlling');
  return swRegistration;
}

export async function obterTokenPush(vapidKey) {
  try {
    const msg = messagingInstance || getMessaging();
    if (!msg) {
      console.error('[FCM] Messaging não disponível');
      return null;
    }

    const registration = await getSwRegistration();

    console.log('[FCM] Obtendo token com VAPID:', vapidKey ? 'sim' : 'não');
    const token = await getToken(msg, { vapidKey, serviceWorkerRegistration: registration });

    if (token) {
      console.log('[FCM] Token obtido:', token.substring(0, 20) + '...');
      return token;
    }

    console.warn('[FCM] getToken retornou vazio');
    return null;
  } catch (err) {
    console.error('[FCM] Erro ao obter token:', err.code, err.message);
    return null;
  }
}

export function escutarNotificacoesAbertas(callback) {
  if (!messagingInstance) messagingInstance = initFCM();
  if (!messagingInstance) return () => {};

  return onMessage(messagingInstance, (payload) => {
    console.log('[FCM] Notificação recebida (app aberta):', payload);
    callback(payload);
  });
}
