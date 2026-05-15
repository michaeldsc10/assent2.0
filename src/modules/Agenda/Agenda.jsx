/* ═══════════════════════════════════════════════════
   ASSENT v2.0 — Agenda.jsx
   Estrutura: users/{uid}/eventos/{id}
   ═══════════════════════════════════════════════════ */

import { useState, useEffect, useMemo, useCallback } from "react";
import { CalendarDays, List, Plus, X, CheckCircle2, Edit2, Trash2, Tag } from "lucide-react";
import { db } from "../../lib/firebase";
import { useAuth } from "../../contexts/AuthContext";
import { logAction, LOG_ACAO, LOG_MODULO, montarDescricao } from "../../lib/logAction";
import {  LIMITES_FREE } from "../../hooks/useLicenca";
import { BannerLimite } from "../../hooks/LicencaUI";
import {
  collection, doc, setDoc, deleteDoc, onSnapshot, updateDoc, getDocs,
} from "firebase/firestore";
import AgendaLista from "./AgendaLista";
import AgendaCalendario from "./AgendaCalendario";
import EventoModal from "./EventoModal";

/* ── Constantes (fallback) ── */
export const TIPOS = ["Reunião", "Visita", "Entrega", "Ligação", "Prazo", "Outro"];

export const TIPO_ESTILO = {
  "Reunião": { bg: "rgba(91,142,240,0.14)",  color: "#5b8ef0" },
  "Visita":  { bg: "rgba(72,199,142,0.14)",  color: "#48c78e" },
  "Entrega": { bg: "rgba(200,165,94,0.15)",  color: "var(--gold)" },
  "Ligação": { bg: "rgba(192,132,252,0.14)", color: "#c084fc" },
  "Prazo":   { bg: "rgba(224,82,82,0.14)",   color: "var(--red)" },
  "Outro":   { bg: "rgba(255,255,255,0.06)", color: "var(--text-2)" },
};

