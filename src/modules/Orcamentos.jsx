/* ═══════════════════════════════════════════════════
   ASSENT v2.0 — Orcamentos.jsx
   Estrutura Firestore:
     users/{uid}/orcamentos/{id}      → cada orçamento
     users/{uid}/orcamentoCnt         → contador sequencial
     users/{uid}/clientes/{id}        → clientes cadastrados
     users/{uid}/produtos/{id}        → catálogo de produtos
     users/{uid}/servicos/{id}        → catálogo de serviços
     users/{uid}/config/geral         → dados da empresa (impressão)
   ═══════════════════════════════════════════════════ */

import { useState, useEffect, useMemo, useRef } from "react";
import {
  Search, Plus, X, Printer, FileText, ShoppingCart,
  Package, ChevronDown, CheckCircle, Clock, AlertTriangle,
  Send, TrendingUp, RefreshCw, User, List, Edit2,
} from "lucide-react";

import { db, auth } from "../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection, doc, setDoc, onSnapshot,
  runTransaction, getDoc, addDoc, Timestamp,
  query, orderBy, getDocs,
} from "firebase/firestore";

/* ══════════════════════════════════════════════════
   CSS
   ══════════════════════════════════════════════════ */
const CSS = `
  /* ── Modal base ── */
  .modal-overlay {
    position: fixed; inset: 0; z-index: 1000;
    background: rgba(0,0,0,0.78);
    backdrop-filter: blur(5px);
    display: flex; align-items: center; justify-content: center;
    padding: 20px; animation: fadeIn .15s ease;
  }
  @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
  @keyframes slideUp {
    from { opacity: 0; transform: translateY(14px) }
    to   { opacity: 1; transform: translateY(0) }
  }
  .modal-box {
    background: var(--s1); border: 1px solid var(--border-h);
    border-radius: 16px; width: 100%; max-width: 520px;
    max-height: 92vh; overflow-y: auto;
    box-shadow: 0 28px 72px rgba(0,0,0,0.65);
    animation: slideUp .18s ease;
  }
  .modal-box-xl  { max-width: 860px; }
  .modal-box-lg  { max-width: 680px; }
  .modal-box-md  { max-width: 440px; }
  .modal-box::-webkit-scrollbar { width: 3px; }
  .modal-box::-webkit-scrollbar-thumb { background: var(--text-3); border-radius: 2px; }

  .modal-header {
    padding: 20px 22px 16px;
    border-bottom: 1px solid var(--border);
    display: flex; align-items: flex-start;
    justify-content: space-between; gap: 12px;
    position: sticky; top: 0;
    background: var(--s1); z-index: 2;
  }
  .modal-title {
    font-family: 'Sora', sans-serif;
    font-size: 16px; font-weight: 600; color: var(--text);
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
    display: flex; justify-content: flex-end; gap: 10px;
    position: sticky; bottom: 0; background: var(--s1); z-index: 2;
  }

  /* ── Buttons ── */
  .btn-primary {
    padding: 9px 20px; border-radius: 9px;
    background: var(--gold); color: #0a0808;
    border: none; cursor: pointer;
    font-family: 'DM Sans', sans-serif;
    font-size: 13px; font-weight: 600;
    transition: opacity .13s, transform .1s;
    display: flex; align-items: center; gap: 6px;
  }
  .btn-primary:hover  { opacity: .88; }
  .btn-primary:active { transform: scale(.97); }
  .btn-primary:disabled { opacity: .5; cursor: not-allowed; }

  .btn-secondary {
    padding: 9px 20px; border-radius: 9px;
    background: var(--s3); color: var(--text-2);
    border: 1px solid var(--border); cursor: pointer;
    font-family: 'DM Sans', sans-serif; font-size: 13px;
    transition: background .13s, color .13s;
    display: flex; align-items: center; gap: 6px;
  }
  .btn-secondary:hover { background: var(--s2); color: var(--text); }

  .btn-green {
    padding: 9px 20px; border-radius: 9px;
    background: rgba(74,222,128,.12); color: var(--green);
    border: 1px solid rgba(74,222,128,.2); cursor: pointer;
    font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 600;
    transition: background .13s;
    display: flex; align-items: center; gap: 6px;
  }
  .btn-green:hover { background: rgba(74,222,128,.2); }
  .btn-green:disabled { opacity: .4; cursor: not-allowed; }

  .btn-icon {
    width: 30px; height: 30px; border-radius: 7px;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; border: 1px solid transparent;
    background: transparent; transition: all .13s;
  }
  .btn-icon-edit { color: var(--blue); }
  .btn-icon-edit:hover { background: var(--blue-d); border-color: rgba(91,142,240,.2); }
  .btn-icon-view { color: var(--text-2); }
  .btn-icon-view:hover { background: var(--s3); border-color: var(--border-h); }

  /* ── Forms ── */
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
    font-family: 'DM Sans', sans-serif;
    outline: none; transition: border-color .15s, box-shadow .15s;
    box-sizing: border-box;
  }
  .form-input:focus { border-color: var(--gold); box-shadow: 0 0 0 3px rgba(200,165,94,0.1); }
  .form-input.err   { border-color: var(--red); }
  .form-error { font-size: 11px; color: var(--red); margin-top: 5px; }
  .form-row   { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  .form-row-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px; }
  .form-section-sep { height: 1px; background: var(--border); margin: 18px 0; }

  /* ── Topbar ── */
  .orc-topbar {
    padding: 14px 22px;
    background: var(--s1); border-bottom: 1px solid var(--border);
    display: flex; align-items: center; gap: 14px; flex-shrink: 0; flex-wrap: wrap;
  }
  .orc-topbar-title h1 {
    font-family: 'Sora', sans-serif; font-size: 17px; font-weight: 600; color: var(--text);
  }
  .orc-topbar-title p { font-size: 11px; color: var(--text-2); margin-top: 2px; }
  .orc-search {
    display: flex; align-items: center; gap: 8px;
    background: var(--s2); border: 1px solid var(--border);
    border-radius: 8px; padding: 8px 12px; width: 270px; flex: 1; min-width: 180px;
  }
  .orc-search input {
    background: transparent; border: none; outline: none;
    color: var(--text); font-size: 12px; width: 100%;
  }
  .orc-topbar-right { display: flex; align-items: center; gap: 8px; margin-left: auto; }

  /* ── Filtros de status ── */
  .orc-filters {
    display: flex; align-items: center; gap: 6px;
    padding: 12px 22px; border-bottom: 1px solid var(--border);
    background: var(--s1); flex-wrap: wrap;
  }
  .orc-filter-btn {
    padding: 5px 13px; border-radius: 20px; font-size: 12px;
    font-family: 'DM Sans', sans-serif; cursor: pointer;
    border: 1px solid var(--border); background: var(--s2); color: var(--text-2);
    transition: all .13s;
  }
  .orc-filter-btn:hover { border-color: var(--border-h); color: var(--text); }
  .orc-filter-btn.active {
    background: var(--gold); color: #0a0808;
    border-color: var(--gold); font-weight: 600;
  }

  /* ── Tabela ── */
  .orc-table-wrap {
    background: var(--s1); border: 1px solid var(--border);
    border-radius: 12px; overflow: hidden;
  }
  .orc-table-header {
    padding: 13px 18px;
    border-bottom: 1px solid var(--border);
    display: flex; align-items: center; justify-content: space-between; gap: 10px;
  }
  .orc-table-title {
    font-family: 'Sora', sans-serif; font-size: 13px; font-weight: 600; color: var(--text);
    display: flex; align-items: center; gap: 8px;
  }
  .orc-count-badge {
    font-family: 'Sora', sans-serif; font-size: 11px; font-weight: 600;
    background: var(--s3); border: 1px solid var(--border-h);
    color: var(--text-2); padding: 2px 9px; border-radius: 20px;
  }

  .orc-row {
    display: grid;
    grid-template-columns: 100px 1fr 110px 120px 120px 100px 90px;
    padding: 11px 18px; gap: 8px;
    border-bottom: 1px solid var(--border);
    align-items: center; font-size: 12px; color: var(--text-2);
    cursor: pointer; transition: background .1s;
  }
  .orc-row:last-child { border-bottom: none; }
  .orc-row:hover { background: rgba(255,255,255,0.025); }
  .orc-row-head { background: var(--s2); cursor: default; }
  .orc-row-head:hover { background: var(--s2); }
  .orc-row-head span {
    font-size: 10px; font-weight: 500; letter-spacing: .06em;
    text-transform: uppercase; color: var(--text-3);
  }

  .orc-codigo { font-family: 'Sora', sans-serif; font-size: 11px; color: var(--gold); font-weight: 600; }
  .orc-cliente { color: var(--text); font-size: 13px; font-weight: 500; }
  .orc-total { font-family: 'Sora', sans-serif; font-size: 12px; font-weight: 600; color: var(--green); }
  .orc-actions { display: flex; align-items: center; gap: 5px; justify-content: flex-end; }
  .orc-empty, .orc-loading { padding: 56px 20px; text-align: center; color: var(--text-3); font-size: 13px; }

  /* ── Status badges ── */
  .orc-status {
    display: inline-flex; align-items: center; gap: 4px;
    padding: 3px 9px; border-radius: 20px; font-size: 10px; font-weight: 600;
    white-space: nowrap;
  }
  .orc-status-rascunho  { background: var(--s3); color: var(--text-3); border: 1px solid var(--border-h); }
  .orc-status-enviado   { background: rgba(91,142,240,.12); color: var(--blue); border: 1px solid rgba(91,142,240,.2); }
  .orc-status-aguardando { background: rgba(200,165,94,.1); color: var(--gold); border: 1px solid rgba(200,165,94,.25); }
  .orc-status-negociacao { background: rgba(200,165,94,.14); color: var(--gold); border: 1px solid rgba(200,165,94,.3); }
  .orc-status-fechado   { background: rgba(74,222,128,.1); color: var(--green); border: 1px solid rgba(74,222,128,.2); }
  .orc-status-perdido   { background: var(--red-d); color: var(--red); border: 1px solid rgba(224,82,82,.2); }
  .orc-status-expirado  { background: rgba(100,100,100,.1); color: var(--text-3); border: 1px solid var(--border); }
  .orc-status-convertido { background: rgba(74,222,128,.15); color: var(--green); border: 1px solid rgba(74,222,128,.3); }

  /* ── Autocomplete ── */
  .nv-autocomplete { position: relative; }
  .nv-ac-list {
    position: absolute; top: 100%; left: 0; right: 0; z-index: 9999;
    background: var(--s1); border: 1px solid var(--border-h);
    border-radius: 9px; max-height: 200px; overflow-y: auto;
    box-shadow: 0 12px 40px rgba(0,0,0,0.5); margin-top: 3px;
  }
  .nv-ac-item {
    padding: 9px 13px; cursor: pointer; font-size: 13px; color: var(--text);
    transition: background .1s; display: flex; align-items: center; justify-content: space-between;
  }
  .nv-ac-item:hover { background: var(--s2); }
  .nv-ac-item-sub { font-size: 11px; color: var(--text-3); }
  .nv-ac-empty { padding: 10px 13px; font-size: 12px; color: var(--text-3); text-align: center; }

  /* ── Itens do orçamento ── */
  .orc-items-header {
    display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;
  }
  .orc-items-label {
    font-size: 10px; font-weight: 600; letter-spacing: .07em;
    text-transform: uppercase; color: var(--text-2);
  }
  .orc-add-item-btn {
    display: flex; align-items: center; gap: 5px;
    padding: 5px 12px; border-radius: 8px; font-size: 12px; font-weight: 600;
    cursor: pointer; border: 1px solid rgba(200,165,94,.3);
    background: rgba(200,165,94,.08); color: var(--gold);
    font-family: 'DM Sans', sans-serif; transition: all .13s;
  }
  .orc-add-item-btn:hover { background: rgba(200,165,94,.14); }

  .orc-item-row {
    display: grid; grid-template-columns: 80px 1fr 70px 110px 110px 32px;
    gap: 8px; align-items: start; margin-bottom: 8px;
    padding: 10px; background: var(--s2); border: 1px solid var(--border);
    border-radius: 10px;
  }
  .orc-item-field-label {
    font-size: 9px; font-weight: 600; letter-spacing: .06em;
    text-transform: uppercase; color: var(--text-3); margin-bottom: 5px;
  }
  .orc-item-remove {
    width: 28px; height: 28px; border-radius: 7px;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; border: 1px solid transparent;
    background: transparent; color: var(--red); margin-top: 14px;
    transition: all .13s;
  }
  .orc-item-remove:hover { background: var(--red-d); border-color: rgba(224,82,82,.2); }

  .orc-totals-bar {
    display: flex; gap: 16px; padding: 12px 14px;
    background: var(--s2); border: 1px solid var(--border);
    border-radius: 10px; margin-top: 14px; flex-wrap: wrap;
  }
  .orc-total-cell { display: flex; flex-direction: column; gap: 2px; }
  .orc-total-label { font-size: 9px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: var(--text-3); }
  .orc-total-val { font-family: 'Sora', sans-serif; font-size: 13px; font-weight: 600; }

  /* ── Cliente manual vs cadastrado ── */
  .orc-cliente-toggle {
    display: flex; gap: 6px; margin-bottom: 14px;
  }
  .orc-toggle-btn {
    display: flex; align-items: center; gap: 5px;
    padding: 6px 14px; border-radius: 8px; font-size: 12px; font-weight: 600;
    cursor: pointer; border: 1px solid var(--border);
    background: var(--s2); color: var(--text-2);
    font-family: 'DM Sans', sans-serif; transition: all .13s;
  }
  .orc-toggle-btn.active {
    background: rgba(200,165,94,.12); border-color: rgba(200,165,94,.3); color: var(--gold);
  }
  .orc-toggle-btn:not(.active):hover { background: var(--s3); color: var(--text); }

  /* ── Item tipo select ── */
  .orc-tipo-select {
    padding: 5px 10px; border-radius: 7px; font-size: 11px; font-weight: 600;
    cursor: pointer; border: 1px solid var(--border);
    background: var(--s3); color: var(--text-2);
    font-family: 'DM Sans', sans-serif;
    outline: none;
  }
  .orc-tipo-select:focus { border-color: var(--gold); }

  /* ── Modal detalhe ── */
  .od-section { margin-bottom: 18px; }
  .od-section-title {
    font-family: 'Sora', sans-serif; font-size: 12px; font-weight: 600;
    color: var(--text-2); margin-bottom: 10px;
    text-transform: uppercase; letter-spacing: .06em;
    display: flex; align-items: center; gap: 6px;
  }
  .od-meta {
    display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px;
  }
  .od-meta-card {
    background: var(--s2); border: 1px solid var(--border);
    border-radius: 10px; padding: 10px 13px;
  }
  .od-meta-label { font-size: 9px; font-weight: 600; letter-spacing: .07em; text-transform: uppercase; color: var(--text-3); margin-bottom: 4px; }
  .od-meta-val { font-size: 13px; color: var(--text); font-weight: 500; }

  .od-table {
    background: var(--s2); border: 1px solid var(--border);
    border-radius: 10px; overflow: hidden; margin-bottom: 14px;
  }
  .od-thead {
    display: grid; grid-template-columns: 1fr 60px 110px 110px;
    padding: 8px 12px; background: var(--s3);
    border-bottom: 1px solid var(--border); gap: 8px;
  }
  .od-thead span {
    font-size: 9px; font-weight: 600; letter-spacing: .06em;
    text-transform: uppercase; color: var(--text-3);
  }
  .od-trow {
    display: grid; grid-template-columns: 1fr 60px 110px 110px;
    padding: 10px 12px; border-bottom: 1px solid var(--border);
    gap: 8px; font-size: 12px; color: var(--text-2); align-items: center;
  }
  .od-trow:last-child { border-bottom: none; }
  .od-item-nome { color: var(--text); font-weight: 500; }

  .od-totals {
    display: flex; gap: 14px; padding: 12px 14px;
    background: var(--s2); border: 1px solid var(--border);
    border-radius: 10px; flex-wrap: wrap;
  }
  .od-total-cell { display: flex; flex-direction: column; gap: 2px; }
  .od-total-label { font-size: 9px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: var(--text-3); }
  .od-total-val { font-family: 'Sora', sans-serif; font-size: 13px; font-weight: 600; }

  .od-interacoes { list-style: none; margin: 0; padding: 0; }
  .od-interacao {
    display: flex; align-items: flex-start; gap: 10px;
    padding: 8px 0; border-bottom: 1px solid var(--border); font-size: 12px;
  }
  .od-interacao:last-child { border-bottom: none; }
  .od-interacao-tipo {
    font-size: 10px; font-weight: 600; letter-spacing: .05em;
    text-transform: uppercase; color: var(--gold); min-width: 90px; padding-top: 1px;
  }
  .od-interacao-desc { color: var(--text-2); flex: 1; }
  .od-interacao-data { color: var(--text-3); font-size: 10px; white-space: nowrap; }

  .od-aviso-conversao {
    background: rgba(91,142,240,.07); border: 1px solid rgba(91,142,240,.2);
    border-radius: 10px; padding: 11px 14px; font-size: 12px; color: var(--text-2);
    margin-bottom: 14px; display: flex; align-items: center; gap: 8px;
  }

  /* ── Layout personalização de impressão ── */
  .orc-layout-colors {
    display: flex; gap: 8px; flex-wrap: wrap;
  }
  .orc-color-option {
    width: 36px; height: 36px; border-radius: 8px;
    cursor: pointer; border: 2px solid transparent;
    transition: all .13s; flex-shrink: 0;
  }
  .orc-color-option.selected { border-color: var(--gold); transform: scale(1.1); }

  .orc-logo-positions {
    display: flex; gap: 6px;
  }
  .orc-pos-btn {
    padding: 5px 12px; border-radius: 7px; font-size: 11px; font-weight: 600;
    cursor: pointer; border: 1px solid var(--border);
    background: var(--s2); color: var(--text-2);
    font-family: 'DM Sans', sans-serif; transition: all .13s;
  }
  .orc-pos-btn.active {
    background: rgba(200,165,94,.12); border-color: rgba(200,165,94,.3); color: var(--gold);
  }

  /* ── Status comercial select ── */
  .orc-sc-select {
    width: 100%; padding: 10px 13px; border-radius: 9px;
    background: var(--s2); border: 1px solid var(--border);
    color: var(--text); font-size: 13px; font-family: 'DM Sans', sans-serif;
    outline: none; transition: border-color .15s;
    cursor: pointer;
  }
  .orc-sc-select:focus { border-color: var(--gold); }

  /* ── Impressão A4 ── */
  @media print {
    body { visibility: hidden !important; }
    #orc-print-root {
      visibility: visible !important;
      display: block !important;
      position: fixed; top: 0; left: 0; width: 100%; z-index: 99999;
    }
    #orc-print-root * { visibility: visible !important; }
  }
  #orc-print-root { display: none; }
`;

