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
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.15);

    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);

    osc.start();
    osc.stop(ctx.currentTime + 0.4);
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