/* ── Helpers de cor ── */
function hexToRgba(hex, alpha) {
  if (!hex || !hex.startsWith("#") || hex.length < 7) return `rgba(255,255,255,${alpha})`;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Resolve estilo visual de um tipo — categorias Firestore têm prioridade */
export function resolverEstiloTipo(tipo, categorias = []) {
  const cat = categorias.find(c => c.nome === tipo);
  if (cat) return { bg: hexToRgba(cat.color, 0.14), color: cat.color };
  return TIPO_ESTILO[tipo] || TIPO_ESTILO["Outro"];
}

/** Lista de nomes de tipos a exibir no select */
export function listaTipos(categorias = []) {
  return categorias.length > 0 ? categorias.map(c => c.nome) : TIPOS;
}

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

  /* ── Gerenciar Categorias ── */
  .cat-lista {
    display: flex; flex-direction: column; gap: 6px;
    max-height: 300px; overflow-y: auto; margin-bottom: 20px;
    padding-right: 4px;
  }
  .cat-lista::-webkit-scrollbar { width: 3px; }
  .cat-lista::-webkit-scrollbar-thumb { background: var(--text-3); border-radius: 2px; }

  .cat-item {
    display: flex; align-items: center; gap: 9px;
    padding: 8px 10px; border-radius: 9px;
    background: var(--s2); border: 1px solid var(--border);
    transition: border-color .13s;
  }
  .cat-item:hover { border-color: var(--border-h); }
  .cat-item.editing { border-color: var(--gold); }

  .cat-swatch {
    width: 26px; height: 26px; border-radius: 6px; flex-shrink: 0;
    border: 1px solid rgba(255,255,255,0.1);
  }
  .cat-nome { flex: 1; font-size: 13px; color: var(--text); font-family: 'DM Sans', sans-serif; }
  .cat-nome-input {
    flex: 1; background: var(--s3); border: 1px solid var(--border-h);
    border-radius: 6px; padding: 4px 8px; color: var(--text);
    font-size: 13px; font-family: 'DM Sans', sans-serif; outline: none;
  }
  .cat-nome-input:focus { border-color: var(--gold); }

  .cat-color-pick {
    -webkit-appearance: none; appearance: none;
    width: 36px; height: 36px; border-radius: 8px;
    border: 1px solid var(--border); cursor: pointer;
    padding: 2px; background: var(--s2); flex-shrink: 0;
  }
  .cat-color-pick::-webkit-color-swatch-wrapper { padding: 0; border-radius: 6px; }
  .cat-color-pick::-webkit-color-swatch { border: none; border-radius: 5px; }

  .cat-add-form {
    display: flex; gap: 8px; align-items: center;
    padding: 12px; background: var(--s2); border: 1px dashed var(--border-h);
    border-radius: 10px;
  }
  .cat-add-form .form-input { margin: 0; flex: 1; }

  .cat-empty {
    text-align: center; padding: 24px; color: var(--text-3);
    font-size: 12px; background: var(--s2); border-radius: 9px;
    border: 1px dashed var(--border); margin-bottom: 16px;
  }

  .cat-section-label {
    font-size: 10px; font-weight: 600; letter-spacing: .07em;
    text-transform: uppercase; color: var(--text-3); margin-bottom: 8px;
  }

  .btn-cat-manage {
    display: flex; align-items: center; gap: 6px; padding: 8px 13px;
    border-radius: 9px; background: var(--s2); color: var(--text-2);
    border: 1px solid var(--border); cursor: pointer;
    font-family: 'DM Sans', sans-serif; font-size: 12px;
    transition: all .13s; white-space: nowrap;
  }
  .btn-cat-manage:hover { background: var(--s1); color: var(--text); border-color: var(--border-h); }

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

    /* Fix scroll iOS */
    .ag-page { overflow: hidden; }
    .ag-content { min-height: 0; overflow-y: auto; -webkit-overflow-scrolling: touch; }

    /* Card mobile:
       col 1 (flex)  | col 2 (ações)
       row1: badge   | ações (span 2 rows)
       row2: horário |
       row3: título  |
    */
    .ag-row {
      display: grid;
      grid-template-columns: 1fr auto;
      grid-template-rows: auto auto auto;
      column-gap: 8px;
      row-gap: 2px;
      padding: 12px 14px;
      cursor: pointer;
      touch-action: manipulation;
      -webkit-tap-highlight-color: rgba(200,165,94,0.06);
      align-items: start;
    }
    /* col 1, row 1: badge (TipoBadge = nth-child 1) */
    .ag-row > :nth-child(1) { grid-column: 1; grid-row: 1; }
    /* col 1, row 2: horário (nth-child 2) */
    .ag-row > :nth-child(2) { grid-column: 1; grid-row: 2; }
    /* col 1, row 3: título (nth-child 3 = ag-row-titulo) */
    .ag-row-titulo          { grid-column: 1; grid-row: 3; white-space: normal; overflow: visible; font-size: 13.5px; pointer-events: none; margin-top: 2px; }
    /* col 2, rows 1-3: ações */
    .ag-actions             { grid-column: 2; grid-row: 1 / 4; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; }
    /* ocultar: cliente, responsável, venda, local */
    .ag-row > :nth-child(4),
    .ag-row > :nth-child(5),
    .ag-row > :nth-child(6),
    .ag-row > :nth-child(7) { display: none; }

    .ag-resumo { grid-template-columns: 1fr; }
    .form-row, .form-row-3 { grid-template-columns: 1fr; }

    /* Modal como bottom-sheet */
    .modal-overlay { align-items: flex-end; padding: 0; }
    .modal-box { border-radius: 16px 16px 0 0; max-width: 100%; max-height: 85vh; }
  }
