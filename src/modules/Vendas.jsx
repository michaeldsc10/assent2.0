/* ═══════════════════════════════════════════════════
   ASSENT v2.0 — Vendas.jsx
   Estrutura Firestore:
     users/{uid}/vendas/{id}        → cada venda
     users/{uid}/produtos/{id}      → estoque (qtd atualizado)
     users/{uid}/servicos/{id}      → serviços
     users/{uid}                    → vendaIdCnt (contador)
   ═══════════════════════════════════════════════════ */

import { useState, useEffect, useContext, useMemo, useRef } from "react";
import {
  Search, Plus, Edit2, Trash2, X, Printer,
  ShoppingCart, Package, ChevronDown, FileText,
  Download, Copy, Filter, Calendar, Ban,
} from "lucide-react";

import AuthContext from "../contexts/AuthContext";
import { db, auth } from "../lib/firebase";

import {
  collection, doc, setDoc, deleteDoc, updateDoc,
  onSnapshot, runTransaction, increment, getDoc, addDoc, serverTimestamp,
  query, where, getDocs,
} from "firebase/firestore";

/* ── CSS ── */
const CSS = `
  /* ── Modal base (igual ao Clientes) ── */
  .modal-overlay {
    position: fixed; inset: 0; z-index: 1000;
    background: rgba(0,0,0,0.78);
    backdrop-filter: blur(5px);
    display: flex; align-items: center; justify-content: center;
    padding: 20px; animation: fadeIn .15s ease;
  }
  .modal-overlay-top { z-index: 1100; }
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
  .modal-box-xl  { max-width: 820px; }
  .modal-box-lg  { max-width: 680px; }
  .modal-box-md  { max-width: 420px; }
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

  .btn-danger {
    padding: 9px 20px; border-radius: 9px;
    background: var(--red-d); color: var(--red);
    border: 1px solid rgba(224,82,82,.25); cursor: pointer;
    font-family: 'DM Sans', sans-serif; font-size: 13px;
    transition: background .13s;
    display: flex; align-items: center; gap: 6px;
  }
  .btn-danger:hover { background: rgba(224,82,82,.18); }
  .btn-danger:disabled { opacity: .5; cursor: not-allowed; }

  .btn-warning {
    padding: 9px 20px; border-radius: 9px;
    background: rgba(245,166,35,.12); color: #F5A623;
    border: 1px solid rgba(245,166,35,.25); cursor: pointer;
    font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 600;
    transition: background .13s;
    display: flex; align-items: center; gap: 6px;
  }
  .btn-warning:hover { background: rgba(245,166,35,.2); }
  .btn-warning:disabled { opacity: .5; cursor: not-allowed; }

  .btn-icon {
    width: 30px; height: 30px; border-radius: 7px;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; border: 1px solid transparent;
    background: transparent; transition: all .13s;
  }
  .btn-icon-edit { color: var(--blue); }
  .btn-icon-edit:hover { background: var(--blue-d); border-color: rgba(91,142,240,.2); }
  .btn-icon-del  { color: var(--red); }
  .btn-icon-del:hover  { background: var(--red-d); border-color: rgba(224,82,82,.2); }
  .btn-icon-cancel { color: #F5A623; }
  .btn-icon-cancel:hover { background: rgba(245,166,35,.12); border-color: rgba(245,166,35,.25); }
  .btn-icon-view { color: var(--text-2); }
  .btn-icon-view:hover { background: var(--s3); border-color: var(--border-h); }

  .btn-green {
    padding: 9px 20px; border-radius: 9px;
    background: rgba(74,222,128,.12); color: var(--green);
    border: 1px solid rgba(74,222,128,.2); cursor: pointer;
    font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 600;
    transition: background .13s;
    display: flex; align-items: center; gap: 6px;
  }
  .btn-green:hover { background: rgba(74,222,128,.2); }

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

  /* ── Topbar ── */
  .vd-topbar {
    padding: 14px 22px;
    background: var(--s1); border-bottom: 1px solid var(--border);
    display: flex; align-items: center; gap: 14px; flex-shrink: 0; flex-wrap: wrap;
  }
  .vd-topbar-title h1 {
    font-family: 'Sora', sans-serif; font-size: 17px; font-weight: 600;
    color: var(--text);
  }
  .vd-topbar-title p { font-size: 11px; color: var(--text-2); margin-top: 2px; }
  .vd-search {
    display: flex; align-items: center; gap: 8px;
    background: var(--s2); border: 1px solid var(--border);
    border-radius: 8px; padding: 8px 12px; width: 270px; flex: 1; min-width: 180px;
  }
  .vd-search input {
    background: transparent; border: none; outline: none;
    color: var(--text); font-size: 12px; width: 100%;
  }
  .vd-topbar-right { display: flex; align-items: center; gap: 8px; margin-left: auto; }

  /* ── Filtros de período ── */
  .vd-periods {
    display: flex; align-items: center; gap: 6px;
    padding: 12px 22px; border-bottom: 1px solid var(--border);
    background: var(--s1); flex-wrap: wrap;
  }
  .vd-period-btn {
    padding: 5px 13px; border-radius: 20px; font-size: 12px;
    font-family: 'DM Sans', sans-serif; cursor: pointer;
    border: 1px solid var(--border); background: var(--s2); color: var(--text-2);
    transition: all .13s;
  }
  .vd-period-btn:hover { border-color: var(--border-h); color: var(--text); }
  .vd-period-btn.active {
    background: var(--gold); color: #0a0808;
    border-color: var(--gold); font-weight: 600;
  }
  .vd-period-sep { width: 1px; height: 18px; background: var(--border); margin: 0 2px; }

  /* ── Tabela ── */
  .vd-table-wrap {
    background: var(--s1); border: 1px solid var(--border);
    border-radius: 12px; overflow: hidden;
  }
  .vd-table-header {
    padding: 13px 18px;
    border-bottom: 1px solid var(--border);
    display: flex; align-items: center; justify-content: space-between; gap: 10px;
  }
  .vd-table-title {
    font-family: 'Sora', sans-serif; font-size: 13px; font-weight: 600; color: var(--text);
    display: flex; align-items: center; gap: 8px;
  }
  .vd-count-badge {
    font-family: 'Sora', sans-serif; font-size: 11px; font-weight: 600;
    background: var(--s3); border: 1px solid var(--border-h);
    color: var(--text-2); padding: 2px 9px; border-radius: 20px;
  }
  .vd-table-actions { display: flex; gap: 6px; }

  .vd-export-btn {
    display: flex; align-items: center; gap: 5px;
    padding: 5px 11px; border-radius: 7px; font-size: 11px; font-weight: 600;
    cursor: pointer; border: 1px solid var(--border);
    background: var(--s2); color: var(--text-2);
    font-family: 'DM Sans', sans-serif; transition: all .13s;
  }
  .vd-export-btn:hover { background: var(--s3); color: var(--text); }

  .vd-row {
    display: grid;
    grid-template-columns: 72px 1fr 110px 180px 90px 80px 100px 80px;
    padding: 11px 18px; gap: 8px;
    border-bottom: 1px solid var(--border);
    align-items: center; font-size: 12px; color: var(--text-2);
    cursor: pointer; transition: background .1s;
  }
  .vd-row:last-child { border-bottom: none; }
  .vd-row:hover { background: rgba(255,255,255,0.025); }
  .vd-row-head { background: var(--s2); cursor: default; }
  .vd-row-head:hover { background: var(--s2); }
  .vd-row-head span {
    font-size: 10px; font-weight: 500; letter-spacing: .06em;
    text-transform: uppercase; color: var(--text-3);
  }

  .vd-vid { font-family: 'Sora', sans-serif; font-size: 11px; color: var(--gold); font-weight: 500; }
  .vd-cliente { color: var(--text); font-size: 13px; font-weight: 500; }
  .vd-fp-badge {
    display: inline-flex; align-items: center;
    padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: 600;
    background: var(--s3); border: 1px solid var(--border-h); color: var(--text-2);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 160px;
  }
  .vd-actions { display: flex; align-items: center; gap: 5px; justify-content: flex-end; }
  .vd-total { font-family: 'Sora', sans-serif; font-size: 12px; font-weight: 600; color: var(--green); }
  .vd-empty, .vd-loading { padding: 56px 20px; text-align: center; color: var(--text-3); font-size: 13px; }

  /* ── Modal Nova Venda ── */
  .nv-tabs {
    display: flex; gap: 6px; margin-bottom: 18px;
  }
  .nv-tab {
    display: flex; align-items: center; gap: 6px;
    padding: 7px 16px; border-radius: 9px; font-size: 12px; font-weight: 600;
    cursor: pointer; border: 1px solid var(--border);
    background: var(--s2); color: var(--text-2);
    font-family: 'DM Sans', sans-serif; transition: all .13s;
  }
  .nv-tab.active {
    background: var(--gold); color: #0a0808; border-color: var(--gold);
  }
  .nv-tab:not(.active):hover { background: var(--s3); color: var(--text); }

  /* autocomplete */
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

  /* itens da venda */
  .nv-items-header {
    display: flex; align-items: center; justify-content: space-between;
    margin-bottom: 10px;
  }
  .nv-items-label {
    font-size: 10px; font-weight: 600; letter-spacing: .07em;
    text-transform: uppercase; color: var(--text-2);
  }
  .nv-add-item-btn {
    display: flex; align-items: center; gap: 5px;
    padding: 5px 12px; border-radius: 8px; font-size: 12px; font-weight: 600;
    cursor: pointer; border: 1px solid rgba(200,165,94,.3);
    background: rgba(200,165,94,.08); color: var(--gold);
    font-family: 'DM Sans', sans-serif; transition: all .13s;
  }
  .nv-add-item-btn:hover { background: rgba(200,165,94,.14); }

  .nv-item-row {
    display: grid; grid-template-columns: 1fr 70px 110px 110px 90px 32px;
    gap: 8px; align-items: start; margin-bottom: 8px;
    padding: 10px; background: var(--s2); border: 1px solid var(--border);
    border-radius: 10px;
  }
  .nv-item-field-label {
    font-size: 9px; font-weight: 600; letter-spacing: .06em;
    text-transform: uppercase; color: var(--text-3); margin-bottom: 5px;
  }
  .nv-item-remove {
    width: 28px; height: 28px; border-radius: 7px;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; border: 1px solid transparent;
    background: transparent; color: var(--red); margin-top: 14px;
    transition: all .13s;
  }
  .nv-item-remove:hover { background: var(--red-d); border-color: rgba(224,82,82,.2); }

  .nv-totals-bar {
    display: flex; gap: 16px; padding: 12px 14px;
    background: var(--s2); border: 1px solid var(--border);
    border-radius: 10px; margin-top: 14px; flex-wrap: wrap;
  }
  .nv-total-cell { display: flex; flex-direction: column; gap: 2px; }
  .nv-total-label { font-size: 9px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: var(--text-3); }
  .nv-total-val { font-family: 'Sora', sans-serif; font-size: 13px; font-weight: 600; }

  .nv-section-sep {
    height: 1px; background: var(--border); margin: 18px 0;
  }

  /* ── Modal Detalhe Venda ── */
  .dv-meta {
    display: grid; grid-template-columns: 1fr 1fr 1fr;
    gap: 12px; margin-bottom: 18px;
  }
  .dv-meta-card {
    background: var(--s2); border: 1px solid var(--border);
    border-radius: 10px; padding: 10px 13px;
  }
  .dv-meta-label { font-size: 9px; font-weight: 600; letter-spacing: .07em; text-transform: uppercase; color: var(--text-3); margin-bottom: 4px; }
  .dv-meta-val { font-size: 13px; color: var(--text); font-weight: 500; }
  .dv-meta-obs {
    background: var(--s2); border: 1px solid var(--border);
    border-radius: 10px; padding: 10px 13px; margin-bottom: 18px;
  }
  .dv-table {
    background: var(--s2); border: 1px solid var(--border);
    border-radius: 10px; overflow: hidden; margin-bottom: 14px;
  }
  .dv-thead {
    display: grid; grid-template-columns: 1fr 60px 110px 110px 100px 110px;
    padding: 8px 12px; background: var(--s3);
    border-bottom: 1px solid var(--border); gap: 8px;
  }
  .dv-thead span {
    font-size: 9px; font-weight: 600; letter-spacing: .06em;
    text-transform: uppercase; color: var(--text-3);
  }
  .dv-trow {
    display: grid; grid-template-columns: 1fr 60px 110px 110px 100px 110px;
    padding: 10px 12px; border-bottom: 1px solid var(--border);
    gap: 8px; font-size: 12px; color: var(--text-2);
    align-items: center;
  }
  .dv-trow:last-child { border-bottom: none; }
  .dv-nome { color: var(--text); font-weight: 500; display: flex; align-items: center; gap: 6px; }
  .dv-totals {
    display: flex; gap: 12px; padding: 12px 14px;
    background: var(--s2); border: 1px solid var(--border);
    border-radius: 10px; flex-wrap: wrap;
  }
  .dv-total-cell { display: flex; flex-direction: column; gap: 2px; }
  .dv-total-label { font-size: 9px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: var(--text-3); }
  .dv-total-val { font-family: 'Sora', sans-serif; font-size: 13px; font-weight: 600; }

  .dv-imprimir {
    display: flex; align-items: center; gap: 6px;
    padding: 7px 14px; border-radius: 8px; font-size: 12px; font-weight: 600;
    cursor: pointer; border: 1px solid var(--border);
    background: var(--s3); color: var(--text-2);
    font-family: 'DM Sans', sans-serif; transition: all .13s;
    margin-bottom: 16px;
  }
  .dv-imprimir:hover { background: var(--s2); color: var(--text); }

  /* ── Confirm ── */
  .confirm-body {
    padding: 24px 22px; text-align: center;
    font-size: 13px; color: var(--text-2); line-height: 1.6;
  }
  .confirm-icon { font-size: 28px; margin-bottom: 12px; }

  /* ── Recibo Print ── */
  /*
   * ATENÇÃO: não usar "body > *:not(#recibo-print-root) { display:none }"
   * porque em React o #recibo-print-root fica dentro do #root (filho do body),
   * o que faz o #root inteiro sumir levando o recibo junto.
   * A abordagem correta é visibility: hidden no body e visible no root do recibo,
   * pois visibility pode ser sobreposta por filhos, diferente de display.
   */
  @media print {
    body { visibility: hidden !important; }
    #recibo-print-root {
      visibility: visible !important;
      display: block !important;
      position: fixed; top: 0; left: 0; width: 100%; z-index: 99999;
    }
    #recibo-print-root * { visibility: visible !important; }
    .recibo-print {
      font-family: 'Courier New', monospace;
      width: 80mm; margin: 0 auto; padding: 8mm;
      font-size: 12px; color: #000 !important; background: #fff;
    }
    .recibo-print * { color: #000 !important; }
  }
  #recibo-print-root { display: none; }

  /* ── Livre (venda sem produto) ── */
  .nv-livre-info {
    background: rgba(200,165,94,.07); border: 1px solid rgba(200,165,94,.2);
    border-radius: 10px; padding: 11px 14px; margin-bottom: 14px;
    font-size: 12px; color: var(--text-2);
  }
  .nv-livre-info strong { color: var(--gold); }

  /* ── Sinal (pagamento parcial) ── */
  .nv-sinal-box {
    background: rgba(91,142,240,.07); border: 1px solid rgba(91,142,240,.2);
    border-radius: 10px; padding: 12px 14px; margin-top: 10px;
  }
  .nv-sinal-row {
    display: flex; justify-content: space-between; align-items: center;
    font-size: 12px; color: var(--text-2); margin-bottom: 4px;
  }
  .nv-sinal-row:last-child { margin-bottom: 0; }
  .nv-sinal-restante {
    font-family: 'Sora', sans-serif; font-size: 14px; font-weight: 700; color: var(--blue);
  }

  /* ── Parcelas cartão ── */
  .nv-parcelas-wrap {
    display: flex; gap: 6px; flex-wrap: wrap; margin-top: 8px;
  }
  .nv-parcela-btn {
    padding: 5px 11px; border-radius: 7px; font-size: 11px; font-weight: 600;
    cursor: pointer; border: 1px solid var(--border);
    background: var(--s2); color: var(--text-2);
    font-family: 'DM Sans', sans-serif; transition: all .13s;
    white-space: nowrap;
  }
  .nv-parcela-btn:hover { background: var(--s3); color: var(--text); }
  .nv-parcela-btn.active {
    background: rgba(200,165,94,0.15); border-color: var(--gold); color: var(--gold);
  }
  .nv-taxa-info {
    font-size: 11px; color: var(--text-3); margin-top: 6px;
  }
  .nv-taxa-info strong { color: var(--text-2); }
`;

