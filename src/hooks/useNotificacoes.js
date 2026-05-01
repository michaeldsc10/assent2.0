// hooks/useNotificacoes.js
// ASSENT v2.0 — Hook de notificações em tempo real
//
// Responsabilidade:
//   - Escuta `users/{tenantUid}/notificacoes` onde destinatarioUid === user.uid
//   - Filtra somente lida === false
//   - Toca som via Web Audio API apenas em chegadas novas (não no boot)
//   - Expõe lista de notificações, contagem de não-lidas e helper para marcar como lida
//
// Uso:
//   const { notificacoes, naoLidas, marcarLida } = useNotificacoes(tenantUid, user);

import { useState, useEffect, useRef, useCallback } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
} from "firebase/firestore";
import { db } from "../lib/firebase";

// ─── Web Audio API ─────────────────────────────────────────────────────────────
// AudioContext é compartilhado via módulo — uma única instância por aba.
// Inicializado no primeiro clique do usuário (ver useNotificacoes → initAudio).
let sharedAudioCtx = null;

function initAudioContext() {
  if (sharedAudioCtx) return sharedAudioCtx;
  try {
    sharedAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
  } catch {
    // Browser não suporta Web Audio (improvável mas defensivo)
  }
  return sharedAudioCtx;
}

function tocarSomNotificacao() {
  const ctx = sharedAudioCtx;
  if (!ctx) return;

  try {
    // Compressor maximiza volume sem distorcao
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -6;
    comp.knee.value      = 0;
    comp.ratio.value     = 20;
    comp.attack.value    = 0.001;
    comp.release.value   = 0.1;
    comp.connect(ctx.destination);

    // Dois beeps descendentes (1200 Hz -> 960 Hz), cada um com harmonico
    const playBeep = (t, freq) => {
      [freq, freq * 1.5].forEach((f, i) => {
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type            = "sine";
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

    playBeep(ctx.currentTime,        1200); // primeiro beep
    playBeep(ctx.currentTime + 0.22,  960); // segundo beep
  } catch {
    // Silencia erros de AudioContext suspendido — sem impacto na UX
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * useNotificacoes(tenantUid, user)
 *
 * @param {string|null} tenantUid  — UID do tenant (empresa)
 * @param {object|null} user       — Objeto do Firebase Auth ({ uid, ... })
 * @returns {{
 *   notificacoes: Array,
 *   naoLidas: number,
 *   marcarLida: (notifId: string) => Promise<void>,
 *   initAudio: () => void,
 * }}
 */
export function useNotificacoes(tenantUid, user) {
  const [notificacoes, setNotificacoes] = useState([]);

  // Ids já conhecidos no snapshot anterior — detecta chegadas novas vs. carga inicial
  const idsConhecidosRef = useRef(null); // null = ainda não inicializado (primeira carga)

  // Garante que initAudio pode ser chamado em qualquer clique no AG
  const initAudio = useCallback(() => {
    initAudioContext();
    // Resume o contexto caso o browser o tenha suspendido por inatividade
    if (sharedAudioCtx?.state === "suspended") {
      sharedAudioCtx.resume().catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (!tenantUid || !user?.uid) {
      setNotificacoes([]);
      idsConhecidosRef.current = null;
      return;
    }

    const q = query(
      collection(db, "users", tenantUid, "notificacoes"),
      where("destinatarioUid", "==", user.uid),
      where("lida", "==", false),
      orderBy("criadoEm", "desc")
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const idsAtuais = new Set(docs.map((d) => d.id));

        if (idsConhecidosRef.current === null) {
          // Primeira carga: registra ids sem tocar som
          idsConhecidosRef.current = idsAtuais;
        } else {
          // Verifica se chegaram ids novos desde o último snapshot
          const novos = docs.filter((d) => !idsConhecidosRef.current.has(d.id));
          if (novos.length > 0) {
            tocarSomNotificacao();
          }
          idsConhecidosRef.current = idsAtuais;
        }

        setNotificacoes(docs);
      },
      (err) => {
        // Não expõe erros internos ao usuário — apenas loga para diagnóstico
        console.error("[useNotificacoes] onSnapshot erro:", err.code, err.message);
      }
    );

    return () => {
      unsub();
      // Reseta rastreador ao desmontar — evita falso-positivo na remontagem
      idsConhecidosRef.current = null;
    };
  }, [tenantUid, user?.uid]);

  /**
   * Marca uma notificação como lida no Firestore.
   * Seguro chamar múltiplas vezes — updateDoc é idempotente aqui.
   */
  const marcarLida = useCallback(
    async (notifId) => {
      if (!tenantUid || !notifId) return;
      try {
        await updateDoc(
          doc(db, "users", tenantUid, "notificacoes", notifId),
          { lida: true }
        );
      } catch (err) {
        console.error("[useNotificacoes] marcarLida erro:", err.code, err.message);
      }
    },
    [tenantUid]
  );

  const naoLidas = notificacoes.length;

  return { notificacoes, naoLidas, marcarLida, initAudio };
}