/* ══════════════════════════════════════════════════
   HELPERS
   ══════════════════════════════════════════════════ */
const fmtR$ = (v) =>
  `R$ ${Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

const fmtData = (d) => {
  if (!d) return "—";
  try {
    const dt = d?.toDate ? d.toDate() : new Date(d);
    return dt.toLocaleDateString("pt-BR");
  } catch { return String(d); }
};

const gerarCodigo = (cnt) => `ORC-${String(cnt + 1).padStart(4, "0")}`;

const CORES_HEADER = [
  { bg: "#000000", text: "#FFFFFF" },
  { bg: "#FFFFFF", text: "#000000" },
  { bg: "#1E40AF", text: "#FFFFFF" },
  { bg: "#059669", text: "#FFFFFF" },
];

const STATUS_COMERCIAL_LABELS = {
  rascunho:           "Rascunho",
  enviado:            "Enviado",
  aguardando_resposta:"Aguardando",
  negociacao:         "Em negociação",
  fechado:            "Fechado",
  perdido:            "Perdido",
};

const STATUS_SISTEMA_CLASS = {
  ativo:      "orc-status-enviado",
  expirado:   "orc-status-expirado",
  convertido: "orc-status-convertido",
};

const STATUS_COMERCIAL_CLASS = {
  rascunho:           "orc-status-rascunho",
  enviado:            "orc-status-enviado",
  aguardando_resposta:"orc-status-aguardando",
  negociacao:         "orc-status-negociacao",
  fechado:            "orc-status-fechado",
  perdido:            "orc-status-perdido",
};

const FILTROS = ["Todos", "Rascunho", "Enviado", "Aguardando", "Negociação", "Fechado", "Perdido", "Expirado", "Convertido"];

/* Mapeia label do filtro → chave de status */
const filtroParaStatus = (f) => {
  const map = {
    "Todos": null,
    "Rascunho": { sc: "rascunho" },
    "Enviado": { sc: "enviado" },
    "Aguardando": { sc: "aguardando_resposta" },
    "Negociação": { sc: "negociacao" },
    "Fechado": { sc: "fechado" },
    "Perdido": { sc: "perdido" },
    "Expirado": { ss: "expirado" },
    "Convertido": { ss: "convertido" },
  };
  return map[f] ?? null;
};

/* Verifica e marca expirado */
const statusSistemaAtual = (orc) => {
  if (orc.statusSistema === "convertido") return "convertido";
  if (orc.statusSistema === "expirado") return "expirado";
  if (orc.datas?.validade) {
    const val = orc.datas.validade?.toDate ? orc.datas.validade.toDate() : new Date(orc.datas.validade);
    if (val < new Date()) return "expirado";
  }
  return "ativo";
};

/* ── Impressão A4 ── */
function imprimirOrcamento(orc, config) {
  const el = document.getElementById("orc-print-root");
  if (!el) return;

  const cor = orc.configuracaoLayout || { corHeader: "#000000", corTextoHeader: "#FFFFFF", posicaoLogo: "esquerda" };
  const empresa = config || {};
  const logoAlign = cor.posicaoLogo === "centro" ? "center" : cor.posicaoLogo === "direita" ? "right" : "left";
  const validade = orc.datas?.validade
    ? (orc.datas.validade?.toDate ? orc.datas.validade.toDate() : new Date(orc.datas.validade))
      .toLocaleDateString("pt-BR")
    : "—";

  const itens = orc.itens || [];
  const total = orc.resumoFinanceiro?.totalFinal || 0;
  const subtotal = orc.resumoFinanceiro?.subtotal || 0;
  const descontos = orc.resumoFinanceiro?.descontos || 0;
  const acrescimos = orc.resumoFinanceiro?.acrescimos || 0;

  el.innerHTML = `
    <div style="font-family:'Arial',sans-serif;width:210mm;min-height:297mm;margin:0 auto;padding:12mm;box-sizing:border-box;background:#fff;color:#000;font-size:12px;">

      <!-- Cabeçalho -->
      <div style="background:${cor.corHeader};color:${cor.corTextoHeader};border-radius:8px;padding:16px 20px;margin-bottom:16px;display:flex;align-items:center;justify-content:space-between;">
        ${empresa.logo ? `<img src="${empresa.logo}" style="height:48px;object-fit:contain;" />` : ""}
        <div style="text-align:${logoAlign};flex:1;">
          <div style="font-size:20px;font-weight:700;">${empresa.nome || "ASSENT"}</div>
          ${empresa.cnpj ? `<div style="font-size:11px;opacity:.8;">CNPJ: ${empresa.cnpj}</div>` : ""}
          ${empresa.endereco ? `<div style="font-size:11px;opacity:.8;">${empresa.endereco}</div>` : ""}
          ${empresa.telefone ? `<div style="font-size:11px;opacity:.8;">Tel: ${empresa.telefone}</div>` : ""}
        </div>
        <div style="text-align:right;">
          <div style="font-size:22px;font-weight:700;">ORÇAMENTO</div>
          <div style="font-size:14px;font-weight:600;">${orc.codigo || orc.id}</div>
          <div style="font-size:11px;opacity:.8;">Emitido em: ${fmtData(orc.datas?.criacao)}</div>
        </div>
      </div>

      <!-- Dados do cliente -->
      <div style="border:1px solid #e5e7eb;border-radius:8px;padding:14px 16px;margin-bottom:14px;">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#6b7280;margin-bottom:8px;">Cliente</div>
        <div style="font-size:14px;font-weight:600;">${orc.cliente?.nome || "—"}</div>
        ${orc.cliente?.telefone ? `<div style="color:#6b7280;font-size:12px;">Tel: ${orc.cliente.telefone}</div>` : ""}
      </div>

      <!-- Itens -->
      <table style="width:100%;border-collapse:collapse;margin-bottom:14px;">
        <thead>
          <tr style="background:#f9fafb;">
            <th style="text-align:left;padding:8px 10px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#6b7280;border-bottom:1px solid #e5e7eb;">Item</th>
            <th style="text-align:center;padding:8px 10px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#6b7280;border-bottom:1px solid #e5e7eb;width:60px;">Qtd</th>
            <th style="text-align:right;padding:8px 10px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#6b7280;border-bottom:1px solid #e5e7eb;width:120px;">Unit.</th>
            <th style="text-align:right;padding:8px 10px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#6b7280;border-bottom:1px solid #e5e7eb;width:130px;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${itens.map((item, i) => `
            <tr style="border-bottom:1px solid #f3f4f6;background:${i % 2 === 0 ? "#fff" : "#fafafa"};">
              <td style="padding:9px 10px;">
                <div style="font-weight:500;">${item.nome || "—"}</div>
                <div style="font-size:10px;color:#9ca3af;text-transform:uppercase;">${item.tipo}</div>
              </td>
              <td style="padding:9px 10px;text-align:center;">${item.quantidade}</td>
              <td style="padding:9px 10px;text-align:right;">${fmtR$(item.valorUnitario)}</td>
              <td style="padding:9px 10px;text-align:right;font-weight:600;">${fmtR$(item.valorTotal)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>

      ${orc.descricaoLivre ? `
        <div style="border:1px solid #e5e7eb;border-radius:6px;padding:10px 14px;margin-bottom:14px;font-size:12px;color:#4b5563;">
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#6b7280;margin-bottom:4px;">Observações</div>
          ${orc.descricaoLivre}
        </div>
      ` : ""}

      <!-- Totais -->
      <div style="display:flex;justify-content:flex-end;margin-bottom:20px;">
        <div style="width:260px;">
          ${subtotal !== total ? `
          <div style="display:flex;justify-content:space-between;padding:5px 0;font-size:12px;color:#6b7280;">
            <span>Subtotal</span><span>${fmtR$(subtotal)}</span>
          </div>` : ""}
          ${descontos > 0 ? `
          <div style="display:flex;justify-content:space-between;padding:5px 0;font-size:12px;color:#ef4444;">
            <span>Descontos</span><span>- ${fmtR$(descontos)}</span>
          </div>` : ""}
          ${acrescimos > 0 ? `
          <div style="display:flex;justify-content:space-between;padding:5px 0;font-size:12px;color:#059669;">
            <span>Acréscimos</span><span>+ ${fmtR$(acrescimos)}</span>
          </div>` : ""}
          <div style="display:flex;justify-content:space-between;padding:8px 0;font-size:16px;font-weight:700;border-top:2px solid #000;margin-top:4px;">
            <span>TOTAL</span><span>${fmtR$(total)}</span>
          </div>
        </div>
      </div>

      <!-- Validade e assinatura -->
      <div style="display:flex;justify-content:space-between;align-items:flex-end;border-top:1px solid #e5e7eb;padding-top:16px;margin-top:auto;">
        <div>
          <div style="font-size:11px;color:#9ca3af;margin-bottom:4px;">Validade do orçamento</div>
          <div style="font-size:14px;font-weight:600;">${validade}</div>
        </div>
        <div style="text-align:center;min-width:200px;">
          <div style="border-top:1px solid #000;padding-top:6px;font-size:11px;color:#6b7280;">Assinatura do cliente</div>
        </div>
      </div>

      <div style="text-align:center;font-size:10px;color:#9ca3af;margin-top:14px;">
        ${empresa.nome || "ASSENT"} — Orçamento gerado via ASSENT v2.0
      </div>
    </div>
  `;

  window.print();
}

/* ══════════════════════════════════════════════════
   MODAL: Status comercial
   ══════════════════════════════════════════════════ */
function ModalStatusComercial({ orc, uid, onClose, onUpdate }) {
  const [status, setStatus] = useState(orc.statusComercial || "rascunho");
  const [salvando, setSalvando] = useState(false);

  const handleSalvar = async () => {
    setSalvando(true);
    try {
      const ref = doc(db, "users", uid, "orcamentos", orc.id);
      const interacao = {
        tipo: "edicao",
        descricao: `Status comercial alterado para "${STATUS_COMERCIAL_LABELS[status]}"`,
        data: Timestamp.now(),
      };
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        const interacoes = snap.data()?.interacoes || [];
        tx.update(ref, {
          statusComercial: status,
          interacoes: [...interacoes, interacao],
        });
      });
      onUpdate();
      onClose();
    } catch (err) {
      console.error(err);
      alert("Erro ao atualizar status.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="modal-overlay modal-overlay-top" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box modal-box-md">
        <div className="modal-header">
          <div>
            <div className="modal-title">Status Comercial</div>
            <div className="modal-sub">{orc.codigo}</div>
          </div>
          <button className="modal-close" onClick={onClose}><X size={14} color="var(--text-2)" /></button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Etapa do Pipeline</label>
            <select className="orc-sc-select" value={status} onChange={e => setStatus(e.target.value)}>
              <option value="rascunho">Rascunho</option>
              <option value="enviado">Enviado</option>
              <option value="aguardando_resposta">Aguardando Resposta</option>
              <option value="negociacao">Em Negociação</option>
              <option value="fechado">Fechado</option>
              <option value="perdido">Perdido</option>
            </select>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" onClick={handleSalvar} disabled={salvando}>
            {salvando ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════
   MODAL: Detalhe do orçamento
   ══════════════════════════════════════════════════ */
function ModalDetalheOrcamento({ orc, uid, config, onClose, onEditar, onConverterVenda }) {
  const [convertendo, setConvertendo] = useState(false);
  const [statusModal, setStatusModal] = useState(false);
  const [orcAtual, setOrcAtual] = useState(orc);

  const ss = statusSistemaAtual(orcAtual);
  const podeConverter = orcAtual.cliente?.id && ss !== "convertido";
  const jáConvertido  = ss === "convertido";

  const handleImprimir = () => imprimirOrcamento(orcAtual, config);

  const handleConverter = async () => {
    if (!podeConverter) return;
    if (!window.confirm(`Converter ${orcAtual.codigo} em venda? Esta ação não pode ser desfeita.`)) return;
    setConvertendo(true);
    try {
      await onConverterVenda(orcAtual);
      onClose();
    } catch (err) {
      console.error(err);
      alert("Erro ao converter em venda: " + err.message);
    } finally {
      setConvertendo(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box modal-box-xl">

        <div className="modal-header">
          <div>
            <div className="modal-title" style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {orcAtual.codigo}
              <span className={`orc-status ${STATUS_COMERCIAL_CLASS[orcAtual.statusComercial]}`}>
                {STATUS_COMERCIAL_LABELS[orcAtual.statusComercial] || orcAtual.statusComercial}
              </span>
              <span className={`orc-status ${STATUS_SISTEMA_CLASS[ss] || "orc-status-rascunho"}`}>
                {ss.charAt(0).toUpperCase() + ss.slice(1)}
              </span>
            </div>
            <div className="modal-sub">
              Criado em {fmtData(orcAtual.datas?.criacao)} · Válido até {fmtData(orcAtual.datas?.validade)}
            </div>
          </div>
          <button className="modal-close" onClick={onClose}><X size={14} color="var(--text-2)" /></button>
        </div>

        <div className="modal-body">

          {/* Aviso de conversão */}
          {jáConvertido && (
            <div className="od-aviso-conversao">
              <CheckCircle size={14} color="var(--green)" />
              <span>Este orçamento foi convertido em venda em {fmtData(orcAtual.conversao?.dataConversao)}.</span>
            </div>
          )}
          {!orcAtual.cliente?.id && !jáConvertido && (
            <div className="od-aviso-conversao" style={{ borderColor: "rgba(200,165,94,.3)", background: "rgba(200,165,94,.07)" }}>
              <AlertTriangle size={14} color="var(--gold)" />
              <span>Para converter em venda, o cliente precisa estar <strong>cadastrado no sistema</strong>.</span>
            </div>
          )}

          {/* Dados do cliente */}
          <div className="od-section">
            <div className="od-section-title"><User size={12} /> Cliente</div>
            <div className="od-meta">
              <div className="od-meta-card">
                <div className="od-meta-label">Nome</div>
                <div className="od-meta-val">{orcAtual.cliente?.nome || "—"}</div>
              </div>
              <div className="od-meta-card">
                <div className="od-meta-label">Telefone</div>
                <div className="od-meta-val">{orcAtual.cliente?.telefone || "—"}</div>
              </div>
              <div className="od-meta-card">
                <div className="od-meta-label">Origem</div>
                <div className="od-meta-val">
                  {orcAtual.cliente?.origem === "cadastrado" ? "✅ Cadastrado" : "✏️ Manual"}
                </div>
              </div>
            </div>
          </div>

          {/* Itens */}
          <div className="od-section">
            <div className="od-section-title"><List size={12} /> Itens</div>
            <div className="od-table">
              <div className="od-thead">
                <span>Item</span>
                <span>Qtd</span>
                <span>Unit.</span>
                <span>Total</span>
              </div>
              {(orcAtual.itens || []).map((item, i) => (
                <div className="od-trow" key={i}>
                  <span className="od-item-nome">
                    {item.nome}
                    <span style={{ fontSize: 9, color: "var(--text-3)", marginLeft: 6, textTransform: "uppercase" }}>{item.tipo}</span>
                  </span>
                  <span>{item.quantidade}</span>
                  <span>{fmtR$(item.valorUnitario)}</span>
                  <span style={{ color: "var(--green)", fontWeight: 600 }}>{fmtR$(item.valorTotal)}</span>
                </div>
              ))}
            </div>

            {orcAtual.descricaoLivre && (
              <div style={{ background: "var(--s2)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 13px", fontSize: 12, color: "var(--text-2)" }}>
                <div className="od-meta-label" style={{ marginBottom: 4 }}>Observações</div>
                {orcAtual.descricaoLivre}
              </div>
            )}
          </div>

          {/* Resumo financeiro */}
          <div className="od-section">
            <div className="od-section-title">💰 Resumo Financeiro</div>
            <div className="od-totals">
              <div className="od-total-cell">
                <span className="od-total-label">Subtotal</span>
                <span className="od-total-val">{fmtR$(orcAtual.resumoFinanceiro?.subtotal)}</span>
              </div>
              {orcAtual.resumoFinanceiro?.descontos > 0 && (
                <div className="od-total-cell">
                  <span className="od-total-label">Descontos</span>
                  <span className="od-total-val" style={{ color: "var(--red)" }}>-{fmtR$(orcAtual.resumoFinanceiro.descontos)}</span>
                </div>
              )}
              {orcAtual.resumoFinanceiro?.acrescimos > 0 && (
                <div className="od-total-cell">
                  <span className="od-total-label">Acréscimos</span>
                  <span className="od-total-val" style={{ color: "var(--green)" }}>+{fmtR$(orcAtual.resumoFinanceiro.acrescimos)}</span>
                </div>
              )}
              <div className="od-total-cell" style={{ marginLeft: "auto" }}>
                <span className="od-total-label">Total Final</span>
                <span className="od-total-val" style={{ color: "var(--green)", fontSize: 16 }}>{fmtR$(orcAtual.resumoFinanceiro?.totalFinal)}</span>
              </div>
            </div>
          </div>

          {/* Histórico de interações */}
          {(orcAtual.interacoes || []).length > 0 && (
            <div className="od-section">
              <div className="od-section-title"><Clock size={12} /> Histórico</div>
              <ul className="od-interacoes">
                {[...(orcAtual.interacoes || [])].reverse().map((int, i) => (
                  <li className="od-interacao" key={i}>
                    <span className="od-interacao-tipo">{int.tipo}</span>
                    <span className="od-interacao-desc">{int.descricao}</span>
                    <span className="od-interacao-data">{fmtData(int.data)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="modal-footer" style={{ flexWrap: "wrap", gap: 8 }}>
          <button className="btn-secondary" onClick={() => setStatusModal(true)} style={{ marginRight: "auto" }}>
            <TrendingUp size={13} /> Pipeline
          </button>
          <button className="btn-secondary" onClick={handleImprimir}>
            <Printer size={13} /> Imprimir
          </button>
          {!jáConvertido && (
            <button className="btn-secondary" onClick={() => onEditar(orcAtual)}>
              <Edit2 size={13} /> Editar
            </button>
          )}
          <button
            className="btn-green"
            onClick={handleConverter}
            disabled={!podeConverter || convertendo || jáConvertido}
            title={!orcAtual.cliente?.id ? "Cliente deve ser cadastrado" : ""}
          >
            <RefreshCw size={13} />
            {convertendo ? "Convertendo..." : jáConvertido ? "Já convertido" : "Converter em Venda"}
          </button>
        </div>
      </div>

      {statusModal && (
        <ModalStatusComercial
          orc={orcAtual}
          uid={uid}
          onClose={() => setStatusModal(false)}
          onUpdate={() => {
            /* Refetch local */
            getDoc(doc(db, "users", uid, "orcamentos", orcAtual.id)).then(snap => {
              if (snap.exists()) setOrcAtual({ id: snap.id, ...snap.data() });
            });
          }}
        />
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════
   MODAL: Novo / Editar Orçamento
   ══════════════════════════════════════════════════ */
function ModalNovoOrcamento({ orc, uid, clientes, produtos, servicos, onSave, onClose }) {
  const isEdit = !!orc;

  /* ── Cliente ── */
  const [clienteOrigem, setClienteOrigem] = useState(
    orc?.cliente?.origem || "manual"
  );
  const [clienteId, setClienteId]     = useState(orc?.cliente?.id || null);
  const [clienteNome, setClienteNome] = useState(orc?.cliente?.nome || "");
  const [clienteTel, setClienteTel]   = useState(orc?.cliente?.telefone || "");
  const [clienteSearch, setClienteSearch] = useState(orc?.cliente?.nome || "");
  const [clienteAC, setClienteAC]     = useState(false);

  /* ── Itens ── */
  const itemVazio = () => ({
    tipo: "produto",
    idRef: "",
    nome: "",
    quantidade: 1,
    valorUnitario: 0,
    valorTotal: 0,
    origem: "manual",
  });

  const [itens, setItens] = useState(
    orc?.itens?.length ? orc.itens.map(i => ({ ...itemVazio(), ...i })) : [itemVazio()]
  );
  const [itemSearches, setItemSearches] = useState(
    orc?.itens?.length ? orc.itens.map(i => i.nome || "") : [""]
  );
  const [itemAC, setItemAC] = useState(null);

  /* ── Extra ── */
  const [descricaoLivre, setDescricaoLivre] = useState(orc?.descricaoLivre || "");
  const [descontos, setDescontos]           = useState(orc?.resumoFinanceiro?.descontos || 0);
  const [acrescimos, setAcrescimos]         = useState(orc?.resumoFinanceiro?.acrescimos || 0);
  const [statusComercial, setStatusComercial] = useState(orc?.statusComercial || "rascunho");

  /* ── Layout impressão ── */
  const [layoutCor, setLayoutCor]       = useState(orc?.configuracaoLayout?.corHeader || "#000000");
  const [layoutCorTxt, setLayoutCorTxt] = useState(orc?.configuracaoLayout?.corTextoHeader || "#FFFFFF");
  const [layoutLogo, setLayoutLogo]     = useState(orc?.configuracaoLayout?.posicaoLogo || "esquerda");

  const [salvando, setSalvando]   = useState(false);
  const [erros, setErros]         = useState({});

  /* ── Filtros autocomplete cliente ── */
  const clientesFiltrados = useMemo(() => {
    if (!clienteSearch.trim()) return clientes.slice(0, 6);
    const q = clienteSearch.toLowerCase();
    return clientes.filter(c =>
      c.nome?.toLowerCase().includes(q) || c.telefone?.toLowerCase().includes(q)
    ).slice(0, 6);
  }, [clientes, clienteSearch]);

  const selecionarCliente = (c) => {
    setClienteId(c.id);
    setClienteNome(c.nome);
    setClienteTel(c.telefone || "");
    setClienteSearch(c.nome);
    setClienteAC(false);
  };

  /* ── Autocomplete itens ── */
  const catalogoFiltrado = (search, tipoItem) => {
    const lista = tipoItem === "servico" ? servicos : produtos;
    if (!search.trim()) return lista.slice(0, 8);
    const q = search.toLowerCase();
    return lista.filter(p => p.nome?.toLowerCase().includes(q)).slice(0, 8);
  };

  const selecionarCatalogoItem = (idx, prod, tipoItem) => {
    const novo = [...itens];
    novo[idx] = {
      ...novo[idx],
      idRef: prod.id,
      nome: prod.nome,
      valorUnitario: prod.preco || 0,
      valorTotal: (prod.preco || 0) * (novo[idx].quantidade || 1),
      origem: "catalogo",
      tipo: tipoItem,
    };
    setItens(novo);
    const ns = [...itemSearches];
    ns[idx] = prod.nome;
    setItemSearches(ns);
    setItemAC(null);
  };

  const atualizarItem = (idx, campo, valor) => {
    const novo = [...itens];
    novo[idx] = { ...novo[idx], [campo]: valor };
    if (campo === "quantidade" || campo === "valorUnitario") {
      novo[idx].valorTotal =
        (parseFloat(campo === "valorUnitario" ? valor : novo[idx].valorUnitario) || 0) *
        (parseInt(campo === "quantidade" ? valor : novo[idx].quantidade) || 1);
    }
    setItens(novo);
  };

  const adicionarItem = () => {
    setItens([...itens, itemVazio()]);
    setItemSearches([...itemSearches, ""]);
  };

  const removerItem = (idx) => {
    if (itens.length === 1) return;
    setItens(itens.filter((_, i) => i !== idx));
    setItemSearches(itemSearches.filter((_, i) => i !== idx));
  };

  /* ── Cálculos ── */
  const calculos = useMemo(() => {
    const subtotal = itens.reduce((s, i) => s + (parseFloat(i.valorTotal) || 0), 0);
    const desc = parseFloat(descontos) || 0;
    const acr  = parseFloat(acrescimos) || 0;
    const total = subtotal - desc + acr;
    return { subtotal, descontos: desc, acrescimos: acr, totalFinal: Math.max(0, total) };
  }, [itens, descontos, acrescimos]);

  /* ── Validação ── */
  const validar = () => {
    const e = {};
    const nome = clienteOrigem === "cadastrado" ? clienteSearch : clienteNome;
    if (!nome.trim()) e.clienteNome = "Informe o nome do cliente.";
    if (clienteOrigem === "manual" && !clienteTel.trim()) e.clienteTel = "Informe o telefone.";
    const itensValidos = itens.filter(i => i.nome.trim() && i.valorUnitario > 0);
    if (itensValidos.length === 0) e.itens = "Adicione ao menos um item válido.";
    setErros(e);
    return Object.keys(e).length === 0;
  };

  const handleSalvar = async () => {
    if (!validar()) return;
    setSalvando(true);

    const itensFinais = itens
      .filter(i => i.nome.trim() && i.valorUnitario > 0)
      .map(i => ({
        tipo: i.tipo,
        idRef: i.idRef || null,
        nome: i.nome.trim(),
        quantidade: parseInt(i.quantidade) || 1,
        valorUnitario: parseFloat(i.valorUnitario) || 0,
        valorTotal: parseFloat(i.valorTotal) || 0,
        origem: i.origem || "manual",
      }));

    const possuiItensManuais = itensFinais.some(i => i.origem === "manual");

    const payload = {
      cliente: {
        id: clienteOrigem === "cadastrado" ? (clienteId || null) : null,
        nome: clienteOrigem === "cadastrado" ? clienteSearch.trim() : clienteNome.trim(),
        telefone: clienteOrigem === "cadastrado"
          ? (clientes.find(c => c.id === clienteId)?.telefone || clienteTel)
          : clienteTel.trim(),
        origem: clienteOrigem,
      },
      itens: itensFinais,
      descricaoLivre: descricaoLivre.trim() || null,
      resumoFinanceiro: calculos,
      comportamento: {
        quantidadeItens: itensFinais.length,
        ticketMedioItem: itensFinais.length > 0 ? calculos.totalFinal / itensFinais.length : 0,
        possuiItensManuais,
      },
      statusComercial,
      configuracaoLayout: {
        corHeader: layoutCor,
        corTextoHeader: layoutCorTxt,
        posicaoLogo: layoutLogo,
      },
    };

    await onSave(payload, isEdit ? orc : null);
    setSalvando(false);
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box modal-box-xl">

        <div className="modal-header">
          <div>
            <div className="modal-title">{isEdit ? `Editando ${orc.codigo}` : "Novo Orçamento"}</div>
            <div className="modal-sub">{isEdit ? "Altere os dados e salve" : "Preencha os dados do orçamento"}</div>
          </div>
          <button className="modal-close" onClick={onClose}><X size={14} color="var(--text-2)" /></button>
        </div>

        <div className="modal-body">

          {/* ── Dados do cliente ── */}
          <div className="orc-cliente-toggle">
            <button
              className={`orc-toggle-btn ${clienteOrigem === "cadastrado" ? "active" : ""}`}
              onClick={() => { setClienteOrigem("cadastrado"); setClienteId(null); }}
            >
              <User size={11} /> Cliente Cadastrado
            </button>
            <button
              className={`orc-toggle-btn ${clienteOrigem === "manual" ? "active" : ""}`}
              onClick={() => { setClienteOrigem("manual"); setClienteId(null); setClienteSearch(""); }}
            >
              <Edit2 size={11} /> Inserir Manualmente
            </button>
          </div>

          {clienteOrigem === "cadastrado" ? (
            <div className="form-group nv-autocomplete">
              <label className="form-label">Cliente <span className="form-label-req">*</span></label>
              <input
                className={`form-input ${erros.clienteNome ? "err" : ""}`}
                placeholder="Buscar cliente cadastrado..."
                value={clienteSearch}
                onChange={e => { setClienteSearch(e.target.value); setClienteId(null); setClienteAC(true); }}
                onFocus={() => setClienteAC(true)}
                onBlur={() => setTimeout(() => setClienteAC(false), 180)}
                autoComplete="off"
              />
              {erros.clienteNome && <div className="form-error">{erros.clienteNome}</div>}
              {clienteAC && (
                <div className="nv-ac-list">
                  {clientesFiltrados.length === 0
                    ? <div className="nv-ac-empty">Nenhum cliente encontrado.</div>
                    : clientesFiltrados.map(c => (
                      <div key={c.id} className="nv-ac-item" onMouseDown={() => selecionarCliente(c)}>
                        <span>{c.nome}</span>
                        <span className="nv-ac-item-sub">{c.telefone || ""}</span>
                      </div>
                    ))
                  }
                </div>
              )}
              {clienteId && (
                <div style={{ fontSize: 11, color: "var(--green)", marginTop: 5 }}>✅ Cliente vinculado — conversão em venda habilitada.</div>
              )}
            </div>
          ) : (
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Nome <span className="form-label-req">*</span></label>
                <input
                  className={`form-input ${erros.clienteNome ? "err" : ""}`}
                  placeholder="Nome do cliente"
                  value={clienteNome}
                  onChange={e => setClienteNome(e.target.value)}
                />
                {erros.clienteNome && <div className="form-error">{erros.clienteNome}</div>}
              </div>
              <div className="form-group">
                <label className="form-label">Telefone <span className="form-label-req">*</span></label>
                <input
                  className={`form-input ${erros.clienteTel ? "err" : ""}`}
                  placeholder="(00) 00000-0000"
                  value={clienteTel}
                  onChange={e => setClienteTel(e.target.value)}
                />
                {erros.clienteTel && <div className="form-error">{erros.clienteTel}</div>}
              </div>
            </div>
          )}

          <div className="form-section-sep" />

          {/* ── Itens ── */}
          <div className="orc-items-header">
            <span className="orc-items-label">Itens do Orçamento</span>
            <button className="orc-add-item-btn" onClick={adicionarItem}>
              <Plus size={12} /> Adicionar Item
            </button>
          </div>

          {erros.itens && <div className="form-error" style={{ marginBottom: 8 }}>{erros.itens}</div>}

          {itens.map((item, idx) => (
            <div className="orc-item-row" key={idx}>
              {/* Tipo */}
              <div>
                <div className="orc-item-field-label">Tipo</div>
                <select
                  className="orc-tipo-select"
                  value={item.tipo}
                  onChange={e => atualizarItem(idx, "tipo", e.target.value)}
                >
                  <option value="produto">Produto</option>
                  <option value="servico">Serviço</option>
                  <option value="livre">Livre</option>
                </select>
              </div>

              {/* Nome / Autocomplete */}
              <div className="nv-autocomplete">
                <div className="orc-item-field-label">Descrição</div>
                <input
                  className="form-input"
                  placeholder={item.tipo === "livre" ? "Descrição livre..." : "Buscar..."}
                  value={itemSearches[idx] || ""}
                  onChange={e => {
                    const ns = [...itemSearches];
                    ns[idx] = e.target.value;
                    setItemSearches(ns);
                    atualizarItem(idx, "nome", e.target.value);
                    if (item.tipo !== "livre") setItemAC(idx);
                  }}
                  onFocus={() => { if (item.tipo !== "livre") setItemAC(idx); }}
                  onBlur={() => setTimeout(() => setItemAC(null), 180)}
                  autoComplete="off"
                  style={{ padding: "8px 10px", fontSize: 12 }}
                />
                {itemAC === idx && item.tipo !== "livre" && (
                  <div className="nv-ac-list">
                    {catalogoFiltrado(itemSearches[idx] || "", item.tipo).length === 0
                      ? <div className="nv-ac-empty">Nenhum item encontrado.</div>
                      : catalogoFiltrado(itemSearches[idx] || "", item.tipo).map(p => (
                        <div key={p.id} className="nv-ac-item"
                          onMouseDown={() => selecionarCatalogoItem(idx, p, item.tipo)}>
                          <span>{p.nome}</span>
                          <span className="nv-ac-item-sub">{fmtR$(p.preco)}</span>
                        </div>
                      ))
                    }
                  </div>
                )}
              </div>

              {/* Quantidade */}
              <div>
                <div className="orc-item-field-label">Qtd</div>
                <input
                  className="form-input" type="number" min="1"
                  value={item.quantidade}
                  onChange={e => atualizarItem(idx, "quantidade", e.target.value)}
                  style={{ padding: "8px 10px", fontSize: 12 }}
                />
              </div>

              {/* Valor unitário */}
              <div>
                <div className="orc-item-field-label">Unit. (R$)</div>
                <input
                  className="form-input" type="number" min="0" step="0.01"
                  value={item.valorUnitario}
                  onChange={e => atualizarItem(idx, "valorUnitario", e.target.value)}
                  style={{ padding: "8px 10px", fontSize: 12 }}
                />
              </div>

              {/* Total */}
              <div>
                <div className="orc-item-field-label">Total</div>
                <input
                  className="form-input"
                  value={fmtR$(item.valorTotal)}
                  readOnly
                  style={{ padding: "8px 10px", fontSize: 12, color: "var(--green)", background: "var(--s3)" }}
                />
              </div>

              {/* Remover */}
              <button className="orc-item-remove" onClick={() => removerItem(idx)} disabled={itens.length === 1}>
                <X size={13} />
              </button>
            </div>
          ))}

          {/* Totais */}
          <div className="orc-totals-bar">
            <div className="orc-total-cell">
              <span className="orc-total-label">Subtotal</span>
              <span className="orc-total-val">{fmtR$(calculos.subtotal)}</span>
            </div>
            <div className="orc-total-cell">
              <span className="orc-total-label">Descontos (R$)</span>
              <input
                type="number" min="0" step="0.01"
                value={descontos}
                onChange={e => setDescontos(e.target.value)}
                style={{ background: "var(--s3)", border: "1px solid var(--border)", borderRadius: 7, padding: "3px 8px", color: "var(--text)", fontSize: 12, width: 90, outline: "none" }}
              />
            </div>
            <div className="orc-total-cell">
              <span className="orc-total-label">Acréscimos (R$)</span>
              <input
                type="number" min="0" step="0.01"
                value={acrescimos}
                onChange={e => setAcrescimos(e.target.value)}
                style={{ background: "var(--s3)", border: "1px solid var(--border)", borderRadius: 7, padding: "3px 8px", color: "var(--text)", fontSize: 12, width: 90, outline: "none" }}
              />
            </div>
            <div className="orc-total-cell" style={{ marginLeft: "auto" }}>
              <span className="orc-total-label">Total Final</span>
              <span className="orc-total-val" style={{ color: "var(--green)", fontSize: 15 }}>{fmtR$(calculos.totalFinal)}</span>
            </div>
          </div>

          <div className="form-section-sep" />

          {/* ── Descrição livre ── */}
          <div className="form-group">
            <label className="form-label">Observações / Descrição Livre</label>
            <textarea
              className="form-input"
              placeholder="Informações adicionais, condições, prazo de entrega..."
              value={descricaoLivre}
              onChange={e => setDescricaoLivre(e.target.value)}
              rows={3}
              style={{ resize: "vertical" }}
            />
          </div>

          <div className="form-section-sep" />

          {/* ── Status inicial + Layout ── */}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Status Comercial</label>
              <select className="orc-sc-select" value={statusComercial} onChange={e => setStatusComercial(e.target.value)}>
                <option value="rascunho">Rascunho</option>
                <option value="enviado">Enviado</option>
                <option value="aguardando_resposta">Aguardando Resposta</option>
                <option value="negociacao">Em Negociação</option>
                <option value="fechado">Fechado</option>
                <option value="perdido">Perdido</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Posição da Logo</label>
              <div className="orc-logo-positions">
                {["esquerda", "centro", "direita"].map(pos => (
                  <button
                    key={pos}
                    className={`orc-pos-btn ${layoutLogo === pos ? "active" : ""}`}
                    onClick={() => setLayoutLogo(pos)}
                  >
                    {pos.charAt(0).toUpperCase() + pos.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Cor do Cabeçalho (Impressão)</label>
            <div className="orc-layout-colors">
              {CORES_HEADER.map(c => (
                <div
                  key={c.bg}
                  className={`orc-color-option ${layoutCor === c.bg ? "selected" : ""}`}
                  style={{ background: c.bg, border: `2px solid ${layoutCor === c.bg ? "var(--gold)" : "var(--border)"}` }}
                  onClick={() => { setLayoutCor(c.bg); setLayoutCorTxt(c.text); }}
                  title={c.bg}
                />
              ))}
            </div>
          </div>

        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" onClick={handleSalvar} disabled={salvando}>
            {salvando ? "Salvando..." : isEdit ? "Salvar Alterações" : "Criar Orçamento"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════
   COMPONENTE PRINCIPAL: Orcamentos
   ══════════════════════════════════════════════════ */
export default function Orcamentos() {
  const [uid, setUid]                 = useState(null);
  const [orcamentos, setOrcamentos]   = useState([]);
  const [clientes, setClientes]       = useState([]);
  const [produtos, setProdutos]       = useState([]);
  const [servicos, setServicos]       = useState([]);
  const [config, setConfig]           = useState({});
  const [loading, setLoading]         = useState(true);

  const [search, setSearch]           = useState("");
  const [filtro, setFiltro]           = useState("Todos");

  const [modalNovo, setModalNovo]     = useState(false);
  const [editando, setEditando]       = useState(null);
  const [detalhe, setDetalhe]         = useState(null);

  /* ── Auth ── */
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => setUid(u?.uid || null));
    return unsub;
  }, []);

  /* ── Listeners Firestore ── */
  useEffect(() => {
    if (!uid) return;

    const subs = [];

    /* Orçamentos */
    subs.push(
      onSnapshot(
        query(collection(db, "users", uid, "orcamentos"), orderBy("datas.criacao", "desc")),
        snap => {
          setOrcamentos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
          setLoading(false);
        },
        () => setLoading(false)
      )
    );

    /* Clientes */
    subs.push(
      onSnapshot(collection(db, "users", uid, "clientes"), snap =>
        setClientes(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      )
    );

    /* Produtos */
    subs.push(
      onSnapshot(collection(db, "users", uid, "produtos"), snap =>
        setProdutos(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      )
    );

    /* Serviços */
    subs.push(
      onSnapshot(collection(db, "users", uid, "servicos"), snap =>
        setServicos(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      )
    );

    /* Config empresa */
    getDoc(doc(db, "users", uid, "config", "geral")).then(snap => {
      if (snap.exists()) setConfig(snap.data());
    });

    return () => subs.forEach(u => u());
  }, [uid]);

  /* ── Salvar orçamento (criar / editar) ── */
  const handleSave = async (payload, orcExistente) => {
    if (!uid) return;

    if (orcExistente) {
      /* Editar */
      const ref = doc(db, "users", uid, "orcamentos", orcExistente.id);
      const interacao = {
        tipo: "edicao",
        descricao: "Orçamento editado",
        data: Timestamp.now(),
      };
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        const interacoes = snap.data()?.interacoes || [];
        tx.update(ref, {
          ...payload,
          interacoes: [...interacoes, interacao],
        });
      });
      setEditando(null);
    } else {
      /* Criar — gera código sequencial */
      const cntRef = doc(db, "users", uid);
      let novoId = "";

      await runTransaction(db, async (tx) => {
        const cntSnap = await tx.get(cntRef);
        const cnt = cntSnap.data()?.orcamentoCnt || 0;
        const novoCnt = cnt + 1;
        const codigo = gerarCodigo(cnt);

        const agora = Timestamp.now();
        const validade = Timestamp.fromDate(
          new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        );

        const orcRef = doc(collection(db, "users", uid, "orcamentos"));
        novoId = orcRef.id;

        tx.update(cntRef, { orcamentoCnt: novoCnt });
        tx.set(orcRef, {
          ...payload,
          codigo,
          statusSistema: "ativo",
          pipeline: { etapa: payload.statusComercial || "rascunho" },
          datas: {
            criacao: agora,
            validade,
          },
          interacoes: [{
            tipo: "criacao",
            descricao: "Orçamento criado",
            data: agora,
          }],
          conversao: {
            convertido: false,
            vendaId: null,
            dataConversao: null,
          },
        });
      });

      setModalNovo(false);
    }
  };

  /* ── Converter em venda ── */
  const handleConverterVenda = async (orc) => {
    if (!uid || !orc.cliente?.id) throw new Error("Cliente não cadastrado.");

    /* Gerar contador de venda */
    const cntRef = doc(db, "users", uid);
    let vendaId = "";

    await runTransaction(db, async (tx) => {
      const cntSnap = await tx.get(cntRef);
      const cntV = cntSnap.data()?.vendaIdCnt || 0;
      const novoCntV = cntV + 1;
      vendaId = `V${String(novoCntV).padStart(4, "0")}`;

      /* Montar itens no formato de vendas */
      const itensVenda = (orc.itens || []).map(item => ({
        produtoId: item.idRef || null,
        nome: item.nome,
        qtd: item.quantidade,
        preco: item.valorUnitario,
        custo: 0,
        desconto: 0,
        tipo: item.tipo === "livre" ? "livre" : item.tipo,
      }));

      /* Criar venda */
      const vendaRef = doc(db, "users", uid, "vendas", vendaId);
      tx.set(vendaRef, {
        cliente: orc.cliente.nome,
        clienteId: orc.cliente.id,
        data: Timestamp.now(),
        formaPagamento: "Outros",
        total: orc.resumoFinanceiro?.totalFinal || 0,
        subtotal: orc.resumoFinanceiro?.subtotal || 0,
        descontos: orc.resumoFinanceiro?.descontos || 0,
        lucroEstimado: orc.resumoFinanceiro?.totalFinal || 0,
        parcelas: null,
        taxaPercentual: 0,
        valorTaxa: 0,
        valorPago: null,
        valorRestante: null,
        dataVencSinal: null,
        statusPagamento: "recebido",
        valorRecebido: orc.resumoFinanceiro?.totalFinal || 0,
        tipo: "produto",
        itens: itensVenda,
        observacao: `Convertido do orçamento ${orc.codigo}`,
        origem: "orcamento",
        orcamentoId: orc.id,
      });

      /* Atualizar orçamento */
      const orcRef = doc(db, "users", uid, "orcamentos", orc.id);
      const orcSnap = await tx.get(orcRef);
      const interacoes = orcSnap.data()?.interacoes || [];
      tx.update(orcRef, {
        statusSistema: "convertido",
        statusComercial: "fechado",
        conversao: {
          convertido: true,
          vendaId,
          dataConversao: Timestamp.now(),
        },
        interacoes: [...interacoes, {
          tipo: "conversao",
          descricao: `Convertido na venda ${vendaId}`,
          data: Timestamp.now(),
        }],
      });

      tx.update(cntRef, { vendaIdCnt: novoCntV });
    });
  };

  /* ── Filtros ── */
  const orcamentosFiltrados = useMemo(() => {
    let lista = orcamentos.map(o => ({ ...o, _ss: statusSistemaAtual(o) }));

    /* Filtro de status */
    const mapa = filtroParaStatus(filtro);
    if (mapa) {
      if (mapa.sc) lista = lista.filter(o => o.statusComercial === mapa.sc);
      if (mapa.ss) lista = lista.filter(o => o._ss === mapa.ss);
    }

    /* Busca */
    if (search.trim()) {
      const q = search.toLowerCase();
      lista = lista.filter(o =>
        o.codigo?.toLowerCase().includes(q) ||
        o.cliente?.nome?.toLowerCase().includes(q)
      );
    }

    return lista;
  }, [orcamentos, filtro, search]);

  if (!uid) return <div className="orc-loading">Carregando autenticação...</div>;

  return (
    <>
      <style>{CSS}</style>
      <div id="orc-print-root" />

      {/* Topbar */}
      <header className="orc-topbar">
        <div className="orc-topbar-title">
          <h1>Orçamentos</h1>
          <p>Crie, gerencie e converta orçamentos em vendas</p>
        </div>

        <div className="orc-search">
          <Search size={13} color="var(--text-3)" />
          <input
            placeholder="Buscar por código ou cliente..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div className="orc-topbar-right">
          <button
            style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 16px", borderRadius: 9, background: "var(--gold)", color: "#0a0808", border: "none", cursor: "pointer", fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", transition: "opacity .13s" }}
            onClick={() => setModalNovo(true)}
          >
            <Plus size={14} /> Novo Orçamento
          </button>
        </div>
      </header>

      {/* Filtros */}
      <div className="orc-filters">
        {FILTROS.map(f => (
          <button
            key={f}
            className={`orc-filter-btn ${filtro === f ? "active" : ""}`}
            onClick={() => setFiltro(f)}
          >{f}</button>
        ))}
      </div>

      {/* Tabela */}
      <div className="ag-content">
        <div className="orc-table-wrap">
          <div className="orc-table-header">
            <div className="orc-table-title">
              Orçamentos
              <span className="orc-count-badge">{orcamentosFiltrados.length}</span>
            </div>
          </div>

          {/* Cabeçalho */}
          <div className="orc-row orc-row-head">
            <span>Código</span>
            <span>Cliente</span>
            <span>Criado em</span>
            <span>Status Comercial</span>
            <span>Status Sistema</span>
            <span>Total</span>
            <span style={{ textAlign: "right" }}>Ações</span>
          </div>

          {loading ? (
            <div className="orc-loading">Carregando orçamentos...</div>
          ) : orcamentosFiltrados.length === 0 ? (
            <div className="orc-empty">
              <FileText size={28} color="var(--text-3)" style={{ marginBottom: 8 }} />
              <p>Nenhum orçamento encontrado.</p>
            </div>
          ) : orcamentosFiltrados.map(o => (
            <div key={o.id} className="orc-row" onClick={() => setDetalhe(o)}>
              <span className="orc-codigo">{o.codigo || o.id}</span>
              <span className="orc-cliente">{o.cliente?.nome || "—"}</span>
              <span>{fmtData(o.datas?.criacao)}</span>
              <span>
                <span className={`orc-status ${STATUS_COMERCIAL_CLASS[o.statusComercial] || "orc-status-rascunho"}`}>
                  {STATUS_COMERCIAL_LABELS[o.statusComercial] || o.statusComercial}
                </span>
              </span>
              <span>
                <span className={`orc-status ${STATUS_SISTEMA_CLASS[o._ss] || "orc-status-rascunho"}`}>
                  {o._ss?.charAt(0).toUpperCase() + o._ss?.slice(1)}
                </span>
              </span>
              <span className="orc-total">{fmtR$(o.resumoFinanceiro?.totalFinal)}</span>
              <div className="orc-actions" onClick={e => e.stopPropagation()}>
                <button className="btn-icon btn-icon-edit" title="Editar" onClick={() => { setEditando(o); }}>
                  <Edit2 size={13} />
                </button>
                <button className="btn-icon btn-icon-view" title="Ver detalhes" onClick={() => setDetalhe(o)}>
                  <FileText size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal Novo */}
      {modalNovo && (
        <ModalNovoOrcamento
          uid={uid}
          clientes={clientes}
          produtos={produtos}
          servicos={servicos}
          onSave={handleSave}
          onClose={() => setModalNovo(false)}
        />
      )}

      {/* Modal Editar */}
      {editando && (
        <ModalNovoOrcamento
          orc={editando}
          uid={uid}
          clientes={clientes}
          produtos={produtos}
          servicos={servicos}
          onSave={handleSave}
          onClose={() => setEditando(null)}
        />
      )}

      {/* Modal Detalhe */}
      {detalhe && (
        <ModalDetalheOrcamento
          orc={detalhe}
          uid={uid}
          config={config}
          onClose={() => setDetalhe(null)}
          onEditar={(o) => { setDetalhe(null); setEditando(o); }}
          onConverterVenda={handleConverterVenda}
        />
      )}
    </>
  );
}
