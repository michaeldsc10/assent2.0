/* ═══════════════════════════════════════════════════
   functions/src/notificacoes.js
   Cloud Function — Envia Web Push via FCM
   ═══════════════════════════════════════════════════ */

const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { onSchedule }        = require('firebase-functions/v2/scheduler');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');

const db = admin.firestore();
const messaging = admin.messaging();

const TOKEN_INVALIDO = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
]);

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

      const data = usuarioSnap.data();

      // Suporta array (novo) e string legada (retrocompat)
      let tokens = [];
      if (Array.isArray(data.fcmTokens)) {
        tokens = data.fcmTokens.filter(Boolean);
      } else if (data.fcmToken) {
        tokens = [data.fcmToken];
      }

      if (tokens.length === 0) {
        console.warn(`[FCM] Usuário ${destinatarioUid} sem tokens FCM`);
        return;
      }

      const mensagemBase = {
        notification: { title: notifTitulo, body: notifMensagem, icon: '/icons/icon-192x192.png' },
        data: {
          tipo: tipo || 'notificacao',
          assuntoId: assuntoId || '',
          tenantUid,
          timestamp: new Date().toISOString(),
        },
        webpush: {
          notification: { icon: '/icons/icon-192x192.png', badge: '/icons/badge-72x72.png' },
        },
        android: {
          priority: 'high',
          notification: { sound: 'default', defaultSound: true, icon: 'ic_notification' },
        },
        apns: {
          payload: { aps: { sound: 'default', badge: 1 } },
        },
      };

      const resultados = await Promise.allSettled(
        tokens.map((token) => messaging.send({ ...mensagemBase, token }))
      );

      const tokensInvalidos = [];
      resultados.forEach((res, i) => {
        if (res.status === 'fulfilled') {
        } else {
          const code = res.reason?.code;
          console.error(`[FCM] Erro token[${i}]:`, code, res.reason?.message);
          if (TOKEN_INVALIDO.has(code)) tokensInvalidos.push(tokens[i]);
        }
      });

      // Remove tokens inválidos do array
      if (tokensInvalidos.length > 0) {
        const tokensValidos = tokens.filter((t) => !tokensInvalidos.includes(t));
        await db.collection('usuarios').doc(destinatarioUid).update({
          fcmTokens: tokensValidos,
        });
      }

      await db.collection('logs-fcm').doc().set({
        destinatarioUid,
        notifId: snap.id,
        titulo: notifTitulo,
        totalTokens: tokens.length,
        tokensInvalidos: tokensInvalidos.length,
        status: 'processado',
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (error) {
      console.error('[FCM] Erro geral:', error);
      await db.collection('logs-fcm').doc().set({
        destinatarioUid,
        notifId: snap.id,
        titulo: titulo || 'sem titulo',
        status: 'erro',
        erro: error.message,
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
      await db.collection('usuarios').doc(uid).set(
        { fcmTokens: admin.firestore.FieldValue.arrayUnion(fcmToken) },
        { merge: true }
      );
      return { success: true, uid };
    } catch (error) {
      console.error('[FCM] Erro ao atualizar token:', error);
      throw new HttpsError('internal', 'Erro ao atualizar token');
    }
  }
);


/* ═══════════════════════════════════════════════════
   Notificações agendadas — Agenda
   Cria doc em users/{tenantUid}/notificacoes →
   onDocumentCreated acima dispara FCM automaticamente
   ═══════════════════════════════════════════════════ */

function isoSP(date) {
  return date.toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
}

function montarMensagemAgenda(eventos) {
  return eventos
    .sort((a, b) => (a.horario || '').localeCompare(b.horario || ''))
    .map((e) => {
      const hora    = e.horario ? `${e.horario} — ` : '';
      const nome    = e.titulo  || e.descricao || 'Evento';
      const cliente = e.cliente ? ` (${e.cliente})` : '';
      return `• ${hora}${nome}${cliente}`;
    })
    .join('\n');
}

async function processarAgendaTenants(dataISO, buildTitulo) {
  const db      = admin.firestore();
  const tenants = await db.collection('users').listDocuments();

  await Promise.all(
    tenants.map(async (ref) => {
      const tenantUid = ref.id;
      try {
        const snap = await db
          .collection(`users/${tenantUid}/eventos`)
          .where('data',   '==', dataISO)
          .where('status', '==', 'pendente')
          .get();

        if (snap.empty) return;

        const eventos  = snap.docs.map((d) => d.data());
        const qtd      = eventos.length;
        const titulo   = buildTitulo(qtd);
        const mensagem = montarMensagemAgenda(eventos);

        await db.collection(`users/${tenantUid}/notificacoes`).add({
          destinatarioUid : tenantUid,
          titulo,
          mensagem,
          tipo            : 'agenda',
          lida            : false,
          criadoEm        : admin.firestore.FieldValue.serverTimestamp(),
        });

      } catch (err) {
        console.error(`[Agenda] Erro tenant:${tenantUid}`, err.message);
      }
    })
  );
}

exports.notifAgendaHoje = onSchedule(
  { schedule: '0 6 * * *', timeZone: 'America/Sao_Paulo', region: 'us-central1' },
  async () => {
    await processarAgendaTenants(
      isoSP(new Date()),
      (qtd) => `📅 ${qtd} compromisso${qtd > 1 ? 's' : ''} hoje`,
    );
  }
);

exports.notifAgendaAmanha = onSchedule(
  { schedule: '0 20 * * *', timeZone: 'America/Sao_Paulo', region: 'us-central1' },
  async () => {
    await processarAgendaTenants(
      isoSP(new Date(Date.now() + 86_400_000)),
      (qtd) => `🌙 Amanhã: ${qtd} compromisso${qtd > 1 ? 's' : ''}`,
    );
  }
);
