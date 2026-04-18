import { useState, useEffect } from "react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell
} from "recharts";
import {
  LayoutDashboard, Users, Package, Wrench, ArrowDownToLine,
  ShoppingCart, Clock, Wallet, TrendingDown, Truck, BarChart3,
  Calendar, Settings, Zap, UserCheck, Search, ArrowUpRight,
  ArrowDownRight, ChevronRight, Bell
} from "lucide-react";

/* ── Módulos ── */
import Clientes from "./modules/Clientes.jsx";
import Produtos from "./modules/Produtos.jsx";
import Servicos from "./modules/Servicos.jsx";
import Vendedores from "./modules/Vendedores.jsx";
import Vendas    from "./modules/Vendas.jsx";
import Configuracoes from "./modules/Configuracoes.jsx";
import Despesas from "./modules/Despesas.jsx";
import EntradaEstoque from "./modules/EntradaEstoque.jsx";
import Agenda from "./modules/Agenda/Agenda.jsx";
import Fornecedores from "./modules/Fornecedores.jsx";
import AReceber from "./modules/AReceber.jsx";
import Relatorios from "./components/Relatorios.jsx";
import CaixaDiario from "./modules/CaixaDiario.jsx";

/* ── Firebase (Adicionado para o filtro) ── */
import { db, auth } from "./lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";

/* ─── Mock Data ─────────────────────────────────────── */
const faturamentoData = [
  { d: "01/4", v: 420 }, { d: "02/4", v: 380 }, { d: "03/4", v: 650 },
  { d: "04/4", v: 290 }, { d: "05/4", v: 710 }, { d: "06/4", v: 480 },
  { d: "07/4", v: 320 }, { d: "08/4", v: 590 }, { d: "09/4", v: 480 },
  { d: "10/4", v: 820 }, { d: "11/4", v: 340 }, { d: "12/4", v: 960 },
  { d: "13/4", v: 430 }, { d: "14/4", v: 480 },
];

const mixData = [
  { name: "Produtos", value: 68 },
  { name: "Serviços", value: 32 },
];

const ultimasVendas = [
  { id: "V0030", cliente: "Cláudia Gonçalves",              data: "14/05/2026", total: "R$ 480,88" },
  { id: "V0021", cliente: "Lohanna Leticia de O. Damasceno", data: "30/03/2026", total: "R$ 397,08" },
  { id: "V0020", cliente: "Wik",                             data: "09/03/2026", total: "R$ 1.000,00" },
];

const PERIODS = ["Hoje", "7 dias", "30 dias", "Este mês", "Todos", "Personalizado"];

// Mapeamento de chaves para bater com o Configuracoes.jsx
const KEY_MAP = {
  "Dashboard": "dashboard",
  "Clientes": "clientes",
  "Produtos": "produtos",
  "Serviços": "servicos",
  "Entrada de Estoque": "entrada_estoque",
  "Vendas": "vendas",
  "Fiado / A Receber": "fiado",
  "Caixa Diário": "caixa",
  "Despesas": "despesas",
  "Fornecedores": "fornecedores",
  "Relatórios": "relatorios",
  "Agenda": "agenda",
  "Orçamentos": "orcamentos",
  "Vendedores": "vendedores",
  "Configurações": "config"
};

/* ── Atalhos de teclado: Alt + tecla → módulo ──
   code: event.code  |  label: valor que setModule espera
   dbKey: chave em menuVisivel para checar visibilidade      */
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
/* Módulos sempre visíveis (locked: true no Configuracoes) */
const LOCKED_KEYS = new Set(["dashboard", "config"]);
/* Lookup rápido: code → atalho */
const ATALHO_LOOKUP = Object.fromEntries(ATALHOS_TECLADO.map(a => [a.code, a]));

