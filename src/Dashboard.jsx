/* ═══════════════════════════════════════════════════
   ASSENT v2.0 — Dashboard.jsx (Filtragem de Menu)
   ═══════════════════════════════════════════════════ */
import { useState, useEffect, useMemo } from "react";
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

/* ── Firebase ── */
import { db, auth } from "./lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";

/* ─── Mock Data & Config ─── */
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

// NAV original (completa)
const NAV_RAW = [
  { section: "BÁSICO", items: [
    { icon: LayoutDashboard, label: "Dashboard", key: "dashboard" },
    { icon: Users,           label: "Clientes",  key: "clientes" },
    { icon: Package,         label: "Produtos",  key: "produtos" },
    { icon: Wrench,          label: "Serviços",  key: "servicos" },
  ]},
  { section: "OPERAÇÕES", items: [
    { icon: ArrowDownToLine, label: "Entrada de Estoque", key: "entrada_estoque" },
    { icon: ShoppingCart,    label: "Vendas",             key: "vendas" },
    { icon: Clock,           label: "Fiado / A Receber",  key: "fiado" },
    { icon: Wallet,          label: "Caixa Diário",       key: "caixa" },
    { icon: TrendingDown,    label: "Despesas",           key: "despesas" },
    { icon: Truck,           label: "Fornecedores",       key: "fornecedores" },
  ]},
  { section: "ANÁLISE", items: [
    { icon: BarChart3,  label: "Relatórios", key: "relatorios" },
    { icon: Calendar,   label: "Agenda",     key: "agenda" },
  ]},
  { section: "SISTEMA", items: [
    { icon: Zap,        label: "Atalhos",       key: "atalhos" },
    { icon: UserCheck,  label: "Vendedores",    key: "vendedores" },
    { icon: Settings,   label: "Configurações", key: "config" },
  ]},
];

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&family=Sora:wght@300;400;500;600;700&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;1,9..40,300&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body, #root { height: 100%; width: 100%; margin: 0; padding: 0; }
  :root {
    --bg: #09090c; --s1: #0f0f13; --s2: #141419; --s3: #1a1a22;
    --border: rgba(255,255,255,0.07); --border-h: rgba(255,255,255,0.13);
    --gold: #c8a55e; --gold-brand: #D4AF37; --text: #edeae3; --text-2: #a09caa; --text-3: #6a6775;
    --green: #3ecf8e; --red: #e05252; --blue: #5b8ef0; --purple: #a78bfa; --amber: #f59e0b;
    font-family: 'DM Sans', sans-serif; --font-display: 'Playfair Display', serif;
  }
  .ag-wrap { display:flex; height:100vh; background:var(--bg); color:var(--text); overflow:hidden; }
  .ag-sidebar { width: 220px; flex-shrink:0; background: var(--s1); border-right: 1px solid var(--border); display:flex; flex-direction:column; overflow:hidden; }
  .ag-logo { padding: 18px 16px; border-bottom: 1px solid var(--border); display:flex; align-items:center; gap:10px; }
  .ag-logo-icon { width:34px; height:34px; border-radius:9px; background: linear-gradient(135deg, #b8952e, #e0c060); display:flex; align-items:center; justify-content:center; font-family:'Sora',sans-serif; font-weight:700; font-size:16px; color:#0a0808; }
  .ag-logo-name { font-size:13px; font-weight:600; color:var(--text); }
  .ag-logo-ver { font-size:10px; color:var(--text-3); margin-top:1px; }
  .ag-nav { flex:1; overflow-y:auto; padding:10px 0 6px; }
  .ag-sec-label { font-size:9px; font-weight:600; letter-spacing:.1em; color:var(--text-3); padding:10px 18px 5px; text-transform:uppercase; }
  .ag-nav-item { display:flex; align-items:center; gap:9px; padding: 7px 16px 7px 18px; margin: 1px 8px 1px 0; border-left: 2px solid transparent; border-radius: 0 7px 7px 0; cursor:pointer; font-size:13px; color:var(--text-2); transition: all .12s; }
  .ag-nav-item:hover { background:rgba(255,255,255,0.03); color:var(--text); }
  .ag-nav-item.active { background:var(--gold-d); color:var(--gold); border-left-color:var(--gold); }
  .ag-user { padding:12px 14px; border-top:1px solid var(--border); display:flex; align-items:center; gap:10px; }
  .ag-avatar { width:32px; height:32px; border-radius:50%; background:var(--s3); border:1px solid var(--border-h); display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:600; color:var(--gold); }
  .ag-main { flex:1; display:flex; flex-direction:column; overflow:hidden; }
  .ag-topbar { padding: 14px 22px; background:var(--s1); border-bottom:1px solid var(--border); display:flex; align-items:center; gap:14px; flex-shrink:0; }
  .ag-topbar-title { flex:1; text-align: center; }
  .ag-topbar-title h1 { font-family: var(--font-display); font-size:20px; font-weight:600; color: var(--gold-brand); }
  .ag-content { flex:1; overflow-y:auto; padding:20px 22px 32px; }
  .ag-card { background:var(--s1); border:1px solid var(--border); border-radius:12px; padding:18px; }
  .g4 { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-bottom:14px; }
  .g3 { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; margin-bottom:14px; }
  .ag-mini { display:flex; align-items:center; gap:13px; }
  .ag-mini-val { font-family:'Sora',sans-serif; font-size:24px; font-weight:700; color:var(--text); }
`;

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#1c1c24", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "8px 12px", fontSize: 12 }}>
      <p style={{ color: "#c8a55e", fontWeight: 500 }}>{label}</p>
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
    const unsub = onAuthStateChanged(auth, (user) => {
      setUid(user?.uid || null);
    });
    return unsub;
  }, []);

  // Monitora visibilidade do menu em tempo real
  useEffect(() => {
    if (!uid) return;
    const ref = doc(db, "users", uid, "config", "geral");
    return onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        setMenuVisivel(snap.data().menuVisivel || {});
      }
    });
  }, [uid]);

  // Filtra o NAV baseado no Firestore
  const NAV_FILTERED = useMemo(() => {
    return NAV_RAW.map(sec => ({
      ...sec,
      items: sec.items.filter(item => {
        // Se a chave não existir no objeto menuVisivel, assume-se que é visível (true) por padrão
        // Exceto dashboard e config que são locked: true por regra
        if (item.key === "dashboard" || item.key === "config") return true;
        return menuVisivel[item.key] !== false;
      })
    })).filter(sec => sec.items.length > 0); // Remove seções vazias
  }, [menuVisivel]);

  const kpiMain = [
    { label: "Receita Bruta",  value: "R$ 480,00", accent: "var(--green)" },
    { label: "Custo Total",    value: "R$ 0,00",   accent: "var(--red)" },
    { label: "Lucro Líquido",  value: "R$ 480,00", accent: "var(--gold)" },
  ];

  const miniStats = [
    { label: "Clientes", value: "3", icon: Users, color: "var(--blue)" },
    { label: "Produtos", value: "2", icon: Package, color: "var(--gold)" },
    { label: "Serviços", value: "7", icon: Wrench, color: "var(--green)" },
    { label: "Vendas", value: "1", icon: ShoppingCart, color: "var(--purple)" },
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
      default:                 return renderDashboard();
    }
  };

  const renderDashboard = () => (
    <>
      <header className="ag-topbar">
        <div className="ag-topbar-title"><h1>Dashboard</h1><p>Visão geral do negócio</p></div>
        <div className="ag-periods">
          {PERIODS.map(p => (
            <button key={p} className={`ag-period-btn ${period === p ? "active" : ""}`} onClick={() => setPeriod(p)}>{p}</button>
          ))}
        </div>
      </header>
      <div className="ag-content">
        <div className="g4">
          {miniStats.map(s => (
            <div key={s.label} className="ag-card">
              <div className="ag-mini">
                <s.icon size={18} color={s.color} />
                <div><div className="ag-mini-val">{s.value}</div><div className="ag-mini-lbl">{s.label}</div></div>
              </div>
            </div>
          ))}
        </div>
        <div className="g3">
          {kpiMain.map(k => (
            <div key={k.label} className="ag-card" style={{ borderTop: `2px solid ${k.accent}` }}>
              <div style={{fontSize: 10, color: 'var(--text-2)'}}>{k.label}</div>
              <div className="ag-mini-val">{k.value}</div>
            </div>
          ))}
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
            {NAV_FILTERED.map(sec => (
              <div key={sec.section}>
                <div className="ag-sec-label">{sec.section}</div>
                {sec.items.map(item => (
                  <div key={item.label} className={`ag-nav-item ${module === item.label ? "active" : ""}`} onClick={() => setModule(item.label)}>
                    <item.icon size={14} />
                    <span>{item.label}</span>
                  </div>
                ))}
              </div>
            ))}
          </nav>
          <div className="ag-user">
            <div className="ag-avatar">U</div>
            <div style={{flex: 1}}><div style={{fontSize: 12}}>Usuário</div><div className="ag-plan-badge">PRO</div></div>
            <button onClick={async () => { const { logout } = await import("./lib/firebase"); await logout(); window.location.reload(); }} style={{ color: "#e05252", background: "none", border: "1px solid rgba(255,255,255,0.1)", padding: "4px 8px", borderRadius: "4px", fontSize: "10px", cursor: "pointer" }}>Sair</button>
          </div>
        </aside>
        <main className="ag-main">{renderModulo()}</main>
      </div>
    </>
  );
}
