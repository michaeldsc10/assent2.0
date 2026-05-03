/* ═══════════════════════════════════════════════════
   ASSENT v2.0 — Relatorios.jsx
   Módulo completo de Relatórios Profissionais
   ─────────────────────────────────────────────────
   DEPENDÊNCIA NECESSÁRIA:
     npm install xlsx
   ═══════════════════════════════════════════════════ */

import { useState, useEffect, useMemo, useCallback, useContext, useRef } from "react";
import * as XLSX from "xlsx";

import {
  BarChart2, TrendingUp, TrendingDown, DollarSign,
  ShoppingCart, Package, Users, Calendar, FileText,
  Download, Printer, AlertCircle, Loader2,
  ArrowUpRight, ArrowDownRight, Minus,
  ChevronRight, ChevronDown, CreditCard, Clock, Receipt, Wallet, LayoutDashboard, X,
  CheckCircle, Zap, Target, Activity, AlertTriangle, Filter, PieChart,
  Eye, EyeOff,
} from "lucide-react";

import { db } from "../lib/firebase";
import AuthContext from "../contexts/AuthContext";
import { Lock } from "lucide-react";
import { collection, onSnapshot, doc, getDoc, setDoc, query, where } from "firebase/firestore";

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
  flex: 1; min-height: 0;
  overflow: hidden;
  position: relative;
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
  flex: 1; overflow-y: auto; overflow-x: hidden;
  padding: 22px 22px 60px;
}
.rel-content > * + * { margin-top: 22px; }
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
  transition: background .18s, box-shadow .18s, transform .15s;
  position: relative;
}
.dre-row:hover {
  background: rgba(200,165,94,0.06);
  box-shadow: inset 3px 0 0 rgba(200,165,94,0.5);
  transform: translateX(2px);
  z-index: 1;
}
.dre-row-cat {
  background: linear-gradient(90deg, rgba(200,165,94,0.12) 0%, rgba(200,165,94,0.04) 60%, transparent 100%);
  font-size: 10px; font-weight: 700; letter-spacing: .12em;
  text-transform: uppercase; color: var(--gold);
  padding: 9px 18px 9px 16px;
  border-bottom: 1px solid rgba(200,165,94,0.22);
  border-left: 3px solid rgba(200,165,94,0.7);
  text-shadow: 0 0 18px rgba(200,165,94,0.35);
  box-shadow: 0 2px 8px rgba(0,0,0,0.12);
  cursor: default;
  letter-spacing: .1em;
  transform: none !important;
}
.dre-row-result {
  background: rgba(0,0,0,0.22);
  font-weight: 700;
  border-top: 1px solid var(--border-h);
  border-bottom: 2px solid rgba(200,165,94,0.3);
  font-size: 14px;
}
.dre-row-result:hover {
  background: rgba(0,0,0,0.28);
  box-shadow: inset 3px 0 0 rgba(200,165,94,0.6);
  transform: translateX(2px);
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
.dre-resultado-indicator {
  width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0;
}
.dre-resultado-banner.lucro    .dre-resultado-indicator { background: var(--green); box-shadow: 0 0 8px rgba(74,222,128,0.6); }
.dre-resultado-banner.prejuizo .dre-resultado-indicator { background: var(--red);   box-shadow: 0 0 8px rgba(224,82,82,0.6); }
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

  /* Cores de texto — evitar sobreescrever backgrounds */
  body, p, span, div, h1, h2, h3, label {
    color: #111 !important;
  }
  .dre-positivo { color: #1a7a3c !important; }
  .dre-negativo { color: #c0392b !important; }
  .val-pos { color: #1a7a3c !important; }
  .val-neg { color: #c0392b !important; }

  /* ── Gráficos: forçar visibilidade no print ── */
  .rv-charts-grid {
    display: grid !important;
    grid-template-columns: 1fr 1fr !important;
    gap: 14px !important;
    break-inside: avoid;
  }
  .rv-chart-card {
    background: #fff !important;
    border: 1px solid #ddd !important;
    break-inside: avoid;
    overflow: visible !important;
  }
  .rv-chart-card::before { display: none !important; }
  .rv-chart-header {
    border-bottom: 1px solid #eee !important;
    padding: 10px 14px !important;
  }
  .rv-chart-title { color: #111 !important; }
  .rv-chart-title-dot { box-shadow: none !important; }
  .rv-chart-body { padding: 14px !important; overflow: visible !important; }

  /* Barras dos gráficos — forçar altura e cor visível */
  .rv-kpi-row {
    display: grid !important;
    grid-template-columns: repeat(3, 1fr) !important;
    gap: 10px !important;
    break-inside: avoid;
  }
  .rv-kpi-mini {
    background: #f9f9f9 !important;
    border: 1px solid #ddd !important;
    break-inside: avoid;
    transform: none !important;
  }
  .rv-kpi-mini-accent { display: none !important; }
  .rv-kpi-mini-label { color: #666 !important; }
  .rv-kpi-mini-val { color: #111 !important; }
  .rv-kpi-mini-sub { color: #888 !important; }

  /* Container das barras verticais — altura explícita */
  .rv-bar-tooltip { display: none !important; }

  /* Barras — forçar background a imprimir (Chrome bloqueia por padrão) */
  * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    color-adjust: exact !important;
  }

  /* Formas de pagamento */
  .rv-fp-list { gap: 10px !important; }
  .rv-fp-color {
    background: #999 !important;
    print-color-adjust: exact !important;
  }
  .rv-fp-bar-bg { background: #eee !important; }
  .rv-fp-bar-fill {
    print-color-adjust: exact !important;
    -webkit-print-color-adjust: exact !important;
  }
  .rv-fp-name, .rv-fp-pct { color: #111 !important; }

  /* Top produtos */
  .rv-prod-row { border-bottom: 1px solid #eee !important; }
  .rv-prod-name, .rv-prod-val { color: #111 !important; }
  .rv-prod-qtd { color: #666 !important; }
  .rv-prod-bar-bg { background: #eee !important; }
  .rv-prod-bar-fill {
    background: #C8A55E !important;
    print-color-adjust: exact !important;
    -webkit-print-color-adjust: exact !important;
  }
  .rv-prod-rank { color: #C8A55E !important; }
  .rv-prod-rank.top { color: #996600 !important; }

  /* Barras verticais — forçar renderização no print */
  .rv-chart-body > div { overflow: visible !important; }
  .rv-chart-body [style*="position: relative"][style*="height"] {
    overflow: visible !important;
  }
  /* Forçar os elementos de barra a terem background visível */
  .rv-chart-body [style*="border-radius: 5px 5px"] {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }

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
/* Label explícito para mobile — oculto no desktop */
.rel-cell-lbl { display: none; }

/* Ocultar no print por padrão */
.rel-print-header { display: none; }

/* ══════════════════════════════════════════════════════
   MOBILE — dropdown de navegação
   ══════════════════════════════════════════════════════ */
@media (max-width: 640px) {
  /* Oculta sidebar lateral no mobile */
  .rel-nav { display: none !important; }

  /* O body vira coluna para o dropdown ficar em cima do conteúdo */
  .rel-body { flex-direction: column; }

  /* Topbar compacta */
  .rel-topbar { padding: 10px 14px; }
  .rel-topbar-title h1 { font-size: 15px; }
  .rel-content { padding: 12px 8px 80px; gap: 14px; }

  /* Tabelas: scroll horizontal no mobile */
  .rel-mobile-table-scroll {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }
  .rel-mobile-table-scroll::-webkit-scrollbar { height: 3px; }
  .rel-mobile-table-scroll::-webkit-scrollbar-thumb { background: var(--text-3); border-radius: 2px; }

  /* InlineTable mobile: card por linha */
  .rel-inline-table-head { display: none !important; }
  .rel-inline-table-row {
    display: flex !important;
    flex-direction: column !important;
    gap: 8px !important;
    padding: 14px 16px !important;
    border-bottom: 1px solid var(--border);
    grid-template-columns: unset !important;
  }
  .rel-inline-table-cell {
    display: flex !important;
    justify-content: space-between !important;
    align-items: center !important;
    font-size: 13px;
    gap: 8px;
    min-height: 24px;
  }
  /* Desabilita ::before — usamos .rel-cell-lbl explícito no JSX */
  .rel-inline-table-cell::before { content: none !important; display: none !important; }
  /* Exibe label explícito no mobile */
  .rel-cell-lbl {
    display: block !important;
    font-size: 9px; font-weight: 700;
    text-transform: uppercase; letter-spacing: .06em;
    color: var(--text-3); flex-shrink: 0;
    white-space: nowrap;
  }

  /* KPI cards: 2 colunas no mobile */
  .cr-grid {
    grid-template-columns: 1fr 1fr !important;
    gap: 10px;
  }
  .cr-value { font-size: 16px; }
  .cr-label { font-size: 9px; }
}

/* Dropdown wrapper — só visível no mobile */
.rel-mobile-nav {
  display: none;
}
@media (max-width: 640px) {
  .rel-mobile-nav {
    display: block;
    position: relative;
    z-index: 200;
    flex-shrink: 0;
    padding: 10px 14px 0;
    background: var(--s1);
    border-bottom: 1px solid var(--border);
  }
}

/* ─── DRE MOBILE ─────────────────────────────────────── */
@media (max-width: 640px) {
  /* Grid de colunas: deixa o valor/pct se ajustarem ao conteúdo */
  .dre-row {
    grid-template-columns: 1fr auto auto;
    padding: 9px 12px;
    gap: 6px;
    font-size: 12px;
  }
  .dre-row-cat { padding: 7px 12px 7px 10px; }
  .dre-val { font-size: 12px; }
  .dre-pct { font-size: 10px; min-width: 36px; }

  /* Banner resultado: empilha no mobile */
  .dre-resultado-banner {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
    padding: 14px 16px;
  }
  .dre-resultado-valor { font-size: 18px; }

  /* tr-wrap: troca overflow hidden por clip seguro no mobile */
  .tr-wrap { overflow: clip; overflow-clip-margin: 0; }

  /* Padding extra para conteúdo não ficar atrás da bottom nav */
  .rel-content { padding-bottom: 100px !important; }
}

/* Botão gatilho do dropdown */
.rel-mobile-trigger {
  width: 100%;
  display: flex; align-items: center; gap: 10px;
  padding: 10px 14px;
  background: var(--s2);
  border: 1px solid var(--border-h);
  border-radius: 10px;
  cursor: pointer;
  font-family: 'DM Sans', sans-serif;
  font-size: 13px; font-weight: 600;
  color: var(--text);
  transition: border-color .15s, background .15s;
  margin-bottom: 10px;
}
.rel-mobile-trigger:hover { background: var(--s3); }
.rel-mobile-trigger-icon {
  width: 28px; height: 28px; border-radius: 7px;
  display: flex; align-items: center; justify-content: center;
  background: rgba(200,165,94,0.15); color: var(--gold);
  flex-shrink: 0;
}
.rel-mobile-trigger-label { flex: 1; text-align: left; }
.rel-mobile-trigger-chevron {
  color: var(--text-3); transition: transform .2s ease;
  flex-shrink: 0;
}
.rel-mobile-trigger-chevron.open { transform: rotate(180deg); }

/* Painel dropdown */
.rel-mobile-dropdown {
  position: absolute;
  top: calc(100% - 2px);
  left: 14px; right: 14px;
  background: var(--s1);
  border: 1px solid var(--border-h);
  border-radius: 12px;
  box-shadow: 0 16px 48px rgba(0,0,0,0.55);
  overflow: hidden;
  animation: rel-dd-in .15s ease;
  z-index: 300;
}
@keyframes rel-dd-in {
  from { opacity: 0; transform: translateY(-6px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* Header do dropdown */
.rel-mobile-dd-head {
  padding: 10px 14px 8px;
  border-bottom: 1px solid var(--border);
  display: flex; align-items: center; justify-content: space-between;
}
.rel-mobile-dd-title {
  font-size: 9px; font-weight: 700; letter-spacing: .1em;
  text-transform: uppercase; color: var(--text-3);
}

/* Lista de itens */
.rel-mobile-dd-list {
  max-height: 60vh;
  overflow-y: auto;
  padding: 6px;
}
.rel-mobile-dd-list::-webkit-scrollbar { width: 3px; }
.rel-mobile-dd-list::-webkit-scrollbar-thumb { background: var(--text-3); border-radius: 2px; }

/* Item individual */
.rel-mobile-dd-item {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 10px;
  border-radius: 8px;
  background: transparent; border: none;
  width: 100%; text-align: left;
  cursor: pointer;
  font-family: 'DM Sans', sans-serif;
  font-size: 13px; font-weight: 500;
  color: var(--text-2);
  transition: background .12s, color .12s;
}
.rel-mobile-dd-item:hover { background: var(--s2); color: var(--text); }
.rel-mobile-dd-item.active {
  background: rgba(200,165,94,0.12);
  color: var(--gold);
}
.rel-mobile-dd-item.active .rel-mobile-dd-item-dot {
  background: var(--gold);
  box-shadow: 0 0 6px rgba(200,165,94,0.5);
}
.rel-mobile-dd-item-dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--border-h); flex-shrink: 0;
  transition: background .12s;
}
.rel-mobile-dd-item-text { flex: 1; }
.rel-mobile-dd-item-lock {
  color: var(--text-3); flex-shrink: 0;
}

/* ══════════════════════════════════════════════════════
   CSS — RELATÓRIO DE COMPRAS & CONTAS A RECEBER
   ══════════════════════════════════════════════════════ */

/* ── KPI Cards ── */
.rcr-kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(195px, 1fr));
  gap: 14px;
}
.rcr-kpi {
  background: var(--s1);
  border: 1px solid var(--border);
  border-radius: 13px;
  padding: 17px 18px;
  position: relative;
  overflow: hidden;
  transition: border-color .18s, transform .15s;
}
.rcr-kpi:hover { border-color: var(--border-h); transform: translateY(-1px); }
.rcr-kpi::before {
  content: '';
  position: absolute; top: 0; left: 0; right: 0; height: 2px;
  opacity: 0; transition: opacity .2s;
}
.rcr-kpi:hover::before { opacity: 1; }
.rcr-kpi.gold::before  { background: linear-gradient(90deg, var(--gold), transparent); }
.rcr-kpi.green::before { background: linear-gradient(90deg, var(--green), transparent); }
.rcr-kpi.red::before   { background: linear-gradient(90deg, var(--red), transparent); }
.rcr-kpi.blue::before  { background: linear-gradient(90deg, var(--blue, #5b8ef0), transparent); }
.rcr-kpi-icon { width: 36px; height: 36px; border-radius: 9px; display: flex; align-items: center; justify-content: center; margin-bottom: 12px; }
.rcr-kpi-icon.gold  { background: rgba(200,165,94,0.14);  color: var(--gold);  }
.rcr-kpi-icon.green { background: rgba(72,199,142,0.14);  color: var(--green); }
.rcr-kpi-icon.red   { background: rgba(224,82,82,0.14);   color: var(--red);   }
.rcr-kpi-icon.blue  { background: rgba(91,142,240,0.14);  color: var(--blue, #5b8ef0); }
.rcr-kpi-label { font-size: 9.5px; font-weight: 600; text-transform: uppercase; letter-spacing: .08em; color: var(--text-3); margin-bottom: 5px; }
.rcr-kpi-val { font-family: 'Sora', sans-serif; font-size: 20px; font-weight: 700; color: var(--text); line-height: 1.1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-bottom: 6px; }
.rcr-kpi-val.gold  { color: var(--gold);  }
.rcr-kpi-val.green { color: var(--green); }
.rcr-kpi-val.red   { color: var(--red);   }
.rcr-kpi-trend { display: flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 500; }
.rcr-kpi-trend.up   { color: var(--green); }
.rcr-kpi-trend.down { color: var(--red);   }
.rcr-kpi-trend.neu  { color: var(--text-3); }
.rcr-kpi-sub { font-size: 11px; color: var(--text-3); }
.rcr-kpi-clickable { user-select: none; }
.rcr-kpi-clickable:hover { border-color: var(--gold); }
.rcr-kpi-active { border-color: var(--gold) !important; box-shadow: 0 0 0 2px rgba(200,165,94,0.18); }
.rcr-kpi-active::before { opacity: 1 !important; }
.rcr-kpi-active.green { border-color: var(--green) !important; box-shadow: 0 0 0 2px rgba(72,199,142,0.18); }
.rcr-kpi-active.red   { border-color: var(--red)   !important; box-shadow: 0 0 0 2px rgba(224,82,82,0.18); }
.rcr-kpi-active.blue  { border-color: var(--blue, #5b8ef0) !important; box-shadow: 0 0 0 2px rgba(91,142,240,0.18); }

/* ── Charts ── */
.rcr-charts-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.rcr-charts-grid.trio { grid-template-columns: 2fr 1fr; }
@media (max-width: 900px) { .rcr-charts-grid, .rcr-charts-grid.trio { grid-template-columns: 1fr; } }
.rcr-chart-card { background: var(--s1); border: 1px solid var(--border); border-radius: 13px; overflow: hidden; }
.rcr-chart-header { padding: 13px 18px; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; }
.rcr-chart-title { font-family: 'Sora', sans-serif; font-size: 13px; font-weight: 600; color: var(--text); display: flex; align-items: center; gap: 7px; }
.rcr-chart-title-dot { width: 6px; height: 6px; border-radius: 50%; box-shadow: 0 0 6px currentColor; }
.rcr-chart-badge { font-size: 10px; font-weight: 600; background: var(--s3); border: 1px solid var(--border-h); color: var(--text-2); padding: 2px 9px; border-radius: 20px; }
.rcr-chart-body { padding: 18px; overflow: hidden; }

/* ── Bar chart ── */
.rcr-bar-chart { display: flex; align-items: flex-end; gap: 6px; padding-bottom: 28px; position: relative; }
.rcr-bar-col { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 3px; position: relative; }
.rcr-bar { width: 100%; border-radius: 4px 4px 0 0; min-height: 3px; transition: opacity .15s; position: relative; cursor: pointer; }
.rcr-bar:hover { opacity: .8; }
.rcr-bar-tooltip { position: absolute; bottom: calc(100% + 5px); left: 50%; transform: translateX(-50%); background: var(--s0, #0e0e0e); border: 1px solid var(--border-h); color: var(--text); font-size: 10px; font-weight: 600; padding: 3px 8px; border-radius: 5px; white-space: nowrap; pointer-events: none; opacity: 0; transition: opacity .15s; z-index: 10; }
.rcr-bar:hover .rcr-bar-tooltip { opacity: 1; }
.rcr-bar-label { font-size: 8.5px; color: var(--text-3); text-align: center; position: absolute; bottom: -22px; width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

/* ── Ranking bars ── */
.rcr-rank-list { display: flex; flex-direction: column; }
.rcr-rank-item { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--border); }
.rcr-rank-item:last-child { border-bottom: none; }
.rcr-rank-pos { font-family: 'Sora', sans-serif; font-size: 11px; font-weight: 700; color: var(--gold); width: 18px; flex-shrink: 0; text-align: center; }
.rcr-rank-info { flex: 1; min-width: 0; }
.rcr-rank-name { font-size: 13px; color: var(--text); font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rcr-rank-sub { font-size: 10px; color: var(--text-3); margin-top: 1px; }
.rcr-rank-bar-wrap { width: 100px; flex-shrink: 0; }
.rcr-rank-bar-bg { height: 4px; border-radius: 2px; background: var(--s3); overflow: hidden; }
.rcr-rank-bar-fill { height: 100%; border-radius: 2px; transition: width .5s ease; }
.rcr-rank-val { font-family: 'Sora', sans-serif; font-size: 12px; font-weight: 600; color: var(--text); min-width: 95px; text-align: right; }

/* ── Donut ── */
.rcr-donut-wrap { display: flex; align-items: center; gap: 20px; padding: 4px 0; }
.rcr-donut-legend { flex: 1; display: flex; flex-direction: column; gap: 8px; }
.rcr-donut-leg-item { display: flex; align-items: center; gap: 8px; font-size: 12px; }
.rcr-donut-leg-dot { width: 8px; height: 8px; border-radius: 2px; flex-shrink: 0; }
.rcr-donut-leg-name { flex: 1; color: var(--text); }
.rcr-donut-leg-pct { font-family: 'Sora', sans-serif; font-size: 11px; font-weight: 600; color: var(--text-2); }

/* ── Insights ── */
.rcr-insights { display: flex; flex-direction: column; gap: 10px; }
.rcr-insight { display: flex; align-items: flex-start; gap: 12px; padding: 13px 16px; border-radius: 10px; border: 1px solid transparent; font-size: 12px; line-height: 1.55; }
.rcr-insight.warn   { background: rgba(200,165,94,0.07);  border-color: rgba(200,165,94,0.22); color: var(--text-2); }
.rcr-insight.danger { background: rgba(224,82,82,0.06);   border-color: rgba(224,82,82,0.2);   color: var(--text-2); }
.rcr-insight.good   { background: rgba(72,199,142,0.06);  border-color: rgba(72,199,142,0.2);  color: var(--text-2); }
.rcr-insight.info   { background: rgba(91,142,240,0.06);  border-color: rgba(91,142,240,0.2);  color: var(--text-2); }
.rcr-insight-icon { flex-shrink: 0; margin-top: 1px; }
.rcr-insight-text strong { color: var(--text); }

/* ── Fluxo de caixa ── */
.rcr-cashflow { display: flex; flex-direction: column; gap: 6px; }
.rcr-cf-row { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 8px; background: var(--s2); font-size: 12px; transition: background .13s; }
.rcr-cf-row:hover { background: var(--s3); }
.rcr-cf-date { font-weight: 600; color: var(--text); min-width: 80px; }
.rcr-cf-desc { flex: 1; color: var(--text-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rcr-cf-val  { font-family: 'Sora', sans-serif; font-weight: 600; white-space: nowrap; }
.rcr-cf-val.pendente { color: var(--gold); }
.rcr-cf-val.vencido  { color: var(--red);  }

/* ── Status badges ── */
.rcr-badge { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 20px; font-size: 9.5px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; white-space: nowrap; }
.rcr-badge.pago      { background: rgba(72,199,142,0.12); border: 1px solid rgba(72,199,142,.25); color: var(--green); }
.rcr-badge.pendente  { background: rgba(200,165,94,0.12); border: 1px solid rgba(200,165,94,.3);  color: var(--gold);  }
.rcr-badge.vencido   { background: rgba(224,82,82,0.10);  border: 1px solid rgba(224,82,82,.25);  color: var(--red);   }
.rcr-badge.cancelado { background: var(--s3); border: 1px solid var(--border); color: var(--text-3); }

/* ── Misc ── */
.rcr-section-title { font-family: 'Sora', sans-serif; font-size: 14px; font-weight: 600; color: var(--text); display: flex; align-items: center; gap: 8px; }
.rcr-section-title svg { color: var(--gold); }
.rcr-filters { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.rcr-filter-btn { padding: 5px 12px; border-radius: 6px; font-size: 11px; font-weight: 500; background: var(--s3); border: 1px solid var(--border); color: var(--text-2); cursor: pointer; font-family: 'DM Sans', sans-serif; transition: all .13s; }
.rcr-filter-btn:hover { background: var(--s2); color: var(--text); }
.rcr-filter-btn.active { background: rgba(200,165,94,0.15); border-color: var(--gold); color: var(--gold); }
.rcr-filter-label { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: .07em; color: var(--text-3); }
.rcr-highlight-row { display: flex; align-items: center; justify-content: space-between; padding: 11px 15px; background: var(--s2); border-radius: 9px; font-size: 12px; color: var(--text-2); }
.rcr-highlight-row strong { color: var(--text); }
.rcr-highlight-row .val { font-family: 'Sora', sans-serif; font-size: 14px; font-weight: 700; color: var(--gold); }
.rcr-table-wrap { background: var(--s1); border: 1px solid var(--border); border-radius: 13px; overflow: hidden; }
.rcr-table-header { padding: 13px 18px; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; }
.rcr-table-title { font-family: 'Sora', sans-serif; font-size: 13px; font-weight: 600; color: var(--text); }
.rcr-table-badge { font-size: 11px; font-weight: 600; background: var(--s3); border: 1px solid var(--border-h); color: var(--text-2); padding: 2px 10px; border-radius: 20px; }
.rcr-row { display: grid; gap: 8px; padding: 10px 18px; border-bottom: 1px solid var(--border); font-size: 12px; color: var(--text-2); align-items: center; transition: background .1s; }
.rcr-row:last-child { border-bottom: none; }
.rcr-row:hover { background: rgba(255,255,255,0.02); }
.rcr-row-head { background: var(--s2); font-size: 9px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; color: var(--text-3); }
.rcr-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px 20px; gap: 10px; color: var(--text-3); text-align: center; font-size: 13px; }

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

/* ── View Toggle: Lista / Gráficos ── */
.rv-view-toggle {
  display: flex; gap: 4px;
  background: var(--s2); border: 1px solid var(--border);
  border-radius: 10px; padding: 4px; width: fit-content;
}
.rv-view-btn {
  display: flex; align-items: center; gap: 6px;
  padding: 7px 18px; border-radius: 7px;
  font-size: 13px; font-weight: 500;
  background: transparent; border: none; cursor: pointer;
  font-family: 'DM Sans', sans-serif; color: var(--text-2);
  transition: all .13s;
}
.rv-view-btn:hover { color: var(--text); }
.rv-view-btn.active {
  background: var(--s1); color: var(--text);
  border: 1px solid var(--border-h);
  box-shadow: 0 1px 4px rgba(0,0,0,0.18);
}
.rv-view-btn.active svg { color: var(--gold); }

/* ── Charts Container ── */
.rv-charts-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
@media (max-width: 780px) {
  .rv-charts-grid { grid-template-columns: 1fr; }
}
.rv-chart-card {
  background: var(--s1); border: 1px solid var(--border);
  border-radius: 14px; overflow: hidden;
  position: relative;
}
.rv-chart-card::before {
  content: ''; position: absolute; inset: 0; border-radius: 14px;
  background: linear-gradient(135deg, rgba(200,165,94,0.04) 0%, transparent 60%);
  pointer-events: none;
}
.rv-chart-card.full { grid-column: 1 / -1; }
.rv-chart-header {
  padding: 14px 20px; border-bottom: 1px solid var(--border);
  display: flex; align-items: center; justify-content: space-between;
}
.rv-chart-title {
  font-family: 'Sora', sans-serif; font-size: 12px;
  font-weight: 600; color: var(--text);
  display: flex; align-items: center; gap: 8px;
  text-transform: uppercase; letter-spacing: .04em;
}
.rv-chart-title-dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--gold); flex-shrink: 0;
  box-shadow: 0 0 8px var(--gold);
}
.rv-chart-body { padding: 20px; }

/* Gráfico de barras SVG */
.rv-bar-chart { width: 100%; overflow: visible; display: block; }

/* Formas de pagamento */
.rv-fp-list { display: flex; flex-direction: column; gap: 13px; }
.rv-fp-item { display: flex; align-items: center; gap: 12px; }
.rv-fp-color { width: 3px; height: 26px; border-radius: 2px; flex-shrink: 0; }
.rv-fp-name { flex: 1; font-size: 13px; color: var(--text-2); font-weight: 500; }
.rv-fp-bar-bg {
  width: 120px; height: 4px; border-radius: 4px;
  background: rgba(255,255,255,0.06); overflow: hidden; flex-shrink: 0;
}
.rv-fp-bar-fill { height: 100%; border-radius: 4px; transition: width .6s cubic-bezier(.25,.8,.25,1); }
.rv-fp-pct {
  font-family: 'Sora', sans-serif; font-size: 12px;
  font-weight: 700; color: var(--text); min-width: 40px; text-align: right;
}

/* KPI mini cards — premium */
.rv-kpi-row {
  display: grid; grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}
.rv-kpi-mini {
  position: relative; overflow: hidden;
  background: var(--s1); border: 1px solid var(--border);
  border-radius: 14px; padding: 18px 20px;
  transition: border-color .2s, transform .2s;
}
.rv-kpi-mini:hover { border-color: rgba(200,165,94,0.3); transform: translateY(-1px); }
.rv-kpi-mini-accent {
  position: absolute; top: 0; left: 0; right: 0; height: 2px;
  border-radius: 14px 14px 0 0;
}
.rv-kpi-mini-label {
  font-size: 10px; font-weight: 600; text-transform: uppercase;
  letter-spacing: .08em; color: var(--text-3); margin-bottom: 8px;
}
.rv-kpi-mini-val {
  font-family: 'Sora', sans-serif; font-size: 19px;
  font-weight: 700; color: var(--text); line-height: 1;
  margin-bottom: 5px;
}
.rv-kpi-mini-sub { font-size: 11px; color: var(--text-3); margin-top: 4px; }

/* ── Bar chart premium tooltip ── */
.rv-bar-tooltip {
  position: absolute;
  background: rgba(10,10,14,0.95);
  border: 1px solid rgba(200,165,94,0.35);
  border-radius: 10px; padding: 8px 14px;
  font-size: 12px; font-family: 'DM Sans', sans-serif;
  color: var(--text); white-space: nowrap;
  box-shadow: 0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(200,165,94,0.1);
  pointer-events: none; z-index: 30;
  transform: translateX(-50%) translateY(-100%);
  margin-top: -10px;
}

/* ── Top produtos premium ── */
.rv-prod-row {
  display: flex; align-items: center; gap: 14px;
  padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.04);
}
.rv-prod-row:last-child { border-bottom: none; }
.rv-prod-rank {
  font-family: 'Sora', sans-serif; font-size: 10px; font-weight: 700;
  color: rgba(200,165,94,0.5); width: 22px; flex-shrink: 0; text-align: center;
}
.rv-prod-rank.top { color: var(--gold); }
.rv-prod-name {
  width: 170px; flex-shrink: 0;
  font-size: 13px; color: var(--text); font-weight: 500;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.rv-prod-bar-bg {
  flex: 1; height: 5px; border-radius: 5px;
  background: rgba(255,255,255,0.05); overflow: hidden;
}
.rv-prod-bar-fill {
  height: 100%; border-radius: 5px;
  background: linear-gradient(90deg, rgba(200,165,94,0.9), rgba(200,165,94,0.3));
  transition: width .7s cubic-bezier(.25,.8,.25,1);
}
.rv-prod-val {
  font-family: 'Sora', sans-serif; font-size: 12px; font-weight: 700;
  color: var(--text); min-width: 96px; text-align: right;
}
.rv-prod-qtd {
  font-size: 11px; color: var(--text-3);
  min-width: 44px; text-align: right;
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

/* ══════════════════════════════════════════════════════
   HOOK & COMPONENTE: ordenação de tabelas
   ══════════════════════════════════════════════════════ */
function useSort(data, defaultKey = null, defaultDir = "desc") {
  const [sortKey, setSortKey] = useState(defaultKey);
  const [sortDir, setSortDir] = useState(defaultDir);

  const handleSort = useCallback((key) => {
    if (sortKey === key) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }, [sortKey]);

  const sorted = useMemo(() => {
    if (!sortKey || !data?.length) return data || [];
    return [...data].sort((a, b) => {
      const va = a[sortKey];
      const vb = b[sortKey];
      // Detecta data
      const tryDate = (v) => {
        if (!v) return null;
        const s = String(v);
        if (/^\d{4}-\d{2}-\d{2}/.test(s)) return new Date(s);
        if (/^\d{2}\/\d{2}\/\d{4}/.test(s)) {
          const [d, m, y] = s.split("/");
          return new Date(`${y}-${m}-${d}`);
        }
        return null;
      };
      const da = tryDate(va), db = tryDate(vb);
      if (da && db) return sortDir === "asc" ? da - db : db - da;
      // Numero
      const na = parseFloat(String(va ?? "").replace(/[^\d.,-]/g, "").replace(",", "."));
      const nb = parseFloat(String(vb ?? "").replace(/[^\d.,-]/g, "").replace(",", "."));
      if (!isNaN(na) && !isNaN(nb)) return sortDir === "asc" ? na - nb : nb - na;
      // String
      const sa = String(va ?? "").toLowerCase();
      const sb = String(vb ?? "").toLowerCase();
      return sortDir === "asc" ? sa.localeCompare(sb, "pt-BR") : sb.localeCompare(sa, "pt-BR");
    });
  }, [data, sortKey, sortDir]);

  return { sorted, sortKey, sortDir, handleSort };
}

function SortTh({ label, sortKey: sk, currentKey, currentDir, onSort, align = "left", children }) {
  const active = currentKey === sk;
  return (
    <span
      onClick={() => onSort(sk)}
      style={{
        cursor: "pointer", userSelect: "none",
        display: "inline-flex", alignItems: "center", gap: 4,
        justifyContent: align === "right" ? "flex-end" : "flex-start",
        color: active ? "var(--gold)" : "inherit",
        transition: "color .15s",
      }}
      title={`Ordenar por ${label}`}
    >
      {children || label}
      <span style={{
        display: "inline-flex", flexDirection: "column",
        gap: 1.5, opacity: active ? 1 : 0.3, lineHeight: 1, flexShrink: 0,
      }}>
        <svg width="6" height="4" viewBox="0 0 6 4" fill="none">
          <path d="M3 0L6 4H0L3 0Z" fill={active && currentDir === "asc" ? "var(--gold)" : "currentColor"} />
        </svg>
        <svg width="6" height="4" viewBox="0 0 6 4" fill="none">
          <path d="M3 4L0 0H6L3 4Z" fill={active && currentDir === "desc" ? "var(--gold)" : "currentColor"} />
        </svg>
      </span>
    </span>
  );
}

function RelatorioDRE({ vendas, despesas, caixa = [], vendedores = [], intervalo, uid }) {
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

    /* ══════════════════════════════════════════════════════════════════
       COMISSÕES DE VENDEDORES
       Mesma fórmula do Vendedores.jsx: (total - custoTotal) × (% / 100)
       Aplicada sobre todas as vendas que compõem a receita do período.
    ═══════════════════════════════════════════════════════════════════ */
    const vendedoresMap = Object.fromEntries(vendedores.map((v) => [v.id, v]));

    /* Comissão por vendedor — para exibição detalhada */
    const comissaoPorVendedor = {};
    let totalComissoes = 0;

    todasVendasReceita.forEach((v) => {
      if (!v.vendedorId) return;
      const vendedor = vendedoresMap[v.vendedorId];
      if (!vendedor || vendedor.comissao == null || vendedor.comissao <= 0) return;

      const itens = v.itens || [];
      const total = Number(v.total || 0);
      const custoTotal = itens.reduce((s, it) => s + Number(it.custo || 0) * Number(it.qtd || it.quantidade || 1), 0);
      const lucro = total - custoTotal;
      const comissao = lucro > 0 ? lucro * (vendedor.comissao / 100) : 0;

      if (!comissaoPorVendedor[vendedor.id]) {
        comissaoPorVendedor[vendedor.id] = { nome: vendedor.nome, pct: vendedor.comissao, valor: 0 };
      }
      comissaoPorVendedor[vendedor.id].valor += comissao;
      totalComissoes += comissao;
    });

    const lucroBruto    = receitaLiquida;
    const totalDespesas = dFiltradas.reduce((s, d) => s + Number(d.valor || 0), 0);
    const lucroLiquido  = lucroBruto - totalDespesas - totalComissoes;
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
      totalDespesas, totalComissoes, comissaoPorVendedor,
      lucroLiquido, margem,
      qtdeVendas: todasVendasReceita.length,
      porCategoria,
      /* informativo */
      _entradaNovasCaixa: caixaVendas.length,
      _vendasLegadas: vendasLegadas.length,
    };
  }, [vendas, despesas, caixa, vendedores, intervalo, calcularTaxaFallback]);

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
        ...(dados.totalComissoes > 0
          ? [
              ["(-) Comissões de Vendedores", `-${dados.totalComissoes.toFixed(2)}`, pct(dados.totalComissoes)],
              ...Object.values(dados.comissaoPorVendedor).map((c) => [`  · ${c.nome} (${c.pct}%)`, `-${c.valor.toFixed(2)}`, pct(c.valor)]),
            ]
          : []),
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
        {dados.totalComissoes > 0 && (
          <CardResumo
            icon={<Users size={18} />}
            label="Comissões"
            value={fmtR$(dados.totalComissoes)}
            sub={`${Object.keys(dados.comissaoPorVendedor).length} vendedor(es)`}
            trend="down"
            colorVar="var(--gold)"
          />
        )}
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
              Regime de Caixa
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

        {/* Comissões de Vendedores */}
        {dados.totalComissoes > 0 && (
          <>
            <div className="dre-row dre-row-cat">COMISSÕES DE VENDEDORES</div>
            {Object.values(dados.comissaoPorVendedor)
              .sort((a, b) => b.valor - a.valor)
              .map((c) => (
                <div key={c.nome} className="dre-row">
                  <span className="dre-sub-label">(-) {c.nome}
                    <span style={{ fontSize: 10, color: "var(--text-3)", marginLeft: 6 }}>
                      {c.pct}% s/ lucro
                    </span>
                  </span>
                  <span className="dre-val dre-negativo">- {fmtR$(c.valor)}</span>
                  <span className="dre-pct">{pct(c.valor)}</span>
                </div>
              ))
            }
          </>
        )}

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
              <span className="dre-resultado-indicator" />
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
  const { sorted: finOrdenado, sortKey: finSK, sortDir: finSD, handleSort: finSort } = useSort(transacoesFiltradas, 'data', 'desc');

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
            {" "}· {finOrdenado.length} registro{finOrdenado.length !== 1 ? "s" : ""}
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
          <span className="ext-badge">{finOrdenado.length}</span>
        </div>

        {transacoesFiltradas.length === 0 ? (
          <div className="ext-empty">Nenhuma movimentação no período.</div>
        ) : (
          <>
            {/* Cabeçalho */}
            <div className="ext-row ext-row-head">
              <SortTh label="Data" sortKey="data" currentKey={finSK} currentDir={finSD} onSort={finSort}>Data</SortTh>
              <SortTh label="Descrição" sortKey="descricao" currentKey={finSK} currentDir={finSD} onSort={finSort}>Descrição</SortTh>
              <span className="ext-col-entrada" style={{ textAlign: "right" }}>Entrada</span>
              <span className="ext-col-saida"   style={{ textAlign: "right" }}>Saída</span>
              <span style={{ textAlign: "right" }}>Saldo</span>
            </div>

            {/* Linhas */}
            {finOrdenado.map((t) => (
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
/* ── Badge visual de status para uso no relatório de despesas ── */
function StatusBadgeRel({ status }) {
  const cfg = {
    pago:     { label: "Pago",     bg: "rgba(74,186,130,.13)",  color: "var(--green)", icon: "✓" },
    pendente: { label: "Pendente", bg: "rgba(200,165,94,.12)",  color: "var(--gold)",  icon: "○" },
    vencido:  { label: "Vencido",  bg: "rgba(224,82,82,.12)",   color: "var(--red)",   icon: "!" },
    cancelado:{ label: "Cancelado",bg: "rgba(120,120,120,.12)", color: "var(--text-3)",icon: "–" },
  }[status] || { label: status || "—", bg: "var(--s3)", color: "var(--text-3)", icon: "·" };

  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "2px 8px", borderRadius: 5,
      background: cfg.bg, color: cfg.color,
      fontSize: 10, fontWeight: 700, letterSpacing: ".05em",
      textTransform: "uppercase", whiteSpace: "nowrap",
    }}>
      <span style={{ fontSize: 11, lineHeight: 1 }}>{cfg.icon}</span>
      {cfg.label}
    </span>
  );
}

function RelatorioDespesas({ despesas, intervalo }) {
  const [filtroStatus, setFiltroStatus] = useState("todas");

  const dados = useMemo(() => {
    const dataRefDespesa = (d) =>
      d.status === "pago"
        ? (d.dataPagamentoTs || d.dataPagamento || d.vencimento)
        : d.vencimento;

    const hoje = new Date(); hoje.setHours(0,0,0,0);

    // Todas dentro do período — enriquece status vencido
    const noPeriodo = despesas
      .filter((d) => dentroDoIntervalo(dataRefDespesa(d), intervalo))
      .map((d) => {
        const statusEfetivo =
          d.status === "pago" ? "pago" :
          d.status === "cancelado" ? "cancelado" :
          d.vencimento && parseDate(d.vencimento) < hoje ? "vencido" :
          "pendente";
        return { ...d, statusEfetivo };
      })
      .sort((a, b) => {
        const da  = parseDate(dataRefDespesa(a));
        const db2 = parseDate(dataRefDespesa(b));
        return (db2 || 0) - (da || 0);
      });

    const totalGeral   = noPeriodo.reduce((s, d) => s + Number(d.valor || 0), 0);
    const totalPago    = noPeriodo.filter(d => d.statusEfetivo === "pago")    .reduce((s, d) => s + Number(d.valor || 0), 0);
    const totalPendente= noPeriodo.filter(d => d.statusEfetivo === "pendente").reduce((s, d) => s + Number(d.valor || 0), 0);
    const totalVencido = noPeriodo.filter(d => d.statusEfetivo === "vencido") .reduce((s, d) => s + Number(d.valor || 0), 0);
    const qtdPago      = noPeriodo.filter(d => d.statusEfetivo === "pago").length;
    const qtdPendente  = noPeriodo.filter(d => d.statusEfetivo === "pendente").length;
    const qtdVencido   = noPeriodo.filter(d => d.statusEfetivo === "vencido").length;

    // Aplica filtro de status
    const filtradas = filtroStatus === "todas"
      ? noPeriodo
      : noPeriodo.filter(d => d.statusEfetivo === filtroStatus);

    const porCategoria = {};
    filtradas.forEach((d) => {
      const cat = d.categoria || "Sem categoria";
      porCategoria[cat] = (porCategoria[cat] || 0) + Number(d.valor || 0);
    });

    const ranking = Object.entries(porCategoria)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, val]) => ({ cat, val }));

    const maxVal = ranking[0]?.val || 1;

    return {
      filtradas, noPeriodo,
      totalGeral, totalPago, totalPendente, totalVencido,
      qtdPago, qtdPendente, qtdVencido,
      ranking, maxVal,
    };
  }, [despesas, intervalo, filtroStatus]);

  const handleExport = () => {
    exportarExcel("despesas", [{
      nome: "Despesas",
      colunas: ["Data Referência", "Vencimento", "Descrição", "Categoria", "Status", "Valor (R$)"],
      dados: dados.filtradas.map((d) => [
        fmtData(d.status === "pago" && d.dataPagamento ? d.dataPagamento : d.vencimento),
        fmtData(d.vencimento),
        d.descricao || "—",
        d.categoria || "—",
        d.statusEfetivo || d.status || "—",
        Number(d.valor || 0).toFixed(2),
      ]),
    }]);
  };

  const FILTROS_STATUS = [
    { value: "todas",    label: "Todas",    cor: "var(--text-2)" },
    { value: "pago",     label: "Pagas",    cor: "var(--green)"  },
    { value: "pendente", label: "Pendentes",cor: "var(--gold)"   },
    { value: "vencido",  label: "Vencidas", cor: "var(--red)"    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* ── KPIs ── */}
      <div className="cr-grid">
        <CardResumo
          icon={<Receipt size={18} />}
          label="Total no Período"
          value={fmtR$(dados.totalGeral)}
          sub={`${dados.noPeriodo.length} registros`}
          trend="down" colorVar="var(--red)"
        />
        <CardResumo
          icon={<CheckCircle size={18} />}
          label="Total Pago"
          value={fmtR$(dados.totalPago)}
          sub={`${dados.qtdPago} despesa${dados.qtdPago !== 1 ? "s" : ""} quitada${dados.qtdPago !== 1 ? "s" : ""}`}
          trend="neutral" colorVar="var(--green)"
        />
        <CardResumo
          icon={<Clock size={18} />}
          label="A Pagar"
          value={fmtR$(dados.totalPendente)}
          sub={`${dados.qtdPendente} pendente${dados.qtdPendente !== 1 ? "s" : ""}`}
          trend="neutral" colorVar="var(--gold)"
        />
        <CardResumo
          icon={<AlertCircle size={18} />}
          label="Vencidas"
          value={fmtR$(dados.totalVencido)}
          sub={`${dados.qtdVencido} em atraso`}
          trend={dados.qtdVencido > 0 ? "down" : "neutral"} colorVar="var(--red)"
        />
      </div>

      {/* ── Filtro de status ── */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
        padding: "10px 14px",
        background: "var(--s1)", border: "1px solid var(--border)",
        borderRadius: 10,
      }}>
        <span style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".07em", color: "var(--text-3)", marginRight: 4 }}>
          <Filter size={11} style={{ verticalAlign: "middle", marginRight: 4 }} />
          Filtrar:
        </span>
        {FILTROS_STATUS.map(f => {
          const ativo = filtroStatus === f.value;
          return (
            <button
              key={f.value}
              onClick={() => setFiltroStatus(f.value)}
              style={{
                padding: "4px 13px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                fontFamily: "'DM Sans', sans-serif", cursor: "pointer",
                transition: "all .13s",
                background: ativo ? (f.value === "todas" ? "rgba(200,165,94,.15)" : `${f.cor}18`) : "var(--s3)",
                border: `1px solid ${ativo ? f.cor : "var(--border)"}`,
                color: ativo ? f.cor : "var(--text-2)",
              }}
            >
              {f.label}
              {f.value !== "todas" && (
                <span style={{
                  marginLeft: 5, fontSize: 9, fontWeight: 700,
                  background: ativo ? f.cor : "var(--s2)",
                  color: ativo ? "#0a0808" : "var(--text-3)",
                  padding: "1px 5px", borderRadius: 20,
                }}>
                  {f.value === "pago" ? dados.qtdPago :
                   f.value === "pendente" ? dados.qtdPendente :
                   dados.qtdVencido}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Ranking por categoria (baseado nas filtradas) ── */}
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

      {/* ── Tabela de lançamentos ── */}
      <TabelaRelatorio
        title="Lançamentos de Despesas"
        count={dados.filtradas.length}
        empty="Nenhuma despesa encontrada para o filtro selecionado."
        data={dados.filtradas}
        columns={[
          {
            key: "statusEfetivo",
            label: "Status",
            render: (v) => <StatusBadgeRel status={v} />,
          },
          {
            key: "dataPagamento",
            label: "Data Ref.",
            render: (v, row) => {
              const isPago  = row.statusEfetivo === "pago";
              const dataRef = isPago && v ? v : row.vencimento;
              return (
                <span title={isPago ? "Pago em" : "Vence em"}
                  style={{ color: isPago ? "var(--green)" : "var(--text-2)", fontSize: 12 }}>
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
              const dias  = getDiasRestantes(v);
              const color = row.statusEfetivo === "pago"
                ? "var(--text-3)"
                : dias !== null && dias < 0
                ? "var(--red)"
                : dias !== null && dias <= 3
                ? "var(--gold)"
                : "var(--text-2)";
              return <span style={{ color }}>{fmtData(v)}</span>;
            },
          },
          {
            key: "descricao",
            label: "Descrição",
            render: (v, row) => (
              <span style={{
                display: "flex", alignItems: "center", gap: 6,
                fontWeight: row.statusEfetivo === "pago" ? 400 : 500,
                color: row.statusEfetivo === "pago" ? "var(--text-3)" : "var(--text)",
                textDecoration: row.statusEfetivo === "cancelado" ? "line-through" : "none",
              }}>
                {row.statusEfetivo === "pago" && (
                  <CheckCircle size={12} style={{ color: "var(--green)", flexShrink: 0 }} />
                )}
                {v || "—"}
              </span>
            ),
          },
          { key: "categoria", label: "Categoria" },
          {
            key: "valor", label: "Valor", align: "right",
            render: (v, row) => (
              <span style={{
                fontFamily: "'Sora', sans-serif", fontWeight: 600, fontSize: 12,
                color: row.statusEfetivo === "pago" ? "var(--green)" : "var(--red)",
              }}>
                {fmtR$(v)}
              </span>
            ),
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
   RELATÓRIO: VENDAS — helpers de gráfico (CSS puro, sem lib)
   ══════════════════════════════════════════════════════ */

/* Gráfico de barras verticais premium — gradiente, glow, tooltip elegante */
function BarChartCSS({ dados, altura = 160, cor = "#C8A55E", fmtVal }) {
  const [hover, setHover] = useState(null);
  const [tooltipX, setTooltipX] = useState(0);
  const containerRef = useRef(null);

  if (!dados || dados.length === 0) return null;

  const maxVal = Math.max(...dados.map((d) => d.val), 1);
  const fmt = fmtVal || fmtR$;

  // Deriva variante de cor para gradient
  const isGold   = cor === "#C8A55E" || cor === "#F5A623" || cor === "var(--gold)";
  const isGreen  = cor === "var(--green)" || cor === "#44D186";
  const isPurple = cor === "#9B8AFA" || cor === "var(--purple)";

  const gradTop    = isGold ? "#D4A84B" : isGreen ? "#44D186" : isPurple ? "#9B8AFA" : cor;
  const gradBottom = isGold ? "rgba(180,130,40,0.25)" : isGreen ? "rgba(68,209,134,0.2)" : isPurple ? "rgba(155,138,250,0.2)" : cor + "33";
  const glowColor  = isGold ? "rgba(200,165,94,0.35)" : isGreen ? "rgba(68,209,134,0.3)" : isPurple ? "rgba(155,138,250,0.3)" : cor + "55";

  const gradId = `bar-grad-${cor.replace(/[^a-z0-9]/gi,'')}`;

  return (
    <div ref={containerRef} style={{ position: "relative", userSelect: "none" }}>
      {/* Tooltip */}
      {hover !== null && dados[hover] && (
        <div className="rv-bar-tooltip" style={{ left: `${tooltipX}px`, top: 0 }}>
          <span style={{ color: isGold ? "var(--gold)" : isGreen ? "var(--green)" : "#9B8AFA", fontWeight: 700, marginRight: 8, fontFamily: "'Sora', sans-serif" }}>
            {dados[hover].label}
          </span>
          <span style={{ fontFamily: "'Sora', sans-serif", fontWeight: 600 }}>
            {fmt(dados[hover].val)}
          </span>
          {dados[hover].qtd != null && dados[hover].qtd > 0 && (
            <span style={{ color: "var(--text-3)", marginLeft: 6, fontSize: 11 }}>
              · {dados[hover].qtd} venda{dados[hover].qtd !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      )}

      {/* Grade + Barras */}
      <div style={{ position: "relative", height: altura, minHeight: altura, paddingTop: 8 }}>
        {/* SVG para gradient definitions */}
        <svg width="0" height="0" style={{ position: "absolute" }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={gradTop} stopOpacity="1" />
              <stop offset="100%" stopColor={gradBottom} stopOpacity="1" />
            </linearGradient>
          </defs>
        </svg>

        {/* Linhas guia */}
        {[0.25, 0.5, 0.75, 1].map((frac) => (
          <div key={frac} style={{
            position: "absolute", left: 0, right: 0,
            bottom: `${frac * 100}%`,
            borderTop: frac === 1
              ? "1px solid rgba(0,0,0,0.08)"
              : "1px dashed rgba(0,0,0,0.04)",
            pointerEvents: "none",
          }} />
        ))}

        {/* Container das barras */}
        <div style={{
          display: "flex", alignItems: "flex-end",
          gap: dados.length > 14 ? 3 : dados.length > 8 ? 6 : 12,
          height: "100%",
          padding: "0 2px",
        }}>
          {dados.map((d, i) => {
            const pctH = Math.max((d.val / maxVal) * 100, d.val > 0 ? 2 : 0);
            const isHov = hover === i;
            const isLast = i === dados.length - 1;
            const highlighted = isHov || isLast;

            return (
              <div
                key={d.label}
                style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", height: "100%", justifyContent: "flex-end", gap: 6, cursor: "default" }}
                onMouseEnter={(e) => {
                  setHover(i);
                  if (containerRef.current) {
                    const rect = containerRef.current.getBoundingClientRect();
                    const elRect = e.currentTarget.getBoundingClientRect();
                    setTooltipX(elRect.left - rect.left + elRect.width / 2);
                  }
                }}
                onMouseLeave={() => setHover(null)}
              >
                {/* Barra */}
                <div style={{
                  position: "relative",
                  width: "100%", maxWidth: 44,
                  height: `${pctH}%`,
                  minHeight: d.val > 0 ? 4 : 0,
                  borderRadius: "5px 5px 0 0",
                  background: `url('#') linear-gradient(180deg, ${gradTop}, ${gradBottom})`,
                  backgroundImage: `linear-gradient(180deg, ${highlighted ? gradTop : gradTop + "aa"}, ${gradBottom})`,
                  opacity: highlighted ? 1 : 0.42,
                  transition: "height .4s cubic-bezier(.25,.8,.25,1), opacity .2s",
                  boxShadow: isHov ? `0 -4px 18px ${glowColor}, 0 0 8px ${glowColor}` : "none",
                }}>
                  {/* Topo brilhante */}
                  {d.val > 0 && (
                    <div style={{
                      position: "absolute", top: 0, left: "15%", right: "15%",
                      height: 2, borderRadius: 2,
                      background: highlighted ? gradTop : "transparent",
                      boxShadow: isHov ? `0 0 8px ${gradTop}` : "none",
                      transition: "all .2s",
                    }} />
                  )}
                </div>
                {/* Label */}
                <span style={{
                  fontSize: dados.length > 10 ? 9 : 10,
                  fontWeight: highlighted ? 600 : 400,
                  color: highlighted ? (isGold ? "var(--gold)" : isGreen ? "var(--green)" : "#9B8AFA") : "rgba(255,255,255,0.28)",
                  fontFamily: "'DM Sans', sans-serif",
                  whiteSpace: "nowrap",
                  transition: "color .15s",
                }}>
                  {d.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function VendaGraficos({ dados }) {
  /* ── Faturamento por mês ── */
  const porMes = useMemo(() => {
    const map = {};
    dados.filtradas.forEach((v) => {
      const dt = parseDate(v.data);
      if (!dt) return;
      const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
      if (!map[key]) map[key] = { val: 0, qtd: 0 };
      map[key].val += Number(v.total || 0);
      map[key].qtd += 1;
    });
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, v]) => {
        const [ano, mes] = key.split("-");
        return { label: MESES_CURTOS[Number(mes) - 1] + "/" + ano.slice(2), ...v };
      });
  }, [dados.filtradas]);

  /* ── Ticket médio por mês ── */
  const ticketPorMes = useMemo(() =>
    porMes.map((m) => ({ label: m.label, val: m.qtd > 0 ? m.val / m.qtd : 0 })),
  [porMes]);

  /* ── Formas de pagamento ── */
  const fpEntries = useMemo(() => {
    const total = Object.values(dados.porFP).reduce((s, v) => s + v, 0) || 1;
    const CORES = ["#F5A623","#5B8EF0","#44D186","#E05252","#9B8AFA","#F0A05B"];
    return Object.entries(dados.porFP)
      .sort((a, b) => b[1] - a[1])
      .map(([fp, qtd], i) => ({ fp, qtd, pct: (qtd / total) * 100, cor: CORES[i % CORES.length] }));
  }, [dados.porFP]);

  /* ── Top produtos ── */
  const topProd = useMemo(() =>
    [...dados.maisPedidos].slice(0, 7),
  [dados.maisPedidos]);
  const maxProd = topProd.length > 0 ? Math.max(...topProd.map((p) => p.total), 1) : 1;

  /* ── Por dia da semana ── */
  const porDia = useMemo(() => {
    const dias = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
    const map  = { 0:0, 1:0, 2:0, 3:0, 4:0, 5:0, 6:0 };
    dados.filtradas.forEach((v) => {
      const dt = parseDate(v.data);
      if (dt) map[dt.getDay()] += Number(v.total || 0);
    });
    return Object.entries(map).map(([d, val]) => ({ label: dias[Number(d)], val }));
  }, [dados.filtradas]);

  if (dados.filtradas.length === 0) {
    return (
      <div className="rel-empty">
        <BarChart2 size={32} />
        <p>Nenhuma venda no período para exibir gráficos.</p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

      {/* KPIs rápidos */}
      <div className="rv-kpi-row">
        <div className="rv-kpi-mini">
          <div className="rv-kpi-mini-accent" style={{ background: "linear-gradient(90deg, var(--gold), transparent)" }} />
          <div className="rv-kpi-mini-label">Total Vendido</div>
          <div className="rv-kpi-mini-val" style={{ color: "var(--gold)" }}>{fmtR$(dados.total)}</div>
          <div className="rv-kpi-mini-sub">{dados.filtradas.length} vendas no período</div>
        </div>
        <div className="rv-kpi-mini">
          <div className="rv-kpi-mini-accent" style={{ background: "linear-gradient(90deg, var(--blue), transparent)" }} />
          <div className="rv-kpi-mini-label">Ticket Médio</div>
          <div className="rv-kpi-mini-val" style={{ color: "var(--blue)" }}>{fmtR$(dados.ticket)}</div>
          <div className="rv-kpi-mini-sub">por venda</div>
        </div>
        <div className="rv-kpi-mini">
          <div className="rv-kpi-mini-accent" style={{ background: "linear-gradient(90deg, var(--green), transparent)" }} />
          <div className="rv-kpi-mini-label">Meses com Vendas</div>
          <div className="rv-kpi-mini-val" style={{ color: "var(--green)" }}>{porMes.length}</div>
          <div className="rv-kpi-mini-sub">{porMes.length === 1 ? "mês ativo" : "meses ativos"}</div>
        </div>
      </div>

      <div className="rv-charts-grid">

        {/* ── Faturamento por mês ── */}
        {porMes.length > 0 && (
          <div className="rv-chart-card full">
            <div className="rv-chart-header">
              <span className="rv-chart-title">
                <span className="rv-chart-title-dot" />
                Faturamento por Mês
              </span>
              <span style={{ fontSize: 11, color: "var(--text-3)" }}>
                {porMes.length} {porMes.length === 1 ? "mês" : "meses"} · hover para detalhes
              </span>
            </div>
            <div className="rv-chart-body" style={{ paddingTop: 44 }}>
              <BarChartCSS dados={porMes} altura={170} cor="#C8A55E" />
            </div>
          </div>
        )}

        {/* ── Formas de Pagamento ── */}
        {fpEntries.length > 0 && (
          <div className="rv-chart-card">
            <div className="rv-chart-header">
              <span className="rv-chart-title">
                <span className="rv-chart-title-dot" style={{ background: "var(--blue)" }} />
                Formas de Pagamento
              </span>
            </div>
            <div className="rv-chart-body">
              <div className="rv-fp-list">
                {fpEntries.map((e) => (
                  <div key={e.fp} className="rv-fp-item">
                    <span className="rv-fp-color" style={{ background: e.cor }} />
                    <span className="rv-fp-name">{e.fp}</span>
                    <div className="rv-fp-bar-bg" style={{ flex: 1, maxWidth: 180 }}>
                      <div className="rv-fp-bar-fill" style={{ width: `${e.pct}%`, background: `linear-gradient(90deg, ${e.cor}, ${e.cor}55)` }} />
                    </div>
                    <span className="rv-fp-pct">{e.pct.toFixed(1)}%</span>
                    <span style={{ fontSize: 11, color: "var(--text-3)", minWidth: 58, textAlign: "right" }}>
                      {e.qtd} venda{e.qtd !== 1 ? "s" : ""}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Ticket Médio por Mês ── */}
        {ticketPorMes.length > 0 && (
          <div className="rv-chart-card">
            <div className="rv-chart-header">
              <span className="rv-chart-title">
                <span className="rv-chart-title-dot" style={{ background: "var(--green)" }} />
                Ticket Médio por Mês
              </span>
            </div>
            <div className="rv-chart-body" style={{ paddingTop: 44 }}>
              <BarChartCSS dados={ticketPorMes} altura={140} cor="var(--green)" />
            </div>
          </div>
        )}

        {/* ── Top Produtos ── */}
        {topProd.length > 0 && (
          <div className="rv-chart-card full">
            <div className="rv-chart-header">
              <span className="rv-chart-title">
                <span className="rv-chart-title-dot" />
                Top Produtos por Faturamento
              </span>
            </div>
            <div className="rv-chart-body">
              <div style={{ display: "flex", flexDirection: "column" }}>
                {topProd.map((p, i) => (
                  <div key={p.nome} className="rv-prod-row">
                    <span className={`rv-prod-rank${i < 3 ? " top" : ""}`}>#{i + 1}</span>
                    <span className="rv-prod-name" title={p.nome}>{p.nome}</span>
                    <div className="rv-prod-bar-bg">
                      <div className="rv-prod-bar-fill" style={{ width: `${(p.total / maxProd) * 100}%` }} />
                    </div>
                    <span className="rv-prod-val">{fmtR$(p.total)}</span>
                    <span className="rv-prod-qtd">{p.qtd} un.</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Faturamento por Dia da Semana ── */}
        <div className="rv-chart-card full">
          <div className="rv-chart-header">
            <span className="rv-chart-title">
              <span className="rv-chart-title-dot" style={{ background: "#9B8AFA" }} />
              Faturamento por Dia da Semana
            </span>
            <span style={{ fontSize: 11, color: "var(--text-3)" }}>hover para detalhes</span>
          </div>
          <div className="rv-chart-body" style={{ paddingTop: 44 }}>
            <BarChartCSS dados={porDia} altura={130} cor="#9B8AFA" />
          </div>
        </div>

      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   RELATÓRIO: VENDAS
   ══════════════════════════════════════════════════════ */
function RelatorioVendas({ vendas, intervalo }) {
  const [view, setView] = useState("lista"); // "lista" | "graficos"

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
          v.idVenda || v.id, fmtData(v.data), v.clienteNome || v.cliente || "—",
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

      {/* Toggle Lista / Gráficos */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div className="rv-view-toggle" data-print-hide>
          <button
            className={`rv-view-btn ${view === "lista" ? "active" : ""}`}
            onClick={() => setView("lista")}
          >
            <FileText size={14} /> Lista
          </button>
          <button
            className={`rv-view-btn ${view === "graficos" ? "active" : ""}`}
            onClick={() => setView("graficos")}
          >
            <BarChart2 size={14} /> Gráficos
          </button>
        </div>
        {view === "lista" && (
          <button className="btn-secondary" onClick={handleExport} data-print-hide
            style={{ fontSize: 12, padding: "6px 14px" }}>
            <Download size={13} /> Exportar Excel
          </button>
        )}
      </div>

      {/* ── VISTA: GRÁFICOS ── */}
      {view === "graficos" && <VendaGraficos dados={dados} />}

      {/* ── VISTA: LISTA ── */}
      {view === "lista" && (
        <>
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
              { key: "idVenda", label: "ID", render: (v, row) => <span style={{ color: "var(--gold)", fontFamily: "'Sora', sans-serif", fontSize: 11 }}>{v || row.id}</span> },
              { key: "data",  label: "Data", render: (v) => fmtData(v) },
              { key: "clienteNome", label: "Cliente", render: (v, row) => v || row.cliente || "—" },
              { key: "formaPagamento", label: "Pagamento" },
              {
                key: "total", label: "Total", align: "right",
                render: (v) => <span className="val-pos">{fmtR$(v)}</span>,
              },
            ]}
          />
        </>
      )}

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
   RELATÓRIO: ALUNOS
   Lista com situação de pagamento, totais e ticket médio
   ══════════════════════════════════════════════════════ */
function AlunosGraficos({ alunos, vendas, dados }) {
  /* ── Matrículas por mês — baseado em criadoEm de cada aluno ── */
  const matriculasPorMes = useMemo(() => {
    const map = {};
    alunos.forEach((a) => {
      if (!a.criadoEm) return;
      const key = String(a.criadoEm).slice(0, 7); // "YYYY-MM"
      if (!map[key]) map[key] = 0;
      map[key]++;
    });
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, val]) => {
        const [ano, mes] = key.split("-");
        return { label: MESES_CURTOS[Number(mes) - 1] + "/" + ano.slice(2), val, qtd: val };
      });
  }, [alunos]);

  /* ── Receita de mensalidades por mês — vendas sintéticas ── */
  const receitaPorMes = useMemo(() => {
    const map = {};
    vendas
      .filter((v) => v.tipoVenda === "mensalidade" && v.status !== "cancelada")
      .forEach((v) => {
        const dt = parseDate(v.data);
        if (!dt) return;
        const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
        if (!map[key]) map[key] = { val: 0, qtd: 0 };
        map[key].val += Number(v.total || 0);
        map[key].qtd++;
      });
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, v]) => {
        const [ano, mes] = key.split("-");
        return { label: MESES_CURTOS[Number(mes) - 1] + "/" + ano.slice(2), ...v };
      });
  }, [vendas]);

  /* ── Ticket médio por mês ── */
  const ticketPorMes = useMemo(() =>
    receitaPorMes.map((m) => ({ label: m.label, val: m.qtd > 0 ? m.val / m.qtd : 0 })),
  [receitaPorMes]);

  /* ── Distribuição por situação (para barra) ── */
  const distribuicao = useMemo(() => {
    const map = {};
    dados.linhas.forEach((l) => { map[l.situacao] = (map[l.situacao] || 0) + 1; });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .map(([sit, val]) => ({ label: sit, val }));
  }, [dados.linhas]);

  const totalReceita = receitaPorMes.reduce((s, m) => s + m.val, 0);
  const totalMeses   = receitaPorMes.length;

  if (alunos.length === 0) {
    return (
      <div className="rel-empty">
        <BarChart2 size={32} />
        <p>Nenhum aluno matriculado para exibir gráficos.</p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

      {/* KPIs rápidos */}
      <div className="rv-kpi-row">
        <div className="rv-kpi-mini">
          <div className="rv-kpi-mini-accent" style={{ background: "linear-gradient(90deg, var(--gold), transparent)" }} />
          <div className="rv-kpi-mini-label">Total de Alunos</div>
          <div className="rv-kpi-mini-val" style={{ color: "var(--gold)" }}>{alunos.length}</div>
          <div className="rv-kpi-mini-sub">{dados.totalAtivos} ativos</div>
        </div>
        <div className="rv-kpi-mini">
          <div className="rv-kpi-mini-accent" style={{ background: "linear-gradient(90deg, var(--green), transparent)" }} />
          <div className="rv-kpi-mini-label">Receita Total (histórico)</div>
          <div className="rv-kpi-mini-val" style={{ color: "var(--green)" }}>{fmtR$(totalReceita)}</div>
          <div className="rv-kpi-mini-sub">{totalMeses} {totalMeses === 1 ? "mês ativo" : "meses ativos"}</div>
        </div>
        <div className="rv-kpi-mini">
          <div className="rv-kpi-mini-accent" style={{ background: "linear-gradient(90deg, var(--blue), transparent)" }} />
          <div className="rv-kpi-mini-label">Ticket Médio Mensal</div>
          <div className="rv-kpi-mini-val" style={{ color: "var(--blue)" }}>
            {fmtR$(dados.ticketMedio)}
          </div>
          <div className="rv-kpi-mini-sub">por aluno ativo</div>
        </div>
      </div>

      <div className="rv-charts-grid">

        {/* ── Matrículas por Mês — crescimento ── */}
        {matriculasPorMes.length > 0 && (
          <div className="rv-chart-card full">
            <div className="rv-chart-header">
              <span className="rv-chart-title">
                <span className="rv-chart-title-dot" />
                Novas Matrículas por Mês
              </span>
              <span style={{ fontSize: 11, color: "var(--text-3)" }}>
                {matriculasPorMes.length} {matriculasPorMes.length === 1 ? "mês" : "meses"} · hover para detalhes
              </span>
            </div>
            <div className="rv-chart-body" style={{ paddingTop: 44 }}>
              <BarChartCSS
                dados={matriculasPorMes}
                altura={170}
                cor="#C8A55E"
                fmtVal={(v) => `${v} aluno${v !== 1 ? "s" : ""}`}
              />
            </div>
          </div>
        )}

        {/* ── Receita de Mensalidades por Mês ── */}
        {receitaPorMes.length > 0 && (
          <div className="rv-chart-card full">
            <div className="rv-chart-header">
              <span className="rv-chart-title">
                <span className="rv-chart-title-dot" style={{ background: "var(--green)" }} />
                Receita de Mensalidades por Mês
              </span>
              <span style={{ fontSize: 11, color: "var(--text-3)" }}>
                {receitaPorMes.length} {receitaPorMes.length === 1 ? "mês" : "meses"} · hover para detalhes
              </span>
            </div>
            <div className="rv-chart-body" style={{ paddingTop: 44 }}>
              <BarChartCSS dados={receitaPorMes} altura={170} cor="var(--green)" />
            </div>
          </div>
        )}

        {/* ── Ticket Médio por Mês ── */}
        {ticketPorMes.length > 0 && (
          <div className="rv-chart-card">
            <div className="rv-chart-header">
              <span className="rv-chart-title">
                <span className="rv-chart-title-dot" style={{ background: "var(--blue)" }} />
                Ticket Médio por Mês
              </span>
            </div>
            <div className="rv-chart-body" style={{ paddingTop: 44 }}>
              <BarChartCSS dados={ticketPorMes} altura={140} cor="var(--blue)" />
            </div>
          </div>
        )}

        {/* ── Distribuição por situação ── */}
        {distribuicao.length > 0 && (
          <div className="rv-chart-card">
            <div className="rv-chart-header">
              <span className="rv-chart-title">
                <span className="rv-chart-title-dot" style={{ background: "#9B8AFA" }} />
                Distribuição por Situação
              </span>
            </div>
            <div className="rv-chart-body">
              <div className="rv-fp-list">
                {distribuicao.map((d) => {
                  const total = dados.linhas.length || 1;
                  const pct   = (d.val / total) * 100;
                  const cor   = d.label === "Em dia"   ? "var(--green)"
                              : d.label === "Vencido"  ? "var(--red)"
                              : d.label === "Pendente" ? "#F5A623"
                              : "var(--text-3)";
                  return (
                    <div key={d.label} className="rv-fp-item">
                      <span className="rv-fp-color" style={{ background: cor }} />
                      <span className="rv-fp-name">{d.label}</span>
                      <div className="rv-fp-bar-bg" style={{ flex: 1, maxWidth: 180 }}>
                        <div className="rv-fp-bar-fill"
                          style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${cor}, ${cor}55)` }} />
                      </div>
                      <span className="rv-fp-pct">{pct.toFixed(1)}%</span>
                      <span style={{ fontSize: 11, color: "var(--text-3)", minWidth: 46, textAlign: "right" }}>
                        {d.val} aluno{d.val !== 1 ? "s" : ""}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   RELATÓRIO: ALUNOS
   Lista com situação de pagamento, totais e ticket médio
   ══════════════════════════════════════════════════════ */
function RelatorioAlunos({ alunos, aReceber, vendas, intervalo }) {
  const [alnSK, setAlnSK] = useState("nome");
  const [alnSD, setAlnSD] = useState("asc");
  const alnSort = (k) => { if(alnSK===k){ setAlnSD(d=>d==="asc"?"desc":"asc"); } else { setAlnSK(k); setAlnSD("asc"); } };
  const [view, setView]       = useState("lista"); // "lista" | "graficos"
  const [filtroSit, setFiltroSit] = useState("todos");

  const dados = useMemo(() => {
    const mensAbertas = aReceber.filter(ar => ar.origem === "mensalidade");
    const mensPorAluno = mensAbertas.reduce((acc, m) => {
      (acc[m.clienteId] = acc[m.clienteId] || []).push(m);
      return acc;
    }, {});

    const vendasMens = vendas.filter(v =>
      v.tipoVenda === "mensalidade" &&
      v.status !== "cancelada" &&
      dentroDoIntervalo(v.data, intervalo)
    );

    const hoje = new Date().toISOString().slice(0, 10);

    const linhas = alunos.map(a => {
      const abertas       = mensPorAluno[a.docId] || [];
      const totalAberto   = abertas.reduce((s, m) => s + Number(m.valorRestante || 0), 0);
      const vencidas      = abertas.filter(m => (m.dataVencimento || "") < hoje).length;
      const pagasPeriodo  = vendasMens.filter(v => v.clienteId === a.docId);
      const recebidoPeriodo = pagasPeriodo.reduce((s, v) => s + Number(v.total || 0), 0);
      const proxVenc      = abertas.map(m => m.dataVencimento).filter(Boolean).sort()[0] || null;

      let situacao = "Em dia";
      if (a.status !== "ativo") situacao = a.status === "trancado" ? "Trancado" : "Inativo";
      else if (vencidas > 0)    situacao = "Vencido";
      else if (abertas.length)  situacao = "Pendente";

      return {
        docId: a.docId,
        id:    a.idSeq ? `A${String(a.idSeq).padStart(4, "0")}` : "—",
        nome:  a.nome || "—",
        documento:   a.documento || "—",
        telefone:    a.telefone  || "—",
        mensalidade: Number(a.valorMensalidade || 0),
        situacao,
        abertas:     abertas.length,
        vencidas,
        totalAberto,
        recebidoPeriodo,
        proxVenc,
        statusAluno: a.status || "ativo",
      };
    });

    const totalAtivos   = alunos.filter(a => a.status === "ativo").length;
    const totalInativos = alunos.filter(a => a.status !== "ativo").length;
    const ticketMedio   = totalAtivos > 0
      ? alunos.filter(a => a.status === "ativo")
              .reduce((s, a) => s + Number(a.valorMensalidade || 0), 0) / totalAtivos
      : 0;
    const emDia    = linhas.filter(l => l.situacao === "Em dia").length;
    const vencidos = linhas.filter(l => l.situacao === "Vencido").length;
    const pendentes = linhas.filter(l => l.situacao === "Pendente").length;

    return { linhas, totalAtivos, totalInativos, ticketMedio, emDia, vencidos, pendentes };
  }, [alunos, aReceber, vendas, intervalo]);

  const linhasFiltradas = useMemo(() =>
    filtroSit === "todos"
      ? dados.linhas
      : dados.linhas.filter(l => l.situacao === filtroSit),
    [dados.linhas, filtroSit]
  );

  const handleExport = () => {
    exportarExcel("alunos", [{
      nome: "Alunos",
      colunas: ["ID","Nome","Documento","Telefone","Mensalidade","Situação","Mens. Abertas","Vencidas","Total em Aberto","Recebido no Período"],
      dados: linhasFiltradas.map(l => [
        l.id, l.nome, l.documento, l.telefone,
        l.mensalidade.toFixed(2), l.situacao,
        l.abertas, l.vencidas,
        l.totalAberto.toFixed(2), l.recebidoPeriodo.toFixed(2),
      ]),
    }]);
  };

  /* Pill de situação */
  const SituacaoPill = ({ sit }) => {
    const map = {
      "Em dia":   { bg: "rgba(74,222,128,.12)",  color: "var(--green)", border: "rgba(74,222,128,.2)"   },
      "Vencido":  { bg: "rgba(224,82,82,.12)",   color: "var(--red)",   border: "rgba(224,82,82,.25)"  },
      "Pendente": { bg: "rgba(245,166,35,.12)",  color: "#F5A623",      border: "rgba(245,166,35,.25)"  },
      "Trancado": { bg: "var(--s3)",             color: "var(--text-3)",border: "var(--border)"         },
      "Inativo":  { bg: "var(--s3)",             color: "var(--text-3)",border: "var(--border)"         },
    };
    const s = map[sit] || map["Inativo"];
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", padding: "3px 9px",
        borderRadius: 20, fontSize: 11, fontWeight: 600, whiteSpace: "nowrap",
        background: s.bg, color: s.color, border: `1px solid ${s.border}`,
      }}>{sit}</span>
    );
  };

  const fmtDataLocal = (iso) => {
    if (!iso) return "—";
    try { const [a,m,d] = iso.split("-"); return `${d}/${m}/${a}`; } catch { return "—"; }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* ── Toggle Lista / Gráficos (igual ao padrão de Vendas) ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div className="rv-view-toggle" data-print-hide>
          <button
            className={`rv-view-btn ${view === "lista" ? "active" : ""}`}
            onClick={() => setView("lista")}
          >
            <FileText size={14} /> Lista
          </button>
          <button
            className={`rv-view-btn ${view === "graficos" ? "active" : ""}`}
            onClick={() => setView("graficos")}
          >
            <BarChart2 size={14} /> Gráficos
          </button>
        </div>
        {view === "lista" && (
          <button className="btn-secondary" onClick={handleExport} data-print-hide
            style={{ fontSize: 12, padding: "6px 14px" }}>
            <Download size={13} /> Exportar Excel
          </button>
        )}
      </div>

      {/* ── VISTA: GRÁFICOS ── */}
      {view === "graficos" && <AlunosGraficos alunos={alunos} vendas={vendas} dados={dados} />}

      {/* ── VISTA: LISTA ── */}
      {view === "lista" && (
        <>
          {/* KPI cards clicáveis */}
          <div className="cr-grid">
            <div onClick={() => setFiltroSit("todos")} style={{ cursor: "pointer", borderRadius: 12, border: `2px solid ${filtroSit === "todos" ? "var(--gold)" : "var(--border)"}`, transition: "border-color .15s" }}>
              <CardResumo icon={<Users size={18} />} label="Alunos Ativos"
                value={String(dados.totalAtivos)}
                sub={`${dados.totalInativos} inativos/trancados`}
                trend="neutral" colorVar="var(--gold)" />
            </div>
            <div onClick={() => setFiltroSit(f => f === "Em dia" ? "todos" : "Em dia")} style={{ cursor: "pointer", borderRadius: 12, border: `2px solid ${filtroSit === "Em dia" ? "var(--green)" : "var(--border)"}`, transition: "border-color .15s" }}>
              <CardResumo icon={<TrendingUp size={18} />} label="Em Dia"
                value={String(dados.emDia)} sub="clique para filtrar"
                trend="up" colorVar="var(--green)" />
            </div>
            <div onClick={() => setFiltroSit(f => f === "Pendente" ? "todos" : "Pendente")} style={{ cursor: "pointer", borderRadius: 12, border: `2px solid ${filtroSit === "Pendente" ? "#F5A623" : "var(--border)"}`, transition: "border-color .15s" }}>
              <CardResumo icon={<DollarSign size={18} />} label="Pendentes"
                value={String(dados.pendentes)} sub="clique para filtrar"
                trend="neutral" colorVar="#F5A623" />
            </div>
            <div onClick={() => setFiltroSit(f => f === "Vencido" ? "todos" : "Vencido")} style={{ cursor: "pointer", borderRadius: 12, border: `2px solid ${filtroSit === "Vencido" ? "var(--red)" : "var(--border)"}`, transition: "border-color .15s" }}>
              <CardResumo icon={<AlertCircle size={18} />} label="Vencidos"
                value={String(dados.vencidos)} sub="clique para filtrar"
                trend="down" colorVar="var(--red)" />
            </div>
          </div>

          {/* Chip de filtro ativo */}
          {filtroSit !== "todos" && (
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 11, color: "var(--gold)", background: "rgba(200,165,94,.08)", border: "1px solid rgba(200,165,94,.2)", borderRadius: 8, padding: "6px 12px", alignSelf: "flex-start" }}>
              Filtrando: {filtroSit}
              <span onClick={() => setFiltroSit("todos")} style={{ cursor: "pointer", textDecoration: "underline", marginLeft: 4 }}>Limpar</span>
            </div>
          )}

          {/* Tabela inline — desktop: grid; mobile: card por linha */}
          <div style={{ background: "var(--s1)", border: "1px solid var(--border)", borderRadius: 12, overflow: "visible" }}>
            <div style={{ padding: "13px 18px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontFamily: "'Sora',sans-serif", fontSize: 13, fontWeight: 600, color: "var(--text)", display: "flex", alignItems: "center", gap: 8 }}>
                <Users size={14} /> Alunos matriculados
                <span style={{ fontSize: 10, background: "var(--s3)", color: "var(--text-3)", padding: "2px 8px", borderRadius: 20, fontWeight: 600 }}>{linhasFiltradas.length}</span>
              </span>
            </div>
            {/* Cabeçalho — oculto no mobile */}
            <div className="rel-inline-table-head" style={{ display: "grid", gridTemplateColumns: "72px 1.4fr 120px 120px 110px 110px 110px", padding: "10px 18px", gap: 8, background: "var(--s2)", borderBottom: "1px solid var(--border)", fontSize: 10, fontWeight: 600, letterSpacing: ".07em", textTransform: "uppercase", color: "var(--text-3)" }}>
              <SortTh label="ID" sortKey="docId" currentKey={alnSK} currentDir={alnSD} onSort={alnSort}>ID</SortTh>
              <SortTh label="Nome" sortKey="nome" currentKey={alnSK} currentDir={alnSD} onSort={alnSort}>Nome</SortTh>
              <span>Documento</span>
              <SortTh label="Mensalidade" sortKey="mensalidade" currentKey={alnSK} currentDir={alnSD} onSort={alnSort}>Mensalidade</SortTh>
              <SortTh label="Prox. Venc." sortKey="proxVenc" currentKey={alnSK} currentDir={alnSD} onSort={alnSort}>Prox. Venc.</SortTh>
              <span>Aberto</span><span>Situação</span>
            </div>
            {/* Linhas */}
            {linhasFiltradas.length === 0 ? (
              <div style={{ padding: "42px 18px", textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>
                {dados.linhas.length === 0
                  ? "Nenhum aluno matriculado."
                  : `Nenhum aluno com situação "${filtroSit}".`}
              </div>
            ) : [...linhasFiltradas].sort((a,b)=>{
                const va=a[alnSK],vb=b[alnSK];
                const tryD=(v)=>{if(!v)return null;const s=String(v);if(/^\d{4}-\d{2}-\d{2}/.test(s))return new Date(s);if(/^\d{2}\/\d{2}\/\d{4}/.test(s)){const[d,m,y]=s.split("/");return new Date(`${y}-${m}-${d}`);}return null;};
                const da=tryD(va),db=tryD(vb);
                if(da&&db)return alnSD==="asc"?da-db:db-da;
                const na=parseFloat(String(va??"").replace(/[^\d.,-]/g,"").replace(",",".")),nb=parseFloat(String(vb??"").replace(/[^\d.,-]/g,"").replace(",","."));
                if(!isNaN(na)&&!isNaN(nb))return alnSD==="asc"?na-nb:nb-na;
                const sa=String(va??"").toLowerCase(),sb=String(vb??"").toLowerCase();
                return alnSD==="asc"?sa.localeCompare(sb,"pt-BR"):sb.localeCompare(sa,"pt-BR");
              }).map((l, i) => (
              <div key={l.docId || i} className="rel-inline-table-row" style={{ display: "grid", gridTemplateColumns: "72px 1.4fr 120px 120px 110px 110px 110px", padding: "11px 18px", gap: 8, borderBottom: i < linhasFiltradas.length - 1 ? "1px solid var(--border)" : "none", alignItems: "center", fontSize: 12, color: "var(--text-2)", transition: "background .13s" }}
                onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.02)"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              <span className="rel-inline-table-cell" data-label="ID" style={{ fontFamily: "'JetBrains Mono','Courier New',monospace", color: "var(--text-3)", fontSize: 11 }}>
                <span className="rel-cell-lbl">ID</span>
                {l.id}
              </span>
              <span className="rel-inline-table-cell" data-label="Nome">
                <span className="rel-cell-lbl">Nome</span>
                <span>
                  <div style={{ color: "var(--text)", fontWeight: 500, fontSize: 13 }}>{l.nome}</div>
                  {l.telefone !== "—" && <div style={{ color: "var(--text-3)", fontSize: 11 }}>{l.telefone}</div>}
                </span>
              </span>
              <span className="rel-inline-table-cell" data-label="Documento">
                <span className="rel-cell-lbl">Documento</span>
                {l.documento}
              </span>
              <span className="rel-inline-table-cell" data-label="Mensalidade" style={{ fontFamily: "'Sora',sans-serif", fontWeight: 600, color: "var(--text)" }}>
                <span className="rel-cell-lbl">Mensalidade</span>
                {fmtR$(l.mensalidade)}
              </span>
              <span className="rel-inline-table-cell" data-label="Prox. Venc." style={{ color: l.situacao === "Vencido" ? "var(--red)" : "var(--text-2)" }}>
                <span className="rel-cell-lbl">Prox. Venc.</span>
                {fmtDataLocal(l.proxVenc) || (l.abertas === 0 ? "—" : "Pendente")}
              </span>
              <span className="rel-inline-table-cell" data-label="Em Aberto" style={{ fontFamily: "'Sora',sans-serif", fontWeight: 600, color: l.totalAberto > 0 ? "var(--red)" : "var(--text-3)" }}>
                <span className="rel-cell-lbl">Em Aberto</span>
                {fmtR$(l.totalAberto)}
              </span>
              <span className="rel-inline-table-cell" data-label="Situação">
                <span className="rel-cell-lbl">Situação</span>
                <SituacaoPill sit={l.situacao} />
              </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}


function RelatorioMensalidades({ alunos, aReceber, vendas, caixa, intervalo }) {
  /* Filtro de view — null = tudo visível */
  const [filtroView, setFiltroView] = useState(null); // null | "recebidas" | "pendentes"

  const dados = useMemo(() => {
    /* Mensalidades recebidas no período — vendas sintéticas com tipoVenda="mensalidade" */
    const recebidas = vendas.filter(v =>
      v.tipoVenda === "mensalidade" &&
      v.status !== "cancelada" &&
      dentroDoIntervalo(v.data, intervalo)
    );

    /* Mensalidades em aberto — snapshot atual (não filtra por período) */
    const mensAbertas = aReceber.filter(ar =>
      ar.origem === "mensalidade" && Number(ar.valorRestante || 0) > 0
    );

    const hoje = new Date().toISOString().slice(0, 10);
    const vencidas = mensAbertas.filter(m => (m.dataVencimento || "") < hoje);

    const totalRecebido = recebidas.reduce((s, v) => s + Number(v.total || 0), 0);
    const totalPendente = mensAbertas.reduce((s, m) => s + Number(m.valorRestante || 0), 0);
    const totalVencido  = vencidas.reduce((s, m) => s + Number(m.valorRestante || 0), 0);
    const ticketMedio   = recebidas.length > 0 ? totalRecebido / recebidas.length : 0;

    /* Linhas — recebidas no período */
    const linhasRecebidas = recebidas
      .sort((a, b) => (parseDate(b.data) || 0) - (parseDate(a.data) || 0))
      .map(v => ({
        data:  v.data,
        aluno: v.clienteNome || v.cliente || "—",
        mes:   v.mesReferencia || "—",
        valor: Number(v.total || 0),
        forma: v.formaPagamento || "—",
      }));

    /* Linhas — pendentes (ordenadas por vencimento) */
    const linhasPendentes = mensAbertas
      .sort((a, b) => (a.dataVencimento || "").localeCompare(b.dataVencimento || ""))
      .map(m => ({
        aluno:      m.clienteNome || "—",
        mes:        m.mesReferencia || "—",
        vencimento: m.dataVencimento || "",
        valor:      Number(m.valorRestante || 0),
        status:     (m.dataVencimento || "") < hoje ? "Vencida" : "Pendente",
      }));

    /* Inadimplência por aluno */
    const porAluno = {};
    mensAbertas.forEach(m => {
      const id = m.clienteId || m.clienteNome;
      if (!porAluno[id]) porAluno[id] = { aluno: m.clienteNome || "—", qtd: 0, total: 0 };
      porAluno[id].qtd   += 1;
      porAluno[id].total += Number(m.valorRestante || 0);
    });
    const rankingInadimplencia = Object.values(porAluno)
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    return {
      linhasRecebidas, linhasPendentes, rankingInadimplencia,
      totalRecebido, totalPendente, totalVencido, ticketMedio,
      qtdRecebidas:  recebidas.length,
      qtdPendentes:  mensAbertas.length,
      qtdVencidas:   vencidas.length,
      taxaInadimplencia: (totalRecebido + totalVencido) > 0
        ? (totalVencido / (totalRecebido + totalVencido)) * 100
        : 0,
    };
  }, [alunos, aReceber, vendas, caixa, intervalo]);

  const handleExport = () => {
    exportarExcel("mensalidades", [
      {
        nome: "Recebidas no período",
        colunas: ["Data", "Aluno", "Mês Ref.", "Forma Pag.", "Valor (R$)"],
        dados: dados.linhasRecebidas.map(l => [
          fmtData(l.data), l.aluno, l.mes, l.forma, l.valor.toFixed(2),
        ]),
      },
      {
        nome: "Pendentes (snapshot atual)",
        colunas: ["Aluno", "Mês Ref.", "Vencimento", "Status", "Valor (R$)"],
        dados: dados.linhasPendentes.map(l => [
          l.aluno, l.mes, fmtData(l.vencimento), l.status, l.valor.toFixed(2),
        ]),
      },
      {
        nome: "Ranking Inadimplência",
        colunas: ["Aluno", "Qtd Mens. Abertas", "Total Devido (R$)"],
        dados: dados.rankingInadimplencia.map(l => [l.aluno, l.qtd, l.total.toFixed(2)]),
      },
    ]);
  };

  /* ── Helpers visuais ── */
  const fmtDataLocal = (iso) => {
    if (!iso) return "—";
    try { const [a,m,d] = iso.split("-"); return `${d}/${m}/${a}`; } catch { return "—"; }
  };

  /* Formata "2026-05" ou "2026-05-01" → "Mai/26" */
  const fmtMesRef = (val) => {
    if (!val) return "—";
    const parts = val.split("-");
    if (parts.length < 2) return val;
    const meses = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
    const idx = parseInt(parts[1]) - 1;
    if (idx < 0 || idx > 11) return val;
    return `${meses[idx]}/${parts[0].slice(2)}`;
  };

  const StatusPill = ({ status }) => {
    const isVenc = status === "Vencida";
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", padding: "3px 9px",
        borderRadius: 20, fontSize: 11, fontWeight: 600, whiteSpace: "nowrap",
        background: isVenc ? "rgba(224,82,82,.12)"  : "rgba(200,165,94,.12)",
        color:      isVenc ? "var(--red)"            : "#F5A623",
        border:     isVenc ? "1px solid rgba(224,82,82,.25)" : "1px solid rgba(245,166,35,.25)",
      }}>{status}</span>
    );
  };

  /* Tabela inline genérica — mobile: card por linha; desktop: grid */
  const InlineTable = ({ titulo, colunas, linhas, emptyMsg }) => (
    <div style={{
      background: "var(--s1)", border: "1px solid var(--border)",
      borderRadius: 12, overflow: "visible",
    }}>
      <div style={{
        padding: "13px 18px", borderBottom: "1px solid var(--border)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <span style={{ fontFamily: "'Sora',sans-serif", fontSize: 13, fontWeight: 600, color: "var(--text)", display: "flex", alignItems: "center", gap: 8 }}>
          {titulo}
          <span style={{ fontSize: 10, background: "var(--s3)", color: "var(--text-3)", padding: "2px 8px", borderRadius: 20, fontWeight: 600 }}>
            {linhas.length}
          </span>
        </span>
      </div>
      {/* Cabeçalho — oculto no mobile via CSS */}
      <div className="rel-inline-table-head" style={{
        display: "grid",
        gridTemplateColumns: colunas.map(() => "1fr").join(" "),
        padding: "9px 18px", gap: 8,
        background: "var(--s2)", borderBottom: "1px solid var(--border)",
        fontSize: 10, fontWeight: 600, letterSpacing: ".07em",
        textTransform: "uppercase", color: "var(--text-3)",
      }}>
        {colunas.map(c => <span key={c.key}>{c.label}</span>)}
      </div>
      {/* Linhas */}
      {linhas.length === 0 ? (
        <div style={{ padding: "32px", textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>
          {emptyMsg || "Nenhum registro encontrado."}
        </div>
      ) : linhas.map((row, i) => (
        <div key={i} className="rel-inline-table-row" style={{
          display: "grid",
          gridTemplateColumns: colunas.map(() => "1fr").join(" "),
          padding: "10px 18px", gap: 8,
          borderBottom: i < linhas.length - 1 ? "1px solid var(--border)" : "none",
          alignItems: "center", fontSize: 12, color: "var(--text-2)",
          transition: "background .13s",
        }}
        onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.02)"}
        onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
          {colunas.map(c => (
            <span key={c.key} className="rel-inline-table-cell" data-label={c.label}>
              <span className="rel-cell-lbl">{c.label}</span>
              <span style={{ textAlign: "right" }}>
                {c.render ? c.render(row[c.key], row) : (row[c.key] ?? "—")}
              </span>
            </span>
          ))}
        </div>
      ))}
    </div>
  );

  /* Determina quais seções mostrar com base no filtro */
  const mostrarRecebidas = filtroView === null || filtroView === "recebidas";
  const mostrarPendentes = filtroView === null || filtroView === "pendentes";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button className="btn-secondary" onClick={handleExport} data-print-hide
          style={{ fontSize: 12, padding: "6px 14px" }}>
          <Download size={13} /> Exportar Excel
        </button>
      </div>

      {/* ── KPI cards — "Recebido" e "Pendente" são clicáveis como filtros ── */}
      <div className="cr-grid">
        <div
          onClick={() => setFiltroView(v => v === "recebidas" ? null : "recebidas")}
          style={{
            cursor: "pointer", borderRadius: 12,
            border: `2px solid ${filtroView === "recebidas" ? "var(--green)" : "var(--border)"}`,
            transition: "border-color .15s",
          }}
        >
          <CardResumo icon={<CreditCard size={18} />} label="Recebido no Período"
            value={fmtR$(dados.totalRecebido)}
            sub={`${dados.qtdRecebidas} mensalidade(s) · clique para filtrar`}
            trend="up" colorVar="var(--green)" />
        </div>

        {/* Ticket médio — apenas informativo */}
        <CardResumo icon={<DollarSign size={18} />} label="Ticket Médio"
          value={fmtR$(dados.ticketMedio)} sub="por mensalidade"
          trend="neutral" colorVar="var(--blue)" />

        <div
          onClick={() => setFiltroView(v => v === "pendentes" ? null : "pendentes")}
          style={{
            cursor: "pointer", borderRadius: 12,
            border: `2px solid ${filtroView === "pendentes" ? "#F5A623" : "var(--border)"}`,
            transition: "border-color .15s",
          }}
        >
          <CardResumo icon={<Clock size={18} />} label="Pendente Total"
            value={fmtR$(dados.totalPendente)}
            sub={`${dados.qtdPendentes} aberta(s) · clique para filtrar`}
            trend="neutral" colorVar="#F5A623" />
        </div>

        {/* Inadimplência — apenas informativo */}
        <CardResumo icon={<AlertCircle size={18} />} label="Inadimplência"
          value={fmtR$(dados.totalVencido)}
          sub={`${dados.qtdVencidas} vencida(s) · ${dados.taxaInadimplencia.toFixed(1)}%`}
          trend="down" colorVar="var(--red)" />
      </div>

      {/* Label de filtro ativo */}
      {filtroView && (
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          fontSize: 11, color: "var(--gold)",
          background: "rgba(200,165,94,.08)", border: "1px solid rgba(200,165,94,.2)",
          borderRadius: 8, padding: "6px 12px", alignSelf: "flex-start",
        }}>
          Filtrando: {filtroView === "recebidas" ? "Mensalidades Recebidas" : "Mensalidades Pendentes"}
          <span onClick={() => setFiltroView(null)}
            style={{ cursor: "pointer", textDecoration: "underline", marginLeft: 4 }}>
            Mostrar todas
          </span>
        </div>
      )}

      {/* ── Tabela 1: Recebidas no período ── */}
      {mostrarRecebidas && (
        <InlineTable
          titulo="Mensalidades Recebidas no Período"
          colunas={[
            { key: "data",  label: "Data",      render: (v) => fmtDataLocal(typeof v === "string" ? v.slice(0,10) : v) },
            { key: "aluno", label: "Aluno" },
            { key: "mes",   label: "Mês Ref.",  render: (v) => fmtMesRef(v) },
            { key: "forma", label: "Pagamento" },
            { key: "valor", label: "Valor",     render: (v) => <span style={{ fontFamily: "'Sora',sans-serif", fontWeight: 600, color: "var(--green)" }}>{fmtR$(v)}</span> },
          ]}
          linhas={dados.linhasRecebidas}
          emptyMsg="Nenhuma mensalidade recebida neste período."
        />
      )}

      {/* ── Tabela 2: Pendentes (snapshot atual) ── */}
      {mostrarPendentes && dados.linhasPendentes.length > 0 && (
        <InlineTable
          titulo="Mensalidades Pendentes (atual)"
          colunas={[
            { key: "aluno",      label: "Aluno" },
            { key: "mes",        label: "Mês Ref.",   render: (v) => fmtMesRef(v) },
            { key: "vencimento", label: "Vencimento", render: (v) => fmtDataLocal(v) },
            { key: "status",     label: "Status",     render: (v) => <StatusPill status={v} /> },
            { key: "valor",      label: "Valor",      render: (v) => <span style={{ fontFamily: "'Sora',sans-serif", fontWeight: 600, color: "var(--red)" }}>{fmtR$(v)}</span> },
          ]}
          linhas={dados.linhasPendentes}
        />
      )}

      {/* ── Ranking inadimplência ── */}
      {dados.rankingInadimplencia.length > 0 && (
        <div className="tr-wrap">
          <div className="tr-header">
            <span className="tr-title">Top 10 — Inadimplência por Aluno</span>
          </div>
          {dados.rankingInadimplencia.map((l, i) => (
            <div key={l.aluno + i} className="rank-item">
              <span className="rank-num">#{i + 1}</span>
              <span className="rank-label">{l.aluno}</span>
              <span style={{ fontSize: 11, color: "var(--text-3)", marginLeft: "auto" }}>
                {l.qtd} mens.
              </span>
              <span className="rank-val" style={{ color: "var(--red)" }}>{fmtR$(l.total)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   HELPERS LOCAIS — Compras & A Receber
   ══════════════════════════════════════════════════════ */
const parseDateISO = (d) => {
  if (!d) return null;
  if (typeof d === "string") return d.slice(0, 10);
  if (d?.toDate) return d.toDate().toISOString().slice(0, 10);
  return null;
};

const hojeISO_rcr = () => {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
};

const dentroIntervalo_rcr = (dateISO, intervalo) => {
  if (!intervalo || !dateISO) return true;
  const { inicio, fim } = intervalo;
  if (inicio && dateISO < inicio) return false;
  if (fim   && dateISO > fim)    return false;
  return true;
};

const getMesLabel_rcr = (dateISO) => {
  if (!dateISO) return "—";
  const [ano, mes] = dateISO.split("-");
  const meses = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  return `${meses[parseInt(mes) - 1]}/${ano.slice(2)}`;
};

const agruparPorMes_rcr = (items, campoData, campoValor) => {
  const mapa = {};
  items.forEach((item) => {
    const d = parseDateISO(item[campoData]);
    if (!d) return;
    const k = d.slice(0, 7);
    if (!mapa[k]) mapa[k] = { mes: k, label: getMesLabel_rcr(d), total: 0, count: 0 };
    mapa[k].total += Number(item[campoValor] || 0);
    mapa[k].count++;
  });
  return Object.values(mapa).sort((a, b) => a.mes.localeCompare(b.mes)).slice(-12);
};

const calcTendencia_rcr = (atual, anterior) => {
  if (!anterior || anterior === 0) return null;
  return ((atual - anterior) / anterior) * 100;
};

/* ── Gráfico de barras verticais ── */
function RcrBarChart({ dados, colorFn, height = 140 }) {
  const [hover, setHover] = useState(null);
  const max = Math.max(...dados.map((d) => d.total), 1);
  return (
    <div style={{ position: "relative" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height, pointerEvents: "none" }}>
        {[75, 50, 25].map((p) => (
          <div key={p} style={{ position: "absolute", top: `${100 - p}%`, left: 0, right: 0, borderTop: "1px dashed rgba(255,255,255,0.05)" }} />
        ))}
      </div>
      <div className="rcr-bar-chart" style={{ height: height + 28 }}>
        {dados.map((d, i) => {
          const pct = max > 0 ? (d.total / max) * 100 : 0;
          const cor = colorFn ? colorFn(d, i) : "var(--gold)";
          return (
            <div key={d.mes || i} className="rcr-bar-col">
              <div
                className="rcr-bar"
                style={{ height: `${Math.max(pct, 2)}%`, background: cor, opacity: hover !== null && hover !== i ? 0.4 : 1 }}
                onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
              >
                <div className="rcr-bar-tooltip">{fmtR$(d.total)}</div>
              </div>
              <span className="rcr-bar-label">{d.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Donut SVG ── */
function RcrDonut({ dados, size = 110 }) {
  const PALETA = ["#C8A55E","#5b8ef0","#48c78e","#e05252","#9b59b6","#e67e22","#1abc9c","#e74c3c"];
  const total = dados.reduce((s, d) => s + d.valor, 0);
  if (!total) return <div className="rcr-empty" style={{ padding: 20, fontSize: 12 }}>Sem dados</div>;
  const cx = size / 2, cy = size / 2, r = size * 0.36, R = size * 0.48;
  let angulo = -Math.PI / 2;
  const setores = dados.slice(0, 8).map((d, i) => {
    const frac = d.valor / total;
    const ang  = frac * 2 * Math.PI;
    const x1 = cx + R * Math.cos(angulo), y1 = cy + R * Math.sin(angulo);
    angulo += ang;
    const x2 = cx + R * Math.cos(angulo), y2 = cy + R * Math.sin(angulo);
    const x3 = cx + r * Math.cos(angulo), y3 = cy + r * Math.sin(angulo);
    const x4 = cx + r * Math.cos(angulo - ang), y4 = cy + r * Math.sin(angulo - ang);
    const lA = ang > Math.PI ? 1 : 0;
    return { path: `M${x1},${y1} A${R},${R} 0 ${lA},1 ${x2},${y2} L${x3},${y3} A${r},${r} 0 ${lA},0 ${x4},${y4} Z`, cor: PALETA[i % PALETA.length], ...d, pct: frac * 100 };
  });
  return (
    <div className="rcr-donut-wrap">
      <svg width={size} height={size}>
        {setores.map((s, i) => (
          <path key={i} d={s.path} fill={s.cor}
            onMouseEnter={(e) => e.target.style.opacity = ".7"}
            onMouseLeave={(e) => e.target.style.opacity = "1"} />
        ))}
        <circle cx={cx} cy={cy} r={r - 2} fill="var(--s1)" />
        <text x={cx} y={cy - 5} textAnchor="middle" style={{ fill: "var(--text-3)", fontSize: 8, fontFamily: "DM Sans,sans-serif", fontWeight: 600, letterSpacing: ".05em" }}>TOTAL</text>
        <text x={cx} y={cy + 8} textAnchor="middle" style={{ fill: "var(--gold)", fontSize: 9, fontFamily: "Sora,sans-serif", fontWeight: 700 }}>100%</text>
      </svg>
      <div className="rcr-donut-legend">
        {setores.map((s, i) => (
          <div key={i} className="rcr-donut-leg-item">
            <div className="rcr-donut-leg-dot" style={{ background: s.cor }} />
            <span className="rcr-donut-leg-name">{s.nome}</span>
            <span className="rcr-donut-leg-pct">{Number(s.pct).toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── KPI Card ── */
function RcrKpi({ icon: Icon, label, value, sub, cor = "gold", trend, onClick, active }) {
  const trendCls = trend === null || trend === undefined ? "" : trend > 0 ? "up" : trend < 0 ? "down" : "neu";
  const TrendIcon = !trend ? Minus : trend > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <div
      className={`rcr-kpi ${cor}${onClick ? " rcr-kpi-clickable" : ""}${active ? " rcr-kpi-active" : ""}`}
      onClick={onClick}
      style={onClick ? { cursor: "pointer" } : undefined}
    >
      <div className={`rcr-kpi-icon ${cor}`}><Icon size={16} /></div>
      <div className="rcr-kpi-label">{label}</div>
      <div className={`rcr-kpi-val ${cor}`}>{value}</div>
      {trend !== undefined && trend !== null
        ? <div className={`rcr-kpi-trend ${trendCls}`}><TrendIcon size={12} />{Math.abs(trend).toFixed(1)}% vs mês anterior</div>
        : <div className="rcr-kpi-sub">{sub}</div>
      }
    </div>
  );
}

/* ── Insight card ── */
function RcrInsight({ tipo, texto }) {
  const cfg = {
    warn:   { icon: <AlertCircle   size={15} color="var(--gold)"  />, cls: "warn"   },
    danger: { icon: <AlertTriangle size={15} color="var(--red)"   />, cls: "danger" },
    good:   { icon: <CheckCircle   size={15} color="var(--green)" />, cls: "good"   },
    info:   { icon: <Activity      size={15} color="var(--blue, #5b8ef0)" />, cls: "info" },
  }[tipo] || { icon: <Zap size={15} />, cls: "info" };
  return (
    <div className={`rcr-insight ${cfg.cls}`}>
      <span className="rcr-insight-icon">{cfg.icon}</span>
      <span className="rcr-insight-text" dangerouslySetInnerHTML={{ __html: texto }} />
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   RELATÓRIO: COMPRAS
   ══════════════════════════════════════════════════════ */
function RelatorioCompras({ compras = [], fornecedores = [], intervalo }) {
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [cmpSK, setCmpSK] = useState("data");
  const [cmpSD, setCmpSD] = useState("desc");
  const cmpSort = (k) => { if(cmpSK===k){ setCmpSD(d=>d==="asc"?"desc":"asc"); } else { setCmpSK(k); setCmpSD("asc"); } };
  const [filtroPag,    setFiltroPag]    = useState("todos");

  /* ── Mapa de fornecedores para lookup O(1) ── */
  const fornMap = useMemo(() =>
    Object.fromEntries(fornecedores.map(f => [f.id, f.nome])),
    [fornecedores]
  );

  /* Resolve nome: doc.id → nome atual. Fallback: fornecedorNome (docs legados) */
  const getNome = useCallback((c) =>
    fornMap[c.fornecedorId] || c.fornecedorNome || "—",
    [fornMap]
  );

  /* Resolve descrição: junta nomes dos itens */
  const getDesc = (c) => {
    if (c.itens?.length) return c.itens.map(i => i.insumoNome).filter(Boolean).join(", ");
    return c.descricao || "—";
  };

  /* Mapa completo de labels de método (inclui valores legados) */
  const PAG_LABELS = {
    dinheiro:      "Dinheiro",
    pix:           "PIX",
    transferencia: "Transferência",
    boleto:        "Boleto",
    cartao_credito:"Cartão de Crédito",
    cartao:        "Cartão (legado)",
    parcelado:     "Parcelado (legado)",
  };
  const getMetodo = (c) => {
    const base = PAG_LABELS[c.metodoPagamento] || c.metodoPagamento || "—";
    if (c.parcelado && c.numParcelas > 1) return `${base} (${c.numParcelas}×)`;
    return base;
  };

  const CORES = ["#C8A55E","#5b8ef0","#48c78e","#e05252","#9b59b6","#e67e22","#1abc9c","#e74c3c"];

  const filtrados = useMemo(() => compras.filter((c) => {
    const d = parseDateISO(c.data);
    if (!dentroIntervalo_rcr(d, intervalo)) return false;
    if (filtroStatus !== "todos" && c.status !== filtroStatus) return false;
    if (filtroPag    !== "todos" && c.metodoPagamento !== filtroPag) return false;
    return true;
  }), [compras, intervalo, filtroStatus, filtroPag]);

  const pagas      = useMemo(() => filtrados.filter((c) => c.status === "pago"),      [filtrados]);
  const pendentes  = useMemo(() => filtrados.filter((c) => c.status === "pendente"),  [filtrados]);
  const canceladas = useMemo(() => filtrados.filter((c) => c.status === "cancelado"), [filtrados]);

  /* Campo correto: valorTotal */
  const totalGasto     = useMemo(() => pagas.reduce((s, c) => s + Number(c.valorTotal || 0), 0), [pagas]);
  const totalPendente  = useMemo(() => pendentes.reduce((s, c) => s + Number(c.valorTotal || 0), 0), [pendentes]);
  const totalCancelado = useMemo(() => canceladas.reduce((s, c) => s + Number(c.valorTotal || 0), 0), [canceladas]);
  const ticketMedio    = useMemo(() => pagas.length ? totalGasto / pagas.length : 0, [totalGasto, pagas]);

  /* Campo correto: valorTotal */
  const evolucaoMensal = useMemo(() => agruparPorMes_rcr(pagas, "data", "valorTotal"), [pagas]);

  const tendencia = useMemo(() => {
    if (evolucaoMensal.length < 2) return null;
    return calcTendencia_rcr(
      evolucaoMensal[evolucaoMensal.length - 1].total,
      evolucaoMensal[evolucaoMensal.length - 2].total
    );
  }, [evolucaoMensal]);

  /* Ranking: agrupar por fornecedorId, exibir nome resolvido */
  const rankFornecedores = useMemo(() => {
    const mapa = {};
    pagas.forEach((c) => {
      const key  = c.fornecedorId || c.fornecedorNome || "sem_fornecedor";
      const nome = getNome(c);
      if (!mapa[key]) mapa[key] = { nome, total: 0, qtd: 0 };
      mapa[key].total += Number(c.valorTotal || 0);
      mapa[key].qtd++;
    });
    return Object.values(mapa).sort((a, b) => b.total - a.total).slice(0, 8);
  }, [pagas, getNome]);

  /* Distribuição por método */
  const distPagamento = useMemo(() => {
    const mapa = {};
    pagas.forEach((c) => {
      const nome = PAG_LABELS[c.metodoPagamento] || c.metodoPagamento || "Outro";
      if (!mapa[nome]) mapa[nome] = { nome, valor: 0 };
      mapa[nome].valor += Number(c.valorTotal || 0);
    });
    return Object.values(mapa).sort((a, b) => b.valor - a.valor);
  }, [pagas]);

  const metodosPag = useMemo(() => [...new Set(compras.map((c) => c.metodoPagamento).filter(Boolean))], [compras]);

  const insights = useMemo(() => {
    const lista = [];
    if (tendencia !== null) {
      if (tendencia > 20)      lista.push({ tipo: "danger", texto: `<strong>⚠ Gastos em alta:</strong> suas compras aumentaram <strong>${Math.abs(tendencia).toFixed(1)}%</strong> vs mês anterior.` });
      else if (tendencia < -10) lista.push({ tipo: "good",  texto: `<strong>✓ Economia detectada:</strong> gastos reduziram <strong>${Math.abs(tendencia).toFixed(1)}%</strong> vs mês anterior.` });
    }
    if (rankFornecedores.length > 0 && totalGasto > 0) {
      const top = rankFornecedores[0];
      const pct = (top.total / totalGasto) * 100;
      if (pct > 50) lista.push({ tipo: "warn", texto: `<strong>Concentração de fornecedor:</strong> ${pct.toFixed(0)}% dos gastos estão com <strong>${top.nome}</strong>. Avalie diversificação.` });
    }
    if (totalPendente > 0) lista.push({ tipo: "info", texto: `<strong>Pagamentos pendentes:</strong> <strong>${fmtR$(totalPendente)}</strong> em compras aguardando pagamento.` });
    if (lista.length === 0 && filtrados.length > 0) lista.push({ tipo: "good", texto: `<strong>Situação estável:</strong> nenhum alerta detectado no período.` });
    return lista;
  }, [tendencia, rankFornecedores, totalGasto, totalPendente, filtrados]);

  const tabelaItens = useMemo(() =>
    [...filtrados].sort((a, b) => (parseDateISO(b.data) || "").localeCompare(parseDateISO(a.data) || "")).slice(0, 50),
    [filtrados]
  );

  const handleExport = useCallback(() => {
    exportarExcel("compras", [{
      nome: "Compras",
      colunas: ["Data", "Fornecedor", "Itens", "Valor (R$)", "Método", "Status"],
      dados: tabelaItens.map((c) => [
        parseDateISO(c.data) || "",
        getNome(c),
        getDesc(c),
        Number(c.valorTotal || 0),
        getMetodo(c),
        c.status || "",
      ]),
    }]);
  }, [tabelaItens, getNome]);

  if (!compras.length) return <div className="rcr-empty"><ShoppingCart size={32} opacity={0.3} /><p>Nenhuma compra registrada.</p></div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>

      {/* ── Filtros ── */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="rcr-filter-label">Status</span>
          <div className="rcr-filters">
            {["todos","pago","pendente","cancelado"].map((s) => (
              <button key={s} className={`rcr-filter-btn ${filtroStatus === s ? "active" : ""}`} onClick={() => setFiltroStatus(s)}>
                {s === "todos" ? "Todos" : s[0].toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>
        {metodosPag.length > 1 && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="rcr-filter-label">Pagamento</span>
            <div className="rcr-filters">
              <button className={`rcr-filter-btn ${filtroPag === "todos" ? "active" : ""}`} onClick={() => setFiltroPag("todos")}>Todos</button>
              {metodosPag.map((m) => (
                <button key={m} className={`rcr-filter-btn ${filtroPag === m ? "active" : ""}`} onClick={() => setFiltroPag(m)}>
                  {PAG_LABELS[m] || m}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── KPIs clicáveis ── */}
      <div className="rcr-kpi-grid">
        <RcrKpi icon={DollarSign}   label="Total Gasto (pago)"  value={fmtR$(totalGasto)}    cor="gold"  trend={tendencia}                                                         onClick={() => setFiltroStatus(f => f === "pago"      ? "todos" : "pago")}      active={filtroStatus === "pago"} />
        <RcrKpi icon={Clock}        label="A Pagar (pendente)"  value={fmtR$(totalPendente)}  cor="blue"  sub={`${pendentes.length} compra${pendentes.length !== 1 ? "s" : ""}`}  onClick={() => setFiltroStatus(f => f === "pendente"  ? "todos" : "pendente")}  active={filtroStatus === "pendente"} />
        <RcrKpi icon={ShoppingCart} label="Ticket Médio"        value={fmtR$(ticketMedio)}    cor="green" sub={`${pagas.length} compras pagas`} />
        <RcrKpi icon={Target}       label="Cancelado"           value={fmtR$(totalCancelado)} cor="red"   sub={`${canceladas.length} compra${canceladas.length !== 1 ? "s" : ""}`} onClick={() => setFiltroStatus(f => f === "cancelado" ? "todos" : "cancelado")} active={filtroStatus === "cancelado"} />
      </div>

      {/* ── Tabela detalhada ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div className="rcr-section-title"><Package size={15} />Detalhamento</div>
        <button className="btn-secondary" style={{ fontSize: 12, padding: "6px 14px" }} onClick={handleExport}><Download size={13} />Exportar Excel</button>
      </div>
      <div className="rcr-table-wrap">
        <div className="rcr-table-header"><span className="rcr-table-title">Registro de Compras</span><span className="rcr-table-badge">{tabelaItens.length} registros</span></div>
        <div className="rcr-row rcr-row-head" style={{ gridTemplateColumns: "90px 1fr 1fr 120px 140px 100px" }}>
          <SortTh label="Data" sortKey="data" currentKey={cmpSK} currentDir={cmpSD} onSort={cmpSort}>Data</SortTh>
          <SortTh label="Fornecedor" sortKey="_nomeSort" currentKey={cmpSK} currentDir={cmpSD} onSort={cmpSort}>Fornecedor</SortTh>
          <span>Itens</span>
          <SortTh label="Valor" sortKey="valorTotal" currentKey={cmpSK} currentDir={cmpSD} onSort={cmpSort} align="right"><span style={{width:"100%",textAlign:"right"}}>Valor</span></SortTh>
          <span>Pagamento</span>
          <SortTh label="Status" sortKey="status" currentKey={cmpSK} currentDir={cmpSD} onSort={cmpSort}>Status</SortTh>
        </div>
        {tabelaItens.length === 0
          ? <div className="rcr-empty" style={{ padding: 40 }}><ShoppingCart size={24} opacity={0.3} /><p>Nenhuma compra com os filtros selecionados.</p></div>
          : [...tabelaItens].map(c=>({...c, _nomeSort: getNome(c)})).sort((a,b)=>{
              const va=a[cmpSK],vb=b[cmpSK];
              if(cmpSK==="data"){ const da=new Date(a.data),db=new Date(b.data); return cmpSD==="asc"?da-db:db-da; }
              if(cmpSK==="valorTotal"){ const na=Number(a.valorTotal||0),nb=Number(b.valorTotal||0); return cmpSD==="asc"?na-nb:nb-na; }
              const sa=String(va??"").toLowerCase(),sb=String(vb??"").toLowerCase();
              return cmpSD==="asc"?sa.localeCompare(sb,"pt-BR"):sb.localeCompare(sa,"pt-BR");
            }).map((c) => {
              const d = parseDateISO(c.data);
              return (
                <div key={c.id} className="rcr-row" style={{ gridTemplateColumns: "90px 1fr 1fr 120px 140px 100px" }}>
                  <span>{d ? d.split("-").reverse().join("/") : "—"}</span>
                  <span style={{ color: "var(--text)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{getNome(c)}</span>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{getDesc(c)}</span>
                  <span style={{ textAlign: "right", fontFamily: "Sora,sans-serif", fontWeight: 600, color: c.status === "cancelado" ? "var(--text-3)" : "var(--text)" }}>{fmtR$(Number(c.valorTotal || 0))}</span>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{getMetodo(c)}</span>
                  <span><span className={`rcr-badge ${c.status || "pendente"}`}>{c.status || "pendente"}</span></span>
                </div>
              );
            })
        }
      </div>

      {/* ── Métricas rápidas ── */}
      {filtrados.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div className="rcr-highlight-row">
            <span>Taxa de cancelamento</span>
            <span className="val">{fmtPct((canceladas.length / filtrados.length) * 100)}</span>
          </div>
          <div className="rcr-highlight-row">
            <span>Total de transações no período</span>
            <span className="val">{filtrados.length}</span>
          </div>
          {pagas.length > 0 && (
            <div className="rcr-highlight-row">
              <span>Maior compra registrada</span>
              <span className="val">{fmtR$(Math.max(...pagas.map((c) => Number(c.valorTotal || 0))))}</span>
            </div>
          )}
        </div>
      )}

      {/* ── Insights ── */}
      {insights.length > 0 && (
        <>
          <div className="rcr-section-title"><Zap size={15} />Insights Automáticos</div>
          <div className="rcr-insights">{insights.map((ins, i) => <RcrInsight key={i} tipo={ins.tipo} texto={ins.texto} />)}</div>
        </>
      )}

      {/* ── Gráficos ── */}
      {evolucaoMensal.length > 1 && (
        <>
          <div className="rcr-section-title"><BarChart2 size={15} />Análise Visual</div>
          <div className="rcr-charts-grid trio">
            <div className="rcr-chart-card">
              <div className="rcr-chart-header">
                <div className="rcr-chart-title">
                  <div className="rcr-chart-title-dot" style={{ color: "var(--gold)", background: "var(--gold)" }} />
                  Evolução Mensal de Despesas
                </div>
                <span className="rcr-chart-badge">Barras</span>
              </div>
              <div className="rcr-chart-body">
                <RcrBarChart dados={evolucaoMensal} colorFn={(d, i) => `rgba(200,165,94,${0.4 + (i / Math.max(evolucaoMensal.length - 1, 1)) * 0.6})`} />
              </div>
            </div>
            {distPagamento.length > 0 && (
              <div className="rcr-chart-card">
                <div className="rcr-chart-header">
                  <div className="rcr-chart-title">
                    <div className="rcr-chart-title-dot" style={{ color: "var(--blue, #5b8ef0)", background: "var(--blue, #5b8ef0)" }} />
                    Por Método de Pagamento
                  </div>
                </div>
                <div className="rcr-chart-body"><RcrDonut dados={distPagamento} size={120} /></div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Pagas vs Canceladas + Ticket médio mensal ── */}
      {(pagas.length > 0 || canceladas.length > 0) && (
        <div className="rcr-charts-grid">
          <div className="rcr-chart-card">
            <div className="rcr-chart-header">
              <div className="rcr-chart-title"><div className="rcr-chart-title-dot" style={{ color: "var(--green)", background: "var(--green)" }} />Pagas vs Canceladas</div>
            </div>
            <div className="rcr-chart-body">
              <RcrDonut dados={[{ nome: "Pagas", valor: totalGasto }, { nome: "Pendentes", valor: totalPendente }, { nome: "Canceladas", valor: totalCancelado }].filter((d) => d.valor > 0)} size={110} />            </div>
          </div>
          {evolucaoMensal.length > 1 && (
            <div className="rcr-chart-card">
              <div className="rcr-chart-header">
                <div className="rcr-chart-title"><div className="rcr-chart-title-dot" style={{ color: "var(--green)", background: "var(--green)" }} />Ticket Médio Mensal</div>
              </div>
              <div className="rcr-chart-body">
                <RcrBarChart dados={evolucaoMensal.map((m) => ({ ...m, total: m.count > 0 ? m.total / m.count : 0 }))} colorFn={() => "rgba(72,199,142,0.7)"} height={120} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Ranking de fornecedores ── */}
      {rankFornecedores.length > 0 && (
        <>
          <div className="rcr-section-title"><Users size={15} />Ranking de Fornecedores</div>
          <div className="rcr-chart-card">
            <div className="rcr-chart-header">
              <div className="rcr-chart-title"><div className="rcr-chart-title-dot" style={{ color: "var(--gold)", background: "var(--gold)" }} />Top Fornecedores por Gasto</div>
              <span className="rcr-chart-badge">{rankFornecedores.length} fornecedores</span>
            </div>
            <div className="rcr-chart-body">
              <div className="rcr-rank-list">
                {rankFornecedores.map((f, i) => {
                  const pct = totalGasto > 0 ? (f.total / totalGasto) * 100 : 0;
                  return (
                    <div key={f.nome} className="rcr-rank-item">
                      <span className="rcr-rank-pos">#{i + 1}</span>
                      <div className="rcr-rank-info">
                        <div className="rcr-rank-name">{f.nome}</div>
                        <div className="rcr-rank-sub">{f.qtd} compra{f.qtd !== 1 ? "s" : ""} · {fmtPct(pct)} do total</div>
                      </div>
                      <div className="rcr-rank-bar-wrap">
                        <div className="rcr-rank-bar-bg"><div className="rcr-rank-bar-fill" style={{ width: `${pct}%`, background: CORES[i % CORES.length] }} /></div>
                      </div>
                      <span className="rcr-rank-val">{fmtR$(f.total)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}

    </div>
  );
}

/* ══════════════════════════════════════════════════════
   RELATÓRIO: CONTAS A RECEBER
   ══════════════════════════════════════════════════════ */
function RelatorioContasReceber({ aReceber = [], intervalo }) {
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [rctSK, setRctSK] = useState("dataVencimento");
  const [rctSD, setRctSD] = useState("asc");
  const rctSort = (k) => { if(rctSK===k){ setRctSD(d=>d==="asc"?"desc":"asc"); } else { setRctSK(k); setRctSD("asc"); } };
  const hoje = hojeISO_rcr();

  const calcStatusRcr = useCallback((item) => {
    const restante = Number(item.valorRestante ?? item.valor ?? 0);
    if (restante <= 0) return "pago";
    const venc = parseDateISO(item.dataVencimento);
    if (venc && venc < hoje) return "vencido";
    return "pendente";
  }, [hoje]);

  const comStatus = useMemo(() => aReceber.map((i) => ({ ...i, _status: calcStatusRcr(i) })), [aReceber, calcStatusRcr]);

  const filtrados = useMemo(() => comStatus.filter((item) => {
    const d = parseDateISO(item.dataVencimento) || parseDateISO(item.dataCriacao);
    if (!dentroIntervalo_rcr(d, intervalo)) return false;
    if (filtroStatus !== "todos" && item._status !== filtroStatus) return false;
    return true;
  }), [comStatus, intervalo, filtroStatus]);

  const pagos    = useMemo(() => filtrados.filter((i) => i._status === "pago"),    [filtrados]);
  const pendentes= useMemo(() => filtrados.filter((i) => i._status === "pendente"),[filtrados]);
  const vencidos = useMemo(() => filtrados.filter((i) => i._status === "vencido"), [filtrados]);

  const totalRecebido = useMemo(() => pagos.reduce((s, i) => s + Number(i.valorTotal || i.valor || 0), 0), [pagos]);
  const totalPendente = useMemo(() => pendentes.reduce((s, i) => s + Number(i.valorRestante ?? i.valor ?? 0), 0), [pendentes]);
  const totalVencido  = useMemo(() => vencidos.reduce((s, i) => s + Number(i.valorRestante ?? i.valor ?? 0), 0), [vencidos]);
  const totalGeral    = useMemo(() => filtrados.reduce((s, i) => s + Number(i.valorTotal || i.valor || 0), 0), [filtrados]);

  const txInadimplencia = useMemo(() => {
    const base = totalPendente + totalVencido + totalRecebido;
    return base > 0 ? (totalVencido / base) * 100 : 0;
  }, [totalVencido, totalPendente, totalRecebido]);

  const tempoMedioPag = useMemo(() => {
    const c = pagos.filter((i) => i.dataPagamento && (i.dataEmissao || i.dataCriacao));
    if (!c.length) return null;
    const diffs = c.map((i) => {
      const e = new Date(parseDateISO(i.dataEmissao || i.dataCriacao));
      const p = new Date(parseDateISO(i.dataPagamento));
      return Math.max(0, (p - e) / 86400000);
    });
    return diffs.reduce((s, d) => s + d, 0) / diffs.length;
  }, [pagos]);

  const evolucaoRecebido = useMemo(() => agruparPorMes_rcr(pagos, "dataPagamento", "valorTotal"), [pagos]);

  const tendencia = useMemo(() => {
    if (evolucaoRecebido.length < 2) return null;
    return calcTendencia_rcr(evolucaoRecebido[evolucaoRecebido.length - 1].total, evolucaoRecebido[evolucaoRecebido.length - 2].total);
  }, [evolucaoRecebido]);

  const rankClientes = useMemo(() => {
    const mapa = {};
    filtrados.forEach((item) => {
      const nome = item.clienteNome || item.cliente || item.nomeCliente || "Sem cliente";
      if (!mapa[nome]) mapa[nome] = { nome, totalPago: 0, totalPendente: 0, qtd: 0 };
      mapa[nome].totalPago     += item._status === "pago"  ? Number(item.valorTotal || item.valor || 0) : 0;
      mapa[nome].totalPendente += item._status !== "pago"  ? Number(item.valorRestante ?? item.valor ?? 0) : 0;
      mapa[nome].qtd++;
    });
    return Object.values(mapa).sort((a, b) => (b.totalPago + b.totalPendente) - (a.totalPago + a.totalPendente)).slice(0, 8);
  }, [filtrados]);

  const fluxoFuturo = useMemo(() => {
    const limite = new Date();
    limite.setDate(limite.getDate() + 30);
    const limiISO = `${limite.getFullYear()}-${String(limite.getMonth()+1).padStart(2,"0")}-${String(limite.getDate()).padStart(2,"0")}`;
    return comStatus
      .filter((i) => i._status !== "pago")
      .map((i) => ({ ...i, _venc: parseDateISO(i.dataVencimento) }))
      .filter((i) => i._venc && i._venc >= hoje && i._venc <= limiISO)
      .sort((a, b) => a._venc.localeCompare(b._venc))
      .slice(0, 15);
  }, [comStatus, hoje]);

  const totalFluxo30 = useMemo(() => fluxoFuturo.reduce((s, i) => s + Number(i.valorRestante ?? i.valor ?? 0), 0), [fluxoFuturo]);

  const insights = useMemo(() => {
    const lista = [];
    if (txInadimplencia > 15)      lista.push({ tipo: "danger", texto: `<strong>⚠ Inadimplência alta:</strong> ${fmtPct(txInadimplencia)} do valor a receber está vencido. Acione os clientes em atraso.` });
    else if (txInadimplencia > 5)  lista.push({ tipo: "warn",   texto: `<strong>Atenção:</strong> inadimplência em <strong>${fmtPct(txInadimplencia)}</strong>. Fique de olho nos vencimentos.` });
    else if (filtrados.length > 0) lista.push({ tipo: "good",   texto: `<strong>Inadimplência sob controle:</strong> apenas <strong>${fmtPct(txInadimplencia)}</strong> do valor está vencido.` });
    if (totalFluxo30 > 0)          lista.push({ tipo: "info",   texto: `<strong>Previsão 30 dias:</strong> você deve receber <strong>${fmtR$(totalFluxo30)}</strong> em ${fluxoFuturo.length} cobranças pendentes.` });
    if (tendencia !== null) {
      if (tendencia > 15)          lista.push({ tipo: "good",   texto: `<strong>Receita em crescimento:</strong> alta de <strong>${tendencia.toFixed(1)}%</strong> vs mês anterior.` });
      else if (tendencia < -15)    lista.push({ tipo: "warn",   texto: `<strong>Receita em queda:</strong> redução de <strong>${Math.abs(tendencia).toFixed(1)}%</strong> vs mês anterior.` });
    }
    if (tempoMedioPag !== null && tempoMedioPag > 15) lista.push({ tipo: "warn", texto: `<strong>Prazo longo:</strong> clientes levam em média <strong>${tempoMedioPag.toFixed(0)} dias</strong> para pagar.` });
    if (rankClientes.length > 0 && totalGeral > 0) {
      const top = rankClientes[0];
      const pct = ((top.totalPago + top.totalPendente) / totalGeral) * 100;
      if (pct > 50) lista.push({ tipo: "warn", texto: `<strong>Concentração de receita:</strong> <strong>${top.nome}</strong> representa ${pct.toFixed(0)}% da receita total.` });
    }
    return lista;
  }, [txInadimplencia, totalFluxo30, fluxoFuturo, tendencia, tempoMedioPag, rankClientes, totalGeral, filtrados]);

  const tabelaItens = useMemo(() =>
    [...filtrados].sort((a, b) => (parseDateISO(a.dataVencimento) || "").localeCompare(parseDateISO(b.dataVencimento) || "")).slice(0, 50),
    [filtrados]
  );

  const handleExport = useCallback(() => {
    exportarExcel("a-receber", [{
      nome: "A Receber",
      colunas: ["Vencimento", "Cliente", "Descrição", "Valor Total (R$)", "Valor Restante (R$)", "Status"],
      dados: tabelaItens.map((i) => [
        parseDateISO(i.dataVencimento) || "",
        i.cliente || i.nomeCliente || "",
        i.descricao || "",
        Number(i.valorTotal || i.valor || 0),
        Number(i.valorRestante ?? i.valor ?? 0),
        i._status,
      ]),
    }]);
  }, [tabelaItens]);

  if (!aReceber.length) return <div className="rcr-empty"><Receipt size={32} opacity={0.3} /><p>Nenhuma conta a receber registrada.</p></div>;

  const CORES = ["#48c78e","#C8A55E","#5b8ef0","#e05252","#9b59b6","#e67e22","#1abc9c","#e74c3c"];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>

      {/* ── Filtros de status ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span className="rcr-filter-label">Status</span>
        <div className="rcr-filters">
          {["todos","pendente","vencido","pago"].map((s) => (
            <button key={s} className={`rcr-filter-btn ${filtroStatus === s ? "active" : ""}`} onClick={() => setFiltroStatus(s)}>
              {s === "todos" ? "Todos" : s[0].toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* ── KPIs clicáveis ── */}
      <div className="rcr-kpi-grid">
        <RcrKpi icon={CheckCircle} label="Receita Recebida"       value={fmtR$(totalRecebido)}  cor="green" trend={tendencia}   onClick={() => setFiltroStatus(f => f === "pago"     ? "todos" : "pago")}     active={filtroStatus === "pago"} />
        <RcrKpi icon={Clock}       label="Pendente a Receber"     value={fmtR$(totalPendente)}  cor="gold"  sub={`${pendentes.length} cobranças`}                                    onClick={() => setFiltroStatus(f => f === "pendente" ? "todos" : "pendente")} active={filtroStatus === "pendente"} />
        <RcrKpi icon={AlertCircle} label="Vencido / Inadimplente" value={fmtR$(totalVencido)}   cor="red"   sub={fmtPct(txInadimplencia) + " inadimplência"}                         onClick={() => setFiltroStatus(f => f === "vencido"  ? "todos" : "vencido")}  active={filtroStatus === "vencido"} />
        <RcrKpi icon={Calendar}    label="Previsão 30 dias"       value={fmtR$(totalFluxo30)}   cor="blue"  sub={`${fluxoFuturo.length} cobranças futuras`} />
      </div>

      {/* ── Tabela detalhada ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div className="rcr-section-title"><Receipt size={15} />Detalhamento</div>
        <button className="btn-secondary" style={{ fontSize: 12, padding: "6px 14px" }} onClick={handleExport}><Download size={13} />Exportar Excel</button>
      </div>
      <div className="rcr-table-wrap">
        <div className="rcr-table-header"><span className="rcr-table-title">Contas a Receber</span><span className="rcr-table-badge">{tabelaItens.length} registros</span></div>
        <div className="rcr-row rcr-row-head" style={{ gridTemplateColumns: "95px 1fr 1fr 120px 120px 100px" }}>
          <SortTh label="Vencimento" sortKey="dataVencimento" currentKey={rctSK} currentDir={rctSD} onSort={rctSort}>Vencimento</SortTh>
          <SortTh label="Cliente" sortKey="cliente" currentKey={rctSK} currentDir={rctSD} onSort={rctSort}>Cliente</SortTh>
          <SortTh label="Descrição" sortKey="descricao" currentKey={rctSK} currentDir={rctSD} onSort={rctSort}>Descrição</SortTh>
          <SortTh label="Valor Total" sortKey="valorTotal" currentKey={rctSK} currentDir={rctSD} onSort={rctSort} align="right"><span style={{width:"100%",textAlign:"right"}}>Valor Total</span></SortTh>
          <SortTh label="Restante" sortKey="valorRestante" currentKey={rctSK} currentDir={rctSD} onSort={rctSort} align="right"><span style={{width:"100%",textAlign:"right"}}>Restante</span></SortTh>
          <SortTh label="Status" sortKey="_status" currentKey={rctSK} currentDir={rctSD} onSort={rctSort}>Status</SortTh>
        </div>
        {tabelaItens.length === 0
          ? <div className="rcr-empty" style={{ padding: 40 }}><Receipt size={24} opacity={0.3} /><p>Nenhuma conta com os filtros selecionados.</p></div>
          : [...tabelaItens].sort((a,b)=>{
              const va=a[rctSK],vb=b[rctSK];
              if(rctSK==="dataVencimento"){ const da=new Date(a.dataVencimento),db=new Date(b.dataVencimento); return rctSD==="asc"?da-db:db-da; }
              if(rctSK==="valorTotal"||rctSK==="valorRestante"){ const na=Number(a[rctSK]||0),nb=Number(b[rctSK]||0); return rctSD==="asc"?na-nb:nb-na; }
              const sa=String(va??"").toLowerCase(),sb=String(vb??"").toLowerCase();
              return rctSD==="asc"?sa.localeCompare(sb,"pt-BR"):sb.localeCompare(sa,"pt-BR");
            }).map((item, i) => {
              const d = parseDateISO(item.dataVencimento);
              const dFmt = d ? d.split("-").reverse().join("/") : "—";
              const vTotal    = Number(item.valorTotal || item.valor || 0);
              const vRestante = Number(item.valorRestante ?? vTotal);
              return (
                <div key={item.id || i} className="rcr-row" style={{ gridTemplateColumns: "95px 1fr 1fr 120px 120px 100px", background: d === hoje ? "rgba(200,165,94,0.04)" : undefined }}>
                  <span style={{ color: item._status === "vencido" ? "var(--red)" : "var(--text-2)" }}>{dFmt}</span>
                  <span style={{ color: "var(--text)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.cliente || item.nomeCliente || "—"}</span>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.descricao || "—"}</span>
                  <span style={{ textAlign: "right", fontFamily: "Sora,sans-serif", fontWeight: 600, color: "var(--text)" }}>{fmtR$(vTotal)}</span>
                  <span style={{ textAlign: "right", fontFamily: "Sora,sans-serif", fontWeight: 600, color: item._status === "pago" ? "var(--green)" : item._status === "vencido" ? "var(--red)" : "var(--gold)" }}>{fmtR$(vRestante)}</span>
                  <span><span className={`rcr-badge ${item._status}`}>{item._status}</span></span>
                </div>
              );
            })
        }
      </div>

      {/* ── Métricas rápidas ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div className="rcr-highlight-row">
          <span>Taxa de inadimplência</span>
          <span className="val" style={{ color: txInadimplencia > 10 ? "var(--red)" : txInadimplencia > 5 ? "var(--gold)" : "var(--green)" }}>{fmtPct(txInadimplencia)}</span>
        </div>
        {tempoMedioPag !== null && (
          <div className="rcr-highlight-row"><span>Tempo médio de pagamento</span><span className="val">{tempoMedioPag.toFixed(0)} dias</span></div>
        )}
        <div className="rcr-highlight-row"><span>Total registrado no período</span><span className="val">{fmtR$(totalGeral)}</span></div>
      </div>

      {/* ── Insights ── */}
      {insights.length > 0 && (
        <>
          <div className="rcr-section-title"><Zap size={15} />Insights Automáticos</div>
          <div className="rcr-insights">{insights.map((ins, i) => <RcrInsight key={i} tipo={ins.tipo} texto={ins.texto} />)}</div>
        </>
      )}

      {/* ── Gráficos ── */}
      {evolucaoRecebido.length > 1 && (
        <>
          <div className="rcr-section-title"><BarChart2 size={15} />Análise Visual</div>
          <div className="rcr-charts-grid trio">
            <div className="rcr-chart-card">
              <div className="rcr-chart-header">
                <div className="rcr-chart-title"><div className="rcr-chart-title-dot" style={{ color: "var(--green)", background: "var(--green)" }} />Receita Recebida por Mês</div>
                <span className="rcr-chart-badge">Barras</span>
              </div>
              <div className="rcr-chart-body">
                <RcrBarChart dados={evolucaoRecebido} colorFn={(d, i) => `rgba(72,199,142,${0.4 + (i / Math.max(evolucaoRecebido.length - 1, 1)) * 0.6})`} />
              </div>
            </div>
            <div className="rcr-chart-card">
              <div className="rcr-chart-header">
                <div className="rcr-chart-title"><div className="rcr-chart-title-dot" style={{ color: "var(--red)", background: "var(--red)" }} />Distribuição por Status</div>
              </div>
              <div className="rcr-chart-body">
                <RcrDonut dados={[{ nome: "Recebido", valor: totalRecebido }, { nome: "Pendente", valor: totalPendente }, { nome: "Vencido", valor: totalVencido }].filter((d) => d.valor > 0)} size={110} />
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Ranking de clientes ── */}
      {rankClientes.length > 0 && (
        <>
          <div className="rcr-section-title"><Users size={15} />Ranking de Clientes</div>
          <div className="rcr-chart-card">
            <div className="rcr-chart-header">
              <div className="rcr-chart-title"><div className="rcr-chart-title-dot" style={{ color: "var(--green)", background: "var(--green)" }} />Clientes que Mais Geram Receita</div>
              <span className="rcr-chart-badge">{rankClientes.length} clientes</span>
            </div>
            <div className="rcr-chart-body">
              <div className="rcr-rank-list">
                {rankClientes.map((cl, i) => {
                  const tot = cl.totalPago + cl.totalPendente;
                  const pct = totalGeral > 0 ? (tot / totalGeral) * 100 : 0;
                  return (
                    <div key={cl.nome} className="rcr-rank-item">
                      <span className="rcr-rank-pos">#{i + 1}</span>
                      <div className="rcr-rank-info">
                        <div className="rcr-rank-name">{cl.nome}</div>
                        <div className="rcr-rank-sub">{cl.qtd} cobranças · pago: {fmtR$(cl.totalPago)}{cl.totalPendente > 0 ? ` · pendente: ${fmtR$(cl.totalPendente)}` : ""}</div>
                      </div>
                      <div className="rcr-rank-bar-wrap">
                        <div className="rcr-rank-bar-bg"><div className="rcr-rank-bar-fill" style={{ width: `${pct}%`, background: CORES[i % CORES.length] }} /></div>
                      </div>
                      <span className="rcr-rank-val">{fmtR$(tot)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Fluxo de caixa futuro ── */}
      {fluxoFuturo.length > 0 && (
        <>
          <div className="rcr-section-title" style={{ justifyContent: "space-between" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}><Calendar size={15} style={{ color: "var(--gold)" }} />Fluxo de Caixa — Próximos 30 dias</span>
            <span style={{ fontSize: 12, color: "var(--text-3)" }}>Previsão: <strong style={{ color: "var(--green)" }}>{fmtR$(totalFluxo30)}</strong></span>
          </div>
          <div className="rcr-chart-card">
            <div className="rcr-chart-header">
              <div className="rcr-chart-title"><div className="rcr-chart-title-dot" style={{ color: "var(--blue, #5b8ef0)", background: "var(--blue, #5b8ef0)" }} />Cobranças com Vencimento Futuro</div>
              <span className="rcr-chart-badge">{fluxoFuturo.length} cobranças</span>
            </div>
            <div className="rcr-chart-body">
              <div className="rcr-cashflow">
                {fluxoFuturo.map((item, i) => {
                  const d = item._venc ? item._venc.split("-").reverse().join("/") : "—";
                  const val = Number(item.valorRestante ?? item.valor ?? 0);
                  const dias = item._venc ? Math.ceil((new Date(item._venc) - new Date(hoje)) / 86400000) : null;
                  return (
                    <div key={item.id || i} className="rcr-cf-row">
                      <span className="rcr-cf-date">{d}</span>
                      <span className="rcr-cf-desc">{item.cliente || item.nomeCliente || "—"} — {item.descricao || "Cobrança"}</span>
                      {dias !== null && <span style={{ fontSize: 10, color: dias <= 3 ? "var(--red)" : "var(--text-3)", marginRight: 8 }}>{dias === 0 ? "Hoje" : dias === 1 ? "Amanhã" : `em ${dias}d`}</span>}
                      <span className={`rcr-cf-val ${item._status}`}>{fmtR$(val)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}

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
  alunos:        ["financeiro", "comercial", "vendedor", "suporte"],  // ← NOVO
  mensalidades:  ["financeiro", "comercial"],       
  agenda:     ["comercial", "vendedor", "suporte"],
  lucro_ps:            ["financeiro", "comercial"],
  vendedores:          ["financeiro", "comercial"],
  rel_compras:         ["financeiro", "compras"],
  rel_contas_receber:  ["financeiro", "comercial"],
  pdv:                 ["financeiro", "comercial", "vendedor", "suporte"],
};

const MENU = [
  { key: "dre",        label: "DRE",          icon: <LayoutDashboard size={15} /> },
  { key: "financeiro", label: "Financeiro",   icon: <Wallet size={15} />         },
  { key: "lucro_ps",   label: "Produtos & Serviços", icon: <DollarSign size={15} />     },
  { key: "vendas",     label: "Vendas",       icon: <ShoppingCart size={15} />   },
  { key: "pdv",        label: "PDV",          icon: <Receipt size={15} />        },
  { key: "vendedores", label: "Vendedores",   icon: <Users size={15} />          },
  { key: "clientes",   label: "Clientes",     icon: <Users size={15} />          },
   { key: "alunos",       label: "Alunos",         icon: <Users size={15} />        },  // ← NOVO
  { key: "mensalidades", label: "Mensalidades",   icon: <CreditCard size={15} />   },  // ← NOVO
  { key: "despesas",   label: "Despesas",     icon: <Receipt size={15} />        },
  { key: "estoque",           label: "Estoque",           icon: <Package size={15} />     },
  { key: "agenda",            label: "Agenda",            icon: <Calendar size={15} />    },
  { key: "rel_compras",       label: "Rel. Compras",      icon: <ShoppingCart size={15} /> },
  { key: "rel_contas_receber",label: "Rel. A. Receber",   icon: <Receipt size={15} />     },
];

const TITULO_RELATORIO = {
  dre:        "DRE — Demonstração do Resultado",
  financeiro: "Relatório Financeiro",
  vendas:     "Relatório de Vendas",
  despesas:   "Relatório de Despesas",
  estoque:    "Relatório de Estoque",
  clientes:   "Relatório de Clientes",
   alunos:       "Relatório de Alunos",              // ← NOVO
  mensalidades: "Relatório de Mensalidades", 
  agenda:     "Relatório de Agenda",
  lucro_ps:            "Produtos & Serviços",
  vendedores:          "Relatório de Vendedores",
  rel_compras:         "Relatório de Compras",
  rel_contas_receber:  "Relatório de Contas a Receber",
  pdv:        "Relatório de PDV",
};


/* ══════════════════════════════════════════════════════
   RELATÓRIO: VENDEDORES
   ══════════════════════════════════════════════════════ */
function RelatorioVendedores({ vendas, vendedores, intervalo }) {
  const [vendedorSel, setVendedorSel] = useState("todos");
  const [vndSK, setVndSK] = useState("faturamento");
  const [vndSD, setVndSD] = useState("desc");
  const vndSort = (k) => { if(vndSK===k){ setVndSD(d=>d==="asc"?"desc":"asc"); } else { setVndSK(k); setVndSD("asc"); } };
  const [txSK, setTxSK] = useState("data");
  const [txSD, setTxSD] = useState("desc");
  const txSort = (k) => { if(txSK===k){ setTxSD(d=>d==="asc"?"desc":"asc"); } else { setTxSK(k); setTxSD("asc"); } };
  const [vendedorDropOpen, setVendedorDropOpen] = useState(false);
  const vendedorDropRef = useRef(null);

  /* Fecha o dropdown ao clicar fora */
  useEffect(() => {
    if (!vendedorDropOpen) return;
    const handler = (e) => {
      if (vendedorDropRef.current && !vendedorDropRef.current.contains(e.target)) {
        setVendedorDropOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [vendedorDropOpen]);

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

      {/* ── Filtro de vendedor — dropdown customizado ── */}
      <div style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "11px 16px",
        background: "var(--s1)", border: "1px solid var(--border)", borderRadius: 10,
      }}>
        <span style={{
          fontSize: 10, fontWeight: 600, textTransform: "uppercase",
          letterSpacing: ".07em", color: "var(--text-3)", flexShrink: 0,
          display: "flex", alignItems: "center", gap: 5,
        }}>
          <Users size={12} /> Vendedor
        </span>

        {/* Dropdown customizado */}
        <div ref={vendedorDropRef} style={{ position: "relative" }}>
          <button
            onClick={() => setVendedorDropOpen(v => !v)}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "6px 12px", borderRadius: 8,
              background: vendedorDropOpen ? "var(--s2)" : "var(--s3)",
              border: `1px solid ${vendedorDropOpen ? "var(--gold)" : "var(--border-h)"}`,
              color: "var(--text)", cursor: "pointer",
              fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 500,
              minWidth: 200, maxWidth: 280,
              transition: "all .13s",
            }}
          >
            <span style={{
              flex: 1, textAlign: "left", overflow: "hidden",
              textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {vendedorSel === "todos"
                ? "Todos (Ranking)"
                : (statsMap[vendedorSel]?.nome
                    || vendedores.find(v => v.id === vendedorSel)?.nome
                    || vendedorSel)}
            </span>
            <ChevronDown
              size={14}
              style={{
                color: "var(--text-3)", flexShrink: 0,
                transition: "transform .2s ease",
                transform: vendedorDropOpen ? "rotate(180deg)" : "rotate(0deg)",
              }}
            />
          </button>

          {vendedorDropOpen && (
            <div style={{
              position: "absolute", top: "calc(100% + 6px)", left: 0,
              minWidth: "100%", width: "max-content", maxWidth: 320,
              background: "var(--s1)", border: "1px solid var(--border-h)",
              borderRadius: 10, boxShadow: "0 12px 36px rgba(0,0,0,0.45)",
              overflow: "hidden", zIndex: 400,
              animation: "rel-dd-in .13s ease",
            }}>
              {/* Opção "Todos" */}
              <button
                onClick={() => { setVendedorSel("todos"); setVendedorDropOpen(false); }}
                style={{
                  display: "flex", alignItems: "center", gap: 9,
                  width: "100%", padding: "9px 12px", border: "none",
                  background: vendedorSel === "todos" ? "rgba(200,165,94,0.12)" : "transparent",
                  color: vendedorSel === "todos" ? "var(--gold)" : "var(--text)",
                  fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 500,
                  cursor: "pointer", textAlign: "left", transition: "background .1s",
                }}
                onMouseEnter={e => { if (vendedorSel !== "todos") e.currentTarget.style.background = "var(--s2)"; }}
                onMouseLeave={e => { if (vendedorSel !== "todos") e.currentTarget.style.background = "transparent"; }}
              >
                <span style={{
                  width: 6, height: 6, borderRadius: "50%", flexShrink: 0,
                  background: vendedorSel === "todos" ? "var(--gold)" : "var(--border-h)",
                  boxShadow: vendedorSel === "todos" ? "0 0 6px rgba(200,165,94,.5)" : "none",
                }} />
                Todos (Ranking)
              </button>

              {/* Divider se houver vendedores */}
              {ranking.length > 0 && (
                <div style={{ height: 1, background: "var(--border)", margin: "2px 0" }} />
              )}

              {/* Lista com scroll */}
              <div style={{ maxHeight: 220, overflowY: "auto", padding: "4px 0" }}>
                <div style={{
                  fontSize: 9, fontWeight: 700, letterSpacing: ".08em",
                  textTransform: "uppercase", color: "var(--text-3)",
                  padding: "4px 12px 2px",
                }}>
                  Com vendas no período
                </div>
                {ranking.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => { setVendedorSel(r.id); setVendedorDropOpen(false); }}
                    style={{
                      display: "flex", alignItems: "center", gap: 9,
                      width: "100%", padding: "8px 12px", border: "none",
                      background: vendedorSel === r.id ? "rgba(200,165,94,0.12)" : "transparent",
                      color: vendedorSel === r.id ? "var(--gold)" : "var(--text-2)",
                      fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 500,
                      cursor: "pointer", textAlign: "left", transition: "background .1s",
                    }}
                    onMouseEnter={e => { if (vendedorSel !== r.id) e.currentTarget.style.background = "var(--s2)"; }}
                    onMouseLeave={e => { if (vendedorSel !== r.id) e.currentTarget.style.background = "transparent"; }}
                  >
                    <span style={{
                      width: 6, height: 6, borderRadius: "50%", flexShrink: 0,
                      background: vendedorSel === r.id ? "var(--gold)" : "var(--border-h)",
                      boxShadow: vendedorSel === r.id ? "0 0 6px rgba(200,165,94,.5)" : "none",
                    }} />
                    <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {r.nome}
                    </span>
                    <span style={{ fontSize: 11, color: "var(--text-3)", flexShrink: 0 }}>
                      {r.qtd} venda{r.qtd !== 1 ? "s" : ""}
                    </span>
                  </button>
                ))}

                {/* Vendedores sem vendas */}
                {vendedores.filter((v) => !statsMap[v.id]).length > 0 && (
                  <>
                    <div style={{
                      fontSize: 9, fontWeight: 700, letterSpacing: ".08em",
                      textTransform: "uppercase", color: "var(--text-3)",
                      padding: "8px 12px 2px",
                      borderTop: "1px solid var(--border)", marginTop: 2,
                    }}>
                      Sem vendas no período
                    </div>
                    {vendedores.filter((v) => !statsMap[v.id]).map((v) => (
                      <button
                        key={v.id}
                        onClick={() => { setVendedorSel(v.id); setVendedorDropOpen(false); }}
                        style={{
                          display: "flex", alignItems: "center", gap: 9,
                          width: "100%", padding: "8px 12px", border: "none",
                          background: vendedorSel === v.id ? "rgba(200,165,94,0.08)" : "transparent",
                          color: vendedorSel === v.id ? "var(--gold)" : "var(--text-3)",
                          fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 400,
                          cursor: "pointer", textAlign: "left", opacity: 0.65,
                          transition: "background .1s",
                        }}
                        onMouseEnter={e => { if (vendedorSel !== v.id) e.currentTarget.style.background = "var(--s2)"; }}
                        onMouseLeave={e => { if (vendedorSel !== v.id) e.currentTarget.style.background = "transparent"; }}
                      >
                        <span style={{
                          width: 6, height: 6, borderRadius: "50%", flexShrink: 0,
                          background: "var(--border-h)",
                        }} />
                        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {v.nome}
                        </span>
                        <span style={{ fontSize: 11, color: "var(--text-3)", flexShrink: 0 }}>
                          sem vendas
                        </span>
                      </button>
                    ))}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
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
                <SortTh label="Vendedor" sortKey="nome" currentKey={vndSK} currentDir={vndSD} onSort={vndSort}>Vendedor</SortTh>
                <span style={{ textAlign: "right" }}>Vendas</span>
                <SortTh label="Faturamento" sortKey="faturamento" currentKey={vndSK} currentDir={vndSD} onSort={vndSort} align="right"><span style={{display:"block",textAlign:"right",width:"100%"}}>Faturamento</span></SortTh>
                <SortTh label="Lucro" sortKey="lucro" currentKey={vndSK} currentDir={vndSD} onSort={vndSort} align="right"><span style={{display:"block",textAlign:"right",width:"100%"}}>Lucro Gerado</span></SortTh>
                <span style={{ textAlign: "right" }}>Com.%</span>
                <SortTh label="Comissão" sortKey="comissao" currentKey={vndSK} currentDir={vndSD} onSort={vndSort} align="right"><span style={{display:"block",textAlign:"right",width:"100%"}}>Comissão R$</span></SortTh>
              </div>

              {(vndSK ? [...ranking].sort((a,b)=>{ const na=a[vndSK],nb=b[vndSK]; if(typeof na==="string") return vndSD==="asc"?na.localeCompare(nb,"pt-BR"):nb.localeCompare(na,"pt-BR"); return vndSD==="asc"?Number(na)-Number(nb):Number(nb)-Number(na); }) : ranking).map((r, i) => {
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
                <SortTh label="Data" sortKey="data" currentKey={txSK} currentDir={txSD} onSort={txSort}>Data</SortTh>
                <SortTh label="Cliente" sortKey="cliente" currentKey={txSK} currentDir={txSD} onSort={txSort}>Cliente</SortTh>
                <span>Produto / Serviço</span>
                <span>Forma Pgto</span>
                <SortTh label="Total" sortKey="total" currentKey={txSK} currentDir={txSD} onSort={txSort} align="right"><span style={{display:"block",textAlign:"right",width:"100%"}}>Total</span></SortTh>
                <span style={{ textAlign: "right" }}>Lucro</span>
                <span style={{ textAlign: "right" }}>Comissão</span>
              </div>

              {([...transacoes].sort((a,b)=>{ if(txSK==="data"||!txSK){const da=new Date(a.data),db=new Date(b.data);return txSD==="asc"?da-db:db-da;} if(txSK==="total"){const na=Number(a.total||0),nb=Number(b.total||0);return txSD==="asc"?na-nb:nb-na;} const sa=String(a[txSK]||"").toLowerCase(),sb=String(b[txSK]||"").toLowerCase();return txSD==="asc"?sa.localeCompare(sb,"pt-BR"):sb.localeCompare(sa,"pt-BR"); })).map((v) => {
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
   RELATÓRIO: PDV
   Filtra vendas com origem === "pdv"
   Permissão excluir: somente admin
   ══════════════════════════════════════════════════════ */
function RelatorioPDV({ vendas, intervalo, isAdmin }) {
  const [pdvSK, setPdvSK] = useState("data");
  const [pdvSD, setPdvSD] = useState("desc");
  const pdvSort = (k) => { if(pdvSK===k){ setPdvSD(d=>d==="asc"?"desc":"asc"); } else { setPdvSK(k); setPdvSD("asc"); } };
  const vendasPDV = useMemo(() =>
    vendas.filter((v) =>
      v.origem === "pdv" &&
      v.status !== "cancelada" &&
      dentroDoIntervalo(v.data, intervalo)
    ),
    [vendas, intervalo]
  );

  /* KPIs */
  const totalFaturado = vendasPDV.reduce((s, v) => s + Number(v.total || 0), 0);
  const numVendas     = vendasPDV.length;
  const ticketMedio   = numVendas > 0 ? totalFaturado / numVendas : 0;

  /* Formas de pagamento */
  const fpMap = {};
  vendasPDV.forEach((v) => {
    const fp = v.formaPagamento || "Não informado";
    fpMap[fp] = (fpMap[fp] || 0) + Number(v.total || 0);
  });
  const fpList = Object.entries(fpMap)
    .sort((a, b) => b[1] - a[1])
    .map(([nome, val]) => ({ nome, val, pct: totalFaturado > 0 ? (val / totalFaturado) * 100 : 0 }));

  const FP_COLORS = { "Dinheiro": "#3ecf8e", "Pix": "#5b8ef0", "Cartão de Débito": "#f59e0b", "Cartão de Crédito": "#c8a55e", "Transferência": "#a78bfa" };

  /* Top produtos */
  const prodMap = {};
  vendasPDV.forEach((v) => {
    (v.itens || []).forEach((item) => {
      const nome = item.nome || item.produto?.nome || "—";
      if (!prodMap[nome]) prodMap[nome] = { qtd: 0, total: 0 };
      prodMap[nome].qtd   += Number(item.qty || item.quantidade || 1);
      prodMap[nome].total += Number(item.subtotal || 0);
    });
  });
  const topProd = Object.entries(prodMap)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 10);
  const maxProd = topProd[0]?.[1].total || 1;

  /* Export */
  const handleExport = () => {
    exportarExcel("pdv", [{
      nome: "PDV",
      colunas: ["ID", "Data", "Cliente", "Itens", "Forma Pagamento", "Total"],
      dados: vendasPDV.map((v) => [
        v.idVenda || "—",
        fmtData(v.data),
        v.cliente || "—",
        (v.itens || []).map(i => `${i.nome || "?"} x${i.qty || 1}`).join(", ") || "—",
        v.formaPagamento || "—",
        Number(v.total || 0).toFixed(2),
      ]),
    }]);
  };

  if (vendasPDV.length === 0) {
    return (
      <div className="rel-empty">
        <Receipt size={32} color="var(--text-3)" />
        <p>Nenhuma venda pelo PDV no período selecionado.</p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* KPIs */}
      <div className="cr-grid">
        <div className="cr-card">
          <div className="cr-icon-wrap" style={{ background: "rgba(200,165,94,0.12)" }}>
            <DollarSign size={18} color="var(--gold)" />
          </div>
          <div className="cr-body">
            <div className="cr-label">Total Faturado</div>
            <div className="cr-value" style={{ color: "var(--gold)" }}>{fmtR$(totalFaturado)}</div>
            <div className="cr-sub">{numVendas} venda{numVendas !== 1 ? "s" : ""} pelo PDV</div>
          </div>
        </div>
        <div className="cr-card">
          <div className="cr-icon-wrap" style={{ background: "rgba(91,142,240,0.12)" }}>
            <Receipt size={18} color="var(--blue)" />
          </div>
          <div className="cr-body">
            <div className="cr-label">Nº de Vendas</div>
            <div className="cr-value" style={{ color: "var(--blue)" }}>{numVendas}</div>
            <div className="cr-sub">transações no período</div>
          </div>
        </div>
        <div className="cr-card">
          <div className="cr-icon-wrap" style={{ background: "rgba(62,207,142,0.12)" }}>
            <TrendingUp size={18} color="var(--green)" />
          </div>
          <div className="cr-body">
            <div className="cr-label">Ticket Médio</div>
            <div className="cr-value" style={{ color: "var(--green)" }}>{fmtR$(ticketMedio)}</div>
            <div className="cr-sub">por venda no PDV</div>
          </div>
        </div>
      </div>

      {/* Formas de pagamento */}
      {fpList.length > 0 && (
        <div className="tr-wrap">
          <div className="tr-header">
            <span className="tr-title">Formas de Pagamento</span>
            <span className="tr-badge">{fpList.length} tipo{fpList.length !== 1 ? "s" : ""}</span>
          </div>
          <div style={{ padding: "14px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
            {fpList.map(({ nome, val, pct }) => {
              const cor = FP_COLORS[nome] || "var(--gold)";
              return (
                <div key={nome} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 3, height: 28, borderRadius: 2, background: cor, flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 13, color: "var(--text-2)", fontWeight: 500 }}>{nome}</span>
                  <div style={{ width: 120, height: 4, borderRadius: 4, background: "rgba(255,255,255,0.06)", overflow: "hidden", flexShrink: 0 }}>
                    <div style={{ width: `${pct}%`, height: "100%", borderRadius: 4, background: cor, transition: "width .5s" }} />
                  </div>
                  <span style={{ fontFamily: "'Sora',sans-serif", fontSize: 12, fontWeight: 700, color: "var(--text)", minWidth: 40, textAlign: "right" }}>{pct.toFixed(1)}%</span>
                  <span style={{ fontFamily: "'Sora',sans-serif", fontSize: 12, fontWeight: 600, color: cor, minWidth: 100, textAlign: "right" }}>{fmtR$(val)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Top produtos */}
      {topProd.length > 0 && (
        <div className="tr-wrap">
          <div className="tr-header">
            <span className="tr-title">Top Produtos Vendidos no PDV</span>
            <span className="tr-badge">{topProd.length}</span>
          </div>
          {topProd.map(([nome, { qtd, total }], i) => (
            <div key={nome} className="rv-prod-row" style={{ padding: "10px 18px" }}>
              <span className={`rv-prod-rank${i < 3 ? " top" : ""}`}>#{i + 1}</span>
              <span className="rv-prod-name">{nome}</span>
              <div className="rv-prod-bar-bg">
                <div className="rv-prod-bar-fill" style={{ width: `${(total / maxProd) * 100}%` }} />
              </div>
              <span className="rv-prod-qtd">{qtd} un.</span>
              <span className="rv-prod-val" style={{ color: "var(--gold)" }}>{fmtR$(total)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Tabela de transações */}
      <div className="tr-wrap">
        <div className="tr-header">
          <span className="tr-title">Transações PDV</span>
          <span className="tr-badge">{vendasPDV.length}</span>
        </div>
        <div className="tr-head" style={{ gridTemplateColumns: "88px 90px 1fr 1fr 120px 110px", display: "grid", padding: "9px 18px", gap: 8 }}>
          <SortTh label="Data" sortKey="data" currentKey={pdvSK} currentDir={pdvSD} onSort={pdvSort}>Data</SortTh>
          <SortTh label="ID" sortKey="idVenda" currentKey={pdvSK} currentDir={pdvSD} onSort={pdvSort}>ID</SortTh>
          <SortTh label="Cliente" sortKey="cliente" currentKey={pdvSK} currentDir={pdvSD} onSort={pdvSort}>Cliente</SortTh>
          <span>Itens</span>
          <span>Pagamento</span>
          <SortTh label="Total" sortKey="total" currentKey={pdvSK} currentDir={pdvSD} onSort={pdvSort} align="right"><span style={{display:"block",textAlign:"right",width:"100%"}}>Total</span></SortTh>
        </div>
        {[...vendasPDV].sort((a,b)=>{ if(pdvSK==="data"||!pdvSK){const da=new Date(a.data),db=new Date(b.data);return pdvSD==="asc"?da-db:db-da;} if(pdvSK==="total"){const na=Number(a.total||0),nb=Number(b.total||0);return pdvSD==="asc"?na-nb:nb-na;} const sa=String(a[pdvSK]||"").toLowerCase(),sb=String(b[pdvSK]||"").toLowerCase();return pdvSD==="asc"?sa.localeCompare(sb,"pt-BR"):sb.localeCompare(sa,"pt-BR"); }).map((v) => {
            const descItens = (v.itens || []).map(i => `${i.nome || "?"} x${i.qty || 1}`).join(", ") || "—";
            return (
              <div key={v.id} className="tr-row" style={{ gridTemplateColumns: "88px 90px 1fr 1fr 120px 110px" }}>
                <span style={{ fontFamily: "'Sora',sans-serif", fontSize: 11, color: "var(--text-3)" }}>{fmtData(v.data)}</span>
                <span style={{ fontFamily: "monospace", fontSize: 11, color: "var(--gold)" }}>{v.idVenda || "—"}</span>
                <span style={{ fontWeight: 500, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.cliente || "—"}</span>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--text-2)", fontSize: 11 }}>{descItens}</span>
                <span style={{ fontSize: 11, color: "var(--text-3)" }}>{v.formaPagamento || "—"}</span>
                <span style={{ textAlign: "right" }} className="val-pos">{fmtR$(v.total || 0)}</span>
              </div>
            );
          })}
      </div>

      {/* Export */}
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

  /* Relatórios ocultos — array de keys salvo no Firestore config */
  const [ocultos,       setOcultos]       = useState(new Set());
  const [modoGerenciar, setModoGerenciar] = useState(false);

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
  const [alunos,     setAlunos]     = useState([]);
  const [compras,      setCompras]      = useState([]);
  const [fornecedores, setFornecedores] = useState([]);

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
       onSnapshot(query(col("clientes"), where("perfis", "array-contains", "aluno")), (s) => setAlunos(s.docs.map((d) => ({ docId: d.id, ...d.data() }))),
        () => {}),  // filtra apenas alunos na coleção unificada /clientes
      onSnapshot(col("eventos"),   (s) => setAgenda(s.docs.map((d) => ({ id: d.id, ...d.data() }))),
        () => {}),
      onSnapshot(col("caixa"),    (s) => setCaixa(s.docs.map((d) => ({ id: d.id, ...d.data() }))),
        () => {}),
      onSnapshot(col("a_receber"), (s) => setAReceber(s.docs.map((d) => ({ id: d.id, ...d.data() }))),
        () => {}),
      onSnapshot(col("vendedores"), (s) => setVendedores(s.docs.map((d) => ({ id: d.id, ...d.data() }))),
        () => {}),
      onSnapshot(col("compras"),      (s) => setCompras(s.docs.map((d) => ({ id: d.id, ...d.data() }))),
        () => {}),
      onSnapshot(col("fornecedores"), (s) => setFornecedores(s.docs.map((d) => ({ id: d.id, ...d.data() }))),
        () => {}),
    ];

    // Fallback: garantir que loading pare mesmo sem despesas
    const timeout = setTimeout(() => setLoading(false), 3000);

    /* Carrega relatórios ocultos da config do tenant */
    getDoc(doc(db, "users", tenantUid, "config", "relatorios"))
      .then(s => {
        if (s.exists() && Array.isArray(s.data().ocultos)) {
          setOcultos(new Set(s.data().ocultos));
        }
      }).catch(() => {});

    return () => {
      subs.forEach((fn) => { try { fn(); } catch {} });
      clearTimeout(timeout);
    };
  }, [tenantUid]);

  /* Toggle oculto + persiste no Firestore */
  const toggleOculto = async (key) => {
    if (!tenantUid) return;
    const novoSet = new Set(ocultos);
    if (novoSet.has(key)) novoSet.delete(key);
    else novoSet.add(key);
    setOcultos(novoSet);
    try {
      await setDoc(
        doc(db, "users", tenantUid, "config", "relatorios"),
        { ocultos: [...novoSet] },
        { merge: true }
      );
    } catch {}
  };

  /* Intervalo calculado */
  const intervalo = useMemo(
    () => getIntervalo(periodo, dataInicio, dataFim),
    [periodo, dataInicio, dataFim]
  );

  /* Impressão */
  const handlePrint = useCallback(() => window.print(), []);

  /* Mobile dropdown */
  const [mobileOpen, setMobileOpen] = useState(false);
  const itemAtivo = MENU.find(m => m.key === ativo);

  /* Fecha dropdown ao clicar fora */
  useEffect(() => {
    if (!mobileOpen) return;
    const handler = (e) => {
      if (!e.target.closest(".rel-mobile-nav")) setMobileOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [mobileOpen]);

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
      case "dre":        return <RelatorioDRE vendas={vendas} despesas={despesas} caixa={caixa} vendedores={vendedores} intervalo={intervalo} uid={tenantUid} />;
      case "financeiro": return <RelatorioFinanceiro caixa={caixa} despesas={despesas} vendas={vendas} vendedores={vendedores} intervalo={intervalo} />;
      case "vendas":     return <RelatorioVendas vendas={vendas} intervalo={intervalo} />;
      case "clientes":   return <RelatorioClientes clientes={clientes} vendas={vendas} intervalo={intervalo} aReceber={aReceber} />;
      case "alunos":       return <RelatorioAlunos alunos={alunos} aReceber={aReceber} vendas={vendas} intervalo={intervalo} />;  
      case "mensalidades": return <RelatorioMensalidades alunos={alunos} aReceber={aReceber} vendas={vendas} caixa={caixa} intervalo={intervalo} />;
      case "rel_compras":        return <RelatorioCompras compras={compras} fornecedores={fornecedores} intervalo={intervalo} />;
      case "rel_contas_receber": return <RelatorioContasReceber aReceber={aReceber} intervalo={intervalo} />;
      case "despesas":   return <RelatorioDespesas despesas={despesas} intervalo={intervalo} />;
      case "lucro_ps":   return <RelatorioLucroPorPS vendas={vendas} produtos={produtos} servicos={servicos} vendedores={vendedores} intervalo={intervalo} />;
      case "estoque":    return <RelatorioEstoque produtos={produtos} />;
      case "vendedores": return <RelatorioVendedores vendas={vendas} vendedores={vendedores} intervalo={intervalo} />;
      case "agenda":     return <RelatorioAgenda agenda={agenda} intervalo={intervalo} />;
     
      
     
      case "pdv":       return <RelatorioPDV vendas={vendas} intervalo={intervalo} isAdmin={isAdmin} />;
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

          {/* ── Mobile: dropdown de navegação (só aparece em telas ≤ 640px via CSS) ── */}
          <div className="rel-mobile-nav" data-print-hide>
            <button
              className="rel-mobile-trigger"
              onClick={() => setMobileOpen(v => !v)}
              aria-expanded={mobileOpen}
            >
              <span className="rel-mobile-trigger-icon">
                {itemAtivo?.icon}
              </span>
              <span className="rel-mobile-trigger-label">
                {TITULO_RELATORIO[ativo] || "Selecionar relatório"}
              </span>
              <ChevronDown size={15} className={`rel-mobile-trigger-chevron${mobileOpen ? " open" : ""}`} />
            </button>

            {mobileOpen && (
              <div className="rel-mobile-dropdown">
                <div className="rel-mobile-dd-head">
                  <span className="rel-mobile-dd-title">Relatórios</span>
                  {isAdmin && (
                    <button
                      onClick={() => setModoGerenciar(v => !v)}
                      style={{
                        background: modoGerenciar ? "rgba(200,165,94,.15)" : "transparent",
                        border: `1px solid ${modoGerenciar ? "rgba(200,165,94,.35)" : "var(--border)"}`,
                        borderRadius: 6, padding: "3px 7px", cursor: "pointer",
                        color: modoGerenciar ? "var(--gold)" : "var(--text-3)",
                        fontSize: 10, fontWeight: 600, fontFamily: "'DM Sans',sans-serif",
                        display: "flex", alignItems: "center", gap: 4,
                      }}
                    >
                      {modoGerenciar ? <><EyeOff size={11} /> Fechar</> : <><Eye size={11} /> Gerenciar</>}
                    </button>
                  )}
                </div>
                <div className="rel-mobile-dd-list">
                  {MENU.map((item) => {
                    const liberado = temAcesso(item.key);
                    const isOculto = ocultos.has(item.key);
                    if (!modoGerenciar && isOculto) return null;
                    return (
                      <button
                        key={item.key}
                        className={`rel-mobile-dd-item${ativo === item.key && liberado ? " active" : ""}`}
                        style={{
                          opacity: isOculto ? 0.42 : (!liberado ? 0.5 : 1),
                          cursor: !liberado || isOculto ? "not-allowed" : "pointer",
                        }}
                        onClick={() => {
                          if (modoGerenciar) { toggleOculto(item.key); return; }
                          if (!liberado || isOculto) return;
                          setAtivo(item.key);
                          setMobileOpen(false);
                        }}
                      >
                        <span className="rel-mobile-dd-item-dot" />
                        <span className="rel-mobile-dd-item-text"
                          style={{ textDecoration: isOculto && modoGerenciar ? "line-through" : "none" }}>
                          {item.label}
                        </span>
                        {modoGerenciar && isAdmin && (
                          <span style={{ color: isOculto ? "var(--text-3)" : "var(--gold)", marginLeft: "auto" }}>
                            {isOculto ? <EyeOff size={13} /> : <Eye size={13} />}
                          </span>
                        )}
                        {!modoGerenciar && !liberado && (
                          <Lock size={11} className="rel-mobile-dd-item-lock" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar de navegação */}
          <nav className="rel-nav" data-print-hide>
            {/* Header da nav com botão gerenciar (admin only) */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
              <div className="rel-nav-label" style={{ marginBottom: 0 }}>Relatórios</div>
              {isAdmin && (
                <button
                  onClick={() => setModoGerenciar(v => !v)}
                  title={modoGerenciar ? "Fechar" : "Mostrar/ocultar relatórios"}
                  style={{
                    background: modoGerenciar ? "rgba(200,165,94,.15)" : "transparent",
                    border: `1px solid ${modoGerenciar ? "rgba(200,165,94,.35)" : "var(--border)"}`,
                    borderRadius: 6, padding: "3px 7px", cursor: "pointer",
                    color: modoGerenciar ? "var(--gold)" : "var(--text-3)",
                    fontSize: 10, fontWeight: 600, fontFamily: "'DM Sans',sans-serif",
                    display: "flex", alignItems: "center", gap: 4, flexShrink: 0,
                    transition: "all .13s",
                  }}
                >
                  {modoGerenciar ? <><EyeOff size={11} /> Fechar</> : <><Eye size={11} /> Gerenciar</>}
                </button>
              )}
            </div>

            {/* Dica do modo gerenciar */}
            {modoGerenciar && (
              <div style={{
                fontSize: 10, color: "var(--text-3)", padding: "6px 10px",
                background: "var(--s2)", borderRadius: 7, marginBottom: 6, lineHeight: 1.5,
              }}>
                Clique no ícone para ocultar/exibir um relatório.
              </div>
            )}

            {MENU.map((item) => {
              const liberado  = temAcesso(item.key);
              const isOculto  = ocultos.has(item.key);

              /* Em modo normal: esconde os ocultos */
              if (!modoGerenciar && isOculto) return null;

              return (
                <button
                  key={item.key}
                  className={`rel-nav-btn ${ativo === item.key && liberado && !isOculto ? "active" : ""}`}
                  onClick={() => {
                    if (modoGerenciar) return; // clique no item não navega em modo gerenciar
                    liberado && !isOculto && setAtivo(item.key);
                  }}
                  title={
                    modoGerenciar ? (isOculto ? "Clique para exibir" : "Clique para ocultar") :
                    !liberado ? "Sem permissão para este relatório" : ""
                  }
                  style={{
                    opacity: isOculto ? 0.42 : (!liberado ? 0.45 : 1),
                    cursor: modoGerenciar ? "default" : (!liberado || isOculto ? "not-allowed" : "pointer"),
                    position: "relative",
                  }}
                >
                  {liberado ? item.icon : <Lock size={15} />}
                  <span style={{
                    textDecoration: isOculto && modoGerenciar ? "line-through" : "none",
                    flex: 1, textAlign: "left",
                  }}>
                    {item.label}
                  </span>
                  {/* Controle de visibilidade no modo gerenciar */}
                  {modoGerenciar && isAdmin && (
                    <span
                      onClick={(e) => { e.stopPropagation(); toggleOculto(item.key); }}
                      title={isOculto ? "Exibir relatório" : "Ocultar relatório"}
                      style={{
                        marginLeft: "auto", cursor: "pointer", flexShrink: 0,
                        color: isOculto ? "var(--text-3)" : "var(--gold)",
                        padding: "2px 4px", borderRadius: 4,
                        transition: "color .13s",
                      }}
                    >
                      {isOculto ? <EyeOff size={13} /> : <Eye size={13} />}
                    </span>
                  )}
                  {/* Cadeado de permissão (fora do modo gerenciar) */}
                  {!modoGerenciar && !liberado && (
                    <Lock size={11} style={{ marginLeft: "auto", color: "var(--text-3)" }} />
                  )}
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
