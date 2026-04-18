/* ═══════════════════════════════════════════════════
   ASSENT v2.0 — Orcamentos.jsx
   Estrutura Firestore:
     users/{uid}/orcamentos/{id}      → cada orçamento
     users/{uid}                      → orcamentoCnt, vendaIdCnt (contadores)
     users/{uid}/clientes/{id}        → clientes cadastrados
     users/{uid}/produtos/{id}        → catálogo de produtos
     users/{uid}/servicos/{id}        → catálogo de serviços
     users/{uid}/config/geral         → dados da empresa
                                        (empresa.nomeEmpresa, empresa.logo…)

   CORREÇÕES v2 (18/04/2026):
     ✅ Firestore: todos os tx.get() ANTES de qualquer tx.set/tx.update
     ✅ Impressão A4: layout sofisticado, cor do header aplicada, logo correta
     ✅ Config: lê empresa.nomeEmpresa e empresa.logo (campos reais do Firestore)
     ✅ Modais internos: zero uso de window.alert / window.confirm
   ═══════════════════════════════════════════════════ */

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Search, Plus, X, Printer, FileText,
  CheckCircle, Clock, AlertTriangle,
  TrendingUp, RefreshCw, User, List, Edit2,
} from "lucide-react";

import { db, auth } from "../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection, doc, onSnapshot,
  runTransaction, getDoc, Timestamp,
  query, orderBy,
} from "firebase/firestore";

/* ══════════════════════════════════════════════════
   CSS
   ══════════════════════════════════════════════════ */
