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

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell,
  BarChart, Bar, LineChart, Line,
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  CartesianGrid,
} from "recharts";
import {
  LayoutDashboard, Users, Package, Wrench, ArrowDownToLine,
  ShoppingCart, Clock, Wallet, TrendingDown, Truck, BarChart3,
  Calendar, Settings, Zap, UserCheck, UserPlus, Search, ArrowUpRight,
  ArrowDownRight, ChevronRight, Bell, LogOut, ChevronDown,
  PanelLeftClose, PanelLeftOpen, Menu, X, Sun, Moon, LayoutGrid, GraduationCap, TrendingUp, Barcode, CreditCard,
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
import Usuarios      from "./modules/Usuarios.jsx";
import Compras       from "./modules/Compras.jsx";
import Mesas         from "./modules/Mesas.jsx";
import Alunos        from "./modules/Alunos.jsx";
import PDV          from "./modules/PDV.jsx";
import CRMModule    from "./crm/CRMModule.jsx";
import AssFlow      from "./flow/AssFlow.jsx";

import RotaProtegida from "./contexts/RotaProtegida";
import { usePermissao } from "./hooks/usePermissao";

/* ── Firebase ──────────────────────────────────── */
import { db, logout } from "./lib/firebase";
import { initFCM, obterTokenPush } from "./lib/fcm";
import { useAuth } from "./contexts/AuthContext";
import { doc, onSnapshot, collection, query, orderBy, limit, where, getDocs, getDoc, updateDoc } from "firebase/firestore";
import { fsError, fsSnapshotError } from "./utils/firestoreError";

/* ── Hooks de dados ────────────────────────────── */
import { useDashboardData, fmtR$, fmtData } from "./hooks/useDashboardData";
import { useEmpresa }                        from "./hooks/useEmpresa";
import { useLicenca }                        from "./hooks/useLicenca";
import { useNotificacoes }                   from "./hooks/useNotificacoes";

/* ═══════════════════════════════════════════════
   CONSTANTES
   ═══════════════════════════════════════════════ */

const PERIODS = ["Hoje", "7 dias", "30 dias", "Este mês", "Todos", "Personalizado"];

const KEY_MAP = {
  "Dashboard":          "dashboard",
  "Clientes":           "clientes",
  "Produtos":           "produtos",
  "Serviços":           "servicos",
  "Estoque":           "entrada_estoque",
  "Vendas":             "vendas",
  "Matriculas":            "matriculas",
  "Fiado / A Receber":  "fiado",
  "Caixa Diário":       "caixa",
  "Despesas":           "despesas",
  "Fornecedores":       "fornecedores",
  "Relatórios":         "relatorios",
  "Agenda":             "agenda",
  "Orçamentos":         "orcamentos",
  "Vendedores":         "vendedores",
  "Usuários":           "usuarios",
  "Configurações":      "config",
   "Compras":           "compras",
   "Mesas":             "mesas",
  "PDV":              "pdv",
};

const ATALHOS_TECLADO = [
  { code: "KeyD", label: "Dashboard",           dbKey: "dashboard"       },
  { code: "KeyC", label: "Clientes",            dbKey: "clientes"        },
  { code: "KeyP", label: "Produtos",            dbKey: "produtos"        },
  { code: "KeyS", label: "Serviços",            dbKey: "servicos"        },
  { code: "KeyE", label: "Estoque",             dbKey: "entrada_estoque" },
  { code: "KeyV", label: "Vendas",              dbKey: "vendas"          },
  { code: "KeyF", label: "A Receber",           dbKey: "fiado"           },
  { code: "KeyH", label: "Matriculas",          dbKey: "matriculas"      },
  { code: "KeyX", label: "Caixa Diário",        dbKey: "caixa"           },
  { code: "KeyZ", label: "Despesas",            dbKey: "despesas"        },
  { code: "KeyN", label: "Fornecedores",        dbKey: "fornecedores"    },
  { code: "KeyR", label: "Relatórios",          dbKey: "relatorios"      },
  { code: "KeyA", label: "Agenda",              dbKey: "agenda"          },
  { code: "KeyO", label: "Orçamentos",          dbKey: "orcamentos"      },
  { code: "KeyM", label: "Vendedores",          dbKey: "vendedores"      },
  { code: "KeyU", label: "Usuários",            dbKey: "usuarios"        },
  { code: "KeyG", label: "Configurações",       dbKey: "config"          },
  { code: "KeyT", label: "Mesas",               dbKey: "mesas"           },
  { code: "KeyB", label: "PDV",                 dbKey: "pdv"             },
];

const LOCKED_KEYS  = new Set(["dashboard", "config"]);
const ATALHO_LOOKUP = Object.fromEntries(ATALHOS_TECLADO.map(a => [a.code, a]));

const NAV = [
  { section: "BÁSICO", items: [
    { label: "Dashboard",       modulo: "dashboard",       icone: LayoutDashboard,  secao: "PRINCIPAL" },
    { label: "Clientes",        modulo: "clientes",         icone: Users,            secao: "PRINCIPAL" },
   { label: "Produtos",        modulo: "produtos",         icone: Package,          secao: "ESTOQUE"   },
    { label: "Serviços",        modulo: "servicos",         icone: Wrench,           secao: "ESTOQUE"   },
  ]},
  { section: "OPERAÇÕES", items: [
    { label: "Estoque", modulo: "entradaEstoque",   icone: ArrowDownToLine,  secao: "ESTOQUE"   },
    { label: "Vendas",          modulo: "vendas",           icone: TrendingDown,       secao: "COMERCIAL" },
    { label: "PDV",            modulo: "pdv",              icone: Barcode,            secao: "COMERCIAL" },
     { label: "Mesas",           modulo: "mesas",            icone: LayoutGrid,       secao: "OPERAÇÕES"  },
    { label: "A Receber",       modulo: "aReceber",         icone: Clock,            secao: "FINANCEIRO"},
    {label: "Matriculas",       modulo: "alunos",       icone: GraduationCap,    secao: "COMERCIAL" }, 
   { label: "Compras",         modulo: "compras",          icone: ShoppingCart,     secao: "COMERCIAL" },
    { label: "Caixa Diário",    modulo: "caixaDiario",      icone: Wallet,           secao: "FINANCEIRO"},
    { label: "Despesas",        modulo: "despesas",         icone: ArrowDownRight,          secao: "FINANCEIRO"},
   { label: "Fornecedores",    modulo: "fornecedores",     icone: Truck,            secao: "ESTOQUE"   },
     { label: "Orçamentos",      modulo: "orcamentos",       icone: Zap,         secao: "COMERCIAL" },
    { label: "Vendedores",      modulo: "vendedores",       icone: UserCheck,          secao: "COMERCIAL" },
  ]},
  { section: "ANÁLISE", items: [
    { label: "Relatórios",      modulo: "relatorios",       icone: BarChart3,        secao: "FINANCEIRO"},
    { label: "Agenda",          modulo: "agenda",           icone: Calendar,         secao: "PRINCIPAL" },
  ]},
  { section: "SISTEMA", items: [
   
    { label: "Usuários",        modulo: "usuarios",         icone: UserPlus,         secao: "SISTEMA"   },
    { icone: Settings, label: "Configurações" },
  ]},
];

/* Itens do bottom nav mobile */
const BOTTOM_NAV = [
  { icone: LayoutDashboard, label: "Dashboard" },
  { icone: Users,           label: "Clientes"  },
  { icone: ShoppingCart,    label: "Vendas"    },
  { icone: Calendar,        label: "Agenda"    },
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
  /* ag-main vira o scrollable container */
  .ag-main {
    overflow-y: auto !important;
    -webkit-overflow-scrolling: touch !important;
    display: block !important;
  }
  /* ag-page cresce com o conteúdo, sem altura fixa */
  .ag-page {
    height: auto !important;
    min-height: 100% !important;
    overflow: visible !important;
  }
  /* ag-content não precisa mais scrollar — o pai scrolla */
  .ag-content {
    overflow: visible !important;
    flex: none !important;
    min-height: 0 !important;
  }

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

  /* Lista: scroll horizontal desativado no mobile — usa card layout */
  .ag-lista-wrap { overflow-x: visible !important; }
  .ag-row, .ag-row-head { min-width: unset !important; }

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
  .ag-search       { display: none !important; }
  .ag-periods      { display: none !important; }
  .ag-custom-range { display: none !important; }
  .ag-period-mobile { display: flex !important; }
  .db-kpi-strip { grid-template-columns: repeat(2, 1fr) !important; }
  .db-body { grid-template-columns: 1fr !important; }
  .db-aside { display: flex !important; }
}
@media (min-width: 721px) {
  .ag-period-mobile { display: none !important; }
}
@media (max-width: 480px) {
  .db-kpi-strip { grid-template-columns: 1fr 1fr !important; }
  .db-kpi-val { font-size: 16px !important; }
  .db-kpi-card { padding: 12px 14px !important; }
  .db-panel { overflow: hidden; }
  .db-aside { min-width: 0; }
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
  @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body, #root { height: 100%; width: 100%; margin: 0; padding: 0; }

  :root {
    --bg:           #07070a;
    --s1:           #0d0d11;
    --s2:           #121217;
    --s3:           #18181f;
    --border:       rgba(255,255,255,0.065);
    --border-h:     rgba(255,255,255,0.12);
    --gold:         #c8a55e;
    --gold-l:       #dfc07c;
    --gold-d:       rgba(200,165,94,0.10);
    --gold-brand:   #D4AF37;
    --text:         #edeae3;
    --text-2:       #9895a3;
    --text-3:       rgba(255,255,255,0.28);
    --green:        #3ecf8e;
    --green-d:      rgba(62,207,142,0.09);
    --red:          #e05252;
    --red-d:        rgba(224,82,82,0.09);
    --blue:         #5b8ef0;
    --blue-d:       rgba(91,142,240,0.09);
    --purple:       #a78bfa;
    --purple-d:     rgba(167,139,250,0.09);
    --amber:        #f59e0b;
    --amber-d:      rgba(245,158,11,0.09);
    --sidebar-w:    220px;
    --sidebar-w-sm: 64px;
    --header-h:     62px;
    --sidebar-transition: width 0.22s cubic-bezier(0.4,0,0.2,1);
    /* tech tokens */
    --glow-gold:    0 0 24px rgba(200,165,94,0.07);
    --glow-card:    0 2px 12px rgba(0,0,0,0.4);
    --grid-line:    rgba(200,165,94,0.025);
    font-family: 'Sora', system-ui, sans-serif;
    --font-display: 'Sora', system-ui, sans-serif;
    --font-mono:    'DM Mono', monospace;
    color-scheme: dark;
  }

  /* ══ LAYOUT RAIZ ══ */
  .ag-app {
    display: flex;
    flex-direction: column;
    height: 100vh;
    height: 100dvh;
    background: var(--bg);
    color: var(--text);
    overflow: hidden;
  }

  /* ══ HEADER GLOBAL ══ */
  .ag-global-header {
    height: var(--header-h);
    flex-shrink: 0;
    background: rgba(13,13,17,0.95);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border-bottom: 1px solid var(--border);
    box-shadow: 0 1px 0 rgba(200,165,94,0.06), 0 4px 24px rgba(0,0,0,0.4);
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
    font-family: 'Sora', system-ui, sans-serif; font-weight: 700; font-size: 13px;
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
    color: var(--text-2); flex-shrink: 0; position: relative;
  }
  .ag-notif:hover { border-color: var(--border-h); color: var(--text); }

  .ag-notif-badge {
    position: absolute; top: -5px; right: -5px;
    background: var(--red); color: #fff;
    border-radius: 10px; font-size: 9px; font-weight: 700;
    padding: 1px 5px; font-family: 'DM Mono', monospace;
    line-height: 1.6; pointer-events: none;
    border: 2px solid var(--bg);
  }

 /* ══ NOTIFICAÇÕES ══ */
.ag-notif-panel {
  position: absolute; top: calc(100% + 10px); right: 0;
  width: 400px; max-height: 580px;
  background: rgba(13,13,17,0.96);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(200,165,94,0.10);
  border-radius: 20px; box-shadow: 0 20px 60px rgba(0,0,0,.50), 0 0 0 1px rgba(255,255,255,0.03) inset;
  z-index: 200; overflow: hidden; display: flex; flex-direction: column;
}
@media (max-width: 480px) {
  .ag-notif-panel {
    position: fixed;
    top: 60px;
    left: 12px;
    right: 12px;
    width: auto;
    max-height: 70vh;
  }
}

.ag-notif-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 18px 12px;
  border-bottom: 1px solid var(--border);
  font-size: 11px; font-weight: 600; letter-spacing: 1.2px;
  text-transform: uppercase; color: var(--text-2);
  flex-shrink: 0;
}

.ag-notif-list {
  overflow-y: auto; flex: 1;
  max-height: 520px;
  scrollbar-width: thin;
  scrollbar-color: var(--border) transparent;
  padding: 8px 8px;
  display: flex; flex-direction: column; gap: 6px;
}
.ag-notif-list::-webkit-scrollbar { width: 4px; }
.ag-notif-list::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }

/* ══ HOLOGRAPHIC NOTIFICATIONS ══ */
@keyframes holo-scan {
  0%   { transform: translateY(-100%); }
  100% { transform: translateY(500%);  }
}
@keyframes holo-flicker {
  0%,89%,91%,100% { opacity: 1; }
  90%             { opacity: .82; }
}

/* wrapper */
.holo {
  position: relative;
  display: flex; flex-direction: column; align-items: stretch;
  animation: holo-flicker 9s ease-in-out infinite;
}

/* card */
.holo-card {
  position: relative; overflow: hidden;
  border-radius: 12px;
  padding: 13px 38px 13px 13px;
  background: rgba(9,9,14,0.93);
  display: flex; flex-direction: column; gap: 0;
  z-index: 1;
  transition: transform .18s, box-shadow .18s;
  cursor: default;
}
.holo:hover .holo-card { transform: translateY(-2px); }

/* scanlines estáticas */
.holo-card::before {
  content: "";
  position: absolute; inset: 0;
  background: repeating-linear-gradient(
    0deg,
    transparent 0px, transparent 3px,
    rgba(255,255,255,0.011) 3px, rgba(255,255,255,0.011) 4px
  );
  pointer-events: none; z-index: 0; border-radius: 12px;
}

/* scan band animada */
.holo-card::after {
  content: "";
  position: absolute; left: 0; right: 0; height: 55px;
  background: linear-gradient(180deg, transparent 0%, rgba(255,255,255,0.022) 50%, transparent 100%);
  pointer-events: none; z-index: 1;
  animation: holo-scan 6s linear infinite;
}

/* beam — cone de projeção abaixo do card */
.holo-beam {
  height: 14px;
  margin: 0 20px;
  clip-path: polygon(3% 0%, 97% 0%, 78% 100%, 22% 100%);
  opacity: .9;
}

/* base — plataforma emissora */
.holo-base {
  height: 2px; border-radius: 2px;
  margin: 0 26px;
}

/* ícone */
.holo-icon {
  width: 36px; height: 36px; border-radius: 9px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  border: 1px solid; position: relative; overflow: hidden; z-index: 2;
}
.holo-icon::after {
  content: "";
  position: absolute; top: 0; left: 0; right: 0; height: 50%;
  background: linear-gradient(180deg, rgba(255,255,255,0.11) 0%, transparent 100%);
  border-radius: 9px 9px 0 0; pointer-events: none;
}

/* top row */
.holo-row-top {
  display: flex; align-items: center; gap: 10px;
  margin-bottom: 9px; position: relative; z-index: 2;
}

/* categoria */
.holo-categoria {
  font-size: 9px; font-weight: 700; letter-spacing: 0.10em;
  text-transform: uppercase; flex: 1; line-height: 1.2;
  font-family: 'Sora', system-ui, sans-serif;
}

/* badge urgência */
.holo-urgencia {
  font-size: 9px; font-weight: 700; letter-spacing: 0.07em;
  text-transform: uppercase; padding: 2px 8px;
  border-radius: 20px; border: 1px solid; flex-shrink: 0;
  font-family: 'Sora', system-ui, sans-serif;
}

/* conteúdo */
.holo-title {
  font-size: 13px; font-weight: 700; color: var(--text);
  font-family: 'Sora', system-ui, sans-serif; line-height: 1.35;
  position: relative; z-index: 2; padding-left: 46px;
}
.holo-msg {
  font-size: 11px; color: var(--text-2); line-height: 1.5;
  font-family: 'Sora', system-ui, sans-serif;
  position: relative; z-index: 2; padding-left: 46px; margin-top: 3px;
}
.holo-meta {
  display: flex; align-items: center; gap: 6px;
  padding-left: 46px; margin-top: 8px;
  position: relative; z-index: 2;
}
.holo-meta-dot {
  width: 5px; height: 5px; border-radius: 50%; flex-shrink: 0;
}
.holo-meta span:last-child {
  font-size: 10px; color: var(--text-3);
  font-family: 'DM Mono', monospace;
}

/* close */
.holo-close {
  position: absolute; top: 10px; right: 10px; z-index: 10;
  width: 22px; height: 22px; border-radius: 6px;
  background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07);
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; color: var(--text-3); padding: 0;
  transition: background .13s, color .13s;
}
.holo-close:hover { background: rgba(255,255,255,0.09); color: var(--text); }

