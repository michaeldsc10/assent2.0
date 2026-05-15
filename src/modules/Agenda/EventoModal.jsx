/* ═══════════════════════════════════════════════════
   ASSENT v2.0 — EventoModal.jsx
   Modal de detalhes do evento com suporte a impressão
   ═══════════════════════════════════════════════════ */

import { X, Printer, Edit2, CheckCircle2, Calendar, Clock, User, Users, Tag, MapPin, FileText, Info } from "lucide-react";
import { TIPO_ESTILO, fmtData, fmtDataLonga } from "./Agenda";

/* ── Card de detalhe individual ── */
function DetalheCard({ icon: Icon, label, value, valueStyle, fullWidth = false, accent = false }) {
  if (!value && value !== 0) return null;
  return (
    <div style={{
      gridColumn: fullWidth ? "1 / -1" : "span 1",
      background: accent ? "rgba(91,142,240,0.06)" : "var(--bg-2, rgba(255,255,255,0.04))",
      border: `1px solid ${accent ? "rgba(91,142,240,0.2)" : "var(--border, rgba(255,255,255,0.08))"}`,
      borderRadius: 10,
      padding: "12px 14px",
      display: "flex",
      flexDirection: "column",
      gap: 6,
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 6,
        fontSize: 10, fontWeight: 700, textTransform: "uppercase",
        letterSpacing: ".08em", color: "var(--text-3, #777)",
      }}>
        {Icon && <Icon size={11} strokeWidth={2.5} />}
        {label}
      </div>
      <div style={{
        fontSize: 13.5, color: "var(--text-1, #111)",
        fontWeight: 500, lineHeight: 1.5,
        ...valueStyle,
      }}>
        {value}
      </div>
    </div>
  );
}

