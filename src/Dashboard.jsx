/* ═══════════════════════════════════════════════════
   ASSENT v2.0 — Dashboard.jsx  (responsivo)
   ─────────────────────────────────────────────────
   ✓ Sidebar recolhível (ícones + tooltip no modo colapsado)
   ✓ Header global com usuário, avatar e dropdown
   ✓ Logo dinâmica via useEmpresa (Firestore, reativa)
   ✓ Dashboard data-driven via useDashboardData
   ✓ Grid responsivo com melhor espaçamento
   ✓ Bottom Nav para mobile (< 720px)
   ✓ Overlay sidebar para mobile
   ✓ CSS responsivo global injetado via useEffect
   ═══════════════════════════════════════════════════ */

import { useState, useEffect, useRef } from "react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import {
  LayoutDashboard, Users, Package, Wrench, ArrowDownToLine,
  ShoppingCart, Clock, Wallet, TrendingDown, Truck, BarChart3,
  Calendar, Settings, Zap, UserCheck, Search, ArrowUpRight,
  ArrowDownRight, ChevronRight, Bell, LogOut, ChevronDown,
  PanelLeftClose, PanelLeftOpen, Menu, X, Sun, Moon,
} from "lucide-react";

/* ── Módulos ───────────────────────────────────── */
import Clientes      from "./modules/Clientes.jsx";
import Produtos      from "./modules/Produtos.jsx";
import Servicos      from "./modules/Servicos.jsx";
import Vendedores    from "./modules/Vendedores.jsx";
import Vendas        from "./modules/Vendas.jsx";
import Configuracoes from "./modules/Configuracoes.jsx";
import Despesas      from "./modules/Despesas.jsx";
import EntradaEstoque from "./modules/EntradaEstoque.jsx";
import Agenda        from "./modules/Agenda/Agenda.jsx";
import Fornecedores  from "./modules/Fornecedores.jsx";
import AReceber      from "./modules/AReceber.jsx";
import Relatorios    from "./components/Relatorios.jsx";
import CaixaDiario   from "./modules/CaixaDiario.jsx";
import Orcamentos    from "./modules/Orcamentos.jsx";

/* ── Firebase ──────────────────────────────────── */
import { db, auth, logout } from "./lib/firebase";
import { onAuthStateChanged }    from "firebase/auth";
import { doc, onSnapshot }       from "firebase/firestore";

/* ── Hooks de dados ────────────────────────────── */
import { useDashboardData, fmtR$, fmtData } from "./hooks/useDashboardData";
import { useEmpresa }                        from "./hooks/useEmpresa";
import { useLicenca }                        from "./hooks/useLicenca";

/* ═══════════════════════════════════════════════
   CONSTANTES
   ═══════════════════════════════════════════════ */

const PERIODS = ["Hoje", "7 dias", "30 dias", "Este mês", "Todos", "Personalizado"];

const KEY_MAP = {
  "Dashboard":          "dashboard",
  "Clientes":           "clientes",
  "Produtos":           "produtos",
  "Serviços":           "servicos",
  "Entrada de Estoque": "entrada_estoque",
  "Vendas":             "vendas",
  "Fiado / A Receber":  "fiado",
  "Caixa Diário":       "caixa",
  "Despesas":           "despesas",
  "Fornecedores":       "fornecedores",
  "Relatórios":         "relatorios",
  "Agenda":             "agenda",
  "Orçamentos":         "orcamentos",
  "Vendedores":         "vendedores",
  "Configurações":      "config",
};

const ATALHOS_TECLADO = [
  { code: "KeyD", label: "Dashboard",           dbKey: "dashboard"       },
  { code: "KeyC", label: "Clientes",            dbKey: "clientes"        },
  { code: "KeyP", label: "Produtos",            dbKey: "produtos"        },
  { code: "KeyS", label: "Serviços",            dbKey: "servicos"        },
  { code: "KeyE", label: "Entrada de Estoque",  dbKey: "entrada_estoque" },
  { code: "KeyV", label: "Vendas",              dbKey: "vendas"          },
  { code: "KeyF", label: "A Receber",           dbKey: "fiado"           },
  { code: "KeyX", label: "Caixa Diário",        dbKey: "caixa"           },
  { code: "KeyZ", label: "Despesas",            dbKey: "despesas"        },
  { code: "KeyN", label: "Fornecedores",        dbKey: "fornecedores"    },
  { code: "KeyR", label: "Relatórios",          dbKey: "relatorios"      },
  { code: "KeyA", label: "Agenda",              dbKey: "agenda"          },
  { code: "KeyO", label: "Orçamentos",          dbKey: "orcamentos"      },
  { code: "KeyM", label: "Vendedores",          dbKey: "vendedores"      },
  { code: "KeyG", label: "Configurações",       dbKey: "config"          },
];

const LOCKED_KEYS  = new Set(["dashboard", "config"]);
const ATALHO_LOOKUP = Object.fromEntries(ATALHOS_TECLADO.map(a => [a.code, a]));

const NAV = [
  { section: "BÁSICO", items: [
    { icon: LayoutDashboard, label: "Dashboard"  },
    { icon: Users,           label: "Clientes"   },
    { icon: Package,         label: "Produtos"   },
    { icon: Wrench,          label: "Serviços"   },
  ]},
  { section: "OPERAÇÕES", items: [
    { icon: ArrowDownToLine, label: "Entrada de Estoque" },
    { icon: ShoppingCart,    label: "Vendas"             },
    { icon: Clock,           label: "A Receber"          },
    { icon: Wallet,          label: "Caixa Diário"       },
    { icon: TrendingDown,    label: "Despesas"           },
    { icon: Truck,           label: "Fornecedores"       },
  ]},
  { section: "ANÁLISE", items: [
    { icon: BarChart3, label: "Relatórios" },
    { icon: Calendar,  label: "Agenda"     },
  ]},
  { section: "SISTEMA", items: [
    { icon: Zap,       label: "Orçamentos"    },
    { icon: UserCheck, label: "Vendedores"    },
    { icon: Settings,  label: "Configurações" },
  ]},
];

/* Itens do bottom nav mobile */
const BOTTOM_NAV = [
  { icon: LayoutDashboard, label: "Dashboard" },
  { icon: Users,           label: "Clientes"  },
  { icon: ShoppingCart,    label: "Vendas"    },
  { icon: Calendar,        label: "Agenda"    },
];

/* ═══════════════════════════════════════════════
   CSS RESPONSIVO GLOBAL
   Injetado via useEffect no final do <head>
   para garantir precedência sobre os CSS
   dos módulos (que são injetados dinamicamente).
   ═══════════════════════════════════════════════ */
