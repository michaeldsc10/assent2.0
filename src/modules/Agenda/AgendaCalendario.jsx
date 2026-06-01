/* ═══════════════════════════════════════════════════
   ASSENT v2.0 — AgendaCalendario.jsx
   Layout: calendário compacto + painel do dia lateral
   ═══════════════════════════════════════════════════ */

import { useState, useMemo, useCallback, useEffect } from "react";
import { Clock, Plus } from "lucide-react";
import { TIPO_ESTILO, todayISO, resolverEstiloTipo } from "./Agenda";

function useIsMobile() {
  const [mobile, setMobile] = useState(window.innerWidth < 720);
  useEffect(() => {
    const h = () => setMobile(window.innerWidth < 720);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return mobile;
}

const DIAS_SEMANA = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];

/* ── Gera grid começando no domingo ── */
function buildCalGrid(year, month) {
  const firstDay = new Date(year, month, 1);
  const lastDay  = new Date(year, month + 1, 0);
  const startOffset = firstDay.getDay(); // 0=dom
  const totalCells  = Math.ceil((startOffset + lastDay.getDate()) / 7) * 7;

  const cells = [];
  for (let i = 0; i < totalCells; i++) {
    const dayNum = i - startOffset + 1;
    const dt = new Date(year, month, dayNum);
    cells.push({
      iso: dt.toISOString().slice(0, 10),
      day: dt.getDate(),
      outroMes: dayNum < 1 || dayNum > lastDay.getDate(),
    });
  }
  return cells;
}

const MESES_PT = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"
];

const DIAS_PT = ["Domingo","Segunda-feira","Terça-feira","Quarta-feira","Quinta-feira","Sexta-feira","Sábado"];

