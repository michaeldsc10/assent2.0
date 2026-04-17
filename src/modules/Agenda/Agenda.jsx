/* ═══════════════════════════════════════════════════
   ASSENT v2.0 — Agenda.jsx
   Estrutura: users/{uid}/eventos/{id}
   ═══════════════════════════════════════════════════ */

import { useState, useEffect, useMemo, useCallback } from "react";
import { CalendarDays, List, Plus, X, CheckCircle2, Edit2, Trash2 } from "lucide-react";
import { db, auth, onAuthStateChanged } from "../../lib/firebase";
import {
  collection, doc, setDoc, deleteDoc, onSnapshot, updateDoc,
} from "firebase/firestore";
import AgendaLista from "./AgendaLista";
import AgendaCalendario from "./AgendaCalendario";
import EventoModal from "./EventoModal";

/* ── Constantes ── */
export const TIPOS = ["Reunião", "Visita", "Entrega", "Ligação", "Prazo", "Outro"];

export const TIPO_ESTILO = {
  "Reunião": { bg: "rgba(91,142,240,0.14)",  color: "#5b8ef0" },
  "Visita":  { bg: "rgba(72,199,142,0.14)",  color: "#48c78e" },
  "Entrega": { bg: "rgba(200,165,94,0.15)",  color: "var(--gold)" },
  "Ligação": { bg: "rgba(192,132,252,0.14)", color: "#c084fc" },
  "Prazo":   { bg: "rgba(224,82,82,0.14)",   color: "var(--red)" },
  "Outro":   { bg: "rgba(255,255,255,0.06)", color: "var(--text-2)" },
};

/* ── Helpers ── */
export const todayISO = () => new Date().toISOString().slice(0, 10);

export const weekRange = () => {
  const t = new Date(); t.setHours(0, 0, 0, 0);
  const dow = t.getDay();
  const mon = new Date(t); mon.setDate(t.getDate() - (dow === 0 ? 6 : dow - 1));
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  return [mon, sun];
};

export const isThisWeek = (iso) => {
  if (!iso) return false;
  const dt = new Date(iso + "T00:00:00");
  const [mon, sun] = weekRange();
  return dt >= mon && dt <= sun;
};

