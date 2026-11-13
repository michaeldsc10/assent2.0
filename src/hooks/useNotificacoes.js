/* ═══════════════════════════════════════════════════
   hooks/useNotificacoes.js
   Notificações Firestore + Web Push (FCM)
   ═══════════════════════════════════════════════════ */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  arrayUnion,
  onSnapshot,
  doc,
  updateDoc,
  setDoc,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { initFCM, obterTokenPush, escutarNotificacoesAbertas } from '../lib/fcm';

const UM_DIA_MS = 24 * 60 * 60 * 1000;

let sharedAudioCtx = null;

function initAudioContext() {
  if (sharedAudioCtx) return sharedAudioCtx;
  try {
    sharedAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
  } catch {
    // não suporta
  }
  return sharedAudioCtx;
}

function tocarSomNotificacao() {
  const ctx = sharedAudioCtx;
  if (!ctx) return;
  try {
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -6;
    comp.knee.value = 0;
    comp.ratio.value = 20;
    comp.attack.value = 0.001;
    comp.release.value = 0.1;
    comp.connect(ctx.destination);

    const playBeep = (t, freq) => {
      [freq, freq * 1.5].forEach((f, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = f;
        osc.connect(gain);
        gain.connect(comp);
        const vol = i === 0 ? 0.85 : 0.35;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(vol, t + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
        osc.start(t);
        osc.stop(t + 0.32);
      });
    };

    playBeep(ctx.currentTime, 1200);
    playBeep(ctx.currentTime + 0.22, 960);
  } catch {
    // silencia
  }
}

async function salvarTokenFCM(uid, vapidKey) {
  try {
    const token = await obterTokenPush(vapidKey);
    if (!token) return;

    await setDoc(
      doc(db, 'usuarios', uid),
      {
        fcmTokens: arrayUnion(token),
        fcmTokenAtualizado: new Date(),
      },
      { merge: true }
    );
  } catch (err) {
    console.error('[FCM] Erro ao salvar token:', err.message);
  }
}

export function useNotificacoes(tenantUid, user) {
  const [notificacoes, setNotificacoes] = useState([]);
  const idsConhecidosRef = useRef(null);
  const unsubFcmRef = useRef(null);
  // Um mapa por query (evita corrida remove/add ao marcar como lida)
  const mapaDocsRef = useRef({ nl: {}, lr: {} });

  const initAudio = useCallback(() => {
    initAudioContext();
    if (sharedAudioCtx?.state === 'suspended') {
      sharedAudioCtx.resume().catch(() => {});
    }
  }, []);

  // Setup FCM + token
  useEffect(() => {
    if (!tenantUid || !user?.uid) return;

    initFCM();

    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;

    const setupToken = () => {
      if (!('Notification' in window)) return;
      if (Notification.permission === 'granted') {
        salvarTokenFCM(user.uid, vapidKey);
      } else if (Notification.permission === 'default') {
        Notification.requestPermission().then((result) => {
          if (result === 'granted') salvarTokenFCM(user.uid, vapidKey);
        });
      }
    };

    setupToken();

    const handleControllerChange = () => {
      salvarTokenFCM(user.uid, vapidKey);
    };
    navigator.serviceWorker?.addEventListener('controllerchange', handleControllerChange);

    unsubFcmRef.current = escutarNotificacoesAbertas(() => {
      tocarSomNotificacao();
    });

    return () => {
      if (unsubFcmRef.current) unsubFcmRef.current();
      navigator.serviceWorker?.removeEventListener('controllerchange', handleControllerChange);
    };
  }, [tenantUid, user?.uid]);

  // Listener Firestore — duas queries mescladas
  useEffect(() => {
    if (!tenantUid || !user?.uid) {
      setNotificacoes([]);
      idsConhecidosRef.current = null;
      mapaDocsRef.current = { nl: {}, lr: {} };
      return;
    }

    const colRef = collection(db, 'users', tenantUid, 'notificacoes');
    const uid = user.uid;

    // Query 1: não lidas
    const qNaoLidas = query(
      colRef,
      where('destinatarioUid', '==', uid),
      where('lida', '==', false),
      orderBy('criadoEm', 'desc'),
      limit(50)
    );

    // Query 2: lidas há menos de 1 dia
    const lidaEm1DiaAtras = Timestamp.fromDate(new Date(Date.now() - UM_DIA_MS));
    const qLidasRecentes = query(
      colRef,
      where('destinatarioUid', '==', uid),
      where('lida', '==', true),
      where('lidaEm', '>=', lidaEm1DiaAtras),
      orderBy('lidaEm', 'desc'),
      limit(50)
    );

    const flush = () => {
      const corte = Date.now() - UM_DIA_MS;
      const mesclado = { ...mapaDocsRef.current.nl, ...mapaDocsRef.current.lr };
      const docs = Object.values(mesclado)
        .filter((d) => !d.lida || (d.lidaEm?.toMillis?.() ?? 0) >= corte)
        .sort(
        (a, b) => (b.criadoEm?.toMillis?.() ?? 0) - (a.criadoEm?.toMillis?.() ?? 0)
      );
      const idsAtuais = new Set(docs.map((d) => d.id));

      if (idsConhecidosRef.current === null) {
        idsConhecidosRef.current = idsAtuais;
      } else {
        const novos = docs.filter((d) => !idsConhecidosRef.current.has(d.id));
        if (novos.length > 0) tocarSomNotificacao();
        idsConhecidosRef.current = idsAtuais;
      }

      setNotificacoes(docs);
    };

    const handleSnap = (chave) => (snap) => {
      const mapa = mapaDocsRef.current[chave];
      snap.docChanges().forEach((change) => {
        if (change.type === 'removed') {
          delete mapa[change.doc.id];
        } else {
          mapa[change.doc.id] = { id: change.doc.id, ...change.doc.data() };
        }
      });
      flush();
    };

    const handleErr = (err) => {
      console.error('[useNotificacoes] erro:', err.code, err.message);
    };

    const unsub1 = onSnapshot(qNaoLidas, handleSnap('nl'), handleErr);
    const unsub2 = onSnapshot(qLidasRecentes, handleSnap('lr'), handleErr);

    return () => {
      unsub1();
      unsub2();
      idsConhecidosRef.current = null;
      mapaDocsRef.current = { nl: {}, lr: {} };
    };
  }, [tenantUid, user?.uid]);

  const marcarLida = useCallback(
    async (notifId) => {
      if (!tenantUid || !notifId) return;
      try {
        await updateDoc(doc(db, 'users', tenantUid, 'notificacoes', notifId), {
          lida: true,
          lidaEm: Timestamp.now(), // ← timestamp para controle de expiração
        });
      } catch (err) {
        console.error('[useNotificacoes] marcarLida erro:', err.code, err.message);
      }
    },
    [tenantUid]
  );

  return { notificacoes, naoLidas: notificacoes.length, marcarLida, initAudio };
}