/* ── Painel lateral do dia selecionado ── */
function PainelDia({ iso, eventos, onVerDetalhes, onNovo, categorias, mobile }) {
  if (!iso) return null;

  const [ano, mes, dia] = iso.split("-").map(Number);
  const dt = new Date(ano, mes - 1, dia);
  const diaSemana = DIAS_PT[dt.getDay()];
  const labelData = `${dia} ${MESES_PT[mes - 1].slice(0,3)} ${ano}`;

  const evsDia = [...eventos].sort((a, b) =>
    (a.horario || "").localeCompare(b.horario || "")
  );

  return (
    <div style={{
      width: mobile ? "100%" : 280, flexShrink: 0,
      background: "var(--s1)", border: "1px solid var(--border)",
      borderRadius: 14, display: "flex", flexDirection: "column",
      overflow: "hidden",
    }}>
      {/* Header do painel */}
      <div style={{
        padding: "16px 18px", borderBottom: "1px solid var(--border)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", lineHeight: 1.2 }}>
            {labelData}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 3 }}>
            {diaSemana}
          </div>
        </div>
        <button
          onClick={() => onNovo(iso)}
          style={{
            display: "flex", alignItems: "center", gap: 5,
            padding: "6px 12px", borderRadius: 8,
            background: "transparent", border: "1px solid var(--border)",
            cursor: "pointer", color: "var(--text-2)", fontSize: 12,
            fontFamily: "inherit", transition: "all .13s",
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--gold)"; e.currentTarget.style.color = "var(--gold)"; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-2)"; }}
        >
          <Plus size={13} /> Adicionar
        </button>
      </div>

      {/* Lista de eventos do dia */}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px" }}>
        {evsDia.length === 0 ? (
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center",
            justifyContent: "center", gap: 8, padding: "32px 0",
            color: "var(--text-3)",
          }}>
            <Clock size={22} strokeWidth={1.5} />
            <span style={{ fontSize: 12 }}>Nenhum compromisso neste dia.</span>
          </div>
        ) : (
          evsDia.map(ev => {
            const estilo = resolverEstiloTipo(ev.tipo, categorias);
            return (
              <div
                key={ev.id}
                onClick={() => onVerDetalhes(ev)}
                style={{
                  display: "flex", alignItems: "flex-start", gap: 10,
                  padding: "10px 12px", borderRadius: 10, marginBottom: 6,
                  background: "var(--s2)", border: "1px solid var(--border)",
                  cursor: "pointer", transition: "border-color .13s",
                  opacity: ev.status === "concluido" ? 0.5 : 1,
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = estilo.color}
                onMouseLeave={e => e.currentTarget.style.borderColor = "var(--border)"}
              >
                {/* Dot colorido */}
                <div style={{
                  width: 8, height: 8, borderRadius: "50%",
                  background: estilo.color, flexShrink: 0, marginTop: 4,
                }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{
                    fontSize: 13, fontWeight: 600, color: "var(--text)",
                    textDecoration: ev.status === "concluido" ? "line-through" : "none",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {ev.titulo}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>
                    {ev.horario ? ev.horario : "Dia inteiro"}
                    {ev.tipo ? ` · ${ev.tipo}` : ""}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
   ══════════════════════════════════════════════════════ */
export default function AgendaCalendario({ eventos, onVerDetalhes, onNovo, categorias = [] }) {
  const hoje   = todayISO();
  const now    = new Date();
  const mobile = useIsMobile();

  const [ano, setAno]         = useState(now.getFullYear());
  const [mes, setMes]         = useState(now.getMonth());
  const [diaSel, setDiaSel]   = useState(hoje);

  const irMes = useCallback((delta) => {
    setMes(m => {
      const novoMes = m + delta;
      if (novoMes < 0)  { setAno(a => a - 1); return 11; }
      if (novoMes > 11) { setAno(a => a + 1); return 0; }
      return novoMes;
    });
  }, []);

  const irHoje = () => {
    setAno(now.getFullYear());
    setMes(now.getMonth());
    setDiaSel(hoje);
  };

  const cells = useMemo(() => buildCalGrid(ano, mes), [ano, mes]);

  const eventosPorDia = useMemo(() => {
    const mapa = {};
    for (const ev of eventos) {
      if (!ev.data) continue;
      if (!mapa[ev.data]) mapa[ev.data] = [];
      mapa[ev.data].push(ev);
    }
    return mapa;
  }, [eventos]);

  const evsDiaSel = eventosPorDia[diaSel] || [];

  return (
    <div style={{
      display: "flex",
      flexDirection: mobile ? "column" : "row",
      gap: 16,
      alignItems: "flex-start",
    }}>

      {/* Calendário */}
      <div style={{
        flex: 1, minWidth: 0,
        background: "var(--s1)", border: "1px solid var(--border)",
        borderRadius: 14, overflow: "hidden",
      }}>
        {/* Header navegação */}
        <div style={{
          padding: "14px 18px",
          display: "flex", alignItems: "center", gap: 10,
          borderBottom: "1px solid var(--border)",
        }}>
          <button
            onClick={() => irMes(-1)}
            style={{
              width: 30, height: 30, borderRadius: 8, border: "1px solid var(--border)",
              background: "var(--s2)", cursor: "pointer", color: "var(--text)",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all .13s", flexShrink: 0,
            }}
          >‹</button>

          <span style={{
            flex: 1, textAlign: "center",
            fontSize: 15, fontWeight: 700, color: "var(--text)",
          }}>
            {MESES_PT[mes]} {ano}
          </span>

          <button
            onClick={() => irMes(1)}
            style={{
              width: 30, height: 30, borderRadius: 8, border: "1px solid var(--border)",
              background: "var(--s2)", cursor: "pointer", color: "var(--text)",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all .13s", flexShrink: 0, fontSize: 16,
            }}
          >›</button>

          <button
            onClick={irHoje}
            style={{
              padding: "6px 14px", borderRadius: 8, border: "1px solid var(--border)",
              background: "var(--s2)", cursor: "pointer", color: "var(--text)",
              fontSize: 12, fontFamily: "inherit", transition: "all .13s", flexShrink: 0,
            }}
          >Hoje</button>
        </div>

        {/* Dias da semana */}
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(7, 1fr)",
          padding: "8px 0", borderBottom: "1px solid var(--border)",
        }}>
          {DIAS_SEMANA.map(d => (
            <div key={d} style={{
              textAlign: "center", fontSize: 10, fontWeight: 700,
              letterSpacing: ".06em", color: "var(--text-3)",
            }}>{d}</div>
          ))}
        </div>

        {/* Grid de dias */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
          {cells.map((cell, i) => {
            const isHoje   = cell.iso === hoje;
            const isSel    = cell.iso === diaSel;
            const evs      = eventosPorDia[cell.iso] || [];
            const temEvs   = evs.length > 0;
            const isLast   = (i + 1) % 7 === 0;
            const isLastRow = i >= cells.length - 7;

            return (
              <div
                key={cell.iso}
                onClick={() => setDiaSel(cell.iso)}
                style={{
                  borderRight: isLast ? "none" : "1px solid var(--border)",
                  borderBottom: isLastRow ? "none" : "1px solid var(--border)",
                  padding: mobile ? "6px 2px" : "8px 6px",
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                  cursor: "pointer", transition: "background .1s",
                  background: isSel ? "var(--s2)" : "transparent",
                  minHeight: mobile ? 44 : 64,
                }}
              >
                {/* Número do dia */}
                <div style={{
                  width: mobile ? 24 : 28, height: mobile ? 24 : 28, borderRadius: "50%",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: mobile ? 11 : 13, fontWeight: isHoje || isSel ? 700 : 500,
                  background: isHoje ? "var(--gold)" : "transparent",
                  color: isHoje
                    ? "#0a0808"
                    : cell.outroMes
                      ? "var(--text-3)"
                      : isSel
                        ? "var(--text)"
                        : "var(--text-2)",
                  border: isSel && !isHoje ? "2px solid var(--gold)" : "2px solid transparent",
                  transition: "all .13s",
                }}>
                  {cell.day}
                </div>

                {/* Dots de eventos */}
                {temEvs && !cell.outroMes && (
                  <div style={{ display: "flex", gap: 3, flexWrap: "wrap", justifyContent: "center" }}>
                    {evs.slice(0, 3).map((ev, idx) => {
                      const cor = (resolverEstiloTipo(ev.tipo, categorias)).color;
                      return (
                        <div key={idx} style={{
                          width: 5, height: 5, borderRadius: "50%", background: cor,
                        }} />
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Painel lateral do dia */}
      <PainelDia
        iso={diaSel}
        eventos={evsDiaSel}
        onVerDetalhes={onVerDetalhes}
        onNovo={onNovo}
        categorias={categorias}
        mobile={mobile}
      />
    </div>
  );
}
