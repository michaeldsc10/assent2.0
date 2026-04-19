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

/** Tela padrão de upgrade exibida nos módulos bloqueados */
export function TelaBloqueada({ modulo }) {
  return (
    <div style={{
      flex: 1,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 16,
      padding: 40,
      textAlign: "center",
    }}>
      <div style={{
        width: 56, height: 56, borderRadius: 16,
        background: "rgba(200,165,94,0.1)",
        border: "1px solid rgba(200,165,94,0.25)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 24,
      }}>
        🔒
      </div>
      <div>
        <div style={{
          display: "inline-flex", alignItems: "center",
          gap: 6, marginBottom: 10,
        }}>
          <span style={{
            fontFamily: "'Sora', sans-serif",
            fontSize: 11, fontWeight: 700,
            letterSpacing: "0.1em", textTransform: "uppercase",
            background: "linear-gradient(135deg,#D4AF37,#e8ca60)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            padding: "3px 10px",
            border: "1px solid rgba(200,165,94,0.35)",
            borderRadius: 20,
          }}>
            PRO
          </span>
        </div>
        <p style={{
          fontFamily: "'Sora', sans-serif",
          fontSize: 18, fontWeight: 600,
          color: "var(--text)", marginBottom: 8,
        }}>
          {modulo} é exclusivo do plano Pro
        </p>
        <p style={{ fontSize: 13, color: "var(--text-2)", maxWidth: 340, lineHeight: 1.6 }}>
          Faça upgrade para acessar este módulo e desbloquear todos os recursos do Assent Gestão.
        </p>
      </div>
    </div>
  );
}

/** Banner inline de limite atingido (dentro de módulos parcialmente liberados) */
export function BannerLimite({ total, limite, tipo, isPro }) {
  if (isPro) return null;
  if (total < limite) return null;

  return (
    <div style={{
      margin: "0 22px 14px",
      padding: "10px 14px",
      borderRadius: 10,
      background: "rgba(200,165,94,0.08)",
      border: "1px solid rgba(200,165,94,0.25)",
      display: "flex", alignItems: "center", gap: 10,
      fontSize: 12, color: "var(--text-2)",
    }}>
      <span style={{ fontSize: 15 }}>⚠️</span>
      <span>
        Você atingiu o limite de <strong style={{ color: "var(--gold)" }}>{limite} {tipo}</strong> do plano Free.{" "}
        Faça upgrade para o plano <strong style={{ color: "var(--gold)" }}>PRO</strong> e cadastre sem limites.
      </span>
    </div>
  );
}
