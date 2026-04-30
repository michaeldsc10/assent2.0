// src/flow/AssFlow.jsx
// ASSENT Flow v3.0 — Prestadores = usuários do AG + admin pré-configurado
// Convenções AG v2.0: guard tenantUid, /users/{tenantUid}/..., serverTimestamp()
//
// Lógica de IDs:
//   admin  → prestadorId = "admin"  (criado automaticamente no primeiro acesso)
//   membro → prestadorId = user.uid  (criado quando admin ativa no Flow)
//
// URL pública:
//   ?tenant=X              → usa admin ("admin") — compatível com URL antiga
//   ?tenant=X&prestador=Y  → prestador específico

import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext.jsx";
import {
  getFirestore, collection, doc, onSnapshot,
  setDoc, updateDoc, deleteDoc, getDoc,
  serverTimestamp, query, orderBy,
} from "firebase/firestore";

const db = getFirestore();
const PUBLIC_BASE = "https://flow.assentagencia.com.br";

// ─── Estilos ──────────────────────────────────────────────────────────────────
const S = {
  root: { display:"flex", height:"100vh", background:"var(--bg)", color:"var(--text)", fontFamily:"var(--font,'Montserrat',sans-serif)", overflow:"hidden" },
  sidebar: { width:220, minWidth:220, background:"var(--s1)", borderRight:"1px solid var(--border)", display:"flex", flexDirection:"column", padding:"0 0 16px 0" },
  sidebarHeader: { padding:"24px 20px 20px", borderBottom:"1px solid var(--border)", marginBottom:8 },
  logoRow: { display:"flex", alignItems:"center", gap:10, marginBottom:4 },
  logoIcon: { width:32, height:32, background:"linear-gradient(135deg,var(--gold) 0%,#1a3a5c 100%)", borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, fontWeight:700, color:"#fff" },
  logoText: { fontSize:13, fontWeight:700, color:"var(--gold)", letterSpacing:2, textTransform:"uppercase" },
  logoSub: { fontSize:10, color:"var(--text-muted)", letterSpacing:1, textTransform:"uppercase" },
  navItem: a => ({ display:"flex", alignItems:"center", gap:10, padding:"10px 20px", cursor:"pointer", background:a?"rgba(212,175,55,0.12)":"transparent", borderLeft:a?"3px solid var(--gold)":"3px solid transparent", color:a?"var(--gold)":"var(--text-muted)", fontSize:13, fontWeight:a?600:400, transition:"all 0.15s", userSelect:"none" }),
  sidebarFooter: { marginTop:"auto", padding:"0 12px", display:"flex", flexDirection:"column", gap:8 },
  btnSidebarSecondary: { padding:"8px 14px", background:"rgba(255,255,255,0.04)", border:"1px solid var(--border)", borderRadius:8, color:"var(--text-muted)", fontSize:12, cursor:"pointer", display:"flex", alignItems:"center", gap:6, width:"100%" },
  main: { flex:1, display:"flex", flexDirection:"column", overflow:"hidden" },
  topbar: { height:56, borderBottom:"1px solid var(--border)", display:"flex", alignItems:"center", padding:"0 24px", gap:12, background:"var(--s1)", flexShrink:0 },
  topbarTitle: { fontSize:15, fontWeight:600, color:"var(--text)", flex:1 },
  content: { flex:1, overflow:"auto", padding:24 },
  card: { background:"var(--s1)", border:"1px solid var(--border)", borderRadius:12, padding:20 },
  cardDashed: { background:"rgba(212,175,55,0.03)", border:"1px dashed rgba(212,175,55,0.3)", borderRadius:12, padding:20 },
  grid2: { display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 },
  grid4: { display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:16 },
  statCard: { background:"var(--s1)", border:"1px solid var(--border)", borderRadius:12, padding:20 },
  sectionTitle: { fontSize:11, fontWeight:700, color:"var(--text-muted)", textTransform:"uppercase", letterSpacing:1, marginBottom:14 },
  table: { width:"100%", borderCollapse:"collapse" },
  th: { textAlign:"left", padding:"8px 12px", fontSize:10, color:"var(--text-muted)", textTransform:"uppercase", letterSpacing:0.5, borderBottom:"1px solid var(--border)", fontWeight:700 },
  td: { padding:"12px", fontSize:13, borderBottom:"1px solid var(--border)", verticalAlign:"middle" },
  badge: c => ({ padding:"2px 9px", borderRadius:20, fontSize:11, fontWeight:600, background:c==="green"?"rgba(34,197,94,0.12)":c==="yellow"?"rgba(234,179,8,0.12)":c==="red"?"rgba(239,68,68,0.12)":c==="blue"?"rgba(59,130,246,0.12)":"rgba(156,163,175,0.1)", color:c==="green"?"#22c55e":c==="yellow"?"#eab308":c==="red"?"#ef4444":c==="blue"?"#60a5fa":"#9ca3af", border:`1px solid ${c==="green"?"rgba(34,197,94,0.25)":c==="yellow"?"rgba(234,179,8,0.25)":c==="red"?"rgba(239,68,68,0.25)":c==="blue"?"rgba(59,130,246,0.25)":"rgba(156,163,175,0.2)"}` }),
  btnPrimary: { padding:"8px 18px", background:"var(--gold)", border:"none", borderRadius:8, color:"#000", fontSize:13, fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", gap:6 },
  btnGhost: { padding:"6px 12px", background:"transparent", border:"1px solid var(--border)", borderRadius:6, color:"var(--text-muted)", fontSize:12, cursor:"pointer" },
  btnDanger: { padding:"6px 12px", background:"rgba(239,68,68,0.1)", border:"1px solid rgba(239,68,68,0.3)", borderRadius:6, color:"#ef4444", fontSize:12, cursor:"pointer" },
  btnSuccess: { padding:"6px 12px", background:"rgba(34,197,94,0.1)", border:"1px solid rgba(34,197,94,0.3)", borderRadius:6, color:"#22c55e", fontSize:12, cursor:"pointer" },
  btnBlue: { padding:"6px 12px", background:"rgba(59,130,246,0.1)", border:"1px solid rgba(59,130,246,0.3)", borderRadius:6, color:"#3b82f6", fontSize:12, cursor:"pointer" },
  input: { width:"100%", padding:"9px 12px", background:"rgba(255,255,255,0.04)", border:"1px solid var(--border)", borderRadius:8, color:"var(--text)", fontSize:13, outline:"none", boxSizing:"border-box" },
  select: { width:"100%", padding:"9px 12px", background:"rgba(255,255,255,0.04)", border:"1px solid var(--border)", borderRadius:8, color:"var(--text)", fontSize:13, outline:"none", cursor:"pointer", boxSizing:"border-box" },
  label: { fontSize:12, color:"var(--text-muted)", marginBottom:4, display:"block", fontWeight:500 },
  emptyState: { textAlign:"center", padding:"48px 24px", color:"var(--text-muted)" },
  upgradeWall: { display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"100%", gap:12, textAlign:"center", padding:40 },
};

// ─── Ícones ───────────────────────────────────────────────────────────────────
const Ic = {
  calendar: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>,
  list:     <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>,
  settings: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  link:     <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>,
  users:    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  sun:      <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>,
  moon:     <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>,
  back:     <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>,
  plus:     <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>,
  trash:    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2"/></svg>,
  copy:     <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>,
  check:    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="20,6 9,17 4,12"/></svg>,
  star:     <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/></svg>,
  crown:    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M2 20h20M4 20L2 8l6 4 4-8 4 8 6-4-2 12"/></svg>,
  toggle_on:  <svg width="32" height="18" viewBox="0 0 32 18" fill="none"><rect width="32" height="18" rx="9" fill="#22c55e"/><circle cx="23" cy="9" r="7" fill="white"/></svg>,
  toggle_off: <svg width="32" height="18" viewBox="0 0 32 18" fill="none"><rect width="32" height="18" rx="9" fill="rgba(156,163,175,0.3)"/><circle cx="9" cy="9" r="7" fill="rgba(156,163,175,0.8)"/></svg>,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const DIAS_SEMANA = [
  {key:"dom",label:"Dom"},{key:"seg",label:"Seg"},{key:"ter",label:"Ter"},
  {key:"qua",label:"Qua"},{key:"qui",label:"Qui"},{key:"sex",label:"Sex"},{key:"sab",label:"Sáb"},
];
function formatDate(ts) {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString("pt-BR",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"});
}
function formatDateShort(ts) {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString("pt-BR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"});
}
function statusColor(s){ return s==="confirmado"?"green":s==="pendente"?"yellow":s==="cancelado"?"red":"gray"; }
function statusLabel(s){ return s==="confirmado"?"Confirmado":s==="pendente"?"Pendente":s==="cancelado"?"Cancelado":s; }
function initials(nome){ return (nome||"?").split(" ").slice(0,2).map(w=>w[0]).join("").toUpperCase(); }
function formatDuracao(min){ if(min<60) return `${min} min`; const h=Math.floor(min/60),m=min%60; return m===0?`${h}h`:`${h}h${m}min`; }
function cargoLabel(c){ const map={financeiro:"Financeiro",comercial:"Comercial",compras:"Compras",operacional:"Operacional",vendedor:"Vendedor",suporte:"Suporte",admin:"Administrador"}; return map[c]||c; }

const CONFIG_DEFAULT = {
  serviços:[],diasAtivos:["seg","ter","qua","qui","sex"],
  horaInicio:"08:00",horaFim:"18:00",granularidadeMinutos:30,
  nomeEmpresa:"",descricao:"",
};

// ─── useToast ─────────────────────────────────────────────────────────────────
function useToast(){
  const [t,setT]=useState(null);
  const show=(msg,type="success")=>{setT({msg,type});setTimeout(()=>setT(null),3000);};
  return [t,show];
}
function Toast({t}){
  if(!t?.msg) return null;
  return <div style={{position:"fixed",bottom:24,right:24,padding:"12px 20px",borderRadius:10,background:t.type==="success"?"rgba(34,197,94,0.15)":"rgba(239,68,68,0.15)",border:`1px solid ${t.type==="success"?"rgba(34,197,94,0.4)":"rgba(239,68,68,0.4)"}`,color:t.type==="success"?"#22c55e":"#ef4444",fontSize:13,fontWeight:600,zIndex:999,backdropFilter:"blur(8px)"}}>{t.msg}</div>;
}
function Loading({h=200}){
  return <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:h,gap:10,color:"var(--text-muted)",fontSize:13}}>
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2" style={{animation:"spin 0.8s linear infinite"}}>
      <circle cx="12" cy="12" r="10" strokeOpacity="0.2"/><path d="M12 2a10 10 0 0 1 10 10"/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </svg>Carregando…
  </div>;
}
function Avatar({nome,size=36}){
  return <div style={{width:size,height:size,borderRadius:size/3,background:"linear-gradient(135deg,var(--gold) 0%,#1a3a5c 100%)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:size*0.38,fontWeight:700,color:"#fff",flexShrink:0}}>{initials(nome)}</div>;
}
function StatusBar({label,value,total,color}){
  const pct=total>0?Math.round((value/total)*100):0;
  return <div><div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{fontSize:12,color:"var(--text)"}}>{label}</span><span style={{fontSize:12,color:"var(--text-muted)"}}>{value} ({pct}%)</span></div><div style={{height:6,background:"var(--border)",borderRadius:3,overflow:"hidden"}}><div style={{height:"100%",width:`${pct}%`,background:color,borderRadius:3,transition:"width 0.4s"}}/></div></div>;
}
function CheckItem({ok,label}){
  return <div style={{display:"flex",gap:6,alignItems:"center"}}><div style={{width:18,height:18,borderRadius:"50%",background:ok?"rgba(34,197,94,0.15)":"rgba(156,163,175,0.1)",border:`1px solid ${ok?"rgba(34,197,94,0.4)":"var(--border)"}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,color:ok?"#22c55e":"var(--text-muted)",flexShrink:0}}>{ok?"✓":"○"}</div><span style={{fontSize:12,color:ok?"var(--text)":"var(--text-muted)"}}>{label}</span></div>;
}

// ─── Visão Geral ──────────────────────────────────────────────────────────────
function TelaVisaoGeral({tenantUid,prestadores,meuPrestadorId,isAdmin}){
  const [reservas,setReservas]=useState([]);
  const [loading,setLoading]=useState(true);
  const [filtroP,setFiltroP]=useState(isAdmin?"todos":meuPrestadorId);

  useEffect(()=>{
    if(!tenantUid) return;
    const q=query(collection(db,"users",tenantUid,"agendamento_reservas"),orderBy("criadoEm","desc"));
    const u=onSnapshot(q,snap=>{
      let docs=snap.docs.map(d=>({id:d.id,...d.data()}));
      if(!isAdmin&&meuPrestadorId) docs=docs.filter(r=>r.prestadorId===meuPrestadorId);
      setReservas(docs); setLoading(false);
    });
    return()=>u();
  },[tenantUid]);

  const hoje=new Date(); hoje.setHours(0,0,0,0);
  const amanha=new Date(hoje); amanha.setDate(amanha.getDate()+1);
  const semana=new Date(hoje); semana.setDate(semana.getDate()+7);
  const f=isAdmin&&filtroP!=="todos"?reservas.filter(r=>r.prestadorId===filtroP):reservas;
  const total=f.length,confirmadas=f.filter(r=>r.status==="confirmado").length,pendentes=f.filter(r=>r.status==="pendente").length,canceladas=f.filter(r=>r.status==="cancelado").length;
  const hojeR=f.filter(r=>{if(!r.data_hora_inicio)return false;const d=r.data_hora_inicio.toDate?r.data_hora_inicio.toDate():new Date(r.data_hora_inicio);return d>=hoje&&d<amanha;});
  const semanaR=f.filter(r=>{if(!r.data_hora_inicio)return false;const d=r.data_hora_inicio.toDate?r.data_hora_inicio.toDate():new Date(r.data_hora_inicio);return d>=hoje&&d<semana;});
  const proximas=f.filter(r=>{if(!r.data_hora_inicio||r.status==="cancelado")return false;const d=r.data_hora_inicio.toDate?r.data_hora_inicio.toDate():new Date(r.data_hora_inicio);return d>=hoje;}).sort((a,b)=>{const da=a.data_hora_inicio.toDate?a.data_hora_inicio.toDate():new Date(a.data_hora_inicio),db2=b.data_hora_inicio.toDate?b.data_hora_inicio.toDate():new Date(b.data_hora_inicio);return da-db2;}).slice(0,5);

  if(loading) return <Loading/>;
  return (
    <div style={{display:"flex",flexDirection:"column",gap:20}}>
      {isAdmin&&prestadores.filter(p=>p.ativo).length>1&&(
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <label style={{...S.label,marginBottom:0,whiteSpace:"nowrap"}}>Visualizando:</label>
          <select style={{...S.select,width:"auto",minWidth:200}} value={filtroP} onChange={e=>setFiltroP(e.target.value)}>
            <option value="todos">Toda a equipe</option>
            {prestadores.filter(p=>p.ativo).map(p=><option key={p.id} value={p.id}>{p.nome}{p.isAdmin?" (você)":""}</option>)}
          </select>
        </div>
      )}
      <div style={S.grid4}>
        <div style={S.statCard}><p style={{fontSize:20,marginBottom:6}}>📋</p><p style={{fontSize:28,fontWeight:700,color:"var(--gold)"}}>{total}</p><p style={{fontSize:13,color:"var(--text)",fontWeight:600}}>Total de Reservas</p></div>
        <div style={S.statCard}><p style={{fontSize:20,marginBottom:6}}>📅</p><p style={{fontSize:28,fontWeight:700,color:"var(--gold)"}}>{hojeR.length}</p><p style={{fontSize:13,color:"var(--text)",fontWeight:600}}>Hoje</p></div>
        <div style={S.statCard}><p style={{fontSize:20,marginBottom:6}}>📆</p><p style={{fontSize:28,fontWeight:700,color:"var(--gold)"}}>{semanaR.length}</p><p style={{fontSize:13,color:"var(--text)",fontWeight:600}}>Esta Semana</p></div>
        <div style={S.statCard}><p style={{fontSize:20,marginBottom:6}}>⏳</p><p style={{fontSize:28,fontWeight:700,color:"#eab308"}}>{pendentes}</p><p style={{fontSize:13,color:"var(--text)",fontWeight:600}}>Pendentes</p></div>
      </div>
      <div style={S.grid2}>
        <div style={S.card}>
          <p style={S.sectionTitle}>Status das Reservas</p>
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <StatusBar label="Confirmadas" value={confirmadas} total={total} color="#22c55e"/>
            <StatusBar label="Pendentes" value={pendentes} total={total} color="#eab308"/>
            <StatusBar label="Canceladas" value={canceladas} total={total} color="#ef4444"/>
          </div>
        </div>
        <div style={S.card}>
          <p style={S.sectionTitle}>Próximos Agendamentos</p>
          {proximas.length===0?<div style={S.emptyState}><p style={{fontSize:13}}>Nenhum agendamento futuro</p></div>:(
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {proximas.map(r=>{
                const pr=prestadores.find(p=>p.id===r.prestadorId);
                return <div key={r.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 10px",background:"rgba(255,255,255,0.02)",borderRadius:8,border:"1px solid var(--border)"}}>
                  <div>
                    <p style={{fontSize:13,fontWeight:600,color:"var(--text)",marginBottom:2}}>{r.cliente_nome||"Cliente"}</p>
                    <p style={{fontSize:11,color:"var(--text-muted)"}}>{r.servico_nome} · {formatDateShort(r.data_hora_inicio)}{pr&&<span style={{color:"var(--gold)",marginLeft:4}}>· {pr.nome}</span>}</p>
                  </div>
                  <span style={S.badge(statusColor(r.status))}>{statusLabel(r.status)}</span>
                </div>;
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Tela Equipe ──────────────────────────────────────────────────────────────
// Lê usuários do AG + admin → permite ativar/desativar no Flow
// NÃO cria cadastro paralelo — usa os dados do AG direto
function TelaEquipe({tenantUid,user,prestadores,onConfigurar}){
  const [usuarios,setUsuarios]=useState([]);
  const [loadingU,setLoadingU]=useState(true);
  const [editando,setEditando]=useState(null);        // { prestadorId, esp } modal de especialidade
  const [salvando,setSalvando]=useState(null);
  const [copied,setCopied]=useState(null);
  const [t,showT]=useToast();

  // Lê usuarios do AG (mesma coleção que Usuarios.jsx)
  useEffect(()=>{
    if(!tenantUid) return;
    const q=query(collection(db,"users",tenantUid,"usuarios"),orderBy("criadoEm","asc"));
    const u=onSnapshot(q,snap=>{
      setUsuarios(snap.docs.map(d=>({uid:d.id,...d.data()})));
      setLoadingU(false);
    });
    return()=>u();
  },[tenantUid]);

  // Ativa usuário no Flow → cria/atualiza agendamento_prestadores/{uid}
  const ativar = async(usr)=>{
    setSalvando(usr.uid);
    try {
      await setDoc(doc(db,"users",tenantUid,"agendamento_prestadores",usr.uid),{
        nome:          usr.nome||"Sem nome",
        especialidade: cargoLabel(usr.cargo)||"Colaborador",
        linkedUserId:  usr.uid,
        ativo:         true,
        isAdmin:       false,
        criadoEm:      serverTimestamp(),
      },{merge:true});
      showT(`${usr.nome} ativado no Flow!`);
    } catch { showT("Erro ao ativar.","error"); }
    setSalvando(null);
  };

  // Desativa → ativo=false, não exclui os dados
  const desativar = async(pid, nome)=>{
    if(!window.confirm(`Desativar ${nome} do Flow? As reservas existentes não serão afetadas.`)) return;
    setSalvando(pid);
    try {
      await updateDoc(doc(db,"users",tenantUid,"agendamento_prestadores",pid),{ativo:false});
      showT("Desativado do Flow.");
    } catch { showT("Erro.","error"); }
    setSalvando(null);
  };

  // Salva especialidade (label exibida na página pública)
  const salvarEsp = async()=>{
    if(!editando) return;
    setSalvando(editando.prestadorId);
    try {
      await updateDoc(doc(db,"users",tenantUid,"agendamento_prestadores",editando.prestadorId),{especialidade:editando.esp});
      showT("Especialidade salva!");
      setEditando(null);
    } catch { showT("Erro.","error"); }
    setSalvando(null);
  };

  const copiar=(pid)=>{
    navigator.clipboard.writeText(`${PUBLIC_BASE}?tenant=${tenantUid}&prestador=${pid}`);
    setCopied(pid); setTimeout(()=>setCopied(null),2500);
  };

  // Helper: encontra prestador correspondente ao uid
  const getPrestador = uid => prestadores.find(p=>p.id===uid)||null;
  const adminPrestador = prestadores.find(p=>p.isAdmin)||null;

  if(loadingU) return <Loading/>;

  return (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <Toast t={t}/>

      {/* Cabeçalho */}
      <div>
        <p style={{fontSize:15,fontWeight:600,color:"var(--text)",marginBottom:4}}>Equipe no Flow</p>
        <p style={{fontSize:12,color:"var(--text-muted)"}}>Ative os colaboradores cadastrados no AG para que tenham sua própria agenda pública. Cada um configura seus serviços e horários de forma independente.</p>
      </div>

      {/* Linha do Admin (sempre ativo, não pode ser desativado) */}
      <div style={{...S.card,borderColor:adminPrestador?"rgba(212,175,55,0.3)":"var(--border)",display:"flex",alignItems:"center",gap:14}}>
        <Avatar nome={user.displayName||user.email}/>
        <div style={{flex:1}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}>
            <p style={{fontSize:14,fontWeight:700,color:"var(--text)"}}>{user.displayName||"Administrador"}</p>
            <span style={{...S.badge("yellow"),display:"flex",alignItems:"center",gap:4,fontSize:10}}>{Ic.crown} Admin</span>
          </div>
          <p style={{fontSize:12,color:"var(--text-muted)"}}>{user.email}</p>
          {adminPrestador?.especialidade&&<p style={{fontSize:11,color:"var(--gold)",marginTop:2}}>{adminPrestador.especialidade}</p>}
        </div>
        {/* Especialidade do admin */}
        <button style={S.btnBlue} onClick={()=>setEditando({prestadorId:"admin",esp:adminPrestador?.especialidade||""})}>{Ic.settings}</button>
        {/* Configurar agenda */}
        <button style={S.btnBlue} title="Configurar agenda" onClick={()=>onConfigurar("admin")}>{Ic.settings} Configurar</button>
        {/* Copiar link */}
        <button style={{...S.btnGhost,color:copied==="admin"?"#22c55e":"var(--text-muted)"}} onClick={()=>copiar("admin")}>
          {copied==="admin"?<>{Ic.check} Copiado!</>:<>{Ic.copy} Link</>}
        </button>
        <span style={S.badge("green")}>Ativo</span>
      </div>

      {/* Linha dos colaboradores */}
      {usuarios.length===0?(
        <div style={{...S.card,...S.emptyState}}>
          <p style={{fontSize:24,marginBottom:8}}>👥</p>
          <p style={{fontSize:13,color:"var(--text)"}}>Nenhum colaborador cadastrado no AG ainda.</p>
          <p style={{fontSize:12,color:"var(--text-muted)",marginTop:4}}>Adicione usuários em <strong>Usuários</strong> para ativá-los aqui.</p>
        </div>
      ):(
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {usuarios.map(usr=>{
            const pr=getPrestador(usr.uid);
            const ativoFlow=pr?.ativo===true;
            const isAtivo=usr.ativo!==false;

            return (
              <div key={usr.uid} style={{...S.card,display:"flex",alignItems:"center",gap:14,opacity:isAtivo?1:0.5}}>
                <Avatar nome={usr.nome}/>
                <div style={{flex:1}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}>
                    <p style={{fontSize:14,fontWeight:600,color:"var(--text)"}}>{usr.nome}</p>
                    <span style={{...S.badge("blue"),fontSize:10}}>{cargoLabel(usr.cargo)}</span>
                    {!isAtivo&&<span style={{...S.badge("gray"),fontSize:10}}>Inativo no AG</span>}
                  </div>
                  <p style={{fontSize:12,color:"var(--text-muted)"}}>{usr.email}</p>
                  {pr?.especialidade&&<p style={{fontSize:11,color:"var(--gold)",marginTop:2}}>{pr.especialidade}</p>}
                </div>

                {/* Toggle + ações (só se ativo no AG) */}
                {isAtivo?(
                  <div style={{display:"flex",gap:8,alignItems:"center"}}>
                    {ativoFlow&&(
                      <>
                        {/* Editar especialidade */}
                        <button style={S.btnBlue} title="Editar especialidade" onClick={()=>setEditando({prestadorId:usr.uid,esp:pr?.especialidade||cargoLabel(usr.cargo)})}>{Ic.settings}</button>
                        {/* Configurar agenda */}
                        <button style={S.btnBlue} title="Configurar agenda" onClick={()=>onConfigurar(usr.uid)}>{Ic.settings} Configurar</button>
                        {/* Copiar link */}
                        <button style={{...S.btnGhost,color:copied===usr.uid?"#22c55e":"var(--text-muted)"}} onClick={()=>copiar(usr.uid)}>
                          {copied===usr.uid?<>{Ic.check} Copiado!</>:<>{Ic.copy} Link</>}
                        </button>
                      </>
                    )}
                    {/* Toggle Flow */}
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <span style={{fontSize:11,color:ativoFlow?"#22c55e":"var(--text-muted)"}}>
                        {ativoFlow?"Ativo no Flow":"Inativo no Flow"}
                      </span>
                      <button onClick={()=>ativoFlow?desativar(usr.uid,usr.nome):ativar(usr)} disabled={salvando===usr.uid} style={{background:"none",border:"none",cursor:"pointer",padding:0,opacity:salvando===usr.uid?0.4:1}}>
                        {ativoFlow?Ic.toggle_on:Ic.toggle_off}
                      </button>
                    </div>
                  </div>
                ):(
                  <span style={{fontSize:11,color:"var(--text-muted)"}}>Reative no AG para usar no Flow</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal especialidade */}
      {editando&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.65)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200}}>
          <div style={{background:"var(--s1)",border:"1px solid var(--border)",borderRadius:14,padding:24,width:360,display:"flex",flexDirection:"column",gap:16}}>
            <p style={{fontSize:14,fontWeight:700,color:"var(--text)"}}>Especialidade / Título</p>
            <p style={{fontSize:12,color:"var(--text-muted)"}}>Exibido na página pública do agendamento, abaixo do nome.</p>
            <div>
              <label style={S.label}>Especialidade</label>
              <input style={S.input} value={editando.esp} onChange={e=>setEditando(p=>({...p,esp:e.target.value}))} placeholder="Ex: Nail Designer, Cabeleireira..." autoFocus/>
            </div>
            <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
              <button style={S.btnGhost} onClick={()=>setEditando(null)}>Cancelar</button>
              <button style={S.btnPrimary} onClick={salvarEsp} disabled={salvando}>Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tela Reservas ────────────────────────────────────────────────────────────
function TelaReservas({tenantUid,prestadores,meuPrestadorId,isAdmin,podeEditar}){
  const [reservas,setReservas]=useState([]);
  const [loading,setLoading]=useState(true);
  const [filtroStatus,setFiltroStatus]=useState("todos");
  const [filtroData,setFiltroData]=useState("");
  const [filtroP,setFiltroP]=useState(isAdmin?"todos":meuPrestadorId);
  const [atualizando,setAtualizando]=useState(null);
  const [t,showT]=useToast();

  useEffect(()=>{
    if(!tenantUid) return;
    const q=query(collection(db,"users",tenantUid,"agendamento_reservas"),orderBy("data_hora_inicio","desc"));
    const u=onSnapshot(q,snap=>{
      let docs=snap.docs.map(d=>({id:d.id,...d.data()}));
      if(!isAdmin&&meuPrestadorId) docs=docs.filter(r=>r.prestadorId===meuPrestadorId);
      setReservas(docs); setLoading(false);
    });
    return()=>u();
  },[tenantUid]);

  const atualizarStatus=async(id,novoStatus)=>{
    if(!podeEditar) return;
    setAtualizando(id);
    try {
      await updateDoc(doc(db,"users",tenantUid,"agendamento_reservas",id),{status:novoStatus,atualizadoEm:serverTimestamp()});
      showT(novoStatus==="confirmado"?"Confirmada!":"Cancelada.",novoStatus==="confirmado"?"success":"error");
    } catch { showT("Erro.","error"); }
    setAtualizando(null);
  };

  let f=reservas;
  if(isAdmin&&filtroP!=="todos") f=f.filter(r=>r.prestadorId===filtroP);
  if(filtroStatus!=="todos") f=f.filter(r=>r.status===filtroStatus);
  if(filtroData){ const d0=new Date(filtroData+"T00:00:00"),d1=new Date(filtroData+"T23:59:59"); f=f.filter(r=>{if(!r.data_hora_inicio)return false;const d=r.data_hora_inicio.toDate?r.data_hora_inicio.toDate():new Date(r.data_hora_inicio);return d>=d0&&d<=d1;}); }

  if(loading) return <Loading/>;
  const prestadoresAtivos=prestadores.filter(p=>p.ativo);
  return (
    <div style={{position:"relative"}}>
      <Toast t={t}/>
      <div style={{display:"flex",gap:10,marginBottom:16,alignItems:"center",flexWrap:"wrap"}}>
        {isAdmin&&prestadoresAtivos.length>1&&(
          <select style={{...S.select,width:"auto",minWidth:180}} value={filtroP} onChange={e=>setFiltroP(e.target.value)}>
            <option value="todos">Toda a equipe</option>
            {prestadoresAtivos.map(p=><option key={p.id} value={p.id}>{p.nome}{p.isAdmin?" (você)":""}</option>)}
          </select>
        )}
        <div style={{display:"flex",gap:6}}>
          {["todos","pendente","confirmado","cancelado"].map(s=>(
            <button key={s} onClick={()=>setFiltroStatus(s)} style={{padding:"6px 14px",borderRadius:20,border:filtroStatus===s?"1px solid var(--gold)":"1px solid var(--border)",background:filtroStatus===s?"rgba(212,175,55,0.12)":"transparent",color:filtroStatus===s?"var(--gold)":"var(--text-muted)",fontSize:12,fontWeight:filtroStatus===s?600:400,cursor:"pointer"}}>
              {s==="todos"?"Todos":statusLabel(s)}
            </button>
          ))}
        </div>
        <input type="date" value={filtroData} onChange={e=>setFiltroData(e.target.value)} style={{...S.input,width:160}}/>
        {filtroData&&<button onClick={()=>setFiltroData("")} style={S.btnGhost}>Limpar</button>}
        <span style={{marginLeft:"auto",fontSize:12,color:"var(--text-muted)"}}>{f.length} reserva{f.length!==1?"s":""}</span>
      </div>
      <div style={{...S.card,padding:0,overflow:"hidden"}}>
        {f.length===0?(
          <div style={S.emptyState}><p style={{fontSize:24,marginBottom:8}}>📭</p><p style={{fontSize:13,fontWeight:600,color:"var(--text)"}}>Nenhuma reserva encontrada</p></div>
        ):(
          <table style={S.table}>
            <thead><tr>
              <th style={S.th}>Cliente</th>
              {isAdmin&&prestadoresAtivos.length>1&&<th style={S.th}>Prestador</th>}
              <th style={S.th}>Serviço</th><th style={S.th}>Data/Hora</th>
              <th style={S.th}>Status</th><th style={S.th}>Criado em</th>
              {podeEditar&&<th style={S.th}>Ações</th>}
            </tr></thead>
            <tbody>
              {f.map(r=>{
                const pr=prestadores.find(p=>p.id===r.prestadorId);
                return (
                  <tr key={r.id}>
                    <td style={S.td}>
                      <span style={{fontWeight:600,color:"var(--text)",display:"block"}}>{r.cliente_nome||"—"}</span>
                      {r.cliente_email&&<span style={{fontSize:11,color:"var(--text-muted)",display:"block"}}>{r.cliente_email}</span>}
                      {r.cliente_telefone&&<span style={{fontSize:11,color:"var(--text-muted)",display:"block"}}>{r.cliente_telefone}</span>}
                    </td>
                    {isAdmin&&prestadoresAtivos.length>1&&(
                      <td style={S.td}>
                        <div style={{display:"flex",alignItems:"center",gap:8}}>
                          <Avatar nome={pr?.nome||"?"} size={26}/>
                          <span style={{fontSize:12,color:"var(--text-muted)"}}>{pr?.nome||"—"}</span>
                        </div>
                      </td>
                    )}
                    <td style={S.td}><span style={{display:"block"}}>{r.servico_nome||"—"}</span>{r.servico_duracao_min&&<span style={{fontSize:11,color:"var(--text-muted)"}}>{formatDuracao(r.servico_duracao_min)}</span>}</td>
                    <td style={S.td}><span style={{fontSize:13}}>{formatDate(r.data_hora_inicio)}</span></td>
                    <td style={S.td}><span style={S.badge(statusColor(r.status))}>{statusLabel(r.status)}</span></td>
                    <td style={S.td}><span style={{fontSize:12,color:"var(--text-muted)"}}>{formatDate(r.criadoEm)}</span></td>
                    {podeEditar&&(
                      <td style={S.td}>
                        <div style={{display:"flex",gap:6}}>
                          {r.status==="pendente"&&<><button onClick={()=>atualizarStatus(r.id,"confirmado")} disabled={atualizando===r.id} style={S.btnSuccess}>✓ Confirmar</button><button onClick={()=>atualizarStatus(r.id,"cancelado")} disabled={atualizando===r.id} style={S.btnDanger}>✕ Cancelar</button></>}
                          {r.status==="confirmado"&&<button onClick={()=>atualizarStatus(r.id,"cancelado")} disabled={atualizando===r.id} style={S.btnDanger}>✕ Cancelar</button>}
                          {r.status==="cancelado"&&<button onClick={()=>atualizarStatus(r.id,"pendente")} disabled={atualizando===r.id} style={S.btnGhost}>↺ Reabrir</button>}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─── Tela Configurações ───────────────────────────────────────────────────────
// Admin: dropdown com todos os prestadores ativos
// Membro: só vê o próprio (prestadorId = user.uid)
function TelaConfiguracoes({tenantUid,prestadores,meuPrestadorId,isAdmin,prestadorFoco}){
  // prestadorFoco: quando vem de "Configurar" na Equipe, já abre no prestador certo
  const [prestadorId,setPrestadorId]=useState(prestadorFoco||(isAdmin?"admin":meuPrestadorId));
  const [config,setConfig]=useState(CONFIG_DEFAULT);
  const [loading,setLoading]=useState(true);
  const [salvando,setSalvando]=useState(false);
  const [novoS,setNovoS]=useState({nome:"",duracao:60,preco:"",descricao:""});
  const [t,showT]=useToast();

  // Atualiza se prestadorFoco mudar (click em "Configurar" de outro prestador)
  useEffect(()=>{ if(prestadorFoco) setPrestadorId(prestadorFoco); },[prestadorFoco]);

  useEffect(()=>{
    if(!tenantUid||!prestadorId){ setLoading(false); return; }
    setLoading(true);
    const u=onSnapshot(doc(db,"users",tenantUid,"agendamento_configuracoes",prestadorId),snap=>{
      setConfig(snap.exists()?{...CONFIG_DEFAULT,...snap.data()}:{...CONFIG_DEFAULT});
      setLoading(false);
    });
    return()=>u();
  },[tenantUid,prestadorId]);

  const salvar=async()=>{
    if(!prestadorId) return;
    setSalvando(true);
    try {
      await setDoc(doc(db,"users",tenantUid,"agendamento_configuracoes",prestadorId),{...config,atualizadoEm:serverTimestamp()},{merge:true});
      showT("Configurações salvas!");
    } catch { showT("Erro ao salvar.","error"); }
    setSalvando(false);
  };

  const addServico=()=>{
    if(!novoS.nome.trim()) return;
    const s={id:Date.now().toString(),nome:novoS.nome.trim(),duracao_min:parseInt(novoS.duracao)||60,preco:parseFloat(novoS.preco)||0,descricao:novoS.descricao.trim(),ativo:true};
    setConfig(p=>({...p,serviços:[...(p.serviços||[]),s]}));
    setNovoS({nome:"",duracao:60,preco:"",descricao:""});
  };

  const toggleDia=k=>setConfig(p=>({...p,diasAtivos:p.diasAtivos.includes(k)?p.diasAtivos.filter(d=>d!==k):[...p.diasAtivos,k]}));
  const prestadoresAtivos=prestadores.filter(p=>p.ativo);
  const prestadorAtual=prestadores.find(p=>p.id===prestadorId);

  if(!isAdmin&&!meuPrestadorId) return (
    <div style={S.emptyState}>
      <p style={{fontSize:32,marginBottom:8}}>🔗</p>
      <p style={{fontSize:13,fontWeight:600,color:"var(--text)",marginBottom:4}}>Conta não vinculada ao Flow</p>
      <p style={{fontSize:12,color:"var(--text-muted)"}}>Peça ao administrador para ativar você na tela Equipe.</p>
    </div>
  );
  if(!prestadorId) return <div style={S.emptyState}><p style={{fontSize:13,color:"var(--text)"}}>Nenhum prestador selecionado.</p></div>;

  return (
    <div style={{display:"flex",flexDirection:"column",gap:20}}>
      <Toast t={t}/>

      {/* Seletor (admin) */}
      {isAdmin&&prestadoresAtivos.length>1&&(
        <div style={{...S.card,padding:"14px 16px"}}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <label style={{...S.label,marginBottom:0,whiteSpace:"nowrap"}}>Configurando:</label>
            <select style={{...S.select,width:"auto",minWidth:220}} value={prestadorId||""} onChange={e=>setPrestadorId(e.target.value)}>
              {prestadoresAtivos.map(p=><option key={p.id} value={p.id}>{p.nome}{p.isAdmin?" (você)":""}{p.especialidade?` · ${p.especialidade}`:""}</option>)}
            </select>
            {prestadorAtual&&<span style={S.badge(prestadorAtual.ativo?"green":"gray")}>{prestadorAtual.ativo?"Ativo":"Inativo"}</span>}
          </div>
        </div>
      )}

      {/* Header membro */}
      {!isAdmin&&prestadorAtual&&(
        <div style={{...S.card,padding:"12px 16px",display:"flex",alignItems:"center",gap:12}}>
          <Avatar nome={prestadorAtual.nome}/>
          <div><p style={{fontSize:14,fontWeight:600,color:"var(--text)"}}>{prestadorAtual.nome}</p><p style={{fontSize:12,color:"var(--text-muted)"}}>{prestadorAtual.especialidade||cargoLabel(prestadorAtual.cargo)}</p></div>
        </div>
      )}

      {loading?<Loading/>:<>
        {/* Dados */}
        <div style={S.card}>
          <p style={S.sectionTitle}>Dados exibidos na página pública</p>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
            <div><label style={S.label}>Nome na página pública</label><input style={S.input} value={config.nomeEmpresa||""} onChange={e=>setConfig(p=>({...p,nomeEmpresa:e.target.value}))} placeholder="Ex: Ana – Nail Designer"/></div>
            <div><label style={S.label}>Descrição curta</label><input style={S.input} value={config.descricao||""} onChange={e=>setConfig(p=>({...p,descricao:e.target.value}))} placeholder="Ex: Especialista em unhas de gel"/></div>
          </div>
        </div>

        {/* Horários */}
        <div style={S.card}>
          <p style={S.sectionTitle}>Horários de Atendimento</p>
          <label style={S.label}>Dias de Atendimento</label>
          <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
            {DIAS_SEMANA.map(d=>{const a=(config.diasAtivos||[]).includes(d.key);return <button key={d.key} onClick={()=>toggleDia(d.key)} style={{width:44,height:44,borderRadius:8,border:a?"1px solid var(--gold)":"1px solid var(--border)",background:a?"rgba(212,175,55,0.15)":"transparent",color:a?"var(--gold)":"var(--text-muted)",fontSize:12,fontWeight:a?700:400,cursor:"pointer"}}>{d.label}</button>;})}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:14}}>
            <div><label style={S.label}>Início do Expediente</label><input type="time" style={S.input} value={config.horaInicio||"08:00"} onChange={e=>setConfig(p=>({...p,horaInicio:e.target.value}))}/></div>
            <div><label style={S.label}>Fim do Expediente</label><input type="time" style={S.input} value={config.horaFim||"18:00"} onChange={e=>setConfig(p=>({...p,horaFim:e.target.value}))}/></div>
            <div>
              <label style={S.label}>Granularidade dos horários</label>
              <select style={S.select} value={config.granularidadeMinutos||30} onChange={e=>setConfig(p=>({...p,granularidadeMinutos:parseInt(e.target.value)}))}>
                {[5,10,15,20,30,45,60].map(v=><option key={v} value={v}>{v<60?`${v} min`:"1h"}</option>)}
              </select>
            </div>
          </div>
          <p style={{fontSize:11,color:"var(--text-muted)",marginTop:10}}>💡 Granularidade = passo entre os horários disponíveis. A duração real de cada serviço é respeitada — sem janelas desperdiçadas.</p>
        </div>

        {/* Serviços */}
        <div style={S.card}>
          <p style={S.sectionTitle}>Serviços Oferecidos</p>
          {(config.serviços||[]).length>0&&(
            <div style={{marginBottom:16}}>
              <table style={S.table}>
                <thead><tr><th style={S.th}>Nome</th><th style={S.th}>Duração</th><th style={S.th}>Preço</th><th style={S.th}>Descrição</th><th style={S.th}></th></tr></thead>
                <tbody>{config.serviços.map(s=>(
                  <tr key={s.id}>
                    <td style={S.td}><span style={{fontWeight:600,color:"var(--text)"}}>{s.nome}</span></td>
                    <td style={S.td}><span style={{color:"var(--text-muted)"}}>{formatDuracao(s.duracao_min)}</span></td>
                    <td style={S.td}><span style={{color:"var(--gold)"}}>{s.preco>0?`R$ ${Number(s.preco).toLocaleString("pt-BR",{minimumFractionDigits:2})}`:"Gratuito"}</span></td>
                    <td style={S.td}><span style={{fontSize:12,color:"var(--text-muted)"}}>{s.descricao||"—"}</span></td>
                    <td style={S.td}><button style={S.btnDanger} onClick={()=>setConfig(p=>({...p,serviços:p.serviços.filter(x=>x.id!==s.id)}))}>{Ic.trash}</button></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
          <div style={{background:"rgba(255,255,255,0.02)",border:"1px dashed var(--border)",borderRadius:10,padding:16}}>
            <p style={{...S.label,marginBottom:12,color:"var(--text)",fontSize:13,fontWeight:600}}>+ Novo Serviço</p>
            <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr",gap:12,marginBottom:12}}>
              <div><label style={S.label}>Nome *</label><input style={S.input} value={novoS.nome} onChange={e=>setNovoS(p=>({...p,nome:e.target.value}))} placeholder="Ex: Manicure"/></div>
              <div><label style={S.label}>Duração</label><select style={S.select} value={novoS.duracao} onChange={e=>setNovoS(p=>({...p,duracao:e.target.value}))}>{[15,20,30,45,60,75,90,120,150,180,240].map(v=><option key={v} value={v}>{formatDuracao(v)}</option>)}</select></div>
              <div><label style={S.label}>Preço (R$)</label><input style={S.input} type="number" min="0" step="0.01" value={novoS.preco} onChange={e=>setNovoS(p=>({...p,preco:e.target.value}))} placeholder="0,00"/></div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:12,alignItems:"flex-end"}}>
              <div><label style={S.label}>Descrição (opcional)</label><input style={S.input} value={novoS.descricao} onChange={e=>setNovoS(p=>({...p,descricao:e.target.value}))} placeholder="Breve descrição"/></div>
              <button onClick={addServico} disabled={!novoS.nome.trim()} style={{...S.btnPrimary,height:38,opacity:novoS.nome.trim()?1:0.4}}>{Ic.plus} Adicionar</button>
            </div>
          </div>
        </div>

        <div style={{display:"flex",justifyContent:"flex-end"}}>
          <button onClick={salvar} disabled={salvando} style={{...S.btnPrimary,padding:"10px 28px",fontSize:14}}>{salvando?"Salvando…":"💾 Salvar Configurações"}</button>
        </div>
      </>}
    </div>
  );
}

// ─── Tela Link Público ────────────────────────────────────────────────────────
function TelaLinkPublico({tenantUid,prestadores,meuPrestadorId,isAdmin}){
  const [configs,setConfigs]=useState({});
  const [copied,setCopied]=useState(null);

  useEffect(()=>{
    if(!tenantUid||!prestadores.length) return;
    const ativos=prestadores.filter(p=>p.ativo);
    const unsubs=ativos.map(p=>{
      const ref=doc(db,"users",tenantUid,"agendamento_configuracoes",p.id);
      return onSnapshot(ref,snap=>setConfigs(prev=>({...prev,[p.id]:snap.exists()?snap.data():null})));
    });
    return()=>unsubs.forEach(u=>u());
  },[tenantUid,prestadores.length]);

  const copiar=id=>{ navigator.clipboard.writeText(id==="admin"?`${PUBLIC_BASE}?tenant=${tenantUid}`:`${PUBLIC_BASE}?tenant=${tenantUid}&prestador=${id}`); setCopied(id); setTimeout(()=>setCopied(null),2500); };
  const lista=isAdmin?prestadores.filter(p=>p.ativo):prestadores.filter(p=>p.id===meuPrestadorId);

  return (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      {/* Info URL admin */}
      {isAdmin&&(
        <div style={{padding:"10px 14px",background:"rgba(212,175,55,0.06)",border:"1px solid rgba(212,175,55,0.2)",borderRadius:10,fontSize:12,color:"var(--text-muted)"}}>
          ℹ️ O link do <strong style={{color:"var(--gold)"}}>Administrador</strong> é o link padrão da empresa — funciona sem o parâmetro <code style={{background:"rgba(255,255,255,0.06)",padding:"1px 5px",borderRadius:4}}>&prestador=</code>. Os links dos colaboradores incluem o parâmetro automaticamente.
        </div>
      )}

      {lista.length===0?<div style={{...S.card,...S.emptyState}}><p style={{fontSize:13}}>Nenhum prestador ativo.</p></div>:
        lista.map(p=>{
          const cfg=configs[p.id];
          const link=p.id==="admin"?`${PUBLIC_BASE}?tenant=${tenantUid}`:`${PUBLIC_BASE}?tenant=${tenantUid}&prestador=${p.id}`;
          const temS=cfg?.serviços?.length>0, temH=cfg?.diasAtivos?.length>0;
          return (
            <div key={p.id} style={S.card}>
              <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:14}}>
                <Avatar nome={p.nome}/>
                <div style={{flex:1}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:2}}>
                    <p style={{fontSize:14,fontWeight:600,color:"var(--text)"}}>{p.nome}</p>
                    {p.isAdmin&&<span style={{...S.badge("yellow"),display:"flex",alignItems:"center",gap:3,fontSize:10}}>{Ic.crown} Admin</span>}
                  </div>
                  <p style={{fontSize:12,color:"var(--text-muted)"}}>{p.especialidade||"Prestador de serviço"}</p>
                </div>
                <span style={S.badge(p.ativo?"green":"gray")}>{p.ativo?"Ativo":"Inativo"}</span>
              </div>
              <div style={{display:"flex",gap:16,marginBottom:12}}>
                <CheckItem ok={temH} label="Horários configurados"/>
                <CheckItem ok={temS} label="Serviços cadastrados"/>
                <CheckItem ok={!!cfg?.nomeEmpresa} label="Nome preenchido"/>
              </div>
              <div style={{display:"flex",gap:10,alignItems:"center",background:"rgba(255,255,255,0.02)",border:"1px solid var(--border)",borderRadius:10,padding:"10px 14px"}}>
                <span style={{fontSize:12,color:"var(--text)",flex:1,wordBreak:"break-all"}}>{link}</span>
                <button onClick={()=>copiar(p.id)} style={{...S.btnPrimary,background:copied===p.id?"rgba(34,197,94,0.15)":"var(--gold)",color:copied===p.id?"#22c55e":"#000",border:copied===p.id?"1px solid rgba(34,197,94,0.4)":"none",flexShrink:0,padding:"7px 14px"}}>
                  {copied===p.id?<>{Ic.check} Copiado!</>:<>{Ic.copy} Copiar</>}
                </button>
              </div>
              {(!temS||!temH)&&<div style={{marginTop:10,padding:"8px 12px",background:"rgba(234,179,8,0.08)",border:"1px solid rgba(234,179,8,0.25)",borderRadius:8,fontSize:12,color:"#eab308"}}>⚠️ Configure serviços e horários antes de compartilhar este link.</div>}
            </div>
          );
        })
      }
    </div>
  );
}

// ─── Upgrade Wall ─────────────────────────────────────────────────────────────
function TelaUpgrade({onVoltar}){
  return (
    <div style={S.upgradeWall}>
      <div style={{width:64,height:64,borderRadius:16,background:"linear-gradient(135deg,var(--gold) 0%,#1a3a5c 100%)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:28}}>{Ic.star}</div>
      <h2 style={{fontSize:22,fontWeight:700,color:"var(--text)",marginBottom:8}}>Assent Flow</h2>
      <p style={{fontSize:14,color:"var(--text-muted)",maxWidth:360,lineHeight:1.6,marginBottom:20}}>Disponível no plano <strong style={{color:"var(--gold)"}}>Profissional</strong>.</p>
      <div style={{display:"flex",gap:12}}>
        <button style={{...S.btnPrimary,padding:"10px 24px"}} onClick={()=>window.open("mailto:contato@assentagencia.com.br?subject=Upgrade Profissional","_blank")}>⭐ Fazer Upgrade</button>
        <button onClick={onVoltar} style={S.btnGhost}>Voltar</button>
      </div>
    </div>
  );
}

// ─── Componente Principal ─────────────────────────────────────────────────────
export default function AssFlow({tenantUid,plano,theme,onToggleTheme,onVoltar}){
  // ── HOOKS PRIMEIRO ──────────────────────────────────────────────────────
  const {isAdmin,podeVer,podeEditar,user} = useAuth();
  const [tela,setTela]           = useState("overview");
  const [prestadores,setPrestadores] = useState([]);
  const [loadingP,setLoadingP]   = useState(true);
  const [prestadorFoco,setPrestadorFoco] = useState(null); // para navegação Equipe → Configurações

  // meuPrestadorId: admin="admin", membro=user.uid (se ativo no Flow)
  const meuPrestadorId = isAdmin ? "admin" : (prestadores.find(p=>p.linkedUserId===user?.uid&&p.ativo)?.id || null);

  // ── Auto-criação do prestador admin no primeiro acesso ────────────────
  // ID fixo "admin" — representa sempre o dono da conta
  useEffect(()=>{
    if(!tenantUid||!user||!isAdmin) return;
    const ref=doc(db,"users",tenantUid,"agendamento_prestadores","admin");
    getDoc(ref).then(snap=>{
      if(!snap.exists()){
        setDoc(ref,{
          nome:        user.displayName || user.email?.split("@")[0] || "Administrador",
          especialidade:"",
          linkedUserId: user.uid,
          ativo:       true,
          isAdmin:     true,
          criadoEm:    serverTimestamp(),
        });
      }
    });
  },[tenantUid, user?.uid]);

  // ── Carrega prestadores em tempo real ──────────────────────────────────
  useEffect(()=>{
    if(!tenantUid) return;
    const q=query(collection(db,"users",tenantUid,"agendamento_prestadores"),orderBy("criadoEm","asc"));
    const u=onSnapshot(q,snap=>{
      // Garante que o admin sempre vem primeiro
      const list=snap.docs.map(d=>({id:d.id,...d.data()}));
      const adminP=list.find(p=>p.id==="admin");
      const rest=list.filter(p=>p.id!=="admin");
      setPrestadores(adminP?[adminP,...rest]:rest);
      setLoadingP(false);
    });
    return()=>u();
  },[tenantUid]);

  // ── Guards ────────────────────────────────────────────────────────────
  if(!tenantUid) return null;
  if(plano!=="profissional") return <div style={S.root}><TelaUpgrade onVoltar={onVoltar}/></div>;
  if(!podeVer("agendamento")) return (
    <div style={{...S.root,alignItems:"center",justifyContent:"center"}}>
      <div style={{textAlign:"center",padding:40}}>
        <p style={{fontSize:32,marginBottom:12}}>🔒</p>
        <p style={{fontSize:15,fontWeight:600,color:"var(--text)",marginBottom:8}}>Acesso Restrito</p>
        <p style={{fontSize:13,color:"var(--text-muted)",marginBottom:20}}>Seu perfil não possui acesso ao módulo de Agendamentos.</p>
        <button onClick={onVoltar} style={S.btnGhost}>← Voltar ao Gestão</button>
      </div>
    </div>
  );

  const irParaConfiguracoes=(pid)=>{ setPrestadorFoco(pid); setTela("configuracoes"); };

  const TELAS=[
    {key:"overview",      label:"Visão Geral",    icon:Ic.calendar},
    ...(isAdmin?[{key:"equipe",label:"Equipe",icon:Ic.users}]:[]),
    {key:"reservas",      label:"Reservas",       icon:Ic.list},
    {key:"configuracoes", label:"Configurações",  icon:Ic.settings},
    {key:"link",          label:"Link Público",   icon:Ic.link},
  ];
  const titulos={overview:"Visão Geral",equipe:"Equipe no Flow",reservas:"Reservas",configuracoes:"Configurações",link:"Link Público"};

  return (
    <div style={S.root}>
      <aside style={S.sidebar}>
        <div style={S.sidebarHeader}>
          <div style={S.logoRow}>
            <div style={S.logoIcon}>F</div>
            <div><div style={S.logoText}>Flow</div><div style={S.logoSub}>Agendamentos</div></div>
          </div>
        </div>
        <nav style={{flex:1}}>
          {TELAS.map(t=><div key={t.key} style={S.navItem(tela===t.key)} onClick={()=>setTela(t.key)}>{t.icon}{t.label}</div>)}
        </nav>
        <div style={S.sidebarFooter}>
          <button style={S.btnSidebarSecondary} onClick={onToggleTheme}>{theme==="dark"?Ic.sun:Ic.moon}{theme==="dark"?"Modo Claro":"Modo Escuro"}</button>
          <button style={S.btnSidebarSecondary} onClick={onVoltar}>{Ic.back}Voltar ao Gestão</button>
        </div>
      </aside>
      <main style={S.main}>
        <header style={S.topbar}>
          <span style={S.topbarTitle}>{titulos[tela]}</span>
          <span style={{fontSize:11,padding:"3px 10px",borderRadius:20,border:"1px solid var(--border)",background:"rgba(212,175,55,0.08)",color:"var(--gold)",fontWeight:600,letterSpacing:0.5}}>★ Profissional</span>
        </header>
        <div style={S.content}>
          {loadingP?<Loading/>:<>
            {tela==="overview"      &&<TelaVisaoGeral    tenantUid={tenantUid} prestadores={prestadores} meuPrestadorId={meuPrestadorId} isAdmin={isAdmin}/>}
            {tela==="equipe"        &&<TelaEquipe        tenantUid={tenantUid} user={user} prestadores={prestadores} onConfigurar={irParaConfiguracoes}/>}
            {tela==="reservas"      &&<TelaReservas      tenantUid={tenantUid} prestadores={prestadores} meuPrestadorId={meuPrestadorId} isAdmin={isAdmin} podeEditar={podeEditar("agendamento")}/>}
            {tela==="configuracoes" &&<TelaConfiguracoes tenantUid={tenantUid} prestadores={prestadores} meuPrestadorId={meuPrestadorId} isAdmin={isAdmin} prestadorFoco={prestadorFoco}/>}
            {tela==="link"          &&<TelaLinkPublico   tenantUid={tenantUid} prestadores={prestadores} meuPrestadorId={meuPrestadorId} isAdmin={isAdmin}/>}
          </>}
        </div>
      </main>
    </div>
  );
}