const RESPONSIVE_CSS = `
/* ── MODAL: bottom sheet no mobile ── */
@media (max-width: 640px) {
  .modal-overlay {
    padding: 0 !important;
    align-items: flex-end !important;
  }
  .modal-box,
  .modal-box-xl,
  .modal-box-lg,
  .modal-box-md,
  .modal-box-sm {
    max-width: 100% !important;
    width: 100% !important;
    border-radius: 16px 16px 0 0 !important;
    max-height: 88vh !important;
    border-left: none !important;
    border-right: none !important;
    border-bottom: none !important;
  }
  .modal-header {
    padding: 16px 16px 12px !important;
  }
  .modal-body {
    padding: 14px 16px !important;
  }
  .modal-footer {
    padding: 12px 16px !important;
    flex-wrap: wrap !important;
    gap: 8px !important;
  }
  /* EventoModal grid de detalhes */
  div[style*="grid-template-columns: 1fr 1fr"] {
    grid-template-columns: 1fr !important;
  }
}

/* ── FORM ROWS ── */
@media (max-width: 480px) {
  .form-row,
  .form-row-3 {
    grid-template-columns: 1fr !important;
  }
}

/* ── TOPBARS DE MÓDULOS ── */
@media (max-width: 640px) {
  .cl-topbar,
  .vd-topbar,
  .cx-topbar,
  .ar-topbar,
  .desp-topbar,
  .ee-topbar,
  .fn-topbar,
  .pd-topbar,
  .sv-topbar,
  .orc-topbar,
  .cfg-topbar {
    flex-wrap: wrap !important;
    padding: 10px 14px !important;
    gap: 8px !important;
  }

  /* Barras de busca full-width */
  .cl-search,
  .vd-search,
  .cx-search,
  .ar-search,
  .desp-search,
  .ee-search,
  .fn-search,
  .pd-search,
  .sv-search,
  .orc-search {
    width: 100% !important;
    max-width: 100% !important;
    flex: 1 1 100% !important;
    min-width: 0 !important;
    order: 5;
  }

  /* Grupos de botões à direita vão para baixo */
  .vd-topbar-right,
  .cx-topbar-right,
  .fn-topbar-right,
  .sv-topbar-actions,
  .orc-topbar-right,
  .cl-topbar-right,
  .ar-topbar-right,
  .desp-topbar-right,
  .ee-topbar-right,
  .pd-topbar-right {
    margin-left: 0 !important;
    flex-wrap: wrap !important;
    width: 100%;
    justify-content: flex-end;
    order: 6;
  }

  /* Fallback: botão "Novo" direto na topbar (sem wrapper div) */
  .cl-topbar > button:last-child,
  .ar-topbar > button:last-child,
  .desp-topbar > button:last-child,
  .ee-topbar > button:last-child,
  .pd-topbar > button:last-child {
    margin-left: auto !important;
    order: 6 !important;
  }
}

/* ── TABELAS: scroll horizontal ── */
@media (max-width: 640px) {
  .cl-table-wrap,
  .vd-table-wrap,
  .cx-table-wrap,
  .ar-table-wrap,
  .desp-table-wrap,
  .ee-table-wrap,
  .fn-table-wrap,
  .pd-table-wrap,
  .sv-table-wrap,
  .orc-table-wrap {
    overflow-x: auto !important;
    -webkit-overflow-scrolling: touch;
  }

  /* Larguras mínimas para que as linhas não squish */
  .cl-row, .cl-row-head     { min-width: 660px; }
  .vd-row, .vd-row-head     { min-width: 680px; }
  .cx-row, .cx-row-head     { min-width: 600px; }
  .ar-row, .ar-row-head     { min-width: 700px; }
  .desp-row, .desp-row-head { min-width: 680px; }
  .ee-row,  .ee-row-head    { min-width: 660px; }
  .fn-row,  .fn-row-head    { min-width: 640px; }
  .pd-row,  .pd-row-head    { min-width: 580px; }
  .sv-row,  .sv-row-head    { min-width: 560px; }
  .orc-row, .orc-row-head   { min-width: 620px; }

  /* Barra de filtros de período (Vendas, CaixaDiário) */
  .vd-periods,
  .cx-periods,
  .desp-filters {
    padding: 8px 14px !important;
    flex-wrap: wrap !important;
    gap: 6px !important;
  }
  .vd-period-sep { display: none !important; }

  /* AReceber: KPIs em 2 colunas */
  .ar-kpis { grid-template-columns: 1fr 1fr !important; }

  /* Filtros de status / categoria */
  .ar-filter-group,
  .fn-filters,
  .orc-filters {
    padding: 8px 14px !important;
    flex-wrap: wrap !important;
    gap: 6px !important;
  }
}

@media (max-width: 480px) {
  /* AReceber: KPIs em 1 coluna */
  .ar-kpis       { grid-template-columns: 1fr !important; }
  /* CaixaDiário: cards em 1 coluna */
  .cx-cards      { grid-template-columns: 1fr !important; }
}

/* ── AGENDA ── */
@media (max-width: 640px) {
  .ag-main { overflow-y: auto !important; -webkit-overflow-scrolling: touch; }
  .ag-page { overflow: auto !important; }

  /* Topbar da Agenda */
  .ag-topbar {
    flex-wrap: wrap !important;
    padding: 10px 14px !important;
    gap: 8px !important;
  }
  .ag-topbar-right {
    margin-left: 0 !important;
    flex: 1 1 100% !important;
    justify-content: flex-start !important;
  }

  /* Filtros */
  .ag-filtros { flex-wrap: wrap !important; }

  /* KPIs resumo: 2 cols */
  .ag-resumo { grid-template-columns: 1fr 1fr !important; }

  /* Lista horizontal scroll */
  .ag-lista-wrap { overflow-x: auto !important; }
  .ag-row, .ag-row-head { min-width: 720px !important; }

  /* Calendário */
  .ag-cal-wrap { overflow-x: auto !important; }
  .ag-cal-grid { min-width: 360px !important; }
  .ag-cal-cell { min-height: 48px !important; }
  .ag-cal-evento { font-size: 9px !important; }
}
@media (max-width: 480px) {
  .ag-resumo { grid-template-columns: 1fr !important; }
  .ag-content { padding: 12px !important; }
}

/* ── RELATÓRIOS ── */
@media (max-width: 640px) {
  .rel-root { overflow: visible !important; height: auto !important; }
  .rel-topbar {
    flex-wrap: wrap !important;
    padding: 10px 14px !important;
    gap: 10px !important;
  }
  .rel-topbar-left { flex: 1 1 100% !important; order: 1; }
  .rel-actions     { order: 2; flex: 1 1 100% !important; justify-content: flex-end !important; }

  .rel-body {
    flex-direction: column !important;
    overflow: visible !important;
    height: auto !important;
  }
  .rel-nav {
    width: 100% !important;
    min-width: 0 !important;
    border-right: none !important;
    border-bottom: 1px solid var(--border) !important;
    flex-direction: row !important;
    flex-wrap: nowrap !important;
    overflow-x: auto !important;
    overflow-y: hidden !important;
    padding: 8px 10px !important;
    gap: 4px !important;
    flex-shrink: 0 !important;
    height: auto !important;
    min-height: unset !important;
  }
  .rel-nav-label   { display: none !important; }
  .rel-nav-btn {
    white-space: nowrap !important;
    flex-shrink: 0 !important;
    padding: 7px 12px !important;
  }
  .rel-content {
    padding: 14px !important;
    overflow-y: visible !important;
    height: auto !important;
    flex: none !important;
  }

  /* CardResumo: 2 colunas */
  .cr-grid { grid-template-columns: 1fr 1fr !important; }

  /* TabelaRelatorio scroll */
  .tr-wrap  { overflow-x: auto !important; }
  .tr-head, .tr-row { min-width: 480px !important; }
}
@media (max-width: 480px) {
  .cr-grid { grid-template-columns: 1fr !important; }
}

/* ── CONFIGURAÇÕES ── */
@media (max-width: 640px) {
  .cfg-root {
    overflow: visible !important;
    height: auto !important;
    min-height: 100% !important;
  }
  .cfg-topbar {
    flex-wrap: wrap !important;
    padding: 10px 14px !important;
    gap: 8px !important;
  }
  .cfg-body {
    flex-direction: column !important;
    overflow: visible !important;
    height: auto !important;
  }
  .cfg-nav {
    width: 100% !important;
    border-right: none !important;
    border-bottom: 1px solid var(--border) !important;
    flex-direction: row !important;
    flex-wrap: nowrap !important;
    overflow-x: auto !important;
    overflow-y: hidden !important;
    padding: 8px 10px !important;
    gap: 4px !important;
    flex-shrink: 0 !important;
    height: auto !important;
  }
  .cfg-nav-group-label { display: none !important; }
  .cfg-nav-item {
    white-space: nowrap !important;
    flex-shrink: 0 !important;
    width: auto !important;
    padding: 7px 12px !important;
    min-width: unset !important;
    border-radius: 8px !important;
    border: 1px solid transparent !important;
  }
  .cfg-panel {
    padding: 14px !important;
    overflow: visible !important;
    height: auto !important;
  }
  .cfg-card-body { padding: 14px !important; }
  .cfg-card-footer {
    flex-wrap: wrap !important;
    gap: 8px !important;
    justify-content: flex-end !important;
  }
}

/* ── FILTRO DE PERÍODO ── */
@media (max-width: 640px) {
  .fp-wrap  { flex-wrap: wrap !important; gap: 8px !important; }
  .fp-btns  { flex-wrap: wrap !important; }
  .fp-custom {
    width: 100% !important;
    flex-wrap: wrap !important;
  }
  .fp-date {
    flex: 1 !important;
    min-width: 120px !important;
  }
}

/* ── DASHBOARD ESPECÍFICO ── */
@media (max-width: 720px) {
  .ag-search  { display: none !important; }
  .ag-despesa-grid { grid-template-columns: 1fr 1fr !important; }
}
@media (max-width: 480px) {
  .ag-despesa-grid { grid-template-columns: 1fr !important; }
}

/* ── MOBILE BOTTOM NAV ── */
@media (max-width: 720px) {
  .ag-app { padding-bottom: 0 !important; }
  .ag-content { padding-bottom: 76px !important; }
  .ag-mobile-nav { display: flex !important; }
}
`;

