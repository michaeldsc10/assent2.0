/* ═══════════════════════════════════════════════════
   ASSENT v2.0 — Relatorios.jsx
   Módulo completo de Relatórios Profissionais
   ─────────────────────────────────────────────────
   DEPENDÊNCIA NECESSÁRIA:
     npm install xlsx
   ═══════════════════════════════════════════════════ */

import { useState, useEffect, useMemo, useCallback, useContext } from "react";
import * as XLSX from "xlsx";

import {
  BarChart2, TrendingUp, TrendingDown, DollarSign,
  ShoppingCart, Package, Users, Calendar, FileText,
  Download, Printer, AlertCircle, Loader2,
  ArrowUpRight, ArrowDownRight, Minus,
  ChevronRight, Receipt, Wallet, LayoutDashboard, X,
} from "lucide-react";

import { db } from "../lib/firebase";
import AuthContext from "../contexts/AuthContext";
import { Lock } from "lucide-react";
import { collection, onSnapshot, doc, getDoc } from "firebase/firestore";

import FiltroPeriodo, { getIntervalo, dentroDoIntervalo } from "./FiltroPeriodo";
import CardResumo from "./CardResumo";
import TabelaRelatorio from "./TabelaRelatorio";

/* ══════════════════════════════════════════════════════
   CSS GLOBAL DO MÓDULO
   ══════════════════════════════════════════════════════ */
const CSS = `
/* ── Layout principal ── */
.rel-root {
  display: flex; flex-direction: column;
  height: 100%; min-height: 0; overflow: hidden;
}
.rel-topbar {
  padding: 14px 22px;
  background: var(--s1); border-bottom: 1px solid var(--border);
  display: flex; align-items: center; justify-content: space-between;
  gap: 14px; flex-shrink: 0;
}
.rel-topbar-left { display: flex; align-items: center; gap: 14px; }
.rel-topbar-title h1 {
  font-family: 'Sora', sans-serif; font-size: 17px; font-weight: 600;
  color: var(--text);
}
.rel-topbar-title p { font-size: 11px; color: var(--text-2); margin-top: 2px; }

.rel-actions { display: flex; align-items: center; gap: 8px; }

.rel-body {
  display: flex; flex: 1; min-height: 0; overflow: hidden;
}

/* ── Sidebar de navegação interna ── */
.rel-nav {
  width: 192px; flex-shrink: 0;
  background: var(--s1); border-right: 1px solid var(--border);
  padding: 14px 10px; overflow-y: auto; display: flex; flex-direction: column; gap: 2px;
}
.rel-nav-label {
  font-size: 9px; font-weight: 600; letter-spacing: .1em;
  text-transform: uppercase; color: var(--text-3);
  padding: 10px 10px 6px;
}
.rel-nav-btn {
  display: flex; align-items: center; gap: 9px;
  padding: 9px 10px; border-radius: 8px;
  background: transparent; border: none;
  color: var(--text-2); cursor: pointer;
  font-family: 'DM Sans', sans-serif;
  font-size: 13px; font-weight: 500;
  width: 100%; text-align: left;
  transition: all .13s;
}
.rel-nav-btn:hover { background: var(--s2); color: var(--text); }
.rel-nav-btn.active {
  background: rgba(200,165,94,0.12);
  color: var(--gold);
  border: 1px solid rgba(200,165,94,0.18);
}
.rel-nav-btn.active svg { color: var(--gold); }

/* ── Conteúdo principal ── */
.rel-content {
  flex: 1; overflow-y: auto; padding: 22px;
  display: flex; flex-direction: column; gap: 22px;
}
.rel-content::-webkit-scrollbar { width: 3px; }
.rel-content::-webkit-scrollbar-thumb { background: var(--text-3); border-radius: 2px; }

/* ── Filtro de período ── */
.fp-wrap {
  display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
  padding: 12px 16px;
  background: var(--s1); border: 1px solid var(--border);
  border-radius: 10px;
}
.fp-label {
  display: flex; align-items: center; gap: 5px;
  font-size: 10px; font-weight: 600; text-transform: uppercase;
  letter-spacing: .07em; color: var(--text-3); flex-shrink: 0;
}
.fp-btns { display: flex; gap: 4px; flex-wrap: wrap; }
.fp-btn {
  padding: 5px 12px; border-radius: 6px; font-size: 11px; font-weight: 500;
  background: var(--s3); border: 1px solid var(--border);
  color: var(--text-2); cursor: pointer;
  font-family: 'DM Sans', sans-serif;
  transition: all .13s;
}
.fp-btn:hover { background: var(--s2); color: var(--text); }
.fp-btn.active {
  background: rgba(200,165,94,0.15); border-color: var(--gold);
  color: var(--gold);
}
.fp-custom {
  display: flex; align-items: center; gap: 8px;
  margin-left: 4px;
}
.fp-date {
  background: var(--s2); border: 1px solid var(--border);
  border-radius: 6px; padding: 4px 10px;
  color: var(--text); font-size: 12px;
  font-family: 'DM Sans', sans-serif;
  outline: none;
}
.fp-date:focus { border-color: var(--gold); }
.fp-sep { font-size: 11px; color: var(--text-3); }

/* ── Cards de resumo ── */
.cr-grid {
  display: grid; gap: 14px;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
}
.cr-card {
  background: var(--s1); border: 1px solid var(--border);
  border-radius: 12px; padding: 16px;
  display: flex; align-items: flex-start; gap: 14px;
  transition: border-color .15s;
}
.cr-card:hover { border-color: var(--border-h); }
.cr-icon-wrap {
  width: 38px; height: 38px; border-radius: 9px;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.cr-body { flex: 1; min-width: 0; }
.cr-label {
  font-size: 10px; font-weight: 600; text-transform: uppercase;
  letter-spacing: .07em; color: var(--text-3); margin-bottom: 6px;
}
.cr-value {
  font-family: 'Sora', sans-serif; font-size: 18px; font-weight: 700;
  line-height: 1.1; margin-bottom: 4px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.cr-sub {
  display: flex; align-items: center; gap: 4px;
  font-size: 11px; color: var(--text-3);
}
.cr-skeleton {
  height: 26px; border-radius: 6px;
  background: linear-gradient(90deg, var(--s2) 25%, var(--s3) 50%, var(--s2) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  margin-bottom: 4px;
}
@keyframes shimmer { to { background-position: -200% 0; } }

/* ── Tabela ── */
.tr-wrap {
  background: var(--s1); border: 1px solid var(--border);
  border-radius: 12px; overflow: hidden;
}
.tr-header {
  padding: 13px 18px; border-bottom: 1px solid var(--border);
  display: flex; align-items: center; justify-content: space-between;
}
.tr-title {
  font-family: 'Sora', sans-serif; font-size: 13px;
  font-weight: 600; color: var(--text);
}
.tr-badge {
  font-size: 11px; font-weight: 600;
  background: var(--s3); border: 1px solid var(--border-h);
  color: var(--text-2); padding: 2px 10px; border-radius: 20px;
}
.tr-head {
  display: grid; padding: 9px 18px; gap: 8px;
  background: var(--s2); border-bottom: 1px solid var(--border);
  font-size: 9px; font-weight: 600; letter-spacing: .08em;
  text-transform: uppercase; color: var(--text-3);
}
.tr-row {
  display: grid; padding: 10px 18px; gap: 8px;
  border-bottom: 1px solid var(--border);
  font-size: 12px; color: var(--text-2);
  align-items: center; transition: background .1s;
}
.tr-row:last-child { border-bottom: none; }
.tr-row:hover { background: rgba(255,255,255,0.02); }
.tr-state {
  padding: 40px; text-align: center;
  font-size: 13px; color: var(--text-3);
}

/* ── DRE específico ── */
.dre-section { margin-bottom: 2px; }
.dre-row {
  display: grid; grid-template-columns: 1fr 130px 90px;
  padding: 10px 18px; gap: 8px;
  border-bottom: 1px solid var(--border);
  font-size: 13px; color: var(--text-2); align-items: center;
}
.dre-row:hover { background: rgba(255,255,255,0.015); }
.dre-row-cat {
  background: var(--s2);
  font-size: 9px; font-weight: 600; letter-spacing: .08em;
  text-transform: uppercase; color: var(--text-3);
  padding: 7px 18px; border-bottom: 1px solid var(--border);
}
.dre-row-result {
  background: rgba(0,0,0,0.18);
  font-weight: 700;
  border-top: 1px solid var(--border-h);
}
.dre-label { color: var(--text); }
.dre-sub-label { color: var(--text-2); padding-left: 14px; }
.dre-val { font-family: 'Sora', sans-serif; font-size: 13px; font-weight: 600; }
.dre-pct {
  font-size: 11px; color: var(--text-3);
  font-family: 'Sora', sans-serif; text-align: right;
}
.dre-positivo { color: var(--green) !important; }
.dre-negativo { color: var(--red) !important; }
.dre-neutro   { color: var(--text-2) !important; }

/* ── Banner de resultado final (lucro / prejuízo) ── */
.dre-resultado-banner {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 20px; border-radius: 12px; margin-top: 14px;
  border: 1px solid transparent;
}
.dre-resultado-banner.lucro {
  background: rgba(74,222,128,0.08);
  border-color: rgba(74,222,128,0.25);
}
.dre-resultado-banner.prejuizo {
  background: rgba(224,82,82,0.08);
  border-color: rgba(224,82,82,0.25);
}
.dre-resultado-esquerda {
  display: flex; align-items: center; gap: 10px;
}
.dre-resultado-emoji { font-size: 20px; line-height: 1; }
.dre-resultado-textos { display: flex; flex-direction: column; gap: 2px; }
.dre-resultado-titulo {
  font-family: 'Sora', sans-serif; font-size: 13px;
  font-weight: 700; text-transform: uppercase; letter-spacing: .06em;
}
.dre-resultado-banner.lucro    .dre-resultado-titulo { color: var(--green); }
.dre-resultado-banner.prejuizo .dre-resultado-titulo { color: var(--red); }
.dre-resultado-sub {
  font-size: 11px; color: var(--text-3);
}
.dre-resultado-valor {
  font-family: 'Sora', sans-serif; font-size: 20px; font-weight: 700;
}
.dre-resultado-banner.lucro    .dre-resultado-valor { color: var(--green); }
.dre-resultado-banner.prejuizo .dre-resultado-valor { color: var(--red); }

/* ── Ranking de despesas ── */
.rank-item {
  display: flex; align-items: center; gap: 12px;
  padding: 10px 18px; border-bottom: 1px solid var(--border);
}
.rank-item:last-child { border-bottom: none; }
.rank-num {
  font-family: 'Sora', sans-serif; font-size: 11px;
  font-weight: 700; color: var(--gold); width: 20px; flex-shrink: 0;
}
.rank-label { flex: 1; font-size: 13px; color: var(--text); }
.rank-bar-wrap { width: 120px; flex-shrink: 0; }
.rank-bar-bg {
  height: 4px; border-radius: 2px; background: var(--s3);
  overflow: hidden;
}
.rank-bar-fill {
  height: 100%; border-radius: 2px;
  background: var(--gold);
  transition: width .4s ease;
}
.rank-val {
  font-family: 'Sora', sans-serif; font-size: 12px;
  font-weight: 600; color: var(--text); min-width: 90px; text-align: right;
}

/* ── Agenda ── */
.ag-item {
  display: flex; align-items: flex-start; gap: 14px;
  padding: 13px 18px; border-bottom: 1px solid var(--border);
  transition: background .1s;
}
.ag-item:last-child { border-bottom: none; }
.ag-item:hover { background: rgba(255,255,255,0.018); }
.ag-date-box {
  flex-shrink: 0; width: 44px; text-align: center;
  background: var(--s2); border: 1px solid var(--border);
  border-radius: 8px; padding: 6px 4px;
}
.ag-date-day {
  font-family: 'Sora', sans-serif; font-size: 18px;
  font-weight: 700; color: var(--text); line-height: 1;
}
.ag-date-mon {
  font-size: 9px; font-weight: 600; letter-spacing: .06em;
  text-transform: uppercase; color: var(--text-3); margin-top: 2px;
}
.ag-info { flex: 1; min-width: 0; }
.ag-titulo { font-size: 13px; font-weight: 600; color: var(--text); margin-bottom: 3px; }
.ag-meta { font-size: 11px; color: var(--text-3); display: flex; gap: 10px; }
.ag-badge {
  font-size: 10px; font-weight: 600; padding: 2px 8px;
  border-radius: 4px; text-transform: uppercase; letter-spacing: .05em;
  flex-shrink: 0; align-self: flex-start; margin-top: 2px;
}
.ag-badge-hoje { background: rgba(200,165,94,0.15); color: var(--gold); }
.ag-badge-prox { background: rgba(91,142,240,0.12); color: var(--blue); }
.ag-badge-fut  { background: var(--s3); color: var(--text-2); }

/* ── Botões ── */
.btn-primary {
  padding: 9px 20px; border-radius: 9px;
  background: var(--gold); color: #0a0808;
  border: none; cursor: pointer;
  font-family: 'DM Sans', sans-serif;
  font-size: 13px; font-weight: 600;
  display: flex; align-items: center; gap: 7px;
  transition: opacity .13s, transform .1s;
}
.btn-primary:hover  { opacity: .88; }
.btn-primary:active { transform: scale(.97); }

.btn-secondary {
  padding: 8px 16px; border-radius: 9px;
  background: var(--s3); color: var(--text-2);
  border: 1px solid var(--border); cursor: pointer;
  font-family: 'DM Sans', sans-serif; font-size: 13px;
  display: flex; align-items: center; gap: 7px;
  transition: background .13s, color .13s;
}
.btn-secondary:hover { background: var(--s2); color: var(--text); }

/* ── Seções ── */
.rel-section-title {
  font-family: 'Sora', sans-serif; font-size: 14px;
  font-weight: 600; color: var(--text);
  display: flex; align-items: center; gap: 8px;
  padding-bottom: 2px;
}
.rel-section-title svg { color: var(--gold); }
.rel-divider {
  height: 1px; background: var(--border); margin: 4px 0;
}

/* ── Estados ── */
.rel-empty {
  display: flex; flex-direction: column; align-items: center;
  justify-content: center; padding: 60px 20px; gap: 12px;
  color: var(--text-3); text-align: center;
}
.rel-empty p { font-size: 13px; }
.rel-loading {
  display: flex; align-items: center; justify-content: center;
  padding: 60px; color: var(--text-3); gap: 10px; font-size: 13px;
}

/* ── Saldo positivo/negativo ── */
.val-pos { color: var(--green); font-family: 'Sora', sans-serif; font-weight: 600; }
.val-neg { color: var(--red);   font-family: 'Sora', sans-serif; font-weight: 600; }
.val-neu { color: var(--text);  font-family: 'Sora', sans-serif; font-weight: 600; }

/* ══════════════════════════════════════════
   IMPRESSÃO — @media print
   ══════════════════════════════════════════ */
@media print {
  body { background: #fff !important; color: #111 !important; }

  /* Ocultar tudo exceto o conteúdo do relatório */
  .rel-nav, .rel-topbar, .fp-wrap,
  .rel-actions, .btn-primary, .btn-secondary,
  [data-print-hide] { display: none !important; }

  .rel-body { display: block !important; }
  .rel-content {
    padding: 0 !important; overflow: visible !important;
    gap: 16px;
  }

  .cr-card, .tr-wrap, .dre-wrap {
    background: #fff !important;
    border: 1px solid #ccc !important;
    break-inside: avoid;
  }
  .cr-grid {
    grid-template-columns: repeat(4, 1fr) !important;
  }

  .tr-head { background: #f5f5f5 !important; }
  .dre-row-cat { background: #f5f5f5 !important; }
  .dre-row-result { background: #ebebeb !important; }

  * { color: #111 !important; }
  .dre-positivo { color: #1a7a3c !important; }
  .dre-negativo { color: #c0392b !important; }
  .val-pos { color: #1a7a3c !important; }
  .val-neg { color: #c0392b !important; }

  .rel-print-header {
    display: flex !important; justify-content: space-between;
    align-items: flex-end; margin-bottom: 24px;
    padding-bottom: 12px; border-bottom: 2px solid #ccc;
  }
  .rel-print-header h2 {
    font-family: 'Sora', sans-serif; font-size: 20px;
    font-weight: 700; color: #111;
  }
  .rel-print-header p { font-size: 11px; color: #666; margin-top: 3px; }
  .rel-print-brand {
    font-family: 'Sora', sans-serif; font-size: 13px;
    font-weight: 700; color: #111;
  }

  @page { size: A4; margin: 20mm 15mm; }
}
/* Ocultar no print por padrão */
.rel-print-header { display: none; }

/* ── Lucro por P/S ── */
.lps-tabs {
  display: flex; gap: 4px;
  background: var(--s2); border: 1px solid var(--border);
  border-radius: 10px; padding: 4px; width: fit-content;
}
.lps-tab {
  padding: 7px 20px; border-radius: 7px; font-size: 13px; font-weight: 500;
  background: transparent; border: none; cursor: pointer;
  font-family: 'DM Sans', sans-serif; color: var(--text-2);
  transition: all .13s;
}
.lps-tab.active {
  background: var(--s1); color: var(--text);
  border: 1px solid var(--border-h);
  box-shadow: 0 1px 4px rgba(0,0,0,0.18);
}
.lps-tab:not(.active):hover { color: var(--text); }

.lps-row {
  display: grid;
  grid-template-columns: 1fr 60px 140px 140px 180px;
  padding: 11px 18px; gap: 8px;
  border-bottom: 1px solid var(--border);
  align-items: center; font-size: 13px; color: var(--text-2);
  transition: background .1s;
}
.lps-row:last-child { border-bottom: none; }
.lps-row:hover { background: rgba(255,255,255,0.02); }
.lps-row-head {
  background: var(--s2);
  font-size: 10px; font-weight: 600; letter-spacing: .07em;
  text-transform: uppercase; color: var(--text-3);
}
.lps-row-head:hover { background: var(--s2); }
.lps-nome { color: var(--text); font-weight: 500; }
.lps-fat  { color: var(--blue);  font-family: 'Sora', sans-serif; font-size: 12px; font-weight: 600; }
.lps-custo { color: var(--red);  font-family: 'Sora', sans-serif; font-size: 12px; font-weight: 600; }
.lps-lucro-cell { display: flex; align-items: center; gap: 8px; }
.lps-lucro { color: var(--green); font-family: 'Sora', sans-serif; font-size: 12px; font-weight: 700; }
.lps-pct-badge {
  font-size: 10px; font-weight: 600; padding: 2px 7px;
  border-radius: 20px; font-family: 'Sora', sans-serif;
  white-space: nowrap;
}
.lps-pct-green { background: rgba(68,209,134,.12); color: var(--green); border: 1px solid rgba(68,209,134,.2); }
.lps-pct-gold  { background: rgba(200,165,94,.12);  color: var(--gold);  border: 1px solid rgba(200,165,94,.2); }
.lps-pct-red   { background: rgba(224,82,82,.12);   color: var(--red);   border: 1px solid rgba(224,82,82,.2); }

/* ── Extrato Financeiro ── */
.ext-wrap {
  background: var(--s1); border: 1px solid var(--border);
  border-radius: 12px; overflow: hidden;
}
.ext-header {
  padding: 13px 18px; border-bottom: 1px solid var(--border);
  display: flex; align-items: center; justify-content: space-between;
}
.ext-title {
  font-family: 'Sora', sans-serif; font-size: 13px;
  font-weight: 600; color: var(--text);
}
.ext-badge {
  font-size: 11px; font-weight: 600;
  background: var(--s3); border: 1px solid var(--border-h);
  color: var(--text-2); padding: 2px 10px; border-radius: 20px;
}
.ext-row {
  display: grid;
  grid-template-columns: 100px 1fr 114px 114px 114px;
  gap: 0; padding: 0 18px;
  border-bottom: 1px solid var(--border);
  align-items: center;
  min-width: 0;
}
.ext-row:last-child { border-bottom: none; }
.ext-row-head {
  background: var(--s2);
  font-size: 9px; font-weight: 600; letter-spacing: .08em;
  text-transform: uppercase; color: var(--text-3);
  padding: 9px 18px;
}
.ext-row-body { transition: background .1s; min-height: 52px; }
.ext-row-body:hover { background: rgba(255,255,255,0.02); }
.ext-cell {
  padding: 10px 12px 10px 0;
  font-size: 12px; color: var(--text-2);
  min-width: 0; overflow: hidden;
}
.ext-cell:last-child { padding-right: 0; }
.ext-cell-r { text-align: right; padding-right: 0; padding-left: 0; }
.ext-date {
  font-family: 'Sora', sans-serif; font-size: 11px;
  font-weight: 600; color: var(--text-2); white-space: nowrap;
}
.ext-desc-main {
  font-size: 12px; font-weight: 500; color: var(--text);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  display: block;
}
.ext-desc-tag {
  font-size: 10px; font-weight: 600; text-transform: uppercase;
  letter-spacing: .05em; margin-top: 2px; display: block;
}
.ext-tag-in  { color: var(--green); }
.ext-tag-out { color: var(--red); }
.ext-val {
  font-family: 'Sora', sans-serif; font-size: 12px;
  font-weight: 600; white-space: nowrap;
}
.ext-empty {
  padding: 48px 20px; text-align: center;
  font-size: 13px; color: var(--text-3);
}
@media (max-width: 640px) {
  .ext-row {
    grid-template-columns: 76px 1fr 90px;
    padding: 0 14px;
  }
  .ext-row-head { padding: 9px 14px; }
  .ext-col-entrada, .ext-col-saida { display: none; }
  .ext-cell { padding: 10px 8px 10px 0; }
}
`;


