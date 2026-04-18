/* ═══════════════════════════════════════════════════
   ASSENT v2.0 — hooks/useEmpresa.js
   Hook reativo: lê nomeEmpresa e logo em tempo real.

   Caminho Firestore: users/{uid}/config/geral
   Campo: empresa.{ nomeEmpresa, logo, cnpj, telefone, endereco }
   ═══════════════════════════════════════════════════ */

import { useState, useEffect } from "react";
import { db } from "../lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";

/**
 * useEmpresa(uid)
 *
 * Escuta `users/{uid}/config/geral` em tempo real e retorna
 * o objeto `empresa`. Atualização sem reload quando o usuário
 * salva configurações.
 *
 * @param {string|null} uid
 * @returns {object|null} { nomeEmpresa, logo, cnpj, telefone, endereco } ou null
 */
export function useEmpresa(uid) {
  const [empresa, setEmpresa] = useState(null);

  useEffect(() => {
    if (!uid) return;

    const ref = doc(db, "users", uid, "config", "geral");

    const unsub = onSnapshot(ref, (snap) => {
      if (!snap.exists()) {
        setEmpresa({});
        return;
      }
      const data = snap.data();
      /* Suporta tanto data.empresa (novo) quanto data.nomeEmpresa/logo (legado) */
      setEmpresa(
        data.empresa ?? {
          nomeEmpresa: data.nomeEmpresa || "",
          logo:        data.logo        || "",
          cnpj:        data.cnpj        || "",
          telefone:    data.telefone    || "",
          endereco:    data.endereco    || "",
        }
      );
    });

    return unsub;
  }, [uid]);

  return empresa;
}