/* ═══════════════════════════════════════════════
   CSS DO DASHBOARD (layout base)
   ═══════════════════════════════════════════════ */
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&family=Sora:wght@300;400;500;600;700&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;1,9..40,300&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body, #root { height: 100%; width: 100%; margin: 0; padding: 0; }

  :root {
    --bg:           #09090c;
    --s1:           #0f0f13;
    --s2:           #141419;
    --s3:           #1a1a22;
    --border:       rgba(255,255,255,0.07);
    --border-h:     rgba(255,255,255,0.13);
    --gold:         #c8a55e;
    --gold-l:       #dfc07c;
    --gold-d:       rgba(200,165,94,0.12);
    --gold-brand:   #D4AF37;
    --text:         #edeae3;
    --text-2:       #a09caa;
    --text-3:       #6a6775;
    --green:        #3ecf8e;
    --green-d:      rgba(62,207,142,0.1);
    --red:          #e05252;
    --red-d:        rgba(224,82,82,0.1);
    --blue:         #5b8ef0;
    --blue-d:       rgba(91,142,240,0.1);
    --purple:       #a78bfa;
    --purple-d:     rgba(167,139,250,0.1);
    --amber:        #f59e0b;
    --amber-d:      rgba(245,158,11,0.1);
    --sidebar-w:    220px;
    --sidebar-w-sm: 64px;
    --header-h:     62px;
    --sidebar-transition: width 0.22s cubic-bezier(0.4,0,0.2,1);
    font-family: 'DM Sans', sans-serif;
    --font-display: 'Playfair Display', serif;
    color-scheme: dark;
  }

  /* ══ LAYOUT RAIZ ══ */
  .ag-app {
    display: flex;
    flex-direction: column;
    height: 100vh;
    height: 100dvh; /* mobile: exclui barra do browser */
    background: var(--bg);
    color: var(--text);
    overflow: hidden;
  }

  /* ══ HEADER GLOBAL ══ */
  .ag-global-header {
    height: var(--header-h);
    flex-shrink: 0;
    background: var(--s1);
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    padding: 0 16px 0 0;
    gap: 0;
    z-index: 50;
    position: relative;
  }

  .ag-toggle-btn {
    width: var(--sidebar-w-sm);
    height: var(--header-h);
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    border-right: 1px solid var(--border);
    cursor: pointer;
    color: var(--text-3);
    transition: color .15s, background .15s;
  }
  .ag-toggle-btn:hover { background: rgba(255,255,255,0.03); color: var(--text); }

  .ag-header-logo {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 0 16px;
    min-width: 0;
    flex: 0 0 auto;
  }
  .ag-header-logo-img {
    width: 30px; height: 30px; border-radius: 8px;
    object-fit: cover; flex-shrink: 0;
  }
  .ag-header-logo-icon {
    width: 30px; height: 30px; border-radius: 8px; flex-shrink: 0;
    background: linear-gradient(135deg, #b8952e, #e0c060);
    display: flex; align-items: center; justify-content: center;
    font-family: 'Sora', sans-serif; font-weight: 700; font-size: 13px;
    color: #0a0808; letter-spacing: -0.5px;
  }
  .ag-header-logo-name {
    font-size: 13px; font-weight: 600; color: var(--text);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    max-width: 160px;
  }

  .ag-header-spacer { flex: 1; }

  .ag-notif {
    width: 34px; height: 34px; border-radius: 8px;
    background: var(--s2); border: 1px solid var(--border);
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; transition: border-color .15s;
    color: var(--text-2); flex-shrink: 0;
  }
  .ag-notif:hover { border-color: var(--border-h); color: var(--text); }

  .ag-user-area { position: relative; display: flex; align-items: center; margin-left: 10px; }
  .ag-user-trigger {
    display: flex; align-items: center; gap: 9px;
    padding: 6px 10px 6px 6px; border-radius: 10px;
    border: 1px solid transparent; cursor: pointer;
    transition: background .13s, border-color .13s; user-select: none;
  }
  .ag-user-trigger:hover { background: var(--s2); border-color: var(--border); }
  .ag-avatar {
    width: 30px; height: 30px; border-radius: 50%; flex-shrink: 0;
    background: linear-gradient(135deg, rgba(200,165,94,0.18), rgba(200,165,94,0.06));
    border: 1.5px solid var(--gold-d);
    display: flex; align-items: center; justify-content: center;
    font-size: 12px; font-weight: 600; color: var(--gold);
    font-family: 'Sora', sans-serif;
  }
  .ag-user-name {
    font-size: 12px; font-weight: 500; color: var(--text);
    max-width: 130px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .ag-user-chevron { color: var(--text-3); transition: transform .18s; flex-shrink: 0; }
  .ag-user-chevron.open { transform: rotate(180deg); }

  .ag-user-dropdown {
    position: absolute; top: calc(100% + 8px); right: 0;
    background: var(--s2); border: 1px solid var(--border-h);
    border-radius: 12px; min-width: 180px; padding: 6px;
    box-shadow: 0 16px 48px rgba(0,0,0,0.6);
    z-index: 200; animation: ag-dropdown-in .14s ease;
  }
  @keyframes ag-dropdown-in {
    from { opacity: 0; transform: translateY(-6px) scale(.97); }
    to   { opacity: 1; transform: translateY(0)   scale(1); }
  }
  .ag-dropdown-divider { height: 1px; background: var(--border); margin: 4px 0; }
  .ag-dropdown-item {
    display: flex; align-items: center; gap: 9px;
    padding: 9px 12px; border-radius: 8px; border: none;
    background: transparent; color: var(--text-2);
    font-family: 'DM Sans', sans-serif; font-size: 13px;
    cursor: pointer; width: 100%; text-align: left;
    transition: background .1s, color .1s;
  }
  .ag-dropdown-item:hover { background: var(--s3); color: var(--text); }
  .ag-dropdown-item.danger { color: var(--red); }
  .ag-dropdown-item.danger:hover { background: var(--red-d); }

  /* ══ CORPO ══ */
  .ag-body { flex: 1; display: flex; overflow: hidden; }

  /* ══ SIDEBAR ══ */
  .ag-sidebar {
    width: var(--sidebar-w); flex-shrink: 0;
    background: var(--s1); border-right: 1px solid var(--border);
    display: flex; flex-direction: column;
    overflow: hidden; transition: var(--sidebar-transition);
  }
  .ag-sidebar.collapsed { width: var(--sidebar-w-sm); }

  .ag-nav { flex: 1; overflow-y: auto; overflow-x: hidden; padding: 10px 0 6px; }
  .ag-nav::-webkit-scrollbar { width: 3px; }
  .ag-nav::-webkit-scrollbar-thumb { background: var(--text-3); border-radius: 2px; }

  .ag-sec-label {
    font-size: 9px; font-weight: 600; letter-spacing: .1em;
    color: var(--text-3); padding: 10px 18px 5px;
    text-transform: uppercase; white-space: nowrap; overflow: hidden;
    transition: opacity .15s, padding .22s;
  }
  .ag-sidebar.collapsed .ag-sec-label {
    opacity: 0; pointer-events: none; padding-top: 6px; padding-bottom: 6px;
  }

  .ag-nav-item {
    display: flex; align-items: center; gap: 9px;
    padding: 8px 16px 8px 18px; margin: 1px 8px 1px 0;
    border-left: 2px solid transparent;
    border-radius: 0 8px 8px 0; cursor: pointer; font-size: 13px;
    color: var(--text-2);
    transition: background .12s, color .12s, border-color .12s, padding .22s;
    white-space: nowrap; overflow: hidden; position: relative;
  }
  .ag-nav-item:hover  { background: rgba(255,255,255,0.03); color: var(--text); }
  .ag-nav-item.active { background: var(--gold-d); color: var(--gold); border-left-color: var(--gold); }
  .ag-nav-item.active svg { color: var(--gold); }

  .ag-nav-item span {
    overflow: hidden; white-space: nowrap;
    transition: opacity .15s, max-width .22s; max-width: 160px;
  }

  .ag-sidebar.collapsed .ag-nav-item {
    padding: 9px; justify-content: center; margin: 1px 4px;
    border-left-width: 0; border-radius: 8px; border: 1px solid transparent;
  }
  .ag-sidebar.collapsed .ag-nav-item.active {
    border-color: rgba(200,165,94,0.2); border-left-width: 0;
  }
  .ag-sidebar.collapsed .ag-nav-item span { max-width: 0; opacity: 0; }

  .ag-sidebar.collapsed .ag-nav-item::after {
    content: attr(data-label);
    position: absolute; left: calc(100% + 10px); top: 50%;
    transform: translateY(-50%);
    background: var(--s3); border: 1px solid var(--border-h);
    color: var(--text); padding: 5px 11px; border-radius: 8px;
    font-size: 12px; font-weight: 500; white-space: nowrap;
    pointer-events: none; opacity: 0; transition: opacity .12s;
    z-index: 100; box-shadow: 0 8px 24px rgba(0,0,0,0.4);
  }
  .ag-sidebar.collapsed .ag-nav-item:hover::after { opacity: 1; }

  /* ══ MAIN ══ */
  .ag-main { flex: 1; display: flex; flex-direction: column; overflow: hidden; }

  .ag-topbar {
    padding: 14px 24px; background: var(--s1);
    border-bottom: 1px solid var(--border);
    display: flex; align-items: center; gap: 16px; flex-shrink: 0;
  }
  .ag-topbar-title h1 {
    font-family: var(--font-display); font-size: 26px; font-weight: 600;
    color: var(--gold-brand); line-height: 1.15; letter-spacing: 0.01em;
    background: linear-gradient(135deg, #D4AF37 10%, #e8ca60 55%, #c8a55e 100%);
    -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
  }
  .ag-topbar-title p { font-size: 11px; color: var(--text-3); margin-top: 3px; letter-spacing: 0.02em; }

  .ag-search {
    display: flex; align-items: center; gap: 8px;
    background: var(--s2); border: 1px solid var(--border);
    border-radius: 8px; padding: 7px 11px; width: 200px;
    transition: border-color .15s;
  }
  .ag-search:focus-within { border-color: var(--border-h); }
  .ag-search input {
    background: transparent; border: none; outline: none;
    color: var(--text); font-size: 12px; width: 100%;
    font-family: 'DM Sans', sans-serif;
  }
  .ag-search input::placeholder { color: var(--text-3); }

  .ag-periods { display: flex; gap: 3px; flex-wrap: wrap; }
  .ag-period-btn {
    padding: 5px 12px; border-radius: 20px; font-size: 11px;
    cursor: pointer; border: 1px solid transparent;
    background: transparent; color: var(--text-2);
    font-family: 'DM Sans', sans-serif; transition: all .13s;
  }
  .ag-period-btn:hover  { background: var(--s2); color: var(--text); }
  .ag-period-btn.active { background: var(--gold-d); border-color: rgba(200,165,94,.3); color: var(--gold); }

  /* ══ CONTENT ══ */
  .ag-content { flex: 1; overflow-y: auto; padding: 20px 24px 36px; -webkit-overflow-scrolling: touch; }
  .ag-content::-webkit-scrollbar { width: 4px; }
  .ag-content::-webkit-scrollbar-thumb { background: var(--text-3); border-radius: 2px; }

  /* ══ CARDS ══ */
  .ag-card {
    background: var(--s1); border: 1px solid var(--border);
    border-radius: 14px; padding: 20px;
    transition: border-color .2s, box-shadow .2s, transform .2s;
  }
  .ag-card:hover {
    border-color: var(--border-h);
    box-shadow: 0 6px 28px rgba(0,0,0,0.3);
    transform: translateY(-2px);
  }
  .ag-card-click { cursor: pointer; }
  .ag-card-click:hover {
    border-color: rgba(200,165,94,0.25);
    box-shadow: 0 8px 32px rgba(0,0,0,0.35);
    transform: translateY(-3px);
  }
  .ag-card-click:active { transform: translateY(-1px); }

  .ag-card-bare {
    background: var(--s1); border: 1px solid var(--border);
    border-radius: 14px; overflow: hidden;
    transition: border-color .2s, box-shadow .2s, transform .2s;
  }
  .ag-card-bare:hover {
    border-color: var(--border-h);
    box-shadow: 0 6px 24px rgba(0,0,0,0.25);
    transform: translateY(-1px);
  }

  .ag-card-header {
    padding: 14px 18px; border-bottom: 1px solid var(--border);
    display: flex; align-items: center; justify-content: space-between;
  }
  .ag-card-title { font-size: 13px; font-weight: 500; color: var(--text); }

  .ag-view-all {
    font-size: 11px; color: var(--gold);
    background: transparent; border: none; cursor: pointer;
    font-family: 'DM Sans', sans-serif;
    display: flex; align-items: center; gap: 3px; transition: opacity .13s;
  }
  .ag-view-all:hover { opacity: .75; }

  /* ══ GRIDS ══ */
  .g4  { display: grid; grid-template-columns: repeat(4,1fr); gap: 16px; margin-bottom: 16px; }
  .g3  { display: grid; grid-template-columns: repeat(3,1fr); gap: 16px; margin-bottom: 16px; }
  .g21 { display: grid; grid-template-columns: 2fr 1fr;        gap: 16px; margin-bottom: 16px; }
  .g11 { display: grid; grid-template-columns: 1fr 1fr;        gap: 16px; margin-bottom: 16px; }
  .g1  { margin-bottom: 16px; }

  /* ══ MINI STATS ══ */
  .ag-mini { display: flex; align-items: center; gap: 14px; }
  .ag-mini-icon {
    width: 44px; height: 44px; border-radius: 11px; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
  }
  .ag-mini-val { font-family: 'Sora', sans-serif; font-size: 26px; font-weight: 700; color: var(--text); line-height: 1; }
  .ag-mini-lbl { font-size: 11px; color: var(--text-2); margin-top: 4px; }

  /* ══ KPI CARDS ══ */
  .ag-kpi-label { font-size: 10px; font-weight: 500; letter-spacing: .07em; text-transform: uppercase; color: var(--text-2); margin-bottom: 10px; }
  .ag-kpi-val   { font-family: 'Sora', sans-serif; font-size: 24px; font-weight: 700; color: var(--text); line-height: 1; }
  .ag-kpi-meta  { display: flex; align-items: center; gap: 8px; margin-top: 10px; flex-wrap: wrap; }
  .ag-trend     { font-size: 11px; font-weight: 500; display: flex; align-items: center; gap: 2px; }
  .ag-sub       { font-size: 11px; color: var(--text-3); }

  /* ══ TABELAS ══ */
  .ag-trow {
    display: grid; padding: 11px 18px;
    border-bottom: 1px solid var(--border);
    font-size: 12px; color: var(--text-2); transition: background .1s;
  }
  .ag-trow:hover   { background: rgba(255,255,255,0.02); }
  .ag-trow:last-child { border-bottom: none; }
  .ag-thead { background: var(--s2); }
  .ag-th { font-size: 10px; font-weight: 500; letter-spacing: .06em; text-transform: uppercase; color: var(--text-3); }
  .ag-empty-row { padding: 24px 18px; text-align: center; font-size: 12px; color: var(--text-3); }

  /* ══ RESUMO DESPESAS ══ */
  .ag-despesa-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 12px; padding: 18px; }
  .ag-despesa-card { border-radius: 10px; padding: 15px; }
  .ag-despesa-label { font-size: 9px; font-weight: 600; letter-spacing: .07em; text-transform: uppercase; margin-bottom: 8px; }
  .ag-despesa-count { font-family: 'Sora', sans-serif; font-size: 26px; font-weight: 700; color: var(--text); line-height: 1; }
  .ag-despesa-val   { font-size: 11px; color: var(--text-2); margin-top: 6px; }

  /* ══ FILTRO PERSONALIZADO ══ */
  .ag-custom-range {
    display: flex; align-items: center; gap: 6px;
    background: var(--s2); border: 1px solid rgba(200,165,94,0.3);
    border-radius: 10px; padding: 5px 10px;
    animation: ag-dropdown-in .14s ease;
  }
  .ag-custom-range label { font-size: 10px; font-weight: 500; letter-spacing: .05em; text-transform: uppercase; color: var(--text-3); white-space: nowrap; }
  .ag-date-input {
    background: var(--s3); border: 1px solid var(--border); border-radius: 7px;
    color: var(--text); font-family: 'DM Sans', sans-serif; font-size: 12px;
    padding: 5px 8px; outline: none; cursor: pointer; transition: border-color .15s; color-scheme: dark;
  }
  .ag-date-input:focus { border-color: var(--gold); }
  .ag-date-input::-webkit-calendar-picker-indicator {
    filter: invert(0.6) sepia(1) saturate(2) hue-rotate(5deg); cursor: pointer; opacity: 0.7;
  }
  .ag-date-sep { color: var(--text-3); font-size: 12px; user-select: none; }

  /* ══ LOADING SKELETON ══ */
  @keyframes ag-shimmer {
    0%   { background-position: -400px 0; }
    100% { background-position:  400px 0; }
  }
  .ag-skeleton {
    background: linear-gradient(90deg, var(--s2) 25%, var(--s3) 50%, var(--s2) 75%);
    background-size: 800px 100%; animation: ag-shimmer 1.4s infinite;
    border-radius: 6px; height: 1em; display: inline-block; width: 100%;
  }

  /* ══ PLACEHOLDER ══ */
  .ag-placeholder {
    flex: 1; display: flex; align-items: center; justify-content: center;
    flex-direction: column; gap: 10px; color: var(--text-3);
  }
  .ag-placeholder h2 { font-family: 'Sora',sans-serif; font-size: 18px; font-weight: 600; color: var(--text-2); }
  .ag-placeholder p  { font-size: 13px; }

  /* ══ MOBILE BOTTOM NAV ══ */
  .ag-mobile-nav {
    display: none;
    position: fixed; bottom: 0; left: 0; right: 0;
    height: 60px;
    background: var(--s1);
    border-top: 1px solid var(--border);
    z-index: 100;
    align-items: stretch;
  }
  .ag-mobile-nav-btn {
    flex: 1;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center; gap: 3px;
    background: transparent; border: none; cursor: pointer;
    color: var(--text-3); font-family: 'DM Sans', sans-serif;
    font-size: 9px; font-weight: 500; letter-spacing: .03em;
    transition: color .15s, background .15s;
    padding: 4px 2px;
  }
  .ag-mobile-nav-btn.active { color: var(--gold); background: var(--gold-d); }
  .ag-mobile-nav-btn:hover  { color: var(--text); }

  /* ══ MOBILE OVERLAY SIDEBAR ══ */
  .ag-mobile-overlay {
    display: none;
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.72);
    z-index: 200;
    backdrop-filter: blur(4px);
    animation: fadeIn .18s ease;
  }
  @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }

  .ag-sidebar-mobile {
    position: fixed; top: 0; left: 0; bottom: 0;
    width: 280px; max-width: 85vw;
    background: var(--s1); border-right: 1px solid var(--border);
    z-index: 201; display: flex; flex-direction: column;
    overflow-y: auto;
    animation: ag-slide-in .22s cubic-bezier(0.4,0,0.2,1);
  }
  @keyframes ag-slide-in {
    from { transform: translateX(-100%); }
    to   { transform: translateX(0); }
  }
  .ag-sidebar-mobile-header {
    padding: 14px 16px; border-bottom: 1px solid var(--border);
    display: flex; align-items: center;
    justify-content: space-between; flex-shrink: 0;
  }
  .ag-sidebar-mobile-close {
    background: var(--s3); border: 1px solid var(--border);
    border-radius: 8px; width: 32px; height: 32px;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; color: var(--text-2);
    transition: background .13s, color .13s;
    flex-shrink: 0;
  }
  .ag-sidebar-mobile-close:hover { background: var(--s2); color: var(--text); }

  /* ══ RESPONSIVO (desktop) ══ */
  @media (max-width: 1100px) {
    .g4  { grid-template-columns: repeat(2, 1fr); }
    .g3  { grid-template-columns: repeat(2, 1fr); }
    .g21 { grid-template-columns: 1fr; }
  }
  @media (max-width: 720px) {
    .ag-sidebar     { display: none; }
    .ag-toggle-btn  { display: none; }
    .g4, .g3, .g11 { grid-template-columns: 1fr; }
    .ag-content     { padding: 14px 14px 28px; }
    .ag-periods     { display: none; }
    .ag-header-logo-name { display: none; }
    .ag-user-name   { display: none; }
    .ag-topbar      { padding: 12px 14px; flex-wrap: wrap; }
  }
  @media (max-width: 480px) {
    .ag-header-logo { padding: 0 10px; }
    .ag-notif       { display: none; }
  }

  /* ══ BOTÃO DE TEMA ══ */
  .ag-theme-btn {
    width: 34px; height: 34px; border-radius: 8px;
    background: var(--s2); border: 1px solid var(--border);
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; transition: border-color .15s, color .15s, transform .25s;
    color: var(--text-2); flex-shrink: 0; margin-left: 8px;
    user-select: none;
  }
  .ag-theme-btn:hover {
    border-color: var(--gold);
    color: var(--gold);
    transform: rotate(20deg);
  }

  /* ══ TEMA LIGHT ══ */
  .ag-app.light {
    --bg:       #f4f3f0;
    --s1:       #ffffff;
    --s2:       #f0efe9;
    --s3:       #e8e7e0;
    --border:   rgba(0,0,0,0.08);
    --border-h: rgba(0,0,0,0.15);
    --gold:         #a07c1a;
    --gold-l:       #c09a30;
    --gold-d:       rgba(160,124,26,0.1);
    --gold-brand:   #a07c1a;
    --text:     #1a1a1a;
    --text-2:   #555050;
    --text-3:   #999490;
    --green:    #1a9e6a;
    --green-d:  rgba(26,158,106,0.1);
    --red:      #c03030;
    --red-d:    rgba(192,48,48,0.1);
    --blue:     #2a5ec0;
    --blue-d:   rgba(42,94,192,0.1);
    --purple:   #6b4fc8;
    --purple-d: rgba(107,79,200,0.1);
    --amber:    #c07800;
    --amber-d:  rgba(192,120,0,0.1);
    color-scheme: light;
  }
  .ag-app.light .ag-date-input { color-scheme: light; }
  .ag-app.light .ag-user-dropdown { box-shadow: 0 8px 32px rgba(0,0,0,0.15); }
  .ag-app.light .ag-avatar {
    background: linear-gradient(135deg, rgba(160,124,26,0.15), rgba(160,124,26,0.05));
    border-color: rgba(160,124,26,0.25);
  }
  .ag-app.light .ag-header-logo-icon {
    background: linear-gradient(135deg, #b8952e, #d4af37);
  }
`;

/* ══════════════════════════════════════════════════════
   SUB-COMPONENTES
═══════════════════════════════════════════════════════ */

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "#1c1c24", border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: 8, padding: "8px 12px", fontSize: 12,
    }}>
      <p style={{ color: "#c8a55e", fontWeight: 500, marginBottom: 2 }}>{label}</p>
      <p style={{ color: "#edeae3" }}>R$ {payload[0].value?.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
    </div>
  );
}

function Val({ v, loading, prefix = "", suffix = "" }) {
  if (loading) return <span className="ag-skeleton" style={{ width: 80 }} />;
  return <>{prefix}{v}{suffix}</>;
}

/* ══════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
═══════════════════════════════════════════════════════ */
export default function Dashboard() {
  const [period,        setPeriod]       = useState("Este mês");
  const [customRange,   setCustomRange]  = useState({ from: "", to: "" });
  const [module,        setModule]       = useState("Dashboard");
  const [uid,           setUid]          = useState(null);
  const [authUser,      setAuthUser]     = useState(null);
  const [userName,      setUserName]     = useState("Usuário");
  const [menuVisivel,   setMenuVisivel]  = useState({});
  const [collapsed,     setCollapsed]    = useState(
    () => localStorage.getItem("ag_sidebar_collapsed") === "true"
  );
  const [dropdownOpen,  setDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [theme, setTheme] = useState(
    () => localStorage.getItem("ag_theme") || "dark"
  );

  const toggleTheme = () => {
    setTheme(prev => {
      const next = prev === "dark" ? "light" : "dark";
      localStorage.setItem("ag_theme", next);
      return next;
    });
  };
  const dropdownRef = useRef(null);

  /* ── Injeta CSS responsivo global após todos os estilos ── */
  useEffect(() => {
    let el = document.getElementById("ag-responsive-css");
    if (!el) {
      el = document.createElement("style");
      el.id = "ag-responsive-css";
      document.head.appendChild(el);
    }
    el.textContent = RESPONSIVE_CSS;
  }, []);

  /* ── Fecha mobile menu ao navegar ── */
  const navigateTo = (label) => {
    setModule(label);
    setMobileMenuOpen(false);
  };

  /* ── Auth ── */
  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      setAuthUser(user);
      setUid(user?.uid ?? null);
    });
  }, []);

  /* ── Nome do usuário ── */
  useEffect(() => {
    if (!uid) return;
    return onSnapshot(doc(db, "users", uid), (snap) => {
      const name =
        snap.data()?.name ||
        authUser?.displayName ||
        authUser?.email?.split("@")[0] ||
        "Usuário";
      setUserName(name);
    });
  }, [uid, authUser]);

  /* ── Visibilidade do menu ── */
  useEffect(() => {
    if (!uid) return;
    return onSnapshot(doc(db, "users", uid, "config", "geral"), (snap) => {
      if (snap.exists()) setMenuVisivel(snap.data().menuVisivel || {});
    });
  }, [uid]);

  /* ── Atalhos de teclado ── */
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!e.altKey) return;
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || document.activeElement?.isContentEditable) return;
      const atalho = ATALHO_LOOKUP[e.code];
      if (!atalho) return;
      if (!LOCKED_KEYS.has(atalho.dbKey) && menuVisivel[atalho.dbKey] === false) return;
      e.preventDefault();
      setModule(atalho.label);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [menuVisivel]);

  /* ── Fecha dropdown ao clicar fora ── */
  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = (e) => {
      if (!dropdownRef.current?.contains(e.target)) setDropdownOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [dropdownOpen]);

  /* ── Fecha mobile menu com Escape ── */
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const handler = (e) => { if (e.key === "Escape") setMobileMenuOpen(false); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [mobileMenuOpen]);

  /* ── Toggle sidebar ── */
  const toggleSidebar = () =>
    setCollapsed((v) => {
      const next = !v;
      localStorage.setItem("ag_sidebar_collapsed", String(next));
      return next;
    });

  /* ── Hooks de dados ── */
  const empresa = useEmpresa(uid);
  const { isPro } = useLicenca(uid);
  const dash    = useDashboardData(
    uid, period,
    period === "Personalizado" && customRange.from && customRange.to ? customRange : null
  );

  /* ── Logo e nome da empresa ── */
  const logoUrl      = empresa?.logo || null;
  const nomeEmpresa  = empresa?.nomeEmpresa || "Assent Gestão";
  const logoInitials = nomeEmpresa
    .split(" ").filter(Boolean).slice(0, 2)
    .map((w) => w[0]).join("").toUpperCase();

  const userInitial = userName.charAt(0).toUpperCase();

  /* ── KPI Main ── */
  const kpiMain = [
    {
      label: "Receita Bruta", value: fmtR$(dash.receitaBruta),
      trend: `${dash.numVendas} venda${dash.numVendas !== 1 ? "s" : ""}`,
      up: dash.receitaBruta > 0, accent: "var(--green)", sub: "no período selecionado",
    },
    {
      label: "Custo Total", value: fmtR$(dash.custoTotal),
      trend: dash.custoTotal === 0 ? "—" : `-${fmtR$(dash.custoTotal)}`,
      up: false, accent: "var(--red)", sub: "mercadorias e serviços",
    },
    {
      label: "Lucro Líquido", value: fmtR$(dash.lucroLiquido),
      trend: `Margem: ${dash.margem.toFixed(1)}%`,
      up: dash.lucroLiquido >= 0, accent: "var(--gold)", sub: "receita − custo",
    },
  ];

  /* ── KPI Secundário ── */
  const kpiSec = [
    { label: "Ticket Médio",    value: fmtR$(dash.ticketMedio),    accent: "var(--blue)",   sub: "por venda no período" },
    { label: "A Receber",       value: fmtR$(dash.totalAReceber),  accent: "var(--amber)",  sub: "saldo pendente" },
    { label: "Projeção 30 dias",value: fmtR$(dash.projecao),       accent: "var(--purple)", sub: "baseada na tendência" },
  ];

  /* ── Mini Stats ── */
  const miniStats = [
    { label: "Clientes",          value: dash.numClientes, icon: Users,        color: "var(--blue)",   dim: "var(--blue-d)",   nav: "Clientes" },
    { label: "Produtos",          value: dash.numProdutos, icon: Package,      color: "var(--gold)",   dim: "var(--gold-d)",   nav: "Produtos" },
    { label: "Serviços",          value: dash.numServicos, icon: Wrench,       color: "var(--green)",  dim: "var(--green-d)",  nav: "Serviços" },
    { label: "Vendas no período", value: dash.numVendas,   icon: ShoppingCart, color: "var(--purple)", dim: "var(--purple-d)", nav: "Vendas" },
  ];

  /* ── Resumo Despesas ── */
  const despesasCards = [
    { label: "Vencidas",       count: dash.despesasVencidas,  value: "Em atraso",         color: "var(--red)",    dim: "var(--red-d)" },
    { label: "A vencer (30d)", count: dash.despesasAVencer,   value: "Próximos 30 dias",  color: "var(--amber)",  dim: "var(--amber-d)" },
    { label: "Pendentes",      count: dash.despesasPendentes, value: "Total em aberto",   color: "var(--text-2)", dim: "rgba(255,255,255,0.04)" },
    { label: "Pagas",          count: dash.despesasPagasMes,  value: fmtR$(dash.valorDespesasPagas), color: "var(--green)", dim: "var(--green-d)" },
  ];

  /* ══ RENDER MÓDULOS ══ */
  const renderModulo = () => {
    switch (module) {
      case "Clientes":            return <Clientes isPro={isPro} />;
      case "Produtos":            return <Produtos isPro={isPro} />;
      case "Serviços":            return <Servicos isPro={isPro} />;
      case "Vendedores":          return <Vendedores />;
      case "Vendas":              return <Vendas isPro={isPro} />;
      case "Configurações":       return <Configuracoes menuVisivel={menuVisivel} />;
      case "Despesas":            return <Despesas isPro={isPro} />;
      case "Entrada de Estoque":  return <EntradaEstoque />;
      case "Agenda":              return <Agenda isPro={isPro} />;
      case "Fornecedores":        return <Fornecedores />;
      case "A Receber":           return <AReceber />;
      case "Relatórios":          return <Relatorios />;
      case "Caixa Diário":        return <CaixaDiario />;
      case "Orçamentos":          return <Orcamentos isPro={isPro} />;
      default:                    return renderDashboard();
    }
  };

  /* ══ RENDER DASHBOARD ══ */
  const renderDashboard = () => (
    <>
      <header className="ag-topbar">
        <div className="ag-topbar-title">
          <h1>Dashboard</h1>
          <p>Visão geral do negócio</p>
        </div>
        <div style={{ flex: 1 }} />
        <div className="ag-search">
          <Search size={13} color="var(--text-3)" />
          <input placeholder="Buscar módulos, clientes..." />
        </div>
        <div className="ag-periods">
          {PERIODS.map((p) => (
            <button
              key={p}
              className={`ag-period-btn ${period === p ? "active" : ""}`}
              onClick={() => setPeriod(p)}
            >
              {p}
            </button>
          ))}
        </div>
        {period === "Personalizado" && (
          <div className="ag-custom-range">
            <label>De</label>
            <input
              type="date" className="ag-date-input"
              value={customRange.from} max={customRange.to || undefined}
              onChange={(e) => setCustomRange((r) => ({ ...r, from: e.target.value }))}
            />
            <span className="ag-date-sep">→</span>
            <label>Até</label>
            <input
              type="date" className="ag-date-input"
              value={customRange.to} min={customRange.from || undefined}
              onChange={(e) => setCustomRange((r) => ({ ...r, to: e.target.value }))}
            />
          </div>
        )}
      </header>

      <div className="ag-content">
        {/* Mini Stats */}
        <div className="g4">
          {miniStats.map((s) => (
            <div
              key={s.label}
              className="ag-card ag-card-click"
              onClick={() => setModule(s.nav)}
              title={`Ir para ${s.nav}`}
            >
              <div className="ag-mini">
                <div className="ag-mini-icon" style={{ background: s.dim }}>
                  <s.icon size={19} color={s.color} />
                </div>
                <div>
                  <div className="ag-mini-val"><Val v={s.value} loading={dash.loading} /></div>
                  <div className="ag-mini-lbl">{s.label}</div>
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
                <ChevronRight size={13} color={s.color} style={{ opacity: 0.5 }} />
              </div>
            </div>
          ))}
        </div>

        {/* KPI Principal */}
        <div className="g3">
          {kpiMain.map((k) => (
            <div key={k.label} className="ag-card" style={{ borderTop: `2px solid ${k.accent}` }}>
              <div className="ag-kpi-label">{k.label}</div>
              <div className="ag-kpi-val"><Val v={k.value} loading={dash.loading} /></div>
              <div className="ag-kpi-meta">
                <span className="ag-trend" style={{ color: k.up ? "var(--green)" : "var(--red)" }}>
                  {k.up ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                  {k.trend}
                </span>
                <span className="ag-sub">{k.sub}</span>
              </div>
            </div>
          ))}
        </div>

        {/* KPI Secundário */}
        <div className="g3">
          {kpiSec.map((k) => (
            <div key={k.label} className="ag-card" style={{ borderTop: `2px solid ${k.accent}` }}>
              <div className="ag-kpi-label">{k.label}</div>
              <div className="ag-kpi-val"><Val v={k.value} loading={dash.loading} /></div>
              <div className="ag-kpi-meta"><span className="ag-sub">{k.sub}</span></div>
            </div>
          ))}
        </div>

        {/* Gráficos */}
        <div className="g21">
          <div className="ag-card">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div className="ag-card-title">Faturamento por período</div>
              <span style={{
                fontSize: 10, fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase",
                color: "var(--gold)", background: "var(--gold-d)", padding: "3px 9px",
                borderRadius: 20, border: "1px solid rgba(200,165,94,0.2)",
              }}>
                {period === "Personalizado" && customRange.from && customRange.to
                  ? `${customRange.from.split("-").reverse().join("/")} – ${customRange.to.split("-").reverse().join("/")}`
                  : period === "Personalizado" ? "Selecione o intervalo" : period}
              </span>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={dash.loading ? [] : dash.faturamentoPorDia} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="gGold" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#c8a55e" stopOpacity={0.22} />
                    <stop offset="95%" stopColor="#c8a55e" stopOpacity={0}    />
                  </linearGradient>
                </defs>
                <XAxis dataKey="d" tick={{ fill: "#3a3842", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#3a3842", fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="v" stroke="#c8a55e" strokeWidth={2} fill="url(#gGold)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="ag-card" style={{ display: "flex", flexDirection: "column" }}>
            <div className="ag-card-title" style={{ marginBottom: 12 }}>Mix de receita</div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
              <PieChart width={130} height={130}>
                <Pie
                  data={dash.loading ? [{ name: "", value: 1 }] : dash.mixData}
                  cx={60} cy={60} innerRadius={42} outerRadius={60} dataKey="value" strokeWidth={0}
                >
                  {(dash.mixData || []).map((_, i) => (
                    <Cell key={i} fill={i === 0 ? "#c8a55e" : "#3ecf8e"} opacity={dash.loading ? 0.2 : (i === 0 ? 0.9 : 0.85)} />
                  ))}
                </Pie>
              </PieChart>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
                {(dash.mixData || []).map((item, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: i === 0 ? "#c8a55e" : "#3ecf8e" }} />
                    <span style={{ color: "var(--text-2)", flex: 1 }}>{item.name}</span>
                    <span style={{ color: "var(--text)", fontWeight: 500 }}>
                      {dash.loading ? "—" : `${item.value}%`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Tabelas Produtos / Clientes */}
        <div className="g11">
          <div className="ag-card-bare">
            <div className="ag-card-header">
              <span className="ag-card-title">Produtos mais vendidos</span>
            </div>
            <div style={{ overflowX: "auto" }}>
              <div className="ag-trow ag-thead" style={{ gridTemplateColumns: "1fr 60px 110px", minWidth: 280 }}>
                <span className="ag-th">Produto</span>
                <span className="ag-th" style={{ textAlign: "center" }}>Qtd</span>
                <span className="ag-th" style={{ textAlign: "right" }}>Total</span>
              </div>
              {dash.loading ? (
                <div className="ag-trow" style={{ gridTemplateColumns: "1fr", minWidth: 280 }}><span className="ag-skeleton" /></div>
              ) : dash.topProdutos.length === 0 ? (
                <div className="ag-empty-row">Nenhuma venda no período</div>
              ) : (
                dash.topProdutos.map((p, i) => (
                  <div key={i} className="ag-trow" style={{ gridTemplateColumns: "1fr 60px 110px", minWidth: 280 }}>
                    <span>{p.nome}</span>
                    <span style={{ textAlign: "center" }}>{p.qtd}</span>
                    <span style={{ color: "var(--green)", textAlign: "right" }}>{fmtR$(p.total)}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="ag-card-bare">
            <div className="ag-card-header">
              <span className="ag-card-title">Clientes que mais compram</span>
            </div>
            <div style={{ overflowX: "auto" }}>
              <div className="ag-trow ag-thead" style={{ gridTemplateColumns: "1fr 120px", minWidth: 240 }}>
                <span className="ag-th">Cliente</span>
                <span className="ag-th" style={{ textAlign: "right" }}>Total gasto</span>
              </div>
              {dash.loading ? (
                <div className="ag-trow" style={{ gridTemplateColumns: "1fr", minWidth: 240 }}><span className="ag-skeleton" /></div>
              ) : dash.topClientes.length === 0 ? (
                <div className="ag-empty-row">Nenhuma venda no período</div>
              ) : (
                dash.topClientes.map((c, i) => (
                  <div key={i} className="ag-trow" style={{ gridTemplateColumns: "1fr 120px", minWidth: 240 }}>
                    <span>{c.nome}</span>
                    <span style={{ color: "var(--gold)", textAlign: "right" }}>{fmtR$(c.total)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Últimas Vendas */}
        <div className="g1 ag-card-bare">
          <div className="ag-card-header">
            <span className="ag-card-title">Últimas vendas</span>
            <button className="ag-view-all" onClick={() => setModule("Vendas")}>
              Ver todas <ChevronRight size={12} />
            </button>
          </div>
          <div style={{ overflowX: "auto" }}>
            <div className="ag-trow ag-thead" style={{ gridTemplateColumns: "90px 1fr 130px 130px", minWidth: 440 }}>
              {["ID", "Cliente", "Data", "Total"].map((h) => (
                <span key={h} className="ag-th" style={{ textAlign: h === "Total" ? "right" : "left" }}>{h}</span>
              ))}
            </div>
            {dash.loading ? (
              <div className="ag-trow" style={{ gridTemplateColumns: "1fr", minWidth: 440 }}><span className="ag-skeleton" /></div>
            ) : dash.ultimasVendas.length === 0 ? (
              <div className="ag-empty-row">Nenhuma venda no período</div>
            ) : (
              dash.ultimasVendas.map((v, i) => (
                <div key={v.id || i} className="ag-trow" style={{ gridTemplateColumns: "90px 1fr 130px 130px", minWidth: 440 }}>
                  <span style={{ color: "var(--gold)" }}>{v.id}</span>
                  <span>{v.cliente || "—"}</span>
                  <span>{fmtData(v.data)}</span>
                  <span style={{ color: "var(--green)", textAlign: "right" }}>{fmtR$(v.total)}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Resumo Despesas */}
        <div className="g1 ag-card-bare">
          <div className="ag-card-header">
            <span className="ag-card-title">Resumo de despesas</span>
            <button className="ag-view-all" onClick={() => setModule("Despesas")}>
              Ver todas <ChevronRight size={12} />
            </button>
          </div>
          <div className="ag-despesa-grid">
            {despesasCards.map((d) => (
              <div key={d.label} className="ag-despesa-card" style={{ background: d.dim, border: `1px solid ${d.color}28` }}>
                <div className="ag-despesa-label" style={{ color: d.color }}>{d.label}</div>
                <div className="ag-despesa-count">
                  {dash.loading ? <span className="ag-skeleton" style={{ width: 40 }} /> : d.count}
                </div>
                <div className="ag-despesa-val">{d.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );

  /* ══ RENDER PRINCIPAL ══ */
  return (
    <>
      <style>{CSS}</style>

      <div className={`ag-app${theme === "light" ? " light" : ""}`}>

        {/* ── HEADER GLOBAL ── */}
        <header className="ag-global-header">
          <button
            className="ag-toggle-btn"
            onClick={toggleSidebar}
            title={collapsed ? "Expandir menu" : "Recolher menu"}
            aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
          >
            {collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
          </button>

          <div className="ag-header-logo">
            {logoUrl ? (
              <img src={logoUrl} alt={nomeEmpresa} className="ag-header-logo-img" />
            ) : (
              <div className="ag-header-logo-icon">{logoInitials}</div>
            )}
            <span className="ag-header-logo-name">{nomeEmpresa}</span>
            {isPro && (
              <span style={{
                fontSize: 9, fontWeight: 700, letterSpacing: "0.1em",
                textTransform: "uppercase",
                background: "linear-gradient(135deg,#D4AF37,#e8ca60)",
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                border: "1px solid rgba(200,165,94,0.4)",
                borderRadius: 20, padding: "2px 7px", flexShrink: 0,
              }}>PRO</span>
            )}
          </div>

          <div className="ag-header-spacer" />

          <div className="ag-notif" title="Notificações"><Bell size={15} /></div>

          <div
            className="ag-theme-btn"
            onClick={toggleTheme}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && toggleTheme()}
            title={theme === "dark" ? "Mudar para tema claro" : "Mudar para tema escuro"}
            aria-label="Alternar tema"
          >
            {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
          </div>

          <div className="ag-user-area" ref={dropdownRef}>
            <div
              className="ag-user-trigger"
              onClick={() => setDropdownOpen((v) => !v)}
              role="button" aria-haspopup="true" aria-expanded={dropdownOpen}
            >
              <div className="ag-avatar">{userInitial}</div>
              <span className="ag-user-name">{userName}</span>
              <ChevronDown size={13} className={`ag-user-chevron ${dropdownOpen ? "open" : ""}`} />
            </div>

            {dropdownOpen && (
              <div className="ag-user-dropdown" role="menu">
                <button
                  className="ag-dropdown-item"
                  onClick={() => { setModule("Configurações"); setDropdownOpen(false); }}
                >
                  <Settings size={13} /> Configurações
                </button>
                <div className="ag-dropdown-divider" />
                <button
                  className="ag-dropdown-item danger"
                  onClick={() => { logout(); window.location.reload(); }}
                >
                  <LogOut size={13} /> Sair da conta
                </button>
              </div>
            )}
          </div>
        </header>

        {/* ── CORPO: sidebar + main ── */}
        <div className="ag-body">

          {/* Sidebar desktop recolhível */}
          <aside className={`ag-sidebar ${collapsed ? "collapsed" : ""}`}>
            <nav className="ag-nav">
              {NAV.map((sec) => (
                <div key={sec.section}>
                  <div className="ag-sec-label">{sec.section}</div>
                  {sec.items.map((item) => {
                    const dbKey = KEY_MAP[item.label];
                    if (dbKey && menuVisivel[dbKey] === false) return null;
                    return (
                      <div
                        key={item.label}
                        className={`ag-nav-item ${module === item.label ? "active" : ""}`}
                        onClick={() => setModule(item.label)}
                        data-label={item.label}
                        title={collapsed ? item.label : undefined}
                      >
                        <item.icon size={15} />
                        <span>{item.label}</span>
                      </div>
                    );
                  })}
                </div>
              ))}
            </nav>
          </aside>

          {/* Conteúdo principal */}
          <main className="ag-main">
            {renderModulo()}
          </main>

        </div>

        {/* ── BOTTOM NAV MOBILE ── */}
        <nav className="ag-mobile-nav" aria-label="Navegação mobile">
          {BOTTOM_NAV.map((item) => (
            <button
              key={item.label}
              className={`ag-mobile-nav-btn ${module === item.label ? "active" : ""}`}
              onClick={() => navigateTo(item.label)}
            >
              <item.icon size={20} />
              <span>{item.label}</span>
            </button>
          ))}
          <button
            className={`ag-mobile-nav-btn ${mobileMenuOpen ? "active" : ""}`}
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Abrir menu"
          >
            <Menu size={20} />
            <span>Menu</span>
          </button>
        </nav>

        {/* ── OVERLAY + SIDEBAR MOBILE ── */}
        {mobileMenuOpen && (
          <>
            {/* Fundo escuro clicável */}
            <div
              className="ag-mobile-overlay"
              style={{ display: "block" }}
              onClick={() => setMobileMenuOpen(false)}
              aria-hidden="true"
            />

            {/* Sidebar deslizante */}
            <aside className="ag-sidebar-mobile" aria-label="Menu de navegação">
              <div className="ag-sidebar-mobile-header">
                <div className="ag-header-logo">
                  {logoUrl ? (
                    <img src={logoUrl} alt={nomeEmpresa} className="ag-header-logo-img" />
                  ) : (
                    <div className="ag-header-logo-icon">{logoInitials}</div>
                  )}
                  <span className="ag-header-logo-name">{nomeEmpresa}</span>
                  {isPro && (
                    <span style={{
                      fontSize: 9, fontWeight: 700, letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      background: "linear-gradient(135deg,#D4AF37,#e8ca60)",
                      WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                      border: "1px solid rgba(200,165,94,0.4)",
                      borderRadius: 20, padding: "2px 7px", flexShrink: 0,
                    }}>PRO</span>
                  )}
                </div>
                <button
                  className="ag-sidebar-mobile-close"
                  onClick={() => setMobileMenuOpen(false)}
                  aria-label="Fechar menu"
                >
                  <X size={16} />
                </button>
              </div>

              <nav className="ag-nav" style={{ padding: "10px 0" }}>
                {NAV.map((sec) => (
                  <div key={sec.section}>
                    <div className="ag-sec-label">{sec.section}</div>
                    {sec.items.map((item) => {
                      const dbKey = KEY_MAP[item.label];
                      if (dbKey && menuVisivel[dbKey] === false) return null;
                      return (
                        <div
                          key={item.label}
                          className={`ag-nav-item ${module === item.label ? "active" : ""}`}
                          onClick={() => navigateTo(item.label)}
                          data-label={item.label}
                        >
                          <item.icon size={15} />
                          <span>{item.label}</span>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </nav>
            </aside>
          </>
        )}

      </div>
    </>
  );
}
