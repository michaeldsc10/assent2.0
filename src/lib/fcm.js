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
 * @returns {Promise<string|null>} Token ou null se falhar
 */
export async function obterTokenPush(vapidKey) {
  try {
    // Tenta obter messaging global (já inicializado em firebase.js)
    const msg = messagingInstance || getMessaging();
    
    if (!msg) {
      console.error('[FCM] Messaging não disponível');
      return null;
    }

    console.log('[FCM] Obtendo token com VAPID:', vapidKey ? 'sim' : 'não');
    const token = await getToken(msg, { vapidKey });
    
    if (token) {
      console.log('[FCM] Token obtido:', token.substring(0, 20) + '...');
      return token;
    } else {
      console.warn('[FCM] getToken retornou vazio');
      return null;
    }
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
