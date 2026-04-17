/* ═══════════════════════════════════════════════════
   ASSENT v2.0 — AgendaCalendario.jsx
   Subcomponente: visualização mensal em calendário
   ═══════════════════════════════════════════════════ */

import { useState, useMemo, useCallback } from "react";
import { TIPO_ESTILO, todayISO } from "./Agenda";

const DIAS_SEMANA = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const MAX_EVENTOS_DIA = 3;

/* ── Gera o grid de células do calendário ── */
function buildCalGrid(year, month) {
  // month: 0-based (Jan=0)
  const firstDay = new Date(year, month, 1);
  const lastDay  = new Date(year, month + 1, 0);

  // Offset: segunda-feira = 0, domingo = 6
  const startOffset = (firstDay.getDay() + 6) % 7; // converte de dom-base para seg-base
  const totalCells  = Math.ceil((startOffset + lastDay.getDate()) / 7) * 7;

  const cells = [];
  for (let i = 0; i < totalCells; i++) {
    const dayNum = i - startOffset + 1;
    if (dayNum < 1) {
      // Dia do mês anterior
      const dt = new Date(year, month, dayNum);
      cells.push({ iso: dt.toISOString().slice(0, 10), day: dt.getDate(), outroMes: true });
    } else if (dayNum > lastDay.getDate()) {
      // Dia do próximo mês
      const dt = new Date(year, month, dayNum);
      cells.push({ iso: dt.toISOString().slice(0, 10), day: dt.getDate(), outroMes: true });
    } else {
      const dt = new Date(year, month, dayNum);
      cells.push({ iso: dt.toISOString().slice(0, 10), day: dayNum, outroMes: false });
    }
  }
  return cells;
}

/* ── Célula de dia ── */
function CalCell({ cell, eventos, hoje, onVerDetalhes }) {
  const isHoje    = cell.iso === hoje;
  const visiveis  = eventos.slice(0, MAX_EVENTOS_DIA);
  const restantes = eventos.length - visiveis.length;

  return (
    <div className={`ag-cal-cell ${cell.outroMes ? "outro-mes" : ""} ${isHoje ? "hoje" : ""}`}>
      <div className="ag-cal-day-num">{cell.day}</div>

      {visiveis.map(ev => {
        const estilo = TIPO_ESTILO[ev.tipo] || TIPO_ESTILO["Outro"];
        return (
          <div
            key={ev.id}
            className="ag-cal-evento"
            style={{
              background: estilo.bg,
              color: estilo.color,
              opacity: ev.status === "concluido" ? 0.45 : 1,
              textDecoration: ev.status === "concluido" ? "line-through" : "none",
            }}
            onClick={() => onVerDetalhes(ev)}
            title={`${ev.horario || ""} — ${ev.titulo}`}
          >
            {ev.horario && <span style={{ opacity: 0.7 }}>{ev.horario} </span>}
            {ev.titulo}
          </div>
        );
      })}

      {restantes > 0 && (
        <div className="ag-cal-mais">+{restantes} mais</div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL — AgendaCalendario
   ══════════════════════════════════════════════════════ */
export default function AgendaCalendario({ eventos, onVerDetalhes }) {
  const hoje = todayISO();
  const now  = new Date();

  const [ano, setAno]   = useState(now.getFullYear());
  const [mes, setMes]   = useState(now.getMonth()); // 0-based

  /* Navegar meses */
  const irMes = useCallback((delta) => {
    setMes(m => {
      const novoMes = m + delta;
      if (novoMes < 0)  { setAno(a => a - 1); return 11; }
      if (novoMes > 11) { setAno(a => a + 1); return 0; }
      return novoMes;
    });
  }, []);

  /* Grid de dias */
  const cells = useMemo(() => buildCalGrid(ano, mes), [ano, mes]);

  /* Mapear eventos por ISO */
  const eventosPorDia = useMemo(() => {
    const mapa = {};
    for (const ev of eventos) {
      if (!ev.data) continue;
      if (!mapa[ev.data]) mapa[ev.data] = [];
      mapa[ev.data].push(ev);
    }
    // Ordenar por horário dentro de cada dia
    for (const iso in mapa) {
      mapa[iso].sort((a, b) => (a.horario || "").localeCompare(b.horario || ""));
    }
    return mapa;
  }, [eventos]);

  /* Label do mês */
  const labelMes = new Date(ano, mes, 1).toLocaleDateString("pt-BR", {
    month: "long", year: "numeric",
  });

  return (
    <div className="ag-cal-wrap">
      {/* Header do calendário */}
      <div className="ag-cal-header">
        <div className="ag-cal-mes" style={{ textTransform: "capitalize" }}>
          {labelMes}
        </div>
        <div className="ag-cal-nav">
          <button className="ag-cal-nav-btn" onClick={() => irMes(-1)} title="Mês anterior">‹</button>
          <button
            className="ag-cal-nav-btn"
            onClick={() => { setAno(now.getFullYear()); setMes(now.getMonth()); }}
            title="Hoje"
            style={{ fontSize: 10, width: "auto", padding: "0 8px", fontFamily: "'DM Sans', sans-serif" }}
          >
            Hoje
          </button>
          <button className="ag-cal-nav-btn" onClick={() => irMes(1)} title="Próximo mês">›</button>
        </div>
      </div>

      {/* Dias da semana */}
      <div className="ag-cal-weekdays">
        {DIAS_SEMANA.map(d => (
          <div key={d} className="ag-cal-weekday">{d}</div>
        ))}
      </div>

      {/* Grid de células */}
      <div className="ag-cal-grid">
        {cells.map((cell) => (
          <CalCell
            key={cell.iso}
            cell={cell}
            eventos={eventosPorDia[cell.iso] || []}
            hoje={hoje}
            onVerDetalhes={onVerDetalhes}
          />
        ))}
      </div>
    </div>
  );
}
