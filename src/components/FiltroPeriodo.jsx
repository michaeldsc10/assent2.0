/* ═══════════════════════════════════════════════════
   ASSENT v2.0 — FiltroPeriodo.jsx
   Componente de filtro de período para relatórios
   ═══════════════════════════════════════════════════ */

import { Calendar } from "lucide-react";

/* ── Opções de período ── */
const OPCOES = [
  { key: "hoje",   label: "Hoje" },
  { key: "7",      label: "7 dias" },
  { key: "30",     label: "30 dias" },
  { key: "mes",    label: "Este mês" },
  { key: "todos",  label: "Todos" },
  { key: "custom", label: "Personalizado" },
];

/* ── Utilitário: retorna {de, ate} com base no período selecionado ──
   Exportado para uso nos relatórios                                  */
export function getIntervalo(periodo, dataInicio, dataFim) {
  const hoje = new Date();
  hoje.setHours(23, 59, 59, 999);

  switch (periodo) {
    case "hoje": {
      const de = new Date();
      de.setHours(0, 0, 0, 0);
      return { de, ate: hoje };
    }
    case "7": {
      const de = new Date();
      de.setDate(de.getDate() - 6);
      de.setHours(0, 0, 0, 0);
      return { de, ate: hoje };
    }
    case "30": {
      const de = new Date();
      de.setDate(de.getDate() - 29);
      de.setHours(0, 0, 0, 0);
      return { de, ate: hoje };
    }
    case "mes": {
      const de = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
      de.setHours(0, 0, 0, 0);
      return { de, ate: hoje };
    }
    case "custom": {
      if (dataInicio && dataFim) {
        const de = new Date(dataInicio + "T00:00:00");
        const ate = new Date(dataFim + "T23:59:59");
        return { de, ate };
      }
      return { de: null, ate: null };
    }
    default: // "todos"
      return { de: null, ate: null };
  }
}

/* ── Utilitário: verifica se uma data está dentro do intervalo ── */
export function dentroDoIntervalo(rawDate, intervalo) {
  if (!intervalo.de && !intervalo.ate) return true;
  if (!rawDate) return false;
  try {
    const d = rawDate?.toDate ? rawDate.toDate() : new Date(rawDate);
    if (isNaN(d.getTime())) return false;
    if (intervalo.de && d < intervalo.de) return false;
    if (intervalo.ate && d > intervalo.ate) return false;
    return true;
  } catch {
    return false;
  }
}

/* ══════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
   ══════════════════════════════════════════════════════ */
export default function FiltroPeriodo({
  periodo,
  setPeriodo,
  dataInicio,
  setDataInicio,
  dataFim,
  setDataFim,
}) {
  return (
    <div className="fp-wrap">
      <div className="fp-label">
        <Calendar size={12} color="var(--text-3)" />
        <span>Período</span>
      </div>

      <div className="fp-btns">
        {OPCOES.map((op) => (
          <button
            key={op.key}
            className={`fp-btn ${periodo === op.key ? "active" : ""}`}
            onClick={() => setPeriodo(op.key)}
          >
            {op.label}
          </button>
        ))}
      </div>

      {periodo === "custom" && (
        <div className="fp-custom">
          <input
            type="date"
            className="fp-date"
            value={dataInicio}
            onChange={(e) => setDataInicio(e.target.value)}
          />
          <span className="fp-sep">até</span>
          <input
            type="date"
            className="fp-date"
            value={dataFim}
            onChange={(e) => setDataFim(e.target.value)}
          />
        </div>
      )}
    </div>
  );
}
