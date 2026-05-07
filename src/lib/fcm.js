/* ═══════════════════════════════════════════════════
   lib/fcm.js
   Firebase Cloud Messaging setup
   ═══════════════════════════════════════════════════ */

import { getMessaging, getToken, onMessage } from 'firebase/messaging';

let messagingInstance = null;
let swRegistration = null;

export function initFCM() {
  if (!('serviceWorker' in navigator)) {
    return null;
  }
  try {
    messagingInstance = getMessaging();
    return messagingInstance;
  } catch (err) {
    return null;
  }
}

async function getSwRegistration() {
  if (swRegistration?.active) return swRegistration;

  swRegistration = await navigator.serviceWorker.register(
    '/firebase-messaging-sw.js',
    { scope: '/' }
  );

  await navigator.serviceWorker.ready;

  return swRegistration;
}

export async function obterTokenPush(vapidKey) {
  try {
    const msg = messagingInstance || getMessaging();
    if (!msg) {
      return null;
    }

    const registration = await getSwRegistration();

    const token = await getToken(msg, { vapidKey, serviceWorkerRegistration: registration });

    return token || null;
  } catch (err) {
    return null;
  }
}

export function escutarNotificacoesAbertas(callback) {
  if (!messagingInstance) messagingInstance = initFCM();
  if (!messagingInstance) return () => {};

  return onMessage(messagingInstance, (payload) => {
    callback(payload);
  });
}
