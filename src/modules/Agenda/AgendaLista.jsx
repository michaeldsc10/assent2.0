/* ═══════════════════════════════════════════════════
   ASSENT v2.0 — AgendaLista.jsx
   Subcomponente: visualização em lista de eventos
   ═══════════════════════════════════════════════════ */

import { memo } from "react";
import { CheckCircle2, Edit2, Trash2 } from "lucide-react";
import { resolverEstiloTipo, fmtData } from "./Agenda";

/* ── Badge de tipo ── */
function TipoBadge({ tipo, categorias }) {
  const estilo = resolverEstiloTipo(tipo, categorias);
  return (
    <span
      className="ag-badge"
      style={{ background: estilo.bg, color: estilo.color }}
    >
      {tipo || "Outro"}
    </span>
  );
}

/* ── Linha de evento ── */
const EventoRow = memo(function EventoRow({ evento, categorias, onVerDetalhes, onEditar, onConcluir, onExcluir }) {
  const concluido = evento.status === "concluido";

  return (
    <div className={`ag-row ${concluido ? "concluido" : ""}`}>
      {/* Tipo */}
      <TipoBadge tipo={evento.tipo} categorias={categorias} />

      {/* Horário */}
      <span className="ag-horario">{evento.horario || "—"}</span>

      {/* Título — clicável */}
      <span
        className="ag-row-titulo"
        onClick={() => onVerDetalhes(evento)}
        title={evento.titulo}
      >
        {evento.titulo}
      </span>

      {/* Cliente */}
      <span className="ag-overflow" title={evento.cliente}>{evento.cliente || "—"}</span>

      {/* Responsável */}
      <span className="ag-overflow" title={evento.responsavel}>{evento.responsavel || "—"}</span>

      {/* Cód. Venda */}
      <span className="ag-vendaid">{evento.vendaId || "—"}</span>

      {/* Endereço + Obs */}
      <span className="ag-overflow" title={`${evento.endereco || ""} ${evento.observacao || ""}`.trim()}>
        {evento.endereco || evento.observacao || "—"}
      </span>

      {/* Ações */}
      <div className="ag-actions">
        <button
          className="btn-icon btn-icon-done"
          title={concluido ? "Reabrir" : "Concluir"}
          onClick={() => onConcluir(evento)}
        >
          <CheckCircle2 size={13} />
        </button>
        <button
          className="btn-icon btn-icon-edit"
          title="Editar"
          onClick={() => onEditar(evento)}
        >
          <Edit2 size={13} />
        </button>
        <button
          className="btn-icon btn-icon-del"
          title="Excluir"
          onClick={() => onExcluir(evento)}
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
});

/* ══════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL — AgendaLista
   ══════════════════════════════════════════════════════ */
export default function AgendaLista({ eventos, loading, categorias = [], onVerDetalhes, onEditar, onConcluir, onExcluir }) {
  return (
    <div className="ag-lista-wrap">
      <div className="ag-lista-header">
        <span className="ag-lista-title">Eventos</span>
        <span className="ag-count-badge">{eventos.length}</span>
      </div>

      {/* Cabeçalho da tabela */}
      <div className="ag-row-head">
        <span>Tipo</span>
        <span>Horário</span>
        <span>Título</span>
        <span>Cliente</span>
        <span>Responsável</span>
        <span>Venda</span>
        <span>Local / Obs.</span>
        <span style={{ textAlign: "right" }}>Ações</span>
      </div>

      {/* Estados */}
      {loading ? (
        <div className="ag-loading">Carregando eventos...</div>
      ) : eventos.length === 0 ? (
        <div className="ag-empty">
          <div className="ag-empty-icon">📅</div>
          <p>Nenhum evento encontrado para este filtro.</p>
        </div>
      ) : (
        eventos.map(ev => (
          <EventoRow
            key={ev.id}
            evento={ev}
            categorias={categorias}
            onVerDetalhes={onVerDetalhes}
            onEditar={onEditar}
            onConcluir={onConcluir}
            onExcluir={onExcluir}
          />
        ))
      )}
    </div>
  );
}