`;

/* ══════════════════════════════════════════════════════
   MODAL: Formulário de Evento (Criar / Editar)
   ══════════════════════════════════════════════════════ */
function ModalFormEvento({ evento, onSave, onClose, categorias = [] }) {
  const isEdit = !!evento;

  const [form, setForm] = useState({
    titulo:      evento?.titulo      || "",
    tipo:        evento?.tipo        || listaTipos(categorias)[0] || "Reunião",
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
              <label className="form-label">Categoria</label>
              <select
                className="form-input"
                value={form.tipo}
                onChange={e => set("tipo", e.target.value)}
              >
                {listaTipos(categorias).map(t => <option key={t} value={t}>{t}</option>)}
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
   MODAL: Gerenciar Categorias
   ══════════════════════════════════════════════════════ */
const CORES_SUGERIDAS = [
  "#5b8ef0", "#48c78e", "#D4AF37", "#c084fc",
  "#e05252", "#f59e0b", "#06b6d4", "#f97316",
  "#a78bfa", "#34d399", "#fb7185", "#94a3b8",
];

function ModalGerenciarCategorias({ categorias, onAdd, onEdit, onDelete, onClose }) {
  const [editId,    setEditId]    = useState(null);
  const [editNome,  setEditNome]  = useState("");
  const [editColor, setEditColor] = useState("#5b8ef0");
  const [novoNome,  setNovoNome]  = useState("");
  const [novaCor,   setNovaCor]   = useState("#5b8ef0");
  const [salvando,  setSalvando]  = useState(false);
  const [deletId,   setDeletId]   = useState(null);

  const iniciarEdit = (cat) => {
    setEditId(cat.id);
    setEditNome(cat.nome);
    setEditColor(cat.color);
  };
  const cancelEdit = () => { setEditId(null); setEditNome(""); setEditColor("#5b8ef0"); };

  const salvarEdit = async () => {
    const nome = editNome.trim();
    if (!nome) return;
    setSalvando(true);
    await onEdit(editId, { nome, color: editColor });
    cancelEdit();
    setSalvando(false);
  };

  const salvarNova = async () => {
    const nome = novoNome.trim();
    if (!nome) return;
    setSalvando(true);
    await onAdd({ nome, color: novaCor });
    setNovoNome("");
    setNovaCor("#5b8ef0");
    setSalvando(false);
  };

  const confirmarDelete = async (id) => {
    setSalvando(true);
    await onDelete(id);
    setDeletId(null);
    setSalvando(false);
  };

  return (
    <div className="modal-overlay modal-overlay-top" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 480 }}>
        <div className="modal-header">
          <div>
            <div className="modal-title">Categorias de Eventos</div>
            <div className="modal-sub">Crie e personalize os tipos de evento</div>
          </div>
          <button className="modal-close" onClick={onClose}><X size={14} color="var(--text-2)" /></button>
        </div>

        <div className="modal-body">
          {/* Lista */}
          <div className="cat-section-label">Categorias personalizadas</div>

          {categorias.length === 0 ? (
            <div className="cat-empty">
              <Tag size={20} style={{ marginBottom: 8, opacity: .4 }} /><br />
              Nenhuma categoria. Crie abaixo ou use os tipos padrão.
            </div>
          ) : (
            <div className="cat-lista">
              {categorias.map(cat => (
                <div key={cat.id} className={`cat-item${editId === cat.id ? " editing" : ""}`}>
                  {editId === cat.id ? (
                    <>
                      <input
                        type="color"
                        className="cat-color-pick"
                        value={editColor}
                        onChange={e => setEditColor(e.target.value)}
                        title="Cor da categoria"
                      />
                      <input
                        className="cat-nome-input"
                        value={editNome}
                        onChange={e => setEditNome(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") salvarEdit(); if (e.key === "Escape") cancelEdit(); }}
                        autoFocus
                        maxLength={40}
                      />
                      <button
                        className="btn-icon btn-icon-done"
                        title="Salvar"
                        onClick={salvarEdit}
                        disabled={salvando}
                        style={{ color: "#48c78e", border: "1px solid rgba(72,199,142,.25)", background: "rgba(72,199,142,.1)" }}
                      >
                        <CheckCircle2 size={13} />
                      </button>
                      <button className="btn-icon btn-icon-del" title="Cancelar" onClick={cancelEdit}>
                        <X size={13} />
                      </button>
                    </>
                  ) : deletId === cat.id ? (
                    <>
                      <div className="cat-swatch" style={{ background: cat.color }} />
                      <span className="cat-nome" style={{ color: "var(--red)", fontSize: 12 }}>
                        Excluir &ldquo;{cat.nome}&rdquo;?
                      </span>
                      <button
                        className="btn-danger"
                        style={{ padding: "4px 12px", fontSize: 12 }}
                        onClick={() => confirmarDelete(cat.id)}
                        disabled={salvando}
                      >Sim</button>
                      <button
                        className="btn-secondary"
                        style={{ padding: "4px 12px", fontSize: 12 }}
                        onClick={() => setDeletId(null)}
                      >Não</button>
                    </>
                  ) : (
                    <>
                      <div className="cat-swatch" style={{ background: cat.color }} />
                      <span className="cat-nome">{cat.nome}</span>
                      <button className="btn-icon btn-icon-edit" title="Editar" onClick={() => iniciarEdit(cat)}>
                        <Edit2 size={12} />
                      </button>
                      <button className="btn-icon btn-icon-del" title="Excluir" onClick={() => setDeletId(cat.id)}>
                        <Trash2 size={12} />
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Form nova categoria */}
          <div className="cat-section-label" style={{ marginTop: 4 }}>Nova categoria</div>
          <div className="cat-add-form">
            <input
              type="color"
              className="cat-color-pick"
              value={novaCor}
              onChange={e => setNovaCor(e.target.value)}
              title="Cor"
            />
            <input
              className="form-input"
              placeholder="Nome da categoria"
              value={novoNome}
              onChange={e => setNovoNome(e.target.value)}
              onKeyDown={e => e.key === "Enter" && salvarNova()}
              maxLength={40}
            />
            <button
              className="btn-primary"
              style={{ padding: "9px 16px", flexShrink: 0 }}
              onClick={salvarNova}
              disabled={salvando || !novoNome.trim()}
            >
              <Plus size={13} />
            </button>
          </div>

          {/* Cores sugeridas */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 12 }}>
            {CORES_SUGERIDAS.map(c => (
              <div
                key={c}
                onClick={() => {
                  if (editId) setEditColor(c); else setNovaCor(c);
                }}
                title={c}
                style={{
                  width: 22, height: 22, borderRadius: 5, background: c, cursor: "pointer",
                  border: (editId ? editColor : novaCor) === c
                    ? "2px solid var(--text)" : "2px solid transparent",
                  transition: "border .1s",
                }}
              />
            ))}
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Fechar</button>
        </div>
      </div>
    </div>
  );
}


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

export default function Agenda({ isPro = false }) {
  // ── Multi-tenant ──
  const { tenantUid, cargo, nomeUsuario, podeCriar, podeEditar, podeExcluir, isAdmin } = useAuth();

  // ── Flags de permissão ──
  const podeCriarV   = podeCriar("agenda");
  const podeEditarV  = podeEditar("agenda");
  const podeExcluirV = podeExcluir("agenda");

  const [eventos,  setEventos]  = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [modo,     setModo]     = useState("lista");   // "lista" | "calendario"
  const [filtro,   setFiltro]   = useState("Próximos");

  // Modais
  const [detalhes, setDetalhes] = useState(null);   // EventoModal
  const [formEvt,  setFormEvt]  = useState(null);   // null | "novo" | evento obj
  const [deletando, setDeletando] = useState(null);
  const [gerenciarCat, setGerenciarCat] = useState(false);

  useEffect(() => {
    if (!podeCriarV) return;
    const handler = (e) => {
      if (e.key === "n" || e.key === "N") {
        const tag = document.activeElement?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
        e.preventDefault();
        setFormEvt("novo");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [podeCriarV]);

  /* ── Auth ── */

  /* ── Snapshot Firebase ── */
  useEffect(() => {
    if (!tenantUid) { setLoading(false); return; }

    const col = collection(db, "users", tenantUid, "eventos");
    const unsub = onSnapshot(col, snap => {
      const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setEventos(sortEventos(lista));
      setLoading(false);
    }, () => setLoading(false));

    return unsub;
  }, [tenantUid]);

  /* ── Snapshot Categorias ── */
  useEffect(() => {
    if (!tenantUid) return;
    const col = collection(db, "users", tenantUid, "categoriasAgenda");
    const unsub = onSnapshot(col, snap => {
      const lista = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
      setCategorias(lista);
    });
    return unsub;
  }, [tenantUid]);

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

  /* ── Handlers Categorias ── */
  const handleAddCategoria = useCallback(async ({ nome, color }) => {
    if (!tenantUid) return;
    const id = crypto.randomUUID();
    await setDoc(doc(db, "users", tenantUid, "categoriasAgenda", id), {
      id, nome, color,
      ordem: Date.now(),
    });
  }, [tenantUid]);

  const handleEditCategoria = useCallback(async (id, { nome, color }) => {
    if (!tenantUid) return;
    await updateDoc(doc(db, "users", tenantUid, "categoriasAgenda", id), { nome, color });
  }, [tenantUid]);

  const handleDeleteCategoria = useCallback(async (id) => {
    if (!tenantUid) return;
    await deleteDoc(doc(db, "users", tenantUid, "categoriasAgenda", id));
  }, [tenantUid]);

  /* ── Handlers Firebase ── */
  const handleAdd = useCallback(async (dados) => {
    if (!tenantUid) return;
    const id = crypto.randomUUID();
    await setDoc(doc(db, "users", tenantUid, "eventos", id), {
      ...dados,
      id,
      status: "pendente",
      dataCriacao: new Date().toISOString(),
    });
    await logAction({ tenantUid, nomeUsuario, cargo, acao: LOG_ACAO.CRIAR, modulo: LOG_MODULO.AGENDA, descricao: montarDescricao("criar", "Agendamento", dados.titulo || dados.descricao || "Evento", id) });
    setFormEvt(null);
  }, [tenantUid]);

  const handleEdit = useCallback(async (dados) => {
    if (!tenantUid || !formEvt || formEvt === "novo") return;
    await updateDoc(doc(db, "users", tenantUid, "eventos", formEvt.id), dados);
    await logAction({ tenantUid, nomeUsuario, cargo, acao: LOG_ACAO.EDITAR, modulo: LOG_MODULO.AGENDA, descricao: montarDescricao("editar", "Agendamento", dados.titulo || dados.descricao || "Evento", formEvt.id) });
    setFormEvt(null);
    if (detalhes?.id === formEvt.id) setDetalhes(prev => ({ ...prev, ...dados }));
  }, [tenantUid, formEvt, detalhes]);

  const handleConcluir = useCallback(async (evento) => {
    if (!tenantUid) return;
    const novoStatus = evento.status === "concluido" ? "pendente" : "concluido";
    await updateDoc(doc(db, "users", tenantUid, "eventos", evento.id), { status: novoStatus });
    if (detalhes?.id === evento.id) setDetalhes(prev => ({ ...prev, status: novoStatus }));
  }, [tenantUid, detalhes]);

  const handleExcluir = useCallback(async () => {
    if (!tenantUid || !deletando) return;
    await deleteDoc(doc(db, "users", tenantUid, "eventos", deletando.id));
    await logAction({ tenantUid, nomeUsuario, cargo, acao: LOG_ACAO.EXCLUIR, modulo: LOG_MODULO.AGENDA, descricao: montarDescricao("excluir", "Agendamento", deletando.titulo || deletando.descricao || "Evento", deletando.id) });
    if (detalhes?.id === deletando.id) setDetalhes(null);
    setDeletando(null);
  }, [tenantUid, deletando, detalhes]);

  /* ── Render ── */
  if (!tenantUid) return <div className="ag-loading">Carregando autenticação...</div>;

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

            {isAdmin && (
              <button
                className="btn-cat-manage"
                onClick={() => setGerenciarCat(true)}
                title="Gerenciar categorias de eventos"
              >
                <Tag size={13} /> Categorias
              </button>
            )}

            <button
              className="btn-novo-evento"
              onClick={() => setFormEvt("novo")}
              disabled={!podeCriarV || (!isPro && eventos.length >= LIMITES_FREE.eventos)}
              title={!isPro && eventos.length >= LIMITES_FREE.eventos ? `Limite de ${LIMITES_FREE.eventos} eventos atingido no plano Free` : undefined}
            >
              <Plus size={14} /> <span><u>N</u>ovo Evento</span>
            </button>
          </div>
        </header>

        <div className="ag-content">
          <BannerLimite total={eventos.length} limite={LIMITES_FREE.eventos} tipo="eventos na Agenda" isPro={isPro} />

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
              categorias={categorias}
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
          categorias={categorias}
        />
      )}

      {gerenciarCat && (
        <ModalGerenciarCategorias
          categorias={categorias}
          onAdd={handleAddCategoria}
          onEdit={handleEditCategoria}
          onDelete={handleDeleteCategoria}
          onClose={() => setGerenciarCat(false)}
        />
      )}

      {deletando && podeExcluirV && (
        <ModalConfirmDelete
          evento={deletando}
          onConfirm={handleExcluir}
          onClose={() => setDeletando(null)}
        />
      )}
    </>
  );
}