const CSS = `
  @keyframes fadeIn  { from{opacity:0}            to{opacity:1} }
  @keyframes slideUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
  @keyframes scaleIn { from{opacity:0;transform:scale(.94)}       to{opacity:1;transform:scale(1)} }

  /* ── Overlay ── */
  .modal-overlay {
    position:fixed;inset:0;z-index:1000;
    background:rgba(0,0,0,.82);backdrop-filter:blur(6px);
    display:flex;align-items:center;justify-content:center;
    padding:20px;animation:fadeIn .15s ease;
  }
  .modal-overlay-top { z-index:1200; }

  /* ── Box ── */
  .modal-box {
    background:var(--s1);border:1px solid var(--border-h);
    border-radius:18px;width:100%;max-width:520px;
    max-height:92vh;overflow-y:auto;
    box-shadow:0 32px 80px rgba(0,0,0,.7);
    animation:slideUp .2s ease;
  }
  .modal-box-xl { max-width:880px; }
  .modal-box-lg { max-width:680px; }
  .modal-box-sm { max-width:400px; }
  .modal-box::-webkit-scrollbar { width:3px; }
  .modal-box::-webkit-scrollbar-thumb { background:var(--text-3);border-radius:2px; }

  .modal-header {
    padding:20px 24px 16px;
    border-bottom:1px solid var(--border);
    display:flex;align-items:flex-start;justify-content:space-between;gap:12px;
    position:sticky;top:0;background:var(--s1);z-index:2;
  }
  .modal-title {
    font-family:'Sora',sans-serif;font-size:16px;font-weight:600;color:var(--text);
    display:flex;align-items:center;gap:10px;flex-wrap:wrap;
  }
  .modal-sub { font-size:12px;color:var(--text-2);margin-top:3px; }
  .modal-close {
    width:30px;height:30px;border-radius:8px;flex-shrink:0;
    background:var(--s3);border:1px solid var(--border);
    display:flex;align-items:center;justify-content:center;
    cursor:pointer;margin-top:2px;transition:background .13s;
  }
  .modal-close:hover { background:var(--s2);border-color:var(--border-h); }
  .modal-body  { padding:22px 24px; }
  .modal-footer {
    padding:14px 24px;border-top:1px solid var(--border);
    display:flex;justify-content:flex-end;gap:10px;flex-wrap:wrap;
    position:sticky;bottom:0;background:var(--s1);z-index:2;
  }

  /* ── Toast / Confirm modal ── */
  .orc-toast-ov {
    position:fixed;inset:0;z-index:2000;
    display:flex;align-items:center;justify-content:center;
    background:rgba(0,0,0,.65);backdrop-filter:blur(5px);
    animation:fadeIn .12s ease;
  }
  .orc-toast-box {
    background:var(--s1);border:1px solid var(--border-h);
    border-radius:18px;padding:30px 28px 22px;
    max-width:420px;width:100%;
    box-shadow:0 24px 64px rgba(0,0,0,.75);
    animation:scaleIn .18s ease;text-align:center;
  }
  .orc-toast-icon  { font-size:36px;margin-bottom:12px;line-height:1; }
  .orc-toast-title { font-family:'Sora',sans-serif;font-size:15px;font-weight:600;color:var(--text);margin-bottom:8px; }
  .orc-toast-msg   { font-size:13px;color:var(--text-2);line-height:1.65;margin-bottom:22px; }
  .orc-toast-acts  { display:flex;gap:10px;justify-content:center; }

  /* ── Buttons ── */
  .btn-primary {
    padding:9px 20px;border-radius:9px;
    background:var(--gold);color:#0a0808;border:none;cursor:pointer;
    font-family:'DM Sans',sans-serif;font-size:13px;font-weight:600;
    transition:opacity .13s,transform .1s;display:flex;align-items:center;gap:6px;
  }
  .btn-primary:hover  { opacity:.88; }
  .btn-primary:active { transform:scale(.97); }
  .btn-primary:disabled { opacity:.4;cursor:not-allowed; }

  .btn-secondary {
    padding:9px 20px;border-radius:9px;
    background:var(--s3);color:var(--text-2);border:1px solid var(--border);cursor:pointer;
    font-family:'DM Sans',sans-serif;font-size:13px;
    transition:background .13s,color .13s;display:flex;align-items:center;gap:6px;
  }
  .btn-secondary:hover { background:var(--s2);color:var(--text); }

  .btn-green {
    padding:9px 20px;border-radius:9px;
    background:rgba(74,222,128,.12);color:var(--green);
    border:1px solid rgba(74,222,128,.22);cursor:pointer;
    font-family:'DM Sans',sans-serif;font-size:13px;font-weight:600;
    transition:background .13s;display:flex;align-items:center;gap:6px;
  }
  .btn-green:hover { background:rgba(74,222,128,.22); }
  .btn-green:disabled { opacity:.35;cursor:not-allowed; }

  .btn-danger {
    padding:9px 20px;border-radius:9px;
    background:var(--red-d);color:var(--red);
    border:1px solid rgba(224,82,82,.25);cursor:pointer;
    font-family:'DM Sans',sans-serif;font-size:13px;font-weight:600;
    transition:background .13s;display:flex;align-items:center;gap:6px;
  }
  .btn-danger:hover { background:rgba(224,82,82,.18); }

  .btn-icon {
    width:30px;height:30px;border-radius:7px;
    display:flex;align-items:center;justify-content:center;
    cursor:pointer;border:1px solid transparent;background:transparent;transition:all .13s;
  }
  .btn-icon-edit { color:var(--blue); }
  .btn-icon-edit:hover { background:var(--blue-d);border-color:rgba(91,142,240,.2); }
  .btn-icon-view { color:var(--text-2); }
  .btn-icon-view:hover { background:var(--s3);border-color:var(--border-h); }

  /* ── Forms ── */
  .form-group { margin-bottom:16px; }
  .form-label {
    display:block;font-size:10px;font-weight:600;
    letter-spacing:.07em;text-transform:uppercase;color:var(--text-2);margin-bottom:7px;
  }
  .form-label-req { color:var(--gold);margin-left:2px; }
  .form-input {
    width:100%;background:var(--s2);border:1px solid var(--border);border-radius:9px;
    padding:10px 13px;color:var(--text);font-size:13px;
    font-family:'DM Sans',sans-serif;outline:none;
    transition:border-color .15s,box-shadow .15s;box-sizing:border-box;
  }
  .form-input:focus { border-color:var(--gold);box-shadow:0 0 0 3px rgba(200,165,94,0.1); }
  .form-input.err { border-color:var(--red); }
  .form-error { font-size:11px;color:var(--red);margin-top:5px; }
  .form-row { display:grid;grid-template-columns:1fr 1fr;gap:14px; }
  .form-sep { height:1px;background:var(--border);margin:18px 0; }

  /* ── Topbar ── */
  .orc-topbar {
    padding:14px 22px;background:var(--s1);border-bottom:1px solid var(--border);
    display:flex;align-items:center;gap:14px;flex-shrink:0;flex-wrap:wrap;
  }
  .orc-topbar-title h1 { font-family:'Sora',sans-serif;font-size:17px;font-weight:600;color:var(--text); }
  .orc-topbar-title p  { font-size:11px;color:var(--text-2);margin-top:2px; }
  .orc-search {
    display:flex;align-items:center;gap:8px;
    background:var(--s2);border:1px solid var(--border);
    border-radius:8px;padding:8px 12px;width:270px;flex:1;min-width:180px;
  }
  .orc-search input { background:transparent;border:none;outline:none;color:var(--text);font-size:12px;width:100%; }
  .orc-topbar-right { display:flex;align-items:center;gap:8px;margin-left:auto; }

  /* ── Filtros ── */
  .orc-filters {
    display:flex;align-items:center;gap:6px;
    padding:12px 22px;border-bottom:1px solid var(--border);
    background:var(--s1);flex-wrap:wrap;
  }
  .orc-filter-btn {
    padding:5px 13px;border-radius:20px;font-size:12px;
    font-family:'DM Sans',sans-serif;cursor:pointer;
    border:1px solid var(--border);background:var(--s2);color:var(--text-2);transition:all .13s;
  }
  .orc-filter-btn:hover { border-color:var(--border-h);color:var(--text); }
  .orc-filter-btn.active { background:var(--gold);color:#0a0808;border-color:var(--gold);font-weight:600; }

  /* ── Tabela ── */
  .orc-table-wrap { background:var(--s1);border:1px solid var(--border);border-radius:12px;overflow:hidden; }
  .orc-table-header {
    padding:13px 18px;border-bottom:1px solid var(--border);
    display:flex;align-items:center;justify-content:space-between;gap:10px;
  }
  .orc-table-title {
    font-family:'Sora',sans-serif;font-size:13px;font-weight:600;color:var(--text);
    display:flex;align-items:center;gap:8px;
  }
  .orc-count-badge {
    font-family:'Sora',sans-serif;font-size:11px;font-weight:600;
    background:var(--s3);border:1px solid var(--border-h);color:var(--text-2);padding:2px 9px;border-radius:20px;
  }

  .orc-row {
    display:grid;
    grid-template-columns:100px 1fr 110px 130px 120px 100px 80px;
    padding:11px 18px;gap:8px;border-bottom:1px solid var(--border);
    align-items:center;font-size:12px;color:var(--text-2);
    cursor:pointer;transition:background .1s;
  }
  .orc-row:last-child { border-bottom:none; }
  .orc-row:hover { background:rgba(255,255,255,0.024); }
  .orc-row-head { background:var(--s2);cursor:default; }
  .orc-row-head:hover { background:var(--s2); }
  .orc-row-head span { font-size:10px;font-weight:500;letter-spacing:.06em;text-transform:uppercase;color:var(--text-3); }

  .orc-codigo  { font-family:'Sora',sans-serif;font-size:11px;color:var(--gold);font-weight:600; }
  .orc-cliente { color:var(--text);font-size:13px;font-weight:500; }
  .orc-total   { font-family:'Sora',sans-serif;font-size:12px;font-weight:600;color:var(--green); }
  .orc-actions { display:flex;align-items:center;gap:5px;justify-content:flex-end; }
  .orc-empty,.orc-loading { padding:56px 20px;text-align:center;color:var(--text-3);font-size:13px; }

  /* ── Badges de status ── */
  .orc-status {
    display:inline-flex;align-items:center;gap:4px;
    padding:3px 9px;border-radius:20px;font-size:10px;font-weight:600;white-space:nowrap;
  }
  .orc-st-rascunho   { background:var(--s3);color:var(--text-3);border:1px solid var(--border-h); }
  .orc-st-enviado    { background:rgba(91,142,240,.12);color:var(--blue);border:1px solid rgba(91,142,240,.2); }
  .orc-st-aguardando { background:rgba(200,165,94,.1);color:var(--gold);border:1px solid rgba(200,165,94,.25); }
  .orc-st-negociacao { background:rgba(200,165,94,.15);color:var(--gold);border:1px solid rgba(200,165,94,.3); }
  .orc-st-fechado    { background:rgba(74,222,128,.1);color:var(--green);border:1px solid rgba(74,222,128,.2); }
  .orc-st-perdido    { background:var(--red-d);color:var(--red);border:1px solid rgba(224,82,82,.2); }
  .orc-st-expirado   { background:rgba(100,100,100,.1);color:var(--text-3);border:1px solid var(--border); }
  .orc-st-convertido { background:rgba(74,222,128,.15);color:var(--green);border:1px solid rgba(74,222,128,.3); }
  .orc-st-ativo      { background:rgba(91,142,240,.08);color:var(--blue);border:1px solid rgba(91,142,240,.18); }

  /* ── Autocomplete ── */
  .nv-autocomplete { position:relative; }
  .nv-ac-list {
    position:absolute;top:100%;left:0;right:0;z-index:9999;
    background:var(--s1);border:1px solid var(--border-h);
    border-radius:9px;max-height:200px;overflow-y:auto;
    box-shadow:0 12px 40px rgba(0,0,0,.5);margin-top:3px;
  }
  .nv-ac-item {
    padding:9px 13px;cursor:pointer;font-size:13px;color:var(--text);
    transition:background .1s;display:flex;align-items:center;justify-content:space-between;
  }
  .nv-ac-item:hover { background:var(--s2); }
  .nv-ac-item-sub { font-size:11px;color:var(--text-3); }
  .nv-ac-empty { padding:10px 13px;font-size:12px;color:var(--text-3);text-align:center; }

  /* ── Itens ── */
  .orc-items-hdr { display:flex;align-items:center;justify-content:space-between;margin-bottom:10px; }
  .orc-items-label { font-size:10px;font-weight:600;letter-spacing:.07em;text-transform:uppercase;color:var(--text-2); }
  .orc-add-item {
    display:flex;align-items:center;gap:5px;padding:5px 12px;border-radius:8px;font-size:12px;font-weight:600;
    cursor:pointer;border:1px solid rgba(200,165,94,.3);background:rgba(200,165,94,.08);color:var(--gold);
    font-family:'DM Sans',sans-serif;transition:all .13s;
  }
  .orc-add-item:hover { background:rgba(200,165,94,.14); }

  .orc-item-row {
    display:grid;grid-template-columns:80px 1fr 64px 100px 32px;
    gap:8px;align-items:start;margin-bottom:8px;
    padding:10px;background:var(--s2);border:1px solid var(--border);border-radius:10px;
  }
  .orc-ifl { font-size:9px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--text-3);margin-bottom:5px; }
  .orc-item-rm {
    width:28px;height:28px;border-radius:7px;
    display:flex;align-items:center;justify-content:center;
    cursor:pointer;border:1px solid transparent;background:transparent;color:var(--red);margin-top:14px;
    transition:all .13s;
  }
  .orc-item-rm:hover { background:var(--red-d);border-color:rgba(224,82,82,.2); }

  .orc-totals-bar {
    display:flex;gap:16px;padding:12px 14px;
    background:var(--s2);border:1px solid var(--border);
    border-radius:10px;margin-top:14px;flex-wrap:wrap;align-items:center;
  }
  .orc-tc     { display:flex;flex-direction:column;gap:2px; }
  .orc-tc-lbl { font-size:9px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--text-3); }
  .orc-tc-val { font-family:'Sora',sans-serif;font-size:13px;font-weight:600; }
  .orc-tc-input {
    background:var(--s3);border:1px solid var(--border);border-radius:7px;
    padding:4px 8px;color:var(--text);font-size:12px;width:90px;outline:none;
    font-family:'DM Sans',sans-serif;
  }
  .orc-tc-input:focus { border-color:var(--gold); }

  /* ── Toggle cliente ── */
  .orc-cli-toggle { display:flex;gap:6px;margin-bottom:14px; }
  .orc-tog {
    display:flex;align-items:center;gap:5px;padding:6px 14px;border-radius:8px;
    font-size:12px;font-weight:600;cursor:pointer;border:1px solid var(--border);
    background:var(--s2);color:var(--text-2);font-family:'DM Sans',sans-serif;transition:all .13s;
  }
  .orc-tog.active { background:rgba(200,165,94,.12);border-color:rgba(200,165,94,.3);color:var(--gold); }
  .orc-tog:not(.active):hover { background:var(--s3);color:var(--text); }

  /* ── Selects ── */
  .orc-sel {
    width:100%;padding:9px 12px;border-radius:9px;
    background:var(--s2);border:1px solid var(--border);
    color:var(--text);font-size:12px;font-family:'DM Sans',sans-serif;outline:none;cursor:pointer;
  }
  .orc-sel:focus { border-color:var(--gold); }
  .orc-sel-sm {
    padding:6px 9px;border-radius:7px;font-size:11px;font-weight:600;
    background:var(--s3);border:1px solid var(--border);
    color:var(--text-2);font-family:'DM Sans',sans-serif;outline:none;cursor:pointer;
  }

  /* ── Cores do layout ── */
  .orc-colors { display:flex;gap:8px;flex-wrap:wrap; }
  .orc-color-opt {
    width:34px;height:34px;border-radius:8px;cursor:pointer;
    border:2px solid transparent;transition:all .13s;flex-shrink:0;
  }
  .orc-color-opt.sel {
    border-color:var(--gold);transform:scale(1.12);box-shadow:0 0 0 3px rgba(200,165,94,.25);
  }

  /* ── Posição logo ── */
  .orc-pos-btns { display:flex;gap:6px; }
  .orc-pos {
    padding:5px 12px;border-radius:7px;font-size:11px;font-weight:600;
    cursor:pointer;border:1px solid var(--border);background:var(--s2);color:var(--text-2);
    font-family:'DM Sans',sans-serif;transition:all .13s;
  }
  .orc-pos.active { background:rgba(200,165,94,.12);border-color:rgba(200,165,94,.3);color:var(--gold); }

  /* ── Modal detalhe ── */
  .od-sec       { margin-bottom:20px; }
  .od-sec-title {
    font-family:'Sora',sans-serif;font-size:11px;font-weight:600;
    color:var(--text-2);margin-bottom:10px;
    text-transform:uppercase;letter-spacing:.07em;
    display:flex;align-items:center;gap:6px;
  }
  .od-grid { display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px; }
  .od-card { background:var(--s2);border:1px solid var(--border);border-radius:10px;padding:10px 13px; }
  .od-lbl  { font-size:9px;font-weight:600;letter-spacing:.07em;text-transform:uppercase;color:var(--text-3);margin-bottom:4px; }
  .od-val  { font-size:13px;color:var(--text);font-weight:500; }

  .od-table { background:var(--s2);border:1px solid var(--border);border-radius:10px;overflow:hidden;margin-bottom:14px; }
  .od-thead {
    display:grid;grid-template-columns:1fr 56px 110px 110px;
    padding:8px 12px;background:var(--s3);border-bottom:1px solid var(--border);gap:8px;
  }
  .od-thead span { font-size:9px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--text-3); }
  .od-trow {
    display:grid;grid-template-columns:1fr 56px 110px 110px;
    padding:10px 12px;border-bottom:1px solid var(--border);
    gap:8px;font-size:12px;color:var(--text-2);align-items:center;
  }
  .od-trow:last-child { border-bottom:none; }
  .od-nome { color:var(--text);font-weight:500; }

  .od-totals {
    display:flex;gap:14px;padding:12px 14px;
    background:var(--s2);border:1px solid var(--border);border-radius:10px;flex-wrap:wrap;
  }

  .od-timeline { list-style:none;margin:0;padding:0; }
  .od-event {
    display:flex;align-items:flex-start;gap:10px;
    padding:8px 0;border-bottom:1px solid var(--border);font-size:12px;
  }
  .od-event:last-child { border-bottom:none; }
  .od-ev-tipo { font-size:10px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:var(--gold);min-width:84px;padding-top:1px; }
  .od-ev-desc { color:var(--text-2);flex:1; }
  .od-ev-data { color:var(--text-3);font-size:10px;white-space:nowrap; }

  .od-aviso {
    border-radius:10px;padding:11px 14px;font-size:12px;color:var(--text-2);
    margin-bottom:14px;display:flex;align-items:center;gap:8px;
  }
  .od-aviso-warn { background:rgba(200,165,94,.07);border:1px solid rgba(200,165,94,.25); }
  .od-aviso-ok   { background:rgba(74,222,128,.07);border:1px solid rgba(74,222,128,.2); }
  .od-aviso-exp  { background:rgba(100,100,100,.06);border:1px solid var(--border); }

  /* ── Print ── */
  @media print {
    body > * { display:none !important; }
    #orc-print-root {
      display:block !important;
      position:fixed;top:0;left:0;width:100%;z-index:99999;
    }
  }
  #orc-print-root { display:none; }
`;

