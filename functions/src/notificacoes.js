/* ═══════════════════════════════════════════════════
   functions/src/notificacoes.js
   Cloud Function — Envia Web Push via FCM
   ═══════════════════════════════════════════════════ */

const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');

const db = admin.firestore();
const messaging = admin.messaging();

exports.enviarNotificacaoReserva = onDocumentCreated(
  {
    document: 'users/{tenantUid}/notificacoes/{notifId}',
    region: 'us-central1',
  },
  async (event) => {
    const snap = event.data;
    const { tenantUid } = event.params;
    const notif = snap.data();

    const { destinatarioUid, titulo, mensagem, tipo, assuntoId, payload } = notif;

    if (!destinatarioUid) {
      console.error('[FCM] destinatarioUid faltando:', notif);
      return;
    }

    let notifTitulo = titulo || 'Nova Notificação';
    let notifMensagem = mensagem || 'Você tem uma nova notificação';

    if (payload?.cliente) {
      notifTitulo = `Nova Reserva - ${payload.cliente}`;
      notifMensagem = `${payload.data} às ${payload.hora}`;
    }

    try {
      const usuarioSnap = await db.collection('usuarios').doc(destinatarioUid).get();

      if (!usuarioSnap.exists) {
        console.warn(`[FCM] Usuário ${destinatarioUid} não encontrado`);
        return;
      }

      const { fcmToken } = usuarioSnap.data();

      if (!fcmToken) {
        console.warn(`[FCM] Usuário ${destinatarioUid} sem token FCM`);
        return;
      }

      const message = {
        notification: {
          title: notifTitulo,
          body: notifMensagem,
        },
        data: {
          tipo: tipo || 'notificacao',
          assuntoId: assuntoId || '',
          tenantUid,
          timestamp: new Date().toISOString(),
        },
        token: fcmToken,
        android: {
          priority: 'high',
          notification: {
            sound: 'default',
            defaultSound: true,
            tag: 'notificacao-assent',
          },
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
            },
          },
        },
      };

      const messageId = await messaging.send(message);
      console.log(`[FCM] Push enviado: ${messageId}`);

      await db.collection('logs-fcm').doc().set({
        messageId,
        destinatarioUid,
        notifId: snap.id,
        titulo: notifTitulo,
        status: 'enviado',
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (error) {
      // Token inválido/expirado → remove para forçar renovação no próximo login
      if (
        error.code === 'messaging/registration-token-not-registered' ||
        error.code === 'messaging/invalid-registration-token'
      ) {
        console.warn(`[FCM] Token inválido para ${destinatarioUid} — removendo`);
        await db.collection('usuarios').doc(destinatarioUid).update({
          fcmToken: admin.firestore.FieldValue.delete(),
          fcmTokenAtualizado: admin.firestore.FieldValue.delete(),
        });
      } else {
        console.error('[FCM] Erro ao enviar:', error);
      }

      await db.collection('logs-fcm').doc().set({
        destinatarioUid,
        notifId: snap.id,
        titulo: titulo || 'sem titulo',
        status: 'erro',
        erro: error.message,
        errorCode: error.code || null,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  }
);

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
