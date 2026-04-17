/* ═══════════════════════════════════════════════════
   ASSENT v2.0 — CardResumo.jsx
   Card de KPI para relatórios
   Props:
     icon      – ReactNode (ícone lucide)
     label     – string
     value     – string (valor já formatado)
     sub       – string (texto auxiliar opcional)
     trend     – "up" | "down" | "neutral"
     colorVar  – CSS var name, ex: "var(--gold)"
     loading   – boolean
   ═══════════════════════════════════════════════════ */

import { TrendingUp, TrendingDown, Minus } from "lucide-react";

export default function CardResumo({
  icon,
  label,
  value,
  sub,
  trend = "neutral",
  colorVar = "var(--gold)",
  loading = false,
}) {
  const TrendIcon =
    trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;

  const trendColor =
    trend === "up"
      ? "var(--green)"
      : trend === "down"
      ? "var(--red)"
      : "var(--text-3)";

  return (
    <div className="cr-card">
      {/* Ícone */}
      <div className="cr-icon-wrap" style={{ background: `${colorVar}18`, border: `1px solid ${colorVar}30` }}>
        <span style={{ color: colorVar }}>{icon}</span>
      </div>

      <div className="cr-body">
        <div className="cr-label">{label}</div>

        {loading ? (
          <div className="cr-skeleton" />
        ) : (
          <div className="cr-value" style={{ color: colorVar }}>
            {value}
          </div>
        )}

        {sub && !loading && (
          <div className="cr-sub">
            <TrendIcon size={10} color={trendColor} />
            <span style={{ color: trendColor }}>{sub}</span>
          </div>
        )}
      </div>
    </div>
  );
}