export const fmtData = (iso) => {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

export const fmtDataLonga = (iso) => {
  if (!iso) return "—";
  return new Date(iso + "T12:00:00").toLocaleDateString("pt-BR", {
    weekday: "long", day: "2-digit", month: "long", year: "numeric",
  });
};

export const sortEventos = (list) =>
  [...list].sort((a, b) =>
    `${a.data || ""}${a.horario || ""}`.localeCompare(`${b.data || ""}${b.horario || ""}`)
  );

/* ── CSS Global do Módulo ── */
const CSS = `
  /* ── Layout ── */
  .ag-page { display: flex; flex-direction: column; height: 100%; overflow: hidden; }
  .ag-topbar {
    padding: 14px 22px;
    background: var(--s1); border-bottom: 1px solid var(--border);
    display: flex; align-items: center; gap: 14px; flex-shrink: 0; flex-wrap: wrap;
  }
  .ag-topbar-title h1 {
    font-family: 'Sora', sans-serif; font-size: 17px; font-weight: 600; color: var(--text);
  }
  .ag-topbar-title p { font-size: 11px; color: var(--text-2); margin-top: 2px; }

  .ag-topbar-right { margin-left: auto; display: flex; align-items: center; gap: 10px; }

  .ag-mode-toggle {
    display: flex; align-items: center; gap: 3px;
    background: var(--s2); border: 1px solid var(--border); border-radius: 8px; padding: 3px;
  }
  .ag-mode-btn {
    display: flex; align-items: center; gap: 6px; padding: 6px 11px; border-radius: 6px;
    border: none; cursor: pointer; font-size: 12px; font-family: 'DM Sans', sans-serif;
    background: transparent; color: var(--text-2); transition: all .13s;
  }
  .ag-mode-btn.active { background: var(--s1); color: var(--text); border: 1px solid var(--border); }

  .btn-novo-evento {
    display: flex; align-items: center; gap: 7px; padding: 8px 16px; border-radius: 9px;
    background: var(--gold); color: #0a0808; border: none; cursor: pointer;
    font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 600;
    white-space: nowrap; transition: opacity .13s;
  }
  .btn-novo-evento:hover { opacity: .88; }

  .ag-content { flex: 1; overflow-y: auto; padding: 20px 22px; display: flex; flex-direction: column; gap: 18px; }
  .ag-content::-webkit-scrollbar { width: 3px; }
  .ag-content::-webkit-scrollbar-thumb { background: var(--text-3); border-radius: 2px; }

  /* ── Resumo ── */
  .ag-resumo { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
  .ag-kpi {
    background: var(--s1); border: 1px solid var(--border); border-radius: 12px; padding: 16px 18px;
    display: flex; flex-direction: column; gap: 6px; transition: border-color .15s;
  }
  .ag-kpi:hover { border-color: var(--border-h); }
  .ag-kpi-label { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: .07em; color: var(--text-3); }
  .ag-kpi-val {
    font-family: 'Sora', sans-serif; font-size: 28px; font-weight: 700; line-height: 1;
  }
  .ag-kpi-sub { font-size: 11px; color: var(--text-3); }

  /* ── Filtros ── */
  .ag-filtros { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .ag-filtros-label { font-size: 11px; color: var(--text-3); margin-right: 4px; }
  .ag-filtro-btn {
    padding: 5px 13px; border-radius: 20px; font-size: 12px; border: 1px solid var(--border);
    background: var(--s2); color: var(--text-2); cursor: pointer;
    font-family: 'DM Sans', sans-serif; transition: all .13s;
  }
  .ag-filtro-btn:hover { background: var(--s1); color: var(--text); }
  .ag-filtro-btn.active {
    background: rgba(200,165,94,0.12); border-color: rgba(200,165,94,.35); color: var(--gold);
    font-weight: 600;
  }

  /* ── Lista ── */
  .ag-lista-wrap {
    background: var(--s1); border: 1px solid var(--border); border-radius: 12px; overflow: hidden;
  }
  .ag-lista-header {
    padding: 12px 18px; border-bottom: 1px solid var(--border);
    display: flex; align-items: center; justify-content: space-between;
  }
  .ag-lista-title {
    font-family: 'Sora', sans-serif; font-size: 12px; font-weight: 600; color: var(--text-2);
  }
  .ag-count-badge {
    font-family: 'Sora', sans-serif; font-size: 12px; font-weight: 600;
    background: var(--s3); border: 1px solid var(--border-h);
    color: var(--text-2); padding: 2px 10px; border-radius: 20px;
  }

  .ag-row-head {
    display: grid;
    grid-template-columns: 82px 68px 1fr 125px 125px 88px 1fr 95px;
    padding: 9px 18px; gap: 10px;
    background: var(--s2); border-bottom: 1px solid var(--border);
    font-size: 10px; font-weight: 500; letter-spacing: .06em;
    text-transform: uppercase; color: var(--text-3);
  }

  .ag-row {
    display: grid;
    grid-template-columns: 82px 68px 1fr 125px 125px 88px 1fr 95px;
    padding: 11px 18px; gap: 10px;
    border-bottom: 1px solid var(--border);
    align-items: center; font-size: 12px; color: var(--text-2);
    transition: background .1s;
  }
  .ag-row:last-child { border-bottom: none; }
  .ag-row:hover { background: rgba(255,255,255,0.02); }
  .ag-row.concluido { opacity: .45; }

  .ag-row-titulo {
    color: var(--text); font-size: 13px; font-weight: 500;
    cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    transition: color .13s;
  }
  .ag-row-titulo:hover { color: var(--gold); text-decoration: underline; }
  .ag-row.concluido .ag-row-titulo { text-decoration: line-through; }

  .ag-overflow { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

  .ag-badge {
    display: inline-flex; align-items: center; padding: 2px 8px;
    border-radius: 20px; font-size: 10px; font-weight: 600; letter-spacing: .04em;
    white-space: nowrap;
  }
  .ag-horario {
    font-family: 'Sora', sans-serif; font-size: 11px; color: var(--gold); font-weight: 500;
  }
  .ag-vendaid { font-size: 11px; color: var(--blue); font-family: 'Sora', sans-serif; }

  .ag-actions { display: flex; align-items: center; gap: 4px; justify-content: flex-end; }

  .ag-empty, .ag-loading { padding: 56px 20px; text-align: center; color: var(--text-3); font-size: 13px; }
  .ag-empty-icon { font-size: 32px; margin-bottom: 10px; }

  /* ── Botões de ação ── */
  .btn-icon {
    width: 28px; height: 28px; border-radius: 7px;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; border: 1px solid transparent;
    background: transparent; transition: all .13s;
  }
  .btn-icon-done  { color: #48c78e; }
  .btn-icon-done:hover  { background: rgba(72,199,142,.15); border-color: rgba(72,199,142,.2); }
  .btn-icon-edit  { color: #5b8ef0; }
  .btn-icon-edit:hover  { background: rgba(91,142,240,.15); border-color: rgba(91,142,240,.2); }
  .btn-icon-del   { color: var(--red); }
  .btn-icon-del:hover   { background: var(--red-d); border-color: rgba(224,82,82,.2); }

  /* ── Calendário ── */
  .ag-cal-wrap {
    background: var(--s1); border: 1px solid var(--border); border-radius: 12px; overflow: hidden;
  }
  .ag-cal-header {
    padding: 14px 18px; border-bottom: 1px solid var(--border);
    display: flex; align-items: center; justify-content: space-between;
  }
  .ag-cal-mes {
    font-family: 'Sora', sans-serif; font-size: 15px; font-weight: 600; color: var(--text);
    text-transform: capitalize;
  }
  .ag-cal-nav { display: flex; gap: 6px; }
  .ag-cal-nav-btn {
    width: 28px; height: 28px; border-radius: 7px;
    background: var(--s2); border: 1px solid var(--border);
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; color: var(--text-2); transition: all .13s;
    font-size: 14px; font-family: monospace;
  }
  .ag-cal-nav-btn:hover { background: var(--s3); color: var(--text); }

  .ag-cal-weekdays {
    display: grid; grid-template-columns: repeat(7, 1fr);
    background: var(--s2); border-bottom: 1px solid var(--border);
    padding: 8px 0;
  }
  .ag-cal-weekday {
    text-align: center; font-size: 10px; font-weight: 600;
    letter-spacing: .06em; text-transform: uppercase; color: var(--text-3);
  }

  .ag-cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); }
  .ag-cal-cell {
    border-right: 1px solid var(--border); border-bottom: 1px solid var(--border);
    min-height: 96px; padding: 6px; display: flex; flex-direction: column; gap: 3px;
  }
  .ag-cal-cell:nth-child(7n) { border-right: none; }

  .ag-cal-day-num {
    font-family: 'Sora', sans-serif; font-size: 12px; font-weight: 600; color: var(--text-3);
    width: 22px; height: 22px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  }
  .ag-cal-cell.outro-mes .ag-cal-day-num { color: rgba(255,255,255,0.12); }
  .ag-cal-cell.hoje .ag-cal-day-num {
    background: var(--gold); color: #0a0808;
  }

  .ag-cal-evento {
    font-size: 10px; padding: 2px 5px; border-radius: 4px;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    cursor: pointer; transition: opacity .1s; font-weight: 500;
  }
  .ag-cal-evento:hover { opacity: .75; }
  .ag-cal-mais {
    font-size: 10px; color: var(--text-3); padding: 1px 5px; cursor: default;
  }

  /* ── Modal ── */
  .modal-overlay {
    position: fixed; inset: 0; z-index: 1000;
    background: rgba(0,0,0,0.78); backdrop-filter: blur(5px);
    display: flex; align-items: center; justify-content: center;
    padding: 20px; animation: agFadeIn .15s ease;
  }
  .modal-overlay-top { z-index: 1100; }

  @keyframes agFadeIn { from { opacity: 0 } to { opacity: 1 } }
  @keyframes agSlideUp {
    from { opacity: 0; transform: translateY(14px) }
    to   { opacity: 1; transform: translateY(0) }
  }

  .modal-box {
    background: var(--s1); border: 1px solid var(--border-h);
    border-radius: 16px; width: 100%; max-width: 540px;
    max-height: 90vh; overflow-y: auto;
    box-shadow: 0 28px 72px rgba(0,0,0,0.65);
    animation: agSlideUp .18s ease;
  }
  .modal-box-lg  { max-width: 660px; }
  .modal-box-md  { max-width: 400px; }
  .modal-box::-webkit-scrollbar { width: 3px; }
  .modal-box::-webkit-scrollbar-thumb { background: var(--text-3); border-radius: 2px; }

  .modal-header {
    padding: 20px 22px 16px; border-bottom: 1px solid var(--border);
    display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;
  }
  .modal-title {
    font-family: 'Sora', sans-serif; font-size: 16px; font-weight: 600; color: var(--text);
  }
  .modal-sub { font-size: 12px; color: var(--text-2); margin-top: 3px; }
  .modal-close {
    width: 30px; height: 30px; border-radius: 8px; flex-shrink: 0;
    background: var(--s3); border: 1px solid var(--border);
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; margin-top: 2px; transition: background .13s;
  }
  .modal-close:hover { background: var(--s2); border-color: var(--border-h); }
  .modal-body   { padding: 20px 22px; }
  .modal-footer {
    padding: 14px 22px; border-top: 1px solid var(--border);
    display: flex; justify-content: flex-end; gap: 10px; flex-wrap: wrap;
  }

  /* Form */
  .form-group { margin-bottom: 16px; }
  .form-label {
    display: block; font-size: 10px; font-weight: 600;
    letter-spacing: .07em; text-transform: uppercase;
    color: var(--text-2); margin-bottom: 7px;
  }
  .form-label-req { color: var(--gold); margin-left: 2px; }
  .form-input {
    width: 100%; background: var(--s2);
    border: 1px solid var(--border); border-radius: 9px;
    padding: 10px 13px; color: var(--text); font-size: 13px;
    font-family: 'DM Sans', sans-serif; outline: none;
    transition: border-color .15s, box-shadow .15s; box-sizing: border-box;
  }
  .form-input:focus { border-color: var(--gold); box-shadow: 0 0 0 3px rgba(200,165,94,0.1); }
  .form-input.err   { border-color: var(--red); }
  .form-input.err:focus { box-shadow: 0 0 0 3px rgba(224,82,82,0.1); }
  .form-textarea { resize: vertical; min-height: 72px; }
  .form-error { font-size: 11px; color: var(--red); margin-top: 5px; }
  .form-row   { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  .form-row-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px; }

  /* Buttons */
  .btn-primary {
    padding: 9px 20px; border-radius: 9px;
    background: var(--gold); color: #0a0808; border: none; cursor: pointer;
    font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 600;
    transition: opacity .13s, transform .1s;
  }
  .btn-primary:hover  { opacity: .88; }
  .btn-primary:active { transform: scale(.97); }
  .btn-primary:disabled { opacity: .5; cursor: default; }

  .btn-secondary {
    padding: 9px 20px; border-radius: 9px;
    background: var(--s3); color: var(--text-2);
    border: 1px solid var(--border); cursor: pointer;
    font-family: 'DM Sans', sans-serif; font-size: 13px;
    transition: background .13s, color .13s;
  }
  .btn-secondary:hover { background: var(--s2); color: var(--text); }

  .btn-danger {
    padding: 9px 20px; border-radius: 9px;
    background: var(--red-d); color: var(--red);
    border: 1px solid rgba(224,82,82,.25); cursor: pointer;
    font-family: 'DM Sans', sans-serif; font-size: 13px;
    transition: background .13s;
  }
  .btn-danger:hover { background: rgba(224,82,82,.18); }
  .btn-danger:disabled { opacity: .5; cursor: default; }

  .btn-success {
    padding: 9px 20px; border-radius: 9px;
    background: rgba(72,199,142,.12); color: #48c78e;
    border: 1px solid rgba(72,199,142,.25); cursor: pointer;
    font-family: 'DM Sans', sans-serif; font-size: 13px;
    transition: background .13s;
  }
  .btn-success:hover { background: rgba(72,199,142,.2); }

  /* Confirm modal */
  .confirm-body { padding: 28px 22px; text-align: center; color: var(--text-2); font-size: 13px; line-height: 1.6; }
  .confirm-icon { font-size: 36px; margin-bottom: 12px; }

  /* ── Print ── */
  @media print {
    .ag-page, .modal-overlay, body > * { display: none !important; }
    .print-evento-root { display: block !important; }
  }
  .print-evento-root { display: none; }

  @media (max-width: 900px) {
    .ag-row-head, .ag-row { grid-template-columns: 75px 60px 1fr 100px 90px; }
    .ag-row > :nth-child(6),
    .ag-row > :nth-child(7),
    .ag-row-head > :nth-child(6),
    .ag-row-head > :nth-child(7) { display: none; }
    .ag-resumo { grid-template-columns: repeat(3, 1fr); }
  }
  @media (max-width: 600px) {
    .ag-row-head { display: none; }
    .ag-row {
      grid-template-columns: auto 1fr auto;
      grid-template-rows: auto auto;
    }
    .ag-resumo { grid-template-columns: 1fr; }
    .form-row, .form-row-3 { grid-template-columns: 1fr; }
  }
`;

/* ══════════════════════════════════════════════════════
   MODAL: Formulário de Evento (Criar / Editar)
   ══════════════════════════════════════════════════════ */
function ModalFormEvento({ evento, onSave, onClose }) {
  const isEdit = !!evento;

  const [form, setForm] = useState({
    titulo:      evento?.titulo      || "",
    tipo:        evento?.tipo        || "Reunião",
    data:        evento?.data        || todayISO(),
    horario:     evento?.horario     || "",
    cliente:     evento?.cliente     || "",
    responsavel: evento?.responsavel || "",
    vendaId:     evento?.vendaId     || "",
    endereco:    evento?.endereco    || "",
    observacao:  evento?.observacao  || "",
  });
  const [erros, setErros] = useState({});
  const [salvando, setSalvando] = useState(false);

  const set = useCallback((campo, valor) => {
    setForm(f => ({ ...f, [campo]: valor }));
    if (erros[campo]) setErros(e => ({ ...e, [campo]: "" }));
  }, [erros]);

  const validar = () => {
    const e = {};
    if (!form.titulo.trim()) e.titulo = "Título é obrigatório.";
    if (!form.data)          e.data   = "Data é obrigatória.";
    if (!form.horario)       e.horario = "Horário é obrigatório.";
    else if (!/^\d{2}:\d{2}$/.test(form.horario)) e.horario = "Horário inválido.";
    setErros(e);
    return Object.keys(e).length === 0;
  };

  const handleSalvar = async () => {
    if (!validar() || salvando) return;
    setSalvando(true);
    await onSave({
      titulo:      form.titulo.trim(),
      tipo:        form.tipo,
      data:        form.data,
      horario:     form.horario,
      cliente:     form.cliente.trim(),
      responsavel: form.responsavel.trim(),
      vendaId:     form.vendaId.trim(),
      endereco:    form.endereco.trim(),
      observacao:  form.observacao.trim(),
    });
    setSalvando(false);
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box modal-box-lg">
        <div className="modal-header">
          <div>
            <div className="modal-title">{isEdit ? "Editar Evento" : "Novo Evento"}</div>
            <div className="modal-sub">
              {isEdit ? `Editando — ${evento.titulo}` : "Preencha os dados do evento"}
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>
            <X size={14} color="var(--text-2)" />
          </button>
        </div>

        <div className="modal-body">

          {/* Título */}
          <div className="form-group">
            <label className="form-label">Título <span className="form-label-req">*</span></label>
            <input
              className={`form-input ${erros.titulo ? "err" : ""}`}
              value={form.titulo}
              onChange={e => set("titulo", e.target.value)}
              placeholder="Nome do evento"
              autoFocus
            />
            {erros.titulo && <div className="form-error">{erros.titulo}</div>}
          </div>

          {/* Tipo + Data + Horário */}
          <div className="form-row-3">
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Tipo</label>
              <select
                className="form-input"
                value={form.tipo}
                onChange={e => set("tipo", e.target.value)}
              >
                {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Data <span className="form-label-req">*</span></label>
              <input
                type="date"
                className={`form-input ${erros.data ? "err" : ""}`}
                value={form.data}
                onChange={e => set("data", e.target.value)}
              />
              {erros.data && <div className="form-error">{erros.data}</div>}
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Horário <span className="form-label-req">*</span></label>
              <input
                type="time"
                className={`form-input ${erros.horario ? "err" : ""}`}
                value={form.horario}
                onChange={e => set("horario", e.target.value)}
              />
              {erros.horario && <div className="form-error">{erros.horario}</div>}
            </div>
          </div>

          <div style={{ marginBottom: 16 }} />

          {/* Cliente + Responsável */}
          <div className="form-row">
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Cliente</label>
              <input
                className="form-input"
                value={form.cliente}
                onChange={e => set("cliente", e.target.value)}
                placeholder="Nome do cliente"
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Responsável</label>
              <input
                className="form-input"
                value={form.responsavel}
                onChange={e => set("responsavel", e.target.value)}
                placeholder="Quem vai atender"
              />
            </div>
          </div>

          <div style={{ marginBottom: 16 }} />

          {/* Venda ID + Endereço */}
          <div className="form-row">
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Cód. da Venda</label>
              <input
                className="form-input"
                value={form.vendaId}
                onChange={e => set("vendaId", e.target.value)}
                placeholder="ex: V0042"
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Endereço</label>
              <input
                className="form-input"
                value={form.endereco}
                onChange={e => set("endereco", e.target.value)}
                placeholder="Rua, número, bairro"
              />
            </div>
          </div>

          <div style={{ marginBottom: 16 }} />

          {/* Observação */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Observação</label>
            <textarea
              className="form-input form-textarea"
              value={form.observacao}
              onChange={e => set("observacao", e.target.value)}
              placeholder="Notas adicionais..."
            />
          </div>

        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" onClick={handleSalvar} disabled={salvando}>
            {salvando ? "Salvando..." : isEdit ? "Salvar Alterações" : "Criar Evento"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   MODAL: Confirmar Exclusão
   ══════════════════════════════════════════════════════ */
function ModalConfirmDelete({ evento, onConfirm, onClose }) {
  const [excluindo, setExcluindo] = useState(false);

  const handleConfirm = async () => {
    setExcluindo(true);
    await onConfirm();
    setExcluindo(false);
  };

  return (
    <div className="modal-overlay modal-overlay-top" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box modal-box-md">
        <div className="modal-header">
          <div className="modal-title">Excluir Evento</div>
          <button className="modal-close" onClick={onClose}>
            <X size={14} color="var(--text-2)" />
          </button>
        </div>
        <div className="confirm-body">
          <div className="confirm-icon">🗑️</div>
          <p>
            Tem certeza que deseja excluir<br />
            <strong>{evento.titulo}</strong>?<br />
            Esta ação não pode ser desfeita.
          </p>
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn-danger" onClick={handleConfirm} disabled={excluindo}>
            {excluindo ? "Excluindo..." : "Confirmar Exclusão"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL — Agenda
   ══════════════════════════════════════════════════════ */
const FILTROS = ["Próximos", "Hoje", "Esta semana", "Todos"];

export default function Agenda() {
  const [uid,      setUid]      = useState(null);
  const [eventos,  setEventos]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [modo,     setModo]     = useState("lista");   // "lista" | "calendario"
  const [filtro,   setFiltro]   = useState("Próximos");

  // Modais
  const [detalhes, setDetalhes] = useState(null);   // EventoModal
  const [formEvt,  setFormEvt]  = useState(null);   // null | "novo" | evento obj
  const [deletando, setDeletando] = useState(null);

  /* ── Auth ── */
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => setUid(u?.uid || null));
    return unsub;
  }, []);

  /* ── Snapshot Firebase ── */
  useEffect(() => {
    if (!uid) { setLoading(false); return; }

    const col = collection(db, "users", uid, "eventos");
    const unsub = onSnapshot(col, snap => {
      const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setEventos(sortEventos(lista));
      setLoading(false);
    }, () => setLoading(false));

    return unsub;
  }, [uid]);

  /* ── Resumo (KPIs) ── */
  const hoje       = todayISO();
  const resumo     = useMemo(() => ({
    hoje:     eventos.filter(e => e.data === hoje).length,
    semana:   eventos.filter(e => isThisWeek(e.data)).length,
    pendentes: eventos.filter(e => e.status !== "concluido").length,
  }), [eventos, hoje]);

  /* ── Filtro de lista ── */
  const eventosFiltrados = useMemo(() => {
    switch (filtro) {
      case "Hoje":       return eventos.filter(e => e.data === hoje);
      case "Esta semana": return eventos.filter(e => isThisWeek(e.data));
      case "Próximos":   return eventos.filter(e => e.data >= hoje);
      default:           return eventos;
    }
  }, [eventos, filtro, hoje]);

  /* ── Handlers Firebase ── */
  const handleAdd = useCallback(async (dados) => {
    if (!uid) return;
    const id = crypto.randomUUID();
    await setDoc(doc(db, "users", uid, "eventos", id), {
      ...dados,
      id,
      status: "pendente",
      dataCriacao: new Date().toISOString(),
    });
    setFormEvt(null);
  }, [uid]);

  const handleEdit = useCallback(async (dados) => {
    if (!uid || !formEvt || formEvt === "novo") return;
    await updateDoc(doc(db, "users", uid, "eventos", formEvt.id), dados);
    setFormEvt(null);
    if (detalhes?.id === formEvt.id) setDetalhes(prev => ({ ...prev, ...dados }));
  }, [uid, formEvt, detalhes]);

  const handleConcluir = useCallback(async (evento) => {
    if (!uid) return;
    const novoStatus = evento.status === "concluido" ? "pendente" : "concluido";
    await updateDoc(doc(db, "users", uid, "eventos", evento.id), { status: novoStatus });
    if (detalhes?.id === evento.id) setDetalhes(prev => ({ ...prev, status: novoStatus }));
  }, [uid, detalhes]);

  const handleExcluir = useCallback(async () => {
    if (!uid || !deletando) return;
    await deleteDoc(doc(db, "users", uid, "eventos", deletando.id));
    if (detalhes?.id === deletando.id) setDetalhes(null);
    setDeletando(null);
  }, [uid, deletando, detalhes]);

  /* ── Render ── */
  if (!uid) return <div className="ag-loading">Carregando autenticação...</div>;

  return (
    <>
      <style>{CSS}</style>

      <div className="ag-page">
        {/* Topbar */}
        <header className="ag-topbar">
          <div className="ag-topbar-title">
            <h1>Agenda</h1>
            <p>Gerencie seus eventos e compromissos</p>
          </div>

          <div className="ag-topbar-right">
            <div className="ag-mode-toggle">
              <button
                className={`ag-mode-btn ${modo === "lista" ? "active" : ""}`}
                onClick={() => setModo("lista")}
              >
                <List size={13} /> Lista
              </button>
              <button
                className={`ag-mode-btn ${modo === "calendario" ? "active" : ""}`}
                onClick={() => setModo("calendario")}
              >
                <CalendarDays size={13} /> Calendário
              </button>
            </div>

            <button className="btn-novo-evento" onClick={() => setFormEvt("novo")}>
              <Plus size={14} /> Novo Evento
            </button>
          </div>
        </header>

        <div className="ag-content">

          {/* KPIs */}
          <div className="ag-resumo">
            <div className="ag-kpi">
              <div className="ag-kpi-label">Hoje</div>
              <div className="ag-kpi-val" style={{ color: "var(--gold)" }}>{resumo.hoje}</div>
              <div className="ag-kpi-sub">evento{resumo.hoje !== 1 ? "s" : ""} hoje</div>
            </div>
            <div className="ag-kpi">
              <div className="ag-kpi-label">Esta Semana</div>
              <div className="ag-kpi-val" style={{ color: "#5b8ef0" }}>{resumo.semana}</div>
              <div className="ag-kpi-sub">evento{resumo.semana !== 1 ? "s" : ""} nesta semana</div>
            </div>
            <div className="ag-kpi">
              <div className="ag-kpi-label">Pendentes</div>
              <div className="ag-kpi-val" style={{ color: "var(--red)" }}>{resumo.pendentes}</div>
              <div className="ag-kpi-sub">aguardando conclusão</div>
            </div>
          </div>

          {/* Filtros (apenas no modo lista) */}
          {modo === "lista" && (
            <div className="ag-filtros">
              <span className="ag-filtros-label">Filtrar:</span>
              {FILTROS.map(f => (
                <button
                  key={f}
                  className={`ag-filtro-btn ${filtro === f ? "active" : ""}`}
                  onClick={() => setFiltro(f)}
                >{f}</button>
              ))}
            </div>
          )}

          {/* Conteúdo principal */}
          {modo === "lista" ? (
            <AgendaLista
              eventos={eventosFiltrados}
              loading={loading}
              onVerDetalhes={setDetalhes}
              onEditar={setFormEvt}
              onConcluir={handleConcluir}
              onExcluir={setDeletando}
            />
          ) : (
            <AgendaCalendario
              eventos={eventos}
              onVerDetalhes={setDetalhes}
            />
          )}

        </div>
      </div>

      {/* Modais */}
      {detalhes && (
        <EventoModal
          evento={detalhes}
          onClose={() => setDetalhes(null)}
          onConcluir={handleConcluir}
          onEditar={(ev) => { setFormEvt(ev); setDetalhes(null); }}
          onExcluir={setDeletando}
        />
      )}

      {formEvt && (
        <ModalFormEvento
          evento={formEvt === "novo" ? null : formEvt}
          onSave={formEvt === "novo" ? handleAdd : handleEdit}
          onClose={() => setFormEvt(null)}
        />
      )}

      {deletando && (
        <ModalConfirmDelete
          evento={deletando}
          onConfirm={handleExcluir}
          onClose={() => setDeletando(null)}
        />
      )}
    </>
  );
}
