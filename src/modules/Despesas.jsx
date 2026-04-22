/* ═══════════════════════════════════════════════════
   ASSENT v2.0 — Despesas.jsx
   Estrutura: users/{uid}/despesas/{id}
              users/{uid}/recorrencias/{id}
   ═══════════════════════════════════════════════════ */

import { useState, useEffect, useMemo } from "react";
import {
  Search, Plus, Edit2, Trash2, X, CheckCircle, RefreshCw,
  AlertCircle, Clock, AlertTriangle, RotateCcw, TrendingUp,
  CreditCard, Wallet, Smartphone, ChevronDown, ChevronUp, Settings,
} from "lucide-react";

import { db } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";
import {  LIMITES_FREE } from "../hooks/useLicenca";
import { BannerLimite } from "../hooks/LicencaUI";
import {
  collection, doc, setDoc, deleteDoc, onSnapshot,
  query, orderBy, writeBatch, addDoc, serverTimestamp,
} from "firebase/firestore";

/* ── CSS ── */
const CSS = `
  @keyframes fadeIn  { from { opacity: 0 }               to { opacity: 1 } }
  @keyframes slideUp { from { opacity: 0; transform: translateY(14px) } to { opacity: 1; transform: translateY(0) } }

  /* Modal */
  .modal-overlay {
    position: fixed; inset: 0; z-index: 1000;
    background: rgba(0,0,0,0.78); backdrop-filter: blur(5px);
    display: flex; align-items: center; justify-content: center;
    padding: 20px; animation: fadeIn .15s ease;
  }
  .modal-overlay-top { z-index: 1100; }
  .modal-box {
    background: var(--s1); border: 1px solid var(--border-h);
    border-radius: 16px; width: 100%; max-width: 560px;
    max-height: 92vh; overflow-y: auto;
    box-shadow: 0 28px 72px rgba(0,0,0,0.65);
    animation: slideUp .18s ease;
  }
  .modal-box-lg  { max-width: 700px; }
  .modal-box-md  { max-width: 420px; }
  .modal-box::-webkit-scrollbar { width: 3px; }
  .modal-box::-webkit-scrollbar-thumb { background: var(--text-3); border-radius: 2px; }
  .modal-header {
    padding: 20px 22px 16px; border-bottom: 1px solid var(--border);
    display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;
  }
  .modal-title { font-family: 'Sora', sans-serif; font-size: 16px; font-weight: 600; color: var(--text); }
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
  }

  /* Form */
  .form-group { margin-bottom: 16px; }
  .form-group-0 { margin-bottom: 0; }
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
  }
  .form-input:focus { border-color: var(--gold); box-shadow: 0 0 0 3px rgba(200,165,94,0.1); }
  .form-input.err   { border-color: var(--red); }
  .form-input.err:focus { box-shadow: 0 0 0 3px rgba(224,82,82,0.1); }
  .form-error { font-size: 11px; color: var(--red); margin-top: 5px; }
  .form-row   { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  .form-row-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px; }
  .form-divider {
    border: none; border-top: 1px solid var(--border);
    margin: 18px 0 16px;
  }
  .form-section-title {
    font-size: 10px; font-weight: 600; letter-spacing: .07em;
    text-transform: uppercase; color: var(--text-3);
    margin-bottom: 14px;
  }

  /* Toggle chips */
  .chip-group { display: flex; gap: 6px; flex-wrap: wrap; }
  .chip {
    padding: 6px 14px; border-radius: 20px; font-size: 12px; font-weight: 500;
    border: 1px solid var(--border); cursor: pointer;
    background: var(--s2); color: var(--text-2);
    transition: all .13s;
  }
  .chip.active {
    background: var(--gold); color: #0a0808;
    border-color: var(--gold);
  }
  .chip:hover:not(.active) { border-color: var(--border-h); color: var(--text); }

  /* Buttons */
  .btn-primary {
    padding: 9px 20px; border-radius: 9px;
    background: var(--gold); color: #0a0808;
    border: none; cursor: pointer;
    font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 600;
    transition: opacity .13s, transform .1s;
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

  .btn-success {
    padding: 9px 20px; border-radius: 9px;
    background: rgba(74,186,130,.12); color: var(--green);
    border: 1px solid rgba(74,186,130,.25); cursor: pointer;
    font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 500;
    transition: background .13s;
  }
  .btn-success:hover { background: rgba(74,186,130,.2); }

  .btn-icon {
    width: 30px; height: 30px; border-radius: 7px;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; border: 1px solid transparent;
    background: transparent; transition: all .13s;
  }
  .btn-icon-edit  { color: var(--blue); }
  .btn-icon-edit:hover  { background: var(--blue-d); border-color: rgba(91,142,240,.2); }
  .btn-icon-del   { color: var(--red); }
  .btn-icon-del:hover   { background: var(--red-d);  border-color: rgba(224,82,82,.2); }
  .btn-icon-pay   { color: var(--green); }
  .btn-icon-pay:hover   { background: rgba(74,186,130,.12); border-color: rgba(74,186,130,.2); }
  .btn-icon-undo  { color: var(--text-3); }
  .btn-icon-undo:hover  { background: var(--s2); border-color: var(--border-h); color: var(--text-2); }

  .btn-nova-desp {
    display: flex; align-items: center; gap: 7px;
    padding: 8px 16px; border-radius: 9px;
    background: var(--gold); color: #0a0808;
    border: none; cursor: pointer;
    font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 600;
    white-space: nowrap; transition: opacity .13s;
  }
  .btn-nova-desp:hover { opacity: .88; }

  /* Container principal com scroll */
  .desp-container {
    display: flex; flex-direction: column;
    height: 100%; overflow-y: auto;
    min-height: 0;
  }
  .desp-container::-webkit-scrollbar { width: 4px; }
  .desp-container::-webkit-scrollbar-thumb { background: var(--text-3); border-radius: 2px; }

  /* Topbar */
  .desp-topbar {
    padding: 14px 22px; background: var(--s1);
    border-bottom: 1px solid var(--border);
    display: flex; align-items: center; gap: 14px; flex-shrink: 0; flex-wrap: wrap;
  }
  .desp-topbar-title h1 {
    font-family: 'Sora', sans-serif; font-size: 17px; font-weight: 600; color: var(--text);
  }
  .desp-topbar-title p { font-size: 11px; color: var(--text-2); margin-top: 2px; }

  .desp-search {
    display: flex; align-items: center; gap: 8px;
    background: var(--s2); border: 1px solid var(--border);
    border-radius: 8px; padding: 8px 12px; width: 240px;
  }
  .desp-search input {
    background: transparent; border: none; outline: none;
    color: var(--text); font-size: 12px; width: 100%;
  }

  /* Métricas cards */
  .desp-metrics {
    display: grid; grid-template-columns: repeat(4, 1fr);
    gap: 12px; padding: 18px 22px;
  }
  .metric-card {
    border-radius: 12px; padding: 14px 16px;
    border: 1px solid transparent; position: relative; overflow: hidden;
  }
  .metric-card-red    { background: rgba(224,82,82,.08);    border-color: rgba(224,82,82,.18); }
  .metric-card-amber  { background: rgba(200,165,94,.08);   border-color: rgba(200,165,94,.18); }
  .metric-card-purple { background: rgba(139,92,246,.08);   border-color: rgba(139,92,246,.18); }
  .metric-card-green  { background: rgba(74,186,130,.08);   border-color: rgba(74,186,130,.18); }

  .metric-icon {
    width: 28px; height: 28px; border-radius: 7px;
    display: flex; align-items: center; justify-content: center; margin-bottom: 10px;
  }
  .metric-icon-red    { background: rgba(224,82,82,.15); }
  .metric-icon-amber  { background: rgba(200,165,94,.15); }
  .metric-icon-purple { background: rgba(139,92,246,.15); }
  .metric-icon-green  { background: rgba(74,186,130,.15); }

  .metric-label { font-size: 10px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: var(--text-3); margin-bottom: 4px; }
  .metric-val   { font-family: 'Sora', sans-serif; font-size: 22px; font-weight: 600; }
  .metric-val-red    { color: var(--red); }
  .metric-val-amber  { color: var(--gold); }
  .metric-val-purple { color: #8b5cf6; }
  .metric-val-green  { color: var(--green); }
  .metric-sub { font-size: 11px; color: var(--text-3); margin-top: 3px; }

  /* Filtros */
  .desp-filters {
    padding: 0 22px 14px;
    display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
  }
  .filter-label { font-size: 11px; color: var(--text-3); margin-right: 2px; }
  .filter-chip {
    padding: 5px 12px; border-radius: 20px; font-size: 11px; font-weight: 500;
    border: 1px solid var(--border); background: var(--s2); color: var(--text-2);
    cursor: pointer; transition: all .13s;
  }
  .filter-chip:hover { border-color: var(--border-h); color: var(--text); }
  .filter-chip.active { background: var(--s3); border-color: var(--border-h); color: var(--text); }

  .filter-select {
    padding: 5px 10px; border-radius: 8px; font-size: 12px;
    border: 1px solid var(--border); background: var(--s2); color: var(--text-2);
    cursor: pointer; outline: none; font-family: 'DM Sans', sans-serif;
    transition: border-color .13s;
  }
  .filter-select:focus { border-color: var(--border-h); }

  /* Período personalizado */
  .periodo-custom {
    display: flex; align-items: center; gap: 6px;
  }
  .periodo-custom input[type="date"] {
    padding: 4px 8px; border-radius: 8px; font-size: 12px;
    border: 1px solid var(--border); background: var(--s2); color: var(--text-2);
    outline: none; font-family: 'DM Sans', sans-serif;
    transition: border-color .13s;
  }
  .periodo-custom input[type="date"]:focus { border-color: var(--border-h); }
  .periodo-custom span { font-size: 11px; color: var(--text-3); }

  /* Gerenciar categorias */
  .cat-manager {
    background: var(--s2); border: 1px solid var(--border);
    border-radius: 10px; padding: 12px 14px; margin-top: 10px;
  }
  .cat-manager-title {
    font-size: 10px; font-weight: 600; letter-spacing: .06em;
    text-transform: uppercase; color: var(--text-3); margin-bottom: 10px;
  }
  .cat-list { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
  .cat-item {
    display: inline-flex; align-items: center; gap: 5px;
    padding: 3px 10px; border-radius: 20px; font-size: 12px;
    background: var(--s3); border: 1px solid var(--border); color: var(--text-2);
  }
  .cat-item-del {
    display: flex; align-items: center; cursor: pointer;
    color: var(--text-3); transition: color .1s; background: none; border: none; padding: 0;
  }
  .cat-item-del:hover { color: var(--red); }
  .cat-add-row { display: flex; gap: 6px; }
  .cat-add-row input {
    flex: 1; padding: 7px 10px; border-radius: 8px; font-size: 12px;
    border: 1px solid var(--border); background: var(--s1); color: var(--text);
    outline: none; font-family: 'DM Sans', sans-serif;
    transition: border-color .13s;
  }
  .cat-add-row input:focus { border-color: var(--gold); }
  .cat-add-btn {
    padding: 7px 14px; border-radius: 8px; font-size: 12px; font-weight: 600;
    background: var(--gold); color: #0a0808; border: none; cursor: pointer;
    font-family: 'DM Sans', sans-serif; white-space: nowrap;
    transition: opacity .13s;
  }
  .cat-add-btn:hover { opacity: .88; }
  .cat-add-btn:disabled { opacity: .5; cursor: not-allowed; }
  .cat-select-row {
    display: flex; align-items: center; gap: 6px;
  }
  .cat-toggle-btn {
    padding: 4px 8px; border-radius: 7px; font-size: 11px;
    border: 1px solid var(--border); background: var(--s2); color: var(--text-3);
    cursor: pointer; display: flex; align-items: center; gap: 4px;
    transition: all .13s; white-space: nowrap;
  }
  .cat-toggle-btn:hover { border-color: var(--border-h); color: var(--text-2); }

  /* Tabela */
  .desp-table-wrap {
    margin: 0 22px 22px;
    background: var(--s1); border: 1px solid var(--border);
    border-radius: 12px; overflow: hidden;
  }
  .desp-table-header {
    padding: 13px 18px; border-bottom: 1px solid var(--border);
    display: flex; align-items: center; justify-content: space-between;
  }
  .desp-table-title { font-family: 'Sora', sans-serif; font-size: 13px; font-weight: 600; color: var(--text); }
  .count-badge {
    font-family: 'Sora', sans-serif; font-size: 12px; font-weight: 600;
    background: var(--s3); border: 1px solid var(--border-h);
    color: var(--text-2); padding: 2px 10px; border-radius: 20px;
  }

  .desp-row {
    display: grid;
    grid-template-columns: 80px 1fr 100px 110px 110px 90px 100px 110px 90px;
    padding: 11px 18px; gap: 8px;
    border-bottom: 1px solid var(--border);
    align-items: center; font-size: 12px; color: var(--text-2);
    transition: background .1s;
  }
  .desp-row:last-child { border-bottom: none; }
  .desp-row:hover { background: rgba(255,255,255,0.02); }
  .desp-row-head { background: var(--s2); }
  .desp-row-head span {
    font-size: 10px; font-weight: 500; letter-spacing: .06em;
    text-transform: uppercase; color: var(--text-3);
  }

  .desp-id    { font-family: 'Sora', sans-serif; font-size: 11px; color: var(--gold); font-weight: 500; }
  .desp-desc  { color: var(--text); font-size: 13px; font-weight: 500; }
  .desp-desc-obs { font-size: 11px; color: var(--text-3); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 220px; }
  .desp-valor { font-family: 'Sora', sans-serif; font-size: 13px; font-weight: 600; color: var(--text); }
  .desp-actions { display: flex; align-items: center; gap: 4px; justify-content: flex-end; }

  /* Status badges */
  .status-badge {
    display: inline-flex; align-items: center; gap: 5px;
    padding: 3px 9px; border-radius: 20px; font-size: 11px; font-weight: 500;
  }
  .status-pago    { background: rgba(74,186,130,.1);   color: var(--green); border: 1px solid rgba(74,186,130,.2); }
  .status-pendente{ background: rgba(200,165,94,.1);   color: var(--gold);  border: 1px solid rgba(200,165,94,.2); }
  .status-vencido { background: rgba(224,82,82,.1);    color: var(--red);   border: 1px solid rgba(224,82,82,.2); }
  .status-cancelado{ background: var(--s3);            color: var(--text-3);border: 1px solid var(--border); }

  /* Categoria badge */
  .cat-badge {
    display: inline-block; padding: 2px 8px; border-radius: 20px; font-size: 11px;
    background: var(--s3); border: 1px solid var(--border); color: var(--text-2);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 90px;
  }

  /* Recorrente icon */
  .recorr-icon { color: var(--blue); opacity: .8; }

  /* Parcel badge */
  .parcel-badge {
    font-size: 10px; color: var(--text-3); background: var(--s3);
    border: 1px solid var(--border); border-radius: 4px; padding: 1px 5px;
    font-family: 'Sora', sans-serif;
  }

  .desp-empty, .desp-loading { padding: 56px 20px; text-align: center; color: var(--text-3); font-size: 13px; }

  /* Btn engrenagem categorias */
  .btn-gear-cat {
    display: flex; align-items: center; gap: 5px;
    padding: 5px 10px; border-radius: 8px; font-size: 11px; font-weight: 500;
    border: 1px solid var(--border); background: var(--s2); color: var(--text-3);
    cursor: pointer; transition: all .13s; white-space: nowrap;
  }
  .btn-gear-cat:hover { border-color: var(--border-h); color: var(--text-2); background: var(--s3); }
  .btn-gear-cat.active { border-color: var(--gold); color: var(--gold); }

  /* Modal categorias standalone */
  .cat-modal-list { display: flex; flex-direction: column; gap: 6px; margin-bottom: 16px; }
  .cat-modal-item {
    display: flex; align-items: center; justify-content: space-between;
    padding: 8px 12px; border-radius: 8px;
    background: var(--s2); border: 1px solid var(--border);
  }
  .cat-modal-item-name { font-size: 13px; color: var(--text); font-weight: 500; }
  .cat-modal-item-actions { display: flex; gap: 4px; align-items: center; }
  .cat-modal-edit-input {
    flex: 1; padding: 6px 10px; border-radius: 7px; font-size: 12px;
    border: 1px solid var(--gold); background: var(--s1); color: var(--text);
    outline: none; font-family: 'DM Sans', sans-serif;
  }
  .cat-modal-empty { font-size: 13px; color: var(--text-3); text-align: center; padding: 24px 0; }

  /* Modal Detalhes */
  .det-section-title {
    font-size: 10px; font-weight: 600; letter-spacing: .07em;
    text-transform: uppercase; color: var(--text-3); margin-bottom: 10px;
  }
  .det-grid {
    display: grid; grid-template-columns: 1fr 1fr; gap: 10px 20px;
    background: var(--s2); border: 1px solid var(--border);
    border-radius: 10px; padding: 14px 16px; margin-bottom: 14px;
  }
  .det-grid-full { grid-column: 1 / -1; }
  .det-item-label {
    font-size: 10px; font-weight: 600; letter-spacing: .06em;
    text-transform: uppercase; color: var(--text-3); margin-bottom: 3px;
  }
  .det-item-val {
    font-size: 13px; color: var(--text); font-weight: 500;
  }
  .det-item-val-mono { font-family: 'Sora', sans-serif; }
  .det-actions-row {
    display: flex; gap: 8px; flex-wrap: wrap;
  }

  .confirm-body p { font-size: 13px; color: var(--text-2); line-height: 1.6; }
  .confirm-body strong { color: var(--text); }
  .confirm-icon-wrap {
    width: 44px; height: 44px; border-radius: 50%; margin: 0 auto 14px;
    display: flex; align-items: center; justify-content: center;
  }
  .confirm-icon-del   { background: var(--red-d); }
  .confirm-icon-pay   { background: rgba(74,186,130,.12); }

  /* Modal pagar */
  .pay-info { background: var(--s2); border: 1px solid var(--border); border-radius: 10px; padding: 14px 16px; margin-bottom: 16px; }
  .pay-info-row { display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: var(--text-2); margin-bottom: 6px; }
  .pay-info-row:last-child { margin-bottom: 0; }
  .pay-info-val { font-weight: 600; color: var(--text); }
`;

