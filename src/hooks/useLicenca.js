/* ═══════════════════════════════════════════════════════════════
   ASSENT v2.0 — hooks/useLicenca.js
   Hook reativo de plano e limites de licença.

   Estrutura Firestore esperada:
     licencas/{tenantUid}                       → doc raiz
     licencas/{tenantUid}/plano/essencial        → limites do plano Essencial
     licencas/{tenantUid}/plano/profissional     → limites do plano Profissional

   Retorna:
     loading, plano, isTrial, isEssencial, isProfissional,
     isPro (alias backward-compat), trialExpirado, diasRestantesTrial,
     licencaAtiva, limites, features, contagemVendas, dataVencimento
   ═══════════════════════════════════════════════════════════════ */

import { useState, useEffect, useRef } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";

// ── Limites client-side (fallback e default)
// A fonte de verdade é o subdoc no Firestore — escrito apenas por Cloud Function.
// Estes valores são usados somente se o subdoc ainda não existir.
const LIMITES_DEFAULT = {
  trial:        { loginsExtras: 15, vendasMes: 2500 },
  essencial:    { loginsExtras: 5,  vendasMes: 500  },
  profissional: { loginsExtras: 15, vendasMes: 2500 },
};

const FEATURES_DEFAULT = {
  trial:        { instaInsights: true  },  // trial = acesso total
  essencial:    { instaInsights: false },
  profissional: { instaInsights: true  },
};

const ESTADO_INICIAL = {
  loading:            true,
  plano:              null,    // "trial" | "essencial" | "profissional"
  isTrial:            false,
  isEssencial:        false,
  isProfissional:     false,
  isPro:              false,   // alias isProfissional — backward compat com módulos existentes
  trialExpirado:      false,
  diasRestantesTrial: null,
  licencaAtiva:       false,
  limites:            LIMITES_DEFAULT.trial,
  features:           FEATURES_DEFAULT.trial,
  contagemVendas:     0,       // lido do subdoc — incrementado por Cloud Function
  dataVencimento:     null,    // Date | null
};

// ────────────────────────────────────────────────────────────────
export function useLicenca(tenantUid) {
  const [estado, setEstado] = useState(ESTADO_INICIAL);

  // Ref para o listener do subdoc — precisa ser cancelado quando o plano muda
  const unsubPlanoRef = useRef(null);

  useEffect(() => {
    if (!tenantUid) {
      setEstado({ ...ESTADO_INICIAL, loading: false });
      return;
    }

    // ── Helper: cancela listener de subdoc anterior ──────────────
    const cancelarSubPlano = () => {
      unsubPlanoRef.current?.();
      unsubPlanoRef.current = null;
    };

    // ── Listener do doc raiz ─────────────────────────────────────
    const unsubRaiz = onSnapshot(
      doc(db, "licencas", tenantUid),
      (snap) => {
        // Cancela listener de subdoc desatualizado
        cancelarSubPlano();

        if (!snap.exists()) {
          setEstado({ ...ESTADO_INICIAL, loading: false });
          return;
        }

        const data = snap.data();
        const planoSlug = data.plano ?? "trial"; // fallback seguro

        // ── Plano TRIAL ──────────────────────────────────────────
        if (planoSlug === "trial") {
          const agora = Date.now();
          const expira = data.trialExpira?.toDate?.() ?? null;
          const trialExpirado = expira ? agora > expira.getTime() : false;

          let diasRestantesTrial = null;
          if (expira && !trialExpirado) {
            diasRestantesTrial = Math.ceil(
              (expira.getTime() - agora) / 86_400_000
            );
          }

          setEstado({
            loading:            false,
            plano:              "trial",
            isTrial:            true,
            isEssencial:        false,
            isProfissional:     false,
            isPro:              false,
            trialExpirado,
            diasRestantesTrial,
            licencaAtiva:       data.ativo === true && !trialExpirado,
            limites:            LIMITES_DEFAULT.trial,
            features:           FEATURES_DEFAULT.trial,
            contagemVendas:     0,
            dataVencimento:     expira,
          });
          return;
        }

        // ── Planos PAGOS (essencial | profissional) ──────────────
        // Subscreve o subdoc para limites e contagem em tempo real
        const isEssencial    = planoSlug === "essencial";
        const isProfissional = planoSlug === "profissional";

        unsubPlanoRef.current = onSnapshot(
          doc(db, "licencas", tenantUid, "plano", planoSlug),
          (planoSnap) => {
            const planoData = planoSnap.exists() ? planoSnap.data() : null;

            const limites       = planoData?.limites    ?? LIMITES_DEFAULT[planoSlug]  ?? LIMITES_DEFAULT.essencial;
            const features      = planoData?.features   ?? FEATURES_DEFAULT[planoSlug] ?? FEATURES_DEFAULT.essencial;
            const contagemVendas = planoData?.contagem?.vendasMes ?? 0;
            const dataVencimento = planoData?.dataVencimento?.toDate?.() ?? null;

            // licencaAtiva: raiz ativo + subdoc ativo (double-check)
            const subdocAtivo   = planoData ? planoData.ativo !== false : true;
            const licencaAtiva  = data.ativo === true && subdocAtivo;

            setEstado({
              loading:            false,
              plano:              planoSlug,
              isTrial:            false,
              isEssencial,
              isProfissional,
              isPro:              isProfissional,  // alias backward compat
              trialExpirado:      false,
              diasRestantesTrial: null,
              licencaAtiva,
              limites,
              features,
              contagemVendas,
              dataVencimento,
            });
          },
          (err) => {
            console.error("[useLicenca] Erro no listener do subdoc de plano:", err);
            // Fallback com defaults do plano conhecido
            setEstado((prev) => ({
              ...prev,
              loading:       false,
              plano:         planoSlug,
              isEssencial,
              isProfissional,
              isPro:         isProfissional,
              limites:       LIMITES_DEFAULT[planoSlug] ?? LIMITES_DEFAULT.essencial,
              features:      FEATURES_DEFAULT[planoSlug] ?? FEATURES_DEFAULT.essencial,
            }));
          }
        );
      },
      (err) => {
        console.error("[useLicenca] Erro no listener do doc raiz:", err);
        setEstado({ ...ESTADO_INICIAL, loading: false });
      }
    );

    return () => {
      unsubRaiz();
      cancelarSubPlano();
    };
  }, [tenantUid]);

  return estado;
}
