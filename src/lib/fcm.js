/* ═══════════════════════════════════════════════════
   lib/fcm.js
   Firebase Cloud Messaging setup
   ═══════════════════════════════════════════════════ */

import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { firebaseConfig } from './firebase';

let messagingInstance = null;

export function initFCM() {
  if (!('serviceWorker' in navigator)) {
    console.warn('[FCM] Service Workers não suportados');
    return null;
  }

  try {
    messagingInstance = getMessaging();

    // Registra Service Worker
    navigator.serviceWorker.register('/firebase-messaging-sw.js', {
      scope: '/',
    }).then((registration) => {
      // Envia config via postMessage (seguro — sem expor keys na network)
      if (registration.active) {
        registration.active.postMessage({
          type: 'INIT_FIREBASE',
          config: firebaseConfig,
        });
      }
      console.log('[FCM] SW registrado');
    }).catch((err) => {
      console.error('[FCM] Erro ao registrar SW:', err);
    });

    return messagingInstance;
  } catch (err) {
    console.error('[FCM] Erro ao inicializar:', err);
    return null;
  }
}

/**
 * Obtém token de push do usuário
 * Requer permissão de notificação do browser
 * @returns {Promise<string|null>} Token ou null se falhar
 */
export async function obterTokenPush(vapidKey) {
  if (!messagingInstance) {
    messagingInstance = initFCM();
  }

  if (!messagingInstance) return null;

  try {
    const token = await getToken(messagingInstance, { vapidKey });
    return token || null;
  } catch (err) {
    console.error('[FCM] Erro ao obter token:', err.code, err.message);
    return null;
  }
}

/**
 * Listener para mensagens quando app está aberta
 * @param {Function} callback — recebe payload da notificação
 * @returns {Function} unsubscribe
 */
export function escutarNotificacoesAbertas(callback) {
  if (!messagingInstance) {
    messagingInstance = initFCM();
  }

  if (!messagingInstance) return () => {};

  return onMessage(messagingInstance, (payload) => {
    console.log('[FCM] Notificação recebida (app aberta):', payload);
    callback(payload);
  });
}
