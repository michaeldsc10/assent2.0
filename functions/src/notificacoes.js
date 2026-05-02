/* ═══════════════════════════════════════════════════
   functions/src/notificacoes.js
   Cloud Function — Envia Web Push via FCM
   ═══════════════════════════════════════════════════ */

const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');

const db = admin.firestore();
const messaging = admin.messaging();

/**
 * Trigger: Quando documento em users/{tenantUid}/notificacoes é criado
 * Envia Web Push para dispositivos do destinatário
 */
exports.enviarNotificacaoReserva = onDocumentCreated(
  {
    document: 'users/{tenantUid}/notificacoes/{notifId}',
    region: 'us-central1',
  },
  async (event) => {
    const snap = event.data;
    const { tenantUid, notifId } = event.params;
    const notif = snap.data();

    const { destinatarioUid, titulo, mensagem, tipo, assuntoId } = notif;

    if (!destinatarioUid || !titulo || !mensagem) {
      console.error('[FCM] Notificação incompleta:', notif);
      return;
    }

    try {
      // Busca token FCM do usuário destinatário
      const usuarioRef = db.collection('usuarios').doc(destinatarioUid);
      const usuarioSnap = await usuarioRef.get();

      if (!usuarioSnap.exists) {
        console.warn(`[FCM] Usuário ${destinatarioUid} não encontrado`);
        return;
      }

      const { fcmToken } = usuarioSnap.data();

      if (!fcmToken) {
        console.warn(`[FCM] Usuário ${destinatarioUid} sem token FCM`);
        return;
      }

      // Payload seguro — sem expor dados sensíveis
      const message = {
        notification: {
          title: titulo,
          body: mensagem,
        },
        data: {
          tipo: tipo || 'notificacao',
          assuntoId: assuntoId || '',
          tenantUid: tenantUid,
          timestamp: new Date().toISOString(),
        },
        token: fcmToken,
        // Android
        android: {
          priority: 'high',
          notification: {
            sound: 'default',
            defaultSound: true,
            tag: 'notificacao-assent',
          },
        },
        // iOS
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
            },
          },
        },
      };

      // Envia push
      const messageId = await messaging.send(message);
      console.log(`[FCM] Push enviado: ${messageId}`);

      // Log para auditoria (opcional)
      await db.collection('logs-fcm').doc().set({
        messageId,
        destinatarioUid,
        notifId: snap.id,
        titulo,
        status: 'enviado',
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (error) {
      console.error('[FCM] Erro ao enviar:', error);

      // Log de erro
      await db.collection('logs-fcm').doc().set({
        destinatarioUid,
        notifId: snap.id,
        titulo,
        status: 'erro',
        erro: error.message,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  });

/**
 * Função auxiliar: Atualiza token FCM quando usuário faz login
 */
exports.atualizarTokenFCM = onCall(
  { region: 'us-central1' },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Usuário não autenticado');
    }

    const { fcmToken } = request.data;
    const uid = request.auth.uid;

    if (!fcmToken) {
      throw new HttpsError('invalid-argument', 'fcmToken obrigatório');
    }

    try {
      await db.collection('usuarios').doc(uid).update({
        fcmToken,
        fcmTokenAtualizado: admin.firestore.FieldValue.serverTimestamp(),
      });

      return { success: true, uid };
    } catch (error) {
      console.error('[FCM] Erro ao atualizar token:', error);
      throw new HttpsError('internal', 'Erro ao atualizar token');
    }
  }
);
