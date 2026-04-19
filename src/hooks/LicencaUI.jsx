/* ═══════════════════════════════════════════════════
   ASSENT v2.0 — LicencaUI.jsx
   Componentes visuais relacionados ao plano de licença
   ═══════════════════════════════════════════════════ */

import { LIMITES_FREE } from "./useLicenca";

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

export { LIMITES_FREE };