const NAV = [
  { section: "BÁSICO", items: [
    { icon: LayoutDashboard, label: "Dashboard" },
    { icon: Users,           label: "Clientes" },
    { icon: Package,         label: "Produtos" },
    { icon: Wrench,          label: "Serviços" },
  ]},
  { section: "OPERAÇÕES", items: [
    { icon: ArrowDownToLine, label: "Entrada de Estoque" },
    { icon: ShoppingCart,    label: "Vendas" },
    { icon: Clock,           label: "A Receber" },
    { icon: Wallet,          label: "Caixa Diário" },
    { icon: TrendingDown,    label: "Despesas" },
    { icon: Truck,           label: "Fornecedores" },
  ]},
  { section: "ANÁLISE", items: [
    { icon: BarChart3,  label: "Relatórios" },
    { icon: Calendar,   label: "Agenda" },
  ]},
  { section: "SISTEMA", items: [
    { icon: Zap,        label: "Orçamentos" },
    { icon: UserCheck,  label: "Vendedores" },
    { icon: Settings,   label: "Configurações" },
  ]},
];

/* ─── CSS base (sempre ativo) ──────────────────────── */
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&family=Sora:wght@300;400;500;600;700&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;1,9..40,300&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  html, body, #root { height: 100%; width: 100%; margin: 0; padding: 0; }

  :root {
    --bg:         #09090c;
    --s1:         #0f0f13;
    --s2:         #141419;
    --s3:         #1a1a22;
    --border:     rgba(255,255,255,0.07);
    --border-h:   rgba(255,255,255,0.13);
    --gold:       #c8a55e;
    --gold-l:     #dfc07c;
    --gold-d:     rgba(200,165,94,0.12);
    --gold-brand: #D4AF37;
    --text:       #edeae3;
    --text-2:     #a09caa;
    --text-3:     #6a6775;
    --green:      #3ecf8e;
    --green-d:    rgba(62,207,142,0.1);
    --red:        #e05252;
    --red-d:      rgba(224,82,82,0.1);
    --blue:       #5b8ef0;
    --blue-d:     rgba(91,142,240,0.1);
    --purple:     #a78bfa;
    --purple-d:   rgba(167,139,250,0.1);
    --amber:      #f59e0b;
    --amber-d:    rgba(245,158,11,0.1);
    font-family: 'DM Sans', sans-serif;
    --font-display: 'Playfair Display', serif;
    color-scheme: dark;
  }

  .ag-wrap   { display:flex; height:100vh; background:var(--bg); color:var(--text); overflow:hidden; }

  .ag-sidebar {
    width: 220px; flex-shrink:0;
    background: var(--s1);
    border-right: 1px solid var(--border);
    display:flex; flex-direction:column;
    overflow:hidden;
  }
  .ag-logo {
    padding: 18px 16px;
    border-bottom: 1px solid var(--border);
    display:flex; align-items:center; gap:10px;
  }
  .ag-logo-icon {
    width:34px; height:34px; border-radius:9px;
    background: linear-gradient(135deg, #b8952e, #e0c060);
    display:flex; align-items:center; justify-content:center;
    font-family:'Sora',sans-serif; font-weight:700; font-size:16px;
    color:#0a0808; flex-shrink:0; letter-spacing:-0.5px;
  }
  .ag-logo-text { line-height:1.2; }
  .ag-logo-name { font-size:13px; font-weight:600; color:var(--text); }
  .ag-logo-ver  { font-size:10px; color:var(--text-3); letter-spacing:.05em; margin-top:1px; }

  .ag-nav { flex:1; overflow-y:auto; padding:10px 0 6px; }
  .ag-nav::-webkit-scrollbar { width:3px; }
  .ag-nav::-webkit-scrollbar-thumb { background:var(--text-3); border-radius:2px; }

  .ag-sec-label {
    font-size:9px; font-weight:600; letter-spacing:.1em;
    color:var(--text-3); padding:10px 18px 5px;
    text-transform:uppercase;
  }
  .ag-nav-item {
    display:flex; align-items:center; gap:9px;
    padding: 7px 16px 7px 18px;
    margin: 1px 8px 1px 0;
    border-left: 2px solid transparent;
    border-radius: 0 7px 7px 0;
    cursor:pointer; font-size:13px;
    color:var(--text-2);
    transition: background .12s, color .12s, border-color .12s;
    white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
  }
  .ag-nav-item:hover   { background:rgba(255,255,255,0.03); color:var(--text); }
  .ag-nav-item.active  { background:var(--gold-d); color:var(--gold); border-left-color:var(--gold); }
  .ag-nav-item.active svg { color:var(--gold); }

  .ag-user {
    padding:12px 14px;
    border-top:1px solid var(--border);
    display:flex; align-items:center; gap:10px;
  }
  .ag-avatar {
    width:32px; height:32px; border-radius:50%; flex-shrink:0;
    background:var(--s3);
    border:1px solid var(--border-h);
    display:flex; align-items:center; justify-content:center;
    font-size:12px; font-weight:600; color:var(--gold);
    font-family:'Sora',sans-serif;
  }
  .ag-user-info { flex:1; min-width:0; }
  .ag-user-name { font-size:12px; font-weight:500; color:var(--text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .ag-plan-badge {
    display:inline-block; margin-top:3px;
    font-size:9px; font-weight:600; letter-spacing:.06em;
    color:var(--gold); background:var(--gold-d);
    border:1px solid rgba(200,165,94,.25);
    padding:1px 7px; border-radius:20px;
    text-transform:uppercase;
  }

  /* ── Main ── */
  .ag-main { flex:1; display:flex; flex-direction:column; overflow:hidden; }

  .ag-topbar {
    padding: 14px 22px;
    background:var(--s1);
    border-bottom:1px solid var(--border);
    display:flex; align-items:center; gap:14px;
    flex-shrink:0;
  }
  .ag-topbar-title { flex:1; text-align: center; }
  .ag-topbar-title h1 {
    font-family: var(--font-display); font-size:20px; font-weight:600;
    color: var(--gold-brand);
    line-height:1.2;
    letter-spacing: 0.01em;
  }
  .ag-topbar-title p { font-size:11px; color:var(--text-2); margin-top:2px; }

  .ag-search {
    display:flex; align-items:center; gap:8px;
    background:var(--s2); border:1px solid var(--border);
    border-radius:8px; padding:7px 11px; width:210px;
    transition:border-color .15s;
  }
  .ag-search:focus-within { border-color:var(--border-h); }
  .ag-search input {
    background:transparent; border:none; outline:none;
    color:var(--text); font-size:12px; width:100%;
    font-family:'DM Sans',sans-serif;
  }
  .ag-search input::placeholder { color:var(--text-3); }

  .ag-periods { display:flex; gap:3px; }
  .ag-period-btn {
    padding:5px 13px; border-radius:20px; font-size:12px;
    cursor:pointer; border:1px solid transparent;
    background:transparent; color:var(--text-2);
    font-family:'DM Sans',sans-serif;
    transition:all .13s;
  }
  .ag-period-btn:hover  { background:var(--s2); color:var(--text); }
  .ag-period-btn.active {
    background:var(--gold-d);
    border-color:rgba(200,165,94,.3);
    color:var(--gold);
  }

  .ag-notif {
    width:34px; height:34px; border-radius:8px;
    background:var(--s2); border:1px solid var(--border);
    display:flex; align-items:center; justify-content:center;
    cursor:pointer; transition:border-color .15s;
  }
  .ag-notif:hover { border-color:var(--border-h); }

  /* ── Content ── */
  .ag-content { flex:1; overflow-y:auto; padding:20px 22px 32px; }
  .ag-content::-webkit-scrollbar { width:4px; }
  .ag-content::-webkit-scrollbar-thumb { background:var(--text-3); border-radius:2px; }

  /* ── Cards ── */
  .ag-card {
    background:var(--s1); border:1px solid var(--border);
    border-radius:12px; padding:18px;
    transition:border-color .18s, transform .18s;
  }
  .ag-card:hover { border-color:var(--border-h); }

  .ag-card-bare { background:var(--s1); border:1px solid var(--border); border-radius:12px; overflow:hidden; }
  .ag-card-bare:hover { border-color:var(--border-h); }

  .ag-card-header {
    padding:14px 16px;
    border-bottom:1px solid var(--border);
    display:flex; align-items:center; justify-content:space-between;
  }
  .ag-card-title { font-size:13px; font-weight:500; color:var(--text); }

  .ag-view-all {
    font-size:11px; color:var(--gold);
    background:transparent; border:none; cursor:pointer;
    font-family:'DM Sans',sans-serif;
    display:flex; align-items:center; gap:3px;
    transition:opacity .13s;
  }
  .ag-view-all:hover { opacity:.75; }

  .g4 { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-bottom:14px; }
  .g3 { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; margin-bottom:14px; }
  .g21 { display:grid; grid-template-columns:2fr 1fr; gap:12px; margin-bottom:14px; }
  .g11 { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:14px; }
  .g1  { margin-bottom:14px; }

  .ag-mini { display:flex; align-items:center; gap:13px; }
  .ag-mini-icon {
    width:40px; height:40px; border-radius:10px; flex-shrink:0;
    display:flex; align-items:center; justify-content:center;
  }
  .ag-mini-val {
    font-family:'Sora',sans-serif; font-size:24px; font-weight:700;
    color:var(--text); line-height:1;
  }
  .ag-mini-lbl { font-size:11px; color:var(--text-2); margin-top:3px; }

  .ag-kpi-label {
    font-size:10px; font-weight:500; letter-spacing:.07em;
    text-transform:uppercase; color:var(--text-2); margin-bottom:9px;
  }
  .ag-kpi-val {
    font-family:'Sora',sans-serif; font-size:26px; font-weight:700;
    color:var(--text); line-height:1;
  }
  .ag-kpi-meta { display:flex; align-items:center; gap:8px; margin-top:9px; flex-wrap:wrap; }
  .ag-trend {
    font-size:11px; font-weight:500;
    display:flex; align-items:center; gap:2px;
  }
  .ag-sub { font-size:11px; color:var(--text-3); }

  .ag-trow {
    display:grid; padding:11px 16px;
    border-bottom:1px solid var(--border);
    font-size:12px; color:var(--text-2);
    transition:background .1s;
  }
  .ag-trow:hover   { background:rgba(255,255,255,0.02); }
  .ag-trow:last-child { border-bottom:none; }
  .ag-thead { background:var(--s2); }

  .ag-th {
    font-size:10px; font-weight:500; letter-spacing:.06em;
    text-transform:uppercase; color:var(--text-3);
  }

  .ag-despesa-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:10px; padding:16px; }
  .ag-despesa-card { border-radius:9px; padding:13px 15px; }
  .ag-despesa-label {
    font-size:9px; font-weight:600; letter-spacing:.07em;
    text-transform:uppercase; margin-bottom:7px;
  }
  .ag-despesa-count {
    font-family:'Sora',sans-serif; font-size:24px; font-weight:700;
    color:var(--text); line-height:1;
  }
  .ag-despesa-val { font-size:11px; color:var(--text-2); margin-top:5px; }

  .ag-placeholder {
    flex:1; display:flex; align-items:center; justify-content:center;
    flex-direction:column; gap:10px; color:var(--text-3);
  }
  .ag-placeholder h2 { font-family:'Sora',sans-serif; font-size:18px; font-weight:600; color:var(--text-2); }
  .ag-placeholder p  { font-size:13px; }
`;

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "#1c1c24", border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: 8, padding: "8px 12px", fontSize: 12,
    }}>
      <p style={{ color: "#c8a55e", fontWeight: 500, marginBottom: 2 }}>{label}</p>
      <p style={{ color: "#edeae3" }}>R$ {payload[0].value?.toLocaleString("pt-BR")}</p>
    </div>
  );
}

export default function Dashboard() {
  const [period, setPeriod] = useState("Este mês");
  const [module, setModule] = useState("Dashboard");
  const [uid, setUid] = useState(null);
  const [menuVisivel, setMenuVisivel] = useState({});

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, user => setUid(user?.uid || null));
    return unsub;
  }, []);

  // Escuta as configurações de visibilidade
  useEffect(() => {
    if (!uid) return;
    return onSnapshot(doc(db, "users", uid, "config", "geral"), snap => {
      if (snap.exists()) setMenuVisivel(snap.data().menuVisivel || {});
    });
  }, [uid]);

  // Atalhos de teclado globais: Alt + tecla
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Apenas Alt + tecla
      if (!e.altKey) return;

      // Bloquear se foco está em campo de texto
      const tag = document.activeElement?.tagName;
      if (
        tag === "INPUT"    ||
        tag === "TEXTAREA" ||
        document.activeElement?.isContentEditable
      ) return;

      // Verificar se existe atalho mapeado para esta tecla
      const atalho = ATALHO_LOOKUP[e.code];
      if (!atalho) return;

      // Verificar visibilidade do módulo
      if (!LOCKED_KEYS.has(atalho.dbKey) && menuVisivel[atalho.dbKey] === false) return;

      // Navegar — bloqueia ação padrão do navegador (ex: Alt+F abre menu)
      e.preventDefault();
      setModule(atalho.label);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [menuVisivel]);

  const kpiMain = [
    { label: "Receita Bruta",  value: "R$ 480,00", trend: "+71.4%", up: true,  accent: "var(--green)",  sub: "1 venda · este mês" },
    { label: "Custo Total",    value: "R$ 0,00",   trend: "+100%",  up: false, accent: "var(--red)",    sub: "Mercadorias/serviços" },
    { label: "Lucro Líquido",  value: "R$ 480,00", trend: "+54.9%", up: true,  accent: "var(--gold)",   sub: "Margem: 100.0%" },
  ];

  const kpiSec = [
    { label: "Ticket Médio",      value: "R$ 480,00",    accent: "var(--blue)",   sub: "Por venda no período" },
    { label: "Margem Bruta",      value: "100.0%",        accent: "var(--green)",  sub: "Média do período" },
    { label: "Projeção 30 dias",  value: "R$ 12.000,00", accent: "var(--purple)", sub: "Baseada na tendência" },
  ];

  const miniStats = [
    { label: "Clientes",         value: "3",  icon: Users,        color: "var(--blue)",   dim: "var(--blue-d)" },
    { label: "Produtos",         value: "2",  icon: Package,      color: "var(--gold)",   dim: "var(--gold-d)" },
    { label: "Serviços",         value: "7",  icon: Wrench,       color: "var(--green)",  dim: "var(--green-d)" },
    { label: "Vendas no período", value: "1", icon: ShoppingCart, color: "var(--purple)", dim: "var(--purple-d)" },
  ];

  const despesas = [
    { label: "Vencidas",       count: 0, value: "R$ 0,00",     color: "var(--red)",   dim: "var(--red-d)" },
    { label: "A vencer (30d)", count: 0, value: "R$ 0,00",     color: "var(--amber)", dim: "var(--amber-d)" },
    { label: "Pendentes",      count: 8, value: "R$ 0,00",     color: "var(--text-2)", dim: "rgba(255,255,255,0.04)" },
    { label: "Pagas este mês", count: 4, value: "R$ 1.345,97", color: "var(--green)", dim: "var(--green-d)" },
  ];

  const renderModulo = () => {
    switch (module) {
      case "Clientes":         return <Clientes />;
      case "Produtos":         return <Produtos />;
      case "Serviços":         return <Servicos />;
      case "Vendedores":       return <Vendedores />;
      case "Vendas":           return <Vendas />;
      case "Configurações":    return <Configuracoes />;
      case "Despesas":         return <Despesas />;
      case "Entrada de Estoque": return <EntradaEstoque />;
      case "Agenda":           return <Agenda />;
      case "Fornecedores":     return <Fornecedores />;
      case "A Receber":        return <AReceber />;
      case "Relatórios":        return <Relatorios />;
      case "Caixa Diário":     return <CaixaDiario />;
        
      default:                 return renderDashboard();
    }
  };

  const renderDashboard = () => (
    <>
      <header className="ag-topbar">
        <div className="ag-topbar-title">
          <h1>Dashboard</h1>
          <p>Visão geral do negócio</p>
        </div>
        <div className="ag-search">
          <Search size={13} color="var(--text-3)" />
          <input placeholder="Buscar módulos, clientes..." />
        </div>
        <div className="ag-periods">
          {PERIODS.map(p => (
            <button key={p} className={`ag-period-btn ${period === p ? "active" : ""}`} onClick={() => setPeriod(p)}>{p}</button>
          ))}
        </div>
        <div className="ag-notif"><Bell size={15} color="var(--text-2)" /></div>
      </header>

      <div className="ag-content">
        <div className="g4">
          {miniStats.map(s => (
            <div key={s.label} className="ag-card">
              <div className="ag-mini">
                <div className="ag-mini-icon" style={{ background: s.dim }}><s.icon size={18} color={s.color} /></div>
                <div><div className="ag-mini-val">{s.value}</div><div className="ag-mini-lbl">{s.label}</div></div>
              </div>
            </div>
          ))}
        </div>
        <div className="g3">
          {kpiMain.map(k => (
            <div key={k.label} className="ag-card" style={{ borderTop: `2px solid ${k.accent}`, position: "relative", overflow: "hidden" }}>
              <div className="ag-kpi-label">{k.label}</div>
              <div className="ag-kpi-val">{k.value}</div>
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
        <div className="g3">
          {kpiSec.map(k => (
            <div key={k.label} className="ag-card" style={{ borderTop: `2px solid ${k.accent}` }}>
              <div className="ag-kpi-label">{k.label}</div>
              <div className="ag-kpi-val">{k.value}</div>
              <div className="ag-kpi-meta"><span className="ag-sub">{k.sub}</span></div>
            </div>
          ))}
        </div>
        <div className="g21">
          <div className="ag-card">
            <div className="ag-card-title" style={{ marginBottom: 14 }}>Faturamento por dia</div>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={faturamentoData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <defs><linearGradient id="gGold" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#c8a55e" stopOpacity={0.22} /><stop offset="95%" stopColor="#c8a55e" stopOpacity={0} /></linearGradient></defs>
                <XAxis dataKey="d" tick={{ fill: "#3a3842", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#3a3842", fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="v" stroke="#c8a55e" strokeWidth={2} fill="url(#gGold)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="ag-card" style={{ display: "flex", flexDirection: "column" }}>
            <div className="ag-card-title" style={{ marginBottom: 10 }}>Mix de receita</div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14 }}>
              <PieChart width={130} height={130}>
                <Pie data={mixData} cx={60} cy={60} innerRadius={42} outerRadius={60} dataKey="value" strokeWidth={0}>
                  <Cell fill="#c8a55e" opacity={0.9} /><Cell fill="#3ecf8e" opacity={0.85} />
                </Pie>
              </PieChart>
              <div style={{ display: "flex", flexDirection: "column", gap: 7, width: "100%" }}>
                {mixData.map((item, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: i === 0 ? "#c8a55e" : "#3ecf8e" }} />
                    <span style={{ color: "var(--text-2)", flex: 1 }}>{item.name}</span>
                    <span style={{ color: "var(--text)", fontWeight: 500 }}>{item.value}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="g11">
          <div className="ag-card-bare">
            <div className="ag-card-header"><span className="ag-card-title">Produtos mais vendidos</span></div>
            <div className="ag-trow ag-thead" style={{ gridTemplateColumns: "1fr 60px 100px" }}><span className="ag-th">Produto</span><span className="ag-th" style={{ textAlign: "center" }}>Qtd</span><span className="ag-th" style={{ textAlign: "right" }}>Total</span></div>
            <div className="ag-trow" style={{ gridTemplateColumns: "1fr 60px 100px" }}><span>Evento hora</span><span style={{ textAlign: "center" }}>1</span><span style={{ color: "var(--green)", textAlign: "right" }}>R$ 480,00</span></div>
          </div>
          <div className="ag-card-bare">
            <div className="ag-card-header"><span className="ag-card-title">Clientes que mais compram</span></div>
            <div className="ag-trow ag-thead" style={{ gridTemplateColumns: "1fr 110px" }}><span className="ag-th">Cliente</span><span className="ag-th" style={{ textAlign: "right" }}>Total gasto</span></div>
            <div className="ag-trow" style={{ gridTemplateColumns: "1fr 110px" }}><span>Cláudia Gonçalves</span><span style={{ color: "var(--gold)", textAlign: "right" }}>R$ 480,88</span></div>
          </div>
        </div>
        <div className="g1 ag-card-bare">
          <div className="ag-card-header"><span className="ag-card-title">Últimas vendas</span><button className="ag-view-all" onClick={() => setModule("Vendas")}>Ver todas <ChevronRight size={12} /></button></div>
          <div className="ag-trow ag-thead" style={{ gridTemplateColumns: "90px 1fr 130px 110px" }}>{["ID", "Cliente", "Data", "Total"].map(h => <span key={h} className="ag-th" style={{ textAlign: h === "Total" ? "right" : "left" }}>{h}</span>)}</div>
          {ultimasVendas.map((v, i) => (
            <div key={i} className="ag-trow" style={{ gridTemplateColumns: "90px 1fr 130px 110px" }}><span style={{ color: "var(--gold)" }}>{v.id}</span><span>{v.cliente}</span><span>{v.data}</span><span style={{ color: "var(--green)", textAlign: "right" }}>{v.total}</span></div>
          ))}
        </div>
        <div className="g1 ag-card-bare">
          <div className="ag-card-header"><span className="ag-card-title">Resumo de despesas</span><button className="ag-view-all" onClick={() => setModule("Despesas")}>Ver todas <ChevronRight size={12} /></button></div>
          <div className="ag-despesa-grid">
            {despesas.map(d => (
              <div key={d.label} className="ag-despesa-card" style={{ background: d.dim, border: `1px solid ${d.color}28` }}><div className="ag-despesa-label" style={{ color: d.color }}>{d.label}</div><div className="ag-despesa-count">{d.count}</div><div className="ag-despesa-val">{d.value}</div></div>
            ))}
          </div>
        </div>
      </div>
    </>
  );

  return (
    <>
      <style>{CSS}</style>
      <div className="ag-wrap">
        <aside className="ag-sidebar">
          <div className="ag-logo">
            <div className="ag-logo-icon">AG</div>
            <div className="ag-logo-text"><div className="ag-logo-name">Assent Gestão</div><div className="ag-logo-ver">v2.0</div></div>
          </div>
          <nav className="ag-nav">
            {NAV.map(sec => (
              <div key={sec.section}>
                <div className="ag-sec-label">{sec.section}</div>
                {sec.items.map(item => {
                  // FILTRO DE VISIBILIDADE
                  const dbKey = KEY_MAP[item.label];
                  if (dbKey && menuVisivel[dbKey] === false) return null;

                  return (
                    <div key={item.label} className={`ag-nav-item ${module === item.label ? "active" : ""}`} onClick={() => setModule(item.label)}>
                      <item.icon size={14} />
                      <span>{item.label}</span>
                    </div>
                  );
                })}
              </div>
            ))}
          </nav>
          <div className="ag-user">
            <div className="ag-avatar">U</div>
            <div className="ag-user-info"><div className="ag-user-name">Usuário</div><div className="ag-plan-badge">PRO</div></div>
            <button onClick={async () => { const { logout } = await import("./lib/firebase"); await logout(); window.location.reload(); }} style={{ marginLeft: "auto", background: "transparent", border: "1px solid rgba(255,255,255,0.1)", color: "#e05252", padding: "6px 10px", borderRadius: "6px", fontSize: "12px", cursor: "pointer" }}>Sair</button>
          </div>
        </aside>
        <main className="ag-main">{renderModulo()}</main>
      </div>
    </>
  );
}