/* ══════════════════════════════════════════════════
   CONSTANTES
   ══════════════════════════════════════════════════ */
const CORES_HEADER = [
  { bg:"#0f172a", text:"#f8fafc" },
  { bg:"#1E40AF", text:"#ffffff" },
  { bg:"#059669", text:"#ffffff" },
  { bg:"#7c3aed", text:"#ffffff" },
  { bg:"#b45309", text:"#ffffff" },
  { bg:"#ffffff", text:"#0f172a" },
];

const SC_LABELS = {
  rascunho:"Rascunho", enviado:"Enviado",
  aguardando_resposta:"Aguardando", negociacao:"Negociação",
  fechado:"Fechado", perdido:"Perdido",
};
const SC_CLASS = {
  rascunho:"orc-st-rascunho", enviado:"orc-st-enviado",
  aguardando_resposta:"orc-st-aguardando", negociacao:"orc-st-negociacao",
  fechado:"orc-st-fechado", perdido:"orc-st-perdido",
};
const SS_CLASS = { ativo:"orc-st-ativo", expirado:"orc-st-expirado", convertido:"orc-st-convertido" };

const FILTROS = ["Todos","Rascunho","Enviado","Aguardando","Negociação","Fechado","Perdido","Expirado","Convertido"];

/* ══════════════════════════════════════════════════
   HELPERS
   ══════════════════════════════════════════════════ */
const fmtR$ = v => `R$ ${Number(v||0).toLocaleString("pt-BR",{minimumFractionDigits:2})}`;

const fmtData = d => {
  if (!d) return "—";
  try { const dt = d?.toDate ? d.toDate() : new Date(d); return dt.toLocaleDateString("pt-BR"); }
  catch { return String(d); }
};

const gerarCodigo = cnt => `ORC-${String(cnt+1).padStart(4,"0")}`;

const statusSistema = orc => {
  if (orc.statusSistema === "convertido") return "convertido";
  if (orc.statusSistema === "expirado")   return "expirado";
  if (orc.datas?.validade) {
    const v = orc.datas.validade?.toDate ? orc.datas.validade.toDate() : new Date(orc.datas.validade);
    if (v < new Date()) return "expirado";
  }
  return "ativo";
};

const filtroParaStatus = f => ({
  "Todos":null,
  "Rascunho":{sc:"rascunho"},
  "Enviado":{sc:"enviado"},
  "Aguardando":{sc:"aguardando_resposta"},
  "Negociação":{sc:"negociacao"},
  "Fechado":{sc:"fechado"},
  "Perdido":{sc:"perdido"},
  "Expirado":{ss:"expirado"},
  "Convertido":{ss:"convertido"},
}[f] ?? null);

/* ══════════════════════════════════════════════════
   IMPRESSÃO A4 SOFISTICADA
   - usa empresa.nomeEmpresa e empresa.logo (campos reais do Firestore)
   - aplica a cor de header escolhida em toda a tabela e totais
   - nunca corta conteúdo (largura 100%, box-sizing border-box)
   ══════════════════════════════════════════════════ */