/* ══ TONES ══ */
/* GOLD */
.holo.gold .holo-card { border: 1px solid rgba(200,165,94,.30); box-shadow: 0 0 28px rgba(200,165,94,.08), 0 2px 12px rgba(0,0,0,.5), inset 0 1px 0 rgba(200,165,94,.12); }
.holo.gold .holo-icon { background: rgba(200,165,94,.12); border-color: rgba(200,165,94,.35); color: #c8a55e; }
.holo.gold .holo-beam { background: linear-gradient(180deg, rgba(200,165,94,.20) 0%, transparent 100%); }
.holo.gold .holo-base { background: #c8a55e; box-shadow: 0 0 10px rgba(200,165,94,.6), 0 0 22px rgba(200,165,94,.28); }
.holo.gold .holo-meta-dot { background: #c8a55e; box-shadow: 0 0 5px rgba(200,165,94,.7); }
.holo.gold .holo-categoria { color: #c8a55e; }
.holo.gold .holo-urgencia { color: #c8a55e; border-color: rgba(200,165,94,.35); background: rgba(200,165,94,.10); }
.holo.gold:hover .holo-card { box-shadow: 0 0 40px rgba(200,165,94,.14), 0 6px 20px rgba(0,0,0,.5), inset 0 1px 0 rgba(200,165,94,.18); }

/* CYAN */
.holo.cyan .holo-card { border: 1px solid rgba(62,207,142,.28); box-shadow: 0 0 28px rgba(62,207,142,.08), 0 2px 12px rgba(0,0,0,.5), inset 0 1px 0 rgba(62,207,142,.10); }
.holo.cyan .holo-icon { background: rgba(62,207,142,.10); border-color: rgba(62,207,142,.32); color: #3ecf8e; }
.holo.cyan .holo-beam { background: linear-gradient(180deg, rgba(62,207,142,.18) 0%, transparent 100%); }
.holo.cyan .holo-base { background: #3ecf8e; box-shadow: 0 0 10px rgba(62,207,142,.6), 0 0 22px rgba(62,207,142,.28); }
.holo.cyan .holo-meta-dot { background: #3ecf8e; box-shadow: 0 0 5px rgba(62,207,142,.7); }
.holo.cyan .holo-categoria { color: #3ecf8e; }
.holo.cyan .holo-urgencia { color: #3ecf8e; border-color: rgba(62,207,142,.35); background: rgba(62,207,142,.10); }
.holo.cyan:hover .holo-card { box-shadow: 0 0 40px rgba(62,207,142,.14), 0 6px 20px rgba(0,0,0,.5), inset 0 1px 0 rgba(62,207,142,.16); }

/* MAG */
.holo.mag .holo-card { border: 1px solid rgba(224,82,82,.28); box-shadow: 0 0 28px rgba(224,82,82,.08), 0 2px 12px rgba(0,0,0,.5), inset 0 1px 0 rgba(224,82,82,.10); }
.holo.mag .holo-icon { background: rgba(224,82,82,.10); border-color: rgba(224,82,82,.32); color: #e05252; }
.holo.mag .holo-beam { background: linear-gradient(180deg, rgba(224,82,82,.18) 0%, transparent 100%); }
.holo.mag .holo-base { background: #e05252; box-shadow: 0 0 10px rgba(224,82,82,.6), 0 0 22px rgba(224,82,82,.28); }
.holo.mag .holo-meta-dot { background: #e05252; box-shadow: 0 0 5px rgba(224,82,82,.7); }
.holo.mag .holo-categoria { color: #e05252; }
.holo.mag .holo-urgencia { color: #e05252; border-color: rgba(224,82,82,.35); background: rgba(224,82,82,.10); }
.holo.mag:hover .holo-card { box-shadow: 0 0 40px rgba(224,82,82,.14), 0 6px 20px rgba(0,0,0,.5), inset 0 1px 0 rgba(224,82,82,.16); }

/* AMBER */
.holo.amber .holo-card { border: 1px solid rgba(245,158,11,.28); box-shadow: 0 0 28px rgba(245,158,11,.08), 0 2px 12px rgba(0,0,0,.5), inset 0 1px 0 rgba(245,158,11,.10); }
.holo.amber .holo-icon { background: rgba(245,158,11,.10); border-color: rgba(245,158,11,.32); color: #f59e0b; }
.holo.amber .holo-beam { background: linear-gradient(180deg, rgba(245,158,11,.18) 0%, transparent 100%); }
.holo.amber .holo-base { background: #f59e0b; box-shadow: 0 0 10px rgba(245,158,11,.6), 0 0 22px rgba(245,158,11,.28); }
.holo.amber .holo-meta-dot { background: #f59e0b; box-shadow: 0 0 5px rgba(245,158,11,.7); }
.holo.amber .holo-categoria { color: #f59e0b; }
.holo.amber .holo-urgencia { color: #f59e0b; border-color: rgba(245,158,11,.35); background: rgba(245,158,11,.10); }
.holo.amber:hover .holo-card { box-shadow: 0 0 40px rgba(245,158,11,.14), 0 6px 20px rgba(0,0,0,.5), inset 0 1px 0 rgba(245,158,11,.16); }

/* BLUE */
.holo.blue .holo-card { border: 1px solid rgba(91,142,240,.28); box-shadow: 0 0 28px rgba(91,142,240,.08), 0 2px 12px rgba(0,0,0,.5), inset 0 1px 0 rgba(91,142,240,.10); }
.holo.blue .holo-icon { background: rgba(91,142,240,.10); border-color: rgba(91,142,240,.32); color: #5b8ef0; }
.holo.blue .holo-beam { background: linear-gradient(180deg, rgba(91,142,240,.18) 0%, transparent 100%); }
.holo.blue .holo-base { background: #5b8ef0; box-shadow: 0 0 10px rgba(91,142,240,.6), 0 0 22px rgba(91,142,240,.28); }
.holo.blue .holo-meta-dot { background: #5b8ef0; box-shadow: 0 0 5px rgba(91,142,240,.7); }
.holo.blue .holo-categoria { color: #5b8ef0; }
.holo.blue .holo-urgencia { color: #5b8ef0; border-color: rgba(91,142,240,.35); background: rgba(91,142,240,.10); }
.holo.blue:hover .holo-card { box-shadow: 0 0 40px rgba(91,142,240,.14), 0 6px 20px rgba(0,0,0,.5), inset 0 1px 0 rgba(91,142,240,.16); }

.ag-notif-item-meta {
  font-size: 10px; color: var(--text-3);
  font-family: 'DM Mono', monospace;
}

.ag-notif-empty {
  padding: 48px 16px; text-align: center;
  font-size: 13px; color: var(--text-3);
  font-family: 'Sora', system-ui, sans-serif;
}

/* CTA pílula gold */
.ag-notif-cta {
  align-self: flex-start;
  display: inline-flex; align-items: center; gap: 6px;
  margin-top: 10px;
  padding: 5px 14px 5px 14px;
  border-radius: 999px;
  background: linear-gradient(135deg,#9C6F0A 0%,#D4AF37 50%,#9C6F0A 100%);
  background-size: 220% 100%;
  background-position: 0% 50%;
  color: #050505;
  font-size: 10px; font-weight: 700;
  letter-spacing: 0.7px; text-transform: uppercase;
  text-decoration: none;
  font-family: 'Sora', system-ui, sans-serif;
  border: 1px solid rgba(212,175,55,.55);
  box-shadow: 0 1px 2px rgba(0,0,0,.30), inset 0 1px 0 rgba(255,255,255,.20);
  transition: background-position .55s ease, transform .2s ease, box-shadow .25s ease, border-color .25s ease;
  cursor: pointer; user-select: none;
  position: relative; overflow: hidden;
}
.ag-notif-cta::before {
  content: ""; position: absolute; inset: 0;
  background: linear-gradient(120deg,transparent 30%,rgba(255,255,255,.45) 50%,transparent 70%);
  transform: translateX(-120%);
  transition: transform .7s ease;
  pointer-events: none;
}
.ag-notif-cta:hover {
  background-position: 100% 50%;
  transform: translateY(-1px);
  border-color: rgba(212,175,55,.95);
  box-shadow: 0 6px 18px rgba(212,175,55,.30), 0 0 0 1px rgba(212,175,55,.25), inset 0 1px 0 rgba(255,255,255,.28);
}
.ag-notif-cta:hover::before { transform: translateX(120%); }
.ag-notif-cta:active { transform: translateY(0); }
.ag-notif-cta-arrow { display: inline-block; transition: transform .25s ease; font-weight: 800; }
.ag-notif-cta:hover .ag-notif-cta-arrow { transform: translate(2px,-2px); }

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
    font-family: 'Sora', system-ui, sans-serif;
    overflow: hidden;
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
    font-family: 'Sora', system-ui, sans-serif; font-size: 13px;
    cursor: pointer; width: 100%; text-align: left;
    transition: background .1s, color .1s;
  }
  .ag-dropdown-item:hover { background: var(--s3); color: var(--text); }
  .ag-dropdown-item.danger { color: var(--red); }
  .ag-dropdown-item.danger:hover { background: var(--red-d); }

  /* ══ CORPO ══ */
  .ag-body { flex: 1; min-height: 0; display: flex; overflow: hidden; }

  /* ══ SIDEBAR ══ */
  .ag-sidebar {
    width: var(--sidebar-w); flex-shrink: 0;
    background: rgba(13,13,17,0.97);
    border-right: 1px solid var(--border);
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
  .ag-nav-item:hover  { background: rgba(255,255,255,0.025); color: var(--text); }
  .ag-nav-item.active {
    background: linear-gradient(90deg, rgba(200,165,94,0.12) 0%, rgba(200,165,94,0.04) 100%);
    color: var(--gold); border-left-color: var(--gold);
    box-shadow: inset 0 0 20px rgba(200,165,94,0.04);
  }
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
  .ag-main { flex: 1; min-height: 0; display: flex; flex-direction: column; overflow: hidden; }

  /* ── Acesso Negado (RotaProtegida) ── */
  .acesso-negado { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.75rem; text-align: center; padding: 2rem; color: var(--text-3); }
  .acesso-negado__icone  { font-size: 3rem; line-height: 1; }
  .acesso-negado__titulo { font-size: 1.25rem; font-weight: 600; color: var(--text); margin: 0; }
  .acesso-negado__texto  { margin: 0; font-size: 0.95rem; }
  .acesso-negado__sub    { margin: 0; font-size: 0.85rem; opacity: 0.7; }
  .acesso-negado__spinner { width: 2rem; height: 2rem; border: 3px solid var(--border); border-top-color: var(--gold-brand); border-radius: 50%; animation: spin 0.7s linear infinite; }

  .ag-topbar {
    padding: 14px 24px;
    background: rgba(13,13,17,0.85);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    border-bottom: 1px solid var(--border);
    display: flex; align-items: center; gap: 16px; flex-shrink: 0;
  }
  .ag-topbar-title h1 {
    font-family: 'Sora', system-ui, sans-serif; font-size: 17px; font-weight: 600;
    color: var(--text); line-height: 1.2;
    letter-spacing: -0.01em;
  }
  .ag-topbar-title p { font-size: 11px; color: var(--text-3); margin-top: 2px; letter-spacing: 0.01em; font-weight: 400; }

  /* ══ EMPTY STATE ══ */
  .ag-empty-row { padding: 24px 18px; text-align: center; font-size: 12px; color: var(--text-3); }
  .ag-empty-state {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 8px; padding: 32px 20px; text-align: center;
  }
  .ag-empty-icon {
    width: 40px; height: 40px; border-radius: 10px;
    background: var(--s2); border: 1px solid var(--border);
    display: flex; align-items: center; justify-content: center;
    margin-bottom: 4px;
  }
  .ag-empty-title { font-size: 13px; font-weight: 600; color: var(--text-2); }
  .ag-empty-sub { font-size: 12px; color: var(--text-3); line-height: 1.5; }

  @keyframes ag-pulse-dot {
    0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(62,207,142,0.5); }
    50% { opacity: 0.7; box-shadow: 0 0 0 4px rgba(62,207,142,0); }
  }
  .ag-live-dot {
    width: 6px; height: 6px; border-radius: 50%;
    background: var(--green); display: inline-block;
    animation: ag-pulse-dot 2s infinite; margin-right: 6px; flex-shrink: 0;
  }

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
    font-family: 'Sora', system-ui, sans-serif;
  }
  .ag-search input::placeholder { color: var(--text-3); }

  .ag-periods { display: flex; gap: 3px; flex-wrap: wrap; }
  .ag-period-btn {
    padding: 5px 12px; border-radius: 20px; font-size: 11px;
    cursor: pointer; border: 1px solid transparent;
    background: transparent; color: var(--text-2);
    font-family: 'Sora', system-ui, sans-serif; transition: all .13s;
  }
  .ag-period-btn:hover  { background: rgba(255,255,255,0.04); color: var(--text); }
  .ag-period-btn.active {
    background: rgba(200,165,94,0.08);
    border-color: rgba(200,165,94,0.28);
    color: var(--gold);
    box-shadow: 0 0 12px rgba(200,165,94,0.08);
  }

  /* ══ CONTENT ══ */
  .ag-content { flex: 1; min-height: 0; overflow-y: auto; padding: 20px 24px 36px; -webkit-overflow-scrolling: touch; }
  .ag-content::-webkit-scrollbar { width: 4px; }
  .ag-content::-webkit-scrollbar-thumb { background: var(--text-3); border-radius: 2px; }

  /* ══ KPI STRIP ══ */
  .db-kpi-strip {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 12px;
    margin-bottom: 20px;
  }
  .db-kpi-card {
    background: var(--s1);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 16px 18px;
    box-shadow: 0 1px 4px rgba(0,0,0,0.18);
    transition: box-shadow .15s, border-color .15s;
  }
  .db-kpi-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.22); border-color: var(--border-h); }
  .db-kpi-label {
    font-size: 10px; font-weight: 600; letter-spacing: .08em;
    text-transform: uppercase; color: var(--text-3); margin-bottom: 8px;
  }
  .db-kpi-val {
    font-family: var(--font-mono); font-size: 20px; font-weight: 700;
    color: var(--text); line-height: 1; letter-spacing: -0.02em;
    margin-bottom: 6px;
  }
  .db-kpi-meta { display: flex; align-items: center; gap: 4px; }
  .db-kpi-trend { font-size: 11px; font-weight: 600; display: flex; align-items: center; gap: 2px; }
  .db-kpi-sub { font-size: 11px; color: var(--text-3); }

  /* ══ LAYOUT BODY ══ */
  .db-body { display: grid; grid-template-columns: 1fr 256px; gap: 16px; }
  .db-main { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
  .db-aside { display: flex; flex-direction: column; gap: 16px; }

  /* ══ PANEL (substitui ag-card) ══ */
  .db-panel {
    background: var(--s1);
    border: 1px solid var(--border);
    border-radius: 12px;
    box-shadow: 0 1px 4px rgba(0,0,0,0.18);
    transition: box-shadow .15s;
    position: relative;
  }
  .db-panel-table { overflow: hidden; }
  .db-panel:hover { box-shadow: 0 4px 14px rgba(0,0,0,0.2); }
  .db-panel-header {
    padding: 12px 16px;
    border-bottom: 1px solid var(--border);
    display: flex; align-items: center; justify-content: space-between;
  }
  .db-panel-title { font-size: 12px; font-weight: 600; color: var(--text); }
  .db-panel-body { padding: 14px 16px; }
  .db-view-all {
    font-size: 11px; color: var(--gold);
    background: transparent; border: none; cursor: pointer;
    font-family: 'Sora', system-ui, sans-serif;
    display: flex; align-items: center; gap: 3px; transition: opacity .13s;
  }
  .db-view-all:hover { opacity: .75; }

  /* ══ TABELAS ══ */
  .ag-trow {
    display: grid; padding: 10px 16px;
    border-bottom: 1px solid var(--border);
    font-size: 12px; color: var(--text-2); transition: background .1s;
    align-items: center;
  }
  .ag-trow:hover   { background: rgba(255,255,255,0.022); }
  .ag-trow:last-child { border-bottom: none; }
  .ag-thead { background: var(--s2); }
  .ag-th { font-size: 10px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: var(--text-3); }
  .ag-empty-row { padding: 20px 16px; text-align: center; font-size: 12px; color: var(--text-3); }

  /* ══ ASIDE STATS ══ */
  .db-stat-row {
    display: flex; align-items: center; gap: 10px;
    padding: 10px 16px; border-bottom: 1px solid var(--border);
    cursor: pointer; transition: background .1s;
  }
  .db-stat-row:last-child { border-bottom: none; }
  .db-stat-row:hover { background: var(--s2); }
  .db-stat-icon {
    width: 30px; height: 30px; border-radius: 8px; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
  }
  .db-stat-label { font-size: 12px; color: var(--text-2); flex: 1; }
  .db-stat-val { font-family: var(--font-mono); font-size: 15px; font-weight: 700; }

  /* ══ DESPESAS ASIDE ══ */
  .db-desp-row {
    display: flex; align-items: center; gap: 8px;
    padding: 9px 16px; border-bottom: 1px solid var(--border);
    font-size: 12px; transition: background .1s;
  }
  .db-desp-row:last-child { border-bottom: none; }
  .db-desp-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
  .db-desp-label { flex: 1; color: var(--text-2); }
  .db-desp-count { font-family: var(--font-mono); font-weight: 700; font-size: 13px; }
  .db-desp-val { font-size: 11px; color: var(--text-3); width: 60px; text-align: right; }

  /* ══ GRIDS (legado charts view + módulos) ══ */
  .g4  { display: grid; grid-template-columns: repeat(4,1fr); gap: 14px; margin-bottom: 14px; }
  .g3  { display: grid; grid-template-columns: repeat(3,1fr); gap: 14px; margin-bottom: 14px; }
  .g21 { display: grid; grid-template-columns: 2fr 1fr;       gap: 14px; margin-bottom: 14px; }
  .g11 { display: grid; grid-template-columns: 1fr 1fr;       gap: 14px; margin-bottom: 14px; }
  .g1  { margin-bottom: 14px; }

  /* ag-card e ag-card-bare usados por renderChartsView e módulos */
  .ag-card {
    background: var(--s1); border: 1px solid var(--border);
    border-radius: 12px; padding: 18px;
    box-shadow: 0 1px 4px rgba(0,0,0,0.15);
    transition: box-shadow .15s, border-color .15s;
  }
  .ag-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.2); border-color: var(--border-h); }
  .ag-card-click { cursor: pointer; }
  .ag-card-click:hover { border-color: rgba(200,165,94,0.3); }
  .ag-card-bare {
    background: var(--s1); border: 1px solid var(--border);
    border-radius: 12px; overflow: hidden;
    box-shadow: 0 1px 4px rgba(0,0,0,0.15);
  }
  .ag-card-header {
    padding: 12px 16px; border-bottom: 1px solid var(--border);
    display: flex; align-items: center; justify-content: space-between;
  }
  .ag-card-title { font-size: 12px; font-weight: 600; color: var(--text); }
  .ag-view-all {
    font-size: 11px; color: var(--gold); background: transparent; border: none; cursor: pointer;
    font-family: 'Sora', system-ui, sans-serif; display: flex; align-items: center; gap: 3px; transition: opacity .13s;
  }
  .ag-view-all:hover { opacity: .75; }
  .ag-mini { display: flex; align-items: center; gap: 12px; }
  .ag-mini-icon { width: 38px; height: 38px; border-radius: 10px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; }
  .ag-mini-val { font-family: var(--font-mono); font-size: 22px; font-weight: 700; color: var(--text); line-height: 1; }
  .ag-mini-lbl { font-size: 11px; color: var(--text-2); margin-top: 3px; }
  .ag-kpi-label { font-size: 10px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; color: var(--text-2); margin-bottom: 8px; }
  .ag-kpi-val   { font-family: var(--font-mono); font-size: 22px; font-weight: 700; color: var(--text); line-height: 1; }
  .ag-kpi-meta  { display: flex; align-items: center; gap: 8px; margin-top: 8px; flex-wrap: wrap; }
  .ag-trend     { font-size: 11px; font-weight: 600; display: flex; align-items: center; gap: 2px; }
  .ag-sub       { font-size: 11px; color: var(--text-3); }
  .ag-despesa-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 10px; padding: 14px; }
  .ag-despesa-card { border-radius: 10px; padding: 14px; transition: transform .15s; }
  .ag-despesa-card:hover { transform: translateY(-1px); }
  .ag-despesa-label { font-size: 9px; font-weight: 700; letter-spacing: .09em; text-transform: uppercase; margin-bottom: 6px; }
  .ag-despesa-count { font-family: var(--font-mono); font-size: 24px; font-weight: 700; color: var(--text); line-height: 1; }
  .ag-despesa-val   { font-size: 11px; color: var(--text-2); margin-top: 4px; }

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
    color: var(--text); font-family: 'Sora', system-ui, sans-serif; font-size: 12px;
    padding: 5px 8px; outline: none; cursor: pointer; transition: border-color .15s; color-scheme: dark;
  }
  .ag-date-input:focus { border-color: var(--gold); }
  .ag-date-input::-webkit-calendar-picker-indicator {
    filter: invert(0.6) sepia(1) saturate(2) hue-rotate(5deg); cursor: pointer; opacity: 0.7;
  }
  .ag-date-sep { color: var(--text-3); font-size: 12px; user-select: none; }

  /* ══ LOADING SKELETON ══ */
  @keyframes ag-shimmer {
    0%   { background-position: -600px 0; }
    100% { background-position:  600px 0; }
  }
  .ag-skeleton {
    background: linear-gradient(90deg, var(--s2) 25%, rgba(200,165,94,0.04) 50%, var(--s2) 75%);
    background-size: 1200px 100%; animation: ag-shimmer 1.6s ease-in-out infinite;
    border-radius: 6px; height: 1em; display: inline-block; width: 100%;
  }

  /* ══ PLACEHOLDER ══ */
  .ag-placeholder {
    flex: 1; display: flex; align-items: center; justify-content: center;
    flex-direction: column; gap: 10px; color: var(--text-3);
  }
  .ag-placeholder h2 { font-family: 'Sora', system-ui, sans-serif; font-size: 18px; font-weight: 600; color: var(--text-2); }
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
    color: var(--text-3); font-family: 'Sora', system-ui, sans-serif;
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
    --bg:       #eeecea;
    --s1:       #f7f6f3;
    --s2:       #efede9;
    --s3:       #e5e2dc;
    --border:   rgba(0,0,0,0.07);
    --border-h: rgba(0,0,0,0.13);
    --gold:         #9a7518;
    --gold-l:       #b89030;
    --gold-d:       rgba(154,117,24,0.10);
    --gold-brand:   #9a7518;
    --text:     #1c1a17;
    --text-2:   #4a4540;
    --text-3:   #9a9590;
    --green:    #16a34a;
    --green-d:  rgba(22,163,74,0.08);
    --red:      #dc2626;
    --red-d:    rgba(220,38,38,0.08);
    --blue:     #2563eb;
    --blue-d:   rgba(37,99,235,0.08);
    --purple:   #7c3aed;
    --purple-d: rgba(124,58,237,0.08);
    --amber:    #d97706;
    --amber-d:  rgba(217,119,6,0.08);
    color-scheme: light;
  }
  .ag-app.light .ag-date-input { color-scheme: light; }
  .ag-app.light .ag-card,
  .ag-app.light .ag-card-bare,
  .ag-app.light .db-panel,
  .ag-app.light .db-kpi-card {
    box-shadow: 0 1px 2px rgba(0,0,0,0.06), 0 1px 4px rgba(0,0,0,0.04);
  }
  .ag-app.light .ag-card:hover,
  .ag-app.light .db-panel:hover,
  .ag-app.light .db-kpi-card:hover {
    box-shadow: 0 3px 10px rgba(0,0,0,0.09);
  }
  .ag-app.light .ag-global-header { background: rgba(247,246,243,0.97); border-bottom: 1px solid rgba(0,0,0,0.07); }
  .ag-app.light .ag-sidebar {
    background: #141414;
    border-right: 1px solid rgba(255,255,255,0.06);
  }
  .ag-app.light .ag-sidebar-mobile {
    background: #141414;
    border-right: 1px solid rgba(255,255,255,0.06);
  }
  .ag-app.light .ag-sidebar-mobile-header { border-bottom: 1px solid rgba(255,255,255,0.06); }
  .ag-app.light .ag-sidebar-mobile-close {
    background: rgba(255,255,255,0.06); border-color: rgba(255,255,255,0.08); color: rgba(255,255,255,0.55);
  }
  .ag-app.light .ag-sidebar-mobile-close:hover { background: rgba(255,255,255,0.1); color: #fff; }
  .ag-app.light .ag-sidebar-mobile .ag-sec-label { color: rgba(255,255,255,0.28); }
  .ag-app.light .ag-sidebar-mobile .ag-nav-item { color: rgba(255,255,255,0.55); }
  .ag-app.light .ag-sidebar-mobile .ag-nav-item:hover { background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.88); }
  .ag-app.light .ag-sidebar-mobile .ag-nav-item.active {
    background: linear-gradient(90deg, rgba(200,165,94,0.15) 0%, rgba(200,165,94,0.05) 100%);
    color: var(--gold-brand);
    border-left-color: var(--gold-brand);
  }
  .ag-app.light .ag-sidebar-mobile .ag-nav-item.active svg { color: var(--gold-brand); }
  .ag-app.light .ag-sidebar .ag-sec-label { color: rgba(255,255,255,0.28); }
  .ag-app.light .ag-sidebar .ag-nav-item { color: rgba(255,255,255,0.55); }
  .ag-app.light .ag-sidebar .ag-nav-item:hover { background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.88); }
  .ag-app.light .ag-sidebar .ag-nav-item.active {
    background: linear-gradient(90deg, rgba(200,165,94,0.15) 0%, rgba(200,165,94,0.05) 100%);
    color: var(--gold-brand);
    border-left-color: var(--gold-brand);
  }
  .ag-app.light .ag-sidebar .ag-nav-item.active svg { color: var(--gold-brand); }
  .ag-app.light .ag-topbar { background: rgba(242,240,237,0.92); }
  .ag-app.light .ag-trow:hover { background: rgba(0,0,0,0.025); }
  .ag-app.light .ag-user-dropdown { background: var(--s1); box-shadow: 0 6px 20px rgba(0,0,0,0.10); }
  .ag-app.light .ag-avatar {
    background: linear-gradient(135deg, rgba(154,117,24,0.14), rgba(154,117,24,0.05));
    border-color: rgba(154,117,24,0.22);
  }
  .ag-app.light .ag-header-logo-icon { background: linear-gradient(135deg, #b8952e, #d4af37); }
  .ag-app.light .db-stat-row:hover { background: var(--s2); }
  .ag-app.light .db-desp-row:hover { background: var(--s2); }
  .ag-app.light .ag-notif-panel { background: rgba(247,246,243,0.97); }
  .ag-app.light .holo-card { background: rgba(240,238,234,0.95); }

/* ── CARD DE SAUDAÇÃO FLUTUANTE ── */
.ag-saudacao-card {
  position: fixed;
  top: 72px;
  left: 24px;
  z-index: 9999;
  min-width: 280px;
  max-width: 340px;
  background: linear-gradient(135deg, rgba(30,26,18,0.97) 0%, rgba(22,19,12,0.99) 100%);
  border: 1px solid rgba(212,175,55,0.35);
  border-radius: 18px;
  padding: 18px 20px 16px;
  box-shadow: 0 8px 40px rgba(0,0,0,0.55), 0 0 0 1px rgba(212,175,55,0.08) inset, 0 0 60px rgba(212,175,55,0.04);
  display: flex;
  flex-direction: column;
  gap: 6px;
  animation: ag-saudacao-in 0.45s cubic-bezier(0.34,1.56,0.64,1) both;
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
}
.ag-saudacao-card:not(.ag-saudacao-out) {
  animation: ag-saudacao-in 0.45s cubic-bezier(0.34,1.56,0.64,1) forwards, ag-saudacao-float 3s ease-in-out 0.45s infinite;
}
.ag-saudacao-card.ag-saudacao-out {
  animation: ag-saudacao-out 0.3s ease-in both;
}
@keyframes ag-saudacao-in {
  from { opacity: 0; transform: translateY(-16px) scale(0.95); }
  to   { opacity: 1; transform: translateY(0)      scale(1);   }
}
@keyframes ag-saudacao-float {
  0%, 100% { transform: translateY(0);   }
  50%       { transform: translateY(-6px); }
}
@keyframes ag-saudacao-out {
  from { opacity: 1; transform: translateY(0);    }
  to   { opacity: 0; transform: translateY(-10px); }
}
.ag-saudacao-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.ag-saudacao-emoji {
  font-size: 22px;
  line-height: 1;
  flex-shrink: 0;
}
.ag-saudacao-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--gold);
  letter-spacing: -0.01em;
  line-height: 1.2;
  flex: 1;
}
.ag-saudacao-sub {
  font-size: 13px;
  color: var(--text-muted, rgba(255,255,255,0.55));
  line-height: 1.45;
  padding-left: 34px;
}
.ag-saudacao-close {
  background: none;
  border: none;
  cursor: pointer;
  color: rgba(255,255,255,0.35);
  padding: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  transition: color 0.15s, background 0.15s;
  flex-shrink: 0;
}
.ag-saudacao-close:hover {
  color: rgba(255,255,255,0.8);
  background: rgba(255,255,255,0.07);
}
.ag-saudacao-linha {
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(212,175,55,0.25), transparent);
  margin: 4px 0;
}
@media (max-width: 480px) {
  .ag-saudacao-card { top: 68px; left: 12px; max-width: calc(100vw - 24px); }
}

/* ══ 3D BAR CHART ══ */
@keyframes bar3d-rise {
  from { opacity: 0; transform: scaleY(0.05); }
  to   { opacity: 1; transform: scaleY(1); }
}

.chart3d-toggle {
  display: flex;
  background: var(--s2);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 3px;
  gap: 2px;
}
.chart3d-toggle-btn {
  padding: 4px 10px;
  border-radius: 6px;
  border: none;
  cursor: pointer;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.07em;
  font-family: 'Sora', system-ui, sans-serif;
  transition: all .15s;
}
.chart3d-toggle-btn.active {
  background: linear-gradient(135deg, #B8860B, #D4AF37);
  color: #050505;
}
.chart3d-toggle-btn:not(.active) {
  background: transparent;
  color: var(--text-3);
}

.chart3d-wrap {
  padding: 4px 0 0;
}
.chart3d-inner {
  display: flex;
  align-items: flex-end;
  gap: 0;
  height: 170px;
}
.chart3d-yaxis {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: flex-end;
  padding-right: 10px;
  height: 100%;
  flex-shrink: 0;
  font-size: 9px;
  color: var(--text-3);
  font-family: 'DM Mono', monospace;
  line-height: 1;
  padding-bottom: 20px;
}
.chart3d-stage {
  flex: 1;
  height: 100%;
  position: relative;
  overflow: visible;
}
.chart3d-floor {
  position: absolute;
  bottom: 20px; left: 0; right: 0; height: 1px;
  background: rgba(200,165,94,0.14);
}
.chart3d-grid-lines {
  position: absolute;
  bottom: 20px; left: 0; right: 0;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  pointer-events: none;
  top: 0;
}
.chart3d-grid-line {
  width: 100%;
  height: 1px;
  background: rgba(200,165,94,0.04);
}
.chart3d-bars {
  display: flex;
  align-items: flex-end;
  gap: 4px;
  height: calc(100% - 20px);
  padding: 0 2px;
}
.bar3d-wrap {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  height: 100%;
}
.bar3d {
  position: relative;
  width: 66%;
  max-width: 26px;
  transform-origin: bottom center;
  animation: bar3d-rise 0.45s cubic-bezier(0.34,1.4,0.64,1) var(--d,0s) both;
}
.bar3d-front {
  position: absolute; inset: 0;
  background: linear-gradient(180deg, #f0d060 0%, #d4a020 25%, #a87018 70%, #7a4c08 100%);
  border-top: 1px solid rgba(255,235,100,0.55);
}
.bar3d-glow {
  position: absolute;
  bottom: -6px; left: -8px; right: -8px; height: 14px;
  background: radial-gradient(ellipse at center, rgba(200,165,94,0.5) 0%, transparent 70%);
  filter: blur(5px);
  pointer-events: none; z-index: -1;
}
.bar3d-side {
  position: absolute;
  left: calc(100%);
  top: -5px;
  width: 7px;
  height: calc(100% + 5px);
  background: linear-gradient(180deg, #7a4c08 0%, #3a2404 100%);
  clip-path: polygon(0 5px, 7px 0, 7px calc(100% - 5px), 0 100%);
}
.bar3d-top {
  position: absolute;
  top: -5px;
  left: 0;
  width: calc(100% + 7px);
  height: 5px;
  background: linear-gradient(90deg, #fff890 0%, #e8cc40 50%, #c89020 100%);
  clip-path: polygon(7px 0, calc(100%) 0, calc(100% - 7px) 5px, 0 5px);
}
.bar3d-label {
  font-size: 9px;
  color: var(--text-3);
  font-family: 'DM Mono', monospace;
  margin-top: 5px;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  width: 100%;
  text-overflow: ellipsis;
}
.chart3d-legend {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 14px;
  font-size: 11px;
}
.chart3d-legend-left {
  display: flex; align-items: center; gap: 7px; color: var(--text-2);
}
.chart3d-legend-dot {
  width: 8px; height: 8px; border-radius: 2px;
  background: #c8a55e;
}
.chart3d-legend-right {
  display: flex; align-items: center; gap: 8px; color: var(--text-2);
}
.chart3d-legend-right b {
  color: var(--gold);
  font-family: 'DM Mono', monospace;
  font-weight: 700; font-size: 13px;
}

/* ── CHART 3D MOBILE ── */
@media (max-width: 640px) {
  .chart3d-wrap { overflow: hidden; padding: 4px 0 0; }
  .chart3d-inner { height: 140px !important; overflow: hidden; }
  .chart3d-stage { overflow: hidden; }
  .chart3d-yaxis { font-size: 8px; padding-right: 6px; min-width: 36px; max-width: 42px; }
  .chart3d-bars { gap: 2px; padding: 0 1px; overflow: hidden; }
  .bar3d { max-width: 18px; }
  .bar3d-side { width: 5px; }
  .bar3d-top { width: calc(100% + 5px); clip-path: polygon(5px 0, calc(100%) 0, calc(100% - 5px) 5px, 0 5px); }
  .bar3d-label { font-size: 7.5px; }
  .chart3d-legend { flex-direction: column; align-items: flex-start; gap: 4px; margin-top: 8px; font-size: 10px; }
  .chart3d-legend-right { font-size: 10px; }
  .chart3d-legend-right b { font-size: 11px; }
}
`;

/* ══════════════════════════════════════════════════════
   SUB-COMPONENTES
═══════════════════════════════════════════════════════ */

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const value = payload[0]?.value;
  return (
    <div style={{
      background: "var(--s2)",
      backdropFilter: "blur(12px)",
      WebkitBackdropFilter: "blur(12px)",
      border: "1px solid rgba(200,165,94,0.25)",
      borderRadius: 12,
      padding: "10px 14px",
      fontSize: 12,
      boxShadow: "0 8px 32px rgba(0,0,0,0.2), 0 0 0 1px rgba(200,165,94,0.08) inset",
      minWidth: 130,
      pointerEvents: "none",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 7 }}>
        <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#c8a55e", boxShadow: "0 0 6px #c8a55e88" }} />
        <span style={{ color: "var(--gold)", fontWeight: 500, fontSize: 11, letterSpacing: "0.04em" }}>{label}</span>
      </div>
      <div style={{ color: "var(--text)", fontWeight: 700, fontSize: 14, letterSpacing: "-0.01em" }}>
        R$ {value?.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
      </div>
    </div>
  );
}

function Val({ v, loading, prefix = "", suffix = "" }) {
  if (loading) return <span className="ag-skeleton" style={{ width: 80 }} />;
  return <>{prefix}{v}{suffix}</>;
}

/* ── Toggle 3D / LINHA ── */
function ChartToggle({ value, onChange }) {
  return (
    <div className="chart3d-toggle">
      {[["3d","3D BARS"],["flat","LINHA"]].map(([mode, label]) => (
        <button
          key={mode}
          className={`chart3d-toggle-btn ${value === mode ? "active" : ""}`}
          onClick={() => onChange(mode)}
        >{label}</button>
      ))}
    </div>
  );
}

/* ── Chart 3D Bars ── */
// series: [{ key, label, color, sideColor, topColor, glowColor }]
const BAR3D_SERIES = [
  {
    key: "receita", label: "Receita",
    frontGrad: "linear-gradient(180deg, #f0d060 0%, #d4a020 25%, #a87018 70%, #7a4c08 100%)",
    sideGrad:  "linear-gradient(180deg, #7a4c08 0%, #3a2404 100%)",
    topGrad:   "linear-gradient(90deg, #fff890 0%, #e8cc40 50%, #c89020 100%)",
    glow:      "rgba(200,165,94,0.5)", dot: "#c8a55e",
  },
  {
    key: "custo", label: "Custo",
    frontGrad: "linear-gradient(180deg, #f07070 0%, #c03030 25%, #8a1818 70%, #5a0808 100%)",
    sideGrad:  "linear-gradient(180deg, #6a1010 0%, #3a0404 100%)",
    topGrad:   "linear-gradient(90deg, #ffaaaa 0%, #e04040 50%, #b02020 100%)",
    glow:      "rgba(224,82,82,0.5)", dot: "#e05252",
  },
];

function Bar3D({ h, delay, series, active, onEnter, onLeave }) {
  return (
    <div
      style={{ position: "relative", width: "40%", maxWidth: 18, flexShrink: 0, cursor: "crosshair" }}
      onMouseEnter={onEnter} onMouseLeave={onLeave}
    >
      <div style={{
        position: "relative", width: "100%", height: `${h}px`,
        transformOrigin: "bottom center",
        animation: `bar3d-rise 0.45s cubic-bezier(0.34,1.4,0.64,1) ${delay}s both`,
        filter: active ? "brightness(1.3)" : undefined,
        transition: "filter 0.15s",
      }}>
        {/* glow */}
        <div style={{
          position: "absolute", bottom: -6, left: -8, right: -8, height: 14,
          background: `radial-gradient(ellipse at center, ${series.glow} 0%, transparent 70%)`,
          filter: "blur(5px)", pointerEvents: "none", zIndex: -1,
        }} />
        {/* front */}
        <div style={{ position: "absolute", inset: 0, background: series.frontGrad, borderTop: "1px solid rgba(255,235,100,0.35)" }} />
        {/* side */}
        <div style={{
          position: "absolute", left: "100%", top: -5, width: 6, height: "calc(100% + 5px)",
          background: series.sideGrad,
          clipPath: "polygon(0 5px, 6px 0, 6px calc(100% - 5px), 0 100%)",
        }} />
        {/* top */}
        <div style={{
          position: "absolute", top: -5, left: 0, width: "calc(100% + 6px)", height: 5,
          background: series.topGrad,
          clipPath: "polygon(6px 0, calc(100%) 0, calc(100% - 6px) 5px, 0 5px)",
        }} />
      </div>
    </div>
  );
}

function Chart3DBars({ data, series: seriesProp, period, height = 170 }) {
  const [tooltip, setTooltip] = useState(null);
  const isMobile = typeof window !== "undefined" && window.innerWidth <= 640;

  const useDual = !!seriesProp;
  const activeSeries = seriesProp || [BAR3D_SERIES[0]];

  const emptyCheck = !data || data.length === 0;

  if (emptyCheck) return (
    <div style={{ height, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-3)", fontSize: 12 }}>
      Nenhum dado no período
    </div>
  );

  // No mobile, subsamplear para max 15 pontos para não amontoar
  const displayData = isMobile && data.length > 15
    ? data.filter((_, i) => i % Math.ceil(data.length / 15) === 0)
    : data;

  const max = Math.max(...displayData.flatMap(d =>
    activeSeries.map(s => d[s.key] || d.v || 0)
  ), 1);

  const totalReceita = data.reduce((a, b) => a + (b[activeSeries[0].key] || b.v || 0), 0);
  const totalCusto   = useDual && activeSeries[1] ? data.reduce((a, b) => a + (b[activeSeries[1].key] || 0), 0) : null;

  const CONTAINER_H = (isMobile ? 140 : height) - 46;

  const getLabel = (d) => d.d || d.mes || d.l || "";

  return (
    <div className="chart3d-wrap" style={{ position: "relative" }}>
      {/* Tooltip */}
      {tooltip && (
        <div style={{
          position: "absolute", zIndex: 20,
          left: tooltip.x, top: tooltip.y,
          transform: "translate(-50%, -110%)",
          pointerEvents: "none",
          background: "var(--s2)",
          border: "1px solid rgba(200,165,94,0.18)",
          borderRadius: 10, padding: "8px 14px",
          fontSize: 12, boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
          whiteSpace: "nowrap",
        }}>
          <div style={{ color: "var(--text-3)", fontSize: 10, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6, borderBottom: "1px solid var(--border)", paddingBottom: 5 }}>
            {tooltip.label}
          </div>
          {activeSeries.map(s => (
            <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 8, margin: "3px 0" }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: s.dot, boxShadow: `0 0 6px ${s.dot}99` }} />
              <span style={{ color: "var(--text-2)" }}>{s.label}</span>
              <span style={{ color: s.dot, fontWeight: 700, marginLeft: 8 }}>
                R$ {((tooltip[s.key] ?? tooltip.v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="chart3d-inner" style={{ height: isMobile ? 140 : height }}>
        <div className="chart3d-yaxis">
          {[1, 0.66, 0.33, 0].map((r, i) => (
            <span key={i}>R$ {Math.round(max * r).toLocaleString("pt-BR")}</span>
          ))}
        </div>
        <div className="chart3d-stage" style={{ overflow: "hidden" }}>
          <div className="chart3d-floor" />
          {[0.33, 0.66, 1].map(r => (
            <div key={r} style={{
              position: "absolute", bottom: `calc(20px + ${r * 100}%)`, left: 0, right: 0,
              height: 1, background: "rgba(200,165,94,0.04)", pointerEvents: "none"
            }} />
          ))}
          <div className="chart3d-bars">
            {displayData.map((d, i) => {
              const lbl = getLabel(d);
              const isHovered = tooltip?.label === lbl;
              return (
                <div
                  key={i}
                  style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%", gap: 2 }}
                  onMouseEnter={e => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const wrapRect = e.currentTarget.closest(".chart3d-wrap").getBoundingClientRect();
                    const rawX = rect.left - wrapRect.left + rect.width / 2;
                    const clampedX = Math.max(60, Math.min(rawX, wrapRect.width - 60));
                    setTooltip({ x: clampedX, y: rect.top - wrapRect.top, label: lbl, ...d });
                  }}
                  onTouchStart={e => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const wrapRect = e.currentTarget.closest(".chart3d-wrap").getBoundingClientRect();
                    const rawX = rect.left - wrapRect.left + rect.width / 2;
                    const clampedX = Math.max(60, Math.min(rawX, wrapRect.width - 60));
                    setTooltip({ x: clampedX, y: rect.top - wrapRect.top, label: lbl, ...d });
                  }}
                  onMouseLeave={() => setTooltip(null)}
                  onTouchEnd={() => setTimeout(() => setTooltip(null), 1500)}
                >
                  {/* barras lado a lado */}
                  <div style={{ display: "flex", alignItems: "flex-end", gap: 2, width: "100%", justifyContent: "center" }}>
                    {activeSeries.map(s => {
                      const val = d[s.key] ?? (s.key === activeSeries[0].key ? d.v : 0) ?? 0;
                      const barH = Math.max(4, (val / max) * (CONTAINER_H - 10));
                      return (
                        <Bar3D
                          key={s.key}
                          h={barH}
                          delay={i * 0.04}
                          series={s}
                          active={isHovered}
                        />
                      );
                    })}
                  </div>
                  <div className="bar3d-label">{lbl}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="chart3d-legend">
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          {activeSeries.map(s => (
            <div key={s.key} className="chart3d-legend-left">
              <span style={{ width: 8, height: 8, borderRadius: 2, background: s.dot, display: "inline-block" }} />
              <span>{s.label}</span>
            </div>
          ))}
        </div>
        <div className="chart3d-legend-right">
          <span>{period}</span>
          {totalCusto !== null ? (
            <b>R$ {totalReceita.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} <span style={{ color: "#e05252", fontSize: 11 }}>/ R$ {totalCusto.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span></b>
          ) : (
            <b>R$ {totalReceita.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</b>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Chart 3D Donut (Mix de Receita) ── */
function Chart3DDonut({ data, height = 200 }) {
  const [hovered, setHovered] = useState(null);
  const PIE_COLORS = ["#c8a55e", "#3ecf8e", "#5b8ef0", "#f59e0b", "#e052a0"];

  if (!data || data.length === 0) return (
    <div style={{ height, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-3)", fontSize: 12 }}>
      Nenhum dado disponível
    </div>
  );

  const total = data.reduce((a, b) => a + (b.value || 0), 0) || 1;
  const CX = 90, CY = 78;
  const R_OUT = 64, R_IN = 38, DEPTH = 20;
  const toRad = (deg) => deg * Math.PI / 180;

  let startAngle = -90;
  const slices = data.map((item, i) => {
    const pct = (item.value || 0) / total;
    const sweep = pct * 360;
    const s = { ...item, startAngle, sweep, color: PIE_COLORS[i % PIE_COLORS.length], pct };
    startAngle += sweep;
    return s;
  });

  const hov = hovered !== null ? slices[hovered] : null;

  const donutPath = (cx, cy, rOut, rIn, startDeg, sweepDeg) => {
    let sw = sweepDeg >= 360 ? 359.9999 : sweepDeg;
    const s = toRad(startDeg), e = toRad(startDeg + sw);
    const lg = sw > 180 ? 1 : 0;
    const x1o = cx + rOut * Math.cos(s), y1o = cy + rOut * Math.sin(s);
    const x2o = cx + rOut * Math.cos(e), y2o = cy + rOut * Math.sin(e);
    const x1i = cx + rIn  * Math.cos(e), y1i = cy + rIn  * Math.sin(e);
    const x2i = cx + rIn  * Math.cos(s), y2i = cy + rIn  * Math.sin(s);
    return `M ${x1o} ${y1o} A ${rOut} ${rOut} 0 ${lg} 1 ${x2o} ${y2o} L ${x1i} ${y1i} A ${rIn} ${rIn} 0 ${lg} 0 ${x2i} ${y2i} Z`;
  };

  // Outer extrusion wall: top arc + vertical sides + bottom arc
  const outerWall = (cx, cy, r, startDeg, sweepDeg, d) => {
    let sw = sweepDeg >= 360 ? 359.9999 : sweepDeg;
    const s = toRad(startDeg), e = toRad(startDeg + sw);
    const lg = sw > 180 ? 1 : 0;
    const x1 = cx + r * Math.cos(s), y1 = cy + r * Math.sin(s);
    const x2 = cx + r * Math.cos(e), y2 = cy + r * Math.sin(e);
    return `M ${x1} ${y1} A ${r} ${r} 0 ${lg} 1 ${x2} ${y2} L ${x2} ${y2 + d} A ${r} ${r} 0 ${lg} 0 ${x1} ${y1 + d} Z`;
  };

  const SVG_W = CX * 2, SVG_H = CY * 2 + DEPTH + 16;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, minHeight: height }}>
      <div style={{ flexShrink: 0 }}>
        <svg width={SVG_W} height={SVG_H} style={{ overflow: "visible" }}>
          <defs>
            {slices.map((s, i) => [
              <linearGradient key={`wg${i}`} id={`wg${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity="0.85" />
                <stop offset="100%" stopColor={s.color} stopOpacity="0.2" />
              </linearGradient>,
              <radialGradient key={`tg${i}`} id={`tg${i}`} cx="38%" cy="32%" r="75%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.18" />
                <stop offset="60%" stopColor={s.color} stopOpacity="1" />
                <stop offset="100%" stopColor={s.color} stopOpacity="0.78" />
              </radialGradient>,
            ])}
            <radialGradient id="shd" cx="50%" cy="100%" r="55%">
              <stop offset="0%" stopColor="#000" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#000" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* shadow */}
          <ellipse cx={CX} cy={CY + DEPTH + 8} rx={R_OUT - 2} ry={11} fill="url(#shd)" />

          {/* LAYER 1: extrusion walls (painter order = reverse) */}
          {[...slices].reverse().map((s, ri) => {
            const i = slices.length - 1 - ri;
            if (s.sweep < 0.5) return null;
            const isHov = hovered === i;
            const dy = isHov ? -7 : 0;
            return (
              <g key={`ext${i}`} style={{ cursor: "pointer" }}
                onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}>
                {/* outer wall */}
                <path d={outerWall(CX, CY + dy, R_OUT, s.startAngle, s.sweep, DEPTH)}
                  fill={`url(#wg${i})`} stroke={s.color} strokeWidth="0.5" strokeOpacity="0.6" />
                {/* inner wall — darker, gives depth illusion */}
                <path d={outerWall(CX, CY + dy, R_IN, s.startAngle, s.sweep, DEPTH)}
                  fill={s.color} fillOpacity="0.08"
                  stroke={s.color} strokeWidth="0.3" strokeOpacity="0.2" />
                {/* bottom rim highlight */}
                <path d={donutPath(CX, CY + dy + DEPTH, R_OUT, R_IN, s.startAngle, s.sweep)}
                  fill={s.color} fillOpacity="0.12" />
              </g>
            );
          })}

          {/* LAYER 2: top face */}
          {slices.map((s, i) => {
            if (s.sweep < 0.5) return null;
            const isHov = hovered === i;
            const dy = isHov ? -7 : 0;
            return (
              <g key={`top${i}`} style={{ cursor: "pointer" }}
                onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}>
                <path
                  d={donutPath(CX, CY + dy, R_OUT, R_IN, s.startAngle, s.sweep)}
                  fill={`url(#tg${i})`}
                  stroke={isHov ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.35)"}
                  strokeWidth={isHov ? 1.5 : 0.8}
                  style={{
                    filter: isHov ? `drop-shadow(0 -5px 12px ${s.color}cc)` : undefined,
                    transition: "filter 0.15s",
                  }}
                />
              </g>
            );
          })}

          {/* Center text */}
          <text x={CX} y={CY - 7} textAnchor="middle" fill="var(--text)" fontSize="14" fontWeight="700" fontFamily="Inter, system-ui">
            {hov ? `${Math.round(hov.pct * 100)}%` : "Mix"}
          </text>
          <text x={CX} y={CY + 9} textAnchor="middle" fill="var(--text-3)" fontSize="9" fontFamily="Inter, system-ui">
            {hov ? hov.name : "receita"}
          </text>
        </svg>
      </div>

      {/* Legend */}
      <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 8 }}>
        {slices.map((s, i) => (
          <div key={i}
            style={{ cursor: "pointer", opacity: hovered !== null && hovered !== i ? 0.4 : 1, transition: "opacity 0.15s" }}
            onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}
          >
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
              <span style={{ color: "var(--text-2)", display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: s.color, display: "inline-block", boxShadow: `0 0 6px ${s.color}88` }} />
                {s.name}
              </span>
              <span style={{ color: s.color, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{Math.round(s.pct * 100)}%</span>
            </div>
            <div style={{ background: "var(--s2)", borderRadius: 4, height: 5, overflow: "hidden" }}>
              <div style={{ width: `${Math.round(s.pct * 100)}%`, height: "100%", background: `linear-gradient(90deg, ${s.color}, ${s.color}88)`, borderRadius: 4, transition: "width 0.6s ease" }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   SAUDAÇÃO FLUTUANTE
═══════════════════════════════════════════════════════ */
function getSaudacaoTempo() {
  const h = new Date().getHours();
  if (h >= 5  && h < 12) return { texto: "Bom dia",   emoji: "☀️" };
  if (h >= 12 && h < 18) return { texto: "Boa tarde", emoji: "🌤️" };
  return { texto: "Boa noite", emoji: "🌙" };
}

const FRASES_SAUDACAO = [
  "É muito bom ter você por aqui.",
  "Que bom te ver de volta!",
  "Seu negócio está esperando por você.",
  "Pronto para fazer acontecer hoje?",
  "Bem-vindo de volta ao seu painel.",
  "Mais um dia de oportunidades te esperando.",
  "Que a sua gestão flua com leveza hoje.",
  "Tudo pronto para você arrasar.",
  "Sua equipe está online e operando.",
  "Cada acesso é um passo rumo ao crescimento.",
  "O sucesso começa com uma boa gestão.",
  "Seu painel está atualizado e pronto.",
  "Grandes resultados começam por aqui.",
  "Foco, estratégia e execução. Vamos lá!",
  "Você chegou. Agora é só executar.",
  "O melhor momento para agir é agora.",
  "Negócios inteligentes começam com dados claros.",
  "Que este acesso te aproxime das suas metas.",
  "Aqui é onde as decisões certas acontecem.",
  "Bem-vindo ao centro de controle do seu negócio.",
  "A gestão eficiente é a sua vantagem competitiva.",
  "Cada cliente bem atendido começa aqui.",
  "Você está no lugar certo, na hora certa.",
  "Vamos transformar dados em resultados hoje?",
  "Sua presença já faz a diferença.",
  "Controle, visão e crescimento. Seja bem-vindo.",
  "O sucesso do seu negócio está em boas mãos — as suas.",
  "Que hoje seja mais produtivo que ontem.",
  "Acesso registrado. Vamos fazer acontecer?",
  "Seu negócio evoluiu desde a última vez que você esteve aqui.",
];

function SaudacaoCard({ nome, onClose }) {
  const [saindo, setSaindo] = useState(false);
  const { texto, emoji } = getSaudacaoTempo();
  const frase = useMemo(
    () => FRASES_SAUDACAO[Math.floor(Math.random() * FRASES_SAUDACAO.length)],
    []
  );

  const fechar = () => {
    setSaindo(true);
    setTimeout(onClose, 280);
  };

  // auto-fecha após 7s
  useEffect(() => {
    const t = setTimeout(fechar, 7000);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className={`ag-saudacao-card${saindo ? " ag-saudacao-out" : ""}`} role="status" aria-live="polite">
      <div className="ag-saudacao-header">
        <span className="ag-saudacao-emoji">{emoji}</span>
        <span className="ag-saudacao-title">{texto}, {nome}!</span>
        <button className="ag-saudacao-close" onClick={fechar} aria-label="Fechar saudação">
          <X size={15} />
        </button>
      </div>
      <div className="ag-saudacao-linha" />
      <p className="ag-saudacao-sub">{frase}</p>
    </div>
  );
}

/* ─────────────────────────────────────
   COMPONENTE: LoadingCubes
   ───────────────────────────────────── */
function LoadingCubes() {
  return (
    <>
      <style>{`
        @keyframes cube-bounce {
          0%   { transform: translateY(0); }
          25%  { transform: translateY(-12px); }
          50%  { transform: translateY(0); }
          100% { transform: translateY(0); }
        }
        .loading-cubes {
          display: flex;
          gap: 6px;
          align-items: center;
          justify-content: center;
          height: 40px;
        }
        .cube {
          width: 8px;
          height: 8px;
          background: linear-gradient(135deg, #D4AF37 0%, #F0D060 100%);
          border-radius: 2px;
          box-shadow: 0 2px 8px rgba(212, 175, 55, 0.4);
          animation: cube-bounce 1.4s cubic-bezier(0.65, 0.05, 0.36, 0.95) infinite;
        }
        .cube:nth-child(1) { animation-delay: 0s; }
        .cube:nth-child(2) { animation-delay: 0.14s; }
        .cube:nth-child(3) { animation-delay: 0.28s; }
        .cube:nth-child(4) { animation-delay: 0.42s; }
      `}</style>
      <div className="loading-cubes">
        <div className="cube" />
        <div className="cube" />
        <div className="cube" />
        <div className="cube" />
      </div>
    </>
  );
}

/* ══════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
═══════════════════════════════════════════════════════ */
export default function Dashboard() {
  const [period,        setPeriod]       = useState("Este mês");
  const [customRange,   setCustomRange]  = useState({ from: "", to: "" });
  const [module,        setModule]       = useState("Dashboard");
  const [sistemaAtivo,  setSistemaAtivo] = useState("gestao");
  const [flowInitialTab, setFlowInitialTab] = useState("overview");
  const [userName,      setUserName]     = useState("Usuário");
  const [userAvatar,    setUserAvatar]   = useState(null);
  const [saudacaoVisivel, setSaudacaoVisivel] = useState(
    () => sessionStorage.getItem("ag_saudacao_shown") !== "true"
  );
  const [menuVisivel,   setMenuVisivel]  = useState({});
  const [collapsed,     setCollapsed]    = useState(
    () => localStorage.getItem("ag_sidebar_collapsed") === "true"
  );
  const [dropdownOpen,  setDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifOpen,     setNotifOpen]    = useState(false);
  const [notificacoes,  setNotificacoes] = useState([]);
  const [notifLidas,    setNotifLidas]   = useState(
    () => { try { return JSON.parse(localStorage.getItem("ag_notif_lidas") || "[]"); } catch { return []; } }
  );
  const [notifDespesas, setNotifDespesas] = useState([]);
  const [notifInsights, setNotifInsights] = useState([]);
  const [notifAReceber, setNotifAReceber] = useState([]);
  const [anuncioModal,  setAnuncioModal]  = useState(null);  // { id, titulo, mensagem, imageUrl, btnTexto, btnUrl }
  const notifRef = useRef(null);
  const [theme, setTheme] = useState(
    () => localStorage.getItem("ag_theme") || "dark"
  );
  const [dashView, setDashView] = useState("overview"); // "overview" | "charts"
  const [faturMode, setFaturMode] = useState("3d");        // "flat" | "3d"
  const [chartsBarMode, setChartsBarMode] = useState("3d"); // para renderChartsView
  const [mixMode, setMixMode] = useState("3d");             // "flat" | "3d"
  const [mixModeOverview, setMixModeOverview] = useState("3d"); // overview card
  const [faturDiarioMode, setFaturDiarioMode] = useState("3d"); // Faturamento Diário
  const [searchQuery, setSearchQuery]     = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const allModulos = useMemo(() => NAV.flatMap(sec => sec.items), []);
  const [clientesCadastro, setClientesCadastro] = useState([]);
   
const { filtrarNav, podeVer, podeCriar, podeEditar, podeExcluir, cargo, isAdmin } = usePermissao();
  const { user: authUser, tenantUid, nomeUsuario } = useAuth();

  // uid como estado local derivado de tenantUid.
  // Necessário para que os data hooks (useEmpresa, useLicenca, useDashboardData)
  // disparem seus useEffect([uid]) corretamente quando o auth resolve.
  // Usa tenantUid (não user.uid) para que colaboradores vejam dados do tenant certo.
  const [uid, setUid] = useState(tenantUid ?? null);
  useEffect(() => {
    if (tenantUid) setUid(tenantUid);
  }, [tenantUid]);
   
  const toggleTheme = () => {
    setTheme(prev => {
      const next = prev === "dark" ? "light" : "dark";
      localStorage.setItem("ag_theme", next);
      return next;
    });
  };
  const dropdownRef = useRef(null);

  /* ── Hooks de dados — declarados aqui para isPro estar disponível nos useEffects abaixo ── */
  const empresa = useEmpresa(uid);
  const { isPro, plano: licencaSlug } = useLicenca(tenantUid);

  /* ── Notificações de reserva — AssFlow (tempo real, por usuário) ── */
  const {
    notificacoes: notifReservas,
    naoLidas:     notifReservasNaoLidas,
    marcarLida:   marcarReservaLida,
    initAudio,
  } = useNotificacoes(tenantUid, authUser);

  /* Inicializa AudioContext no primeiro clique do usuário */
  useEffect(() => {
    window.addEventListener("click", initAudio, { once: true });
    return () => window.removeEventListener("click", initAudio);
  }, [initAudio]);

  /* ── Inicializa FCM e salva token quando usuário faz login ── */
  useEffect(() => {
    if (!authUser?.uid) return;

    // Inicializa FCM
    initFCM();

    // Pede permissão de notificação
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then(async (permission) => {
        if (permission === 'granted') {
          const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
          const token = await obterTokenPush(vapidKey);

          if (token) {
            // Salva token em usuarios/{userId}
            try {
              await updateDoc(doc(db, 'usuarios', authUser.uid), {
                fcmToken: token,
                fcmTokenAtualizado: new Date(),
              });
              console.log('[FCM] Token salvo com sucesso');
            } catch (err) {
              console.error('[FCM] Erro ao salvar token:', err);
            }
          }
        }
      });
    }
  }, [authUser?.uid]);
  const dash    = useDashboardData(
    uid, period,
    period === "Personalizado" && customRange.from && customRange.to ? customRange : null
  );

  /* ── Notificações AG — listener em tempo real ── */
  useEffect(() => {
    if (!tenantUid) return;
    const q = collection(db, "notificacoesAG");
    const qOrdered = query(q, orderBy("criadoEm", "desc"), limit(50));
    const seteDiasAtras = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const unsub = onSnapshot(qOrdered, (snap) => {
      const todas = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const filtradas = todas.filter((n) => {
        // Filtro de destinatário
        const planOk =
          n.destinatario === "todos" ||
          // Slugs reais gravados pelo painel admin
          n.destinatario === licencaSlug ||
          // Aliases legados (docs antigos com "pro"/"free")
          (n.destinatario === "pro"  && licencaSlug === "profissional") ||
          (n.destinatario === "free" && (licencaSlug === "essencial" || licencaSlug === "trial")) ||
          // Notificação individual: verifica se é para este tenant/usuário
          (n.destinatario === "individual" && (n.destinatarioUid === tenantUid || n.uid === tenantUid));
        if (!planOk) return false;
        // Filtro de 7 dias — ignora notificações antigas para o usuário
        const data = n.criadoEm?.toDate ? n.criadoEm.toDate() : null;
        if (data && data < seteDiasAtras) return false;
        return true;
      });
      setNotificacoes(filtradas);
    }, fsSnapshotError("Dashboard:notificacoes"));
    return unsub;
  }, [tenantUid, isPro, licencaSlug]);

  /* ── Anúncios Modais — busca ao entrar, mostra o mais recente ativo ── */
  useEffect(() => {
    if (!tenantUid) return;

    // Chave de sessão: evita re-exibir o mesmo anúncio na mesma sessão
    const SESSAO_KEY = "ag_anuncios_vistos_sessao";
    let vistos;
    try { vistos = new Set(JSON.parse(sessionStorage.getItem(SESSAO_KEY) || "[]")); }
    catch { vistos = new Set(); }

    async function buscarAnuncio() {
      try {
        // Busca todos os anúncios ativos — sem orderBy para não precisar de índice composto
        // Ordenação e filtragem feitas no cliente
        const qTodos = query(
          collection(db, "anunciosAG"),
          where("ativo", "==", true),
          limit(30)
        );
        const snap = await getDocs(qTodos);
        const todos = snap.docs.map(d => ({ id: d.id, ...d.data() }));

        // Separa individuais (deste usuário) e globais compatíveis com o plano
        const individuais = todos.filter(d =>
          d.destinatario === "individual" &&
          (d.destinatarioUid === tenantUid || d.uid === tenantUid)
        );
        const globais = todos.filter(d =>
          d.destinatario === "todos" ||
          // Slugs reais gravados pelo painel admin
          d.destinatario === licencaSlug ||
          // Aliases legados (caso algum doc antigo use "pro"/"free")
          (d.destinatario === "pro"  && licencaSlug === "profissional") ||
          (d.destinatario === "free" && (licencaSlug === "essencial" || licencaSlug === "trial"))
        );

        // Individuais têm prioridade; dentro de cada grupo, mais recente primeiro
        const ordenar = (arr) => arr.sort((a, b) => {
          const ta = a.criadoEm?.toDate ? a.criadoEm.toDate().getTime() : 0;
          const tb = b.criadoEm?.toDate ? b.criadoEm.toDate().getTime() : 0;
          return tb - ta;
        });

        const candidatos = [
          ...ordenar(individuais).map(d => ({ ...d, _prioridade: 1 })),
          ...ordenar(globais).map(d => ({ ...d, _prioridade: 0 })),
        ];

        // Filtra os já vistos nesta sessão
        const naoVistos = candidatos.filter(a => !vistos.has(a.id));
        if (!naoVistos.length) return;

        setAnuncioModal(naoVistos[0]);
      } catch(e) {
        fsError(e, "Dashboard:anuncios");
      }
    }

    buscarAnuncio();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantUid, isPro, licencaSlug]);

  const fecharAnuncioModal = () => {
    if (!anuncioModal) return;
    // Marca como visto na sessão
    const SESSAO_KEY = "ag_anuncios_vistos_sessao";
    let vistos;
    try { vistos = new Set(JSON.parse(sessionStorage.getItem(SESSAO_KEY) || "[]")); }
    catch { vistos = new Set(); }
    vistos.add(anuncioModal.id);
    sessionStorage.setItem(SESSAO_KEY, JSON.stringify([...vistos]));
    setAnuncioModal(null);
  };

  /* ── Notificações automáticas de despesas próximas do vencimento ── */
  useEffect(() => {
    if (!uid) return;
    const q = query(
      collection(db, "users", uid, "despesas"),
      orderBy("vencimento", "asc")
    );
    const unsub = onSnapshot(q, (snap) => {
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);

      const alertas = [];
      snap.docs.forEach((docSnap) => {
        const d = { id: docSnap.id, ...docSnap.data() };

        // Ignora despesas já pagas ou canceladas
        if (d.status === "pago" || d.status === "cancelado") return;
        if (!d.vencimento) return;

        // Parse da data de vencimento (YYYY-MM-DD ou Timestamp)
        let venc;
        if (d.vencimento?.toDate) {
          venc = d.vencimento.toDate();
        } else if (typeof d.vencimento === "string") {
          const [y, m, dia] = d.vencimento.split("-").map(Number);
          venc = new Date(y, m - 1, dia);
        } else {
          return;
        }
        venc.setHours(0, 0, 0, 0);

        const diffMs   = venc - hoje;
        const diffDias = Math.round(diffMs / (1000 * 60 * 60 * 24));

        if (diffDias < 0 || diffDias > 3) return; // só 0, 1, 2, 3 dias

        const idShow = d.idShow || d.id.slice(0, 6).toUpperCase();
        const nome   = d.descricao || "Sem descrição";

        let titulo, urgencia;
        if (diffDias === 0) {
          titulo   = `⚠️ Vence hoje — #${idShow}`;
          urgencia = "hoje";
        } else if (diffDias === 1) {
          titulo   = `🔔 Vence amanhã — #${idShow}`;
          urgencia = "1dia";
        } else if (diffDias === 2) {
          titulo   = `📅 Vence em 2 dias — #${idShow}`;
          urgencia = "2dias";
        } else {
          titulo   = `📅 Vence em 3 dias — #${idShow}`;
          urgencia = "3dias";
        }

        alertas.push({
          id:        `desp-${d.id}-${urgencia}`,
          titulo,
          mensagem:  nome,
          despesaId: d.id,
          diffDias,
          urgencia,
          tipo:      "despesa",
        });
      });

      // Ordena: vence hoje → 1 dia → 2 dias → 3 dias
      alertas.sort((a, b) => a.diffDias - b.diffDias);
      setNotifDespesas(alertas);
    }, fsSnapshotError("Dashboard:despesas"));
    return unsub;
  }, [uid]);

  /* ── Notificações automáticas de A Receber — vence hoje e amanhã ── */
  useEffect(() => {
    if (!uid) return;
    const q = query(
      collection(db, "users", uid, "a_receber"),
      orderBy("dataVencimento", "asc")
    );
    const unsub = onSnapshot(q, (snap) => {
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);

      const alertas = [];
      snap.docs.forEach((docSnap) => {
        const d = { id: docSnap.id, ...docSnap.data() };

        if (d.status === "pago" || d.status === "cancelado") return;
        if ((d.valorRestante ?? 0) <= 0) return;
        if (!d.dataVencimento) return;

        let venc;
        if (d.dataVencimento?.toDate) {
          venc = d.dataVencimento.toDate();
        } else if (typeof d.dataVencimento === "string") {
          const [y, m, dia] = d.dataVencimento.split("-").map(Number);
          venc = new Date(y, m - 1, dia);
        } else {
          return;
        }
        venc.setHours(0, 0, 0, 0);

        const diffMs   = venc - hoje;
        const diffDias = Math.round(diffMs / (1000 * 60 * 60 * 24));

        // Apenas vence hoje (0) ou amanhã (1)
        if (diffDias !== 0 && diffDias !== 1) return;

        const fmtValorAR = (v) =>
          v != null
            ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
            : "—";

        const cliente = d.clienteNome || d.descricao || "Cliente";
        const valor   = fmtValorAR(d.valorRestante);
        const urgencia = diffDias === 0 ? "hoje" : "amanha";

        alertas.push({
          id:          `ar-${d.id}-${urgencia}`,
          titulo:      diffDias === 0 ? "💰 A Receber — vence hoje" : "🔔 A Receber — vence amanhã",
          mensagem:    `${cliente} · ${valor}`,
          diffDias,
          urgencia,
          tipo:        "a_receber",
          clienteNome: cliente,
          valor,
        });
      });

      alertas.sort((a, b) => a.diffDias - b.diffDias);
      setNotifAReceber(alertas);
    }, fsSnapshotError("Dashboard:aReceberNotif"));
    return unsub;
  }, [uid]);

  /* ── Insights automáticos de negócio — gerados pela Cloud Function diária ── */
  useEffect(() => {
    if (!uid) return;
    const q = query(
      collection(db, "users", uid, "insights"),
      orderBy("criadoEm", "desc"),
      limit(20)
    );
    const unsub = onSnapshot(q, (snap) => {
      setNotifInsights(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }, fsSnapshotError("Dashboard:insights"));
    return unsub;
  }, [uid]);

  /* ── Fecha painel de notificações ao clicar fora ── */
  useEffect(() => {
    if (!notifOpen) return;
    const handler = (e) => {
      if (!notifRef.current?.contains(e.target)) setNotifOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [notifOpen]);

  /* Normaliza despesas: quanto mais urgente (diffDias menor), mais no topo */
  const notifDespesasNorm = notifDespesas.map((n) => ({
    ...n,
    _ts: Date.now() - n.diffDias * 86400000,
  }));

  /* Notificações AG do sistema têm criadoEm (Firestore Timestamp) */
  const notifSistemaNorm = notificacoes.map((n) => ({
    ...n,
    _ts: n.criadoEm?.toDate ? n.criadoEm.toDate().getTime() : 0,
  }));

  /* Insights de negócio por tenant */
  const notifInsightsNorm = notifInsights.map((n) => ({
    ...n,
    tipo: "insight",
    _ts: n.criadoEm?.toDate ? n.criadoEm.toDate().getTime() : 0,
  }));

  /* Normaliza notificações de reserva do AssFlow
     — só docs com tipo==nova_reserva E payload válido (defensivo contra
     docs estranhos escritos na mesma subcoleção por outros sistemas) */
  const notifReservasNorm = notifReservas
    .filter((n) => n.tipo === "nova_reserva" && n.payload && typeof n.payload === "object")
    .map((n) => ({
      ...n,
      _ts: n.criadoEm?.toDate ? n.criadoEm.toDate().getTime() : Date.now(),
    }));

  /* Normaliza alertas de A Receber: urgência primeiro (hoje > amanhã) */
  const notifAReceberNorm = notifAReceber.map((n) => ({
    ...n,
    _ts: Date.now() - n.diffDias * 86400000,
  }));

  /* Merge cronológico: mais recente/urgente primeiro */
  const todasNotif = [...notifDespesasNorm, ...notifAReceberNorm, ...notifSistemaNorm, ...notifInsightsNorm, ...notifReservasNorm]
    .sort((a, b) => b._ts - a._ts);

  const notifNaoLidas = todasNotif.filter((n) => !notifLidas.includes(n.id)).length;

  const marcarTodasLidas = () => {
    const ids = todasNotif.map((n) => n.id);
    setNotifLidas(ids);
    localStorage.setItem("ag_notif_lidas", JSON.stringify(ids));
  };

  const abrirNotif = () => {
    setNotifOpen((v) => !v);
    if (!notifOpen) marcarTodasLidas();
  };

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

  /* ── Busca global no Firestore ── */
  const searchDebounceRef = useRef(null);

  const runSearch = useCallback(async (q) => {
    if (!uid || !q.trim()) { setSearchResults([]); return; }
    setSearchLoading(true);
    try {
      const term = q.trim().toLowerCase();
      const col = (name) => collection(db, "users", uid, name);
      const snap = (name) => getDocs(col(name));

      const [
        clientesSnap, produtosSnap, vendasSnap,
        servicosSnap, despesasSnap, vendedoresSnap, aReceberSnap,
      ] = await Promise.all([
        snap("clientes"), snap("produtos"), snap("vendas"),
        snap("servicos"), snap("despesas"), snap("vendedores"), snap("a_receber"),
      ]);

      const grupos = [];

      // Módulos
      const modulos = allModulos.filter(m => m.label.toLowerCase().includes(term));
      if (modulos.length) grupos.push({ tipo: "Módulos", items: modulos.map(m => ({
        label: m.label, sub: "Ir para o módulo", icone: m.icone,
        onClick: () => { navigateTo(m.label); setSearchQuery(""); setSearchResults([]); }
      }))});

      // Clientes e Matrículas (mesma coleção, separados por perfil)
      const todosClientes = clientesSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(c => c.nome?.toLowerCase().includes(term));

      const clientesRes = todosClientes.filter(c => !(c.perfis || []).includes("aluno"));
      const alunosRes   = todosClientes.filter(c =>  (c.perfis || []).includes("aluno"));

      if (clientesRes.length) grupos.push({ tipo: "Clientes", items: clientesRes.slice(0,5).map(c => ({
        label: c.nome, sub: c.telefone || c.email || c.id, icone: Users,
        onClick: () => { navigateTo("Clientes"); setSearchQuery(""); setSearchResults([]); }
      }))});

      if (alunosRes.length) grupos.push({ tipo: "Matrículas", items: alunosRes.slice(0,5).map(a => ({
        label: a.nome, sub: a.turma ? `Turma: ${a.turma}` : (a.telefone || a.email || ""), icone: GraduationCap,
        onClick: () => { navigateTo("Matriculas"); setSearchQuery(""); setSearchResults([]); }
      }))});

      // Produtos
      const produtosRes = produtosSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(p => p.nome?.toLowerCase().includes(term));
      if (produtosRes.length) grupos.push({ tipo: "Produtos", items: produtosRes.slice(0,5).map(p => ({
        label: p.nome, sub: p.precoVenda != null ? fmtR$(p.precoVenda) : "", icone: Package,
        onClick: () => { navigateTo("Produtos"); setSearchQuery(""); setSearchResults([]); }
      }))});

      // Vendas
      const vendasRes = vendasSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(v => v.cliente?.toLowerCase().includes(term) || String(v.idVenda || "").toLowerCase().includes(term));
      if (vendasRes.length) grupos.push({ tipo: "Vendas", items: vendasRes.slice(0,5).map(v => ({
        label: v.cliente || v.idVenda || v.id, sub: `${v.idVenda || v.id} · ${fmtR$(v.total)}`, icone: ShoppingCart,
        onClick: () => { navigateTo("Vendas"); setSearchQuery(""); setSearchResults([]); }
      }))});

      // Serviços
      const servicosRes = servicosSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(s => s.nome?.toLowerCase().includes(term));
      if (servicosRes.length) grupos.push({ tipo: "Serviços", items: servicosRes.slice(0,5).map(s => ({
        label: s.nome, sub: s.preco != null ? fmtR$(s.preco) : "", icone: Wrench,
        onClick: () => { navigateTo("Serviços"); setSearchQuery(""); setSearchResults([]); }
      }))});

      // Despesas
      const despesasRes = despesasSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(d => d.descricao?.toLowerCase().includes(term));
      if (despesasRes.length) grupos.push({ tipo: "Despesas", items: despesasRes.slice(0,5).map(d => ({
        label: d.descricao, sub: fmtR$(d.valor), icone: TrendingDown,
        onClick: () => { navigateTo("Despesas"); setSearchQuery(""); setSearchResults([]); }
      }))});

      // Vendedores
      const vendedoresRes = vendedoresSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(v => v.nome?.toLowerCase().includes(term));
      if (vendedoresRes.length) grupos.push({ tipo: "Vendedores", items: vendedoresRes.slice(0,5).map(v => ({
        label: v.nome, sub: v.email || "", icone: Users,
        onClick: () => { navigateTo("Vendedores"); setSearchQuery(""); setSearchResults([]); }
      }))});

      // Mensalidades (a_receber com origem = "mensalidade")
      const MESES = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
      const mensalidadesRes = aReceberSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(m => m.origem === "mensalidade" &&
          (m.clienteNome?.toLowerCase().includes(term) ||
           m.mesReferencia?.toLowerCase().includes(term))
        );
      if (mensalidadesRes.length) grupos.push({ tipo: "Mensalidades", items: mensalidadesRes.slice(0,5).map(m => {
        const [ano, mes] = (m.mesReferencia || "").split("-");
        const mesLabel = mes ? `${MESES[Number(mes)-1]}/${ano}` : m.mesReferencia || "";
        const aberta = Number(m.valorRestante || 0) > 0;
        return {
          label: m.clienteNome || "—",
          sub: `${mesLabel} · ${fmtR$(aberta ? m.valorRestante : m.valorTotal)} · ${aberta ? "em aberto" : "paga"}`,
          icone: CreditCard,
          onClick: () => { navigateTo("Matriculas"); setSearchQuery(""); setSearchResults([]); }
        };
      })});

      setSearchResults(grupos);
    } catch (err) {
      console.error("Busca global:", err);
    } finally {
      setSearchLoading(false);
    }
  }, [uid, allModulos]);

  useEffect(() => {
    clearTimeout(searchDebounceRef.current);
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    searchDebounceRef.current = setTimeout(() => runSearch(searchQuery), 350);
    return () => clearTimeout(searchDebounceRef.current);
  }, [searchQuery, runSearch]);

  /* ── Nome do usuário ──
     Dono (uid === tenantUid) → lê licencas/{tenantUid} → campo name
     Colaborador              → lê users/{tenantUid}/usuarios/{authUser.uid} → campo nome */
  useEffect(() => {
    if (!uid || !authUser) return;

    const isOwner = authUser.uid === tenantUid;

    if (isOwner) {
      // Dono: fonte de verdade é licencas/{tenantUid}
      return onSnapshot(doc(db, "licencas", uid), (snap) => {
        const name =
          snap.data()?.name ||
          nomeUsuario ||
          authUser?.displayName ||
          authUser?.email?.split("@")[0] ||
          "Usuário";
        setUserName(name);
      }, fsSnapshotError("Dashboard:nomeDono"));
    } else {
      // Colaborador: nome salvo em users/{tenantUid}/usuarios/{authUser.uid}
      return onSnapshot(doc(db, "users", uid, "usuarios", authUser.uid), async (snap) => {
        const nomeLocal = snap.data()?.nome;
        if (nomeLocal) { setUserName(nomeLocal); return; }
        // fallback sem acesso à licença do dono — usa dados do Firebase Auth
        const name =
          nomeUsuario ||
          authUser?.displayName ||
          authUser?.email?.split("@")[0] ||
          "Usuário";
        setUserName(name);
      }, fsSnapshotError("Dashboard:nomeColaborador"));
    }
  }, [uid, authUser, tenantUid, nomeUsuario]);

  /* ── Avatar ──
     Dono        → users/{uid}/foto/avatar → campo base64
     Colaborador → users/{tenantUid}/usuarios/{authUser.uid} → campo fotoBase64 */
  useEffect(() => {
    if (!uid || !authUser) return;

    const isOwner = authUser.uid === tenantUid;

    if (isOwner) {
      return onSnapshot(doc(db, "users", uid, "foto", "avatar"), (snap) => {
        if (snap.exists()) {
          const d = snap.data();
          setUserAvatar(d?.base64 || d?.url || d?.photoURL || null);
        } else {
          setUserAvatar(null);
        }
      }, (err) => { fsError(err, "Dashboard:avatarDono"); setUserAvatar(null); });
    } else {
      // Colaborador: foto salva no próprio documento do usuário
      return onSnapshot(doc(db, "users", uid, "usuarios", authUser.uid), (snap) => {
        const fotoBase64 = snap.data()?.fotoBase64 || null;
        setUserAvatar(fotoBase64);
      }, (err) => { fsError(err, "Dashboard:avatarColaborador"); setUserAvatar(null); });
    }
  }, [uid, authUser, tenantUid]);

  /* ── Visibilidade do menu ── */
  useEffect(() => {
    if (!uid) return;
    return onSnapshot(doc(db, "users", uid, "config", "geral"), (snap) => {
      if (snap.exists()) setMenuVisivel(snap.data().menuVisivel || {});
    }, fsSnapshotError("Dashboard:configGeral"));
  }, [uid]);

  /* ── Datas de cadastro dos clientes (gráfico de crescimento) ── */
  useEffect(() => {
    if (!uid) return;
    return onSnapshot(collection(db, "users", uid, "clientes"), (snap) => {
      setClientesCadastro(snap.docs.map(d => ({ criadoEm: d.data().criadoEm || null })));
    }, fsSnapshotError("Dashboard:clientes"));
  }, [uid]);

  /* ── Atalhos de teclado ── */
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        const overlay = document.querySelector(".modal-overlay");
        if (overlay) overlay.click();
        return;
      }
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

  /* ── Logo e nome da empresa ── */
  const logoUrl      = empresa?.logo || null;
  const nomeEmpresa  = empresa?.nomeEmpresa || "Assent Gestão";
  const logoInitials = nomeEmpresa
    .split(" ").filter(Boolean).slice(0, 2)
    .map((w) => w[0]).join("").toUpperCase();

  const userInitial = userName.charAt(0).toUpperCase();

  /* ── Badge de plano — renderizado no header e na sidebar mobile ──
     Fonte única de verdade: usa licencaSlug (slug do Firestore).
     Nunca usa isPro para exibição — só para lógica de permissão. */
  const PLAN_TAG_STYLES = {
    base: {
      fontSize: 9, fontWeight: 700, letterSpacing: "0.1em",
      textTransform: "uppercase", borderRadius: 20,
      padding: "2px 7px", flexShrink: 0,
    },
  };
  const planTagEl =
    licencaSlug === "profissional" ? (
      <span style={{
        ...PLAN_TAG_STYLES.base,
        background: "linear-gradient(135deg,#D4AF37,#e8ca60)",
        WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
        border: "1px solid rgba(200,165,94,0.4)",
      }}>★ Profissional</span>
    ) : licencaSlug === "trial" ? (
      <span style={{
        ...PLAN_TAG_STYLES.base,
        color: "var(--amber)",
        border: "1px solid rgba(245,158,11,0.4)",
      }}>⏳ Trial</span>
    ) : licencaSlug === "essencial" ? (
      <span style={{
        ...PLAN_TAG_STYLES.base,
        color: "var(--text-2)",
        border: "1px solid rgba(255,255,255,0.12)",
      }}>Essencial</span>
    ) : null;

  /* ── KPI Main ── */
  const kpiMain = [
    {
      label: "Receita Bruta", value: fmtR$(dash.receitaBruta),
      trend: `${dash.numVendas} venda${dash.numVendas !== 1 ? "s" : ""}`,
      up: dash.receitaBruta > 0, accent: "var(--green)", sub: "no período selecionado",
    },
    {
      label: "Despesa total", value: fmtR$(dash.custoTotal),
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
      case "Agenda":
        return (
          <RotaProtegida modulo="agenda" label="Agenda">
            <Agenda isPro={isPro} />
          </RotaProtegida>
        );
      case "Clientes":
        return (
          <RotaProtegida modulo="clientes" label="Clientes">
            <Clientes isPro={isPro} />
          </RotaProtegida>
        );
      case "Produtos":
        return (
          <RotaProtegida modulo="produtos" label="Produtos">
            <Produtos isPro={isPro} />
          </RotaProtegida>
        );
      case "Serviços":
        return (
          <RotaProtegida modulo="servicos" label="Serviços">
            <Servicos isPro={isPro} />
          </RotaProtegida>
        );
      case "Fornecedores":
        return (
          <RotaProtegida modulo="fornecedores" label="Fornecedores">
            <Fornecedores />
          </RotaProtegida>
        );
      case "Vendedores":
        return (
          <RotaProtegida modulo="vendedores" label="Vendedores">
            <Vendedores />
          </RotaProtegida>
        );
      case "Estoque":
        return (
          <RotaProtegida modulo="entradaEstoque" label="Entrada de Estoque">
            <EntradaEstoque />
          </RotaProtegida>
        );
      case "Compras":
        return (
          <RotaProtegida modulo="compras" label="Compras">
            <Compras />
          </RotaProtegida>
        );
      case "Mesas":
        return (
          <RotaProtegida modulo="mesas" label="Mesas">
            <Mesas />
          </RotaProtegida>
        );
      case "Orçamentos":
        return (
          <RotaProtegida modulo="orcamentos" label="Orçamentos">
            <Orcamentos isPro={isPro} />
          </RotaProtegida>
        );
      case "Vendas":
        return (
          <RotaProtegida modulo="vendas" label="Vendas">
            <Vendas isPro={isPro} />
          </RotaProtegida>
        );
      case "A Receber":
        return (
          <RotaProtegida modulo="aReceber" label="A Receber">
            <AReceber />
          </RotaProtegida>
        );
      case "Caixa Diário":
        return (
          <RotaProtegida modulo="caixaDiario" label="Caixa Diário">
            <CaixaDiario />
          </RotaProtegida>
        );
      case "Despesas":
        return (
          <RotaProtegida modulo="despesas" label="Despesas">
            <Despesas isPro={isPro} />
          </RotaProtegida>
        );
      case "Relatórios":
        // Todos veem o menu; bloqueio por sub-relatório é feito dentro do componente
        return <Relatorios />;
      case "Usuários":
        return (
          <RotaProtegida modulo="usuarios" label="Usuários">
            <Usuarios />
          </RotaProtegida>
        );
        case "Matriculas":
        return (
          <RotaProtegida modulo="alunos" label="Matriculas">
            <Alunos />
          </RotaProtegida>
            );
      case "PDV":
        return (
          <RotaProtegida modulo="vendas" label="PDV">
            <PDV onVoltar={() => setModule("Vendas")} />
          </RotaProtegida>
        );
      case "Configurações":
        // Configurações não precisa de RotaProtegida (acesso controlado pelo cargo admin)
        return <Configuracoes menuVisivel={menuVisivel} />;       
      default:
        return renderDashboard();
    }
  };

  /* ══ RENDER DASHBOARD ══ */
  const renderDashboard = () => (
    <>
      <header className="ag-topbar">
        <div className="ag-topbar-title">
          <h1>Dashboard</h1>
          <p><span className="ag-live-dot" />Visão geral do negócio</p>
        </div>

        <div style={{ display: "flex", background: "var(--s2)", border: "1px solid var(--border)", borderRadius: 8, padding: 3, gap: 2, flexShrink: 0 }}>
          <button
            onClick={() => setDashView("overview")}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "5px 12px", borderRadius: 6, border: "none", cursor: "pointer",
              fontSize: 12, fontWeight: 500, fontFamily: "'Sora', system-ui, sans-serif",
              background: dashView === "overview" ? "var(--s1)" : "transparent",
              color: dashView === "overview" ? "var(--text)" : "var(--text-3)",
              boxShadow: dashView === "overview" ? "0 1px 3px rgba(0,0,0,0.15)" : "none",
              transition: "all .15s",
            }}
          >
            <LayoutDashboard size={13} /> Visão Geral
          </button>
          <button
            onClick={() => setDashView("charts")}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "5px 12px", borderRadius: 6, border: "none", cursor: "pointer",
              fontSize: 12, fontWeight: 500, fontFamily: "'Sora', system-ui, sans-serif",
              background: dashView === "charts" ? "var(--gold-d)" : "transparent",
              color: dashView === "charts" ? "var(--gold)" : "var(--text-3)",
              transition: "all .15s",
            }}
          >
            <BarChart3 size={13} /> Gráficos
          </button>
        </div>

        <div style={{ flex: 1 }} />
        <div className="ag-search" style={{ position: "relative" }}>
          <Search size={13} color="var(--text-3)" />
          <input
            placeholder="Buscar módulos, clientes, vendas..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && searchResults.length > 0) searchResults[0].items[0].onClick();
              if (e.key === "Escape") setSearchQuery("");
            }}
          />
          {(searchLoading || searchResults.length > 0) && searchQuery.trim() && (
            <div style={{
              position: "absolute", top: "calc(100% + 6px)", left: 0, width: "320px",
              background: "var(--s1)", border: "1px solid var(--border)",
              borderRadius: 10, zIndex: 999, overflow: "hidden",
              boxShadow: "0 8px 24px rgba(0,0,0,0.15)"
            }}>
              {searchLoading ? (
                <div style={{ padding: "14px", fontSize: 13, color: "var(--text-3)", textAlign: "center" }}><LoadingCubes /></div>
              ) : searchResults.map(grupo => (
                <div key={grupo.tipo}>
                  <div style={{ padding: "8px 14px 4px", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: "var(--text-3)", textTransform: "uppercase" }}>{grupo.tipo}</div>
                  {grupo.items.map((item, i) => (
                    <div key={i} onClick={item.onClick}
                      style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 14px", cursor: "pointer", transition: "background .1s" }}
                      onMouseOver={e => e.currentTarget.style.background = "var(--s2)"}
                      onMouseOut={e => e.currentTarget.style.background = "transparent"}
                    >
                      <item.icone size={14} color="var(--text-3)" style={{ flexShrink: 0 }} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.label}</div>
                        {item.sub && <div style={{ fontSize: 11, color: "var(--text-3)" }}>{item.sub}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="ag-periods">
          {PERIODS.map((p) => (
            <button key={p} className={`ag-period-btn ${period === p ? "active" : ""}`} onClick={() => setPeriod(p)}>{p}</button>
          ))}
        </div>
        {period === "Personalizado" && (
          <div className="ag-custom-range">
            <label>De</label>
            <input type="date" className="ag-date-input" value={customRange.from} max={customRange.to || undefined}
              onChange={(e) => setCustomRange((r) => ({ ...r, from: e.target.value }))} />
            <span className="ag-date-sep">→</span>
            <label>Até</label>
            <input type="date" className="ag-date-input" value={customRange.to} min={customRange.from || undefined}
              onChange={(e) => setCustomRange((r) => ({ ...r, to: e.target.value }))} />
          </div>
        )}
      </header>

      {/* Mobile period */}
      <div className="ag-period-mobile" style={{ alignItems: "center", gap: 8, padding: "10px 16px", borderBottom: "1px solid var(--border)", background: "var(--s1)", flexShrink: 0 }}>
        <select value={period} onChange={(e) => setPeriod(e.target.value)}
          style={{ flex: 1, background: "var(--s2)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text)", fontSize: 13, padding: "7px 10px", fontFamily: "'Sora', system-ui, sans-serif", outline: "none" }}>
          {PERIODS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        {period === "Personalizado" && (
          <div style={{ display: "flex", gap: 6, alignItems: "center", flex: 1, marginTop: 8 }}>
            <input type="date" className="ag-date-input" value={customRange.from} max={customRange.to || undefined}
              onChange={(e) => setCustomRange((r) => ({ ...r, from: e.target.value }))} style={{ flex: 1, fontSize: 12 }} />
            <span style={{ color: "var(--text-3)", fontSize: 12 }}>→</span>
            <input type="date" className="ag-date-input" value={customRange.to} min={customRange.from || undefined}
              onChange={(e) => setCustomRange((r) => ({ ...r, to: e.target.value }))} style={{ flex: 1, fontSize: 12 }} />
          </div>
        )}
      </div>

      <div className="ag-content">
        {dashView === "charts" ? renderChartsView() : (<>

          {/* ── KPI CARDS ── */}
          <div className="db-kpi-strip">
            {[...kpiMain, ...kpiSec].map((k) => (
              <div key={k.label} className="db-kpi-card">
                <div className="db-kpi-label">{k.label}</div>
                <div className="db-kpi-val" style={{ color: k.accent || "var(--text)" }}>
                  <Val v={k.value} loading={dash.loading} />
                </div>
                <div className="db-kpi-meta">
                  {k.trend ? (
                    <span className="db-kpi-trend" style={{ color: k.up ? "var(--green)" : k.up === false ? "var(--red)" : "var(--text-3)" }}>
                      {k.up === true && <ArrowUpRight size={11} />}
                      {k.up === false && <ArrowDownRight size={11} />}
                      {k.trend}
                    </span>
                  ) : (
                    <span className="db-kpi-sub">{k.sub}</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* ── BODY 2 COLUNAS ── */}
          <div className="db-body">

            {/* MAIN */}
            <div className="db-main">

              {/* Gráfico */}
              <div className="db-panel">
                <div className="db-panel-header">
                  <span className="db-panel-title">Faturamento por período</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 11, color: "var(--text-3)" }}>
                      {period === "Personalizado" && customRange.from && customRange.to
                        ? `${customRange.from.split("-").reverse().join("/")} – ${customRange.to.split("-").reverse().join("/")}`
                        : period}
                    </span>
                    <ChartToggle value={faturMode} onChange={setFaturMode} />
                  </div>
                </div>
                <div style={{ padding: "16px 16px 10px" }}>
                  {faturMode === "3d" ? (
                    <Chart3DBars data={dash.loading ? [] : dash.faturamentoPorDia} period={period} height={180} />
                  ) : (
                    <ResponsiveContainer width="100%" height={168}>
                      <AreaChart data={dash.loading ? [] : dash.faturamentoPorDia} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                        <defs>
                          <linearGradient id="gGold" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%"  stopColor="#c8a55e" stopOpacity={0.18} />
                            <stop offset="95%" stopColor="#c8a55e" stopOpacity={0}    />
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="d" tick={{ fill: "var(--text-3)", fontSize: 10 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: "var(--text-3)", fontSize: 10 }} axisLine={false} tickLine={false} />
                        <Tooltip content={<CustomTooltip />} cursor={{ stroke: "rgba(200,165,94,0.15)", strokeWidth: 1, strokeDasharray: "4 3" }} />
                        <Area type="monotone" dataKey="v" stroke="#c8a55e" strokeWidth={2} fill="url(#gGold)" dot={false}
                          activeDot={{ r: 4, fill: "#c8a55e", stroke: "rgba(200,165,94,0.3)", strokeWidth: 5 }} />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              {/* Últimas Vendas */}
              <div className="db-panel db-panel-table">
                <div className="db-panel-header">
                  <span className="db-panel-title">Últimas vendas</span>
                  <button className="db-view-all" onClick={() => setModule("Vendas")}>Ver todas <ChevronRight size={11} /></button>
                </div>
                <div style={{ overflowX: "auto" }}>
                  <div className="ag-trow ag-thead" style={{ gridTemplateColumns: "80px 1fr 110px 110px", minWidth: 380 }}>
                    {["ID", "Cliente", "Data", "Total"].map((h) => (
                      <span key={h} className="ag-th" style={{ textAlign: h === "Total" ? "right" : "left" }}>{h}</span>
                    ))}
                  </div>
                  {dash.loading ? (
                    <div className="ag-trow" style={{ gridTemplateColumns: "1fr" }}><span className="ag-skeleton" /></div>
                  ) : dash.ultimasVendas.length === 0 ? (
                    <div className="ag-empty-state">
                      <div className="ag-empty-icon"><TrendingDown size={18} color="var(--text-3)" /></div>
                      <div className="ag-empty-title">Nenhuma venda no período</div>
                      <div className="ag-empty-sub">Registre uma venda para ela aparecer aqui</div>
                    </div>
                  ) : dash.ultimasVendas.map((v, i) => (
                    <div key={v.id || i} className="ag-trow" style={{ gridTemplateColumns: "80px 1fr 110px 110px", minWidth: 380 }}>
                      <span style={{ color: "var(--gold)", fontFamily: "var(--font-mono)", fontSize: 11 }}>{v.idVenda || v.id}</span>
                      <span>{v.cliente || "—"}</span>
                      <span style={{ color: "var(--text-2)" }}>{fmtData(v.data)}</span>
                      <span style={{ color: "var(--green)", textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 11 }}>{fmtR$(v.total)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Produtos + Clientes */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div className="db-panel db-panel-table">
                  <div className="db-panel-header"><span className="db-panel-title">Produtos mais vendidos</span></div>
                  <div style={{ overflowX: "auto" }}>
                    <div className="ag-trow ag-thead" style={{ gridTemplateColumns: "1fr 48px 96px", minWidth: 240 }}>
                      <span className="ag-th">Produto</span>
                      <span className="ag-th" style={{ textAlign: "center" }}>Qtd</span>
                      <span className="ag-th" style={{ textAlign: "right" }}>Total</span>
                    </div>
                    {dash.loading ? (
                      <div className="ag-trow" style={{ gridTemplateColumns: "1fr" }}><span className="ag-skeleton" /></div>
                    ) : dash.topProdutos.length === 0 ? (
                      <div className="ag-empty-state">
                        <div className="ag-empty-icon"><Package size={16} color="var(--text-3)" /></div>
                        <div className="ag-empty-title">Sem dados</div>
                        <div className="ag-empty-sub">Nenhuma venda no período</div>
                      </div>
                    ) : dash.topProdutos.map((p, i) => (
                      <div key={i} className="ag-trow" style={{ gridTemplateColumns: "1fr 48px 96px", minWidth: 240 }}>
                        <span>{p.nome}</span>
                        <span style={{ textAlign: "center" }}>{p.qtd}</span>
                        <span style={{ color: "var(--green)", textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 11 }}>{fmtR$(p.total)}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="db-panel db-panel-table">
                  <div className="db-panel-header"><span className="db-panel-title">Clientes que mais compram</span></div>
                  <div style={{ overflowX: "auto" }}>
                    <div className="ag-trow ag-thead" style={{ gridTemplateColumns: "1fr 110px", minWidth: 200 }}>
                      <span className="ag-th">Cliente</span>
                      <span className="ag-th" style={{ textAlign: "right" }}>Total</span>
                    </div>
                    {dash.loading ? (
                      <div className="ag-trow" style={{ gridTemplateColumns: "1fr" }}><span className="ag-skeleton" /></div>
                    ) : dash.topClientes.length === 0 ? (
                      <div className="ag-empty-state">
                        <div className="ag-empty-icon"><Users size={16} color="var(--text-3)" /></div>
                        <div className="ag-empty-title">Sem dados</div>
                        <div className="ag-empty-sub">Nenhuma venda no período</div>
                      </div>
                    ) : dash.topClientes.map((c, i) => (
                      <div key={i} className="ag-trow" style={{ gridTemplateColumns: "1fr 110px", minWidth: 200 }}>
                        <span>{c.nome}</span>
                        <span style={{ color: "var(--gold)", textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 11 }}>{fmtR$(c.total)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

            </div>{/* /db-main */}

            {/* ASIDE */}
            <div className="db-aside">

              {/* Mini stats */}
              <div className="db-panel db-panel-table">
                <div className="db-panel-header">
                  <span className="db-panel-title">Cadastros</span>
                </div>
                {miniStats.map((s) => (
                  <div key={s.label} className="db-stat-row" onClick={() => setModule(s.nav)}>
                    <div className="db-stat-icon" style={{ background: s.dim }}>
                      <s.icon size={15} color={s.color} />
                    </div>
                    <span className="db-stat-label">{s.label}</span>
                    <span className="db-stat-val" style={{ color: s.color }}>
                      <Val v={s.value} loading={dash.loading} />
                    </span>
                  </div>
                ))}
              </div>

              {/* Despesas */}
              <div className="db-panel db-panel-table">
                <div className="db-panel-header">
                  <span className="db-panel-title">Despesas</span>
                  <button className="db-view-all" onClick={() => setModule("Despesas")}>Ver todas <ChevronRight size={11} /></button>
                </div>
                {despesasCards.map((d) => (
                  <div key={d.label} className="db-desp-row">
                    <span className="db-desp-dot" style={{ background: d.color }} />
                    <span className="db-desp-label">{d.label}</span>
                    <span className="db-desp-count" style={{ color: d.color }}>
                      {dash.loading ? <span className="ag-skeleton" style={{ width: 20, height: "1em" }} /> : d.count}
                    </span>
                    <span className="db-desp-val">{d.value}</span>
                  </div>
                ))}
              </div>

              {/* Mix receita */}
              <div className="db-panel">
                <div className="db-panel-header">
                  <span className="db-panel-title">Mix de receita</span>
                  <ChartToggle value={mixModeOverview} onChange={setMixModeOverview} />
                </div>
                <div style={{ padding: "14px 16px" }}>
                  {mixModeOverview === "3d" ? (
                    <Chart3DDonut data={dash.mixData || []} height={200} />
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {(dash.mixData || []).map((item, i) => {
                        const clr = i === 0 ? "#c8a55e" : "#3ecf8e";
                        return (
                          <div key={i}>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 5 }}>
                              <span style={{ color: "var(--text-2)", display: "flex", alignItems: "center", gap: 6 }}>
                                <span style={{ width: 8, height: 8, borderRadius: 3, background: clr, display: "inline-block" }} />
                                {item.name}
                              </span>
                              <span style={{ color: "var(--text)", fontWeight: 600, fontFamily: "var(--font-mono)" }}>
                                {dash.loading ? "—" : `${item.value}%`}
                              </span>
                            </div>
                            <div style={{ background: "var(--s3)", borderRadius: 4, height: 5, overflow: "hidden" }}>
                              <div style={{ width: `${item.value || 0}%`, height: "100%", background: clr, borderRadius: 4, transition: "width 0.5s ease" }} />
                            </div>
                          </div>
                        );
                      })}
                      {(!dash.mixData || dash.mixData.length === 0) && (
                        <div style={{ fontSize: 12, color: "var(--text-3)", textAlign: "center", padding: "8px 0" }}>Sem dados no período</div>
                      )}
                    </div>
                  )}
                </div>
              </div>

            </div>{/* /db-aside */}

          </div>{/* /db-body */}

        </>)}
      </div>
    </>
  );

  /* ══ RENDER GRÁFICOS ══ */
  const renderChartsView = () => {
    // ── Gráfico 1 e 2: Faturamento vs Custo e Lucro por período ──
    // Usa os mesmos dados reais de faturamentoPorDia do hook
    const faturDia = dash.loading ? [] : (dash.faturamentoPorDia || []);

    // Receita por ponto + despesas proporcionais (sem CMV — contabilizado na compra)
    const receitaData = faturDia.map((pt) => {
      const propDesp = dash.receitaBruta > 0 ? (dash.custoTotal || 0) / dash.receitaBruta : 0;
      const receita  = pt.v || 0;
      const custo    = receita * propDesp;
      return { mes: pt.d, receita, custo };
    });

    // Lucro por ponto: margem real do período
    const margemPct = dash.receitaBruta > 0 ? dash.lucroLiquido / dash.receitaBruta : 0;
    const lucroData = faturDia.map((pt) => ({
      mes: pt.d,
      lucro: (pt.v || 0) * margemPct,
    }));

    // ── Radar: métricas reais normalizadas 0–100 ──
    // Vendas: % de cumprimento vs meta (1 venda/dia útil = 100%)
    const diasPeriodo = Math.max(1, faturDia.length);
    const metaVendas  = diasPeriodo; // 1 venda/dia como referência
    const scoreVendas = Math.min(100, Math.round((dash.numVendas / metaVendas) * 100));

    // Clientes: proporção cadastrada (base 100 = referência de negócio saudável)
    const scoreClientes = Math.min(100, Math.round((dash.numClientes / Math.max(1, dash.numClientes)) * 75 + (dash.numClientes > 0 ? 25 : 0)));

    // Produtos: se há produtos cadastrados, score alto; zero produtos = baixo
    const scoreProdutos = dash.numProdutos >= 10 ? 90 : dash.numProdutos >= 5 ? 72 : dash.numProdutos >= 1 ? 55 : 20;

    // Serviços
    const scoreServicos = dash.numServicos >= 5 ? 85 : dash.numServicos >= 2 ? 68 : dash.numServicos >= 1 ? 50 : 20;

    // Financeiro: margem de lucro mapeada 0–100
    const scoreFinanceiro = Math.min(100, Math.max(0, Math.round(dash.margem * 1.1)));

    // Estoque: se tem produtos e tem entradas, bom; sem produtos = baixo
    const scoreEstoque = dash.numProdutos >= 5 ? 78 : dash.numProdutos >= 1 ? 55 : 25;

    const radarData = [
      { subject: "Vendas",     A: scoreVendas     },
      { subject: "Clientes",   A: scoreClientes   },
      { subject: "Produtos",   A: scoreProdutos   },
      { subject: "Serviços",   A: scoreServicos   },
      { subject: "Financeiro", A: scoreFinanceiro },
      { subject: "Estoque",    A: scoreEstoque    },
    ];

    const pieColors = ["#c8a55e", "#3ecf8e", "#5b8ef0", "#f59e0b", "#e052a0"];
    const produtosPie = (dash.topProdutos || []).slice(0, 5).map((p) => ({
      name: p.nome, value: p.total || p.qtd || 1,
    }));
    // Sem dados reais: mostra aviso em vez de dados fictícios
    const semDados = !dash.loading && faturDia.every(pt => pt.v === 0);
    const semProdutos = !dash.loading && produtosPie.length === 0;

    const Card = ({ children, title, subtitle, style = {}, headerRight }) => (
      <div style={{
        background: "var(--s1)", border: "1px solid var(--border)",
        borderRadius: 14, padding: "20px 20px 16px", ...style,
      }}>
        {(title || subtitle || headerRight) && (
          <div style={{ marginBottom: 16, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
            <div>
              {title && <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", letterSpacing: "0.01em" }}>{title}</div>}
              {subtitle && <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 3 }}>{subtitle}</div>}
            </div>
            {headerRight && <div style={{ flexShrink: 0 }}>{headerRight}</div>}
          </div>
        )}
        {children}
      </div>
    );

    const GoldTooltip = ({ active, payload, label }) => {
      if (!active || !payload?.length) return null;
      return (
        <div style={{
          background: "var(--s2)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          border: "1px solid rgba(200,165,94,0.2)",
          borderRadius: 12,
          padding: "12px 16px",
          fontSize: 12,
          boxShadow: "0 16px 48px rgba(0,0,0,0.2), 0 0 0 1px var(--border) inset",
          minWidth: 155,
          pointerEvents: "none",
          animation: "tooltipIn 0.15s ease",
        }}>
          <style>{`@keyframes tooltipIn { from { opacity:0; transform:translateY(4px) scale(.97); } to { opacity:1; transform:none; } }`}</style>
          {label && (
            <div style={{ color: "var(--text-3)", fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10, borderBottom: "1px solid var(--border)", paddingBottom: 8 }}>
              {label}
            </div>
          )}
          {payload.map((p, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, margin: "4px 0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: p.color || "#c8a55e", boxShadow: `0 0 6px ${(p.color || "#c8a55e") + "88"}`, flexShrink: 0 }} />
                <span style={{ color: "var(--text-2)", fontSize: 11 }}>{p.name}</span>
              </div>
              <span style={{ color: p.color || "var(--gold)", fontWeight: 700, fontSize: 13, fontVariantNumeric: "tabular-nums" }}>
                {typeof p.value === "number"
                  ? `R$ ${p.value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  : p.value}
              </span>
            </div>
          ))}
        </div>
      );
    };

    const EmptyState = ({ msg = "Nenhuma venda no período selecionado" }) => (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, padding: "32px 0", color: "var(--text-3)" }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--s2)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 4 }}>
          <BarChart3 size={18} color="var(--text-3)" />
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-2)" }}>Sem dados</div>
        <div style={{ fontSize: 12, textAlign: "center", maxWidth: 200, lineHeight: 1.5 }}>{msg}</div>
      </div>
    );

    return (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, padding: 4 }}>

        {/* 1. Faturamento vs Despesas — BarChart / 3D */}
        <Card
          title="Faturamento vs Despesas"
          subtitle={`Período: ${period}${period === "Personalizado" && customRange.from && customRange.to ? ` (${customRange.from.split("-").reverse().join("/")} – ${customRange.to.split("-").reverse().join("/")})` : ""}`}
          style={{ gridColumn: "1 / 2" }}
          headerRight={<ChartToggle value={chartsBarMode} onChange={setChartsBarMode} />}
        >
          {semDados ? <EmptyState /> : chartsBarMode === "3d" ? (
            <Chart3DBars
              data={receitaData.map(d => ({ ...d, d: d.mes }))}
              series={[BAR3D_SERIES[0], BAR3D_SERIES[1]]}
              period={period}
              height={240}
            />
          ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={dash.loading ? [] : receitaData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }} barSize={14} barGap={3}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="mes" tick={{ fill: "var(--text-2)", fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fill: "var(--text-2)", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000 ? `R$${(v/1000).toFixed(1)}k` : `R$${v}`} />
              <Tooltip content={<GoldTooltip />} cursor={{ fill: "rgba(200,165,94,0.04)", rx: 6, stroke: "rgba(200,165,94,0.1)", strokeWidth: 1 }} />
              <Legend wrapperStyle={{ fontSize: 11, color: "var(--text-2)", paddingTop: 12 }} />
              <Bar dataKey="receita" name="Receita"  fill="#c8a55e" radius={[5,5,0,0]} opacity={0.9}  activeBar={{ fill: "#e8ca60", opacity: 1, filter: "drop-shadow(0 0 6px rgba(200,165,94,0.6))" }} />
              <Bar dataKey="custo"   name="Despesas" fill="#e05252" radius={[5,5,0,0]} opacity={0.75} activeBar={{ fill: "#f07070", opacity: 1, filter: "drop-shadow(0 0 6px rgba(224,82,82,0.5))" }} />
            </BarChart>
          </ResponsiveContainer>
          )}
        </Card>

        {/* 2. Lucro Líquido — AreaChart */}
        <Card
          title="Evolução do Lucro Líquido"
          subtitle={`Período: ${period} · valores estimados por dia`}
          style={{ gridColumn: "2 / 3" }}
        >
          {semDados ? <EmptyState /> : (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={dash.loading ? [] : lucroData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gLucro" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#3ecf8e" stopOpacity={0.28} />
                  <stop offset="95%" stopColor="#3ecf8e" stopOpacity={0}    />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="mes" tick={{ fill: "var(--text-2)", fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fill: "var(--text-2)", fontSize: 10 }} axisLine={false} tickLine={false}
                tickFormatter={(v) => v >= 1000 ? `R$${(v/1000).toFixed(1)}k` : `R$${v}`} />
              <Tooltip content={<GoldTooltip />} cursor={{ stroke: "rgba(62,207,142,0.2)", strokeWidth: 1, strokeDasharray: "4 3" }} />
              <Area type="monotone" dataKey="lucro" name="Lucro estimado" stroke="#3ecf8e" strokeWidth={2.5} fill="url(#gLucro)"
                dot={{ fill: "#3ecf8e", r: 3, strokeWidth: 0, opacity: 0.7 }}
                activeDot={{ r: 6, fill: "#3ecf8e", stroke: "rgba(62,207,142,0.3)", strokeWidth: 6 }} />
            </AreaChart>
          </ResponsiveContainer>
          )}
        </Card>

        {/* 3. Faturamento por dia (período selecionado) — LineChart / 3D */}
        <Card
          title="Faturamento Diário"
          subtitle={`Período: ${period}`}
          style={{ gridColumn: "1 / 3" }}
          headerRight={<ChartToggle value={faturDiarioMode} onChange={setFaturDiarioMode} />}
        >
          {faturDiarioMode === "3d" ? (
            <Chart3DBars
              data={dash.loading ? [] : dash.faturamentoPorDia}
              period={period}
              height={220}
            />
          ) : (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={dash.loading ? [] : dash.faturamentoPorDia} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gLine" x1="0" y1="1" x2="1" y2="0">
                  <stop offset="0%"   stopColor="#c8a55e" />
                  <stop offset="100%" stopColor="#e8ca60" />
                </linearGradient>
                <filter id="glowGold" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="d" tick={{ fill: "var(--text-2)", fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fill: "var(--text-2)", fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip content={<GoldTooltip />} cursor={{ stroke: "rgba(200,165,94,0.18)", strokeWidth: 1, strokeDasharray: "4 3" }} />
              <Line type="monotone" dataKey="v" name="Receita" stroke="url(#gLine)" strokeWidth={2.5} dot={false}
                activeDot={{ r: 6, fill: "#c8a55e", stroke: "rgba(200,165,94,0.35)", strokeWidth: 7, filter: "url(#glowGold)" }} />
            </LineChart>
          </ResponsiveContainer>
          )}
        </Card>

        {/* 4. Mix de Receita — PieChart / 3D Donut */}
        <Card title="Mix de Receita" subtitle="Distribuição por categoria" headerRight={<ChartToggle value={mixMode} onChange={setMixMode} />}>
          {mixMode === "3d" ? (
            <Chart3DDonut data={dash.mixData || []} height={180} />
          ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <PieChart width={160} height={160}>
              <Pie
                data={dash.loading ? [{ name: "", value: 1 }] : dash.mixData}
                cx={75} cy={75} innerRadius={48} outerRadius={72} dataKey="value" strokeWidth={0}
                paddingAngle={3}
              >
                {(dash.mixData || []).map((_, i) => (
                  <Cell key={i} fill={pieColors[i % pieColors.length]} opacity={dash.loading ? 0.2 : 0.9} />
                ))}
              </Pie>
              <Tooltip content={<GoldTooltip />} />
            </PieChart>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
              {(dash.mixData || []).map((item, i) => (
                <div key={i}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 5 }}>
                    <span style={{ color: "var(--text-2)", display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ width: 8, height: 8, borderRadius: 2, background: pieColors[i % pieColors.length], display: "inline-block" }} />
                      {item.name}
                    </span>
                    <span style={{ color: "var(--text)", fontWeight: 600 }}>{dash.loading ? "—" : `${item.value}%`}</span>
                  </div>
                  <div style={{ background: "var(--s2)", borderRadius: 4, height: 5, overflow: "hidden" }}>
                    <div style={{ width: `${dash.loading ? 0 : item.value}%`, height: "100%", background: pieColors[i % pieColors.length], borderRadius: 4, transition: "width 0.6s ease" }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          )}
        </Card>

        {/* 5. Top Produtos — Horizontal Bars */}
        <Card title="Top Produtos Vendidos" subtitle={`Por receita — ${period}`}>
          {semProdutos ? (
            <EmptyState msg="Nenhum produto vendido no período selecionado" />
          ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 4 }}>
            {produtosPie.map((p, i) => {
              const max = produtosPie[0]?.value || 1;
              const pct = Math.round((p.value / max) * 100);
              return (
                <div key={i}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 5 }}>
                    <span style={{ color: "var(--text-2)", display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{
                        width: 18, height: 18, borderRadius: 5,
                        background: pieColors[i % pieColors.length] + "22",
                        border: `1px solid ${pieColors[i % pieColors.length]}44`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 9, fontWeight: 700, color: pieColors[i % pieColors.length],
                      }}>{i + 1}</span>
                      {p.name}
                    </span>
                    <span style={{ color: pieColors[i % pieColors.length], fontWeight: 600, fontSize: 11 }}>
                      {typeof p.value === "number" && p.value > 100 ? fmtR$(p.value) : `${p.value} un.`}
                    </span>
                  </div>
                  <div style={{ background: "var(--s2)", borderRadius: 4, height: 6, overflow: "hidden" }}>
                    <div style={{
                      width: `${pct}%`, height: "100%",
                      background: `linear-gradient(90deg, ${pieColors[i % pieColors.length]}, ${pieColors[i % pieColors.length]}88)`,
                      borderRadius: 4, transition: "width 0.7s ease",
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
          )}
        </Card>

        {/* 6. Desempenho Geral — RadarChart */}
        <Card title="Radar de Desempenho" subtitle={`Saúde geral — baseado nos dados do período (${period})`} style={{ gridColumn: "1 / 3" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
            <RadarChart outerRadius={110} width={300} height={260} data={radarData}>
              <PolarGrid stroke="var(--border)" />
              <PolarAngleAxis dataKey="subject" tick={{ fill: "var(--text-2)", fontSize: 11 }} />
              <Radar name="Desempenho" dataKey="A" stroke="#c8a55e" fill="#c8a55e" fillOpacity={0.18} strokeWidth={2} />
              <Tooltip content={<GoldTooltip />} />
            </RadarChart>
            <div style={{ flex: 1 }}>
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 13, color: "var(--text-2)", marginBottom: 6 }}>Score Geral</div>
                <div style={{ fontSize: 42, fontWeight: 700, color: "var(--gold)", lineHeight: 1, fontFamily: "'Sora', system-ui, sans-serif" }}>
                  {Math.round(radarData.reduce((s, d) => s + d.A, 0) / radarData.length)}%
                </div>
                <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 6 }}>Meta: 85%</div>
              </div>
              {radarData.map((r) => (
                <div key={r.subject} style={{ marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-2)", marginBottom: 4 }}>
                    <span>{r.subject}</span><span style={{ color: r.A >= 80 ? "var(--green)" : r.A >= 65 ? "var(--gold)" : "var(--red)" }}>{r.A}%</span>
                  </div>
                  <div style={{ background: "var(--s3)", borderRadius: 3, height: 4 }}>
                    <div style={{
                      width: `${r.A}%`, height: "100%", borderRadius: 3,
                      background: r.A >= 80 ? "var(--green)" : r.A >= 65 ? "var(--gold)" : "var(--red)",
                      transition: "width 0.6s ease",
                    }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* 7. Crescimento de Cadastros de Clientes — AreaChart */}
        {(() => {
          const now = new Date();
          const meses = [];
          for (let i = 11; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const key = `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getFullYear()).slice(-2)}`;
            meses.push({ mes: key, novos: 0 });
          }
          clientesCadastro.forEach(({ criadoEm }) => {
            if (!criadoEm) return;
            try {
              const d = new Date(criadoEm);
              const key = `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getFullYear()).slice(-2)}`;
              const entry = meses.find(m => m.mes === key);
              if (entry) entry.novos++;
            } catch {}
          });
          let acumulado = 0;
          const dadosCadastro = meses.map(m => {
            acumulado += m.novos;
            return { mes: m.mes, novos: m.novos, total: acumulado };
          });
          const totalNovos12m = dadosCadastro.reduce((s, d) => s + d.novos, 0);
          const mesComMaisNovos = dadosCadastro.reduce((best, d) => d.novos > best.novos ? d : best, dadosCadastro[0] || { mes: "—", novos: 0 });
          return (
            <Card
              title="Crescimento de Cadastros"
              subtitle="Novos clientes e base total — últimos 12 meses"
              style={{ gridColumn: "1 / 3" }}
            >
              <div style={{ display: "flex", gap: 24, marginBottom: 18, flexWrap: "wrap" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--text-2)" }}>Novos (12 meses)</span>
                  <span style={{ fontSize: 28, fontWeight: 700, color: "var(--blue)", fontFamily: "'Sora', system-ui, sans-serif", lineHeight: 1 }}>{totalNovos12m}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--text-2)" }}>Base total</span>
                  <span style={{ fontSize: 28, fontWeight: 700, color: "var(--gold)", fontFamily: "'Sora', system-ui, sans-serif", lineHeight: 1 }}>{dash.numClientes}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--text-2)" }}>Melhor mês</span>
                  <span style={{ fontSize: 18, fontWeight: 700, color: "var(--green)", fontFamily: "'Sora', system-ui, sans-serif", lineHeight: 1 }}>{mesComMaisNovos.mes} <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-2)" }}>({mesComMaisNovos.novos} cadastros)</span></span>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={210}>
                <AreaChart data={dadosCadastro} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gCadastroNovos" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#5b8ef0" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#5b8ef0" stopOpacity={0}   />
                    </linearGradient>
                    <linearGradient id="gCadastroTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#c8a55e" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#c8a55e" stopOpacity={0}   />
                    </linearGradient>
                    <filter id="glowBlue" x="-50%" y="-50%" width="200%" height="200%">
                      <feGaussianBlur stdDeviation="3" result="blur" />
                      <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                    </filter>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="mes" tick={{ fill: "var(--text-2)", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "var(--text-2)", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<GoldTooltip />} cursor={{ stroke: "rgba(91,142,240,0.2)", strokeWidth: 1, strokeDasharray: "4 3" }} />
                  <Legend wrapperStyle={{ fontSize: 11, color: "var(--text-2)", paddingTop: 12 }} />
                  <Area type="monotone" dataKey="total" name="Base Total" stroke="#c8a55e" strokeWidth={1.5} fill="url(#gCadastroTotal)"
                    dot={false} activeDot={{ r: 5, fill: "#c8a55e", stroke: "rgba(200,165,94,0.3)", strokeWidth: 5 }} />
                  <Area type="monotone" dataKey="novos" name="Novos Clientes" stroke="#5b8ef0" strokeWidth={2.5} fill="url(#gCadastroNovos)"
                    dot={{ fill: "#5b8ef0", r: 3, strokeWidth: 0 }}
                    activeDot={{ r: 6, fill: "#5b8ef0", stroke: "rgba(91,142,240,0.35)", strokeWidth: 6, filter: "url(#glowBlue)" }} />
                </AreaChart>
              </ResponsiveContainer>
            </Card>
          );
        })()}

      </div>
    );
  };
  return (
    <>
      <style>{CSS}</style>

      {saudacaoVisivel && userName !== "Usuário" && (
        <SaudacaoCard
          nome={userName}
          onClose={() => {
            setSaudacaoVisivel(false);
            sessionStorage.setItem("ag_saudacao_shown", "true");
          }}
        />
      )}

      <div className={`ag-app${theme === "light" ? " light" : ""}`}>

        {/* ── HEADER GLOBAL ── */}
        <header className="ag-global-header">
          <button
            className="ag-toggle-btn"
            onClick={toggleSidebar}
            title={collapsed ? "Expandir menu" : "Recolher menu"}
            aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
            style={sistemaAtivo === "crm" || sistemaAtivo === "flow" ? { display: "none" } : {}}
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
            {planTagEl}
          </div>

          <div className="ag-header-spacer" />

          <div style={{ position: "relative" }} ref={notifRef}>
            <div
              className="ag-notif"
              title="Notificações"
              onClick={abrirNotif}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && abrirNotif()}
            >
              <Bell size={15} />
              {notifNaoLidas > 0 && (
                <span className="ag-notif-badge">{notifNaoLidas > 9 ? "9+" : notifNaoLidas}</span>
              )}
            </div>

            {notifOpen && (
              <div className="ag-notif-panel">
                <div className="ag-notif-header">
                  <span>Notificações</span>
                  <span style={{ color: "var(--text-3)", fontWeight: 400, letterSpacing: 0, textTransform: "none", fontSize: 11 }}>
                    {todasNotif.length} mensage{todasNotif.length !== 1 ? "ns" : "m"}
                  </span>
                </div>
                <div className="ag-notif-list">
                  {todasNotif.length === 0 ? (
                    <div className="ag-notif-empty">Nenhuma notificação no momento</div>
                  ) : (
                    todasNotif.map((n) => {

                      /* helper: tempo relativo */
                      const tempoRel = (ts) => {
                        const d = ts?.toDate ? ts.toDate() : null;
                        if (!d) return "—";
                        const diff = Date.now() - d.getTime();
                        const m = Math.floor(diff / 60000);
                        const h = Math.floor(diff / 3600000);
                        const dy = Math.floor(diff / 86400000);
                        if (dy >= 1) return `há ${dy} dia${dy > 1 ? "s" : ""}`;
                        if (h  >= 1) return `há ${h}h`;
                        if (m  >= 1) return `há ${m} min`;
                        return "agora";
                      };

                      /* ── Insight ── */
                      if (n.tipo === "insight") {
                        const PALETTE = {
                          faturamento_alta: "cyan", produto_destaque: "cyan",
                          ticket_alta: "cyan",      matriculas_alta: "blue",
                          faturamento_queda: "mag",  ticket_queda: "amber",
                          cancelamentos_alerta: "mag", matriculas_queda: "amber",
                          matriculas_zero: "amber",
                        };
                        const tone = PALETTE[n.subtipo] || "blue";
                        return (
                          <div key={n.id} className={`holo ${tone}`}>
                            <div className="holo-card">
                              <div className="holo-row-top">
                                <div className="holo-icon">
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v4.5l2.5 1.5"/></svg>
                                </div>
                                <span className="holo-categoria">Sistema · IA Insight</span>
                                {n.prioridade === "high" && <span className="holo-urgencia">atenção</span>}
                              </div>
                              <div className="holo-title">{n.titulo}</div>
                              <div className="holo-msg">{n.mensagem}</div>
                              <div className="holo-meta">
                                <span className="holo-meta-dot" />
                                <span>{tempoRel(n.criadoEm)}</span>
                              </div>
                            </div>
                            <div className="holo-beam" />
                            <div className="holo-base" />
                          </div>
                        );
                      }

                      /* ── Despesa ── */
                      if (n.tipo === "despesa") {
                        const tone = n.diffDias === 0 ? "mag" : n.diffDias === 1 ? "amber" : "blue";
                        const labelUrg = n.diffDias === 0 ? "Vence hoje" : n.diffDias === 1 ? "Amanhã" : `${n.diffDias} dias`;
                        const idShow = n.titulo?.split("—")[1]?.trim() || "";
                        const tsObj = n._ts ? { toDate: () => new Date(n._ts) } : null;
                        return (
                          <div key={n.id} className={`holo ${tone}`} style={{ cursor: "pointer" }}
                            onClick={() => { setModule("Despesas"); setNotifOpen(false); }}>
                            <div className="holo-card">
                              <div className="holo-row-top">
                                <div className="holo-icon">
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                                </div>
                                <span className="holo-categoria">Atenção · Despesa</span>
                                <span className="holo-urgencia">{labelUrg}</span>
                              </div>
                              <div className="holo-title">{n.mensagem}</div>
                              <div className="holo-msg">{idShow && `${idShow} · `}<span style={{ opacity: .7 }}>Ir para Despesas →</span></div>
                              <div className="holo-meta">
                                <span className="holo-meta-dot" />
                                <span>{tempoRel(tsObj)}</span>
                              </div>
                            </div>
                            <div className="holo-beam" />
                            <div className="holo-base" />
                          </div>
                        );
                      }

                      /* ── A Receber ── */
                      if (n.tipo === "a_receber") {
                        const tone = n.diffDias === 0 ? "cyan" : "amber";
                        const labelUrg = n.diffDias === 0 ? "Vence hoje" : "Amanhã";
                        const tsObj = n._ts ? { toDate: () => new Date(n._ts) } : null;
                        return (
                          <div key={n.id} className={`holo ${tone}`} style={{ cursor: "pointer" }}
                            onClick={() => { setModule("A Receber"); setNotifOpen(false); }}>
                            <div className="holo-card">
                              <div className="holo-row-top">
                                <div className="holo-icon">
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                                </div>
                                <span className="holo-categoria">Financeiro · A Receber</span>
                                <span className="holo-urgencia">{labelUrg}</span>
                              </div>
                              <div className="holo-title">{n.clienteNome}</div>
                              <div className="holo-msg">{n.valor} · <span style={{ opacity: .7 }}>Ir para A Receber →</span></div>
                              <div className="holo-meta">
                                <span className="holo-meta-dot" />
                                <span>{tempoRel(tsObj)}</span>
                              </div>
                            </div>
                            <div className="holo-beam" />
                            <div className="holo-base" />
                          </div>
                        );
                      }

                      /* ── Nova reserva AssFlow ── */
                      if (n.tipo === "nova_reserva") {
                        return (
                          <div key={n.id} className="holo gold" style={{ cursor: "pointer" }}
                            onClick={() => { marcarReservaLida(n.id); setFlowInitialTab("reservas"); setSistemaAtivo("flow"); setNotifOpen(false); }}>
                            <div className="holo-card">
                              <div className="holo-row-top">
                                <div className="holo-icon">
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                                </div>
                                <span className="holo-categoria">Flow · Nova Reserva</span>
                              </div>
                              <div className="holo-title">{n.payload?.cliente || "Nova reserva"}</div>
                              <div className="holo-msg">
                                {n.payload?.servico}{n.payload?.data ? ` · ${n.payload.data}` : ""}{n.payload?.hora ? ` às ${n.payload.hora}` : ""}<br/>
                                <span style={{ opacity: .7 }}>Ir para Reservas →</span>
                              </div>
                              <div className="holo-meta">
                                <span className="holo-meta-dot" />
                                <span>{tempoRel(n.criadoEm)}</span>
                              </div>
                            </div>
                            <div className="holo-beam" />
                            <div className="holo-base" />
                          </div>
                        );
                      }

                      /* ── Sistema / default ── */
                      return (
                        <div key={n.id} className="holo gold">
                          <div className="holo-card">
                            <div className="holo-row-top">
                              <div className="holo-icon">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                              </div>
                              <span className="holo-categoria">Sistema</span>
                              <span className="ag-notif-item-meta" style={{ marginLeft: "auto" }}>
                                {n.criadoEm?.toDate ? n.criadoEm.toDate().toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "—"}
                              </span>
                            </div>
                            <div className="holo-title">{n.titulo}</div>
                            <div className="holo-msg">{n.mensagem}</div>
                            {n.btnUrl && (
                              <a href={n.btnUrl} target="_blank" rel="noopener noreferrer" className="ag-notif-cta" style={{ marginTop: 10 }}>
                                {n.btnTexto || "Ver mais"}
                                <span className="ag-notif-cta-arrow" aria-hidden="true">↗</span>
                              </a>
                            )}
                            <div className="holo-meta">
                              <span className="holo-meta-dot" />
                              <span>{tempoRel(n.criadoEm)}</span>
                            </div>
                          </div>
                          <div className="holo-beam" />
                          <div className="holo-base" />
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

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
              <div className="ag-avatar">
                {userAvatar
                  ? <img src={userAvatar} alt={userName} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                  : userInitial}
              </div>
              <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.3 }}>
                <span className="ag-user-name">{userName}</span>
                {cargo && cargo !== "admin" && (
                  <span style={{
                    fontSize: 10,
                    color: "var(--text-3)",
                    textTransform: "capitalize",
                    letterSpacing: "0.02em",
                  }}>
                    {cargo}
                  </span>
                )}
              </div>
              <ChevronDown size={13} className={`ag-user-chevron ${dropdownOpen ? "open" : ""}`} />
            </div>

            {dropdownOpen && (
              <div className="ag-user-dropdown" role="menu">

                {/* ── Sistemas ── */}
                <div style={{
                  padding: "5px 12px 3px",
                  fontSize: 9, fontWeight: 700,
                  letterSpacing: "0.10em", textTransform: "uppercase",
                  color: "var(--text-3)",
                }}>
                  Sistemas
                </div>

                {/* ── Assent Gestão ── */}
                <button
                  className="ag-dropdown-item"
                  onClick={() => { setSistemaAtivo("gestao"); setDropdownOpen(false); }}
                  style={{
                    display: "flex", alignItems: "center", gap: 8,
                    background: sistemaAtivo === "gestao" ? "var(--gold-d)" : "transparent",
                    color: sistemaAtivo === "gestao" ? "var(--gold)" : "var(--text-2)",
                  }}
                >
                  <img
                    src="/logo.png"
                    alt="Assent Gestão"
                    style={{ width: 20, height: 20, borderRadius: 5, objectFit: "cover", flexShrink: 0 }}
                    onError={(e) => { e.target.style.display = "none"; }}
                  />
                  <span style={{ flex: 1 }}>Assent Gestão</span>
                  {sistemaAtivo === "gestao" && (
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--gold)", flexShrink: 0 }} />
                  )}
                </button>

                {/* ── Assent CRM ── */}
                <button
                  className="ag-dropdown-item"
                  onClick={() => { setSistemaAtivo("crm"); setDropdownOpen(false); }}
                  style={{
                    display: "flex", alignItems: "center", gap: 8,
                    background: sistemaAtivo === "crm" ? "var(--gold-d)" : "transparent",
                    color: sistemaAtivo === "crm" ? "var(--gold)" : "var(--text-2)",
                  }}
                >
                  <img
                    src="/crm_logo.png"
                    alt="Assent CRM"
                    style={{ width: 20, height: 20, borderRadius: 5, objectFit: "cover", flexShrink: 0 }}
                    onError={(e) => { e.target.style.display = "none"; }}
                  />
                  <span style={{ flex: 1 }}>Assent CRM</span>
                  {sistemaAtivo === "crm" ? (
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--gold)", flexShrink: 0 }} />
                  ) : (
                    <span style={{
                      fontSize: 8, fontWeight: 700, padding: "1px 5px", borderRadius: 999,
                      background: "rgba(200,165,94,0.15)", color: "var(--gold)",
                      border: "1px solid rgba(200,165,94,0.28)",
                      letterSpacing: "0.08em", textTransform: "uppercase", flexShrink: 0,
                    }}>NOVO</span>
                  )}
                </button>

                {/* ── Assent Flow — essencial, profissional e delux ── */}
                {(licencaSlug === "essencial" || licencaSlug === "profissional" || licencaSlug === "delux") && (
                  <button
                    className="ag-dropdown-item"
                    onClick={() => { setSistemaAtivo("flow"); setDropdownOpen(false); }}
                    style={{
                      display: "flex", alignItems: "center", gap: 8,
                      background: sistemaAtivo === "flow" ? "var(--gold-d)" : "transparent",
                      color: sistemaAtivo === "flow" ? "var(--gold)" : "var(--text-2)",
                    }}
                  >
                    <img
                      src="/flow.png"
                      alt="Assent Flow"
                      style={{ width: 20, height: 20, borderRadius: 5, objectFit: "cover", flexShrink: 0 }}
                      onError={(e) => { e.target.style.display = "none"; }}
                    />
                    <span style={{ flex: 1 }}>Assent Flow</span>
                    {sistemaAtivo === "flow" ? (
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--gold)", flexShrink: 0 }} />
                    ) : (
                      <span style={{
                        fontSize: 8, fontWeight: 700, padding: "1px 5px", borderRadius: 999,
                        background: "rgba(200,165,94,0.15)", color: "var(--gold)",
                        border: "1px solid rgba(200,165,94,0.28)",
                        letterSpacing: "0.08em", textTransform: "uppercase", flexShrink: 0,
                      }}>NOVO</span>
                    )}
                  </button>
                )}

                <div className="ag-dropdown-divider" />

                <button
                  className="ag-dropdown-item"
                  onClick={() => { setSistemaAtivo("gestao"); setModule("Configurações"); setDropdownOpen(false); }}
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

          {/* Sidebar desktop recolhível — oculta no Assent CRM */}
          <aside className={`ag-sidebar ${collapsed ? "collapsed" : ""}`} style={sistemaAtivo === "crm" || sistemaAtivo === "flow" ? { display: "none" } : {}}>
            <nav className="ag-nav">
              {NAV.map((sec) => (
                <div key={sec.section}>
                  <div className="ag-sec-label">{sec.section}</div>
                  {sec.items.map((item) => {
                    const dbKey = KEY_MAP[item.label];
                    if (dbKey && menuVisivel[dbKey] === false) return null;
                    if (item.modulo && !podeVer(item.modulo)) return null;
                    return (
                      <div
                        key={item.label}
                        className={`ag-nav-item ${module === item.label ? "active" : ""}`}
                        onClick={() => setModule(item.label)}
                        data-label={item.label}
                        title={collapsed ? item.label : undefined}
                      >
                        <item.icone size={15} />
                        <span>{item.label}</span>
                      </div>
                    );
                  })}
                </div>
              ))}
            </nav>
          </aside>

          {/* Conteúdo principal */}
          <main className="ag-main" style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, overflow: "hidden" }}>
            {sistemaAtivo === "crm" ? (
              <CRMModule
                tenantUid={tenantUid}
                nomeEmpresa={nomeEmpresa}
                onVoltar={() => setSistemaAtivo("gestao")}
                theme={theme}
                onToggleTheme={toggleTheme}
              />
            ) : sistemaAtivo === "flow" ? (
              <AssFlow
                tenantUid={tenantUid}
                nomeEmpresa={nomeEmpresa}
                plano={licencaSlug}
                onVoltar={() => setSistemaAtivo("gestao")}
                theme={theme}
                onToggleTheme={toggleTheme}
                initialTab={flowInitialTab}
                onTabChange={setFlowInitialTab}
              />
            ) : (
              renderModulo()
            )}
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
              <item.icone size={20} />
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
                  {planTagEl}
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
                      if (item.modulo && !podeVer(item.modulo)) return null;
                      return (
                        <div
                          key={item.label}
                          className={`ag-nav-item ${module === item.label ? "active" : ""}`}
                          onClick={() => navigateTo(item.label)}
                          data-label={item.label}
                        >
                          <item.icone size={15} />
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

      {/* ── MODAL DE ANÚNCIO ── */}
      {anuncioModal && (
        <div
          onClick={fecharAnuncioModal}
          style={{
            position: "fixed", inset: 0, zIndex: 9999,
            background: "rgba(0,0,0,0.78)", backdropFilter: "blur(10px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "24px 16px", animation: "ag-anuncio-fadein .25s ease",
          }}
        >
          <style>{`
            @keyframes ag-anuncio-fadein {
              from { opacity: 0; }
              to   { opacity: 1; }
            }
            @keyframes ag-anuncio-slidein {
              from { opacity: 0; transform: translateY(24px) scale(.97); }
              to   { opacity: 1; transform: translateY(0) scale(1); }
            }
          `}</style>
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: "var(--s1)", border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 20, width: "100%", maxWidth: 420,
              overflow: "hidden", position: "relative",
              boxShadow: "0 32px 80px rgba(0,0,0,0.6)",
              animation: "ag-anuncio-slidein .28s cubic-bezier(0.4,0,0.2,1)",
            }}
          >
            {/* Linha dourada topo */}
            <div style={{
              position: "absolute", top: 0, left: 0, right: 0, height: 2,
              background: "linear-gradient(90deg, transparent, var(--gold), transparent)",
            }} />

            {/* Botão fechar */}
            <button
              onClick={fecharAnuncioModal}
              style={{
                position: "absolute", top: 12, right: 12, zIndex: 2,
                width: 30, height: 30, borderRadius: "50%",
                background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.12)",
                color: "rgba(255,255,255,0.7)", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 14, lineHeight: 1, transition: "background .15s",
              }}
              onMouseOver={e => e.currentTarget.style.background = "rgba(0,0,0,0.65)"}
              onMouseOut={e => e.currentTarget.style.background = "rgba(0,0,0,0.4)"}
            >✕</button>

            {/* Mídia: imagem ou vídeo */}
            {anuncioModal.mediaType === "video" && anuncioModal.videoUrl ? (
              <div style={{ width: "100%", maxHeight: 220, overflow: "hidden", background: "#000" }}>
                {/youtube\.com|youtu\.be/.test(anuncioModal.videoUrl) ? (() => {
                  const ytMatch = anuncioModal.videoUrl.match(
                    /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/
                  );
                  const embedUrl = ytMatch
                    ? `https://www.youtube.com/embed/${ytMatch[1]}?autoplay=1&mute=1&loop=1&playlist=${ytMatch[1]}`
                    : anuncioModal.videoUrl;
                  return (
                    <iframe
                      src={embedUrl}
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      style={{ width: "100%", height: 220, display: "block", border: "none" }}
                      title="Anúncio"
                    />
                  );
                })() : (
                  <video
                    src={anuncioModal.videoUrl}
                    autoPlay muted loop playsInline
                    style={{ width: "100%", maxHeight: 220, objectFit: "cover", display: "block" }}
                  />
                )}
              </div>
            ) : anuncioModal.imageUrl ? (
              <div style={{ width: "100%", height: 220, overflow: "hidden", background: "var(--s2)" }}>
                <img
                  src={anuncioModal.imageUrl}
                  alt=""
                  style={{
                    width: "100%", height: "100%", objectFit: "cover", display: "block",
                    objectPosition: `${anuncioModal.imgPosX ?? 50}% ${anuncioModal.imgPosY ?? 50}%`,
                    transform: anuncioModal.imgZoom > 100 ? `scale(${anuncioModal.imgZoom / 100})` : undefined,
                    transformOrigin: `${anuncioModal.imgPosX ?? 50}% ${anuncioModal.imgPosY ?? 50}%`,
                  }}
                />
              </div>
            ) : null}

            {/* Conteúdo */}
            <div style={{ padding: "24px 22px 22px" }}>
              <div style={{
                fontSize: 17, fontWeight: 700, color: "var(--text)",
                lineHeight: 1.3, marginBottom: 10,
              }}>
                {anuncioModal.titulo}
              </div>
              <div style={{
                fontSize: 13, color: "var(--text-2)",
                lineHeight: 1.6, marginBottom: anuncioModal.btnTexto ? 20 : 0,
              }}>
                {anuncioModal.mensagem}
              </div>

              {/* Botão CTA */}
              {anuncioModal.btnTexto && (
                <a
                  href={anuncioModal.btnUrl || "#"}
                  target={anuncioModal.btnUrl ? "_blank" : undefined}
                  rel="noopener noreferrer"
                  onClick={fecharAnuncioModal}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    width: "100%", padding: "13px 20px",
                    background: "linear-gradient(135deg, #B8860B 0%, #D4AF37 60%, #F0D060 100%)",
                    border: "none", borderRadius: 10,
                    color: "#0a0808", fontFamily: "'Sora', system-ui, sans-serif",
                    fontSize: 13, fontWeight: 700, letterSpacing: "0.08em",
                    cursor: "pointer", textDecoration: "none", textTransform: "uppercase",
                    boxShadow: "0 4px 20px rgba(212,175,55,0.35)",
                    transition: "opacity .2s, transform .1s",
                  }}
                  onMouseOver={e => { e.currentTarget.style.opacity = ".88"; e.currentTarget.style.transform = "translateY(-1px)"; }}
                  onMouseOut={e => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.transform = "translateY(0)"; }}
                >
                  {anuncioModal.btnTexto}
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12,5 19,12 12,19"/></svg>
                </a>
              )}
            </div>
          </div>
        </div>
      )}

    </>
  );
}
