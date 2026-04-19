/* ═══════════════════════════════════════════════════
   ASSENT v2.0 — useLicenca.js
   Hook centralizado para leitura de licença Pro/Free
   Lê: licencas/{uid}  →  { ativo: bool, pro: bool }
   ═══════════════════════════════════════════════════ */

import { useState, useEffect } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";

/**
 * @returns {{ isPro: boolean, ativo: boolean, loadingLicenca: boolean }}
 */
export function useLicenca(uid) {
  const [isPro,          setIsPro]          = useState(false);
  const [ativo,          setAtivo]          = useState(false);
  const [loadingLicenca, setLoadingLicenca] = useState(true);

  useEffect(() => {
    if (!uid) {
      setIsPro(false);
      setAtivo(false);
      setLoadingLicenca(false);
      return;
    }

    const ref = doc(db, "licencas", uid);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setIsPro(false);
          setAtivo(false);
        } else {
          const d = snap.data();
          setAtivo(d.ativo === true);
          setIsPro(d.ativo === true && d.pro === true);
        }
        setLoadingLicenca(false);
      },
      (err) => {
        console.error("[useLicenca] erro:", err);
        setIsPro(false);
        setAtivo(false);
        setLoadingLicenca(false);
      }
    );

    return () => unsub();
  }, [uid]);

  return { isPro, ativo, loadingLicenca };
}

/* ── Limites do plano Free ────────────────────────
   Use estas constantes em todos os módulos para
   nunca hardcodar os valores.
   ─────────────────────────────────────────────── */
export const LIMITES_FREE = {
  clientes:  15,
  produtos:   5,
  servicos:   5,
  eventos:    5,   // Agenda
  vendas:    25,   // por mês
  despesas:  15,
};
