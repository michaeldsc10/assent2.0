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
  onSnapshot,
  doc,
  updateDoc,
  setDoc,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { initFCM, obterTokenPush, escutarNotificacoesAbertas } from '../lib/fcm';

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

// Salva token no array fcmTokens (arrayUnion = sem duplicatas)
async function salvarTokenFCM(uid, vapidKey) {
  try {
    const token = await obterTokenPush(vapidKey);
    if (!token) return;

    const { arrayUnion } = await import('firebase/firestore');
    await setDoc(
      doc(db, 'usuarios', uid),
      {
        fcmTokens: arrayUnion(token),
        fcmTokenAtualizado: new Date(),
      },
      { merge: true }
    );
    console.log('[FCM] Token salvo');
  } catch (err) {
    console.error('[FCM] Erro ao salvar token:', err.message);
  }
}

export function useNotificacoes(tenantUid, user) {
  const [notificacoes, setNotificacoes] = useState([]);
  const idsConhecidosRef = useRef(null);
  const unsubFcmRef = useRef(null);

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

    // SW atualizado → adiciona novo token ao array
    const handleControllerChange = () => {
      console.log('[FCM] SW trocado — renovando token');
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

  // Listener Firestore
  useEffect(() => {
    if (!tenantUid || !user?.uid) {
      setNotificacoes([]);
      idsConhecidosRef.current = null;
      return;
    }

    const q = query(
      collection(db, 'users', tenantUid, 'notificacoes'),
      where('destinatarioUid', '==', user.uid),
      where('lida', '==', false),
      orderBy('criadoEm', 'desc')
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const idsAtuais = new Set(docs.map((d) => d.id));

        if (idsConhecidosRef.current === null) {
          idsConhecidosRef.current = idsAtuais;
        } else {
          const novos = docs.filter((d) => !idsConhecidosRef.current.has(d.id));
          if (novos.length > 0) tocarSomNotificacao();
          idsConhecidosRef.current = idsAtuais;
        }

        setNotificacoes(docs);
      },
      (err) => {
        console.error('[useNotificacoes] erro:', err.code, err.message);
      }
    );

    return () => {
      unsub();
      idsConhecidosRef.current = null;
    };
  }, [tenantUid, user?.uid]);

  const marcarLida = useCallback(
    async (notifId) => {
      if (!tenantUid || !notifId) return;
      try {
        await updateDoc(doc(db, 'users', tenantUid, 'notificacoes', notifId), {
          lida: true,
        });
      } catch (err) {
        console.error('[useNotificacoes] marcarLida erro:', err.code, err.message);
      }
    },
    [tenantUid]
  );

  return { notificacoes, naoLidas: notificacoes.length, marcarLida, initAudio };
}
