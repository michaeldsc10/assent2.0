/**
 * AssFlow.jsx — Módulo Assent Flow
 * src/flow/AssFlow.jsx
 *
 * Convenções AG v2.0:
 *  - Guard `if (!tenantUid) return null` em todo useEffect com onSnapshot
 *  - `[tenantUid]` em todo array de dependências
 *  - Paths: /users/{tenantUid}/agendamento_configuracoes · /users/{tenantUid}/agendamento_reservas
 *  - Herda tema (dark/light) via CSS variables do .ag-app pai — NÃO gerencia tema próprio
 *  - Recebe: tenantUid, plano, theme, onToggleTheme, onVoltar, nomeEmpresa (do Dashboard.jsx)
 *
 * O botão de tema já existe na nav do AG e controla a classe .ag-app.light
 * As CSS variables (--bg, --s1, --gold, etc.) são herdadas automaticamente.
 */

import { useState, useEffect, useCallback } from "react";
import {
  collection, doc, onSnapshot, query,
  where, orderBy, serverTimestamp,
  updateDoc, setDoc, Timestamp,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";
import { Sun, Moon, ArrowLeft } from "lucide-react";

/* ─── CSS — usa variáveis do AG (dark/light automático) ─── */
const FLOW_CSS = `
  .fl-root { display:flex; height:100%; overflow:hidden; background:var(--bg); color:var(--text); font-family:'DM Sans',sans-serif; }

  .fl-sidebar { width:220px; flex-shrink:0; background:var(--s1); border-right:1px solid var(--border); display:flex; flex-direction:column; overflow:hidden; }
  .fl-sidebar-header { padding:18px 18px 16px; border-bottom:1px solid var(--border); display:flex; align-items:center; gap:10px; }
  .fl-sidebar-icon { width:32px; height:32px; border-radius:8px; flex-shrink:0; background:var(--gold-d); border:1px solid rgba(200,165,94,0.3); display:flex; align-items:center; justify-content:center; color:var(--gold); font-size:15px; font-weight:700; }
  .fl-sidebar-name { font-size:13px; font-weight:700; color:var(--text); line-height:1.1; }
  .fl-sidebar-sub  { font-size:10px; color:var(--text-2); margin-top:2px; letter-spacing:0.04em; }

  .fl-nav { flex:1; padding:12px 8px; overflow-y:auto; }
  .fl-nav-item { display:flex; align-items:center; gap:10px; width:100%; padding:9px 12px; border-radius:8px; margin-bottom:2px; border:none; cursor:pointer; border-left:3px solid transparent; background:transparent; color:var(--text-2); font-size:13px; font-family:'DM Sans',sans-serif; text-align:left; transition:all 0.13s; }
  .fl-nav-item:hover { background:rgba(255,255,255,0.03); color:var(--text); }
  .fl-nav-item.active { background:var(--gold-d); border-left-color:var(--gold); color:var(--gold); font-weight:600; }

  .fl-sidebar-footer { padding:12px 18px; border-top:1px solid var(--border); display:flex; align-items:center; gap:8px; }
  .fl-badge-premium { display:inline-block; padding:3px 9px; border-radius:20px; font-size:9px; font-weight:800; letter-spacing:0.1em; color:var(--gold); background:var(--gold-d); border:1px solid rgba(200,165,94,0.3); text-transform:uppercase; }

  .fl-back-btn { background:transparent; border:none; cursor:pointer; color:var(--text-2); font-size:11px; display:flex; align-items:center; gap:5px; padding:3px 0; font-family:'DM Sans',sans-serif; transition:color 0.13s; }
  .fl-back-btn:hover { color:var(--text); }

  .fl-main { flex:1; overflow-y:auto; min-width:0; }
  .fl-main::-webkit-scrollbar { width:4px; }
  .fl-main::-webkit-scrollbar-thumb { background:var(--border); border-radius:2px; }

  .fl-card { background:var(--s1); border:1px solid var(--border); border-radius:14px; padding:22px; margin-bottom:16px; }
  .fl-card-title { font-size:13px; font-weight:600; color:var(--text); margin-bottom:16px; margin-top:0; }

  .fl-kpi-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:14px; margin-bottom:16px; }
  @media (max-width:1100px) { .fl-kpi-grid { grid-template-columns:repeat(2,1fr); } }
  @media (max-width:640px)  { .fl-kpi-grid { grid-template-columns:1fr 1fr; } }
  .fl-kpi { background:var(--s1); border:1px solid var(--border); border-radius:12px; padding:18px; }
  .fl-kpi-val { font-size:28px; font-weight:700; line-height:1; margin-bottom:6px; font-family:'Sora',sans-serif; }
  .fl-kpi-lbl { font-size:11px; color:var(--text-2); text-transform:uppercase; letter-spacing:0.04em; }

  .fl-filters { display:flex; gap:8px; margin-bottom:20px; flex-wrap:wrap; }
  .fl-filter-btn { padding:5px 14px; border-radius:20px; border:1px solid var(--border); background:transparent; color:var(--text-2); font-size:12px; font-weight:600; cursor:pointer; transition:all 0.13s; font-family:'DM Sans',sans-serif; }
  .fl-filter-btn:hover { background:var(--s2); color:var(--text); }
  .fl-filter-btn.active { background:var(--gold-d); border-color:rgba(200,165,94,0.35); color:var(--gold); }

  .fl-row { display:grid; grid-template-columns:118px 1fr 1fr 100px 148px; align-items:center; gap:14px; padding:13px 18px; border-radius:10px; background:var(--s1); border:1px solid var(--border); margin-bottom:8px; transition:border-color 0.13s; }
  .fl-row:hover { border-color:var(--border-h); }

  .fl-input, .fl-select { width:100%; padding:9px 13px; background:var(--s2); border:1px solid var(--border); border-radius:8px; color:var(--text); font-size:13px; outline:none; font-family:'DM Sans',sans-serif; box-sizing:border-box; transition:border-color 0.15s; }
  .fl-input:focus, .fl-select:focus { border-color:var(--gold); }
  .fl-label { display:block; font-size:10px; font-weight:600; letter-spacing:0.08em; text-transform:uppercase; color:var(--text-2); margin-bottom:6px; }

  .fl-badge { display:inline-block; padding:3px 10px; border-radius:6px; font-size:11px; font-weight:700; letter-spacing:0.05em; white-space:nowrap; }
  .fl-badge.pendente   { color:var(--amber); background:var(--amber-d); border:1px solid rgba(245,158,11,0.25); }
  .fl-badge.confirmado { color:var(--green); background:var(--green-d); border:1px solid rgba(62,207,142,0.2); }
  .fl-badge.expirado   { color:var(--text-2); background:var(--s2); border:1px solid var(--border); }
  .fl-badge.cancelado  { color:var(--red); background:var(--red-d); border:1px solid rgba(224,82,82,0.2); }

  .fl-btn-confirm { padding:5px 11px; border-radius:6px; font-size:11px; font-weight:700; cursor:pointer; border:1px solid rgba(62,207,142,0.25); background:var(--green-d); color:var(--green); font-family:'DM Sans',sans-serif; transition:opacity 0.15s; }
  .fl-btn-confirm:disabled { opacity:0.45; cursor:not-allowed; }
  .fl-btn-cancel  { padding:5px 9px; border-radius:6px; font-size:11px; font-weight:700; cursor:pointer; border:1px solid rgba(224,82,82,0.2); background:var(--red-d); color:var(--red); font-family:'DM Sans',sans-serif; transition:opacity 0.15s; }
  .fl-btn-cancel:disabled  { opacity:0.45; cursor:not-allowed; }

  .fl-agenda-row  { display:flex; align-items:center; gap:14px; padding:11px 14px; border-radius:8px; background:var(--s2); border:1px solid var(--border); margin-bottom:8px; }
  .fl-agenda-time { min-width:46px; color:var(--gold); font-size:13px; font-weight:700; }

  .fl-dia-btn { padding:6px 13px; border-radius:20px; font-size:12px; font-weight:600; cursor:pointer; transition:all 0.13s; font-family:'DM Sans',sans-serif; border:1px solid var(--border); background:transparent; color:var(--text-2); }
  .fl-dia-btn.ativo { background:var(--gold-d); border-color:rgba(200,165,94,0.35); color:var(--gold); }

  .fl-link-box { padding:11px 14px; border-radius:8px; background:var(--s2); border:1px solid var(--border); color:var(--gold); font-family:'IBM Plex Mono',monospace; font-size:13px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1; }

  .fl-toggle { padding:7px 18px; border-radius:20px; font-size:12px; font-weight:700; cursor:pointer; transition:all 0.2s; font-family:'DM Sans',sans-serif; }
  .fl-toggle.ativo   { background:var(--green-d); border:1px solid rgba(62,207,142,0.25); color:var(--green); }
  .fl-toggle.inativo { background:transparent; border:1px solid var(--border); color:var(--text-2); }

  .fl-btn-primary { padding:11px 26px; border-radius:8px; border:none; background:linear-gradient(135deg,#B8860B 0%,#D4AF37 100%); color:#050505; font-weight:700; font-size:13px; cursor:pointer; font-family:'DM Sans',sans-serif; letter-spacing:0.02em; transition:opacity 0.2s; }
  .fl-btn-primary:disabled { opacity:0.45; cursor:not-allowed; }

  @keyframes fl-spin { to { transform:rotate(360deg); } }
  .fl-spinner { width:26px; height:26px; border-radius:50%; border:2px solid var(--border); border-top-color:var(--gold); animation:fl-spin 0.75s linear infinite; margin:0 auto; }

  .fl-upgrade { display:flex; align-items:center; justify-content:center; height:100%; min-height:400px; }
  .fl-upgrade-card { text-align:center; max-width:420px; padding:44px 40px; background:var(--s1); border:1px solid var(--border); border-radius:16px; }
  .fl-empty { text-align:center; padding:40px 20px; color:var(--text-2); font-size:13px; }
  .fl-grid2 { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
  @media (max-width:640px) { .fl-grid2 { grid-template-columns:1fr; } }
`;

/* ─── Utilitários ─── */
const toDate  = (ts) => (ts?.toDate ? ts.toDate() : ts ? new Date(ts) : null);
const fmtDate = (ts) => toDate(ts)?.toLocaleDateString("pt-BR", { day:"2-digit", month:"2-digit", year:"numeric" }) ?? "—";
const fmtTime = (ts) => toDate(ts)?.toLocaleTimeString("pt-BR", { hour:"2-digit", minute:"2-digit" }) ?? "—";
const isHoje  = (ts) => { const d = toDate(ts); return d ? d.toDateString() === new Date().toDateString() : false; };

const LABEL_STATUS = { pendente:"Pendente", confirmado:"Confirmado", expirado:"Expirado", cancelado:"Cancelado" };

const Badge = ({ status }) => <span className={`fl-badge ${status ?? "expirado"}`}>{LABEL_STATUS[status] ?? status}</span>;
const Spinner = () => <div style={{ padding:"32px 0", display:"flex", justifyContent:"center" }}><div className="fl-spinner" /></div>;

/* ─── Upgrade ─── */
const UpgradeRequired = ({ onVoltar }) => (
  <div className="fl-upgrade">
    <div className="fl-upgrade-card">
      <div style={{ width:52, height:52, borderRadius:12, margin:"0 auto 18px", background:"var(--gold-d)", border:"1px solid rgba(200,165,94,0.3)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, color:"var(--gold)" }}>◷</div>
      <h2 style={{ color:"var(--gold)", fontSize:19, fontWeight:700, marginBottom:10, marginTop:0 }}>Assent Flow</h2>
      <p style={{ color:"var(--text-2)", fontSize:13, lineHeight:1.75, marginBottom:24 }}>
        O módulo <strong style={{ color:"var(--text)" }}>Assent Flow</strong> está disponível exclusivamente no <strong style={{ color:"var(--gold)" }}>Plano Premium</strong>.
      </p>
      <button className="fl-btn-primary" style={{ marginBottom:12 }}>Conhecer o Plano Premium</button>
      <div>{onVoltar && <button onClick={onVoltar} className="fl-back-btn" style={{ justifyContent:"center", margin:"0 auto" }}><ArrowLeft size={12} /> Voltar ao Assent Gestão</button>}</div>
    </div>
  </div>
);

/* ─── Sidebar ─── */
const NAV_ITEMS = [
  { key:"visao-geral",   icon:"◈", label:"Visão Geral" },
  { key:"reservas",      icon:"◷", label:"Reservas" },
  { key:"configuracoes", icon:"⊙", label:"Configurações", adminOnly:true },
  { key:"link",          icon:"⬡", label:"Link Público" },
];

const Sidebar = ({ tela, setTela, isAdmin, onVoltar, theme, onToggleTheme }) => (
  <aside className="fl-sidebar">
    <div className="fl-sidebar-header">
      <div className="fl-sidebar-icon">◷</div>
      <div>
        <div className="fl-sidebar-name">Assent Flow</div>
        <div className="fl-sidebar-sub">via Assent Gestão</div>
      </div>
    </div>
    <nav className="fl-nav">
      {NAV_ITEMS.filter(n => !n.adminOnly || isAdmin).map(n => (
        <button key={n.key} onClick={() => setTela(n.key)} className={`fl-nav-item ${tela === n.key ? "active" : ""}`}>
          <span style={{ fontSize:15, lineHeight:1 }}>{n.icon}</span>{n.label}
        </button>
      ))}
    </nav>
    <div className="fl-sidebar-footer">
      <span className="fl-badge-premium">● Premium</span>
      <div style={{ flex:1 }} />
      {onToggleTheme && (
        <div className="ag-theme-btn" onClick={onToggleTheme} role="button" tabIndex={0}
          onKeyDown={e => (e.key === "Enter" || e.key === " ") && onToggleTheme()}
          title={theme === "dark" ? "Mudar para tema claro" : "Mudar para tema escuro"}
          style={{ margin:0 }}>
          {theme === "dark" ? <Sun size={13} /> : <Moon size={13} />}
        </div>
      )}
    </div>
    {onVoltar && (
      <div style={{ padding:"10px 18px", borderTop:"1px solid var(--border)" }}>
        <button onClick={onVoltar} className="fl-back-btn"><ArrowLeft size={12} /> Assent Gestão</button>
      </div>
    )}
  </aside>
);

/* ─── Tela 1: Visão Geral ─── */
const VisaoGeral = ({ tenantUid }) => {
  const [reservas, setReservas] = useState([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    if (!tenantUid) return;
    const hoje = new Date(); hoje.setHours(0,0,0,0);
    const em7d = new Date(hoje); em7d.setDate(em7d.getDate() + 7);
    const q = query(
      collection(db, "users", tenantUid, "agendamento_reservas"),
      where("data_hora_inicio", ">=", Timestamp.fromDate(hoje)),
      where("data_hora_inicio", "<=", Timestamp.fromDate(em7d)),
      orderBy("data_hora_inicio", "asc"),
    );
    const unsub = onSnapshot(q, snap => { setReservas(snap.docs.map(d => ({ id:d.id, ...d.data() }))); setLoading(false); });
    return unsub;
  }, [tenantUid]);

  const deHoje = reservas.filter(r => isHoje(r.data_hora_inicio));
  const kpis = [
    { label:"Agendamentos hoje",  value:deHoje.length,                                         cor:"var(--blue)"  },
    { label:"Confirmados hoje",   value:deHoje.filter(r => r.status === "confirmado").length,   cor:"var(--green)" },
    { label:"Pendentes hoje",     value:deHoje.filter(r => r.status === "pendente").length,     cor:"var(--amber)" },
    { label:"Próximos 7 dias",    value:reservas.length,                                        cor:"var(--gold)"  },
  ];

  return (
    <div style={{ padding:28 }}>
      <h1 style={{ color:"var(--text)", fontSize:22, fontWeight:700, margin:"0 0 4px", fontFamily:"'Sora',sans-serif" }}>Visão Geral</h1>
      <p style={{ color:"var(--text-2)", fontSize:12, marginBottom:24 }}>Panorama dos agendamentos</p>
      <div className="fl-kpi-grid">
        {kpis.map(k => (
          <div key={k.label} className="fl-kpi" style={{ borderBottom:`2px solid ${k.cor}` }}>
            <div className="fl-kpi-val" style={{ color:k.cor }}>{loading ? <div className="ag-skeleton" style={{ width:40, height:28 }} /> : k.value}</div>
            <div className="fl-kpi-lbl">{k.label}</div>
          </div>
        ))}
      </div>
      <div className="fl-card">
        <h3 className="fl-card-title">Agenda de Hoje</h3>
        {loading ? <Spinner /> : deHoje.length === 0 ? <div className="fl-empty">Nenhum agendamento para hoje.</div>
          : deHoje.map(r => (
            <div key={r.id} className="fl-agenda-row">
              <div className="fl-agenda-time">{fmtTime(r.data_hora_inicio)}</div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ color:"var(--text)", fontWeight:600, fontSize:13 }}>{r.nome_cliente}</div>
                <div style={{ color:"var(--text-2)", fontSize:11 }}>{r.contato_whatsapp}</div>
              </div>
              <Badge status={r.status} />
            </div>
          ))
        }
      </div>
    </div>
  );
};

/* ─── Tela 2: Reservas ─── */
const FILTROS = ["todos", "pendente", "confirmado", "expirado", "cancelado"];

const Reservas = ({ tenantUid, podeEditar }) => {
  const [reservas, setReservas] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [filtro,   setFiltro]   = useState("todos");
  const [busy,     setBusy]     = useState(null);

  useEffect(() => {
    if (!tenantUid) return;
    const q = query(collection(db, "users", tenantUid, "agendamento_reservas"), orderBy("data_hora_inicio", "desc"));
    const unsub = onSnapshot(q, snap => { setReservas(snap.docs.map(d => ({ id:d.id, ...d.data() }))); setLoading(false); });
    return unsub;
  }, [tenantUid]);

  const alterarStatus = useCallback(async (id, novoStatus) => {
    if (!podeEditar || busy) return;
    setBusy(id);
    try { await updateDoc(doc(db, "users", tenantUid, "agendamento_reservas", id), { status:novoStatus, atualizadoEm:serverTimestamp() }); }
    catch (err) { console.error("[AssFlow]", err); }
    finally { setBusy(null); }
  }, [tenantUid, podeEditar, busy]);

  const exibidas = filtro === "todos" ? reservas : reservas.filter(r => r.status === filtro);

  return (
    <div style={{ padding:28 }}>
      <h1 style={{ color:"var(--text)", fontSize:22, fontWeight:700, margin:"0 0 4px", fontFamily:"'Sora',sans-serif" }}>Reservas</h1>
      <p style={{ color:"var(--text-2)", fontSize:12, marginBottom:20 }}>Gerencie todos os agendamentos</p>
      <div className="fl-filters">
        {FILTROS.map(f => {
          const cnt = f === "todos" ? reservas.length : reservas.filter(r => r.status === f).length;
          return (
            <button key={f} onClick={() => setFiltro(f)} className={`fl-filter-btn ${filtro === f ? "active" : ""}`}>
              {f === "todos" ? "Todos" : LABEL_STATUS[f]}
              <span style={{ marginLeft:6, opacity:0.65, fontSize:11 }}>{cnt}</span>
            </button>
          );
        })}
      </div>
      {loading ? <Spinner /> : exibidas.length === 0
        ? <div className="fl-card"><div className="fl-empty">Nenhuma reserva encontrada.</div></div>
        : exibidas.map(r => (
          <div key={r.id} className="fl-row">
            <div>
              <div style={{ color:"var(--gold)", fontSize:12, fontWeight:700 }}>{fmtDate(r.data_hora_inicio)}</div>
              <div style={{ color:"var(--text-2)", fontSize:11, marginTop:2 }}>{fmtTime(r.data_hora_inicio)} – {fmtTime(r.data_hora_fim)}</div>
            </div>
            <div style={{ minWidth:0 }}>
              <div style={{ color:"var(--text)", fontWeight:600, fontSize:13, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{r.nome_cliente}</div>
              <div style={{ color:"var(--text-2)", fontSize:11, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{r.email}</div>
            </div>
            <div style={{ color:"var(--text-2)", fontSize:12 }}>{r.contato_whatsapp}</div>
            <Badge status={r.status} />
            {podeEditar && (
              <div style={{ display:"flex", gap:6 }}>
                {r.status === "pendente" && <button className="fl-btn-confirm" onClick={() => alterarStatus(r.id, "confirmado")} disabled={busy === r.id}>{busy === r.id ? "..." : "✓ Confirmar"}</button>}
                {(r.status === "pendente" || r.status === "confirmado") && <button className="fl-btn-cancel" onClick={() => alterarStatus(r.id, "cancelado")} disabled={busy === r.id}>✕</button>}
              </div>
            )}
          </div>
        ))
      }
    </div>
  );
};

/* ─── Tela 3: Configurações ─── */
const DIAS_SEMANA = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
const DEFAULT_CONFIG = { hora_abertura:"08:00", hora_fechamento:"18:00", duracao_bloco_minutos:60, dias_funcionamento:[1,2,3,4,5], max_dias_antecedencia:30, email_notificacao:"", ativo:true };

const Configuracoes = ({ tenantUid }) => {
  const [config,   setConfig]   = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [salvoOk,  setSalvoOk]  = useState(false);

  useEffect(() => {
    if (!tenantUid) return;
    const unsub = onSnapshot(doc(db, "users", tenantUid, "agendamento_configuracoes", "config"),
      snap => setConfig(snap.exists() ? { ...DEFAULT_CONFIG, ...snap.data() } : { ...DEFAULT_CONFIG }));
    return unsub;
  }, [tenantUid]);

  const salvar = async () => {
    if (!config) return;
    setSalvando(true);
    try {
      const ref = doc(db, "users", tenantUid, "agendamento_configuracoes", "config");
      try { await updateDoc(ref, { ...config, atualizadoEm:serverTimestamp() }); }
      catch { await setDoc(ref, { ...config, criadoEm:serverTimestamp(), atualizadoEm:serverTimestamp() }); }
      setSalvoOk(true); setTimeout(() => setSalvoOk(false), 2500);
    } catch (err) { console.error("[AssFlow]", err); }
    finally { setSalvando(false); }
  };

  const toggleDia = i => setConfig(prev => ({
    ...prev,
    dias_funcionamento: prev.dias_funcionamento.includes(i)
      ? prev.dias_funcionamento.filter(d => d !== i)
      : [...prev.dias_funcionamento, i].sort((a,b) => a-b),
  }));
  const set = (key, val) => setConfig(prev => ({ ...prev, [key]:val }));

  if (!config) return <Spinner />;

  return (
    <div style={{ padding:28, maxWidth:680 }}>
      <h1 style={{ color:"var(--text)", fontSize:22, fontWeight:700, margin:"0 0 4px", fontFamily:"'Sora',sans-serif" }}>Configurações</h1>
      <p style={{ color:"var(--text-2)", fontSize:12, marginBottom:24 }}>Defina as regras exibidas na página pública</p>
      <div className="fl-card">
        <h3 className="fl-card-title">Horário de Funcionamento</h3>
        <div style={{ marginBottom:18 }}>
          <label className="fl-label">Dias de Atendimento</label>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
            {DIAS_SEMANA.map((d,i) => <button key={i} onClick={() => toggleDia(i)} className={`fl-dia-btn ${config.dias_funcionamento.includes(i) ? "ativo" : ""}`}>{d}</button>)}
          </div>
        </div>
        <div className="fl-grid2" style={{ marginBottom:16 }}>
          <div><label className="fl-label">Abertura</label><input type="time" className="fl-input" value={config.hora_abertura} onChange={e => set("hora_abertura", e.target.value)} /></div>
          <div><label className="fl-label">Fechamento</label><input type="time" className="fl-input" value={config.hora_fechamento} onChange={e => set("hora_fechamento", e.target.value)} /></div>
        </div>
        <div className="fl-grid2">
          <div>
            <label className="fl-label">Duração</label>
            <select className="fl-select" value={config.duracao_bloco_minutos} onChange={e => set("duracao_bloco_minutos", Number(e.target.value))}>
              {[15,30,45,60,90,120].map(m => <option key={m} value={m}>{m} minutos</option>)}
            </select>
          </div>
          <div>
            <label className="fl-label">Antecedência Máxima</label>
            <select className="fl-select" value={config.max_dias_antecedencia} onChange={e => set("max_dias_antecedencia", Number(e.target.value))}>
              {[7,14,21,30,45,60,90].map(d => <option key={d} value={d}>{d} dias</option>)}
            </select>
          </div>
        </div>
      </div>
      <div className="fl-card">
        <h3 className="fl-card-title">Notificações</h3>
        <label className="fl-label">E-mail para Novos Agendamentos</label>
        <input type="email" className="fl-input" value={config.email_notificacao} onChange={e => set("email_notificacao", e.target.value)} placeholder="contato@exemplo.com" />
        <p style={{ color:"var(--text-2)", fontSize:11, marginTop:7 }}>Usado pela Cloud Function para enviar confirmações ao cliente.</p>
      </div>
      <div style={{ display:"flex", alignItems:"center", gap:14 }}>
        <button className="fl-btn-primary" onClick={salvar} disabled={salvando}>{salvando ? "Salvando..." : "Salvar Configurações"}</button>
        {salvoOk && <span style={{ color:"var(--green)", fontSize:13, fontWeight:600 }}>✓ Salvo</span>}
      </div>
    </div>
  );
};

/* ─── Tela 4: Link Público ─── */
const BASE_URL = "https://flow.assentagencia.com.br";

const LinkPublico = ({ tenantUid }) => {
  const [ativo,    setAtivo]    = useState(true);
  const [copiado,  setCopiado]  = useState(false);
  const [toggling, setToggling] = useState(false);
  const publicLink = `${BASE_URL}?tenant=${tenantUid}`;

  useEffect(() => {
    if (!tenantUid) return;
    const unsub = onSnapshot(doc(db, "users", tenantUid, "agendamento_configuracoes", "config"),
      snap => { if (snap.exists()) setAtivo(snap.data().ativo ?? true); });
    return unsub;
  }, [tenantUid]);

  const copiar = async () => {
    try { await navigator.clipboard.writeText(publicLink); setCopiado(true); setTimeout(() => setCopiado(false), 2200); } catch { /* silent */ }
  };

  const toggleAtivo = async () => {
    if (toggling) return; setToggling(true);
    const novoAtivo = !ativo; setAtivo(novoAtivo);
    try { await updateDoc(doc(db, "users", tenantUid, "agendamento_configuracoes", "config"), { ativo:novoAtivo, atualizadoEm:serverTimestamp() }); }
    catch { setAtivo(!novoAtivo); }
    finally { setToggling(false); }
  };

  const CANAIS = [
    { meio:"WhatsApp",  desc:"Cole na bio ou envie diretamente para clientes." },
    { meio:"Instagram", desc:"Adicione na bio do perfil profissional." },
    { meio:"E-mail",    desc:"Inclua na assinatura como botão 'Agendar agora'." },
    { meio:"Site",      desc:"Incorpore como botão de agendamento." },
    { meio:"Google",    desc:"Adicione ao perfil do Google Meu Negócio." },
  ];

  return (
    <div style={{ padding:28, maxWidth:680 }}>
      <h1 style={{ color:"var(--text)", fontSize:22, fontWeight:700, margin:"0 0 4px", fontFamily:"'Sora',sans-serif" }}>Link Público</h1>
      <p style={{ color:"var(--text-2)", fontSize:12, marginBottom:24 }}>Compartilhe com seus clientes para que possam agendar online</p>
      <div className="fl-card" style={{ marginBottom:14 }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div>
            <div style={{ color:"var(--text)", fontWeight:600, fontSize:14 }}>Agendamento Online</div>
            <div style={{ color:"var(--text-2)", fontSize:12, marginTop:4 }}>{ativo ? "Página ativa — clientes podem agendar" : "Página desativada"}</div>
          </div>
          <button onClick={toggleAtivo} disabled={toggling} className={`fl-toggle ${ativo ? "ativo" : "inativo"}`} style={{ opacity:toggling ? 0.55 : 1 }}>{ativo ? "● Ativo" : "○ Inativo"}</button>
        </div>
      </div>
      <div className="fl-card" style={{ marginBottom:14 }}>
        <label className="fl-label">Link de Agendamento do Cliente</label>
        <div style={{ display:"flex", gap:10 }}>
          <div className="fl-link-box">{publicLink}</div>
          <button onClick={copiar} style={{ padding:"10px 18px", borderRadius:8, cursor:"pointer", border:`1px solid ${copiado ? "rgba(62,207,142,0.3)" : "rgba(200,165,94,0.3)"}`, background:copiado ? "var(--green-d)" : "var(--gold-d)", color:copiado ? "var(--green)" : "var(--gold)", fontSize:13, fontWeight:700, whiteSpace:"nowrap", transition:"all 0.2s", fontFamily:"DM Sans,sans-serif" }}>
            {copiado ? "✓ Copiado!" : "⧉ Copiar"}
          </button>
        </div>
        <p style={{ color:"var(--text-2)", fontSize:11, marginTop:8 }}>Link único por tenant. Nunca altere o <code style={{ color:"var(--gold)", fontSize:11 }}>tenantUid</code>.</p>
      </div>
      <div className="fl-card">
        <h3 className="fl-card-title">Como Distribuir</h3>
        {CANAIS.map((c,i) => (
          <div key={c.meio} style={{ display:"flex", gap:14, alignItems:"flex-start", padding:"10px 0", borderBottom:i < CANAIS.length-1 ? "1px solid var(--border)" : "none" }}>
            <span style={{ minWidth:76, color:"var(--gold)", fontSize:12, fontWeight:700, paddingTop:1 }}>{c.meio}</span>
            <span style={{ color:"var(--text-2)", fontSize:13 }}>{c.desc}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ─── Módulo Principal ─── */
export default function AssFlow({ tenantUid:tenantUidProp, plano, theme, onToggleTheme, onVoltar }) {
  const auth = useAuth();
  const tenantUid = tenantUidProp ?? auth.tenantUid;
  const { isAdmin, podeVer, podeEditar } = auth;
  const [tela, setTela] = useState("visao-geral");

  if (!tenantUid) return null;

  if (plano && plano !== "premium") {
    return (
      <>
        <style>{FLOW_CSS}</style>
        <div className="fl-root"><UpgradeRequired onVoltar={onVoltar} /></div>
      </>
    );
  }

  return (
    <>
      <style>{FLOW_CSS}</style>
      <div className="fl-root">
        <Sidebar tela={tela} setTela={setTela} isAdmin={isAdmin} onVoltar={onVoltar} theme={theme} onToggleTheme={onToggleTheme} />
        <main className="fl-main">
          {tela === "visao-geral"   && podeVer("agendamento")           && <VisaoGeral    tenantUid={tenantUid} />}
          {tela === "reservas"      && podeVer("agendamento")           && <Reservas      tenantUid={tenantUid} podeEditar={podeEditar("agendamento")} />}
          {tela === "configuracoes" && isAdmin                          && <Configuracoes  tenantUid={tenantUid} />}
          {tela === "link"                                              && <LinkPublico    tenantUid={tenantUid} />}
        </main>
      </div>
    </>
  );
}