function imprimirOrcamento(orc, empresa) {
  const el = document.getElementById("orc-print-root");
  if (!el) return;

  const layout   = orc.configuracaoLayout || {};
  const bgColor  = layout.corHeader      || "#0f172a";
  const txtColor = layout.corTextoHeader || "#f8fafc";
  const logoPos  = layout.posicaoLogo    || "esquerda";

  /* Campos corretos conforme Firestore: empresa.nomeEmpresa, empresa.logo */
  const nomeEmp = empresa?.nomeEmpresa || empresa?.nome || "ASSENT";
  const cnpj    = empresa?.cnpj    || "";
  const endereco = empresa?.endereco || "";
  const telefone = empresa?.telefone || "";
  const logo64   = empresa?.logo   || "";   /* campo "logo" no Firestore */

  const logoJustify =
    logoPos === "centro" ? "center" :
    logoPos === "direita" ? "flex-end" : "flex-start";

  const rf       = orc.resumoFinanceiro || {};
  const subtotal = rf.subtotal  || 0;
  const desc     = rf.descontos || 0;
  const acr      = rf.acrescimos || 0;
  const total    = rf.totalFinal || 0;
  const itens    = orc.itens || [];

  const validade = orc.datas?.validade
    ? (orc.datas.validade?.toDate
        ? orc.datas.validade.toDate()
        : new Date(orc.datas.validade)).toLocaleDateString("pt-BR")
    : "—";

  el.innerHTML = `
<div style="
  font-family:'Georgia','Times New Roman',serif;
  width:100%;box-sizing:border-box;
  background:#ffffff;color:#1a1a2e;
  min-height:100vh;
">

  <!-- HEADER com cor escolhida -->
  <div style="
    background:${bgColor};color:${txtColor};
    padding:26px 40px 20px;
    display:flex;align-items:flex-start;justify-content:space-between;gap:20px;
    box-sizing:border-box;
  ">
    <!-- Empresa / logo -->
    <div style="display:flex;flex-direction:column;align-items:${logoJustify};gap:6px;flex:1;min-width:0;">
      ${logo64
        ? `<img src="${logo64}" style="height:54px;max-width:180px;object-fit:contain;display:block;"/>`
        : `<div style="font-size:22px;font-weight:700;letter-spacing:-.5px;">${nomeEmp}</div>`
      }
      ${logo64 ? `<div style="font-size:14px;font-weight:700;opacity:.9;">${nomeEmp}</div>` : ""}
      <div style="font-size:11px;opacity:.72;line-height:1.7;margin-top:2px;">
        ${cnpj     ? `CNPJ: ${cnpj}<br>` : ""}
        ${endereco ? `${endereco}<br>`   : ""}
        ${telefone ? `Tel: ${telefone}`  : ""}
      </div>
    </div>

    <!-- ID do orçamento -->
    <div style="text-align:right;flex-shrink:0;">
      <div style="font-size:10px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;opacity:.65;margin-bottom:4px;">
        ORÇAMENTO
      </div>
      <div style="font-size:30px;font-weight:700;letter-spacing:-1px;line-height:1;">
        ${orc.codigo || orc.id}
      </div>
      <div style="font-size:11px;opacity:.68;margin-top:6px;">
        Emitido em: ${fmtData(orc.datas?.criacao)}
      </div>
    </div>
  </div>

  <!-- Faixa decorativa -->
  <div style="height:3px;background:linear-gradient(90deg,${bgColor},${bgColor}55,transparent);"></div>

  <!-- CORPO -->
  <div style="padding:26px 40px;box-sizing:border-box;">

    <!-- Card do cliente -->
    <div style="
      display:flex;border:1px solid #e2e8f0;border-radius:10px;
      overflow:hidden;margin-bottom:22px;
    ">
      <div style="
        background:${bgColor};color:${txtColor};
        padding:14px 18px;display:flex;align-items:center;justify-content:center;
        font-size:9px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;
        writing-mode:vertical-lr;transform:rotate(180deg);
        min-width:40px;flex-shrink:0;
      ">CLIENTE</div>
      <div style="padding:14px 20px;flex:1;">
        <div style="font-size:16px;font-weight:700;color:#0f172a;margin-bottom:3px;">
          ${orc.cliente?.nome || "—"}
        </div>
        ${orc.cliente?.telefone
          ? `<div style="font-size:12px;color:#64748b;">Tel: ${orc.cliente.telefone}</div>`
          : ""}
      </div>
    </div>

    <!-- Tabela de itens -->
    <table style="width:100%;border-collapse:collapse;margin-bottom:4px;table-layout:fixed;">
      <colgroup>
        <col style="width:auto;">
        <col style="width:56px;">
        <col style="width:120px;">
        <col style="width:130px;">
      </colgroup>
      <thead>
        <tr>
          <th style="background:${bgColor};color:${txtColor};text-align:left;padding:10px 14px;font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;">Item</th>
          <th style="background:${bgColor};color:${txtColor};text-align:center;padding:10px 8px;font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;">Qtd</th>
          <th style="background:${bgColor};color:${txtColor};text-align:right;padding:10px 14px;font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;">Unitário</th>
          <th style="background:${bgColor};color:${txtColor};text-align:right;padding:10px 14px;font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${itens.map((item,i)=>`
          <tr style="border-bottom:1px solid #f1f5f9;background:${i%2===0?"#ffffff":"#fafbff"};">
            <td style="padding:11px 14px;word-break:break-word;">
              <div style="font-weight:600;font-size:13px;color:#0f172a;">${item.nome||"—"}</div>
              <div style="font-size:9px;color:#94a3b8;text-transform:uppercase;margin-top:1px;">${item.tipo}</div>
            </td>
            <td style="padding:11px 8px;text-align:center;font-size:13px;color:#475569;">${item.quantidade}</td>
            <td style="padding:11px 14px;text-align:right;font-size:13px;color:#475569;">${fmtR$(item.valorUnitario)}</td>
            <td style="padding:11px 14px;text-align:right;font-size:13px;font-weight:700;color:#0f172a;">${fmtR$(item.valorTotal)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>

    <!-- Resumo financeiro (alinhado à direita) -->
    <div style="display:flex;justify-content:flex-end;margin-bottom:22px;">
      <div style="min-width:260px;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">
        ${(desc>0||acr>0)?`
          <div style="padding:10px 16px;border-bottom:1px solid #f1f5f9;">
            <div style="display:flex;justify-content:space-between;font-size:12px;color:#64748b;margin-bottom:4px;">
              <span>Subtotal</span><span>${fmtR$(subtotal)}</span>
            </div>
            ${desc>0?`
              <div style="display:flex;justify-content:space-between;font-size:12px;color:#ef4444;">
                <span>Descontos</span><span>−${fmtR$(desc)}</span>
              </div>`:""
            }
            ${acr>0?`
              <div style="display:flex;justify-content:space-between;font-size:12px;color:#059669;">
                <span>Acréscimos</span><span>+${fmtR$(acr)}</span>
              </div>`:""
            }
          </div>`:""}
        <div style="
          display:flex;justify-content:space-between;align-items:center;
          padding:14px 16px;background:${bgColor};color:${txtColor};
        ">
          <span style="font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;">TOTAL</span>
          <span style="font-size:20px;font-weight:700;">${fmtR$(total)}</span>
        </div>
      </div>
    </div>

    <!-- Observações -->
    ${orc.descricaoLivre?`
      <div style="
        border-left:3px solid ${bgColor};border:1px solid #e2e8f0;
        border-left-width:3px;border-left-color:${bgColor};
        border-radius:0 8px 8px 0;padding:12px 16px;margin-bottom:22px;background:#fafbff;
      ">
        <div style="font-size:9px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#64748b;margin-bottom:5px;">Observações</div>
        <div style="font-size:13px;color:#374151;line-height:1.65;">${orc.descricaoLivre}</div>
      </div>`:""}

    <!-- Rodapé: validade + assinatura -->
    <div style="
      display:flex;justify-content:space-between;align-items:flex-end;
      border-top:1px solid #e2e8f0;padding-top:20px;
    ">
      <div>
        <div style="font-size:9px;color:#94a3b8;text-transform:uppercase;letter-spacing:.1em;margin-bottom:5px;">Validade do orçamento</div>
        <div style="font-size:15px;font-weight:700;color:#0f172a;">${validade}</div>
      </div>
      <div style="text-align:center;min-width:220px;">
        <div style="border-top:1.5px solid #0f172a;padding-top:8px;font-size:11px;color:#64748b;">
          Assinatura do cliente
        </div>
      </div>
    </div>

    <!-- Footer empresa -->
    <div style="
      text-align:center;font-size:9px;color:#94a3b8;
      margin-top:16px;padding-top:12px;border-top:1px dashed #e2e8f0;
    ">
      ${nomeEmp} &mdash; Documento gerado via ASSENT v2.0
    </div>

  </div>
</div>`;

  window.print();
}

/* ══════════════════════════════════════════════════
   MODAL TOAST / CONFIRM (sem window.*)
   ══════════════════════════════════════════════════ */
function ModalToast({ tipo="info", titulo, mensagem, okLabel="OK", cancelLabel="Cancelar", onOk, onCancel }) {
  const icons = { info:"💬", warn:"⚠️", error:"❌", success:"✅", confirm:"🔄" };
  return (
    <div className="orc-toast-ov">
      <div className="orc-toast-box">
        <div className="orc-toast-icon">{icons[tipo]||"💬"}</div>
        <div className="orc-toast-title">{titulo}</div>
        <div className="orc-toast-msg">{mensagem}</div>
        <div className="orc-toast-acts">
          {onCancel && <button className="btn-secondary" onClick={onCancel}>{cancelLabel}</button>}
          <button className={tipo==="error"?"btn-danger":"btn-primary"} onClick={onOk}>{okLabel}</button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════
   MODAL PIPELINE
   ══════════════════════════════════════════════════ */
function ModalPipeline({ orc, uid, onClose, onUpdated }) {
  const [status, setStatus]   = useState(orc.statusComercial||"rascunho");
  const [salvando, setSalvando] = useState(false);
  const [toast, setToast]     = useState(null);

  const handleSalvar = async () => {
    setSalvando(true);
    try {
      const ref = doc(db,"users",uid,"orcamentos",orc.id);
      /* Read ANTES do write */
      const snap = await getDoc(ref);
      const interacoes = snap.data()?.interacoes||[];
      await runTransaction(db, async tx => {
        tx.update(ref, {
          statusComercial: status,
          interacoes: [...interacoes, {
            tipo:"edicao",
            descricao:`Status comercial → "${SC_LABELS[status]||status}"`,
            data:Timestamp.now(),
          }],
        });
      });
      onUpdated(); onClose();
    } catch(err) {
      setToast({ tipo:"error", titulo:"Erro", mensagem:err.message, onOk:()=>setToast(null) });
    } finally { setSalvando(false); }
  };

  return (
    <div className="modal-overlay modal-overlay-top" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal-box modal-box-sm">
        <div className="modal-header">
          <div>
            <div className="modal-title">Pipeline Comercial</div>
            <div className="modal-sub">{orc.codigo}</div>
          </div>
          <button className="modal-close" onClick={onClose}><X size={14} color="var(--text-2)"/></button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Etapa atual</label>
            <select className="orc-sel" value={status} onChange={e=>setStatus(e.target.value)}>
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
            {salvando?"Salvando...":"Salvar"}
          </button>
        </div>
      </div>
      {toast && <ModalToast {...toast}/>}
    </div>
  );
}

/* ══════════════════════════════════════════════════
   MODAL DETALHE
   ══════════════════════════════════════════════════ */
function ModalDetalhe({ orc:orcInicial, uid, empresa, onClose, onEditar, onConverter }) {
  const [orc,       setOrc]  = useState(orcInicial);
  const [showPM,    setShowPM] = useState(false);
  const [convertendo, setConv] = useState(false);
  const [toast,     setToast]  = useState(null);

  const ss      = statusSistema(orc);
  const jaConv  = ss === "convertido";
  const podeCon = !!orc.cliente?.id && !jaConv;

  const refreshOrc = useCallback(async () => {
    const snap = await getDoc(doc(db,"users",uid,"orcamentos",orc.id));
    if (snap.exists()) setOrc({id:snap.id,...snap.data()});
  },[uid,orc.id]);

  const handleConverter = () => {
    if (!podeCon) return;
    setToast({
      tipo:"confirm",
      titulo:"Converter em Venda?",
      mensagem:`O orçamento ${orc.codigo} será convertido em uma nova venda. Esta ação não pode ser desfeita.`,
      okLabel:"Sim, converter",
      cancelLabel:"Cancelar",
      onCancel:()=>setToast(null),
      onOk:async()=>{
        setToast(null); setConv(true);
        try {
          await onConverter(orc); onClose();
        } catch(err) {
          setToast({ tipo:"error", titulo:"Erro na conversão", mensagem:err.message, onOk:()=>setToast(null) });
        } finally { setConv(false); }
      },
    });
  };

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal-box modal-box-xl">

        <div className="modal-header">
          <div>
            <div className="modal-title">
              {orc.codigo}
              <span className={`orc-status ${SC_CLASS[orc.statusComercial]||"orc-st-rascunho"}`}>
                {SC_LABELS[orc.statusComercial]||orc.statusComercial}
              </span>
              <span className={`orc-status ${SS_CLASS[ss]||"orc-st-ativo"}`}>
                {ss.charAt(0).toUpperCase()+ss.slice(1)}
              </span>
            </div>
            <div className="modal-sub">
              Criado {fmtData(orc.datas?.criacao)} · Válido até {fmtData(orc.datas?.validade)}
            </div>
          </div>
          <button className="modal-close" onClick={onClose}><X size={14} color="var(--text-2)"/></button>
        </div>

        <div className="modal-body">

          {jaConv && (
            <div className="od-aviso od-aviso-ok">
              <CheckCircle size={14} color="var(--green)"/>
              Convertido na venda <strong>{orc.conversao?.vendaId}</strong> em {fmtData(orc.conversao?.dataConversao)}.
            </div>
          )}
          {!orc.cliente?.id && !jaConv && (
            <div className="od-aviso od-aviso-warn">
              <AlertTriangle size={14} color="var(--gold)"/>
              Para converter em venda, o cliente precisa estar <strong>cadastrado no sistema</strong>.
            </div>
          )}
          {ss==="expirado" && !jaConv && (
            <div className="od-aviso od-aviso-exp">
              <Clock size={14} color="var(--text-3)"/>
              Este orçamento expirou em {fmtData(orc.datas?.validade)}.
            </div>
          )}

          {/* Cliente */}
          <div className="od-sec">
            <div className="od-sec-title"><User size={11}/> Cliente</div>
            <div className="od-grid">
              <div className="od-card"><div className="od-lbl">Nome</div><div className="od-val">{orc.cliente?.nome||"—"}</div></div>
              <div className="od-card"><div className="od-lbl">Telefone</div><div className="od-val">{orc.cliente?.telefone||"—"}</div></div>
              <div className="od-card"><div className="od-lbl">Origem</div><div className="od-val">{orc.cliente?.origem==="cadastrado"?"✅ Cadastrado":"✏️ Manual"}</div></div>
            </div>
          </div>

          {/* Itens */}
          <div className="od-sec">
            <div className="od-sec-title"><List size={11}/> Itens</div>
            <div className="od-table">
              <div className="od-thead">
                <span>Item</span><span>Qtd</span><span>Unit.</span><span>Total</span>
              </div>
              {(orc.itens||[]).map((item,i)=>(
                <div className="od-trow" key={i}>
                  <span className="od-nome">
                    {item.nome}
                    <span style={{fontSize:9,color:"var(--text-3)",marginLeft:6,textTransform:"uppercase"}}>{item.tipo}</span>
                  </span>
                  <span>{item.quantidade}</span>
                  <span>{fmtR$(item.valorUnitario)}</span>
                  <span style={{color:"var(--green)",fontWeight:600}}>{fmtR$(item.valorTotal)}</span>
                </div>
              ))}
            </div>
            {orc.descricaoLivre && (
              <div style={{background:"var(--s2)",border:"1px solid var(--border)",borderRadius:10,padding:"10px 13px",fontSize:12,color:"var(--text-2)"}}>
                <div className="od-lbl" style={{marginBottom:4}}>Observações</div>
                {orc.descricaoLivre}
              </div>
            )}
          </div>

          {/* Financeiro */}
          <div className="od-sec">
            <div className="od-sec-title">💰 Resumo Financeiro</div>
            <div className="od-totals">
              <div className="orc-tc">
                <span className="orc-tc-lbl">Subtotal</span>
                <span className="orc-tc-val">{fmtR$(orc.resumoFinanceiro?.subtotal)}</span>
              </div>
              {(orc.resumoFinanceiro?.descontos||0)>0 && (
                <div className="orc-tc">
                  <span className="orc-tc-lbl">Descontos</span>
                  <span className="orc-tc-val" style={{color:"var(--red)"}}>−{fmtR$(orc.resumoFinanceiro.descontos)}</span>
                </div>
              )}
              {(orc.resumoFinanceiro?.acrescimos||0)>0 && (
                <div className="orc-tc">
                  <span className="orc-tc-lbl">Acréscimos</span>
                  <span className="orc-tc-val" style={{color:"var(--green)"}}>+{fmtR$(orc.resumoFinanceiro.acrescimos)}</span>
                </div>
              )}
              <div className="orc-tc" style={{marginLeft:"auto"}}>
                <span className="orc-tc-lbl">Total Final</span>
                <span className="orc-tc-val" style={{color:"var(--green)",fontSize:16}}>{fmtR$(orc.resumoFinanceiro?.totalFinal)}</span>
              </div>
            </div>
          </div>

          {/* Histórico */}
          {(orc.interacoes||[]).length>0 && (
            <div className="od-sec">
              <div className="od-sec-title"><Clock size={11}/> Histórico</div>
              <ul className="od-timeline">
                {[...(orc.interacoes||[])].reverse().map((ev,i)=>(
                  <li className="od-event" key={i}>
                    <span className="od-ev-tipo">{ev.tipo}</span>
                    <span className="od-ev-desc">{ev.descricao}</span>
                    <span className="od-ev-data">{fmtData(ev.data)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="modal-footer" style={{flexWrap:"wrap",gap:8}}>
          <button className="btn-secondary" onClick={()=>setShowPM(true)} style={{marginRight:"auto"}}>
            <TrendingUp size={13}/> Pipeline
          </button>
          <button className="btn-secondary" onClick={()=>imprimirOrcamento(orc,empresa)}>
            <Printer size={13}/> Imprimir
          </button>
          {!jaConv && (
            <button className="btn-secondary" onClick={()=>onEditar(orc)}>
              <Edit2 size={13}/> Editar
            </button>
          )}
          <button className="btn-green" onClick={handleConverter}
            disabled={!podeCon||convertendo}
            title={!orc.cliente?.id?"Cliente precisa ser cadastrado":""}
          >
            <RefreshCw size={13}/>
            {convertendo?"Convertendo...":jaConv?"Já convertido":"Converter em Venda"}
          </button>
        </div>
      </div>

      {showPM && <ModalPipeline orc={orc} uid={uid} onClose={()=>setShowPM(false)} onUpdated={refreshOrc}/>}
      {toast && <ModalToast {...toast}/>}
    </div>
  );
}

/* ══════════════════════════════════════════════════
   MODAL NOVO / EDITAR
   ══════════════════════════════════════════════════ */
function ModalNovoOrc({ orc, uid, clientes, produtos, servicos, onSave, onClose }) {
  const isEdit = !!orc;

  const [cliOrigem, setCliOrigem] = useState(orc?.cliente?.origem||"manual");
  const [cliId,     setCliId]     = useState(orc?.cliente?.id||null);
  const [cliNome,   setCliNome]   = useState(orc?.cliente?.nome||"");
  const [cliTel,    setCliTel]    = useState(orc?.cliente?.telefone||"");
  const [cliSearch, setCliSearch] = useState(orc?.cliente?.nome||"");
  const [cliAC,     setCliAC]     = useState(false);

  const novoItem = ()=>({tipo:"produto",idRef:"",nome:"",quantidade:1,valorUnitario:0,valorTotal:0,origem:"manual"});
  const [itens,   setItens]   = useState(orc?.itens?.length?orc.itens.map(i=>({...novoItem(),...i})):[novoItem()]);
  const [iSearch, setISearch] = useState(orc?.itens?.length?orc.itens.map(i=>i.nome||""):[""] );
  const [iAC,     setIAC]     = useState(null);

  const [descLivre,  setDescLivre]  = useState(orc?.descricaoLivre||"");
  const [descontos,  setDescontos]  = useState(orc?.resumoFinanceiro?.descontos||0);
  const [acrescimos, setAcrescimos] = useState(orc?.resumoFinanceiro?.acrescimos||0);
  const [statusCom,  setStatusCom]  = useState(orc?.statusComercial||"rascunho");

  const [lCor,    setLCor]    = useState(orc?.configuracaoLayout?.corHeader||"#0f172a");
  const [lCorTxt, setLCorTxt] = useState(orc?.configuracaoLayout?.corTextoHeader||"#f8fafc");
  const [lLogo,   setLLogo]   = useState(orc?.configuracaoLayout?.posicaoLogo||"esquerda");

  const [salvando, setSalvando] = useState(false);
  const [erros,    setErros]    = useState({});
  const [toast,    setToast]    = useState(null);

  const cliFilt = useMemo(()=>{
    if(!cliSearch.trim()) return clientes.slice(0,6);
    const q=cliSearch.toLowerCase();
    return clientes.filter(c=>c.nome?.toLowerCase().includes(q)||c.telefone?.toLowerCase().includes(q)).slice(0,6);
  },[clientes,cliSearch]);

  const selecionarCliente = c => {
    setCliId(c.id); setCliNome(c.nome);
    setCliTel(c.telefone||""); setCliSearch(c.nome); setCliAC(false);
  };

  const catFilt = (search, tipo) => {
    const lista = tipo==="servico"?servicos:produtos;
    if(!search.trim()) return lista.slice(0,8);
    const q=search.toLowerCase();
    return lista.filter(p=>p.nome?.toLowerCase().includes(q)).slice(0,8);
  };

  const selecionarCat = (idx,prod,tipo) => {
    const n=[...itens];
    n[idx]={...n[idx],idRef:prod.id,nome:prod.nome,valorUnitario:prod.preco||0,
      valorTotal:(prod.preco||0)*(n[idx].quantidade||1),origem:"catalogo",tipo};
    setItens(n);
    const s=[...iSearch]; s[idx]=prod.nome; setISearch(s); setIAC(null);
  };

  const updItem = (idx,campo,val) => {
    const n=[...itens]; n[idx]={...n[idx],[campo]:val};
    if(campo==="quantidade"||campo==="valorUnitario"){
      const q=parseInt(campo==="quantidade"?val:n[idx].quantidade)||1;
      const p=parseFloat(campo==="valorUnitario"?val:n[idx].valorUnitario)||0;
      n[idx].valorTotal=parseFloat((q*p).toFixed(2));
    }
    setItens(n);
  };

  const addItem = ()=>{ setItens([...itens,novoItem()]); setISearch([...iSearch,""]); };
  const rmItem  = idx=>{ if(itens.length===1)return; setItens(itens.filter((_,i)=>i!==idx)); setISearch(iSearch.filter((_,i)=>i!==idx)); };

  const calc = useMemo(()=>{
    const sub=itens.reduce((s,i)=>s+(parseFloat(i.valorTotal)||0),0);
    const d=parseFloat(descontos)||0; const a=parseFloat(acrescimos)||0;
    return {subtotal:sub,descontos:d,acrescimos:a,totalFinal:Math.max(0,sub-d+a)};
  },[itens,descontos,acrescimos]);

  const validar = ()=>{
    const e={};
    const nome=cliOrigem==="cadastrado"?cliSearch.trim():cliNome.trim();
    if(!nome) e.cliNome="Informe o nome do cliente.";
    if(cliOrigem==="manual"&&!cliTel.trim()) e.cliTel="Informe o telefone.";
    if(!itens.some(i=>i.nome.trim()&&i.valorUnitario>0)) e.itens="Adicione ao menos um item válido (com nome e valor).";
    setErros(e); return Object.keys(e).length===0;
  };

  const handleSalvar = async () => {
    if(!validar()) return;
    setSalvando(true);
    const itensF=itens
      .filter(i=>i.nome.trim()&&i.valorUnitario>0)
      .map(i=>({
        tipo:i.tipo, idRef:i.idRef||null, nome:i.nome.trim(),
        quantidade:parseInt(i.quantidade)||1,
        valorUnitario:parseFloat(i.valorUnitario)||0,
        valorTotal:parseFloat(i.valorTotal)||0,
        origem:i.origem||"manual",
      }));
    const payload={
      cliente:{
        id:cliOrigem==="cadastrado"?(cliId||null):null,
        nome:cliOrigem==="cadastrado"?cliSearch.trim():cliNome.trim(),
        telefone:cliOrigem==="cadastrado"?(clientes.find(c=>c.id===cliId)?.telefone||cliTel):cliTel.trim(),
        origem:cliOrigem,
      },
      itens:itensF,
      descricaoLivre:descLivre.trim()||null,
      resumoFinanceiro:calc,
      comportamento:{
        quantidadeItens:itensF.length,
        ticketMedioItem:itensF.length>0?calc.totalFinal/itensF.length:0,
        possuiItensManuais:itensF.some(i=>i.origem==="manual"),
      },
      statusComercial:statusCom,
      configuracaoLayout:{ corHeader:lCor, corTextoHeader:lCorTxt, posicaoLogo:lLogo },
    };
    try {
      await onSave(payload, isEdit?orc:null);
    } catch(err) {
      setToast({tipo:"error",titulo:"Erro ao salvar",mensagem:err.message,onOk:()=>setToast(null)});
    } finally { setSalvando(false); }
  };

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal-box modal-box-xl">
        <div className="modal-header">
          <div>
            <div className="modal-title">{isEdit?`Editando ${orc.codigo}`:"Novo Orçamento"}</div>
            <div className="modal-sub">{isEdit?"Altere e salve":"Preencha os dados do orçamento"}</div>
          </div>
          <button className="modal-close" onClick={onClose}><X size={14} color="var(--text-2)"/></button>
        </div>

        <div className="modal-body">

          {/* Cliente */}
          <div className="orc-cli-toggle">
            <button className={`orc-tog ${cliOrigem==="cadastrado"?"active":""}`}
              onClick={()=>{setCliOrigem("cadastrado");setCliId(null);}}>
              <User size={11}/> Cadastrado
            </button>
            <button className={`orc-tog ${cliOrigem==="manual"?"active":""}`}
              onClick={()=>{setCliOrigem("manual");setCliId(null);setCliSearch("");}}>
              <Edit2 size={11}/> Manual
            </button>
          </div>

          {cliOrigem==="cadastrado"?(
            <div className="form-group nv-autocomplete">
              <label className="form-label">Cliente <span className="form-label-req">*</span></label>
              <input className={`form-input ${erros.cliNome?"err":""}`}
                placeholder="Buscar cliente cadastrado..."
                value={cliSearch}
                onChange={e=>{setCliSearch(e.target.value);setCliId(null);setCliAC(true);}}
                onFocus={()=>setCliAC(true)}
                onBlur={()=>setTimeout(()=>setCliAC(false),180)}
                autoComplete="off"/>
              {erros.cliNome&&<div className="form-error">{erros.cliNome}</div>}
              {cliAC&&(
                <div className="nv-ac-list">
                  {cliFilt.length===0
                    ?<div className="nv-ac-empty">Nenhum cliente encontrado.</div>
                    :cliFilt.map(c=>(
                      <div key={c.id} className="nv-ac-item" onMouseDown={()=>selecionarCliente(c)}>
                        <span>{c.nome}</span>
                        <span className="nv-ac-item-sub">{c.telefone||""}</span>
                      </div>
                    ))
                  }
                </div>
              )}
              {cliId&&<div style={{fontSize:11,color:"var(--green)",marginTop:5}}>✅ Vinculado — conversão em venda habilitada.</div>}
            </div>
          ):(
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Nome <span className="form-label-req">*</span></label>
                <input className={`form-input ${erros.cliNome?"err":""}`}
                  placeholder="Nome do cliente" value={cliNome}
                  onChange={e=>setCliNome(e.target.value)}/>
                {erros.cliNome&&<div className="form-error">{erros.cliNome}</div>}
              </div>
              <div className="form-group">
                <label className="form-label">Telefone <span className="form-label-req">*</span></label>
                <input className={`form-input ${erros.cliTel?"err":""}`}
                  placeholder="(00) 00000-0000" value={cliTel}
                  onChange={e=>setCliTel(e.target.value)}/>
                {erros.cliTel&&<div className="form-error">{erros.cliTel}</div>}
              </div>
            </div>
          )}

          <div className="form-sep"/>

          {/* Itens */}
          <div className="orc-items-hdr">
            <span className="orc-items-label">Itens do Orçamento</span>
            <button className="orc-add-item" onClick={addItem}><Plus size={12}/> Adicionar</button>
          </div>
          {erros.itens&&<div className="form-error" style={{marginBottom:8}}>{erros.itens}</div>}

          {itens.map((item,idx)=>(
            <div className="orc-item-row" key={idx}>
              <div>
                <div className="orc-ifl">Tipo</div>
                <select className="orc-sel-sm" value={item.tipo} onChange={e=>updItem(idx,"tipo",e.target.value)}>
                  <option value="produto">Produto</option>
                  <option value="servico">Serviço</option>
                  <option value="livre">Livre</option>
                </select>
              </div>

              <div className="nv-autocomplete">
                <div className="orc-ifl">Descrição</div>
                <input className="form-input"
                  placeholder={item.tipo==="livre"?"Descrição livre...":"Buscar..."}
                  value={iSearch[idx]||""}
                  onChange={e=>{
                    const s=[...iSearch]; s[idx]=e.target.value; setISearch(s);
                    updItem(idx,"nome",e.target.value);
                    if(item.tipo!=="livre") setIAC(idx);
                  }}
                  onFocus={()=>{if(item.tipo!=="livre") setIAC(idx);}}
                  onBlur={()=>setTimeout(()=>setIAC(null),180)}
                  autoComplete="off"
                  style={{padding:"8px 10px",fontSize:12}}/>
                {iAC===idx&&item.tipo!=="livre"&&(
                  <div className="nv-ac-list">
                    {catFilt(iSearch[idx]||"",item.tipo).length===0
                      ?<div className="nv-ac-empty">Nenhum item.</div>
                      :catFilt(iSearch[idx]||"",item.tipo).map(p=>(
                        <div key={p.id} className="nv-ac-item" onMouseDown={()=>selecionarCat(idx,p,item.tipo)}>
                          <span>{p.nome}</span>
                          <span className="nv-ac-item-sub">{fmtR$(p.preco)}</span>
                        </div>
                      ))
                    }
                  </div>
                )}
              </div>

              <div>
                <div className="orc-ifl">Qtd</div>
                <input className="form-input" type="number" min="1" value={item.quantidade}
                  onChange={e=>updItem(idx,"quantidade",e.target.value)}
                  style={{padding:"8px 10px",fontSize:12}}/>
              </div>

              <div>
                <div className="orc-ifl">Valor (R$)</div>
                <input className="form-input" type="number" min="0" step="0.01" value={item.valorUnitario}
                  onChange={e=>updItem(idx,"valorUnitario",e.target.value)}
                  style={{padding:"8px 10px",fontSize:12}}/>
              </div>

              <button className="orc-item-rm" onClick={()=>rmItem(idx)} disabled={itens.length===1}>
                <X size={13}/>
              </button>
            </div>
          ))}

          <div className="orc-totals-bar">
            <div className="orc-tc">
              <span className="orc-tc-lbl">Subtotal</span>
              <span className="orc-tc-val">{fmtR$(calc.subtotal)}</span>
            </div>
            <div className="orc-tc">
              <span className="orc-tc-lbl">Descontos (R$)</span>
              <input type="number" min="0" step="0.01" className="orc-tc-input"
                value={descontos} onChange={e=>setDescontos(e.target.value)}/>
            </div>
            <div className="orc-tc">
              <span className="orc-tc-lbl">Acréscimos (R$)</span>
              <input type="number" min="0" step="0.01" className="orc-tc-input"
                value={acrescimos} onChange={e=>setAcrescimos(e.target.value)}/>
            </div>
            <div className="orc-tc" style={{marginLeft:"auto"}}>
              <span className="orc-tc-lbl">Total Final</span>
              <span className="orc-tc-val" style={{color:"var(--green)",fontSize:15}}>{fmtR$(calc.totalFinal)}</span>
            </div>
          </div>

          <div className="form-sep"/>

          <div className="form-group">
            <label className="form-label">Observações</label>
            <textarea className="form-input"
              placeholder="Condições, prazo de entrega, informações adicionais..."
              value={descLivre} onChange={e=>setDescLivre(e.target.value)}
              rows={3} style={{resize:"vertical"}}/>
          </div>

          <div className="form-sep"/>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Status Comercial</label>
              <select className="orc-sel" value={statusCom} onChange={e=>setStatusCom(e.target.value)}>
                <option value="rascunho">Rascunho</option>
                <option value="enviado">Enviado</option>
                <option value="aguardando_resposta">Aguardando Resposta</option>
                <option value="negociacao">Em Negociação</option>
                <option value="fechado">Fechado</option>
                <option value="perdido">Perdido</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Posição da Logo (Impressão)</label>
              <div className="orc-pos-btns">
                {["esquerda","centro","direita"].map(p=>(
                  <button key={p} className={`orc-pos ${lLogo===p?"active":""}`} onClick={()=>setLLogo(p)}>
                    {p.charAt(0).toUpperCase()+p.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Cor do Cabeçalho (Impressão)</label>
            <div className="orc-colors">
              {CORES_HEADER.map(c=>(
                <div key={c.bg}
                  className={`orc-color-opt ${lCor===c.bg?"sel":""}`}
                  style={{background:c.bg,outline:`1.5px solid ${lCor===c.bg?"var(--gold)":c.bg==="var(--border)"?"#ccc":c.bg}`}}
                  onClick={()=>{setLCor(c.bg);setLCorTxt(c.text);}}
                  title={c.bg}/>
              ))}
            </div>
            <div style={{marginTop:8,fontSize:11,color:"var(--text-3)"}}>
              Prévia: <span style={{background:lCor,color:lCorTxt,padding:"2px 12px",borderRadius:5,fontSize:11,display:"inline-block",marginTop:4}}>Cabeçalho do documento</span>
            </div>
          </div>

        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" onClick={handleSalvar} disabled={salvando}>
            {salvando?"Salvando...":isEdit?"Salvar Alterações":"Criar Orçamento"}
          </button>
        </div>
      </div>
      {toast&&<ModalToast {...toast}/>}
    </div>
  );
}

/* ══════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
   ══════════════════════════════════════════════════ */
export default function Orcamentos() {
  const [uid,        setUid]        = useState(null);
  const [orcamentos, setOrcamentos] = useState([]);
  const [clientes,   setClientes]   = useState([]);
  const [produtos,   setProdutos]   = useState([]);
  const [servicos,   setServicos]   = useState([]);
  const [empresa,    setEmpresa]    = useState({});
  const [loading,    setLoading]    = useState(true);

  const [search,     setSearch]     = useState("");
  const [filtro,     setFiltro]     = useState("Todos");
  const [modalNovo,  setModalNovo]  = useState(false);
  const [editando,   setEditando]   = useState(null);
  const [detalhe,    setDetalhe]    = useState(null);

  useEffect(()=>{ const u=onAuthStateChanged(auth,u=>setUid(u?.uid||null)); return u; },[]);

  useEffect(()=>{
    if(!uid) return;
    const subs=[];
    subs.push(onSnapshot(
      query(collection(db,"users",uid,"orcamentos"),orderBy("datas.criacao","desc")),
      snap=>{ setOrcamentos(snap.docs.map(d=>({id:d.id,...d.data()}))); setLoading(false); },
      ()=>setLoading(false)
    ));
    subs.push(onSnapshot(collection(db,"users",uid,"clientes"), snap=>setClientes(snap.docs.map(d=>({id:d.id,...d.data()})))));
    subs.push(onSnapshot(collection(db,"users",uid,"produtos"),  snap=>setProdutos(snap.docs.map(d=>({id:d.id,...d.data()})))));
    subs.push(onSnapshot(collection(db,"users",uid,"servicos"),  snap=>setServicos(snap.docs.map(d=>({id:d.id,...d.data()})))));

    /* Lê config/geral → empresa.nomeEmpresa, empresa.logo, empresa.cnpj… */
    getDoc(doc(db,"users",uid,"config","geral")).then(snap=>{
      if(snap.exists()) setEmpresa(snap.data()?.empresa||{});
    });

    return ()=>subs.forEach(u=>u());
  },[uid]);

  /* ── Salvar ──
     REGRA FIRESTORE: dentro de runTransaction, todos os tx.get()
     ANTES de qualquer tx.set() ou tx.update()                     */
  const handleSave = async (payload, orcExistente) => {
    if(!uid) return;

    if(orcExistente) {
      const ref = doc(db,"users",uid,"orcamentos",orcExistente.id);
      /* Read fora da transação — sem necessidade de consistência aqui */
      const snap = await getDoc(ref);
      const interacoes = snap.data()?.interacoes||[];
      await runTransaction(db, async tx=>{
        /* Apenas writes dentro da tx (read já foi feito acima) */
        tx.update(ref, {
          ...payload,
          interacoes:[...interacoes,{tipo:"edicao",descricao:"Orçamento editado",data:Timestamp.now()}],
        });
      });
      setEditando(null);

    } else {
      const cntRef = doc(db,"users",uid);
      await runTransaction(db, async tx=>{
        /* 1 — READS (todos antes de qualquer write) */
        const cntSnap = await tx.get(cntRef);

        /* 2 — Calcular */
        const cnt      = cntSnap.data()?.orcamentoCnt||0;
        const novoCnt  = cnt+1;
        const codigo   = gerarCodigo(cnt);
        const agora    = Timestamp.now();
        const validade = Timestamp.fromDate(new Date(Date.now()+7*24*60*60*1000));
        const orcRef   = doc(collection(db,"users",uid,"orcamentos"));

        /* 3 — WRITES */
        tx.update(cntRef, {orcamentoCnt:novoCnt});
        tx.set(orcRef,{
          ...payload, codigo,
          statusSistema:"ativo",
          pipeline:{etapa:payload.statusComercial||"rascunho"},
          datas:{criacao:agora,validade},
          interacoes:[{tipo:"criacao",descricao:"Orçamento criado",data:agora}],
          conversao:{convertido:false,vendaId:null,dataConversao:null},
        });
      });
      setModalNovo(false);
    }
  };

  /* ── Converter em venda ──
     REGRA CRÍTICA: todos os tx.get() ANTES de qualquer tx.set/update */
  const handleConverterVenda = async (orc) => {
    if(!uid||!orc.cliente?.id) throw new Error("Cliente não cadastrado no sistema.");

    const cntRef = doc(db,"users",uid);
    const orcRef = doc(db,"users",uid,"orcamentos",orc.id);

    await runTransaction(db, async tx=>{
      /* ── 1. READS — obrigatório antes de qualquer write ── */
      const cntSnap = await tx.get(cntRef);
      const orcSnap = await tx.get(orcRef);

      /* ── 2. Calcular ── */
      const cntV     = cntSnap.data()?.vendaIdCnt||0;
      const novoCnt  = cntV+1;
      const vendaId  = `V${String(novoCnt).padStart(4,"0")}`;
      const agora    = Timestamp.now();
      const interacoes = orcSnap.data()?.interacoes||[];

      const itensVenda = (orc.itens||[]).map(item=>({
        produtoId: item.idRef||null,
        nome:      item.nome,
        qtd:       item.quantidade,
        preco:     item.valorUnitario,
        custo:     0,
        desconto:  0,
        tipo:      item.tipo==="livre"?"livre":item.tipo,
      }));

      /* ── 3. WRITES — após todos os reads ── */
      tx.update(cntRef, {vendaIdCnt:novoCnt});

      tx.set(doc(db,"users",uid,"vendas",vendaId),{
        cliente:        orc.cliente.nome,
        clienteId:      orc.cliente.id,
        data:           agora,
        formaPagamento:"Outros",
        total:          orc.resumoFinanceiro?.totalFinal||0,
        subtotal:       orc.resumoFinanceiro?.subtotal||0,
        descontos:      orc.resumoFinanceiro?.descontos||0,
        lucroEstimado:  orc.resumoFinanceiro?.totalFinal||0,
        parcelas:       null,
        taxaPercentual: 0,
        valorTaxa:      0,
        valorPago:      null,
        valorRestante:  null,
        dataVencSinal:  null,
        statusPagamento:"recebido",
        valorRecebido:  orc.resumoFinanceiro?.totalFinal||0,
        tipo:           "produto",
        itens:          itensVenda,
        observacao:     `Convertido do orçamento ${orc.codigo}`,
        origem:         "orcamento",
        orcamentoId:    orc.id,
      });

      tx.update(orcRef,{
        statusSistema:  "convertido",
        statusComercial:"fechado",
        conversao:{ convertido:true, vendaId, dataConversao:agora },
        interacoes:[...interacoes,{tipo:"conversao",descricao:`Convertido na venda ${vendaId}`,data:agora}],
      });
    });
  };

  /* ── Filtros ── */
  const orcFilt = useMemo(()=>{
    let lista = orcamentos.map(o=>({...o,_ss:statusSistema(o)}));
    const mapa = filtroParaStatus(filtro);
    if(mapa){
      if(mapa.sc) lista=lista.filter(o=>o.statusComercial===mapa.sc);
      if(mapa.ss) lista=lista.filter(o=>o._ss===mapa.ss);
    }
    if(search.trim()){
      const q=search.toLowerCase();
      lista=lista.filter(o=>o.codigo?.toLowerCase().includes(q)||o.cliente?.nome?.toLowerCase().includes(q));
    }
    return lista;
  },[orcamentos,filtro,search]);

  if(!uid) return <div className="orc-loading">Carregando autenticação...</div>;

  return (
    <>
      <style>{CSS}</style>
      <div id="orc-print-root"/>

      <header className="orc-topbar">
        <div className="orc-topbar-title">
          <h1>Orçamentos</h1>
          <p>Crie, gerencie e converta orçamentos em vendas</p>
        </div>
        <div className="orc-search">
          <Search size={13} color="var(--text-3)"/>
          <input placeholder="Buscar por código ou cliente..." value={search} onChange={e=>setSearch(e.target.value)}/>
        </div>
        <div className="orc-topbar-right">
          <button onClick={()=>setModalNovo(true)} style={{
            display:"flex",alignItems:"center",gap:7,padding:"8px 16px",borderRadius:9,
            background:"var(--gold)",color:"#0a0808",border:"none",cursor:"pointer",
            fontFamily:"'DM Sans',sans-serif",fontSize:13,fontWeight:600,whiteSpace:"nowrap",
          }}>
            <Plus size={14}/> Novo Orçamento
          </button>
        </div>
      </header>

      <div className="orc-filters">
        {FILTROS.map(f=>(
          <button key={f} className={`orc-filter-btn ${filtro===f?"active":""}`} onClick={()=>setFiltro(f)}>{f}</button>
        ))}
      </div>

      <div className="ag-content">
        <div className="orc-table-wrap">
          <div className="orc-table-header">
            <div className="orc-table-title">
              Orçamentos <span className="orc-count-badge">{orcFilt.length}</span>
            </div>
          </div>

          <div className="orc-row orc-row-head">
            <span>Código</span>
            <span>Cliente</span>
            <span>Criado em</span>
            <span>Status Comercial</span>
            <span>Situação</span>
            <span>Total</span>
            <span style={{textAlign:"right"}}>Ações</span>
          </div>

          {loading?(
            <div className="orc-loading">Carregando orçamentos...</div>
          ):orcFilt.length===0?(
            <div className="orc-empty">
              <FileText size={28} color="var(--text-3)" style={{marginBottom:8}}/>
              <p>Nenhum orçamento encontrado.</p>
            </div>
          ):orcFilt.map(o=>(
            <div key={o.id} className="orc-row" onClick={()=>setDetalhe(o)}>
              <span className="orc-codigo">{o.codigo||o.id}</span>
              <span className="orc-cliente">{o.cliente?.nome||"—"}</span>
              <span>{fmtData(o.datas?.criacao)}</span>
              <span>
                <span className={`orc-status ${SC_CLASS[o.statusComercial]||"orc-st-rascunho"}`}>
                  {SC_LABELS[o.statusComercial]||o.statusComercial}
                </span>
              </span>
              <span>
                <span className={`orc-status ${SS_CLASS[o._ss]||"orc-st-ativo"}`}>
                  {o._ss?.charAt(0).toUpperCase()+o._ss?.slice(1)}
                </span>
              </span>
              <span className="orc-total">{fmtR$(o.resumoFinanceiro?.totalFinal)}</span>
              <div className="orc-actions" onClick={e=>e.stopPropagation()}>
                <button className="btn-icon btn-icon-edit" title="Editar" onClick={()=>setEditando(o)}><Edit2 size={13}/></button>
                <button className="btn-icon btn-icon-view" title="Ver detalhes" onClick={()=>setDetalhe(o)}><FileText size={13}/></button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {modalNovo && (
        <ModalNovoOrc uid={uid} clientes={clientes} produtos={produtos} servicos={servicos}
          onSave={handleSave} onClose={()=>setModalNovo(false)}/>
      )}
      {editando && (
        <ModalNovoOrc orc={editando} uid={uid} clientes={clientes} produtos={produtos} servicos={servicos}
          onSave={handleSave} onClose={()=>setEditando(null)}/>
      )}
      {detalhe && (
        <ModalDetalhe orc={detalhe} uid={uid} empresa={empresa}
          onClose={()=>setDetalhe(null)}
          onEditar={o=>{setDetalhe(null);setEditando(o);}}
          onConverter={handleConverterVenda}/>
      )}
    </>
  );
}