/* ── Helpers ── */
const fmtR$ = (v) =>
  `R$ ${Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

const fmtData = (d) => {
  if (!d) return "—";
  try {
    const dt = typeof d === "string" ? new Date(d + "T12:00:00") : d?.toDate ? d.toDate() : new Date(d);
    return dt.toLocaleDateString("pt-BR");
  } catch { return String(d); }
};

const hoje = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

const parseDate = (d) => {
  if (!d) return null;
  try {
    const dt = typeof d === "string" ? new Date(d + "T12:00:00") : d?.toDate ? d.toDate() : new Date(d);
    dt.setHours(0, 0, 0, 0);
    return dt;
  } catch { return null; }
};

const calcularStatus = (vencimento, statusAtual) => {
  if (statusAtual === "pago" || statusAtual === "cancelado") return statusAtual;
  const venc = parseDate(vencimento);
  if (!venc) return "pendente";
  return venc < hoje() ? "vencido" : "pendente";
};

const gerarIdBase = (cnt) => `D${String(cnt + 1).padStart(4, "0")}`;
// idShow: para parcelas = "D0002-1" / "D0002-2" etc. Para simples = "D0001"
const gerarIdShow = (cnt, parcelaAtual = null, totalParcelas = null) => {
  const base = gerarIdBase(cnt);
  if (parcelaAtual && totalParcelas && totalParcelas > 1) return `${base}-${parcelaAtual}`;
  return base;
};

const proximaData = (dataBase, tipo, intervalo = 1) => {
  const d = parseDate(dataBase);
  if (!d) return null;
  const nova = new Date(d);
  if (tipo === "mensal")  nova.setMonth(nova.getMonth() + intervalo);
  if (tipo === "semanal") nova.setDate(nova.getDate() + 7 * intervalo);
  if (tipo === "anual")   nova.setFullYear(nova.getFullYear() + intervalo);
  return nova.toISOString().split("T")[0];
};

const FORMAS_PAG = [
  { value: "dinheiro", label: "Dinheiro", Icon: Wallet },
  { value: "pix",      label: "Pix",      Icon: Smartphone },
  { value: "debito",   label: "Débito",   Icon: CreditCard },
  { value: "credito",  label: "Crédito",  Icon: CreditCard },
];

/* ════════════════════════════════════════
   HOOK: Categorias dinâmicas
   Estrutura: categorias_despesas/{categoriaId}
   ════════════════════════════════════════ */
function useCategorias(tenantUid) {
  const [categorias, setCategorias] = useState([]);

  useEffect(() => {
    if (!tenantUid) return;
    const col = collection(db, "users", tenantUid, "categorias_despesas");
    const q = query(col, orderBy("nome", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      setCategorias(
        snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(c => c.ativa !== false)
      );
    });
    return unsub;
  }, [tenantUid]);

  const criarCategoria = async (nome) => {
    if (!tenantUid) return;
    const nomeTrimmed = nome.trim();
    if (!nomeTrimmed) return;
    await addDoc(collection(db, "users", tenantUid, "categorias_despesas"), {
      nome: nomeTrimmed,
      ativa: true,
      criadoEm: new Date().toISOString(),
    });
  };

  const desativarCategoria = async (id) => {
    if (!tenantUid) return;
    await setDoc(doc(db, "users", tenantUid, "categorias_despesas", id), { ativa: false }, { merge: true });
  };

  const renomearCategoria = async (id, novoNome) => {
    if (!tenantUid || !novoNome.trim()) return;
    await setDoc(doc(db, "users", tenantUid, "categorias_despesas", id), { nome: novoNome.trim() }, { merge: true });
  };

  return { categorias, criarCategoria, desativarCategoria, renomearCategoria };
}

/* ════════════════════════════════════════
   COMPONENTE: Gerenciar Categorias (inline no modal)
   ════════════════════════════════════════ */
function CategoriasManager({ categorias, onCriar, onDesativar }) {
  const [novaCategoria, setNovaCategoria] = useState("");
  const [salvando, setSalvando] = useState(false);

  const handleCriar = async () => {
    if (!novaCategoria.trim()) return;
    setSalvando(true);
    await onCriar(novaCategoria);
    setNovaCategoria("");
    setSalvando(false);
  };

  return (
    <div className="cat-manager">
      <div className="cat-manager-title">Gerenciar categorias</div>
      <div className="cat-list">
        {categorias.length === 0 && (
          <span style={{ fontSize: 12, color: "var(--text-3)" }}>Nenhuma categoria cadastrada.</span>
        )}
        {categorias.map(c => (
          <span key={c.id} className="cat-item">
            {c.nome}
            <button className="cat-item-del" onClick={() => onDesativar(c.id)} title="Remover">
              <X size={10} />
            </button>
          </span>
        ))}
      </div>
      <div className="cat-add-row">
        <input
          value={novaCategoria}
          onChange={e => setNovaCategoria(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleCriar()}
          placeholder="Nova categoria..."
        />
        <button className="cat-add-btn" onClick={handleCriar} disabled={salvando || !novaCategoria.trim()}>
          {salvando ? "..." : "+ Adicionar"}
        </button>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════
   MODAL: Nova / Editar Despesa
   ════════════════════════════════════════ */
function ModalNovaDespesa({ despesa, despesas, categorias, onCriarCategoria, onDesativarCategoria, onSave, onClose }) {
  const isEdit = !!despesa;
  const [showCatManager, setShowCatManager] = useState(false);

  const primeiraCategoria = categorias[0]?.nome || "";

  const [form, setForm] = useState({
    descricao:      despesa?.descricao      || "",
    valor:          despesa?.valor          || "",
    vencimento:     despesa?.vencimento     || "",
    categoria:      despesa?.categoria      || primeiraCategoria,
    centroCusto:    despesa?.centroCusto    || "",
    fornecedor:     despesa?.fornecedor     || "",
    formaPagamento: despesa?.formaPagamento || "pix",
    recorrente:     despesa?.recorrente     || false,
    tipoRecorrencia:despesa?.tipoRecorrencia|| "mensal",
    intervalo:      despesa?.intervalo      || 1,
    dataFim:        despesa?.dataFim        || "",
    parcelado:      despesa?.parcelado      || false,
    totalParcelas:  despesa?.totalParcelas  || 2,
    observacao:     despesa?.observacao     || "",
  });
  const [erros, setErros] = useState({});
  const [salvando, setSalvando] = useState(false);

  const set = (campo, valor) => {
    setForm(f => ({ ...f, [campo]: valor }));
    if (erros[campo]) setErros(e => ({ ...e, [campo]: "" }));
  };

  const validar = () => {
    const e = {};
    if (!form.descricao.trim()) e.descricao = "Descrição é obrigatória.";
    if (!form.valor || isNaN(Number(form.valor)) || Number(form.valor) <= 0) e.valor = "Valor inválido.";
    if (!form.vencimento) e.vencimento = "Data de vencimento é obrigatória.";
    setErros(e);
    return Object.keys(e).length === 0;
  };

  const handleSalvar = async () => {
    if (!validar()) return;
    setSalvando(true);
    await onSave({
      descricao:       form.descricao.trim(),
      valor:           Number(form.valor),
      vencimento:      form.vencimento,
      categoria:       form.categoria,
      centroCusto:     form.centroCusto.trim(),
      fornecedor:      form.fornecedor.trim(),
      formaPagamento:  form.formaPagamento,
      recorrente:      form.recorrente,
      tipoRecorrencia: form.recorrente ? form.tipoRecorrencia : null,
      intervalo:       form.recorrente ? Number(form.intervalo) : null,
      dataFim:         form.recorrente && form.dataFim ? form.dataFim : null,
      parcelado:       form.parcelado && !isEdit,
      totalParcelas:   form.parcelado && !isEdit ? Number(form.totalParcelas) : null,
      observacao:      form.observacao.trim(),
    });
    setSalvando(false);
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box modal-box-lg">
        <div className="modal-header">
          <div>
            <div className="modal-title">{isEdit ? "Editar Despesa" : "Nova Despesa"}</div>
            <div className="modal-sub">
              {isEdit ? `Editando ${despesa.idShow || despesa.id} — ${despesa.descricao}` : "Preencha os dados da despesa"}
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>
            <X size={14} color="var(--text-2)" />
          </button>
        </div>

        <div className="modal-body">

          {/* Descrição */}
          <div className="form-group">
            <label className="form-label">Descrição <span className="form-label-req">*</span></label>
            <input
              className={`form-input ${erros.descricao ? "err" : ""}`}
              value={form.descricao}
              onChange={e => set("descricao", e.target.value)}
              placeholder="Ex: Aluguel, energia elétrica..."
              autoFocus
            />
            {erros.descricao && <div className="form-error">{erros.descricao}</div>}
          </div>

          {/* Valor + Vencimento + Forma Pagamento */}
          <div className="form-row-3">
            <div className="form-group form-group-0">
              <label className="form-label">Valor (R$) <span className="form-label-req">*</span></label>
              <input
                className={`form-input ${erros.valor ? "err" : ""}`}
                type="number" min="0" step="0.01"
                value={form.valor}
                onChange={e => set("valor", e.target.value)}
                placeholder="0,00"
              />
              {erros.valor && <div className="form-error">{erros.valor}</div>}
            </div>
            <div className="form-group form-group-0">
              <label className="form-label">Vencimento <span className="form-label-req">*</span></label>
              <input
                className={`form-input ${erros.vencimento ? "err" : ""}`}
                type="date"
                value={form.vencimento}
                onChange={e => set("vencimento", e.target.value)}
              />
              {erros.vencimento && <div className="form-error">{erros.vencimento}</div>}
            </div>
            <div className="form-group form-group-0">
              <label className="form-label">Forma de pagamento</label>
              <div className="chip-group" style={{ marginTop: 2 }}>
                {FORMAS_PAG.map(fp => (
                  <button
                    key={fp.value}
                    className={`chip ${form.formaPagamento === fp.value ? "active" : ""}`}
                    onClick={() => set("formaPagamento", fp.value)}
                    type="button"
                  >
                    <fp.Icon size={11} style={{ display: "inline", marginRight: 4, verticalAlign: "middle" }} />
                    {fp.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Categoria + Centro de custo + Fornecedor */}
          <div className="form-row-3" style={{ marginTop: 14 }}>
            <div className="form-group form-group-0">
              <label className="form-label">Categoria</label>
              <div className="cat-select-row">
                <select
                  className="form-input"
                  value={form.categoria}
                  onChange={e => set("categoria", e.target.value)}
                  style={{ flex: 1 }}
                >
                  {categorias.length === 0 && (
                    <option value="">— Sem categorias —</option>
                  )}
                  {categorias.map(c => (
                    <option key={c.id} value={c.nome}>{c.nome}</option>
                  ))}
                </select>
                <button
                  type="button"
                  className="cat-toggle-btn"
                  onClick={() => setShowCatManager(v => !v)}
                  title="Gerenciar categorias"
                >
                  <Plus size={11} />
                </button>
              </div>
              {showCatManager && (
                <CategoriasManager
                  categorias={categorias}
                  onCriar={onCriarCategoria}
                  onDesativar={onDesativarCategoria}
                />
              )}
            </div>
            <div className="form-group form-group-0">
              <label className="form-label">Centro de custo</label>
              <input
                className="form-input"
                value={form.centroCusto}
                onChange={e => set("centroCusto", e.target.value)}
                placeholder="Ex: Marketing, TI..."
              />
            </div>
            <div className="form-group form-group-0">
              <label className="form-label">Fornecedor</label>
              <input
                className="form-input"
                value={form.fornecedor}
                onChange={e => set("fornecedor", e.target.value)}
                placeholder="Nome do fornecedor"
              />
            </div>
          </div>

          <hr className="form-divider" />

          {/* Recorrência */}
          <div className="form-group">
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", userSelect: "none" }}>
                <input
                  type="checkbox"
                  checked={form.recorrente}
                  onChange={e => set("recorrente", e.target.checked)}
                  style={{ accentColor: "var(--gold)", width: 15, height: 15 }}
                />
                <span className="form-label" style={{ marginBottom: 0 }}>Despesa recorrente</span>
              </label>
            </div>

            {form.recorrente && (
              <div className="form-row-3">
                <div className="form-group form-group-0">
                  <label className="form-label">Tipo</label>
                  <select className="form-input" value={form.tipoRecorrencia} onChange={e => set("tipoRecorrencia", e.target.value)}>
                    <option value="semanal">Semanal</option>
                    <option value="mensal">Mensal</option>
                    <option value="anual">Anual</option>
                  </select>
                </div>
                <div className="form-group form-group-0">
                  <label className="form-label">Intervalo</label>
                  <input
                    type="number" min="1" className="form-input"
                    value={form.intervalo}
                    onChange={e => set("intervalo", e.target.value)}
                    placeholder="1"
                  />
                </div>
                <div className="form-group form-group-0">
                  <label className="form-label">Data fim (opcional)</label>
                  <input type="date" className="form-input" value={form.dataFim} onChange={e => set("dataFim", e.target.value)} />
                </div>
              </div>
            )}
          </div>

          {/* Parcelamento (somente criação) */}
          {!isEdit && (
            <div className="form-group form-group-0">
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", userSelect: "none" }}>
                  <input
                    type="checkbox"
                    checked={form.parcelado}
                    disabled={form.recorrente}
                    onChange={e => set("parcelado", e.target.checked)}
                    style={{ accentColor: "var(--gold)", width: 15, height: 15 }}
                  />
                  <span className="form-label" style={{ marginBottom: 0 }}>
                    Parcelado {form.recorrente && <span style={{ color: "var(--text-3)" }}>(indisponível com recorrência)</span>}
                  </span>
                </label>
              </div>
              {form.parcelado && !form.recorrente && (
                <div style={{ maxWidth: 160 }}>
                  <label className="form-label">Número de parcelas</label>
                  <input
                    type="number" min="2" max="60" className="form-input"
                    value={form.totalParcelas}
                    onChange={e => set("totalParcelas", e.target.value)}
                  />
                </div>
              )}
            </div>
          )}

          {/* Observação */}
          <div className="form-group" style={{ marginTop: 14, marginBottom: 0 }}>
            <label className="form-label">Observação</label>
            <input
              className="form-input"
              value={form.observacao}
              onChange={e => set("observacao", e.target.value)}
              placeholder="Opcional"
            />
          </div>

        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" onClick={handleSalvar} disabled={salvando}>
            {salvando ? "Salvando..." : isEdit ? "Salvar Alterações" : (form.parcelado ? `Criar ${form.totalParcelas} parcelas` : "Registrar Despesa")}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════
   MODAL: Registrar Pagamento
   ════════════════════════════════════════ */
function ModalPagar({ despesa, onConfirm, onClose }) {
  const [formaPag, setFormaPag] = useState(despesa.formaPagamento || "pix");
  const [pagando, setPagando] = useState(false);

  // toISOString() retorna UTC — em Brasília pode virar o dia anterior.
  // Usar getFullYear/Month/Date garante a data LOCAL do usuário.
  const [dataPag, setDataPag] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });

  const handlePagar = async () => {
    if (!dataPag) return;
    setPagando(true);
    await onConfirm(formaPag, dataPag);
    setPagando(false);
  };

  return (
    <div className="modal-overlay modal-overlay-top" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box modal-box-md">
        <div className="modal-header">
          <div>
            <div className="modal-title">Registrar Pagamento</div>
            <div className="modal-sub">{despesa.descricao}</div>
          </div>
          <button className="modal-close" onClick={onClose}><X size={14} color="var(--text-2)" /></button>
        </div>

        <div className="modal-body">
          <div className="pay-info">
            <div className="pay-info-row">
              <span>Valor</span>
              <span className="pay-info-val" style={{ color: "var(--green)" }}>{fmtR$(despesa.valor)}</span>
            </div>
            <div className="pay-info-row">
              <span>Vencimento</span>
              <span className="pay-info-val">{fmtData(despesa.vencimento)}</span>
            </div>
            {despesa.categoria && (
              <div className="pay-info-row">
                <span>Categoria</span>
                <span className="pay-info-val">{despesa.categoria}</span>
              </div>
            )}
          </div>

          <div className="form-group" style={{ marginBottom: 16 }}>
            <label className="form-label">Data do pagamento <span className="form-label-req">*</span></label>
            <input
              className="form-input"
              type="date"
              value={dataPag}
              onChange={e => setDataPag(e.target.value)}
            />
          </div>

          <div className="form-group form-group-0">
            <label className="form-label">Forma de pagamento</label>
            <div className="chip-group" style={{ marginTop: 6 }}>
              {FORMAS_PAG.map(fp => (
                <button
                  key={fp.value}
                  className={`chip ${formaPag === fp.value ? "active" : ""}`}
                  onClick={() => setFormaPag(fp.value)}
                  type="button"
                >
                  <fp.Icon size={11} style={{ display: "inline", marginRight: 4, verticalAlign: "middle" }} />
                  {fp.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn-success" onClick={handlePagar} disabled={pagando || !dataPag}>
            {pagando ? "Registrando..." : "Confirmar Pagamento"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════
   MODAL: Confirmar Exclusão
   ════════════════════════════════════════ */
function ModalConfirmDelete({ despesa, onConfirm, onClose }) {
  const [excluindo, setExcluindo] = useState(false);

  const handleConfirm = async () => {
    setExcluindo(true);
    await onConfirm();
    setExcluindo(false);
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box modal-box-md">
        <div className="modal-header">
          <div className="modal-title">Excluir Despesa</div>
          <button className="modal-close" onClick={onClose}><X size={14} color="var(--text-2)" /></button>
        </div>
        <div className="confirm-body">
          <div className="confirm-icon-wrap confirm-icon-del">
            <Trash2 size={18} color="var(--red)" />
          </div>
          <p>
            Deseja excluir <strong>{despesa.descricao}</strong>?<br />
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

/* ════════════════════════════════════════
   MODAL: Detalhes da Despesa
   ════════════════════════════════════════ */
function ModalDetalhes({ despesa, onEditar, onPagar, onDesfazer, onDeletar, podeEditar, podeExcluir, onClose }) {
  const d = despesa;
  const FORMAS_LABEL = { dinheiro: "Dinheiro", pix: "Pix", cartão: "Cartão" };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box modal-box-lg">
        <div className="modal-header">
          <div>
            <div className="modal-title" style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontFamily: "Sora", color: "var(--gold)", fontSize: 13 }}>{d.idShow || d.id}</span>
              <span>·</span>
              {d.descricao}
            </div>
            <div className="modal-sub" style={{ marginTop: 4 }}>
              <StatusBadge status={d.status} />
            </div>
          </div>
          <button className="modal-close" onClick={onClose}><X size={14} color="var(--text-2)" /></button>
        </div>

        <div className="modal-body">
          {/* Dados financeiros */}
          <div className="det-section-title">Dados financeiros</div>
          <div className="det-grid">
            <div>
              <div className="det-item-label">Valor</div>
              <div className="det-item-val det-item-val-mono" style={{ color: "var(--green)", fontSize: 16 }}>{fmtR$(d.valor)}</div>
            </div>
            <div>
              <div className="det-item-label">Vencimento</div>
              <div className="det-item-val">{fmtData(d.vencimento)}</div>
            </div>
            <div>
              <div className="det-item-label">Data de pagamento</div>
              <div className="det-item-val">{d.dataPagamento ? fmtData(d.dataPagamento) : <span style={{ color: "var(--text-3)" }}>—</span>}</div>
            </div>
            <div>
              <div className="det-item-label">Forma de pagamento</div>
              <div className="det-item-val">{FORMAS_LABEL[d.formaPagamento] || d.formaPagamento || <span style={{ color: "var(--text-3)" }}>—</span>}</div>
            </div>
            <div>
              <div className="det-item-label">Categoria</div>
              <div className="det-item-val">{d.categoria || <span style={{ color: "var(--text-3)" }}>—</span>}</div>
            </div>
            <div>
              <div className="det-item-label">Centro de custo</div>
              <div className="det-item-val">{d.centroCusto || <span style={{ color: "var(--text-3)" }}>—</span>}</div>
            </div>
            <div>
              <div className="det-item-label">Fornecedor</div>
              <div className="det-item-val">{d.fornecedor || <span style={{ color: "var(--text-3)" }}>—</span>}</div>
            </div>
            {d.parcelado && d.totalParcelas && (
              <div>
                <div className="det-item-label">Parcela</div>
                <div className="det-item-val">{d.parcelaAtual}/{d.totalParcelas}</div>
              </div>
            )}
            {d.observacao && (
              <div className="det-grid-full">
                <div className="det-item-label">Observação</div>
                <div className="det-item-val" style={{ color: "var(--text-2)" }}>{d.observacao}</div>
              </div>
            )}
          </div>

          {/* Recorrência */}
          {d.recorrente && (
            <>
              <div className="det-section-title">Recorrência</div>
              <div className="det-grid">
                <div>
                  <div className="det-item-label">Tipo</div>
                  <div className="det-item-val" style={{ textTransform: "capitalize" }}>{d.tipoRecorrencia || "—"}</div>
                </div>
                <div>
                  <div className="det-item-label">Intervalo</div>
                  <div className="det-item-val">{d.intervalo || 1}x</div>
                </div>
                {d.dataFim && (
                  <div>
                    <div className="det-item-label">Data fim</div>
                    <div className="det-item-val">{fmtData(d.dataFim)}</div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Ações */}
          <div className="det-actions-row">
            {d.status !== "pago" && d.status !== "cancelado" && (
              <button className="btn-success" onClick={() => { onClose(); onPagar(d); }}>
                <CheckCircle size={13} style={{ display: "inline", marginRight: 6, verticalAlign: "middle" }} />
                Registrar Pagamento
              </button>
            )}
            {d.status === "pago" && (
              <button className="btn-secondary" onClick={() => { onClose(); onDesfazer(d); }}>
                <RotateCcw size={13} style={{ display: "inline", marginRight: 6, verticalAlign: "middle" }} />
                Desfazer Pagamento
              </button>
            )}
            {podeEditar && (
              <button className="btn-secondary" onClick={() => { onClose(); onEditar(d); }}>
                <Edit2 size={13} style={{ display: "inline", marginRight: 6, verticalAlign: "middle" }} />
                Editar
              </button>
            )}
            {podeExcluir && (
              <button className="btn-danger" onClick={() => { onClose(); onDeletar(d); }}>
                <Trash2 size={13} style={{ display: "inline", marginRight: 6, verticalAlign: "middle" }} />
                Excluir
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════
   STATUS BADGE
   ════════════════════════════════════════ */
function StatusBadge({ status }) {
  const map = {
    pago:      { cls: "status-pago",     Icon: CheckCircle, label: "Pago" },
    pendente:  { cls: "status-pendente", Icon: Clock,       label: "Pendente" },
    vencido:   { cls: "status-vencido",  Icon: AlertCircle, label: "Vencido" },
    cancelado: { cls: "status-cancelado",Icon: X,           label: "Cancelado" },
  };
  const s = map[status] || map.pendente;
  return (
    <span className={`status-badge ${s.cls}`}>
      <s.Icon size={10} />
      {s.label}
    </span>
  );
}

/* ════════════════════════════════════════
   MODAL: Gerenciar Categorias (standalone)
   ════════════════════════════════════════ */
function ModalCategorias({ categorias, onCriar, onRenomear, onDesativar, onClose }) {
  const [novaCategoria, setNovaCategoria] = useState("");
  const [salvando, setSalvando]           = useState(false);
  const [editandoId, setEditandoId]       = useState(null);
  const [editandoNome, setEditandoNome]   = useState("");
  const [confirmDelId, setConfirmDelId]   = useState(null);

  const handleCriar = async () => {
    if (!novaCategoria.trim()) return;
    setSalvando(true);
    await onCriar(novaCategoria);
    setNovaCategoria("");
    setSalvando(false);
  };

  const handleIniciarEdit = (cat) => {
    setEditandoId(cat.id);
    setEditandoNome(cat.nome);
    setConfirmDelId(null);
  };

  const handleSalvarEdit = async () => {
    if (!editandoNome.trim()) return;
    await onRenomear(editandoId, editandoNome);
    setEditandoId(null);
    setEditandoNome("");
  };

  const handleExcluir = async (id) => {
    await onDesativar(id);
    setConfirmDelId(null);
  };

  return (
    <div className="modal-overlay modal-overlay-top" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box modal-box-md">
        <div className="modal-header">
          <div>
            <div className="modal-title">Gerenciar Categorias</div>
            <div className="modal-sub">Crie, edite ou exclua categorias de despesas</div>
          </div>
          <button className="modal-close" onClick={onClose}><X size={14} color="var(--text-2)" /></button>
        </div>

        <div className="modal-body">
          {/* Lista de categorias */}
          {categorias.length === 0 ? (
            <div className="cat-modal-empty">Nenhuma categoria cadastrada ainda.</div>
          ) : (
            <div className="cat-modal-list">
              {categorias.map(c => (
                <div key={c.id} className="cat-modal-item">
                  {editandoId === c.id ? (
                    /* Modo edição */
                    <div style={{ display: "flex", gap: 6, flex: 1, alignItems: "center" }}>
                      <input
                        className="cat-modal-edit-input"
                        value={editandoNome}
                        onChange={e => setEditandoNome(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === "Enter") handleSalvarEdit();
                          if (e.key === "Escape") setEditandoId(null);
                        }}
                        autoFocus
                      />
                      <button className="btn-success" style={{ padding: "5px 12px", fontSize: 12 }} onClick={handleSalvarEdit}>
                        Salvar
                      </button>
                      <button className="btn-secondary" style={{ padding: "5px 10px", fontSize: 12 }} onClick={() => setEditandoId(null)}>
                        <X size={12} />
                      </button>
                    </div>
                  ) : confirmDelId === c.id ? (
                    /* Confirmar exclusão inline */
                    <div style={{ display: "flex", gap: 6, flex: 1, alignItems: "center" }}>
                      <span style={{ fontSize: 12, color: "var(--red)", flex: 1 }}>
                        Excluir <strong style={{ color: "var(--text)" }}>{c.nome}</strong>?
                      </span>
                      <button className="btn-danger" style={{ padding: "5px 12px", fontSize: 12 }} onClick={() => handleExcluir(c.id)}>
                        Confirmar
                      </button>
                      <button className="btn-secondary" style={{ padding: "5px 10px", fontSize: 12 }} onClick={() => setConfirmDelId(null)}>
                        <X size={12} />
                      </button>
                    </div>
                  ) : (
                    /* Visualização normal */
                    <>
                      <span className="cat-modal-item-name">{c.nome}</span>
                      <div className="cat-modal-item-actions">
                        <button
                          className="btn-icon btn-icon-edit"
                          title="Renomear"
                          onClick={() => handleIniciarEdit(c)}
                        >
                          <Edit2 size={12} />
                        </button>
                        <button
                          className="btn-icon btn-icon-del"
                          title="Excluir"
                          onClick={() => { setConfirmDelId(c.id); setEditandoId(null); }}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Criar nova */}
          <hr className="form-divider" />
          <div className="form-section-title">Nova Categoria</div>
          <div className="cat-add-row">
            <input
              className="cat-modal-edit-input"
              style={{ borderColor: "var(--border)" }}
              value={novaCategoria}
              onChange={e => setNovaCategoria(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleCriar()}
              placeholder="Nome da nova categoria..."
            />
            <button
              className="cat-add-btn"
              onClick={handleCriar}
              disabled={salvando || !novaCategoria.trim()}
            >
              {salvando ? "..." : "+ Adicionar"}
            </button>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Fechar</button>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════
   COMPONENTE PRINCIPAL
   ════════════════════════════════════════ */
export default function Despesas({ isPro = false }) {
  const [despesas, setDespesas] = useState([]);
  const [despesaIdCnt, setDespesaIdCnt] = useState(0);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  // Filtros
  const [filtroStatus, setFiltroStatus] = useState("todas");
  const [filtroCategoria, setFiltroCategoria] = useState("todas");
  const [filtroPeriodo, setFiltroPeriodo] = useState("mes");
  const [periodoCustom, setPeriodoCustom] = useState({ inicio: "", fim: "" });

  // ── Multi-tenant ──
  const { tenantUid, podeCriar, podeEditar, podeExcluir } = useAuth();

  // ── Flags de permissão ──
  const podeCriarV   = podeCriar("despesas");
  const podeEditarV  = podeEditar("despesas");
  const podeExcluirV = podeExcluir("despesas");

  // Categorias dinâmicas
  const { categorias, criarCategoria, desativarCategoria, renomearCategoria } = useCategorias(tenantUid);

  // Modais

  const [modalNovo, setModalNovo]             = useState(false);
  const [editando, setEditando]               = useState(null);
  const [pagando, setPagando]                 = useState(null);
  const [deletando, setDeletando]             = useState(null);
  const [modalCategorias, setModalCategorias] = useState(false);
  const [viendoDetalhes, setViendoDetalhes]   = useState(null);

  /* ── Firestore ── */
  useEffect(() => {
    if (!tenantUid) { setLoading(false); return; }

    const userRef   = doc(db, "users", tenantUid);
    const despesasCol = collection(db, "users", tenantUid, "despesas");
    const q = query(despesasCol, orderBy("vencimento", "asc"));

    const unsubUser = onSnapshot(userRef, (snap) => {
      if (snap.exists()) setDespesaIdCnt(snap.data().despesaIdCnt || 0);
    });

    const unsubDesp = onSnapshot(q, (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      // Rotina diária: atualizar status vencido
      const batch = writeBatch(db);
      let mudou = false;
      docs.forEach(d => {
        const novoStatus = calcularStatus(d.vencimento, d.status);
        if (novoStatus !== d.status) {
          batch.update(doc(db, "users", tenantUid, "despesas", d.id), {
            status: novoStatus,
            ...(novoStatus === "pago" ? { pagoEm: serverTimestamp() } : {}),
          });
          mudou = true;
        }
      });
      if (mudou) batch.commit();

      setDespesas(docs.map(d => ({ ...d, status: calcularStatus(d.vencimento, d.status) })));
      setLoading(false);
    });

    return () => { unsubUser(); unsubDesp(); };
  }, [tenantUid]);

  /* ── Criar despesa(s) ── */
  const handleAdd = async (form) => {
    if (!tenantUid) return;
    let cnt = despesaIdCnt;

    if (form.parcelado && form.totalParcelas > 1) {
      // Parcelamento: todas as parcelas compartilham o mesmo número base (cnt atual)
      // e recebem idShow = "D000X-N"
      const grupoId = `G${Date.now()}`;
      const batch = writeBatch(db);
      const baseNum = cnt; // número sequencial desse grupo

      for (let i = 0; i < form.totalParcelas; i++) {
        const newDocId = `${gerarIdBase(baseNum)}-${i + 1}-${Date.now()}-${i}`;
        const idShow = gerarIdShow(baseNum, i + 1, form.totalParcelas);
        const dataVenc = (() => {
          const d = new Date(form.vencimento + "T12:00:00");
          d.setMonth(d.getMonth() + i);
          return d.toISOString().split("T")[0];
        })();
        const status = calcularStatus(dataVenc, "pendente");

        batch.set(doc(db, "users", tenantUid, "despesas", newDocId), {
          ...form, parcelado: true, grupoId,
          parcelaAtual: i + 1,
          idShow,
          vencimento: dataVenc, status,
          dataCriacao: new Date().toISOString(),
        });
      }
      cnt++; // grupo inteiro consome apenas 1 número sequencial

      batch.set(doc(db, "users", tenantUid), { despesaIdCnt: cnt }, { merge: true });
      await batch.commit();
    } else {
      // Despesa única
      const newDocId = `${gerarIdBase(cnt)}-${Date.now()}`;
      const idShow = gerarIdShow(cnt);
      const status = calcularStatus(form.vencimento, "pendente");

      await setDoc(doc(db, "users", tenantUid, "despesas", newDocId), {
        ...form, status, idShow, dataCriacao: new Date().toISOString(),
      });
      await setDoc(doc(db, "users", tenantUid), { despesaIdCnt: cnt + 1 }, { merge: true });
    }

    setModalNovo(false);
  };

  /* ── Editar ── */
  const handleEdit = async (form) => {
    if (!tenantUid || !editando) return;
    const status = calcularStatus(form.vencimento, editando.status);
    await setDoc(doc(db, "users", tenantUid, "despesas", editando.id), { ...form, status }, { merge: true });
    setEditando(null);
  };

  /* ── Pagar ── */
  const handlePagar = async (formaPagamento, dataPagamento) => {
    if (!tenantUid || !pagando) return;
    const ref = doc(db, "users", tenantUid, "despesas", pagando.id);

    // dataPagamento: string "YYYY-MM-DD" para exibição
    // dataPagamentoTs: Date JS com horário local ao meio-dia → Firestore salva como Timestamp
    //   ↳ evita o bug de timezone: new Date("2026-04-22") = UTC midnight = ontem às 21h em Brasília
    //   ↳ dentroDoIntervalo (FiltroPeriodo) funciona corretamente com Timestamp, não com string
    const dataEfetiva = dataPagamento || (() => {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    })();
    const dtTs = new Date(dataEfetiva + "T12:00:00"); // meio-dia local → sem ambiguidade de fuso

    await setDoc(ref, {
      status:          "pago",
      formaPagamento,
      dataPagamento:   dataEfetiva,          // string para display
      dataPagamentoTs: dtTs,                 // Timestamp para filtros do DRE
      mesPagamento:    dtTs.getMonth() + 1,  // 1–12
      anoPagamento:    dtTs.getFullYear(),
    }, { merge: true });

    // Recorrência: gerar próximo lançamento
    if (pagando.recorrente) {
      const dataFimOk = !pagando.dataFim || new Date(pagando.dataFim) > new Date();
      if (dataFimOk) {
        const novaData = proximaData(pagando.vencimento, pagando.tipoRecorrencia, pagando.intervalo || 1);
        if (novaData) {
          const cnt = despesaIdCnt;
          const newDocId = `${gerarIdBase(cnt)}-${Date.now()}`;
          const idShow = gerarIdShow(cnt);
          const novoStatus = calcularStatus(novaData, "pendente");
          await setDoc(doc(db, "users", tenantUid, "despesas", newDocId), {
            descricao:      pagando.descricao,
            valor:          pagando.valor,
            vencimento:     novaData,
            categoria:      pagando.categoria,
            centroCusto:    pagando.centroCusto,
            fornecedor:     pagando.fornecedor,
            formaPagamento: pagando.formaPagamento,
            recorrente:     true,
            tipoRecorrencia:pagando.tipoRecorrencia,
            intervalo:      pagando.intervalo,
            dataFim:        pagando.dataFim || null,
            recorrenciaOrigemId: pagando.id,
            idShow,
            status:         novoStatus,
            dataCriacao:    new Date().toISOString(),
          });
          await setDoc(doc(db, "users", tenantUid), { despesaIdCnt: cnt + 1 }, { merge: true });
        }
      }
    }

    setPagando(null);
  };

  /* ── Desfazer pagamento ── */
  const handleDesfazerPagamento = async (despesa) => {
    if (!tenantUid) return;
    const status = calcularStatus(despesa.vencimento, "pendente");
    await setDoc(doc(db, "users", tenantUid, "despesas", despesa.id), {
      status, dataPagamento: null, dataPagamentoTs: null, mesPagamento: null, anoPagamento: null,
    }, { merge: true });
  };

  /* ── Deletar ── */
  const handleDelete = async () => {
    if (!tenantUid || !deletando) return;
    await deleteDoc(doc(db, "users", tenantUid, "despesas", deletando.id));
    setDeletando(null);
  };

  /* ── Filtros e métricas ── */
  const mesAtual = new Date().getMonth();
  const anoAtual = new Date().getFullYear();

  const despesasFiltradas = useMemo(() => {
    let lista = [...despesas];

    // Regime de caixa: despesas pagas usam dataPagamento como referência,
    // as demais (pendente/vencido) usam vencimento.
    const getDataRef = (d) => {
      if (d.status === "pago" && d.dataPagamento) return parseDate(d.dataPagamento);
      return parseDate(d.vencimento);
    };

    // Período
    if (filtroPeriodo === "mes") {
      lista = lista.filter(d => {
        const dt = getDataRef(d);
        return dt && dt.getMonth() === mesAtual && dt.getFullYear() === anoAtual;
      });
    } else if (filtroPeriodo === "semana") {
      const inicio = new Date(); inicio.setDate(inicio.getDate() - inicio.getDay());
      const fim    = new Date(inicio); fim.setDate(inicio.getDate() + 6);
      lista = lista.filter(d => {
        const dt = getDataRef(d);
        return dt && dt >= inicio && dt <= fim;
      });
    } else if (filtroPeriodo === "custom") {
      const inicio = periodoCustom.inicio ? parseDate(periodoCustom.inicio) : null;
      const fim    = periodoCustom.fim    ? parseDate(periodoCustom.fim)    : null;
      lista = lista.filter(d => {
        const dt = getDataRef(d);
        if (!dt) return false;
        if (inicio && dt < inicio) return false;
        if (fim    && dt > fim)    return false;
        return true;
      });
    }

    // Status
    if (filtroStatus !== "todas") lista = lista.filter(d => d.status === filtroStatus);

    // Categoria
    if (filtroCategoria !== "todas") lista = lista.filter(d => d.categoria === filtroCategoria);

    // Busca
    if (search.trim()) {
      const q = search.toLowerCase();
      lista = lista.filter(d =>
        d.descricao?.toLowerCase().includes(q) ||
        d.fornecedor?.toLowerCase().includes(q) ||
        d.categoria?.toLowerCase().includes(q)
      );
    }

    return lista;
  }, [despesas, filtroStatus, filtroCategoria, filtroPeriodo, periodoCustom, search, mesAtual, anoAtual]);

  const metricas = useMemo(() => {
    const base = filtroPeriodo === "todas" ? despesas : despesasFiltradas;
    const vencidas  = base.filter(d => d.status === "vencido").length;
    const em3dias   = base.filter(d => {
      if (d.status !== "pendente") return false;
      const dt = parseDate(d.vencimento);
      if (!dt) return false;
      const diff = (dt - hoje()) / (1000 * 60 * 60 * 24);
      return diff >= 0 && diff <= 3;
    }).length;
    const totalPendente = base.filter(d => d.status === "pendente" || d.status === "vencido")
      .reduce((s, d) => s + (d.valor || 0), 0);
    const totalPago = base.filter(d => d.status === "pago")
      .reduce((s, d) => s + (d.valor || 0), 0);
    return { vencidas, em3dias, totalPendente, totalPago };
  }, [despesas, despesasFiltradas, filtroPeriodo]);

  const categoriasFiltro = useMemo(() =>
    categorias.map(c => c.nome),
    [categorias]
  );

  // App.jsx bloqueia render enquanto loadingAuth||!tenantUid

  return (
    <div className="desp-container">
      <style>{CSS}</style>

      {/* Topbar */}
      <header className="desp-topbar">
        <div className="desp-topbar-title">
          <h1>Despesas</h1>
          <p>Controle de pagamentos e obrigações financeiras</p>
        </div>

        <div className="desp-search">
          <Search size={13} color="var(--text-3)" />
          <input
            placeholder="Buscar por descrição, fornecedor..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div style={{ marginLeft: "auto" }}>
          <button
            className="btn-nova-desp"
            onClick={() => setModalNovo(true)}
            disabled={!podeCriarV || (!isPro && despesas.length >= LIMITES_FREE.despesas)}
            title={!isPro && despesas.length >= LIMITES_FREE.despesas ? `Limite de ${LIMITES_FREE.despesas} despesas atingido no plano Free` : undefined}
          >
            <Plus size={14} /> Nova Despesa
          </button>
        </div>
      </header>

      {/* Cards de métricas */}
      <BannerLimite total={despesas.length} limite={LIMITES_FREE.despesas} tipo="despesas" isPro={isPro} />
      <div className="desp-metrics">
        <div className="metric-card metric-card-red">
          <div className="metric-icon metric-icon-red">
            <AlertCircle size={15} color="var(--red)" />
          </div>
          <div className="metric-label">Vencidas</div>
          <div className="metric-val metric-val-red">{metricas.vencidas}</div>
          <div className="metric-sub">despesas em atraso</div>
        </div>

        <div className="metric-card metric-card-amber">
          <div className="metric-icon metric-icon-amber">
            <AlertTriangle size={15} color="var(--gold)" />
          </div>
          <div className="metric-label">Vencem em 3 dias</div>
          <div className="metric-val metric-val-amber">{metricas.em3dias}</div>
          <div className="metric-sub">requerem atenção</div>
        </div>

        <div className="metric-card metric-card-purple">
          <div className="metric-icon metric-icon-purple">
            <Clock size={15} color="#8b5cf6" />
          </div>
          <div className="metric-label">Total Pendente</div>
          <div className="metric-val metric-val-purple" style={{ fontSize: 17 }}>{fmtR$(metricas.totalPendente)}</div>
          <div className="metric-sub">a pagar</div>
        </div>

        <div className="metric-card metric-card-green">
          <div className="metric-icon metric-icon-green">
            <TrendingUp size={15} color="var(--green)" />
          </div>
          <div className="metric-label">Pago este mês</div>
          <div className="metric-val metric-val-green" style={{ fontSize: 17 }}>{fmtR$(metricas.totalPago)}</div>
          <div className="metric-sub">liquidado</div>
        </div>
      </div>

      {/* Filtros */}
      <div className="desp-filters">
        <span className="filter-label">Mostrar:</span>
        {[
          { value: "todas",    label: "Todas" },
          { value: "pendente", label: "Pendentes" },
          { value: "vencido",  label: "Vencidas" },
          { value: "pago",     label: "Pagas" },
        ].map(f => (
          <button
            key={f.value}
            className={`filter-chip ${filtroStatus === f.value ? "active" : ""}`}
            onClick={() => setFiltroStatus(f.value)}
          >
            {f.label}
          </button>
        ))}

        <div style={{ width: 1, height: 16, background: "var(--border)", margin: "0 4px" }} />

        <select className="filter-select" value={filtroPeriodo} onChange={e => setFiltroPeriodo(e.target.value)}>
          <option value="mes">Este mês</option>
          <option value="semana">Esta semana</option>
          <option value="todas">Tudo</option>
          <option value="custom">Período personalizado</option>
        </select>

        {filtroPeriodo === "custom" && (
          <div className="periodo-custom">
            <input
              type="date"
              value={periodoCustom.inicio}
              onChange={e => setPeriodoCustom(p => ({ ...p, inicio: e.target.value }))}
            />
            <span>até</span>
            <input
              type="date"
              value={periodoCustom.fim}
              onChange={e => setPeriodoCustom(p => ({ ...p, fim: e.target.value }))}
            />
          </div>
        )}

        <select className="filter-select" value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value)}>
          <option value="todas">Todas categorias</option>
          {categoriasFiltro.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        <button
          className={`btn-gear-cat ${modalCategorias ? "active" : ""}`}
          onClick={() => setModalCategorias(true)}
          title="Gerenciar categorias"
        >
          <Settings size={12} />
          Categorias
        </button>
      </div>

      {/* Tabela */}
      <div className="desp-table-wrap">
        <div className="desp-table-header">
          <span className="desp-table-title">Despesas</span>
          <span className="count-badge">{despesasFiltradas.length}</span>
        </div>

        {/* Cabeçalho */}
        <div className="desp-row desp-row-head">
          <span>ID</span>
          <span>Descrição</span>
          <span>Categoria</span>
          <span>Valor</span>
          <span>Vencimento</span>
          <span>Status</span>
          <span>Fornecedor</span>
          <span>Pagamento</span>
          <span style={{ textAlign: "right" }}>Ações</span>
        </div>

        {loading ? (
          <div className="desp-loading">Carregando despesas...</div>
        ) : despesasFiltradas.length === 0 ? (
          <div className="desp-empty">Nenhuma despesa encontrada.</div>
        ) : despesasFiltradas.map(d => (
          <div key={d.id} className="desp-row" style={{ cursor: "pointer" }} onClick={() => setViendoDetalhes(d)}>
            {/* ID */}
            <span className="desp-id" title={`doc.id: ${d.id}`}>
              {d.idShow || d.id}
              {d.recorrente && (
                <RefreshCw size={9} className="recorr-icon" style={{ marginLeft: 5, verticalAlign: "middle" }} />
              )}
            </span>

            {/* Descrição */}
            <div>
              <div className="desp-desc">
                {d.descricao}
                {d.parcelado && d.totalParcelas && (
                  <span className="parcel-badge" style={{ marginLeft: 6 }}>
                    {d.parcelaAtual}/{d.totalParcelas}
                  </span>
                )}
              </div>
              {d.observacao && <div className="desp-desc-obs">{d.observacao}</div>}
            </div>

            {/* Categoria */}
            <span className="cat-badge">{d.categoria || "—"}</span>

            {/* Valor */}
            <span className="desp-valor">{fmtR$(d.valor)}</span>

            {/* Vencimento */}
            <span>{fmtData(d.vencimento)}</span>

            {/* Status */}
            <StatusBadge status={d.status} />

            {/* Fornecedor */}
            <span style={{ color: "var(--text-2)", fontSize: 12 }}>{d.fornecedor || "—"}</span>

            {/* Data pagamento */}
            <span style={{ fontSize: 12 }}>
              {d.dataPagamento ? fmtData(d.dataPagamento) : "—"}
            </span>

            {/* Ações */}
            <div className="desp-actions" onClick={e => e.stopPropagation()}>
              {d.status !== "pago" && d.status !== "cancelado" && (
                <button
                  className="btn-icon btn-icon-pay"
                  title="Registrar pagamento"
                  onClick={() => setPagando(d)}
                >
                  <CheckCircle size={13} />
                </button>
              )}
              {d.status === "pago" && (
                <button
                  className="btn-icon btn-icon-undo"
                  title="Desfazer pagamento"
                  onClick={() => handleDesfazerPagamento(d)}
                >
                  <RotateCcw size={13} />
                </button>
              )}
              {podeEditarV && <button className="btn-icon btn-icon-edit" title="Editar" onClick={() => setEditando(d)}>
                <Edit2 size={13} />
              </button>}
              {podeExcluirV && <button className="btn-icon btn-icon-del" title="Excluir" onClick={() => setDeletando(d)}>
                <Trash2 size={13} />
              </button>}
            </div>
          </div>
        ))}
      </div>

      {/* Modais */}
      {viendoDetalhes && (
        <ModalDetalhes
          despesa={viendoDetalhes}
          onEditar={setEditando}
          onPagar={setPagando}
          onDesfazer={handleDesfazerPagamento}
          onDeletar={setDeletando}
          podeEditar={podeEditarV}
          podeExcluir={podeExcluirV}
          onClose={() => setViendoDetalhes(null)}
        />
      )}
      {modalCategorias && (
        <ModalCategorias
          categorias={categorias}
          onCriar={criarCategoria}
          onRenomear={renomearCategoria}
          onDesativar={desativarCategoria}
          onClose={() => setModalCategorias(false)}
        />
      )}
      {modalNovo && podeCriarV && (
        <ModalNovaDespesa
          despesas={despesas}
          categorias={categorias}
          onCriarCategoria={criarCategoria}
          onDesativarCategoria={desativarCategoria}
          onSave={handleAdd}
          onClose={() => setModalNovo(false)}
        />
      )}
      {editando && podeEditarV && (
        <ModalNovaDespesa
          despesa={editando}
          despesas={despesas}
          categorias={categorias}
          onCriarCategoria={criarCategoria}
          onDesativarCategoria={desativarCategoria}
          onSave={handleEdit}
          onClose={() => setEditando(null)}
        />
      )}
      {pagando && (
        <ModalPagar despesa={pagando} onConfirm={handlePagar} onClose={() => setPagando(null)} />
      )}
      {deletando && podeExcluirV && (
        <ModalConfirmDelete despesa={deletando} onConfirm={handleDelete} onClose={() => setDeletando(null)} />
      )}
    </div>
  );
}
