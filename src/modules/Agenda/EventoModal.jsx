/* ═══════════════════════════════════════════════════
   ASSENT v2.0 — EventoModal.jsx
   Modal de detalhes do evento com suporte a impressão
   ═══════════════════════════════════════════════════ */

import { X, Printer, Edit2, CheckCircle2, Trash2 } from "lucide-react";
import { TIPO_ESTILO, fmtData, fmtDataLonga } from "./Agenda";

/* ── Linha de detalhe ── */
function DetalheRow({ label, value, valueStyle }) {
  if (!value && value !== 0) return null;
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "130px 1fr", gap: "8px",
      padding: "9px 0", borderBottom: "1px solid var(--border)", alignItems: "start",
    }}>
      <span style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--text-3)", paddingTop: 2 }}>
        {label}
      </span>
      <span style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.5, ...valueStyle }}>
        {value}
      </span>
    </div>
  );
}

/* ── Gera o HTML de impressão em nova janela ── */
function abrirJanelaPrint(evento) {
  const estilo = TIPO_ESTILO[evento.tipo] || TIPO_ESTILO["Outro"];

  const linhas = [
    ["Tipo",              evento.tipo],
    ["Data",              fmtDataLonga(evento.data)],
    ["Horário",           evento.horario],
    ["Cliente",           evento.cliente],
    ["Responsável",       evento.responsavel],
    ["Venda vinculada",   evento.vendaId],
    ["Endereço",          evento.endereco],
    ["Observações",       evento.observacao],
    ["Status",            evento.status === "concluido" ? "Concluído" : "Pendente"],
    ["Criado em",         evento.dataCriacao ? new Date(evento.dataCriacao).toLocaleDateString("pt-BR") : null],
  ].filter(([, v]) => v);

  const trs = linhas.map(([l, v]) => `
    <tr>
      <td class="label">${l}</td>
      <td class="value">${v}</td>
    </tr>
  `).join("");

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Evento — ${evento.titulo}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      color: #111; background: #fff; padding: 40px;
    }
    .header { margin-bottom: 28px; border-bottom: 2px solid #111; padding-bottom: 16px; }
    .header-meta { font-size: 11px; color: #666; margin-bottom: 6px; letter-spacing: .04em; }
    .titulo { font-size: 22px; font-weight: 700; }
    .badge {
      display: inline-block; margin-top: 8px;
      padding: 3px 10px; border-radius: 20px;
      font-size: 11px; font-weight: 600;
      background: #f0f0f0; color: #333;
    }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    tr { border-bottom: 1px solid #e5e5e5; }
    td { padding: 10px 8px; font-size: 13px; vertical-align: top; }
    td.label {
      width: 150px; font-weight: 600; color: #555;
      font-size: 11px; text-transform: uppercase; letter-spacing: .04em; padding-top: 12px;
    }
    td.value { color: #111; line-height: 1.5; }
    .footer { margin-top: 32px; font-size: 10px; color: #aaa; text-align: right; }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-meta">ASSENT — Agenda de Eventos</div>
    <div class="titulo">${evento.titulo}</div>
    <div class="badge">${evento.tipo || "Outro"}</div>
  </div>
  <table>
    <tbody>${trs}</tbody>
  </table>
  <div class="footer">Impresso em ${new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}</div>
  <script>window.onload = () => { window.print(); window.onafterprint = () => window.close(); }<\/script>
</body>
</html>`;

  const win = window.open("", "_blank", "width=700,height=600");
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
      <div className="modal-box modal-box-lg">

        {/* Header */}
        <div className="modal-header">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
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
            <div
              className="modal-title"
              style={{
                marginTop: 8,
                textDecoration: concluido ? "line-through" : "none",
                opacity: concluido ? 0.65 : 1,
              }}
            >
              {evento.titulo}
            </div>
            <div className="modal-sub" style={{ marginTop: 4 }}>
              {fmtDataLonga(evento.data)}{evento.horario ? ` às ${evento.horario}` : ""}
            </div>
          </div>
          <button className="modal-close" onClick={onClose} style={{ flexShrink: 0 }}>
            <X size={14} color="var(--text-2)" />
          </button>
        </div>

        {/* Body */}
        <div className="modal-body" style={{ paddingTop: 10, paddingBottom: 10 }}>
          <DetalheRow label="Data"            value={fmtData(evento.data)} />
          <DetalheRow label="Horário"         value={evento.horario} />
          <DetalheRow label="Cliente"         value={evento.cliente} />
          <DetalheRow label="Responsável"     value={evento.responsavel} />
          <DetalheRow
            label="Venda vinculada"
            value={evento.vendaId}
            valueStyle={{ color: "#5b8ef0", fontFamily: "'Sora', sans-serif", fontWeight: 500 }}
          />
          <DetalheRow label="Endereço"        value={evento.endereco} />
          <DetalheRow
            label="Observações"
            value={evento.observacao}
            valueStyle={{ whiteSpace: "pre-wrap" }}
          />
          {evento.dataCriacao && (
            <DetalheRow
              label="Criado em"
              value={new Date(evento.dataCriacao).toLocaleDateString("pt-BR", {
                day: "2-digit", month: "long", year: "numeric",
              })}
              valueStyle={{ color: "var(--text-3)", fontSize: 12 }}
            />
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer" style={{ justifyContent: "space-between" }}>
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