/* ── Helpers ── */
const fmtR$ = (v) =>
  `R$ ${Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

const fmtData = (d) => {
  if (!d) return "—";
  try {
    const dt = d?.toDate ? d.toDate() : new Date(d);
    return dt.toLocaleDateString("pt-BR");
  } catch { return String(d); }
};

const gerarIdVenda = (cnt) => `V${String(cnt + 1).padStart(4, "0")}`;

const PERIODS = ["Tudo", "Hoje", "7 dias", "30 dias", "Este mês"];
const FORMAS_PAGAMENTO = [
  "Pix", "Dinheiro", "Cartão de Crédito", "Cartão de Débito",
  "Boleto", "Transferência", "Sinal", "Parcelado", "Outro",
];

/* Taxas padrão — usadas como fallback enquanto o Firestore carrega */
const TAXAS_DEFAULT = {
  debito:     1.99,
  pix:        0,
  credito_1:  2.99, credito_2:  3.19, credito_3:  3.39,
  credito_4:  3.59, credito_5:  3.79, credito_6:  3.99,
  credito_7:  4.19, credito_8:  4.39, credito_9:  4.59,
  credito_10: 4.79, credito_11: 4.99, credito_12: 5.19,
};

function filtrarPorPeriodo(vendas, period) {
  if (period === "Tudo") return vendas;
  const now = new Date();
  const start = new Date();
  if (period === "Hoje") { start.setHours(0, 0, 0, 0); }
  else if (period === "7 dias") { start.setDate(now.getDate() - 7); }
  else if (period === "30 dias") { start.setDate(now.getDate() - 30); }
  else if (period === "Este mês") { start.setDate(1); start.setHours(0, 0, 0, 0); }
  return vendas.filter(v => {
    try {
      const dt = v.data?.toDate ? v.data.toDate() : new Date(v.data);
      return dt >= start;
    } catch { return false; }
  });
}

/* ── Recibo de impressão ── */
function imprimirRecibo(venda) {
  const el = document.getElementById("recibo-print-root");
  if (!el) return;
  const itens = venda.itens || [];
  const subtotal  = itens.reduce((s, i) => s + (i.preco || 0) * (i.qtd || 1), 0);
  const descontos = itens.reduce((s, i) => s + (i.desconto || 0), 0);

  /* Informações de parcelamento e taxa */
  const temTaxa   = venda.valorTaxa > 0;
  const temParc   = venda.parcelas > 1;
  const pgtoLabel = temParc
    ? `${venda.formaPagamento} — ${venda.parcelas}x`
    : (venda.formaPagamento || "—");

  el.innerHTML = `
    <div class="recibo-print">
      <div style="text-align:center;font-weight:bold;font-size:14px;margin-bottom:8px;">ASSENT</div>
      <div style="text-align:center;font-size:11px;margin-bottom:12px;">Recibo de Venda</div>
      <div>ID: ${venda.id}</div>
      <div>Data: ${fmtData(venda.data)}</div>
      <div>Cliente: ${venda.cliente || "—"}</div>
      <div>Pgto: ${pgtoLabel}</div>
      <div style="border-top:1px dashed #000;margin:8px 0;"></div>
      ${itens.map(i => `
        <div>${i.nome || i.produto || "Item livre"}</div>
        <div style="display:flex;justify-content:space-between;font-size:11px;">
          <span>${i.qtd}x ${fmtR$(i.preco)}</span>
          <span>${fmtR$((i.preco || 0) * (i.qtd || 1) - (i.desconto || 0))}</span>
        </div>
      `).join("")}
      <div style="border-top:1px dashed #000;margin:8px 0;"></div>
      ${descontos > 0 ? `<div style="display:flex;justify-content:space-between;"><span>Descontos</span><span>-${fmtR$(descontos)}</span></div>` : ""}
      ${temTaxa ? `<div style="display:flex;justify-content:space-between;font-size:11px;color:#555;"><span>Taxa cartão (${venda.taxaPercentual}%)</span><span>${fmtR$(venda.valorTaxa)}</span></div>` : ""}
      <div style="display:flex;justify-content:space-between;font-weight:bold;font-size:14px;">
        <span>TOTAL</span><span>${fmtR$(venda.total)}</span>
      </div>
      ${temParc ? `<div style="font-size:11px;margin-top:4px;text-align:right;">${venda.parcelas}x de ${fmtR$(venda.total / venda.parcelas)}</div>` : ""}
      ${venda.formaPagamento === "Sinal" && venda.valorPago != null ? `
        <div style="border-top:1px dashed #000;margin:8px 0;"></div>
        <div style="display:flex;justify-content:space-between;font-size:12px;">
          <span>Sinal recebido</span><span>${fmtR$(venda.valorPago)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:12px;font-weight:bold;">
          <span>Restante a pagar</span><span>${fmtR$(venda.valorRestante)}</span>
        </div>
        ${venda.dataVencSinal ? `<div style="font-size:11px;color:#555;">Vencimento: ${venda.dataVencSinal.split("-").reverse().join("/")}</div>` : ""}
      ` : ""}
      ${venda.observacao ? `<div style="margin-top:10px;font-size:11px;">Obs: ${venda.observacao}</div>` : ""}
      <div style="text-align:center;font-size:10px;margin-top:12px;">Obrigado!</div>
    </div>
  `;
  window.print();
}

/* ── Exportar CSV ── */
function exportarCSV(vendas) {
  const header = "ID,Cliente,Data,Pagamento,Vendedor,Itens,Total\n";
  const rows = vendas.map(v =>
    `${v.id},"${v.cliente || ""}","${fmtData(v.data)}","${v.formaPagamento || ""}","${v.vendedor || ""}",${v.itens?.length || 0},${v.total || 0}`
  ).join("\n");
  const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "vendas.csv"; a.click();
  URL.revokeObjectURL(url);
}


/* ══════════════════════════════════════════════════
   MODAL: Nova / Editar Venda  ← VERSÃO CORRIGIDA
   ══════════════════════════════════════════════════ */
function ModalNovaVenda({ venda, uid, cargo, vendedorId: vendedorIdLogado, vendedorNome: vendedorNomeLogado, clientes, produtos, servicos, vendedores, taxas, onSave, onClose }) {
  const isEdit = !!venda;

  const [tipo, setTipo] = useState(venda?.tipo || "produto");

  // Cabeçalho
  const [clienteSearch, setClienteSearch] = useState(venda?.cliente || "");
  const [clienteAC, setClienteAC] = useState(false);
  const [dataVenda, setDataVenda] = useState(
    venda?.data 
      ? (venda.data?.toDate 
          ? venda.data.toDate().toISOString().split("T")[0] 
          : new Date(venda.data).toISOString().split("T")[0]) 
      : new Date().toISOString().split("T")[0]
  );
  // Se o usuário logado é vendedor: sempre usa o próprio nome (nova venda ou edição)
  const [vendedor, setVendedor] = useState(
    cargo === "vendedor"
      ? (vendedorNomeLogado || venda?.vendedor || "")
      : (venda?.vendedor || "")
  );
  const [formaPgto, setFormaPgto] = useState(venda?.formaPagamento || "");
  const [observacao, setObservacao] = useState(venda?.observacao || "");

  /* Parcelas — só relevante quando formaPgto === "Cartão de Crédito" */
  const [parcelas, setParcelas] = useState(venda?.parcelas || 1);

  /* Sinal — só relevante quando formaPgto === "Sinal" */
  const [valorSinal, setValorSinal]       = useState(venda?.valorPago != null ? String(venda.valorPago) : "");
  const [dataVencSinal, setDataVencSinal] = useState(venda?.dataVencSinal || "");

  // Itens + Venda livre
  const [itens, setItens] = useState(
    venda?.itens?.length ? venda.itens : [itemVazio(venda?.tipo || "produto")]
  );

  const [livreNome, setLivreNome] = useState(venda?.livreNome || "");
  const [livreValor, setLivreValor] = useState(venda?.livreValor || "");
  const [livreDesc, setLivreDesc] = useState(venda?.livreDesc || 0);

  // ←←← ESTADOS NECESSÁRIOS PARA AUTOCOMPLETE
  const [itemSearches, setItemSearches] = useState(
    venda?.itens?.length 
      ? venda.itens.map(i => i.nome || "") 
      : [""]
  );
  const [itemAC, setItemAC] = useState(null); // índice do item com autocomplete aberto

  const [salvando, setSalvando] = useState(false);
  const [erros, setErros] = useState({});

  function itemVazio(tipoAtual = "produto") {
    return {
      produtoId: "",
      nome: "",
      qtd: 1,
      preco: 0,
      custo: 0,
      desconto: 0,
      tipo: tipoAtual,
    };
  }

  /* Atualiza o tipo de todos os itens quando o tipo da venda muda */
  useEffect(() => {
    setItens(prevItens =>
      prevItens.map(item => ({
        ...item,
        tipo,
      }))
    );
  }, [tipo]);

  /* Autocomplete de produtos/serviços */
  const catalogoFiltrado = (search, idx) => {
    const lista = tipo === "servico" ? servicos : produtos;
    if (!search.trim()) return lista.slice(0, 8);
    const q = search.toLowerCase();
    return lista.filter(p =>
      p.nome?.toLowerCase().includes(q) || p.id?.toLowerCase().includes(q)
    ).slice(0, 8);
  };

  const selecionarProduto = (idx, prod) => {
    const novo = [...itens];
    novo[idx] = {
      ...novo[idx],
      produtoId: prod.id,
      nome: prod.nome,
      preco: prod.preco || 0,
      custo: prod.custo || prod.precoCusto || 0,
      tipo: tipo,
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
    setItens(novo);
  };

  const adicionarItem = () => {
    setItens([...itens, itemVazio(tipo)]);
    setItemSearches([...itemSearches, ""]);
  };

  const removerItem = (idx) => {
    if (itens.length === 1) return;
    setItens(itens.filter((_, i) => i !== idx));
    setItemSearches(itemSearches.filter((_, i) => i !== idx));
  };

  /* Cálculos */
  const calculos = useMemo(() => {
    if (tipo === "livre") {
      const val = parseFloat(livreValor) || 0;
      const desc = parseFloat(livreDesc) || 0;
      return { subtotal: val, descontos: desc, custo: 0, total: val - desc, lucro: val - desc };
    }
    const subtotal  = itens.reduce((s, i) => s + (parseFloat(i.preco) || 0) * (parseInt(i.qtd) || 1), 0);
    const descontos = itens.reduce((s, i) => s + (parseFloat(i.desconto) || 0), 0);
    const custo     = itens.reduce((s, i) => s + (parseFloat(i.custo) || 0) * (parseInt(i.qtd) || 1), 0);
    const total     = subtotal - descontos;
    return { subtotal, descontos, custo, total, lucro: total - custo };
  }, [itens, tipo, livreValor, livreDesc]);

  /* ── Taxa de cartão/pix — calculado de forma isolada, não altera lógica de calculos ── */
  const taxaInfo = useMemo(() => {
    const isCredito = formaPgto === "Cartão de Crédito";
    const isDebito  = formaPgto === "Cartão de Débito";
    const isPix     = formaPgto === "Pix";

    /* PIX: só aplica se a taxa configurada for > 0 */
    if (isPix) {
      const taxaPercentual = parseFloat(taxas?.pix ?? TAXAS_DEFAULT.pix ?? 0) || 0;
      if (taxaPercentual === 0) {
        return { taxaPercentual: 0, valorTaxa: 0, parcelas: null, exibe: false, lucroReal: calculos.lucro };
      }
      const valorTaxa = parseFloat((calculos.total * (taxaPercentual / 100)).toFixed(2));
      const lucroReal = parseFloat((calculos.lucro - valorTaxa).toFixed(2));
      return { taxaPercentual, valorTaxa, parcelas: null, exibe: true, lucroReal };
    }

    if (!isCredito && !isDebito) {
      return { taxaPercentual: 0, valorTaxa: 0, parcelas: null, exibe: false, lucroReal: calculos.lucro };
    }

    let chave, numParcelas;
    if (isDebito) {
      chave = "debito";
      numParcelas = null;
    } else {
      numParcelas = parcelas || 1;
      chave = `credito_${numParcelas}`;
    }

    const taxaPercentual = parseFloat(taxas?.[chave] ?? TAXAS_DEFAULT[chave] ?? 0) || 0;
    const valorTaxa = parseFloat((calculos.total * (taxaPercentual / 100)).toFixed(2));
    /* Taxa é custo operacional — deduz diretamente do lucro */
    const lucroReal = parseFloat((calculos.lucro - valorTaxa).toFixed(2));

    return { taxaPercentual, valorTaxa, parcelas: numParcelas, exibe: true, lucroReal };
  }, [formaPgto, parcelas, taxas, calculos.total, calculos.lucro]);

  /* ── Sinal — cálculo isolado, não toca em calculos ── */
  const sinalInfo = useMemo(() => {
    if (formaPgto !== "Sinal") return { ativo: false, valorPagoNum: 0, valorRestante: 0 };
    const valorPagoNum = parseFloat(String(valorSinal).replace(",", ".")) || 0;
    const valorRestante = parseFloat((calculos.total - valorPagoNum).toFixed(2));
    return { ativo: true, valorPagoNum, valorRestante };
  }, [formaPgto, valorSinal, calculos.total]);

  const validar = () => {
    const e = {};
    if (!clienteSearch.trim()) e.cliente = "Informe o cliente.";
    if (!formaPgto) e.formaPgto = "Selecione a forma de pagamento.";
    if (tipo === "livre") {
      if (!livreNome.trim()) e.livreNome = "Informe uma descrição.";
      if (!livreValor || parseFloat(livreValor) <= 0) e.livreValor = "Informe o valor.";
    }
    /* Validações exclusivas do Sinal */
    if (formaPgto === "Sinal") {
      if (!sinalInfo.valorPagoNum || sinalInfo.valorPagoNum <= 0)
        e.valorSinal = "Informe o valor do sinal (maior que zero).";
      else if (sinalInfo.valorPagoNum >= calculos.total)
        e.valorSinal = "O sinal deve ser menor que o total da venda.";
      if (!dataVencSinal)
        e.dataVencSinal = "Data de vencimento do restante é obrigatória.";
    }
    setErros(e);
    return Object.keys(e).length === 0;
  };

  const handleSalvar = async () => {
    if (!validar()) return;
    setSalvando(true);

    const payload = {
      cliente: clienteSearch.trim(),
      data: new Date(dataVenda + "T12:00:00"),
      vendedor: vendedor.trim(),
      formaPagamento: formaPgto,
      observacao: observacao.trim(),
      tipo,
      total: calculos.total,
      subtotal: calculos.subtotal,
      descontos: calculos.descontos,
      custoTotal: calculos.custo,
      /* Taxa é custo operacional — lucro já deduz a taxa */
      lucroEstimado: taxaInfo.lucroReal,
      /* ── Taxa de cartão (0 quando não é cartão — compatível com dados antigos) ── */
      parcelas:       taxaInfo.parcelas,
      taxaPercentual: taxaInfo.taxaPercentual,
      valorTaxa:      taxaInfo.valorTaxa,
      /* ── Sinal (null quando não é sinal — compatível com dados antigos) ── */
      valorPago:      sinalInfo.ativo ? sinalInfo.valorPagoNum    : null,
      valorRestante:  sinalInfo.ativo ? sinalInfo.valorRestante   : null,
      dataVencSinal:  sinalInfo.ativo ? dataVencSinal             : null,
      /* ── Controle de recebimento — regime de caixa puro ──
         statusPagamento: "recebido" | "parcial" | "pendente"
         valorRecebido  : valor que efetivamente entrou no caixa neste momento.
         Vendas antigas sem este campo são tratadas como "recebido" (fallback). */
      statusPagamento: sinalInfo.ativo
        ? (sinalInfo.valorPagoNum > 0 ? "parcial" : "pendente")
        : "recebido",
      valorRecebido: sinalInfo.ativo
        ? sinalInfo.valorPagoNum
        : calculos.total,
    };

    if (tipo === "livre") {
      payload.itens = [{
        nome: livreNome.trim(),
        qtd: 1,
        preco: parseFloat(livreValor) || 0,
        custo: 0,
        desconto: parseFloat(livreDesc) || 0,
        produtoId: null,
        tipo: "livre",
      }];
      payload.livreNome = livreNome.trim();
      payload.livreValor = parseFloat(livreValor) || 0;
      payload.livreDesc = parseFloat(livreDesc) || 0;
    } else {
      payload.itens = itens.map(i => ({
        produtoId: i.produtoId || null,
        nome: i.nome,
        qtd: parseInt(i.qtd) || 1,
        preco: parseFloat(i.preco) || 0,
        custo: parseFloat(i.custo) || 0,
        desconto: parseFloat(i.desconto) || 0,
        tipo,
      }));
    }

    await onSave(payload, isEdit ? venda : null);
    setSalvando(false);
  };

  /* Autocomplete clientes */
  const clientesFiltrados = useMemo(() => {
    if (!clienteSearch.trim()) return clientes.slice(0, 6);
    const q = clienteSearch.toLowerCase();
    return clientes.filter(c =>
      c.nome?.toLowerCase().includes(q) || c.cpf?.toLowerCase().includes(q)
    ).slice(0, 6);
  }, [clientes, clienteSearch]);

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box modal-box-xl">

        <div className="modal-header">
          <div>
            <div className="modal-title">{isEdit ? `Editando ${venda.id}` : "Nova Venda"}</div>
            <div className="modal-sub">{isEdit ? "Altere os dados e salve" : "Registre uma nova venda"}</div>
          </div>
          <button className="modal-close" onClick={onClose}>
            <X size={14} color="var(--text-2)" />
          </button>
        </div>

        <div className="modal-body">

          {/* Tabs tipo */}
          <div className="nv-tabs">
            <button className={`nv-tab ${tipo === "produto" ? "active" : ""}`} onClick={() => setTipo("produto")}>
              <Package size={13} /> Produto
            </button>
            <button className={`nv-tab ${tipo === "servico" ? "active" : ""}`} onClick={() => setTipo("servico")}>
              🎯 Serviço
            </button>
            <button className={`nv-tab ${tipo === "livre" ? "active" : ""}`} onClick={() => setTipo("livre")}>
              <FileText size={13} /> Valor Livre
            </button>
          </div>

          {/* Cabeçalho */}
          <div className="form-row">
            <div className="form-group nv-autocomplete">
              <label className="form-label">Cliente <span className="form-label-req">*</span></label>
              <input
                className={`form-input ${erros.cliente ? "err" : ""}`}
                placeholder="Buscar por nome ou CPF..."
                value={clienteSearch}
                onChange={e => { setClienteSearch(e.target.value); setClienteAC(true); }}
                onFocus={() => setClienteAC(true)}
                onBlur={() => setTimeout(() => setClienteAC(false), 180)}
                autoComplete="off"
              />
              {erros.cliente && <div className="form-error">{erros.cliente}</div>}
              {clienteAC && (
                <div className="nv-ac-list">
                  {clientesFiltrados.length === 0
                    ? <div className="nv-ac-empty">Nenhum cliente encontrado</div>
                    : clientesFiltrados.map(c => (
                        <div key={c.id} className="nv-ac-item" 
                             onMouseDown={() => { setClienteSearch(c.nome); setClienteAC(false); }}>
                          <span>{c.nome}</span>
                          <span className="nv-ac-item-sub">{c.cpf || c.telefone || ""}</span>
                        </div>
                      ))
                  }
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Data da Venda</label>
              <input
                type="date"
                className="form-input"
                value={dataVenda}
                onChange={e => setDataVenda(e.target.value)}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Vendedor</label>
              {cargo === "vendedor" ? (
                /* Vendedor logado: campo travado no próprio nome */
                <input
                  className="form-input"
                  value={vendedorNomeLogado || vendedor || "—"}
                  readOnly
                  disabled
                  style={{ opacity: 0.7, cursor: "not-allowed" }}
                  title="Você só pode registrar vendas em seu próprio nome"
                />
              ) : vendedores?.length > 0 ? (
                <select className="form-input" value={vendedor} onChange={e => setVendedor(e.target.value)}>
                  <option value="">— Nenhum / Não informado —</option>
                  {vendedores.map(v => (
                    <option key={v.id || v} value={v.nome || v}>{v.nome || v}</option>
                  ))}
                </select>
              ) : (
                <input 
                  className="form-input" 
                  placeholder="Nome do vendedor..." 
                  value={vendedor} 
                  onChange={e => setVendedor(e.target.value)} 
                />
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Forma de Pagamento <span className="form-label-req">*</span></label>
              <select 
                className={`form-input ${erros.formaPgto ? "err" : ""}`} 
                value={formaPgto} 
                onChange={e => {
                  setFormaPgto(e.target.value);
                  setParcelas(1);
                  setValorSinal("");
                  setDataVencSinal("");
                }}
              >
                <option value="">— Selecionar —</option>
                {FORMAS_PAGAMENTO.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
              {erros.formaPgto && <div className="form-error">{erros.formaPgto}</div>}

              {/* Seletor de parcelas — aparece somente para Cartão de Crédito */}
              {formaPgto === "Cartão de Crédito" && (
                <div style={{ marginTop: 10 }}>
                  <div className="form-label" style={{ marginBottom: 6 }}>Parcelas</div>
                  <div className="nv-parcelas-wrap">
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(n => {
                      const chave = `credito_${n}`;
                      const taxa  = parseFloat(taxas?.[chave] ?? TAXAS_DEFAULT[chave] ?? 0);
                      return (
                        <button
                          key={n}
                          type="button"
                          className={`nv-parcela-btn ${parcelas === n ? "active" : ""}`}
                          onClick={() => setParcelas(n)}
                        >
                          {n}x <span style={{ opacity: 0.7, fontSize: 10 }}>({taxa}%)</span>
                        </button>
                      );
                    })}
                  </div>
                  {taxaInfo.taxaPercentual > 0 && (
                    <div className="nv-taxa-info">
                      Taxa de <strong>{taxaInfo.taxaPercentual}%</strong> = <strong>{fmtR$(taxaInfo.valorTaxa)}</strong> sobre o total
                    </div>
                  )}
                </div>
              )}

              {/* Campos do Sinal — só para pagamento "Sinal" */}
              {formaPgto === "Sinal" && (
                <div style={{ marginTop: 12 }}>
                  <div className="form-row" style={{ marginBottom: 0 }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">
                        Valor do Sinal (R$) <span className="form-label-req">*</span>
                      </label>
                      <input
                        type="number" min="0.01" step="0.01"
                        className={`form-input ${erros.valorSinal ? "err" : ""}`}
                        placeholder="0,00"
                        value={valorSinal}
                        onChange={e => { setValorSinal(e.target.value); setErros(ev => ({ ...ev, valorSinal: "" })); }}
                      />
                      {erros.valorSinal && <div className="form-error">{erros.valorSinal}</div>}
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">
                        Vencimento do Restante <span className="form-label-req">*</span>
                      </label>
                      <input
                        type="date"
                        className={`form-input ${erros.dataVencSinal ? "err" : ""}`}
                        value={dataVencSinal}
                        onChange={e => { setDataVencSinal(e.target.value); setErros(ev => ({ ...ev, dataVencSinal: "" })); }}
                      />
                      {erros.dataVencSinal && <div className="form-error">{erros.dataVencSinal}</div>}
                    </div>
                  </div>

                  {/* Resumo do sinal em tempo real */}
                  {sinalInfo.valorPagoNum > 0 && sinalInfo.valorPagoNum < calculos.total && (
                    <div className="nv-sinal-box">
                      <div className="nv-sinal-row">
                        <span>Total da venda</span>
                        <span style={{ fontFamily: "Sora, sans-serif", fontWeight: 600, color: "var(--text)" }}>
                          {fmtR$(calculos.total)}
                        </span>
                      </div>
                      <div className="nv-sinal-row">
                        <span>Sinal (recebido agora)</span>
                        <span style={{ color: "var(--green)", fontFamily: "Sora, sans-serif", fontWeight: 600 }}>
                          {fmtR$(sinalInfo.valorPagoNum)}
                        </span>
                      </div>
                      <div className="nv-sinal-row">
                        <span style={{ fontWeight: 600, color: "var(--text)" }}>Restante (A Receber)</span>
                        <span className="nv-sinal-restante">{fmtR$(sinalInfo.valorRestante)}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="nv-section-sep" />

          {/* Itens da venda */}
          {tipo === "livre" ? (
            /* ... (parte de venda livre - mantida igual) ... */
            <>
              <div className="nv-livre-info">
                <strong>Venda de Valor Livre</strong> — sem produto ou serviço cadastrado.
                Informe a descrição e o valor abaixo.
              </div>
              <div className="form-row-3">
                <div className="form-group" style={{ gridColumn: "1/3" }}>
                  <label className="form-label">Descrição <span className="form-label-req">*</span></label>
                  <input
                    className={`form-input ${erros.livreNome ? "err" : ""}`}
                    placeholder="Ex: Serviço personalizado..."
                    value={livreNome}
                    onChange={e => setLivreNome(e.target.value)}
                  />
                  {erros.livreNome && <div className="form-error">{erros.livreNome}</div>}
                </div>
                <div className="form-group" style={{ gridColumn: "3/4" }}>
                  <label className="form-label">Valor (R$) <span className="form-label-req">*</span></label>
                  <input
                    type="number" min="0" step="0.01"
                    className={`form-input ${erros.livreValor ? "err" : ""}`}
                    placeholder="0,00"
                    value={livreValor}
                    onChange={e => setLivreValor(e.target.value)}
                  />
                  {erros.livreValor && <div className="form-error">{erros.livreValor}</div>}
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Desconto (R$)</label>
                  <input
                    type="number" min="0" step="0.01"
                    className="form-input"
                    placeholder="0"
                    value={livreDesc}
                    onChange={e => setLivreDesc(e.target.value)}
                  />
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="nv-items-header">
                <span className="nv-items-label">Itens da Venda</span>
                <button className="nv-add-item-btn" onClick={adicionarItem}>
                  <Plus size={12} /> Adicionar item
                </button>
              </div>

              {itens.map((item, idx) => (
                <div key={idx} className="nv-item-row">
                  <div style={{ position: "relative" }}>
                    <div className="nv-item-field-label">
                      {tipo === "servico" ? "Serviço" : "Produto"}
                    </div>
                    <input
                      className="form-input"
                      placeholder={`Buscar ${tipo === "servico" ? "serviço" : "produto"}...`}
                      value={itemSearches[idx] || ""}
                      onChange={e => {
                        const ns = [...itemSearches];
                        ns[idx] = e.target.value;
                        setItemSearches(ns);
                        /* Ao redigitar, desvincula o item do catálogo —
                           o usuário precisa selecionar novamente para bloquear o preço */
                        const novo = [...itens];
                        novo[idx] = { ...novo[idx], nome: e.target.value, produtoId: "" };
                        setItens(novo);
                        setItemAC(idx);
                      }}
                      onFocus={() => setItemAC(idx)}
                      onBlur={() => setTimeout(() => setItemAC(null), 180)}
                      autoComplete="off"
                    />
                    {itemAC === idx && (
                      <div className="nv-ac-list">
                        {catalogoFiltrado(itemSearches[idx] || "", idx).length === 0
                          ? <div className="nv-ac-empty">Nenhum item encontrado</div>
                          : catalogoFiltrado(itemSearches[idx] || "", idx).map(p => (
                              <div 
                                key={p.id} 
                                className="nv-ac-item" 
                                onMouseDown={() => selecionarProduto(idx, p)}
                              >
                                <span>{p.nome}</span>
                                <span className="nv-ac-item-sub">{fmtR$(p.preco || 0)}</span>
                              </div>
                            ))
                        }
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="nv-item-field-label">Qtd</div>
                    <input
                      type="number" min="1"
                      className="form-input"
                      value={item.qtd}
                      onChange={e => atualizarItem(idx, "qtd", e.target.value)}
                    />
                  </div>

                  <div>
                    <div className="nv-item-field-label">
                      Preço Unit. (R$)
                      {item.produtoId && (
                        <span
                          title="Valor definido pelo cadastro — não editável"
                          style={{ marginLeft: 5, fontSize: 10, color: "var(--text-3)", verticalAlign: "middle" }}
                        >🔒</span>
                      )}
                    </div>
                    <input
                      type="number" min="0" step="0.01"
                      className="form-input"
                      value={item.preco}
                      readOnly={!!item.produtoId}
                      style={item.produtoId
                        ? { opacity: 0.6, cursor: "not-allowed", background: "var(--s3)", userSelect: "none" }
                        : {}}
                      onChange={e => !item.produtoId && atualizarItem(idx, "preco", e.target.value)}
                    />
                  </div>

                  <div>
                    <div className="nv-item-field-label">
                      Custo Unit. (R$)
                      {item.produtoId && (
                        <span
                          title="Valor definido pelo cadastro — não editável"
                          style={{ marginLeft: 5, fontSize: 10, color: "var(--text-3)", verticalAlign: "middle" }}
                        >🔒</span>
                      )}
                    </div>
                    <input
                      type="number" min="0" step="0.01"
                      className="form-input"
                      value={item.custo}
                      readOnly={!!item.produtoId}
                      style={item.produtoId
                        ? { opacity: 0.6, cursor: "not-allowed", background: "var(--s3)", userSelect: "none" }
                        : {}}
                      onChange={e => !item.produtoId && atualizarItem(idx, "custo", e.target.value)}
                    />
                  </div>

                  <div>
                    <div className="nv-item-field-label">Desconto (R$)</div>
                    <input
                      type="number" min="0" step="0.01"
                      className="form-input"
                      value={item.desconto}
                      onChange={e => atualizarItem(idx, "desconto", e.target.value)}
                    />
                  </div>

                  <button 
                    className="nv-item-remove" 
                    onClick={() => removerItem(idx)} 
                    disabled={itens.length === 1}
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}
            </>
          )}

          {/* Totais */}
          <div className="nv-totals-bar">
            <div className="nv-total-cell">
              <div className="nv-total-label">Subtotal</div>
              <div className="nv-total-val" style={{ color: "var(--text)" }}>{fmtR$(calculos.subtotal)}</div>
            </div>
            <div className="nv-total-cell">
              <div className="nv-total-label">Descontos</div>
              <div className="nv-total-val" style={{ color: "var(--red)" }}>{fmtR$(calculos.descontos)}</div>
            </div>
            {tipo !== "livre" && (
              <div className="nv-total-cell">
                <div className="nv-total-label">Custo Total</div>
                <div className="nv-total-val" style={{ color: "var(--red)" }}>{fmtR$(calculos.custo)}</div>
              </div>
            )}
            {taxaInfo.exibe && (
              <div className="nv-total-cell">
                <div className="nv-total-label">Taxa {formaPgto === "Pix" ? "PIX" : "Cartão"} ({taxaInfo.taxaPercentual}%)</div>
                <div className="nv-total-val" style={{ color: "var(--red)" }}>{fmtR$(taxaInfo.valorTaxa)}</div>
              </div>
            )}
            <div className="nv-total-cell">
              <div className="nv-total-label">Total</div>
              <div className="nv-total-val" style={{ color: "var(--green)" }}>{fmtR$(calculos.total)}</div>
            </div>
            <div className="nv-total-cell">
              <div className="nv-total-label">Lucro Est.</div>
              <div className="nv-total-val" style={{ color: "var(--gold)" }}>{fmtR$(taxaInfo.lucroReal)}</div>
            </div>
          </div>

          <div className="nv-section-sep" />

          {/* Observação */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Observação da Venda</label>
            <textarea
              className="form-input"
              style={{ resize: "vertical", minHeight: 70 }}
              placeholder="Ex: Cliente pediu entrega..."
              value={observacao}
              onChange={e => setObservacao(e.target.value)}
            />
          </div>

        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" onClick={handleSalvar} disabled={salvando}>
            {salvando ? "Salvando..." : isEdit ? "Salvar Alterações" : "✓ Finalizar Venda"}
          </button>
        </div>

      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════
   MODAL: Detalhe de Venda (clique na linha)
   ══════════════════════════════════════════════════ */
function ModalDetalheVenda({ venda, onClose, onEditar, onCancelar, onExcluirDef, isAdmin }) {
  if (!venda) return null;
  const itens = venda.itens || [];

  const subtotal   = itens.reduce((s, i) => s + (i.preco || 0) * (i.qtd || 1), 0);
  const descontos  = itens.reduce((s, i) => s + (i.desconto || 0), 0);
  const custoTotal = itens.reduce((s, i) => s + (i.custo || 0) * (i.qtd || 1), 0);
  const total      = typeof venda.total === "number" ? venda.total : subtotal - descontos;
  const lucro      = total - custoTotal;

  return (
    <div className="modal-overlay modal-overlay-top" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box modal-box-lg">

        <div className="modal-header">
          <div>
            <div className="modal-title" style={{ color: "var(--gold)" }}>{venda.id}</div>
            <div className="modal-sub">Detalhes da venda</div>
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            {onEditar && (
              <button className="btn-icon btn-icon-edit" onClick={() => onEditar(venda)} title="Editar">
                <Edit2 size={13} />
              </button>
            )}
            {onCancelar && (
              <button className="btn-icon btn-icon-cancel" onClick={() => onCancelar(venda)} title="Cancelar venda">
                <Ban size={13} />
              </button>
            )}
            {isAdmin && onExcluirDef && (
              <button className="btn-icon btn-icon-del" onClick={() => onExcluirDef(venda)} title="Excluir permanentemente">
                <Trash2 size={13} />
              </button>
            )}
            <button className="modal-close" onClick={onClose}>
              <X size={14} color="var(--text-2)" />
            </button>
          </div>
        </div>

        <div className="modal-body">

          {/* Meta cards */}
          <div className="dv-meta">
            <div className="dv-meta-card">
              <div className="dv-meta-label">Cliente</div>
              <div className="dv-meta-val">{venda.cliente || "—"}</div>
            </div>
            <div className="dv-meta-card">
              <div className="dv-meta-label">Data</div>
              <div className="dv-meta-val">{fmtData(venda.data)}</div>
            </div>
            <div className="dv-meta-card">
              <div className="dv-meta-label">Pagamento</div>
              <div className="dv-meta-val">
                {venda.formaPagamento || "—"}
                {venda.parcelas > 1 && (
                  <span style={{ marginLeft: 6, fontSize: 11, color: "var(--gold)" }}>
                    {venda.parcelas}x
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Taxa — exibe somente se existir */}
          {venda.valorTaxa > 0 && (
            <div className="dv-meta" style={{ gridTemplateColumns: "1fr 1fr", marginTop: -6 }}>
              <div className="dv-meta-card">
                <div className="dv-meta-label">
                  Taxa {venda.formaPagamento === "Pix" ? "PIX" : "Cartão"} ({venda.taxaPercentual}%)
                </div>
                <div className="dv-meta-val" style={{ color: "var(--red)" }}>{fmtR$(venda.valorTaxa)}</div>
              </div>
              {venda.parcelas > 1 && (
                <div className="dv-meta-card">
                  <div className="dv-meta-label">Valor por Parcela</div>
                  <div className="dv-meta-val">{fmtR$(venda.total / venda.parcelas)}</div>
                </div>
              )}
            </div>
          )}

          {venda.vendedor && (
            <div className="dv-meta" style={{ gridTemplateColumns: "1fr", marginTop: -6 }}>
              <div className="dv-meta-card">
                <div className="dv-meta-label">Vendedor</div>
                <div className="dv-meta-val">{venda.vendedor}</div>
              </div>
            </div>
          )}

          {venda.observacao && (
            <div className="dv-meta-obs" style={{ marginTop: 6 }}>
              <div className="dv-meta-label" style={{ marginBottom: 4 }}>Observação</div>
              <div style={{ fontSize: 13, color: "var(--text-2)" }}>{venda.observacao}</div>
            </div>
          )}

          {/* Botão imprimir */}
          <button className="dv-imprimir" onClick={() => imprimirRecibo(venda)}>
            <Printer size={13} /> Reimprimir Recibo
          </button>

          {/* Tabela de itens */}
          <div className="dv-table">
            <div className="dv-thead">
              <span>PRODUTO / SERVIÇO</span>
              <span style={{ textAlign: "center" }}>QTD</span>
              <span style={{ textAlign: "right" }}>PREÇO UNIT.</span>
              <span style={{ textAlign: "right" }}>CUSTO UNIT.</span>
              <span style={{ textAlign: "right" }}>DESCONTO</span>
              <span style={{ textAlign: "right" }}>TOTAL ITEM</span>
            </div>
            {itens.length === 0 ? (
              <div style={{ padding: 18, textAlign: "center", color: "var(--text-3)", fontSize: 12 }}>
                Nenhum item nesta venda.
              </div>
            ) : itens.map((item, i) => {
              const totalItem = (item.preco || 0) * (item.qtd || 1) - (item.desconto || 0);
              return (
                <div key={i} className="dv-trow">
                  <span className="dv-nome">
                    {item.tipo === "servico" ? "🎯" : item.tipo === "livre" ? "📝" : <Package size={11} color="var(--text-3)" />}
                    {item.nome || item.produto || "—"}
                  </span>
                  <span style={{ textAlign: "center" }}>{item.qtd || 1}</span>
                  <span style={{ textAlign: "right" }}>{fmtR$(item.preco)}</span>
                  <span style={{ textAlign: "right", color: "var(--red)" }}>{fmtR$(item.custo)}</span>
                  <span style={{ textAlign: "right" }}>{item.desconto ? fmtR$(item.desconto) : "—"}</span>
                  <span style={{ textAlign: "right", color: "var(--green)", fontFamily: "Sora, sans-serif", fontWeight: 500 }}>
                    {fmtR$(totalItem)}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Totais */}
          <div className="dv-totals">
            <div className="dv-total-cell">
              <div className="dv-total-label">Subtotal</div>
              <div className="dv-total-val" style={{ color: "var(--text)" }}>{fmtR$(subtotal)}</div>
            </div>
            <div className="dv-total-cell">
              <div className="dv-total-label">Descontos</div>
              <div className="dv-total-val" style={{ color: "var(--red)" }}>{fmtR$(descontos)}</div>
            </div>
            <div className="dv-total-cell">
              <div className="dv-total-label">Custo Total</div>
              <div className="dv-total-val" style={{ color: "var(--red)" }}>{fmtR$(custoTotal)}</div>
            </div>
            {venda.valorTaxa > 0 && (
              <div className="dv-total-cell">
                <div className="dv-total-label">
                  Taxa {venda.formaPagamento === "Pix" ? "PIX" : "Cartão"} ({venda.taxaPercentual}%)
                </div>
                <div className="dv-total-val" style={{ color: "var(--red)" }}>{fmtR$(venda.valorTaxa)}</div>
              </div>
            )}
            <div className="dv-total-cell">
              <div className="dv-total-label">Total</div>
              <div className="dv-total-val" style={{ color: "var(--green)" }}>{fmtR$(total)}</div>
            </div>
            {/* Sinal: mostrar o que foi recebido e o que falta */}
            {venda.formaPagamento === "Sinal" && venda.valorPago != null && (
              <>
                <div className="dv-total-cell">
                  <div className="dv-total-label">Sinal Recebido</div>
                  <div className="dv-total-val" style={{ color: "var(--green)" }}>{fmtR$(venda.valorPago)}</div>
                </div>
                <div className="dv-total-cell">
                  <div className="dv-total-label">A Receber</div>
                  <div className="dv-total-val" style={{ color: "var(--blue, #5b8ef0)" }}>{fmtR$(venda.valorRestante)}</div>
                </div>
              </>
            )}
            <div className="dv-total-cell">
              <div className="dv-total-label">Lucro Est.</div>
              {/* lucroEstimado já tem a taxa deduzida quando salvo pela nova lógica */}
              <div className="dv-total-val" style={{ color: "var(--gold)" }}>
                {fmtR$(typeof venda.lucroEstimado === "number" ? venda.lucroEstimado : lucro)}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}


/* ══════════════════════════════════════════════════
   MODAL: Confirmar Cancelamento de Venda
   ══════════════════════════════════════════════════ */
function ModalCancelarVenda({ venda, onConfirm, onClose }) {
  const [cancelando, setCancelando] = useState(false);

  const handleConfirm = async () => {
    setCancelando(true);
    await onConfirm();
    setCancelando(false);
  };

  return (
    <div className="modal-overlay modal-overlay-top" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box modal-box-md">
        <div className="modal-header">
          <div className="modal-title">Cancelar Venda</div>
          <button className="modal-close" onClick={onClose}>
            <X size={14} color="var(--text-2)" />
          </button>
        </div>
        <div className="confirm-body">
          <div className="confirm-icon">🚫</div>
          <p>
            Deseja cancelar a venda <strong>{venda?.id}</strong>?<br />
            <span style={{ color: "var(--gold)", fontSize: 12 }}>
              O estoque dos produtos será restaurado automaticamente.
            </span><br />
            <span style={{ fontSize: 12 }}>
              A venda ficará salva no histórico com status <strong>Cancelada</strong>.
            </span>
          </p>
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Voltar</button>
          <button className="btn-warning" onClick={handleConfirm} disabled={cancelando}>
            {cancelando ? "Cancelando..." : <><Ban size={13} /> Cancelar Venda</>}
          </button>
        </div>
      </div>
    </div>
  );
}


/* ══════════════════════════════════════════════════
   MODAL: Excluir Venda Definitivamente (admin only)
   ══════════════════════════════════════════════════ */
function ModalExcluirVenda({ venda, onConfirm, onClose }) {
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
          <div>
            <div className="modal-title" style={{ color: "var(--red)" }}>Excluir Venda</div>
            <div className="modal-sub">Ação irreversível — somente Admin</div>
          </div>
          <button className="modal-close" onClick={onClose}>
            <X size={14} color="var(--text-2)" />
          </button>
        </div>
        <div className="confirm-body">
          <div className="confirm-icon">⚠️</div>
          <p style={{ marginBottom: 14 }}>
            Excluir essa venda irá apagar todo o histórico dela, talvez seja melhor apenas cancelar.
          </p>
          <p>
            Tem certeza que quer excluir a venda <strong>{venda?.id}</strong>?
          </p>
          <div style={{
            marginTop: 14, padding: "10px 14px",
            background: "var(--red-d)", border: "1px solid rgba(224,82,82,.2)",
            borderRadius: 10, fontSize: 12, color: "var(--red)", textAlign: "left",
          }}>
            <strong>Esta ação não pode ser desfeita.</strong><br />
            O documento da venda será apagado permanentemente do banco de dados.
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn-danger" onClick={handleConfirm} disabled={excluindo}>
            {excluindo ? "Excluindo..." : <><Trash2 size={13} /> Excluir Permanentemente</>}
          </button>
        </div>
      </div>
    </div>
  );
}



// ---------------------------------------------------------------------------
// Permissões por cargo
// ---------------------------------------------------------------------------
const PERMISSOES_VENDAS = {
  admin:       { ver: true,  criar: true,  editar: true,  cancelar: true,  excluir: true  },
  financeiro:  { ver: true,  criar: false, editar: false, cancelar: false, excluir: false },
  comercial:   { ver: true,  criar: true,  editar: true,  cancelar: true,  excluir: false },
  operacional: { ver: true,  criar: false, editar: false, cancelar: false, excluir: false },
  vendedor:    { ver: true,  criar: true,  editar: true, cancelar: true, excluir: false },
  compras:     { ver: false, criar: false, editar: false, cancelar: false, excluir: false },
  suporte:     { ver: true, criar: false, editar: false, cancelar: false, excluir: false },
};
const permVendas = (cargo, acao) => PERMISSOES_VENDAS[cargo]?.[acao] ?? false;

/* ═══════════════════════════════════════
   COMPONENTE PRINCIPAL
   ═══════════════════════════════════════ */
export default function Vendas() {
  // ── Auth via contexto — tenantUid garante acesso correto para convidados ──
  const { user, cargo, tenantUid, vendedorId, vendedorNome, isVendedor } = useContext(AuthContext);

  const podeCriar   = permVendas(cargo, "criar");
  const podeEditar  = permVendas(cargo, "editar");
  const podeCancelar = permVendas(cargo, "cancelar");
  const podeExcluir = permVendas(cargo, "excluir"); // apenas admin

  const [vendas, setVendas] = useState([]);
  const [clientes, setClientes]   = useState([]);
  const [produtos, setProdutos]   = useState([]);
  const [servicos, setServicos]   = useState([]);
  const [vendedores, setVendedores] = useState([]);
  const [vendaIdCnt, setVendaIdCnt] = useState(0);
  /* Taxas de cartão — carregadas uma vez do Firestore, com fallback nos defaults */
  const [taxas, setTaxas] = useState(TAXAS_DEFAULT);

  const [search, setSearch]   = useState("");
  const [period, setPeriod]   = useState("Tudo");
  const [loading, setLoading] = useState(true);

  const [modalNova, setModalNova]       = useState(false);
  const [editando, setEditando]         = useState(null);
  const [detalhe, setDetalhe]           = useState(null);
  const [deletando, setDeletando]       = useState(null); // fluxo de cancelar
  const [excluindoDef, setExcluindoDef] = useState(null); // fluxo de exclusão definitiva (admin)
  const [confirmarDepoisDetalhe, setConfirmarDepoisDetalhe] = useState(false);


// Listener dos dados do Firestore (usa tenantUid do contexto)
useEffect(() => {
  if (!tenantUid) {
    setLoading(false);
    return;
  }

  setLoading(true);

  const userRef     = doc(db, "users", tenantUid);
  const vendasCol   = collection(db, "users", tenantUid, "vendas");
  const clientesCol = collection(db, "users", tenantUid, "clientes");
  const produtosCol = collection(db, "users", tenantUid, "produtos");
  const servicosCol = collection(db, "users", tenantUid, "servicos");
  const vendsCol    = collection(db, "users", tenantUid, "vendedores");

  const unsub1 = onSnapshot(userRef, (snap) => {
    if (snap.exists()) setVendaIdCnt(snap.data().vendaIdCnt || 0);
  });

  /* Carrega taxas de cartão uma vez (getDoc, não listener — dado estático da sessão) */
  getDoc(doc(db, "users", tenantUid, "config", "geral"))
    .then(snap => {
      if (snap.exists() && snap.data().taxas) {
        setTaxas(prev => ({ ...TAXAS_DEFAULT, ...snap.data().taxas }));
      }
    })
    .catch(() => { /* mantém os TAXAS_DEFAULT em caso de falha */ });

  const unsub2 = onSnapshot(vendasCol, (snap) => {
    const arr = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(v => v.status !== "cancelada");
    arr.sort((a, b) => {
      const da = a.data?.toDate ? a.data.toDate() : new Date(a.data || 0);
      const db_ = b.data?.toDate ? b.data.toDate() : new Date(b.data || 0);
      return db_ - da;
    });
    setVendas(arr);
    setLoading(false);
  });

  const unsub3 = onSnapshot(clientesCol, (snap) => 
    setClientes(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  );
  const unsub4 = onSnapshot(produtosCol, (snap) => 
    setProdutos(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  );
  const unsub5 = onSnapshot(servicosCol, (snap) => 
    setServicos(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  );
  const unsub6 = onSnapshot(vendsCol, (snap) => 
    setVendedores(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  );

  return () => {
    unsub1();
    unsub2();
    unsub3();
    unsub4();
    unsub5();
    unsub6();
  };
}, [tenantUid]);

  /* ── Criar / Editar venda ── */
  const handleSave = async (payload, vendaExistente) => {
    if (!tenantUid) return;

    if (vendaExistente) {
      /* EDITAR: se produto mudou, restaura estoque antigo e desconta novo.
         IMPORTANTE: verificamos a existência do doc antes de fazer update
         para evitar crash em itens oriundos de orçamento cujo tipo real
         é "servico" mas foi salvo com tipo "produto" na conversão. */
      await runTransaction(db, async (tx) => {
        /* ── Coleta todas as refs que precisam de leitura ── */
        const oldEntries = (vendaExistente.itens || [])
          .filter(i => i.produtoId && i.tipo === "produto")
          .map(i => ({ ref: doc(db, "users", tenantUid, "produtos", i.produtoId), qtd: i.qtd || 1 }));

        const newEntries = (payload.itens || [])
          .filter(i => i.produtoId && i.tipo === "produto")
          .map(i => ({ ref: doc(db, "users", tenantUid, "produtos", i.produtoId), qtd: i.qtd || 1 }));

        /* ── TODOS OS READS PRIMEIRO ── */
        const allEntries  = [...oldEntries, ...newEntries];
        const snaps       = await Promise.all(allEntries.map(e => tx.get(e.ref)));

        /* ── TODOS OS WRITES DEPOIS ── */
        /* Restaura estoque dos itens antigos */
        oldEntries.forEach((e, i) => {
          if (snaps[i].exists()) tx.update(e.ref, { estoque: increment(e.qtd) });
        });
        /* Desconta estoque dos itens novos */
        newEntries.forEach((e, i) => {
          if (snaps[oldEntries.length + i].exists()) tx.update(e.ref, { estoque: increment(-e.qtd) });
        });
        /* Salva a venda */
        tx.set(doc(db, "users", tenantUid, "vendas", vendaExistente.id), payload, { merge: true });
      });

      /* ── RESET FINANCEIRO ──────────────────────────────────────────────────
         A venda foi alterada (forma de pagamento, valor, etc.).
         Para manter o regime de caixa consistente:
           1. Apaga TODAS as entradas de caixa vinculadas a esta venda
           2. Apaga TODOS os documentos de a_receber vinculados a esta venda
           3. Recria com base no novo payload (igual ao fluxo de venda nova)
         Isso garante que o DRE nunca some valores de estados conflitantes.
      ──────────────────────────────────────────────────────────────────────── */
      const vendaId = vendaExistente.id;

      try {
        /* 1. Apagar entradas de caixa antigas desta venda */
        const caixaSnap = await getDocs(
          query(
            collection(db, "users", tenantUid, "caixa"),
            where("origem", "==", "venda"),
            where("referenciaId", "==", vendaId)
          )
        );
        await Promise.all(caixaSnap.docs.map((d) => deleteDoc(d.ref)));

        /* 2. Apagar documentos de a_receber antigos desta venda */
        const arSnap = await getDocs(
          query(
            collection(db, "users", tenantUid, "a_receber"),
            where("origem", "==", "venda"),
            where("referenciaId", "==", vendaId)
          )
        );
        await Promise.all(arSnap.docs.map((d) => deleteDoc(d.ref)));

        /* 3. Recriar entrada de caixa com base no novo payload */
        const valorParaCaixa = Number(payload.valorRecebido ?? payload.total ?? 0);
        if (valorParaCaixa > 0) {
          await addDoc(collection(db, "users", tenantUid, "caixa"), {
            tipo:           "entrada",
            origem:         "venda",
            referenciaId:   vendaId,
            valor:          valorParaCaixa,
            descricao:      `Venda ${vendaId} — ${payload.cliente || "Consumidor Final"} (editada)`,
            formaPagamento: payload.formaPagamento,
            data:           payload.data || new Date().toISOString(),
            criadoEm:       new Date().toISOString(),
          });
        }

        /* 4. Recriar a_receber se ainda há sinal pendente no novo payload */
        if (payload.formaPagamento === "Sinal" && payload.valorRestante > 0) {
          const now = new Date().toISOString();
          await addDoc(collection(db, "users", tenantUid, "a_receber"), {
            descricao:       "Venda - Pagamento pendente",
            clienteNome:     payload.cliente || "Consumidor Final",
            valorTotal:      payload.valorRestante,
            valorPago:       0,
            valorRestante:   payload.valorRestante,
            dataVencimento:  payload.dataVencSinal,
            status:          "pendente",
            origem:          "venda",
            referenciaId:    vendaId,
            dataCriacao:     now,
            dataAtualizacao: now,
          });
        }
      } catch (errFinanceiro) {
        /* A venda e o estoque já foram atualizados com sucesso.
           Falha isolada no reset financeiro — loga para diagnóstico. */
        console.error("[Vendas] Venda editada, mas erro no reset financeiro:", errFinanceiro);
        alert(
          `Venda ${vendaId} atualizada!\n\n` +
          `⚠️ Não foi possível ajustar os lançamentos financeiros automaticamente. ` +
          `Verifique manualmente as entradas de Caixa e A Receber desta venda.`
        );
      }

      setEditando(null);
      setDetalhe(null);
      return;
    }

    /* NOVA VENDA */
    const novoId = gerarIdVenda(vendaIdCnt);
    try {
      await runTransaction(db, async (tx) => {
        /* Descontar estoque */
        for (const item of (payload.itens || [])) {
          if (item.produtoId && item.tipo === "produto") {
            const ref = doc(db, "users", tenantUid, "produtos", item.produtoId);
            tx.update(ref, { estoque: increment(-(item.qtd || 1)) });
          }
        }
        /* Criar venda */
        tx.set(doc(db, "users", tenantUid, "vendas", novoId), { ...payload, criadoEm: new Date().toISOString() });
        /* Incrementar contador */
        tx.set(doc(db, "users", tenantUid), { vendaIdCnt: vendaIdCnt + 1 }, { merge: true });
      });
    } catch (err) {
      console.error("[Vendas] Erro ao criar venda:", err);
      alert("Erro ao registrar a venda. Tente novamente.");
      return;
    }

    /*
     * ── REGIME DE CAIXA: registrar valor recebido no Caixa ──
     * Apenas o valor efetivamente recebido entra no caixa agora.
     *   - Sinal: somente o valorRecebido (sinal parcial)
     *   - Outros: total da venda (pagamento completo)
     * O DRE usa SOMENTE dados do Caixa como fonte de receita.
     */
    const valorParaCaixa = Number(payload.valorRecebido ?? payload.total ?? 0);
    if (valorParaCaixa > 0) {
      try {
        await addDoc(collection(db, "users", tenantUid, "caixa"), {
          tipo:           "entrada",
          origem:         "venda",
          referenciaId:   novoId,
          valor:          valorParaCaixa,
          descricao:      `Venda ${novoId} — ${payload.cliente || "Consumidor Final"}`,
          formaPagamento: payload.formaPagamento,
          data:           payload.data || new Date().toISOString(),
          criadoEm:       new Date().toISOString(),
        });
      } catch (err) {
        console.error("[Vendas] Venda salva, mas erro ao lançar no Caixa:", err);
        // A venda existe e é consistente — só o lançamento de caixa falhou.
        // Não exibe alerta aqui para não poluir o fluxo normal.
      }
    }

    /*
     * ── Sinal: criar lançamento em A Receber APÓS a venda ser salva com sucesso ──
     * REGRA CRÍTICA: apenas o valorPago entra como receita da venda.
     * O valorRestante é um direito a receber — não é receita ainda.
     * Nunca criar A Receber antes da venda (evita inconsistência).
     */
    if (payload.formaPagamento === "Sinal" && payload.valorRestante > 0) {
      try {
        const now = new Date().toISOString();
        await addDoc(collection(db, "users", tenantUid, "a_receber"), {
          descricao:       "Venda - Pagamento pendente",
          clienteNome:     payload.cliente || "Consumidor Final",
          valorTotal:      payload.valorRestante,
          valorPago:       0,
          valorRestante:   payload.valorRestante,
          dataVencimento:  payload.dataVencSinal,
          status:          "pendente",
          origem:          "venda",
          referenciaId:    novoId,
          dataCriacao:     now,
          dataAtualizacao: now,
        });
      } catch (err) {
        /*
         * A venda já foi salva. O A Receber falhou — alerta o usuário
         * mas não desfaz a venda (ela existe e é consistente).
         */
        console.error("[Vendas] Venda salva, mas erro ao criar A Receber:", err);
        alert(
          `Venda ${novoId} registrada com sucesso!\n\n` +
          `⚠️ Não foi possível criar o lançamento em "A Receber" automaticamente. ` +
          `Crie manualmente o valor de R$ ${payload.valorRestante.toFixed(2).replace(".", ",")} para ${payload.cliente}.`
        );
      }
    }

    /* Imprimir recibo após criar */
    imprimirRecibo({ ...payload, id: novoId });
    setModalNova(false);
  };

  /* ── Cancelar venda — marca como cancelada, restaura estoque e remove lançamentos financeiros ── */
  const handleCancelar = async () => {
    if (!tenantUid || !deletando) return;
    const vendaId = deletando.id;

    /* 1. Marcar como cancelada + restaurar estoque (atômico) */
    await runTransaction(db, async (tx) => {
      for (const item of (deletando.itens || [])) {
        if (item.produtoId && item.tipo === "produto") {
          const ref = doc(db, "users", tenantUid, "produtos", item.produtoId);
          tx.update(ref, { estoque: increment(item.qtd || 1) });
        }
      }
      tx.update(doc(db, "users", tenantUid, "vendas", vendaId), {
        status: "cancelada",
        canceladaEm: serverTimestamp(),
        canceladaPor: { uid: user?.uid, nome: user?.displayName || user?.email || "—", cargo },
      });
    });

    /* 2. Remover entradas do Caixa vinculadas a esta venda */
    try {
      const caixaSnap = await getDocs(
        query(
          collection(db, "users", tenantUid, "caixa"),
          where("referenciaId", "==", vendaId),
          where("origem", "==", "venda")
        )
      );
      await Promise.all(caixaSnap.docs.map((d) => deleteDoc(d.ref)));
    } catch (err) {
      console.error("[Vendas] Venda cancelada, mas erro ao remover lançamentos do Caixa:", err);
    }

    /* 3. Remover A Receber vinculado a esta venda */
    try {
      const arSnap = await getDocs(
        query(
          collection(db, "users", tenantUid, "a_receber"),
          where("referenciaId", "==", vendaId),
          where("origem", "==", "venda")
        )
      );
      await Promise.all(arSnap.docs.map((d) => deleteDoc(d.ref)));
    } catch (err) {
      console.error("[Vendas] Venda cancelada, mas erro ao remover A Receber:", err);
    }

    setDeletando(null);
    setDetalhe(null);
  };

  /* ── Excluir venda definitivamente (admin only) — apaga o documento e todo histórico ── */
  const handleExcluirDefinitivo = async () => {
    if (!tenantUid || !excluindoDef) return;
    const vendaId = excluindoDef.id;

    /* 1. Deletar venda + restaurar estoque (atômico) */
    await runTransaction(db, async (tx) => {
      for (const item of (excluindoDef.itens || [])) {
        if (item.produtoId && item.tipo === "produto") {
          const ref = doc(db, "users", tenantUid, "produtos", item.produtoId);
          tx.update(ref, { estoque: increment(item.qtd || 1) });
        }
      }
      tx.delete(doc(db, "users", tenantUid, "vendas", vendaId));
    });

    /* 2. Remover entradas do Caixa vinculadas a esta venda */
    try {
      const caixaSnap = await getDocs(
        query(
          collection(db, "users", tenantUid, "caixa"),
          where("referenciaId", "==", vendaId),
          where("origem", "==", "venda")
        )
      );
      await Promise.all(caixaSnap.docs.map((d) => deleteDoc(d.ref)));
    } catch (err) {
      console.error("[Vendas] Venda excluída, mas erro ao remover lançamentos do Caixa:", err);
    }

    /* 3. Remover A Receber vinculado a esta venda */
    try {
      const arSnap = await getDocs(
        query(
          collection(db, "users", tenantUid, "a_receber"),
          where("referenciaId", "==", vendaId),
          where("origem", "==", "venda")
        )
      );
      await Promise.all(arSnap.docs.map((d) => deleteDoc(d.ref)));
    } catch (err) {
      console.error("[Vendas] Venda excluída, mas erro ao remover A Receber:", err);
    }

    setExcluindoDef(null);
    setDetalhe(null);
  };

  /* Filtros */
  const vendasFiltradas = useMemo(() => {
    let lista = filtrarPorPeriodo(vendas, period);
    if (search.trim()) {
      const q = search.toLowerCase();
      lista = lista.filter(v =>
        v.id?.toLowerCase().includes(q) ||
        v.cliente?.toLowerCase().includes(q) ||
        v.vendedor?.toLowerCase().includes(q)
      );
    }
    return lista;
  }, [vendas, period, search]);

  if (!tenantUid) return <div className="vd-loading">Carregando autenticação...</div>;

  return (
    <>
      <style>{CSS}</style>
      <div id="recibo-print-root" />

      {/* Topbar */}
      <header className="vd-topbar">
        <div className="vd-topbar-title">
          <h1>Vendas</h1>
          <p>Gerencie e acompanhe todas as vendas</p>
        </div>

        <div className="vd-search">
          <Search size={13} color="var(--text-3)" />
          <input
            placeholder="Buscar por ID ou cliente..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div className="vd-topbar-right">
          <button className="btn-novo-cl" onClick={() => setModalNova(true)}
            style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 16px", borderRadius: 9, background: "var(--gold)", color: "#0a0808", border: "none", cursor: "pointer", fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", transition: "opacity .13s" }}
          >
            <Plus size={14} /> Nova Venda
          </button>
        </div>
      </header>

      {/* Filtros de período */}
      <div className="vd-periods">
        {PERIODS.map(p => (
          <button
            key={p}
            className={`vd-period-btn ${period === p ? "active" : ""}`}
            onClick={() => setPeriod(p)}
          >{p}</button>
        ))}
      </div>

      {/* Tabela */}
      <div className="ag-content">
        <div className="vd-table-wrap">
          <div className="vd-table-header">
            <div className="vd-table-title">
              Todas as vendas
              <span className="vd-count-badge">{vendasFiltradas.length}</span>
            </div>
            <div className="vd-table-actions">
              <button className="vd-export-btn" onClick={() => exportarCSV(vendasFiltradas)}>
                <Download size={11} /> CSV
              </button>
            </div>
          </div>

          {/* Cabeçalho */}
          <div className="vd-row vd-row-head">
            <span>ID</span>
            <span>CLIENTE</span>
            <span>DATA</span>
            <span>PAGAMENTO</span>
            <span>VENDEDOR</span>
            <span>ITENS</span>
            <span>TOTAL</span>
            <span style={{ textAlign: "right" }}>AÇÕES</span>
          </div>

          {loading ? (
            <div className="vd-loading">Carregando vendas...</div>
          ) : vendasFiltradas.length === 0 ? (
            <div className="vd-empty">
              <ShoppingCart size={28} color="var(--text-3)" style={{ marginBottom: 8 }} />
              <p>Nenhuma venda encontrada.</p>
            </div>
          ) : vendasFiltradas.map(v => (
            <div key={v.id} className="vd-row" onClick={() => setDetalhe(v)}>
              <span className="vd-vid">{v.id}</span>
              <span className="vd-cliente">{v.cliente || "—"}</span>
              <span>{fmtData(v.data)}</span>
              <span><span className="vd-fp-badge">{v.formaPagamento || "—"}</span></span>
              <span>{v.vendedor || "—"}</span>
              <span>{v.itens?.length || 0} item(s)</span>
              <span className="vd-total">{fmtR$(v.total)}</span>
              <div className="vd-actions" onClick={e => e.stopPropagation()}>
                {podeEditar && (
                  <button className="btn-icon btn-icon-edit" onClick={() => setEditando(v)} title="Editar">
                    <Edit2 size={13} />
                  </button>
                )}
                {podeCancelar && (
                  <button className="btn-icon btn-icon-cancel" onClick={() => setDeletando(v)} title="Cancelar venda">
                    <Ban size={13} />
                  </button>
                )}
                {podeExcluir && (
                  <button className="btn-icon btn-icon-del" onClick={() => setExcluindoDef(v)} title="Excluir permanentemente">
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modais */}
      {modalNova && (
        <ModalNovaVenda
          uid={tenantUid}
          cargo={cargo}
          vendedorId={vendedorId}
          vendedorNome={vendedorNome}
          clientes={clientes}
          produtos={produtos}
          servicos={servicos}
          vendedores={vendedores}
          taxas={taxas}
          onSave={handleSave}
          onClose={() => setModalNova(false)}
        />
      )}

      {editando && (
        <ModalNovaVenda
          venda={editando}
          uid={tenantUid}
          cargo={cargo}
          vendedorId={vendedorId}
          vendedorNome={vendedorNome}
          clientes={clientes}
          produtos={produtos}
          servicos={servicos}
          vendedores={vendedores}
          taxas={taxas}
          onSave={handleSave}
          onClose={() => setEditando(null)}
        />
      )}

      {detalhe && (
        <ModalDetalheVenda
          venda={detalhe}
          onClose={() => setDetalhe(null)}
          onEditar={podeEditar ? (v) => { setDetalhe(null); setEditando(v); } : null}
          onCancelar={podeCancelar ? (v) => { setDetalhe(null); setDeletando(v); } : null}
          onExcluirDef={podeExcluir ? (v) => { setDetalhe(null); setExcluindoDef(v); } : null}
          isAdmin={cargo === "admin"}
        />
      )}

      {deletando && (
        <ModalCancelarVenda
          venda={deletando}
          onConfirm={handleCancelar}
          onClose={() => setDeletando(null)}
        />
      )}

      {excluindoDef && (
        <ModalExcluirVenda
          venda={excluindoDef}
          onConfirm={handleExcluirDefinitivo}
          onClose={() => setExcluindoDef(null)}
        />
      )}
    </>
  );
}
