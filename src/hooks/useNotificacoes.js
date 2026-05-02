/* ═══════════════════════════════════════════════════
   hooks/useNotificacoes.js
   Notificações Firestore + Web Push (FCM) + IndexedDB
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
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { initFCM, obterTokenPush, escutarNotificacoesAbertas } from '../lib/fcm';

// ═══════════════════════════════════════════════════
// INDEXEDDB - SINCRONIZAR TOKEN RENOVADO DO SW
// ═══════════════════════════════════════════════════

const initIndexedDB = async () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('assent-fcm', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('tokens')) {
        db.createObjectStore('tokens', { keyPath: 'key' });
      }
    };
  });
};

const getTokenFromIndexedDB = async () => {
  try {
    const db = await initIndexedDB();
    return new Promise((resolve) => {
      const tx = db.transaction('tokens', 'readonly');
      const request = tx.objectStore('tokens').get('current');
      request.onsuccess = () => resolve(request.result?.value || null);
      request.onerror = () => resolve(null);
    });
  } catch (err) {
    console.warn('[useNotificacoes] IndexedDB erro:', err.message);
    return null;
  }
};

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

export function useNotificacoes(tenantUid, user) {
  const [notificacoes, setNotificacoes] = useState([]);
  const idsConhecidosRef = useRef(null);
  const unsubFcmRef = useRef(null);
  const lastTokenRef = useRef(null);

  const initAudio = useCallback(() => {
    initAudioContext();
    if (sharedAudioCtx?.state === 'suspended') {
      sharedAudioCtx.resume().catch(() => {});
    }
  }, []);

  // Setup FCM + pedir permissão na primeira vez
  useEffect(() => {
    if (!tenantUid || !user?.uid) return;

    // Inicializa FCM
    initFCM();

    // Pede permissão de notificação
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then((permission) => {
        if (permission === 'granted') {
          // Obtém e salva token de push
          const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
          obterTokenPush(vapidKey).then((token) => {
            if (token) {
              lastTokenRef.current = token;
              // Salva token no Firestore (para backend enviar push)
              updateDoc(doc(db, 'usuarios', user.uid), {
                fcmToken: token,
                fcmTokenAtualizado: new Date(),
              }).catch(console.error);
            }
          });
        }
      });
    }

    // Listener FCM quando app está aberta
    unsubFcmRef.current = escutarNotificacoesAbertas((payload) => {
      // Toca som se recebeu notificação com app aberta
      tocarSomNotificacao();
    });

    return () => {
      if (unsubFcmRef.current) unsubFcmRef.current();
    };
  }, [tenantUid, user?.uid]);

  // Polling IndexedDB para token renovado (pushsubscriptionchange)
  useEffect(() => {
    if (!tenantUid || !user?.uid) return;

    const checkTokenInterval = setInterval(async () => {
      const dbToken = await getTokenFromIndexedDB();
      if (dbToken && dbToken !== lastTokenRef.current) {
        console.log('[useNotificacoes] Token renovado detectado');
        lastTokenRef.current = dbToken;
        
        // Salva token novo no Firestore
        updateDoc(doc(db, 'usuarios', user.uid), {
          fcmToken: dbToken,
          fcmTokenAtualizado: new Date(),
        }).catch(console.error);
      }
    }, 5000); // verifica a cada 5s

    return () => clearInterval(checkTokenInterval);
  }, [tenantUid, user?.uid]);

  // Listener Firestore (mesmo de antes)
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
          if (novos.length > 0) {
            tocarSomNotificacao();
          }
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
        await updateDoc(
          doc(db, 'users', tenantUid, 'notificacoes', notifId),
          { lida: true }
        );
      } catch (err) {
        console.error('[useNotificacoes] marcarLida erro:', err.code, err.message);
      }
    },
    [tenantUid]
  );

  const naoLidas = notificacoes.length;

  return { notificacoes, naoLidas, marcarLida, initAudio };
}