/* ══════════════════════════════════════════════════════
   HELPERS GLOBAIS
   ══════════════════════════════════════════════════════ */
const fmtR$ = (v) =>
  `R$ ${Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

const fmtPct = (v) =>
  `${Number(v || 0).toFixed(1)}%`;

const parseDate = (d) => {
  if (!d) return null;
  try {
    const dt = d?.toDate ? d.toDate() : new Date(d);
    return isNaN(dt.getTime()) ? null : dt;
  } catch { return null; }
};

const fmtData = (d) => {
  const dt = parseDate(d);
  return dt ? dt.toLocaleDateString("pt-BR") : "—";
};

const fmtDataCurta = (d) => {
  const dt = parseDate(d);
  return dt ? dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) : "—";
};

const MESES_CURTOS = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];

const getDiasRestantes = (rawDate) => {
  const dt = parseDate(rawDate);
  if (!dt) return null;
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const diff = Math.round((dt.setHours(0,0,0,0) - hoje) / 86400000);
  return diff;
};

/* ══════════════════════════════════════════════════════
   FUNÇÃO: exportar para Excel
   ══════════════════════════════════════════════════════ */
function exportarExcel(nomeRelatorio, sheets) {
  /* sheets: [{ nome: "Planilha", colunas: [str], dados: [[...]] }] */
  const wb = XLSX.utils.book_new();

  sheets.forEach(({ nome, colunas, dados }) => {
    const wsData = [colunas, ...dados];
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    /* Largura automática */
    const maxCols = wsData[0]?.length || 0;
    ws["!cols"] = Array.from({ length: maxCols }, (_, i) => ({
      wch: Math.max(
        colunas[i]?.length || 10,
        ...dados.map((r) => String(r[i] || "").length)
      ) + 2,
    }));

    XLSX.utils.book_append_sheet(wb, ws, nome);
  });

  const hoje = new Date();
  const dataStr = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
  XLSX.writeFile(wb, `relatorio-${nomeRelatorio}-${dataStr}.xlsx`);
}

/* ══════════════════════════════════════════════════════
   RELATÓRIO: DRE
   ══════════════════════════════════════════════════════ */
function RelatorioDRE({ vendas, despesas, caixa = [], intervalo, uid }) {
  /* Estado para guardar taxas do Firestore (config/geral) — usadas só como fallback */
  const [configTaxas, setConfigTaxas] = useState(null);

  /* Busca config/geral uma única vez quando uid estiver disponível */
  useEffect(() => {
    if (!uid) return;
    getDoc(doc(db, "users", uid, "config", "geral"))
      .then((snap) => {
        if (snap.exists()) setConfigTaxas(snap.data()?.taxas || {});
      })
      .catch(() => {}); // não bloqueia se config não existir
  }, [uid]);

  /* ── Helper de fallback: calcula taxa com base em config/geral ──
     Só chamado quando v.valorTaxa não existe no documento da venda.
     Estrutura: taxas.credito_1, taxas.debito, taxas.pix (strings em %)
     Vendas.jsx usa credito_1 para "Cartão de Crédito" → mantemos o mesmo mapeamento. */
  const calcularTaxaFallback = useCallback((venda) => {
    if (!configTaxas) return 0;
    const fp = venda.formaPagamento || "";
    let pct = 0;
    if (fp === "Cartão de Crédito") pct = parseFloat(configTaxas.credito_1) || 0;
    else if (fp === "Cartão de Débito") pct = parseFloat(configTaxas.debito)   || 0;
    else if (fp === "Pix")              pct = parseFloat(configTaxas.pix)       || 0;
    // Dinheiro, Boleto, Transferência, Sinal etc. → pct = 0
    return pct > 0 ? parseFloat(((Number(venda.total || 0)) * (pct / 100)).toFixed(2)) : 0;
  }, [configTaxas]);

  const dados = useMemo(() => {
    // Regime de caixa: só despesas PAGAS entram no DRE.
    // Prioridade de data para filtro:
    //   1. dataPagamentoTs → Timestamp Firestore (sem bug de timezone)
    //   2. dataPagamento   → string "YYYY-MM-DD" (documentos antigos sem Ts)
    //   3. vencimento      → fallback final
    const dFiltradas = despesas.filter((d) =>
      d.status === "pago" &&
      dentroDoIntervalo(d.dataPagamentoTs || d.dataPagamento || d.vencimento, intervalo));

    /* ══════════════════════════════════════════════════════════════════
       REGIME DE CAIXA PURO — RECEITA
       ══════════════════════════════════════════════════════════════════
       Fonte de receita em dois grupos:

       1. SISTEMA NOVO: entradas no caixa com origem = "venda"
          → Data de referência = data do lançamento no caixa (quando o dinheiro entrou)
          → Valor = o que foi efetivamente recebido (sinal parcial ou total)

       2. SISTEMA LEGADO: vendas sem campo statusPagamento
          → Não têm lançamento de caixa correspondente
          → Fallback: tratamos como integralmente recebidas (compatibilidade)
          → Data de referência = data da venda
    ═══════════════════════════════════════════════════════════════════ */

    /* Grupo 1 — Entradas de venda no caixa (sistema novo) */
    const caixaVendas = caixa.filter((c) =>
      c.origem === "venda" &&
      (c.tipo || "").toLowerCase().includes("entrada") &&
      dentroDoIntervalo(c.data, intervalo)
    );

    /* IDs de vendas já cobertas pelo caixa (para evitar dupla contagem) */
    const vendasCobertasPorCaixa = new Set(
      caixaVendas.map((c) => c.referenciaId).filter(Boolean)
    );

    /* Grupo 2 — Vendas legadas (sem statusPagamento) não cobertas pelo caixa */
    const vendasLegadas = vendas.filter((v) =>
      v.statusPagamento == null &&
      !vendasCobertasPorCaixa.has(v.id) &&
      dentroDoIntervalo(v.data, intervalo)
    );

    /* Receita real recebida no período */
    const receitaCaixa   = caixaVendas.reduce((s, c) => s + Number(c.valor || 0), 0);
    const receitaLegados = vendasLegadas.reduce((s, v) => s + Number(v.total || 0), 0);
    const receitaBruta   = receitaCaixa + receitaLegados;

    /* ══════════════════════════════════════════════════════════════════
       CUSTOS — vinculados às vendas que geraram receita
       ══════════════════════════════════════════════════════════════════
       Para vendas novas (cobertas pelo caixa): busca o documento de venda
       pelo referenciaId para obter custos/taxas reais.
       Para vendas legadas: usa os campos diretamente.
    ═══════════════════════════════════════════════════════════════════ */

    /* Mapa id → venda para lookup rápido */
    const vendasMap = Object.fromEntries(vendas.map((v) => [v.id, v]));

    /* Vendas novas correspondentes às entradas de caixa */
    const vendasNovas = caixaVendas
      .map((c) => c.referenciaId ? vendasMap[c.referenciaId] : null)
      .filter(Boolean)
      /* Deduplica: mesma venda pode ter múltiplas entradas (parcelas futuras) */
      .filter((v, idx, arr) => arr.findIndex((x) => x.id === v.id) === idx);

    /* Todas as vendas que compõem a receita deste período */
    const todasVendasReceita = [...vendasNovas, ...vendasLegadas];

    /* Descontos */
    const descontosTotais = todasVendasReceita.reduce((s, v) => s + Number(v.descontos || 0), 0);

    /* Taxas de cartão */
    const taxasCartao = todasVendasReceita.reduce((s, v) => {
      const taxa = v.valorTaxa != null
        ? Number(v.valorTaxa)
        : calcularTaxaFallback(v);
      return s + taxa;
    }, 0);

    const receitaLiquida = receitaBruta - descontosTotais - taxasCartao;

    const lucroBruto    = receitaLiquida;
    const totalDespesas = dFiltradas.reduce((s, d) => s + Number(d.valor || 0), 0);
    const lucroLiquido  = lucroBruto - totalDespesas;
    const margem        = receitaBruta > 0 ? (lucroLiquido / receitaBruta) * 100 : 0;

    /* Despesas por categoria */
    const porCategoria = {};
    dFiltradas.forEach((d) => {
      const cat = d.categoria || "Sem categoria";
      porCategoria[cat] = (porCategoria[cat] || 0) + Number(d.valor || 0);
    });


    return {
      receitaBruta, receitaLiquida, descontosTotais,
      taxasCartao, lucroBruto,
      totalDespesas, lucroLiquido, margem,
      qtdeVendas: todasVendasReceita.length,
      porCategoria,
      /* informativo */
      _entradaNovasCaixa: caixaVendas.length,
      _vendasLegadas: vendasLegadas.length,
    };
  }, [vendas, despesas, caixa, intervalo, calcularTaxaFallback]);

  const pct = (v) =>
    dados.receitaBruta > 0
      ? fmtPct((v / dados.receitaBruta) * 100)
      : "0.0%";

  const handleExport = () => {
    exportarExcel("dre", [{
      nome: "DRE",
      colunas: ["Item", "Valor (R$)", "% Receita"],
      dados: [
        ["Receita Bruta (Vendas)", dados.receitaBruta.toFixed(2), pct(dados.receitaBruta)],
        ["(-) Taxas de Cartão",   `-${dados.taxasCartao.toFixed(2)}`, pct(dados.taxasCartao)],
        ["= Receita Líquida",     dados.receitaLiquida.toFixed(2), pct(dados.receitaLiquida)],
        ["(-) Despesas Totais",    `-${dados.totalDespesas.toFixed(2)}`, pct(dados.totalDespesas)],
        ...Object.entries(dados.porCategoria).map(([k, v]) => [`  · ${k}`, `-${v.toFixed(2)}`, pct(v)]),
        ["= Lucro Líquido",        dados.lucroLiquido.toFixed(2), fmtPct(dados.margem)],
      ],
    }]);
  };

  return (
    <div className="dre-wrap">
      {/* KPIs */}
      <div className="cr-grid" style={{ marginBottom: 20 }}>
        <CardResumo
          icon={<TrendingUp size={18} />}
          label="Receita Bruta"
          value={fmtR$(dados.receitaBruta)}
          sub={`${dados.qtdeVendas} venda(s)`}
          trend="neutral"
          colorVar="var(--gold)"
        />
        <CardResumo
          icon={<Receipt size={18} />}
          label="Despesas"
          value={fmtR$(dados.totalDespesas)}
          sub={pct(dados.totalDespesas) + " da receita"}
          trend="down"
          colorVar="var(--red)"
        />
        <CardResumo
          icon={<Wallet size={18} />}
          label="Lucro Líquido"
          value={fmtR$(dados.lucroLiquido)}
          sub={`Margem: ${fmtPct(dados.margem)}`}
          trend={dados.lucroLiquido >= 0 ? "up" : "down"}
          colorVar={dados.lucroLiquido >= 0 ? "var(--green)" : "var(--red)"}
        />
      </div>

      {/* Tabela DRE */}
      <div className="tr-wrap">
        <div className="tr-header">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span className="tr-title">Demonstração do Resultado do Exercício</span>
            <span
              title={`Regime de Caixa: ${dados._entradaNovasCaixa} entrada(s) do caixa + ${dados._vendasLegadas} venda(s) legada(s) como fallback`}
              style={{
                fontSize: 10, fontWeight: 600, padding: "2px 8px",
                borderRadius: 20, background: "rgba(74,222,128,0.1)",
                border: "1px solid rgba(74,222,128,0.25)", color: "var(--green)",
                cursor: "default",
              }}
            >
              ✓ Regime de Caixa
            </span>
          </div>
          <button className="btn-secondary" style={{ fontSize: 11, padding: "5px 12px" }} onClick={handleExport}>
            <Download size={12} /> Excel
          </button>
        </div>

        {/* Receitas */}
        <div className="dre-row dre-row-cat">RECEITAS</div>
        <div className="dre-row">
          <span className="dre-label">Receita Bruta (Vendas)</span>
          <span className="dre-val dre-positivo">{fmtR$(dados.receitaBruta)}</span>
          <span className="dre-pct">{pct(dados.receitaBruta)}</span>
        </div>
        {dados.taxasCartao > 0 && (
          <div className="dre-row">
            <span className="dre-sub-label">(-) Taxas de Cartão</span>
            <span className="dre-val dre-negativo">- {fmtR$(dados.taxasCartao)}</span>
            <span className="dre-pct">{pct(dados.taxasCartao)}</span>
          </div>
        )}
        {dados.taxasCartao > 0 && (
          <div className="dre-row" style={{ background: "rgba(0,0,0,0.08)" }}>
            <span className="dre-label">= Receita Líquida</span>
            <span className="dre-val dre-positivo">{fmtR$(dados.receitaLiquida)}</span>
            <span className="dre-pct">{pct(dados.receitaLiquida)}</span>
          </div>
        )}

        {/* Despesas */}
        <div className="dre-row dre-row-cat">DESPESAS OPERACIONAIS</div>
        {Object.entries(dados.porCategoria).length > 0
          ? Object.entries(dados.porCategoria)
              .sort((a, b) => b[1] - a[1])
              .map(([cat, val]) => (
                <div key={cat} className="dre-row">
                  <span className="dre-sub-label">(-) {cat}</span>
                  <span className="dre-val dre-negativo">- {fmtR$(val)}</span>
                  <span className="dre-pct">{pct(val)}</span>
                </div>
              ))
          : <div className="dre-row">
              <span className="dre-sub-label">(-) Despesas Totais</span>
              <span className="dre-val dre-negativo">- {fmtR$(dados.totalDespesas)}</span>
              <span className="dre-pct">{pct(dados.totalDespesas)}</span>
            </div>
        }

        {/* Lucro Líquido */}
        <div className="dre-row dre-row-result">
          <span className="dre-label" style={{ fontFamily: "'Sora', sans-serif" }}>= LUCRO LÍQUIDO</span>
          <span className={`dre-val ${dados.lucroLiquido >= 0 ? "dre-positivo" : "dre-negativo"}`}>
            {fmtR$(dados.lucroLiquido)}
          </span>
          <span
            className="dre-pct"
            style={{
              fontWeight: 700,
              color: dados.lucroLiquido >= 0 ? "var(--green)" : "var(--red)",
            }}
          >
            {fmtPct(dados.margem)}
          </span>
        </div>
      </div>

      {/* ── Banner de resultado final ── */}
      {(() => {
        const isLucro = dados.lucroLiquido >= 0;
        return (
          <div className={`dre-resultado-banner ${isLucro ? "lucro" : "prejuizo"}`}>
            <div className="dre-resultado-esquerda">
              <span className="dre-resultado-emoji">{isLucro ? "✅" : "❌"}</span>
              <div className="dre-resultado-textos">
                <span className="dre-resultado-titulo">
                  {isLucro ? "Lucro do Período" : "Prejuízo do Período"}
                </span>
                <span className="dre-resultado-sub">
                  {isLucro
                    ? `Margem líquida: ${fmtPct(dados.margem)}`
                    : `Margem líquida: ${fmtPct(dados.margem)}`}
                </span>
              </div>
            </div>
            <span className="dre-resultado-valor">{fmtR$(dados.lucroLiquido)}</span>
          </div>
        );
      })()}
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   RELATÓRIO: FINANCEIRO (CAIXA)
   ══════════════════════════════════════════════════════ */
function RelatorioFinanceiro({ caixa, despesas, vendas = [], vendedores = [], intervalo }) {
  const [filtroTipo, setFiltroTipo] = useState(null); // null | "entrada" | "saida"

  const dados = useMemo(() => {
    const filtrado = caixa.filter((c) => dentroDoIntervalo(c.data, intervalo));
    const entradasCaixa = filtrado.filter((c) =>
      (c.tipo || "").toLowerCase().includes("entrada") || (Number(c.valor || 0) > 0 && !c.tipo)
    );
    const saidasCaixa = filtrado.filter((c) =>
      (c.tipo || "").toLowerCase().includes("saida") ||
      (c.tipo || "").toLowerCase().includes("saída")
    );

    const despesasPagas = despesas.filter((d) =>
      d.status === "pago" &&
      dentroDoIntervalo(d.dataPagamentoTs || d.dataPagamento || d.vencimento, intervalo)
    );

    const totalEntradas    = entradasCaixa.reduce((s, c) => s + Number(c.valor || 0), 0);
    const totalSaidasCaixa = saidasCaixa.reduce((s, c) => s + Number(c.valor || 0), 0);
    const totalDespesas    = despesasPagas.reduce((s, d) => s + Number(d.valor || 0), 0);
    const totalSaidas      = totalSaidasCaixa + totalDespesas;
    const saldo            = totalEntradas - totalSaidas;

    /* Mapa de vendas para enriquecer descrição */
    const vendasMap = Object.fromEntries((vendas || []).map((v) => [v.id, v]));

    /* ── Montar extrato unificado ── */
    const transacoes = [];

    entradasCaixa.forEach((c) => {
      const venda = c.referenciaId ? vendasMap[c.referenciaId] : null;
      const clienteNome  = c.clienteNome  || venda?.clienteNome  || venda?.cliente  || null;
      const vendedorNome = c.vendedorNome || venda?.vendedorNome || venda?.vendedor || null;

      let descricao;
      if (c.origem === "venda") {
        const partes = ["Venda"];
        if (clienteNome)  partes.push(`Cliente: ${clienteNome}`);
        if (vendedorNome) partes.push(`Vendedor: ${vendedorNome}`);
        descricao = partes.join(" · ");
      } else {
        descricao = c.descricao || c.origem || "Entrada de caixa";
      }

      transacoes.push({
        _id: `c-${c.id}`,
        data: c.data,
        dataTs: parseDate(c.data),
        tipo: "entrada",
        descricao,
        entrada: Number(c.valor || 0),
        saida: 0,
      });
    });

    saidasCaixa.forEach((c) => {
      transacoes.push({
        _id: `cs-${c.id}`,
        data: c.data,
        dataTs: parseDate(c.data),
        tipo: "saida",
        descricao: c.descricao || "Saída de caixa",
        entrada: 0,
        saida: Number(c.valor || 0),
      });
    });

    despesasPagas.forEach((d) => {
      const rawDate = d.dataPagamentoTs || d.dataPagamento || d.vencimento;
      const partes = [d.descricao || "Despesa"];
      if (d.categoria) partes.push(`Categoria: ${d.categoria}`);
      partes.push(`Status: ${d.status === "pago" ? "Pago" : "Pendente"}`);

      transacoes.push({
        _id: `d-${d.id}`,
        data: rawDate,
        dataTs: parseDate(rawDate),
        tipo: "saida",
        descricao: partes.join(" · "),
        entrada: 0,
        saida: Number(d.valor || 0),
      });
    });

    /* Calcular saldo acumulado (do mais antigo para o mais novo) */
    transacoes.sort((a, b) => (a.dataTs || 0) - (b.dataTs || 0));
    let acc = 0;
    transacoes.forEach((t) => {
      acc += t.entrada - t.saida;
      t.saldoAcumulado = acc;
    });
    /* Exibir do mais recente para o mais antigo */
    transacoes.reverse();

    return {
      totalEntradas,
      totalSaidas,
      saldo,
      transacoes,
      qtde: filtrado.length + despesasPagas.length,
    };
  }, [caixa, despesas, vendas, vendedores, intervalo]);

  const handleCardClick = (tipo) =>
    setFiltroTipo((prev) => (prev === tipo ? null : tipo));

  const transacoesFiltradas = useMemo(() => {
    if (!filtroTipo) return dados.transacoes;
    return dados.transacoes.filter((t) => t.tipo === filtroTipo);
  }, [dados.transacoes, filtroTipo]);

  const handleExport = () => {
    exportarExcel("financeiro", [{
      nome: "Extrato Financeiro",
      colunas: ["Data", "Descrição", "Entrada (R$)", "Saída (R$)", "Saldo (R$)"],
      dados: transacoesFiltradas.map((t) => [
        fmtData(t.data),
        t.descricao,
        t.entrada > 0 ? t.entrada.toFixed(2) : "",
        t.saida   > 0 ? t.saida.toFixed(2)   : "",
        t.saldoAcumulado?.toFixed(2) ?? "",
      ]),
    }]);
  };

  const cardStyle = (tipo, cor) => ({
    cursor: "pointer",
    borderRadius: 12,
    outline: filtroTipo === tipo ? `2px solid ${cor}` : "2px solid transparent",
    outlineOffset: 2,
    transition: "outline 0.15s",
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* ── Cards clicáveis ── */}
      <div className="cr-grid">
        <div
          onClick={() => handleCardClick("entrada")}
          style={cardStyle("entrada", "var(--green)")}
          title="Clique para filtrar apenas entradas"
        >
          <CardResumo
            icon={<ArrowUpRight size={18} />}
            label="Total Entradas"
            value={fmtR$(dados.totalEntradas)}
            sub={`${dados.qtde} movimentações`}
            trend="up" colorVar="var(--green)"
          />
        </div>

        <div
          onClick={() => handleCardClick("saida")}
          style={cardStyle("saida", "var(--red)")}
          title="Clique para filtrar apenas saídas e despesas"
        >
          <CardResumo
            icon={<ArrowDownRight size={18} />}
            label="Total Saídas"
            value={fmtR$(dados.totalSaidas)}
            sub="no período" trend="down" colorVar="var(--red)"
          />
        </div>

        <CardResumo
          icon={<Wallet size={18} />}
          label="Saldo do Período"
          value={fmtR$(dados.saldo)}
          sub={dados.saldo >= 0 ? "Positivo" : "Negativo"}
          trend={dados.saldo >= 0 ? "up" : "down"}
          colorVar={dados.saldo >= 0 ? "var(--green)" : "var(--red)"}
        />
      </div>

      {/* ── Indicador de filtro ativo ── */}
      {filtroTipo && (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "6px 14px", borderRadius: 8,
          background: filtroTipo === "entrada" ? "rgba(74,222,128,0.07)" : "rgba(224,82,82,0.07)",
          border: `1px solid ${filtroTipo === "entrada" ? "rgba(74,222,128,0.2)" : "rgba(224,82,82,0.2)"}`,
        }}>
          <span style={{ fontSize: 12, color: "var(--text-3)" }}>
            Mostrando apenas:{" "}
            <strong style={{ color: filtroTipo === "entrada" ? "var(--green)" : "var(--red)" }}>
              {filtroTipo === "entrada" ? "Entradas" : "Saídas / Despesas"}
            </strong>
            {" "}· {transacoesFiltradas.length} registro{transacoesFiltradas.length !== 1 ? "s" : ""}
          </span>
          <button
            className="btn-secondary"
            style={{ fontSize: 11, padding: "4px 12px" }}
            onClick={() => setFiltroTipo(null)}
          >
            <X size={11} /> Limpar filtro
          </button>
        </div>
      )}

      {/* ── Extrato com descrição (tabela manual com grid controlado) ── */}
      <div className="ext-wrap">
        <div className="ext-header">
          <span className="ext-title">Extrato Financeiro</span>
          <span className="ext-badge">{transacoesFiltradas.length}</span>
        </div>

        {transacoesFiltradas.length === 0 ? (
          <div className="ext-empty">Nenhuma movimentação no período.</div>
        ) : (
          <>
            {/* Cabeçalho */}
            <div className="ext-row ext-row-head">
              <span>Data</span>
              <span>Descrição</span>
              <span className="ext-col-entrada" style={{ textAlign: "right" }}>Entrada</span>
              <span className="ext-col-saida"   style={{ textAlign: "right" }}>Saída</span>
              <span style={{ textAlign: "right" }}>Saldo</span>
            </div>

            {/* Linhas */}
            {transacoesFiltradas.map((t) => (
              <div key={t._id} className="ext-row ext-row-body">
                {/* Data */}
                <div className="ext-cell">
                  <span className="ext-date">{fmtData(t.data)}</span>
                </div>

                {/* Descrição */}
                <div className="ext-cell" style={{ minWidth: 0 }}>
                  <span className="ext-desc-main" title={t.descricao}>{t.descricao}</span>
                  <span className={`ext-desc-tag ${t.tipo === "entrada" ? "ext-tag-in" : "ext-tag-out"}`}>
                    {t.tipo === "entrada" ? "▲ Entrada" : "▼ Saída"}
                  </span>
                </div>

                {/* Entrada */}
                <div className="ext-cell ext-cell-r ext-col-entrada">
                  {t.entrada > 0
                    ? <span className="ext-val val-pos">{fmtR$(t.entrada)}</span>
                    : <span style={{ color: "var(--text-3)", fontFamily: "'Sora',sans-serif" }}>—</span>
                  }
                </div>

                {/* Saída */}
                <div className="ext-cell ext-cell-r ext-col-saida">
                  {t.saida > 0
                    ? <span className="ext-val val-neg">{fmtR$(t.saida)}</span>
                    : <span style={{ color: "var(--text-3)", fontFamily: "'Sora',sans-serif" }}>—</span>
                  }
                </div>

                {/* Saldo acumulado */}
                <div className="ext-cell ext-cell-r">
                  <span className={`ext-val ${(t.saldoAcumulado || 0) >= 0 ? "val-pos" : "val-neg"}`}>
                    {fmtR$(t.saldoAcumulado || 0)}
                  </span>
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button className="btn-secondary" onClick={handleExport}>
          <Download size={13} /> Exportar Excel
        </button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   RELATÓRIO: DESPESAS
   ══════════════════════════════════════════════════════ */
function RelatorioDespesas({ despesas, intervalo }) {
  const dados = useMemo(() => {
    // Para despesas pagas: priorizar dataPagamentoTs (Timestamp, sem bug de timezone),
    // depois dataPagamento (string legada), depois vencimento.
    // Para pendentes/vencidas: usar vencimento.
    const dataRefDespesa = (d) =>
      d.status === "pago"
        ? (d.dataPagamentoTs || d.dataPagamento || d.vencimento)
        : d.vencimento;

    const filtradas = despesas
      .filter((d) => dentroDoIntervalo(dataRefDespesa(d), intervalo))
      .sort((a, b) => {
        const da  = parseDate(dataRefDespesa(a));
        const db2 = parseDate(dataRefDespesa(b));
        return (db2 || 0) - (da || 0);
      });

    const total = filtradas.reduce((s, d) => s + Number(d.valor || 0), 0);

    const porCategoria = {};
    filtradas.forEach((d) => {
      const cat = d.categoria || "Sem categoria";
      porCategoria[cat] = (porCategoria[cat] || 0) + Number(d.valor || 0);
    });

    const ranking = Object.entries(porCategoria)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, val]) => ({ cat, val }));

    const maxVal = ranking[0]?.val || 1;

    return { filtradas, total, ranking, maxVal };
  }, [despesas, intervalo]);

  const handleExport = () => {
    exportarExcel("despesas", [{
      nome: "Despesas",
      colunas: ["Data Referência", "Vencimento", "Descrição", "Categoria", "Status", "Valor (R$)"],
      dados: dados.filtradas.map((d) => [
        fmtData(d.status === "pago" && d.dataPagamento ? d.dataPagamento : d.vencimento),
        fmtData(d.vencimento),
        d.descricao || "—",
        d.categoria || "—",
        d.status || "—",
        Number(d.valor || 0).toFixed(2),
      ]),
    }]);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div className="cr-grid">
        <CardResumo
          icon={<Receipt size={18} />}
          label="Total de Despesas"
          value={fmtR$(dados.total)}
          sub={`${dados.filtradas.length} registros`}
          trend="down" colorVar="var(--red)"
        />
        <CardResumo
          icon={<BarChart2 size={18} />}
          label="Categorias"
          value={String(dados.ranking.length)}
          sub="categorias distintas" trend="neutral" colorVar="var(--blue)"
        />
        <CardResumo
          icon={<DollarSign size={18} />}
          label="Média por Despesa"
          value={dados.filtradas.length > 0 ? fmtR$(dados.total / dados.filtradas.length) : "R$ 0,00"}
          sub="ticket médio" trend="neutral" colorVar="var(--gold)"
        />
      </div>

      {/* Ranking por categoria */}
      {dados.ranking.length > 0 && (
        <div className="tr-wrap">
          <div className="tr-header">
            <span className="tr-title">Ranking por Categoria</span>
            <span className="tr-badge">{dados.ranking.length}</span>
          </div>
          {dados.ranking.map((r, i) => (
            <div key={r.cat} className="rank-item">
              <span className="rank-num">#{i + 1}</span>
              <span className="rank-label">{r.cat}</span>
              <div className="rank-bar-wrap">
                <div className="rank-bar-bg">
                  <div className="rank-bar-fill" style={{ width: `${(r.val / dados.maxVal) * 100}%` }} />
                </div>
              </div>
              <span className="rank-val">{fmtR$(r.val)}</span>
            </div>
          ))}
        </div>
      )}

      <TabelaRelatorio
        title="Lançamentos de Despesas"
        count={dados.filtradas.length}
        empty="Nenhuma despesa no período."
        data={dados.filtradas}
        columns={[
          {
            key: "dataPagamento",
            label: "Data Referência",
            render: (v, row) => {
              const dataRef = row.status === "pago" && v ? v : row.vencimento;
              const label   = row.status === "pago" ? "Pago em" : "Vence em";
              return (
                <span title={label} style={{ color: row.status === "pago" ? "var(--green)" : "var(--text-2)" }}>
                  {fmtData(dataRef)}
                </span>
              );
            },
          },
          {
            key: "vencimento",
            label: "Vencimento",
            render: (v, row) => {
              if (!v) return <span style={{ color: "var(--text-3)" }}>—</span>;
              const dias = getDiasRestantes(v);
              const color = dias !== null && dias < 0
                ? "var(--red)"
                : dias !== null && dias <= 3
                ? "var(--gold)"
                : "var(--text-2)";
              return <span style={{ color }}>{fmtData(v)}</span>;
            },
          },
          { key: "descricao", label: "Descrição" },
          { key: "categoria", label: "Categoria" },
          {
            key: "valor", label: "Valor", align: "right",
            render: (v) => <span className="val-neg">{fmtR$(v)}</span>,
          },
        ]}
      />

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button className="btn-secondary" onClick={handleExport}>
          <Download size={13} /> Exportar Excel
        </button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   RELATÓRIO: VENDAS
   ══════════════════════════════════════════════════════ */
function RelatorioVendas({ vendas, intervalo }) {
  const dados = useMemo(() => {
    const filtradas = vendas
      .filter((v) => dentroDoIntervalo(v.data, intervalo))
      .sort((a, b) => {
        const da = parseDate(a.data), db2 = parseDate(b.data);
        return (db2 || 0) - (da || 0);
      });

    const total = filtradas.reduce((s, v) => s + Number(v.total || 0), 0);
    const ticket = filtradas.length > 0 ? total / filtradas.length : 0;

    /* Produtos mais vendidos */
    const prodContagem = {};
    filtradas.forEach((v) => {
      (v.itens || []).forEach((it) => {
        const nome = it.produto || it.nome || "Produto";
        const qtd  = Number(it.quantidade || it.qtd || 1);

        /* CORREÇÃO: it.total/it.subtotal já é o subtotal da linha (preço × qtd).
           Não multiplicar por qtd de novo. Fallback: preco/valorUnitario × qtd. */
        const subtotalLinha = Number(it.total ?? it.subtotal ?? NaN);
        const precoUnit     = Number(it.valorUnitario ?? it.preco ?? it.valor ?? 0);
        const val = !isNaN(subtotalLinha) && subtotalLinha > 0
          ? subtotalLinha
          : precoUnit * qtd;

        if (!prodContagem[nome]) prodContagem[nome] = { qtd: 0, total: 0 };
        prodContagem[nome].qtd   += qtd;
        prodContagem[nome].total += val;
      });
    });

    const maisPedidos = Object.entries(prodContagem)
      .sort((a, b) => b[1].qtd - a[1].qtd)
      .slice(0, 10)
      .map(([nome, v]) => ({ nome, ...v }));

    /* Por forma de pagamento */
    const porFP = {};
    filtradas.forEach((v) => {
      const fp = v.formaPagamento || "Não informado";
      porFP[fp] = (porFP[fp] || 0) + 1;
    });

    return { filtradas, total, ticket, maisPedidos, porFP };
  }, [vendas, intervalo]);

  const handleExport = () => {
    exportarExcel("vendas", [
      {
        nome: "Vendas",
        colunas: ["ID", "Data", "Cliente", "Forma Pagamento", "Total (R$)"],
        dados: dados.filtradas.map((v) => [
          v.id, fmtData(v.data), v.clienteNome || v.cliente || "—",
          v.formaPagamento || "—", Number(v.total || 0).toFixed(2),
        ]),
      },
      {
        nome: "Produtos mais vendidos",
        colunas: ["Produto", "Qtd Vendida", "Total (R$)"],
        dados: dados.maisPedidos.map((p) => [p.nome, p.qtd, p.total.toFixed(2)]),
      },
    ]);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div className="cr-grid">
        <CardResumo
          icon={<ShoppingCart size={18} />}
          label="Total Vendido"
          value={fmtR$(dados.total)}
          sub={`${dados.filtradas.length} vendas`}
          trend="up" colorVar="var(--gold)"
        />
        <CardResumo
          icon={<BarChart2 size={18} />}
          label="Ticket Médio"
          value={fmtR$(dados.ticket)}
          sub="por venda" trend="neutral" colorVar="var(--blue)"
        />
        <CardResumo
          icon={<TrendingUp size={18} />}
          label="Qtd. de Vendas"
          value={String(dados.filtradas.length)}
          sub="no período" trend="neutral" colorVar="var(--green)"
        />
      </div>

      {/* Produtos mais vendidos */}
      {dados.maisPedidos.length > 0 && (
        <div className="tr-wrap">
          <div className="tr-header">
            <span className="tr-title">Produtos Mais Vendidos</span>
          </div>
          {dados.maisPedidos.map((p, i) => (
            <div key={p.nome} className="rank-item">
              <span className="rank-num">#{i + 1}</span>
              <span className="rank-label">{p.nome}</span>
              <span style={{ fontSize: 11, color: "var(--text-3)", marginLeft: "auto" }}>
                {p.qtd} un.
              </span>
              <span className="rank-val">{fmtR$(p.total)}</span>
            </div>
          ))}
        </div>
      )}

      <TabelaRelatorio
        title="Histórico de Vendas"
        count={dados.filtradas.length}
        empty="Nenhuma venda no período."
        data={dados.filtradas}
        columns={[
          { key: "id",    label: "ID", render: (v) => <span style={{ color: "var(--gold)", fontFamily: "'Sora', sans-serif", fontSize: 11 }}>{v}</span> },
          { key: "data",  label: "Data", render: (v) => fmtData(v) },
          { key: "clienteNome", label: "Cliente", render: (v, row) => v || row.cliente || "—" },
          { key: "formaPagamento", label: "Pagamento" },
          {
            key: "total", label: "Total", align: "right",
            render: (v) => <span className="val-pos">{fmtR$(v)}</span>,
          },
        ]}
      />

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button className="btn-secondary" onClick={handleExport}>
          <Download size={13} /> Exportar Excel
        </button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   RELATÓRIO: ESTOQUE
   ══════════════════════════════════════════════════════ */
function RelatorioEstoque({ produtos }) {
  /* Estoque não usa filtro de período — é snapshot atual */
  const dados = useMemo(() => {
    /* CORREÇÃO 4: campos corretos do Firestore são p.estoque, p.preco, p.custo, p.margem
       Estrutura real: produtos/{id} { custo, estoque, preco, margem, nome } */

    const estoque    = (p) => Number(p.estoque   ?? p.quantidade ?? 0);
    const precoVenda = (p) => Number(p.preco      ?? p.precoVenda ?? 0);
    const precoCusto = (p) => Number(p.custo      ?? p.precoCusto ?? 0);
    const estoqueMin = (p) => Number(p.estoqueMinimo ?? p.estoque_minimo ?? 5);

    const total = produtos.length;

    /* Valor em estoque = preco de venda × quantidade em estoque */
    const valorTotal = produtos.reduce(
      (s, p) => s + precoVenda(p) * estoque(p), 0
    );

    /* Valor de custo em estoque */
    const valorCusto = produtos.reduce(
      (s, p) => s + precoCusto(p) * estoque(p), 0
    );

    const baixoEstoque = produtos.filter(
      (p) => estoque(p) > 0 && estoque(p) <= estoqueMin(p)
    );
    const semEstoque = produtos.filter((p) => estoque(p) === 0);

    /* Ordena do menor para o maior estoque */
    const sorted = [...produtos].sort((a, b) => estoque(a) - estoque(b));

    return { total, valorTotal, valorCusto, baixoEstoque, semEstoque, sorted,
             /* helpers reutilizados no render */ _estoque: estoque, _preco: precoVenda, _custo: precoCusto };
  }, [produtos]);

  const { _estoque, _preco, _custo } = dados;

  const handleExport = () => {
    exportarExcel("estoque", [{
      nome: "Estoque",
      colunas: ["Produto", "Estoque Atual", "Preço Venda (R$)", "Custo (R$)", "Margem (%)", "Valor Total (R$)"],
      dados: dados.sorted.map((p) => [
        p.nome || "—",
        _estoque(p),
        _preco(p).toFixed(2),
        _custo(p).toFixed(2),
        Number(p.margem || 0).toFixed(1),
        (_preco(p) * _estoque(p)).toFixed(2),
      ]),
    }]);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div className="cr-grid">
        <CardResumo
          icon={<Package size={18} />}
          label="Total de Produtos"
          value={String(dados.total)}
          sub="cadastrados" trend="neutral" colorVar="var(--gold)"
        />
        <CardResumo
          icon={<DollarSign size={18} />}
          label="Valor em Estoque"
          value={fmtR$(dados.valorTotal)}
          sub="pelo preço de venda" trend="neutral" colorVar="var(--green)"
        />
        <CardResumo
          icon={<DollarSign size={18} />}
          label="Custo do Estoque"
          value={fmtR$(dados.valorCusto)}
          sub="pelo preço de custo" trend="neutral" colorVar="var(--text-2)"
        />
        <CardResumo
          icon={<AlertCircle size={18} />}
          label="Estoque Baixo"
          value={String(dados.baixoEstoque.length)}
          sub="produtos críticos"
          trend={dados.baixoEstoque.length > 0 ? "down" : "neutral"}
          colorVar={dados.baixoEstoque.length > 0 ? "var(--red)" : "var(--text-2)"}
        />
        <CardResumo
          icon={<Minus size={18} />}
          label="Sem Estoque"
          value={String(dados.semEstoque.length)}
          sub="produtos zerados"
          trend={dados.semEstoque.length > 0 ? "down" : "neutral"}
          colorVar={dados.semEstoque.length > 0 ? "var(--red)" : "var(--text-2)"}
        />
      </div>

      {dados.baixoEstoque.length > 0 && (
        <div className="tr-wrap" style={{ border: "1px solid rgba(224,82,82,.3)" }}>
          <div className="tr-header" style={{ background: "rgba(224,82,82,.06)" }}>
            <span className="tr-title" style={{ color: "var(--red)" }}>
              ⚠ Produtos com Estoque Crítico
            </span>
            <span className="tr-badge">{dados.baixoEstoque.length}</span>
          </div>
          <TabelaRelatorio
            data={dados.baixoEstoque}
            columns={[
              { key: "nome", label: "Produto" },
              { key: "estoque", label: "Qtd Atual", align: "center",
                render: (v, row) => <span style={{ color: "var(--red)", fontWeight: 700 }}>{_estoque(row)}</span> },
              { key: "estoqueMinimo", label: "Mínimo", align: "center",
                render: (v, row) => v ?? row.estoque_minimo ?? 5 },
              { key: "preco", label: "Preço", align: "right",
                render: (v, row) => fmtR$(_preco(row)) },
            ]}
            empty=""
          />
        </div>
      )}

      <TabelaRelatorio
        title="Todos os Produtos"
        count={dados.total}
        empty="Nenhum produto cadastrado."
        data={dados.sorted}
        columns={[
          { key: "nome",      label: "Produto" },
          { key: "categoria", label: "Categoria" },
          { key: "estoque",   label: "Estoque", align: "center",
            render: (v, row) => {
              const qt = _estoque(row);
              const color = qt === 0 ? "var(--red)" : qt <= 5 ? "var(--gold)" : "var(--green)";
              return <span style={{ color, fontWeight: 600 }}>{qt}</span>;
            }},
          { key: "preco",  label: "Preço Venda", align: "right",
            render: (v, row) => fmtR$(_preco(row)) },
          { key: "custo",  label: "Custo", align: "right",
            render: (v, row) => fmtR$(_custo(row)) },
          { key: "margem", label: "Margem %", align: "right",
            render: (v) => <span style={{ color: "var(--gold)" }}>{Number(v || 0).toFixed(1)}%</span> },
          { key: "estoque", label: "Valor em Estoque", align: "right",
            render: (v, row) => fmtR$(_preco(row) * _estoque(row)) },
        ]}
      />

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button className="btn-secondary" onClick={handleExport}>
          <Download size={13} /> Exportar Excel
        </button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   RELATÓRIO: CLIENTES
   ══════════════════════════════════════════════════════ */
function RelatorioClientes({ clientes, vendas, intervalo, aReceber = [] }) {
  const [filtroPendentes, setFiltroPendentes] = useState(false);

  const dados = useMemo(() => {
    const total = clientes.length;

    /* Clientes que compraram no período */
    const vendasPeriodo = vendas.filter((v) => dentroDoIntervalo(v.data, intervalo));


    /* CORREÇÃO 5: Vendas.jsx salva v.cliente (string nome), não v.clienteId.
       Estratégia: primeiro tenta match por ID, fallback por nome normalizado */
    const idsAtivos = new Set();
    const nomesAtivos = new Set();
    vendasPeriodo.forEach((v) => {
      if (v.clienteId)  idsAtivos.add(v.clienteId);
      if (v.cliente_id) idsAtivos.add(v.cliente_id);
      if (v.cliente)    nomesAtivos.add((v.cliente || "").trim().toLowerCase());
    });

    const ativos = clientes.filter((c) =>
      idsAtivos.has(c.id) ||
      nomesAtivos.has((c.nome || "").trim().toLowerCase())
    );


    /* Clientes com pagamentos pendentes (a_receber com valorRestante > 0) */
    const pendentesAReceber = aReceber.filter(
      (r) => Number(r.valorRestante || 0) > 0 && r.status !== "pago"
    );

    /* Agrupa valor em aberto por nome do cliente */
    const valorEmAbertoPorNome = {};
    pendentesAReceber.forEach((r) => {
      const nome = (r.clienteNome || "").trim().toLowerCase();
      if (!nome) return;
      valorEmAbertoPorNome[nome] = (valorEmAbertoPorNome[nome] || 0) + Number(r.valorRestante || 0);
    });

    /* Clientes que têm entradas em aberto no AReceber */
    const clientesPendentes = clientes.filter((c) =>
      (c.nome || "").trim().toLowerCase() in valorEmAbertoPorNome
    ).map((c) => ({
      ...c,
      _valorEmAberto: valorEmAbertoPorNome[(c.nome || "").trim().toLowerCase()] || 0,
    }));

    const totalEmAberto = Object.values(valorEmAbertoPorNome).reduce((s, v) => s + v, 0);

    /* Manter compatibilidade legada */
    const comFiado = clientes.filter((c) => Number(c.fiado || c.debito || 0) > 0);
    const totalFiado = comFiado.reduce((s, c) => s + Number(c.fiado || c.debito || 0), 0);

    /* Top clientes por valor gasto no período — resolve tanto por id quanto por nome */
    const gastosPorCliente = {};
    vendasPeriodo.forEach((v) => {
      /* Tenta resolver o cliente: prioriza id, fallback nome */
      const chave = v.clienteId || v.cliente_id || (v.cliente || "").trim().toLowerCase();
      if (!chave) return;
      gastosPorCliente[chave] = (gastosPorCliente[chave] || 0) + Number(v.total || 0);
    });

    const topClientes = Object.entries(gastosPorCliente)
      .filter(([, totalGasto]) => totalGasto > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([chave, totalGasto]) => {
        const c = clientes.find(
          (x) => x.id === chave || (x.nome || "").trim().toLowerCase() === chave
        );
        return { chave, nome: c?.nome || chave, total: totalGasto };
      });

    /* Lista completa ordenada por nome */
    const listaCompleta = [...clientes].sort((a, b) =>
      (a.nome || "").localeCompare(b.nome || "", "pt-BR")
    );

    return { total, ativos, comFiado, totalFiado, topClientes, listaCompleta, gastosPorCliente, clientesPendentes, totalEmAberto };
  }, [clientes, vendas, intervalo, aReceber]);

  const handleExport = () => {
    exportarExcel("clientes", [{
      nome: "Clientes",
      colunas: ["ID", "Nome", "Telefone", "CPF/CNPJ", "Fiado (R$)"],
      dados: clientes.map((c) => [
        c.id, c.nome || "—", c.telefone || "—", c.cpf || "—",
        Number(c.fiado || c.debito || 0).toFixed(2),
      ]),
    }]);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div className="cr-grid">
        <CardResumo
          icon={<Users size={18} />}
          label="Total de Clientes"
          value={String(dados.total)}
          sub="cadastrados" trend="neutral" colorVar="var(--gold)"
        />
        <CardResumo
          icon={<TrendingUp size={18} />}
          label="Clientes Ativos"
          value={String(dados.ativos.length)}
          sub="compraram no período" trend="up" colorVar="var(--green)"
        />
        <div
          onClick={() => setFiltroPendentes((f) => !f)}
          style={{ cursor: "pointer" }}
          title="Clique para ver clientes com pagamento pendente"
        >
          <CardResumo
            icon={<Receipt size={18} />}
            label="Clientes c/ Pagamentos Pendentes"
            value={String(dados.clientesPendentes.length)}
            sub={fmtR$(dados.totalEmAberto) + " em aberto"}
            trend={dados.clientesPendentes.length > 0 ? "down" : "neutral"}
            colorVar={dados.clientesPendentes.length > 0 ? "var(--red)" : "var(--text-2)"}
          />
        </div>
      </div>

      {dados.topClientes.length > 0 && (
        <div className="tr-wrap">
          <div className="tr-header">
            <span className="tr-title">Top Clientes no Período</span>
          </div>
          {dados.topClientes.map((c, i) => (
            <div key={c.chave || c.nome} className="rank-item">
              <span className="rank-num">#{i + 1}</span>
              <span className="rank-label">{c.nome}</span>
              <span className="rank-val">{fmtR$(c.total)}</span>
            </div>
          ))}
        </div>
      )}

      {filtroPendentes && (
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0 6px" }}>
            <span style={{ fontSize: 12, color: "var(--text-3)" }}>
              Mostrando apenas clientes com pagamentos pendentes
            </span>
            <button
              className="btn-secondary"
              style={{ fontSize: 11, padding: "4px 12px" }}
              onClick={() => setFiltroPendentes(false)}
            >
              <X size={11} /> Limpar filtro
            </button>
          </div>
          <TabelaRelatorio
            title="Clientes com Pagamentos Pendentes"
            count={dados.clientesPendentes.length}
            empty="Nenhum cliente com pagamento pendente."
            data={dados.clientesPendentes}
            columns={[
              { key: "id",   label: "ID", render: (v) => <span style={{ color: "var(--gold)", fontFamily: "'Sora', sans-serif", fontSize: 11 }}>{v}</span> },
              { key: "nome", label: "Nome" },
              { key: "telefone", label: "Telefone" },
              { key: "_valorEmAberto", label: "Em Aberto", align: "right",
                render: (v) => <span className="val-neg">{fmtR$(v || 0)}</span> },
            ]}
          />
        </div>
      )}

      <TabelaRelatorio
        title="Todos os Clientes"
        count={dados.total}
        empty="Nenhum cliente cadastrado."
        data={dados.listaCompleta}
        columns={[
          { key: "id",       label: "ID", render: (v) => <span style={{ color: "var(--gold)", fontFamily: "'Sora', sans-serif", fontSize: 11 }}>{v}</span> },
          { key: "nome",     label: "Nome" },
          { key: "telefone", label: "Telefone" },
          { key: "cpf",      label: "CPF / CNPJ" },
          { key: "email",    label: "E-mail" },
          { key: "nome",     label: "Valor Gasto", align: "right",
            render: (nome, row) => {
              const chave = row.id || (nome || "").trim().toLowerCase();
              const val = dados.gastosPorCliente[chave]
                ?? dados.gastosPorCliente[(nome || "").trim().toLowerCase()]
                ?? 0;
              return val > 0
                ? <span className="val-pos">{fmtR$(val)}</span>
                : <span style={{ color: "var(--text-3)" }}>—</span>;
            }},
          { key: "fiado",    label: "Fiado", align: "right",
            render: (v, row) => {
              const val = Number(v || row.debito || 0);
              return val > 0
                ? <span className="val-neg">{fmtR$(val)}</span>
                : <span style={{ color: "var(--text-3)" }}>—</span>;
            }},
        ]}
      />

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button className="btn-secondary" onClick={handleExport}>
          <Download size={13} /> Exportar Excel
        </button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   RELATÓRIO: AGENDA
   ══════════════════════════════════════════════════════ */
function RelatorioAgenda({ agenda, intervalo }) {
  const dados = useMemo(() => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);


    /* Helper: extrai a data do item tentando múltiplos campos possíveis */
    const getDataAgenda = (a) =>
      a.data || a.dataHora || a.inicio || a.date || a.start || a.dataInicio || null;

    /* Agenda usa a data do compromisso como referência */
    const filtrada = agenda
      .filter((a) => {
        const rawDate = getDataAgenda(a);
        /* Se periodo for "todos" (intervalo sem datas), mostra tudo */
        if (!intervalo.de && !intervalo.ate) return true;
        return dentroDoIntervalo(rawDate, intervalo);
      })
      .sort((a, b) => {
        const da = parseDate(getDataAgenda(a));
        const db2 = parseDate(getDataAgenda(b));
        return (da || 0) - (db2 || 0);
      });


    const futuros = filtrada.filter((a) => {
      const dt = parseDate(getDataAgenda(a));
      /* CORREÇÃO: itens sem data parseável ficavam fora de futuros E passados,
         causando Total > Futuros + Passados. Sem data → inclui em futuros. */
      return !dt || dt >= hoje;
    });
    const passados = filtrada.filter((a) => {
      const dt = parseDate(getDataAgenda(a));
      return dt && dt < hoje;
    });


    return { filtrada, futuros, passados, getDataAgenda };
  }, [agenda, intervalo]);

  const { getDataAgenda } = dados;

  const getBadge = (rawDate) => {
    const dias = getDiasRestantes(rawDate);
    if (dias === null) return null;
    if (dias === 0) return { label: "Hoje", cls: "ag-badge-hoje" };
    if (dias > 0 && dias <= 7) return { label: `Em ${dias}d`, cls: "ag-badge-prox" };
    if (dias > 7) return { label: "Futuro", cls: "ag-badge-fut" };
    return null;
  };

  const handleExport = () => {
    exportarExcel("agenda", [{
      nome: "Agenda",
      colunas: ["Data", "Hora", "Título", "Tipo", "Status", "Descrição"],
      dados: dados.filtrada.map((a) => [
        fmtData(getDataAgenda(a)),
        a.hora || "—",
        a.titulo || a.title || "—",
        a.tipo || a.type || "—",
        a.status || "—",
        a.descricao || a.description || "—",
      ]),
    }]);
  };

  const renderItem = (a, i) => {
    const rawDate = getDataAgenda(a);
    const dt = parseDate(rawDate);
    const badge = getBadge(rawDate);
    const dia  = dt ? dt.getDate() : "?";
    const mes  = dt ? MESES_CURTOS[dt.getMonth()] : "?";

    return (
      <div key={a.id || i} className="ag-item">
        <div className="ag-date-box">
          <div className="ag-date-day">{dia}</div>
          <div className="ag-date-mon">{mes}</div>
        </div>
        <div className="ag-info">
          <div className="ag-titulo">{a.titulo || a.title || "Sem título"}</div>
          <div className="ag-meta">
            {a.hora && <span>🕐 {a.hora}</span>}
            {(a.tipo || a.type) && <span>{a.tipo || a.type}</span>}
            {a.status && <span style={{ textTransform: "capitalize" }}>{a.status}</span>}
          </div>
          {(a.descricao || a.description) && (
            <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 4 }}>
              {a.descricao || a.description}
            </div>
          )}
        </div>
        {badge && <span className={`ag-badge ${badge.cls}`}>{badge.label}</span>}
      </div>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div className="cr-grid">
        <CardResumo icon={<Calendar size={18} />} label="Total no Período"
          value={String(dados.filtrada.length)} sub="compromissos" trend="neutral" colorVar="var(--gold)" />
        <CardResumo icon={<TrendingUp size={18} />} label="Futuros"
          value={String(dados.futuros.length)} sub="agendados" trend="up" colorVar="var(--green)" />
        <CardResumo icon={<TrendingDown size={18} />} label="Passados"
          value={String(dados.passados.length)} sub="realizados" trend="neutral" colorVar="var(--text-2)" />
      </div>

      {dados.futuros.length > 0 && (
        <div className="tr-wrap">
          <div className="tr-header">
            <span className="tr-title">Próximos Compromissos</span>
            <span className="tr-badge">{dados.futuros.length}</span>
          </div>
          {dados.futuros.map(renderItem)}
        </div>
      )}

      {dados.passados.length > 0 && (
        <div className="tr-wrap">
          <div className="tr-header">
            <span className="tr-title">Compromissos Passados</span>
            <span className="tr-badge">{dados.passados.length}</span>
          </div>
          {dados.passados.map(renderItem)}
        </div>
      )}

      {dados.filtrada.length === 0 && (
        <div className="rel-empty">
          <Calendar size={32} color="var(--text-3)" />
          <p>Nenhum compromisso no período selecionado.</p>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button className="btn-secondary" onClick={handleExport}>
          <Download size={13} /> Exportar Excel
        </button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   RELATÓRIO: LUCRO POR PRODUTO / SERVIÇO
   ══════════════════════════════════════════════════════ */
function RelatorioLucroPorPS({ vendas, produtos, servicos, vendedores, intervalo }) {
  const [aba, setAba]         = useState("produtos");
  const [filtroOrdem, setFiltroOrdem] = useState("padrao"); // "padrao" | "mais" | "menos"

  /* Helper: mesma fórmula do Vendedores.jsx
     Comissão = (total - custo_total_itens) × (% / 100)
     Só aplica se o vendedor tiver comissao > 0 */
  const calcComissaoVenda = (venda, pct) => {
    if (!pct || pct <= 0) return 0;
    const itens = venda.itens || [];
    const total = typeof venda.total === "number"
      ? venda.total
      : itens.reduce((s, i) => s + (Number(i.preco || 0) * Number(i.qtd || 1)), 0);
    const custoTotal = itens.reduce((s, i) => s + (Number(i.custo || 0) * Number(i.qtd || 1)), 0);
    const lucro = total - custoTotal;
    return lucro > 0 ? lucro * (pct / 100) : 0;
  };

  const dados = useMemo(() => {
    const vendasPeriodo = vendas.filter((v) => dentroDoIntervalo(v.data, intervalo));

    /* ── Mapas duplos: por ID e por nome (lower) ──
       A venda pode gravar o vendedor de formas diferentes:
       - v.vendedorId   → "V0001" (ID do cadastro)
       - v.vendedor     → "João"  (nome direto)
       - v.vendedorNome → "João"  (nome alternativo)
       Construímos dois mapas para cobrir todos os casos. */
    const comissaoMapId   = {}; // id → { id, nome, pct }
    const comissaoMapNome = {}; // nome_lower → { id, nome, pct }
    vendedores.forEach((vd) => {
      if (vd.comissao != null && Number(vd.comissao) > 0) {
        const entry = { id: vd.id, nome: vd.nome, pct: Number(vd.comissao) };
        comissaoMapId[vd.id] = entry;
        if (vd.nome) comissaoMapNome[(vd.nome || "").trim().toLowerCase()] = entry;
      }
    });

    /* Resolve o vendedor de uma venda tentando todos os campos possíveis */
    const resolverVendedor = (v) => {
      if (v.vendedorId && comissaoMapId[v.vendedorId]) return comissaoMapId[v.vendedorId];
      const nomeCampo = (v.vendedor || v.vendedorNome || "").trim().toLowerCase();
      if (nomeCampo && comissaoMapNome[nomeCampo]) return comissaoMapNome[nomeCampo];
      return null;
    };

    /* Comissão total do período */
    let totalComissoesPeriodo = 0;
    const comissaoPorVendedor = {}; // chave → { nome, pct, valor }

    vendasPeriodo.forEach((v) => {
      const vdEntry = resolverVendedor(v);
      if (!vdEntry) return;
      const val   = calcComissaoVenda(v, vdEntry.pct);
      const chave = vdEntry.id;
      totalComissoesPeriodo += val;
      if (!comissaoPorVendedor[chave])
        comissaoPorVendedor[chave] = { nome: vdEntry.nome, pct: vdEntry.pct, valor: 0 };
      comissaoPorVendedor[chave].valor += val;
    });

    /* Proporção da comissão por item: distribui a comissão de cada venda
       proporcionalmente ao faturamento de cada item naquela venda */
    const agregar = (tipo) => {
      const catalogo = tipo === "produto" ? produtos : servicos;
      const nomesMap = {}; // nome_lower → { nome, fat, custo, comissao, qtd }

      vendasPeriodo.forEach((v) => {
        const vdEntry = resolverVendedor(v);
        const comissaoVenda = vdEntry ? calcComissaoVenda(v, vdEntry.pct) : 0;

        /* Faturamento total da venda (para distribuição proporcional) */
        const fatVendaTotal = (v.itens || []).reduce((s, i) => {
          const nomeI = (i.nome || i.produto || i.servico || "").trim();
          const nocat = catalogo.find((c) => (c.nome || "").trim().toLowerCase() === nomeI.toLowerCase());
          if (!nocat) return s;
          return s + Number(i.preco || i.precoUnit || i.valor || nocat.preco || 0) * Number(i.qtd || i.quantidade || 1);
        }, 0);

        (v.itens || []).forEach((item) => {
          const nomeItem = (item.nome || item.produto || item.servico || "").trim();
          if (!nomeItem) return;
          const nomeLower = nomeItem.toLowerCase();

          const nocat = catalogo.find(
            (c) => (c.nome || "").trim().toLowerCase() === nomeLower
          );
          if (!nocat) return;

          const qtd    = Number(item.qtd || item.quantidade || 1);
          const preco  = Number(item.preco || item.precoUnit || item.valor || nocat.preco || 0);
          const custoU = Number(item.custo || item.custoUnit || nocat.custo || 0);
          const fatItem = preco * qtd;

          /* Comissão proporcional ao peso do item no faturamento da venda */
          const proporcao       = fatVendaTotal > 0 ? fatItem / fatVendaTotal : 0;
          const comissaoItem    = comissaoVenda * proporcao;

          if (!nomesMap[nomeLower]) {
            nomesMap[nomeLower] = { nome: nocat.nome || nomeItem, fat: 0, custo: 0, comissao: 0, qtd: 0 };
          }
          nomesMap[nomeLower].fat      += fatItem;
          nomesMap[nomeLower].custo    += custoU * qtd;
          nomesMap[nomeLower].comissao += comissaoItem;
          nomesMap[nomeLower].qtd      += qtd;
        });
      });

      return Object.values(nomesMap)
        .map((r) => ({
          ...r,
          lucrobruto: r.fat - r.custo,
          lucro:      r.fat - r.custo - r.comissao, // lucro líquido após comissão
        }))
        .sort((a, b) => b.fat - a.fat);
    };

    const listaProdutos = agregar("produto");
    const listaServicos = agregar("servico");

    const totais = (lista) => lista.reduce(
      (acc, r) => ({
        fat:      acc.fat      + r.fat,
        custo:    acc.custo    + r.custo,
        comissao: acc.comissao + r.comissao,
        lucro:    acc.lucro    + r.lucro,
      }),
      { fat: 0, custo: 0, comissao: 0, lucro: 0 }
    );

    const temComissao = totalComissoesPeriodo > 0;

    return {
      listaProdutos,
      listaServicos,
      totaisProdutos: totais(listaProdutos),
      totaisServicos: totais(listaServicos),
      temComissao,
      totalComissoesPeriodo,
      comissaoPorVendedor: Object.values(comissaoPorVendedor),
    };
  }, [vendas, produtos, servicos, vendedores, intervalo]);

  const pctMargem = (fat, lucro) =>
    fat > 0 ? (lucro / fat) * 100 : 0;

  const PctBadge = ({ fat, lucro }) => {
    const pct = pctMargem(fat, lucro);
    const cls = pct >= 40 ? "lps-pct-green" : pct >= 15 ? "lps-pct-gold" : "lps-pct-red";
    return <span className={`lps-pct-badge ${cls}`}>{pct.toFixed(2)}%</span>;
  };

  const lista   = (() => {
    const base = aba === "produtos" ? dados.listaProdutos : dados.listaServicos;
    if (filtroOrdem === "mais")  return [...base].sort((a, b) => b.qtd - a.qtd);
    if (filtroOrdem === "menos") return [...base].sort((a, b) => a.qtd - b.qtd);
    return base; // padrão: maior faturamento
  })();
  const totais  = aba === "produtos" ? dados.totaisProdutos : dados.totaisServicos;
  const label   = aba === "produtos" ? "Produto" : "Serviço";

  const handleExport = () => {
    const colsProd = dados.temComissao
      ? ["Produto", "Qtd.", "Faturamento (R$)", "Custo (R$)", "Comissão (R$)", "Lucro Líquido (R$)", "Margem (%)"]
      : ["Produto", "Qtd.", "Faturamento (R$)", "Custo (R$)", "Lucro (R$)", "Margem (%)"];
    const colsServ = dados.temComissao
      ? ["Serviço", "Qtd.", "Faturamento (R$)", "Custo (R$)", "Comissão (R$)", "Lucro Líquido (R$)", "Margem (%)"]
      : ["Serviço", "Qtd.", "Faturamento (R$)", "Custo (R$)", "Lucro (R$)", "Margem (%)"];

    const mapRow = (r) => dados.temComissao
      ? [r.nome, r.qtd, r.fat.toFixed(2), r.custo.toFixed(2), r.comissao.toFixed(2), r.lucro.toFixed(2), pctMargem(r.fat, r.lucro).toFixed(2) + "%"]
      : [r.nome, r.qtd, r.fat.toFixed(2), r.custo.toFixed(2), r.lucro.toFixed(2), pctMargem(r.fat, r.lucro).toFixed(2) + "%"];

    exportarExcel("lucro_por_ps", [
      { nome: "Produtos", colunas: colsProd, dados: dados.listaProdutos.map(mapRow) },
      { nome: "Serviços", colunas: colsServ, dados: dados.listaServicos.map(mapRow) },
    ]);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Abas */}
      <div className="lps-tabs">
        <button
          className={`lps-tab${aba === "produtos" ? " active" : ""}`}
          onClick={() => setAba("produtos")}
        >
          <Package size={13} style={{ display: "inline", marginRight: 5, verticalAlign: "middle" }} />
          Produtos
        </button>
        <button
          className={`lps-tab${aba === "servicos" ? " active" : ""}`}
          onClick={() => setAba("servicos")}
        >
          <FileText size={13} style={{ display: "inline", marginRight: 5, verticalAlign: "middle" }} />
          Serviços
        </button>
      </div>

      {/* Filtros de ordenação */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".07em", color: "var(--text-3)" }}>
          Ordenar por:
        </span>
        {[
          { key: "padrao", label: "Maior Faturamento" },
          { key: "mais",   label: "Mais Vendidos"     },
          { key: "menos",  label: "Menos Vendidos"    },
        ].map(({ key, label: lbl }) => (
          <button
            key={key}
            onClick={() => setFiltroOrdem(key)}
            style={{
              padding: "5px 13px",
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 500,
              fontFamily: "'DM Sans', sans-serif",
              cursor: "pointer",
              border: filtroOrdem === key ? "1px solid var(--gold)" : "1px solid var(--border)",
              background: filtroOrdem === key ? "rgba(200,165,94,0.15)" : "var(--s3)",
              color: filtroOrdem === key ? "var(--gold)" : "var(--text-2)",
              transition: "all .13s",
            }}
          >
            {lbl}
          </button>
        ))}
      </div>

      {/* Cards de totais */}
      <div className="cr-grid">
        <CardResumo
          icon={<TrendingUp size={18} />}
          label="Faturamento"
          value={fmtR$(totais.fat)}
          sub={`${lista.length} ${label.toLowerCase()}(s) vendido(s)`}
          trend="neutral"
          colorVar="var(--blue)"
        />
        <CardResumo
          icon={<TrendingDown size={18} />}
          label="Custo"
          value={fmtR$(totais.custo)}
          sub="custo total dos itens"
          trend="down"
          colorVar="var(--red)"
        />
        {dados.temComissao && (
          <CardResumo
            icon={<DollarSign size={18} />}
            label="Comissões"
            value={fmtR$(totais.comissao)}
            sub={dados.comissaoPorVendedor.map(c => `${c.nome} (${c.pct}%)`).join(" · ")}
            trend="down"
            colorVar="var(--gold)"
          />
        )}
        <CardResumo
          icon={<DollarSign size={18} />}
          label={dados.temComissao ? "Lucro Líquido" : "Lucro"}
          value={fmtR$(totais.lucro)}
          sub={`Margem: ${fmtPct(pctMargem(totais.fat, totais.lucro))}${dados.temComissao ? " (após comissões)" : ""}`}
          trend={totais.lucro >= 0 ? "up" : "down"}
          colorVar={totais.lucro >= 0 ? "var(--green)" : "var(--red)"}
        />
      </div>

      {/* Tabela */}
      <div className="tr-wrap">
        <div className="tr-header">
          <span className="tr-title">
            {aba === "produtos" ? "Lucro por Produto" : "Lucro por Serviço"}
          </span>
          <span className="tr-badge">{lista.length}</span>
        </div>

        {/* Cabeçalho */}
        <div className="lps-row lps-row-head" style={{ gridTemplateColumns: dados.temComissao ? "1fr 60px 140px 140px 110px 180px" : "1fr 60px 140px 140px 180px" }}>
          <span>{label}</span>
          <span>Qtd.</span>
          <span>Faturamento</span>
          <span>Custo</span>
          {dados.temComissao && <span>Comissão</span>}
          <span>Lucro</span>
        </div>

        {lista.length === 0 ? (
          <div className="tr-state">
            Nenhum {label.toLowerCase()} vendido no período selecionado.
          </div>
        ) : (
          lista.map((r, i) => (
            <div key={r.nome + i} className="lps-row" style={{ gridTemplateColumns: dados.temComissao ? "1fr 60px 140px 140px 110px 180px" : "1fr 60px 140px 140px 180px" }}>
              <span className="lps-nome">{r.nome}</span>
              <span style={{ fontFamily: "'Sora', sans-serif", fontSize: 12, color: "var(--text-2)" }}>{r.qtd}</span>
              <span className="lps-fat">{fmtR$(r.fat)}</span>
              <span className="lps-custo">{fmtR$(r.custo)}</span>
              {dados.temComissao && (
                <span style={{ fontFamily: "'Sora', sans-serif", fontSize: 12, fontWeight: 600, color: r.comissao > 0 ? "var(--gold)" : "var(--text-3)" }}>
                  {r.comissao > 0 ? fmtR$(r.comissao) : "—"}
                </span>
              )}
              <div className="lps-lucro-cell">
                <span className="lps-lucro">{fmtR$(r.lucro)}</span>
                <PctBadge fat={r.fat} lucro={r.lucro} />
              </div>
            </div>
          ))
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button className="btn-secondary" onClick={handleExport}>
          <Download size={13} /> Exportar Excel
        </button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   MENU DE NAVEGAÇÃO — configuração
   ══════════════════════════════════════════════════════ */
const PERMISSOES_RELATORIO = {
  dre:        ["financeiro"],
  financeiro: ["financeiro"],
  despesas:   ["financeiro"],
  compras:    ["financeiro", "compras"],
  estoque:    ["financeiro", "comercial", "compras", "operacional", "vendedor"],
  vendas:     ["financeiro", "comercial", "vendedor", "suporte"],
  clientes:   ["comercial", "vendedor", "suporte"],
  agenda:     ["comercial", "vendedor", "suporte"],
  lucro_ps:   ["financeiro", "comercial"],
  vendedores: ["financeiro", "comercial"],
};

const MENU = [
  { key: "dre",        label: "DRE",          icon: <LayoutDashboard size={15} /> },
  { key: "financeiro", label: "Financeiro",   icon: <Wallet size={15} />         },
  { key: "lucro_ps",   label: "Produtos & Serviços", icon: <DollarSign size={15} />     },
  { key: "vendas",     label: "Vendas",       icon: <ShoppingCart size={15} />   },
  { key: "vendedores", label: "Vendedores",   icon: <Users size={15} />          },
  { key: "clientes",   label: "Clientes",     icon: <Users size={15} />          },
  { key: "despesas",   label: "Despesas",     icon: <Receipt size={15} />        },
  { key: "estoque",    label: "Estoque",      icon: <Package size={15} />        },
  { key: "agenda",     label: "Agenda",       icon: <Calendar size={15} />       },
 
];

const TITULO_RELATORIO = {
  dre:        "DRE — Demonstração do Resultado",
  financeiro: "Relatório Financeiro",
  vendas:     "Relatório de Vendas",
  despesas:   "Relatório de Despesas",
  estoque:    "Relatório de Estoque",
  clientes:   "Relatório de Clientes",
  agenda:     "Relatório de Agenda",
  lucro_ps:   "Produtos & Serviços",
  vendedores: "Relatório de Vendedores",
};


/* ══════════════════════════════════════════════════════
   RELATÓRIO: VENDEDORES
   ══════════════════════════════════════════════════════ */
function RelatorioVendedores({ vendas, vendedores, intervalo }) {
  const [vendedorSel, setVendedorSel] = useState("todos");

  /* ── Vendas ativas do período (excluir canceladas) ── */
  const vendasPeriodo = useMemo(() =>
    vendas.filter((v) =>
      v.status !== "cancelada" &&
      dentroDoIntervalo(v.data, intervalo)
    ),
    [vendas, intervalo]
  );

  /* ── Mapa: vendedorId → { nome, comissao }
        também indexado por nome_lower para resolver vendas antigas ── */
  const vendedoresMap = useMemo(() => {
    const byId   = {};
    const byNome = {};
    vendedores.forEach((v) => {
      const entry = { id: v.id, nome: v.nome, comissao: parseFloat(v.comissao) || 0 };
      byId[v.id] = entry;
      if (v.nome) byNome[(v.nome || "").trim().toLowerCase()] = entry;
    });
    return { byId, byNome };
  }, [vendedores]);

  /* Resolve a chave canônica de um vendedor numa venda:
     - Prefere vendedorId (novo)
     - Fallback: busca no mapa de nomes (dados antigos sem vendedorId) */
  const resolverVendedorKey = useCallback((v) => {
    if (v.vendedorId && vendedoresMap.byId[v.vendedorId]) return v.vendedorId;
    const nomeLower = (v.vendedor || "").trim().toLowerCase();
    if (nomeLower && vendedoresMap.byNome[nomeLower]) return vendedoresMap.byNome[nomeLower].id;
    // vendas sem vínculo cadastrado: usa o nome bruto como chave (agrupa pelo nome)
    return v.vendedorId || v.vendedor || "—";
  }, [vendedoresMap]);

  /* ─────────────────────────────────────────────────
     CÁLCULO POR VENDEDOR
     Regra de comissão: (lucroEstimado OU total - custo) × (% / 100)
     Lucro gerado: lucroEstimado quando disponível, senão total - custoTotal
  ───────────────────────────────────────────────── */
  const statsMap = useMemo(() => {
    const m = {};

    vendasPeriodo.forEach((v) => {
      const vid  = resolverVendedorKey(v);
      const reg  = vendedoresMap.byId[vid];
      const nome = reg?.nome || v.vendedor || vid;
      const pct  = reg?.comissao ?? 0;
      const fat   = Number(v.total || 0);
      const custo = Number(v.custoTotal || 0);
      const lucroBase = v.lucroEstimado != null
        ? Number(v.lucroEstimado)
        : fat - custo;
      const comissao = lucroBase * (pct / 100);

      if (!m[vid]) {
        m[vid] = { id: vid, nome, pct, faturamento: 0, custo: 0, lucro: 0, comissao: 0, qtd: 0 };
      }
      m[vid].faturamento += fat;
      m[vid].custo       += custo;
      m[vid].lucro       += lucroBase;
      m[vid].comissao    += comissao;
      m[vid].qtd         += 1;
    });

    return m;
  }, [vendasPeriodo, vendedoresMap, resolverVendedorKey]);

  /* ── Ranking por faturamento ── */
  const ranking = useMemo(() =>
    Object.values(statsMap).sort((a, b) => b.faturamento - a.faturamento),
    [statsMap]
  );

  /* ── Totais globais ── */
  const totais = useMemo(() => ({
    faturamento: ranking.reduce((s, r) => s + r.faturamento, 0),
    lucro:       ranking.reduce((s, r) => s + r.lucro,       0),
    comissao:    ranking.reduce((s, r) => s + r.comissao,    0),
    qtd:         ranking.reduce((s, r) => s + r.qtd,         0),
  }), [ranking]);

  /* ── Transações do vendedor selecionado ── */
  const transacoes = useMemo(() => {
    if (vendedorSel === "todos") return [];
    return vendasPeriodo
      .filter((v) => resolverVendedorKey(v) === vendedorSel)
      .sort((a, b) => {
        const da  = parseDate(a.data);
        const db2 = parseDate(b.data);
        return (db2 || 0) - (da || 0);
      });
  }, [vendasPeriodo, vendedorSel, resolverVendedorKey]);

  const selStats = statsMap[vendedorSel];

  /* ── Export Excel ── */
  const handleExport = () => {
    if (vendedorSel === "todos") {
      exportarExcel("vendedores", [{
        nome: "Ranking Vendedores",
        colunas: ["Pos.", "Vendedor", "Qtd Vendas", "Faturamento (R$)", "Lucro Gerado (R$)", "Comissão %", "Comissão (R$)"],
        dados: ranking.map((r, i) => [
          `#${i + 1}`, r.nome, r.qtd,
          r.faturamento.toFixed(2),
          r.lucro.toFixed(2),
          `${r.pct}%`,
          r.comissao.toFixed(2),
        ]),
      }]);
    } else {
      exportarExcel(`vendedor-${selStats?.nome || vendedorSel}`, [{
        nome: "Transações",
        colunas: ["Data", "Cliente", "Produto/Serviço", "Forma Pgto", "Total (R$)", "Lucro (R$)", "Comissão (R$)"],
        dados: transacoes.map((v) => {
          const custo     = Number(v.custoTotal || 0);
          const lucroBase = v.lucroEstimado != null ? Number(v.lucroEstimado) : Number(v.total || 0) - custo;
          const comissao  = lucroBase * ((selStats?.pct || 0) / 100);
          return [
            fmtData(v.data),
            v.cliente || "—",
            v.itens?.map(i => i.nome).filter(Boolean).join(", ") || v.livreNome || "—",
            v.formaPagamento || "—",
            Number(v.total || 0).toFixed(2),
            lucroBase.toFixed(2),
            comissao.toFixed(2),
          ];
        }),
      }]);
    }
  };

  /* ══════════ RENDER ══════════ */
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* ── Filtro de vendedor — dropdown ── */}
      <div style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "11px 16px",
        background: "var(--s1)", border: "1px solid var(--border)", borderRadius: 10,
      }}>
        <span style={{
          fontSize: 10, fontWeight: 600, textTransform: "uppercase",
          letterSpacing: ".07em", color: "var(--text-3)", flexShrink: 0,
        }}>
          Vendedor
        </span>

        <select
          className="form-input"
          style={{ maxWidth: 260, padding: "6px 12px", fontSize: 13 }}
          value={vendedorSel}
          onChange={e => setVendedorSel(e.target.value)}
        >
          <option value="todos">Todos (Ranking)</option>
          {ranking.map((r) => (
            <option key={r.id} value={r.id}>{r.nome}</option>
          ))}
          {vendedores
            .filter((v) => !statsMap[v.id])
            .map((v) => (
              <option key={v.id} value={v.id} style={{ opacity: 0.5 }}>
                {v.nome} (sem vendas)
              </option>
            ))
          }
        </select>
      </div>

      {/* ══════════════════════════════════
          VIEW: TODOS — Ranking
         ══════════════════════════════════ */}
      {vendedorSel === "todos" && (
        <>
          {/* KPIs globais */}
          <div className="cr-grid">
            <CardResumo
              icon={<Users size={18} />}
              label="Vendedores Ativos"
              value={String(ranking.length)}
              sub="no período"
              trend="neutral"
              colorVar="var(--gold)"
            />
            <CardResumo
              icon={<DollarSign size={18} />}
              label="Faturamento Total"
              value={fmtR$(totais.faturamento)}
              sub={`${totais.qtd} vendas`}
              trend="up"
              colorVar="var(--green)"
            />
            <CardResumo
              icon={<TrendingUp size={18} />}
              label="Lucro Total Gerado"
              value={fmtR$(totais.lucro)}
              sub={totais.faturamento > 0
                ? `${fmtPct((totais.lucro / totais.faturamento) * 100)} margem`
                : "—"}
              trend={totais.lucro >= 0 ? "up" : "down"}
              colorVar={totais.lucro >= 0 ? "var(--green)" : "var(--red)"}
            />
            <CardResumo
              icon={<Receipt size={18} />}
              label="Total em Comissões"
              value={fmtR$(totais.comissao)}
              sub="a pagar"
              trend="neutral"
              colorVar="var(--text-2)"
            />
          </div>

          {/* Ranking table */}
          {ranking.length === 0 ? (
            <div className="rel-empty">
              <Users size={32} color="var(--text-3)" />
              <p>Nenhuma venda registrada no período.</p>
            </div>
          ) : (
            <div className="tr-wrap">
              <div className="tr-header">
                <span className="tr-title">Ranking de Vendedores</span>
                <span className="tr-badge">{ranking.length}</span>
              </div>

              {/* Cabeçalho */}
              <div className="tr-head" style={{
                gridTemplateColumns: "36px 1fr 72px 140px 140px 80px 130px",
                display: "grid", padding: "9px 18px", gap: 8,
              }}>
                <span>Pos.</span>
                <span>Vendedor</span>
                <span style={{ textAlign: "right" }}>Vendas</span>
                <span style={{ textAlign: "right" }}>Faturamento</span>
                <span style={{ textAlign: "right" }}>Lucro Gerado</span>
                <span style={{ textAlign: "right" }}>Com.%</span>
                <span style={{ textAlign: "right" }}>Comissão R$</span>
              </div>

              {ranking.map((r, i) => {
                const barPct = totais.faturamento > 0
                  ? (r.faturamento / totais.faturamento) * 100
                  : 0;
                return (
                  <div
                    key={r.id}
                    className="tr-row"
                    style={{
                      gridTemplateColumns: "36px 1fr 72px 140px 140px 80px 130px",
                      cursor: "pointer",
                    }}
                    onClick={() => setVendedorSel(r.id)}
                    title="Clique para ver as transações deste vendedor"
                  >
                    <span style={{
                      fontFamily: "'Sora', sans-serif", fontWeight: 700,
                      color: i === 0 ? "var(--gold)" : "var(--text-3)", fontSize: 13,
                    }}>
                      #{i + 1}
                    </span>

                    <div style={{ minWidth: 0 }}>
                      <div style={{
                        fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 4,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>
                        {r.nome}
                      </div>
                      <div style={{ height: 3, borderRadius: 2, background: "var(--s3)", overflow: "hidden", width: "80%" }}>
                        <div style={{
                          height: "100%", borderRadius: 2,
                          background: i === 0 ? "var(--gold)" : "var(--blue)",
                          width: `${barPct.toFixed(1)}%`,
                          transition: "width .4s ease",
                        }} />
                      </div>
                    </div>

                    <span style={{ textAlign: "right", fontFamily: "'Sora', sans-serif", fontSize: 13 }}>
                      {r.qtd}
                    </span>

                    <span style={{ textAlign: "right" }} className="val-pos">
                      {fmtR$(r.faturamento)}
                    </span>

                    <span style={{ textAlign: "right" }} className={r.lucro >= 0 ? "val-pos" : "val-neg"}>
                      {fmtR$(r.lucro)}
                    </span>

                    <span style={{
                      textAlign: "right", fontSize: 12,
                      color: "var(--text-2)", fontFamily: "'Sora', sans-serif",
                    }}>
                      {r.pct}%
                    </span>

                    <span style={{ textAlign: "right" }} className="val-neu">
                      {fmtR$(r.comissao)}
                    </span>
                  </div>
                );
              })}

              {/* Linha de totais */}
              <div
                className="tr-row"
                style={{
                  gridTemplateColumns: "36px 1fr 72px 140px 140px 80px 130px",
                  background: "rgba(0,0,0,0.15)",
                  borderTop: "1px solid var(--border-h)",
                  fontWeight: 700,
                }}
              >
                <span />
                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text)" }}>TOTAL</span>
                <span style={{ textAlign: "right", fontFamily: "'Sora', sans-serif", fontSize: 13 }}>
                  {totais.qtd}
                </span>
                <span style={{ textAlign: "right" }} className="val-pos">
                  {fmtR$(totais.faturamento)}
                </span>
                <span style={{ textAlign: "right" }} className={totais.lucro >= 0 ? "val-pos" : "val-neg"}>
                  {fmtR$(totais.lucro)}
                </span>
                <span />
                <span style={{ textAlign: "right" }} className="val-neu">
                  {fmtR$(totais.comissao)}
                </span>
              </div>
            </div>
          )}
        </>
      )}

      {/* ══════════════════════════════════
          VIEW: VENDEDOR INDIVIDUAL
         ══════════════════════════════════ */}
      {vendedorSel !== "todos" && (
        <>
          {/* Botão voltar */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              className="btn-secondary"
              style={{ fontSize: 11, padding: "5px 12px" }}
              onClick={() => setVendedorSel("todos")}
            >
              ← Voltar ao ranking
            </button>
            <span style={{ fontSize: 13, color: "var(--text-2)" }}>
              Transações de{" "}
              <strong style={{ color: "var(--text)" }}>
                {selStats?.nome || vendedorSel}
              </strong>{" "}
              no período
            </span>
          </div>

          {/* KPIs do vendedor */}
          {selStats ? (
            <div className="cr-grid">
              <CardResumo
                icon={<ShoppingCart size={18} />}
                label="Vendas no Período"
                value={String(selStats.qtd)}
                sub="transações"
                trend="neutral"
                colorVar="var(--gold)"
              />
              <CardResumo
                icon={<DollarSign size={18} />}
                label="Faturamento"
                value={fmtR$(selStats.faturamento)}
                sub="total bruto"
                trend="up"
                colorVar="var(--green)"
              />
              <CardResumo
                icon={<TrendingUp size={18} />}
                label="Lucro Gerado"
                value={fmtR$(selStats.lucro)}
                sub={selStats.faturamento > 0
                  ? `${fmtPct((selStats.lucro / selStats.faturamento) * 100)} margem`
                  : "—"}
                trend={selStats.lucro >= 0 ? "up" : "down"}
                colorVar={selStats.lucro >= 0 ? "var(--green)" : "var(--red)"}
              />
              <CardResumo
                icon={<Receipt size={18} />}
                label={`Comissão (${selStats.pct}%)`}
                value={fmtR$(selStats.comissao)}
                sub="sobre lucro gerado"
                trend="neutral"
                colorVar="var(--text-2)"
              />
            </div>
          ) : (
            <div className="rel-empty">
              <Users size={32} color="var(--text-3)" />
              <p>Nenhuma venda registrada para este vendedor no período.</p>
            </div>
          )}

          {/* Tabela de transações */}
          {transacoes.length > 0 && (
            <div className="tr-wrap">
              <div className="tr-header">
                <span className="tr-title">Transações</span>
                <span className="tr-badge">{transacoes.length}</span>
              </div>

              {/* Cabeçalho */}
              <div className="tr-head" style={{
                gridTemplateColumns: "88px 1fr 1fr 110px 110px 110px 110px",
                display: "grid", padding: "9px 18px", gap: 8,
              }}>
                <span>Data</span>
                <span>Cliente</span>
                <span>Produto / Serviço</span>
                <span>Forma Pgto</span>
                <span style={{ textAlign: "right" }}>Total</span>
                <span style={{ textAlign: "right" }}>Lucro</span>
                <span style={{ textAlign: "right" }}>Comissão</span>
              </div>

              {transacoes.map((v) => {
                const custo     = Number(v.custoTotal || 0);
                const lucroBase = v.lucroEstimado != null
                  ? Number(v.lucroEstimado)
                  : Number(v.total || 0) - custo;
                const comissao  = lucroBase * ((selStats?.pct || 0) / 100);
                const descItens = v.itens?.map(i => i.nome).filter(Boolean).join(", ")
                  || v.livreNome || "—";

                return (
                  <div
                    key={v.id}
                    className="tr-row"
                    style={{ gridTemplateColumns: "88px 1fr 1fr 110px 110px 110px 110px" }}
                  >
                    <span style={{
                      fontFamily: "'Sora', sans-serif", fontSize: 11, color: "var(--text-3)",
                    }}>
                      {fmtData(v.data)}
                    </span>

                    <span style={{
                      fontWeight: 500, color: "var(--text)",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {v.cliente || "—"}
                    </span>

                    <span style={{
                      overflow: "hidden", textOverflow: "ellipsis",
                      whiteSpace: "nowrap", color: "var(--text-2)",
                    }}>
                      {descItens}
                    </span>

                    <span style={{ fontSize: 11, color: "var(--text-3)" }}>
                      {v.formaPagamento || "—"}
                    </span>

                    <span style={{ textAlign: "right" }} className="val-pos">
                      {fmtR$(v.total || 0)}
                    </span>

                    <span style={{ textAlign: "right" }} className={lucroBase >= 0 ? "val-pos" : "val-neg"}>
                      {fmtR$(lucroBase)}
                    </span>

                    <span style={{ textAlign: "right" }} className="val-neu">
                      {fmtR$(comissao)}
                    </span>
                  </div>
                );
              })}

              {/* Subtotais */}
              {selStats && (
                <div
                  className="tr-row"
                  style={{
                    gridTemplateColumns: "88px 1fr 1fr 110px 110px 110px 110px",
                    background: "rgba(0,0,0,0.15)",
                    borderTop: "1px solid var(--border-h)",
                    fontWeight: 700,
                  }}
                >
                  <span /><span /><span />
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text)" }}>SUBTOTAL</span>
                  <span style={{ textAlign: "right" }} className="val-pos">
                    {fmtR$(selStats.faturamento)}
                  </span>
                  <span style={{ textAlign: "right" }} className={selStats.lucro >= 0 ? "val-pos" : "val-neg"}>
                    {fmtR$(selStats.lucro)}
                  </span>
                  <span style={{ textAlign: "right" }} className="val-neu">
                    {fmtR$(selStats.comissao)}
                  </span>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ── Export ── */}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button className="btn-secondary" onClick={handleExport}>
          <Download size={13} /> Exportar Excel
        </button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL: Relatorios
   ══════════════════════════════════════════════════════ */
export default function Relatorios() {
  // ── Auth via contexto — usa tenantUid para convidados acessarem dados do tenant ──
  const { cargo, isAdmin, tenantUid, vendedorId } = useContext(AuthContext);

  const [loading, setLoading]   = useState(true);
  const [ativo, setAtivo]       = useState("dre");

  /* Filtro de período */
  const [periodo,     setPeriodo]     = useState("mes");
  const [dataInicio,  setDataInicio]  = useState("");
  const [dataFim,     setDataFim]     = useState("");

  /* Dados das collections */
  const [vendas,     setVendas]     = useState([]);
  const [clientes,   setClientes]   = useState([]);
  const [despesas,   setDespesas]   = useState([]);
  const [produtos,   setProdutos]   = useState([]);
  const [servicos,   setServicos]   = useState([]);
  const [agenda,     setAgenda]     = useState([]);
  const [caixa,      setCaixa]      = useState([]);
  const [aReceber,   setAReceber]   = useState([]);
  const [vendedores, setVendedores] = useState([]);

  // Permissão por sub-relatório
  const temAcesso = (id) => {
    if (isAdmin) return true;
    return (PERMISSOES_RELATORIO[id] ?? []).includes(cargo);
  };

  /* Firestore — usa tenantUid (funciona para admin E convidados) */
  useEffect(() => {
    if (!tenantUid) { setLoading(false); return; }

    const col = (name) => collection(db, "users", tenantUid, name);
    setLoading(true);

    const subs = [
      onSnapshot(col("vendas"),   (s) => setVendas(s.docs.map((d) => ({ id: d.id, ...d.data() })))),
      onSnapshot(col("clientes"), (s) => setClientes(s.docs.map((d) => ({ id: d.id, ...d.data() })))),
      onSnapshot(col("despesas"), (s) => { setDespesas(s.docs.map((d) => ({ id: d.id, ...d.data() }))); setLoading(false); }),
      onSnapshot(col("produtos"), (s) => setProdutos(s.docs.map((d) => ({ id: d.id, ...d.data() }))),
        /* Ignorar erro se collection não existir */ () => {}),
      onSnapshot(col("servicos"), (s) => setServicos(s.docs.map((d) => ({ id: d.id, ...d.data() }))),
        () => {}),
      onSnapshot(col("eventos"),   (s) => setAgenda(s.docs.map((d) => ({ id: d.id, ...d.data() }))),
        () => {}),
      onSnapshot(col("caixa"),    (s) => setCaixa(s.docs.map((d) => ({ id: d.id, ...d.data() }))),
        () => {}),
      onSnapshot(col("a_receber"), (s) => setAReceber(s.docs.map((d) => ({ id: d.id, ...d.data() }))),
        () => {}),
      onSnapshot(col("vendedores"), (s) => setVendedores(s.docs.map((d) => ({ id: d.id, ...d.data() }))),
        () => {}),
    ];

    // Fallback: garantir que loading pare mesmo sem despesas
    const timeout = setTimeout(() => setLoading(false), 3000);

    return () => {
      subs.forEach((fn) => { try { fn(); } catch {} });
      clearTimeout(timeout);
    };
  }, [tenantUid]);

  /* Intervalo calculado */
  const intervalo = useMemo(
    () => getIntervalo(periodo, dataInicio, dataFim),
    [periodo, dataInicio, dataFim]
  );

  /* Impressão */
  const handlePrint = useCallback(() => window.print(), []);

  if (!tenantUid) {
    return (
      <div className="rel-loading">
        <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} />
        Carregando autenticação...
      </div>
    );
  }

  /* Renderiza o relatório ativo */
  const renderConteudo = () => {
    if (loading) {
      return (
        <div className="rel-loading">
          <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} />
          Carregando dados...
        </div>
      );
    }
    switch (ativo) {
      case "dre":        return <RelatorioDRE vendas={vendas} despesas={despesas} caixa={caixa} intervalo={intervalo} uid={tenantUid} />;
      case "financeiro": return <RelatorioFinanceiro caixa={caixa} despesas={despesas} vendas={vendas} vendedores={vendedores} intervalo={intervalo} />;
      case "vendas":     return <RelatorioVendas vendas={vendas} intervalo={intervalo} />;
      case "despesas":   return <RelatorioDespesas despesas={despesas} intervalo={intervalo} />;
      case "estoque":    return <RelatorioEstoque produtos={produtos} />;
      case "clientes":   return <RelatorioClientes clientes={clientes} vendas={vendas} intervalo={intervalo} aReceber={aReceber} />;
      case "agenda":     return <RelatorioAgenda agenda={agenda} intervalo={intervalo} />;
      case "lucro_ps":   return <RelatorioLucroPorPS vendas={vendas} produtos={produtos} servicos={servicos} vendedores={vendedores} intervalo={intervalo} />;
      case "vendedores": return <RelatorioVendedores vendas={vendas} vendedores={vendedores} intervalo={intervalo} />;
      default:           return null;
    }
  };

  return (
    <>
      <style>{CSS}</style>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <div className="rel-root">
        {/* Barra superior */}
        <header className="rel-topbar">
          <div className="rel-topbar-left">
            <div className="rel-topbar-title">
              <h1>Relatórios</h1>
              <p>{TITULO_RELATORIO[ativo]}</p>
            </div>
          </div>
          {/* rel-actions removido daqui — botões foram para o cabeçalho do conteúdo */}
        </header>

        <div className="rel-body">
          {/* Sidebar de navegação */}
          <nav className="rel-nav" data-print-hide>
            <div className="rel-nav-label">Relatórios</div>
            {MENU.map((item) => {
              const liberado = temAcesso(item.key);
              return (
                <button
                  key={item.key}
                  className={`rel-nav-btn ${ativo === item.key && liberado ? "active" : ""}`}
                  onClick={() => liberado && setAtivo(item.key)}
                  title={!liberado ? "Sem permissão para este relatório" : ""}
                  style={!liberado ? { opacity: 0.45, cursor: "not-allowed" } : {}}
                >
                  {liberado ? item.icon : <Lock size={15} />}
                  {item.label}
                  {!liberado && <Lock size={11} style={{ marginLeft: "auto", color: "var(--text-3)" }} />}
                </button>
              );
            })}
          </nav>

          {/* Área de conteúdo */}
          <main className="rel-content">
            {/* Cabeçalho de impressão (visível só no print) */}
            <div className="rel-print-header">
              <div>
                <h2>{TITULO_RELATORIO[ativo]}</h2>
                <p>Gerado em {new Date().toLocaleDateString("pt-BR", { dateStyle: "full" })}</p>
              </div>
              <div className="rel-print-brand">ASSENT Gestão</div>
            </div>

            {/* Filtro de período */}
            <FiltroPeriodo
              periodo={periodo}
              setPeriodo={setPeriodo}
              dataInicio={dataInicio}
              setDataInicio={setDataInicio}
              dataFim={dataFim}
              setDataFim={setDataFim}
            />

            {/* CORREÇÃO 3: Cabeçalho do relatório ativo com botões de ação juntos */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <span className="rel-section-title">
                <ChevronRight size={15} />
                {TITULO_RELATORIO[ativo]}
              </span>
              <div style={{ display: "flex", gap: 8 }} data-print-hide>
                <button className="btn-secondary" onClick={handlePrint}
                  style={{ fontSize: 12, padding: "6px 14px" }}>
                  <Printer size={13} /> Imprimir
                </button>
              </div>
            </div>

            {/* Conteúdo do relatório */}
            {renderConteudo()}
          </main>
        </div>
      </div>
    </>
  );
}