/* ── Gera o HTML de impressão em nova janela ── */
function abrirJanelaPrint(evento) {
  const estilo = TIPO_ESTILO[evento.tipo] || TIPO_ESTILO["Outro"];

  const linhas = [
    ["calendar", "Data",            fmtDataLonga(evento.data)],
    ["clock",    "Horário",         evento.horario],
    ["user",     "Cliente",         evento.cliente],
    ["users",    "Responsável",     evento.responsavel],
    ["tag",      "Venda vinculada", evento.vendaId],
    ["map-pin",  "Endereço",        evento.endereco],
    ["file",     "Observações",     evento.observacao],
    ["check",    "Status",          evento.status === "concluido" ? "Concluído ✓" : "Pendente"],
    ["info",     "Criado em",       evento.dataCriacao ? new Date(evento.dataCriacao).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" }) : null],
  ].filter(([, , v]) => v);

  const grid = linhas.map(([, l, v]) => `
    <div class="card">
      <div class="card-label">${l}</div>
      <div class="card-value">${v}</div>
    </div>
  `).join("");

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Evento — ${evento.titulo}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@500&display=swap');

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: 'DM Sans', 'Segoe UI', sans-serif;
      color: #111;
      background: #fff;
      padding: 48px;
      max-width: 760px;
      margin: 0 auto;
    }

    /* ── HEADER ── */
    .header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      margin-bottom: 32px;
      padding-bottom: 24px;
      border-bottom: 1.5px solid #e8e8e8;
    }
    .header-left {}
    .app-label {
      font-size: 10px; font-weight: 700; letter-spacing: .1em;
      text-transform: uppercase; color: #aaa; margin-bottom: 10px;
    }
    .titulo {
      font-size: 26px; font-weight: 700; color: #0a0a0a;
      line-height: 1.2; margin-bottom: 10px;
    }
    .badge {
      display: inline-flex; align-items: center; gap: 5px;
      padding: 4px 12px; border-radius: 20px;
      font-size: 11px; font-weight: 600; letter-spacing: .04em;
      background: #f0f4ff; color: #3b6ef0;
      border: 1px solid #d0dcfc;
    }
    .data-destaque {
      font-size: 13px; font-weight: 500; color: #444;
      margin-top: 6px; line-height: 1.6;
    }

    /* ── GRID DE CARDS ── */
    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
    .card {
      background: #fafafa;
      border: 1px solid #ebebeb;
      border-radius: 10px;
      padding: 12px 14px;
    }
    .card.full { grid-column: 1 / -1; }
    .card-label {
      font-size: 10px; font-weight: 700; text-transform: uppercase;
      letter-spacing: .08em; color: #888; margin-bottom: 5px;
    }
    .card-value {
      font-size: 13.5px; font-weight: 500; color: #111; line-height: 1.5;
    }
    .card-value.mono {
      font-family: 'DM Mono', monospace;
      color: #3b6ef0;
    }
    .card-value.status-ok {
      color: #1a9e6b; font-weight: 600;
    }

    /* ── FOOTER ── */
    .footer {
      margin-top: 32px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-top: 16px;
      border-top: 1px solid #ebebeb;
      font-size: 10px; color: #bbb;
    }
    .footer-brand { font-weight: 700; letter-spacing: .06em; text-transform: uppercase; }

    @media print {
      body { padding: 32px; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      <div class="app-label">ASSENT · Agenda de Eventos</div>
      <div class="titulo">${evento.titulo}</div>
      <div class="badge">${evento.tipo || "Outro"}</div>
      <div class="data-destaque">${fmtDataLonga(evento.data)}${evento.horario ? ` · ${evento.horario}` : ""}</div>
    </div>
  </div>

  <div class="grid">
    ${linhas.map(([, l, v], i) => {
      const isMono = l === "Venda vinculada";
      const isStatus = l === "Status";
      const isFull = l === "Observações" || l === "Endereço";
      return `<div class="card${isFull ? " full" : ""}">
        <div class="card-label">${l}</div>
        <div class="card-value${isMono ? " mono" : ""}${isStatus && v.includes("✓") ? " status-ok" : ""}">${v}</div>
      </div>`;
    }).join("")}
  </div>

  <div class="footer">
    <span class="footer-brand">ASSENT</span>
    <span>Impresso em ${new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}</span>
  </div>

  <script>window.onload = () => { window.print(); window.onafterprint = () => window.close(); }<\/script>
</body>
</html>`;

  const win = window.open("", "_blank", "width=800,height=700");
  if (win) {
    win.document.write(html);
    win.document.close();
  }
}

/* ══════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL — EventoModal
   ══════════════════════════════════════════════════════ */
export default function EventoModal({ evento, onClose, onConcluir, onEditar, onExcluir }) {
  if (!evento) return null;

  const estilo    = TIPO_ESTILO[evento.tipo] || TIPO_ESTILO["Outro"];
  const concluido = evento.status === "concluido";

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box modal-box-lg" style={{ overflow: "hidden", padding: 0 }}>

        {/* ── Faixa de cor do tipo no topo ── */}
        <div style={{
          height: 4,
          background: estilo.color,
          opacity: 0.7,
          borderRadius: "12px 12px 0 0",
        }} />

        {/* ── Header ── */}
        <div style={{
          padding: "20px 22px 16px",
          borderBottom: "1px solid var(--border)",
          display: "flex", alignItems: "flex-start", gap: 14,
        }}>
          {/* Badge de tipo + título */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
              <span
                className="ag-badge"
                style={{ background: estilo.bg, color: estilo.color, flexShrink: 0 }}
              >
                {evento.tipo || "Outro"}
              </span>
              {concluido && (
                <span
                  className="ag-badge"
                  style={{ background: "rgba(72,199,142,0.12)", color: "#48c78e" }}
                >
                  ✓ Concluído
                </span>
              )}
            </div>

            {/* Título */}
            <div
              className="modal-title"
              style={{
                fontSize: 19, fontWeight: 700, lineHeight: 1.25,
                textDecoration: concluido ? "line-through" : "none",
                opacity: concluido ? 0.5 : 1,
                marginBottom: 5,
              }}
            >
              {evento.titulo}
            </div>

            {/* Sub — data + hora */}
            <div style={{
              display: "flex", alignItems: "center", gap: 6,
              fontSize: 12.5, color: "var(--text-3, #666)",
            }}>
              <Calendar size={11} strokeWidth={2} />
              <span>{fmtDataLonga(evento.data)}</span>
              {evento.horario && (
                <>
                  <span style={{ opacity: .4 }}>·</span>
                  <Clock size={11} strokeWidth={2} />
                  <span>{evento.horario}</span>
                </>
              )}
            </div>
          </div>

          {/* Botão fechar */}
          <button className="modal-close" onClick={onClose} style={{ flexShrink: 0, marginTop: 2 }}>
            <X size={14} color="var(--text-2)" />
          </button>
        </div>

        {/* ── Body — grid de cards ── */}
        <div style={{
          padding: "16px 22px",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
        }}>
          <DetalheCard icon={Calendar} label="Data"        value={fmtData(evento.data)} />
          <DetalheCard icon={Clock}    label="Horário"     value={evento.horario} />
          <DetalheCard icon={User}     label="Cliente"     value={evento.cliente} />
          <DetalheCard icon={Users}    label="Responsável" value={evento.responsavel} />

          {evento.vendaId && (
            <DetalheCard
              icon={Tag} label="Venda vinculada" value={evento.vendaId}
              accent
              valueStyle={{ color: "#5b8ef0", fontFamily: "'Sora', monospace", fontWeight: 600, letterSpacing: ".02em" }}
            />
          )}

          {evento.endereco && (
            <DetalheCard icon={MapPin} label="Endereço" value={evento.endereco} fullWidth />
          )}

          {evento.observacao && (
            <DetalheCard
              icon={FileText} label="Observações" value={evento.observacao}
              fullWidth
              valueStyle={{ whiteSpace: "pre-wrap", fontSize: 13 }}
            />
          )}

          {evento.dataCriacao && (
            <DetalheCard
              icon={Info} label="Criado em"
              value={new Date(evento.dataCriacao).toLocaleDateString("pt-BR", {
                day: "2-digit", month: "long", year: "numeric",
              })}
              fullWidth
              valueStyle={{ color: "var(--text-3, #666)", fontSize: 12, fontWeight: 400 }}
            />
          )}
        </div>

        {/* ── Footer ── */}
        <div
          className="modal-footer"
          style={{
            justifyContent: "space-between",
            borderTop: "1px solid var(--border)",
            padding: "14px 22px",
            background: "var(--bg-2, rgba(255,255,255,0.02))",
          }}
        >
          {/* Esquerda: Imprimir */}
          <button
            className="btn-secondary"
            style={{ display: "flex", alignItems: "center", gap: 6 }}
            onClick={() => abrirJanelaPrint(evento)}
          >
            <Printer size={13} /> Imprimir
          </button>

          {/* Direita: ações */}
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn-secondary" onClick={onClose}>Fechar</button>
            <button
              className="btn-success"
              style={{ display: "flex", alignItems: "center", gap: 6 }}
              onClick={() => onConcluir(evento)}
            >
              <CheckCircle2 size={13} />
              {concluido ? "Reabrir" : "Concluir"}
            </button>
            <button
              className="btn-primary"
              style={{ display: "flex", alignItems: "center", gap: 6 }}
              onClick={() => onEditar(evento)}
            >
              <Edit2 size={13} /> Editar
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
