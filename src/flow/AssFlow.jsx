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

// ─── Design Tokens (espelha paleta do index.html público) ─────────────────────
// ink / gold / emerald — dark luxury, glass, aurora
const T = {
  ink:        "#040408",
  ink2:       "#07070D",
  ink3:       "#0C0C14",
  ink4:       "#111119",
  ink5:       "#17171F",
  gold:       "#C09B52",
  goldHi:     "#D9B96E",
  goldLo:     "#856830",
  goldA06:    "rgba(192,155,82,0.06)",
  goldA12:    "rgba(192,155,82,0.12)",
  goldA22:    "rgba(192,155,82,0.22)",
  goldA38:    "rgba(192,155,82,0.38)",
  text100:    "#EEEAE2",
  text65:     "rgba(238,234,226,0.65)",
  text35:     "rgba(238,234,226,0.35)",
  text18:     "rgba(238,234,226,0.18)",
  text08:     "rgba(238,234,226,0.08)",
  line:       "rgba(238,234,226,0.055)",
  lineHi:     "rgba(238,234,226,0.09)",
  emerald:    "#2DD37A",
  emeraldA10: "rgba(45,211,122,0.10)",
  emeraldA22: "rgba(45,211,122,0.22)",
  red:        "rgba(239,68,68,0.85)",
  redA06:     "rgba(239,68,68,0.06)",
  redA18:     "rgba(239,68,68,0.18)",
  blue:       "#60a5fa",
  blueA10:    "rgba(96,165,250,0.10)",
  blueA25:    "rgba(96,165,250,0.25)",
  glass:      "rgba(12,12,20,0.70)",
  glassHi:    "rgba(17,17,25,0.88)",
};

// ─── Estilos ──────────────────────────────────────────────────────────────────
const S = {
  root: {
    display:"flex", height:"100vh",
    background: T.ink,
    color: T.text100,
    fontFamily:"'Plus Jakarta Sans', 'Montserrat', system-ui, sans-serif",
    overflow:"hidden",
    WebkitFontSmoothing:"antialiased",
  },

  sidebar: {
    width:228, minWidth:228,
    background: T.ink2,
    borderRight:`1px solid ${T.line}`,
    display:"flex", flexDirection:"column",
    padding:"0 0 20px 0",
    position:"relative",
  },
  sidebarHeader: {
    padding:"28px 22px 24px",
    borderBottom:`1px solid ${T.line}`,
    marginBottom:8,
  },
  logoRow: { display:"flex", alignItems:"center", gap:12, marginBottom:4 },
  logoIcon: {
    width:36, height:36,
    background:`linear-gradient(140deg, ${T.goldHi} 0%, ${T.goldLo} 100%)`,
    borderRadius:11, display:"flex", alignItems:"center", justifyContent:"center",
    fontSize:15, fontWeight:800, color: T.ink,
    boxShadow:`0 0 0 1px rgba(192,155,82,0.25), 0 6px 20px rgba(192,155,82,0.18)`,
    letterSpacing:-1,
  },
  logoText: {
    fontSize:11, fontWeight:700, color: T.gold,
    letterSpacing:"4px", textTransform:"uppercase",
  },
  logoSub: {
    fontSize:9, color: T.text35,
    letterSpacing:"2px", textTransform:"uppercase", marginTop:2,
  },

  navItem: a => ({
    display:"flex", alignItems:"center", gap:10,
    padding:"11px 22px",
    cursor:"pointer",
    background: a ? T.goldA06 : "transparent",
    borderLeft: a ? `2px solid ${T.gold}` : `2px solid transparent`,
    color: a ? T.gold : T.text35,
    fontSize:13, fontWeight: a ? 600 : 400,
    transition:"all 0.2s cubic-bezier(0.22,1,0.36,1)",
    userSelect:"none",
    letterSpacing:"0.1px",
  }),

  sidebarFooter: {
    marginTop:"auto", padding:"0 14px",
    display:"flex", flexDirection:"column", gap:8,
  },
  btnSidebarSecondary: {
    padding:"9px 14px",
    background: T.text08,
    border:`1px solid ${T.line}`,
    borderRadius:10,
    color: T.text35,
    fontSize:12, cursor:"pointer",
    display:"flex", alignItems:"center", gap:7,
    width:"100%",
    transition:"all 0.2s",
  },

  main: { flex:1, display:"flex", flexDirection:"column", overflow:"hidden" },

  topbar: {
    height:58,
    borderBottom:`1px solid ${T.line}`,
    display:"flex", alignItems:"center",
    padding:"0 28px", gap:12,
    background: T.ink2,
    flexShrink:0,
    backdropFilter:"blur(10px)",
  },
  topbarTitle: {
    fontSize:15, fontWeight:700,
    color: T.text100, flex:1,
    letterSpacing:"-0.2px",
  },

  content: { flex:1, overflow:"auto", padding:28 },

  card: {
    background: T.glassHi,
    border:`1px solid ${T.lineHi}`,
    borderRadius:16, padding:22,
    backdropFilter:"blur(12px)",
  },
  cardDashed: {
    background: T.goldA06,
    border:`1px dashed ${T.goldA22}`,
    borderRadius:16, padding:20,
  },
  grid2: { display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 },
  grid4: { display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:16 },

  statCard: {
    background: T.glassHi,
    border:`1px solid ${T.lineHi}`,
    borderRadius:16, padding:22,
    backdropFilter:"blur(12px)",
    position:"relative", overflow:"hidden",
  },

  sectionTitle: {
    fontSize:9.5, fontWeight:700,
    color: T.text35,
    textTransform:"uppercase", letterSpacing:"1.8px",
    marginBottom:16,
  },

  table: { width:"100%", borderCollapse:"collapse" },
  th: {
    textAlign:"left", padding:"10px 14px",
    fontSize:9.5, color: T.text18,
    textTransform:"uppercase", letterSpacing:"1px",
    borderBottom:`1px solid ${T.line}`,
    fontWeight:700,
  },
  td: {
    padding:"13px 14px", fontSize:13,
    borderBottom:`1px solid ${T.line}`,
    verticalAlign:"middle",
  },

  badge: c => {
    const map = {
      green:  { bg:"rgba(45,211,122,0.10)",  color:"#2DD37A",  bd:"rgba(45,211,122,0.25)" },
      yellow: { bg:"rgba(192,155,82,0.12)",  color:"#D9B96E",  bd:"rgba(192,155,82,0.30)" },
      red:    { bg:"rgba(239,68,68,0.10)",   color:"#F87171",  bd:"rgba(239,68,68,0.28)" },
      blue:   { bg:"rgba(96,165,250,0.10)",  color:"#60a5fa",  bd:"rgba(96,165,250,0.28)" },
      gray:   { bg:"rgba(238,234,226,0.05)", color:"rgba(238,234,226,0.35)", bd:"rgba(238,234,226,0.10)" },
    };
    const m = map[c] || map.gray;
    return {
      padding:"3px 10px", borderRadius:20,
      fontSize:10.5, fontWeight:700,
      background: m.bg, color: m.color,
      border:`1px solid ${m.bd}`,
      letterSpacing:"0.3px",
    };
  },

  btnPrimary: {
    padding:"8px 20px",
    background:`linear-gradient(135deg, ${T.goldHi} 0%, ${T.goldLo} 100%)`,
    border:"none", borderRadius:10,
    color: T.ink, fontSize:13, fontWeight:700,
    cursor:"pointer", display:"flex", alignItems:"center", gap:7,
    boxShadow:"0 4px 16px rgba(192,155,82,0.25)",
    transition:"all 0.2s cubic-bezier(0.22,1,0.36,1)",
    letterSpacing:"0.1px",
  },
  btnGhost: {
    padding:"7px 14px",
    background:"transparent",
    border:`1px solid ${T.lineHi}`,
    borderRadius:8,
    color: T.text35, fontSize:12, cursor:"pointer",
    transition:"all 0.2s",
    display:"flex", alignItems:"center", gap:6,
  },
  btnDanger: {
    padding:"7px 12px",
    background:"rgba(239,68,68,0.08)",
    border:"1px solid rgba(239,68,68,0.25)",
    borderRadius:8,
    color:"#F87171", fontSize:12, cursor:"pointer",
    display:"flex", alignItems:"center", gap:5,
    transition:"all 0.2s",
  },
  btnSuccess: {
    padding:"7px 12px",
    background: T.emeraldA10,
    border:`1px solid ${T.emeraldA22}`,
    borderRadius:8,
    color: T.emerald, fontSize:12, cursor:"pointer",
    display:"flex", alignItems:"center", gap:5,
    transition:"all 0.2s",
  },
  btnBlue: {
    padding:"7px 12px",
    background: T.blueA10,
    border:`1px solid ${T.blueA25}`,
    borderRadius:8,
    color: T.blue, fontSize:12, cursor:"pointer",
    display:"flex", alignItems:"center", gap:5,
    transition:"all 0.2s",
  },

  input: {
    width:"100%", padding:"10px 13px",
    background: T.text08,
    border:`1px solid ${T.lineHi}`,
    borderRadius:10,
    color: T.text100, fontSize:13, outline:"none",
    boxSizing:"border-box",
    transition:"border-color 0.2s",
  },
  select: {
    width:"100%", padding:"10px 13px",
    background: T.ink3,
    border:`1px solid ${T.lineHi}`,
    borderRadius:10,
    color: T.text100, fontSize:13, outline:"none",
    cursor:"pointer", boxSizing:"border-box",
  },
  label: {
    fontSize:11.5, color: T.text35,
    marginBottom:6, display:"block", fontWeight:600,
    letterSpacing:"0.2px",
  },

  emptyState: {
    textAlign:"center", padding:"52px 24px",
    color: T.text35,
  },
  upgradeWall: {
    display:"flex", flexDirection:"column",
    alignItems:"center", justifyContent:"center",
    height:"100%", gap:14,
    textAlign:"center", padding:40,
  },
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
  const ok = t.type==="success";
  return <div style={{
    position:"fixed", bottom:28, right:28,
    padding:"13px 22px", borderRadius:14,
    background: ok ? "rgba(45,211,122,0.10)" : "rgba(239,68,68,0.10)",
    border:`1px solid ${ok ? "rgba(45,211,122,0.35)" : "rgba(239,68,68,0.35)"}`,
    color: ok ? "#2DD37A" : "#F87171",
    fontSize:13, fontWeight:700,
    zIndex:999, backdropFilter:"blur(16px)",
    boxShadow: ok ? "0 8px 32px rgba(45,211,122,0.12)" : "0 8px 32px rgba(239,68,68,0.12)",
    display:"flex", alignItems:"center", gap:8, letterSpacing:"0.2px",
    animation:"toast-in 0.35s cubic-bezier(0.22,1,0.36,1) both",
  }}>
    <style>{`@keyframes toast-in{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}`}</style>
    <span style={{fontSize:15}}>{ok ? "✓" : "✕"}</span>{t.msg}
  </div>;
}
function Loading({h=200}){
  return <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:h,gap:10,color:"rgba(238,234,226,0.35)",fontSize:13,letterSpacing:"0.2px"}}>
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C09B52" strokeWidth="2" style={{animation:"spin 0.85s linear infinite",flexShrink:0}}>
      <circle cx="12" cy="12" r="10" strokeOpacity="0.15"/><path d="M12 2a10 10 0 0 1 10 10"/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </svg>Carregando…
  </div>;
}
function Avatar({nome,size=36}){
  return <div style={{
    width:size, height:size, borderRadius:Math.round(size*0.32),
    background:`linear-gradient(140deg, #D9B96E 0%, #856830 100%)`,
    display:"flex", alignItems:"center", justifyContent:"center",
    fontSize:size*0.36, fontWeight:800, color:"#040408",
    flexShrink:0,
    boxShadow:"0 0 0 1px rgba(192,155,82,0.20), 0 4px 12px rgba(192,155,82,0.14)",
    letterSpacing:"-0.5px",
  }}>{initials(nome)}</div>;
}
function StatusBar({label,value,total,color}){
  const pct=total>0?Math.round((value/total)*100):0;
  return <div>
    <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
      <span style={{fontSize:12,color:"rgba(238,234,226,0.65)",fontWeight:500}}>{label}</span>
      <span style={{fontSize:12,color:"rgba(238,234,226,0.35)",fontWeight:600}}>{value} <span style={{fontSize:10,opacity:0.7}}>({pct}%)</span></span>
    </div>
    <div style={{height:5,background:"rgba(238,234,226,0.055)",borderRadius:3,overflow:"hidden"}}>
      <div style={{height:"100%",width:`${pct}%`,background:color,borderRadius:3,transition:"width 0.5s cubic-bezier(0.22,1,0.36,1)",boxShadow:`0 0 8px ${color}55`}}/>
    </div>
  </div>;
}
function CheckItem({ok,label}){
  return <div style={{display:"flex",gap:7,alignItems:"center"}}>
    <div style={{
      width:18, height:18, borderRadius:"50%",
      background: ok ? "rgba(45,211,122,0.10)" : "rgba(238,234,226,0.04)",
      border:`1px solid ${ok ? "rgba(45,211,122,0.35)" : "rgba(238,234,226,0.09)"}`,
      display:"flex", alignItems:"center", justifyContent:"center",
      fontSize:9, color: ok ? "#2DD37A" : "rgba(238,234,226,0.20)",
      flexShrink:0, fontWeight:800,
      boxShadow: ok ? "0 0 8px rgba(45,211,122,0.15)" : "none",
      transition:"all 0.3s",
    }}>{ok?"✓":"○"}</div>
    <span style={{fontSize:12,color:ok?"rgba(238,234,226,0.65)":"rgba(238,234,226,0.25)",fontWeight:ok?500:400}}>{label}</span>
  </div>;
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
        {[
          {icon:"📋", value:total,        label:"Total de Reservas", color:T.gold,    glow:"rgba(192,155,82,0.18)"},
          {icon:"📅", value:hojeR.length, label:"Hoje",              color:T.blue,    glow:"rgba(96,165,250,0.14)"},
          {icon:"📆", value:semanaR.length,label:"Esta Semana",      color:T.goldHi,  glow:"rgba(192,155,82,0.12)"},
          {icon:"⏳", value:pendentes,    label:"Pendentes",         color:T.emerald, glow:"rgba(45,211,122,0.14)"},
        ].map(({icon,value,label,color,glow})=>(
          <div key={label} style={{
            ...S.statCard,
            borderTop:`2px solid ${color}`,
            boxShadow:`0 2px 24px rgba(0,0,0,0.28)`,
            transition:"box-shadow 0.25s, transform 0.25s",
            cursor:"default",
            overflow:"hidden",
          }}
          onMouseEnter={e=>{e.currentTarget.style.boxShadow=`0 8px 32px rgba(0,0,0,0.38), 0 0 0 1px rgba(238,234,226,0.09)`;e.currentTarget.style.transform="translateY(-2px)";}}
          onMouseLeave={e=>{e.currentTarget.style.boxShadow=`0 2px 24px rgba(0,0,0,0.28)`;e.currentTarget.style.transform="translateY(0)";}}
          >
            <div style={{position:"absolute",top:0,left:0,right:0,height:60,background:`radial-gradient(ellipse at 50% 0%, ${glow} 0%, transparent 70%)`,pointerEvents:"none"}}/>
            <p style={{fontSize:20,marginBottom:12}}>{icon}</p>
            <p style={{fontSize:32,fontWeight:800,color,letterSpacing:"-1.5px",lineHeight:1}}>{value}</p>
            <p style={{fontSize:10,color:"rgba(238,234,226,0.40)",fontWeight:700,marginTop:8,textTransform:"uppercase",letterSpacing:"1.2px"}}>{label}</p>
          </div>
        ))}
      </div>
      <div style={S.grid2}>
        <div style={S.card}>
          <p style={S.sectionTitle}>Status das Reservas</p>
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <StatusBar label="Confirmadas" value={confirmadas} total={total} color={T.emerald}/>
            <StatusBar label="Pendentes" value={pendentes} total={total} color={T.gold}/>
            <StatusBar label="Canceladas" value={canceladas} total={total} color={T.red}/>
          </div>
        </div>
        <div style={S.card}>
          <p style={S.sectionTitle}>Próximos Agendamentos</p>
          {proximas.length===0?<div style={S.emptyState}><p style={{fontSize:13}}>Nenhum agendamento futuro</p></div>:(
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {proximas.map(r=>{
                const pr=prestadores.find(p=>p.id===r.prestadorId);
                const acc2 = STATUS_ACCENT[r.status] || STATUS_ACCENT.cancelado;
                return <div key={r.id} style={{
                  display:"flex",justifyContent:"space-between",alignItems:"center",
                  padding:"10px 14px",
                  background:"rgba(17,17,25,0.80)",
                  borderRadius:10,
                  border:`1px solid rgba(238,234,226,0.06)`,
                  borderLeft:`3px solid ${acc2.color}`,
                  position:"relative",overflow:"hidden",
                  transition:"box-shadow 0.2s",
                }}
                onMouseEnter={e=>{e.currentTarget.style.boxShadow=`0 4px 20px rgba(0,0,0,0.35), 0 0 0 1px rgba(238,234,226,0.08)`;}}
                onMouseLeave={e=>{e.currentTarget.style.boxShadow="none";}}>
                  <div style={{position:"absolute",top:0,left:0,width:80,height:"100%",background:`linear-gradient(90deg,${acc2.glow} 0%,transparent 100%)`,pointerEvents:"none"}}/>
                  <div>
                    <p style={{fontSize:13,fontWeight:600,color:T.text100,marginBottom:2}}>{r.cliente_nome||"Cliente"}</p>
                    <p style={{fontSize:11,color:T.text35}}>{r.servico_nome} · {formatDateShort(r.data_hora_inicio)}{pr&&<span style={{color:T.gold,marginLeft:4}}>· {pr.nome}</span>}</p>
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
        <p style={{fontSize:15,fontWeight:700,color:"#EEEAE2",marginBottom:6,letterSpacing:"-0.2px"}}>Equipe no Flow</p>
        <p style={{fontSize:12,color:"rgba(238,234,226,0.35)",lineHeight:1.7}}>Ative os colaboradores cadastrados no AG para que tenham sua própria agenda pública. Cada um configura seus serviços e horários de forma independente.</p>
      </div>

      {/* Linha do Admin (sempre ativo, não pode ser desativado) */}
      <div style={{
        ...S.card,
        borderLeft:`3px solid ${T.gold}`,
        display:"flex",alignItems:"center",gap:14,
        position:"relative",overflow:"hidden",
        transition:"box-shadow 0.25s",
      }}
      onMouseEnter={e=>{e.currentTarget.style.boxShadow=`0 4px 28px rgba(0,0,0,0.35), 0 0 0 1px rgba(238,234,226,0.09)`;}}
      onMouseLeave={e=>{e.currentTarget.style.boxShadow="none";}}>
        <div style={{position:"absolute",top:0,left:0,width:100,height:"100%",background:`linear-gradient(90deg,${T.goldA06} 0%,transparent 100%)`,pointerEvents:"none"}}/>
        <Avatar nome={user.displayName||user.email}/>
        <div style={{flex:1}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}>
            <p style={{fontSize:14,fontWeight:700,color:T.text100}}>{user.displayName||"Administrador"}</p>
            <span style={{...S.badge("yellow"),display:"flex",alignItems:"center",gap:4,fontSize:10}}>{Ic.crown} Admin</span>
          </div>
          <p style={{fontSize:12,color:T.text35}}>{user.email}</p>
          {adminPrestador?.especialidade&&<p style={{fontSize:11,color:T.gold,marginTop:2}}>{adminPrestador.especialidade}</p>}
        </div>
        {/* Especialidade do admin */}
        <button style={S.btnBlue} onClick={()=>setEditando({prestadorId:"admin",esp:adminPrestador?.especialidade||""})}>{Ic.settings}</button>
        {/* Configurar agenda */}
        <button style={S.btnBlue} title="Configurar agenda" onClick={()=>onConfigurar("admin")}>{Ic.settings} Configurar</button>
        {/* Copiar link */}
        <button style={{...S.btnGhost,color:copied==="admin"?T.emerald:T.text35}} onClick={()=>copiar("admin")}>
          {copied==="admin"?<>{Ic.check} Copiado!</>:<>{Ic.copy} Link</>}
        </button>
        <span style={S.badge("green")}>Ativo</span>
      </div>

      {/* Linha dos colaboradores */}
      {usuarios.length===0?(
        <div style={{...S.card,...S.emptyState}}>
          <p style={{fontSize:24,marginBottom:8}}>👥</p>
          <p style={{fontSize:13,color:T.text100}}>Nenhum colaborador cadastrado no AG ainda.</p>
          <p style={{fontSize:12,color:T.text35,marginTop:4}}>Adicione usuários em <strong>Usuários</strong> para ativá-los aqui.</p>
        </div>
      ):(
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {usuarios.map(usr=>{
            const pr=getPrestador(usr.uid);
            const ativoFlow=pr?.ativo===true;
            const isAtivo=usr.ativo!==false;
            const accentColor = !isAtivo ? T.text18 : ativoFlow ? T.emerald : T.goldLo;
            const accentGlow  = !isAtivo ? "transparent" : ativoFlow ? "rgba(45,211,122,0.08)" : "rgba(192,155,82,0.06)";

            return (
              <div key={usr.uid} style={{
                ...S.card,
                display:"flex",alignItems:"center",gap:14,
                opacity:isAtivo?1:0.5,
                borderLeft:`3px solid ${accentColor}`,
                position:"relative",overflow:"hidden",
                transition:"box-shadow 0.25s",
              }}
              onMouseEnter={e=>{if(isAtivo) e.currentTarget.style.boxShadow=`0 4px 28px rgba(0,0,0,0.35), 0 0 0 1px rgba(238,234,226,0.09)`;}}
              onMouseLeave={e=>{e.currentTarget.style.boxShadow="none";}}>
                <div style={{position:"absolute",top:0,left:0,width:100,height:"100%",background:`linear-gradient(90deg,${accentGlow} 0%,transparent 100%)`,pointerEvents:"none"}}/>
                <Avatar nome={usr.nome}/>
                <div style={{flex:1}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}>
                    <p style={{fontSize:14,fontWeight:600,color:T.text100}}>{usr.nome}</p>
                    <span style={{...S.badge("blue"),fontSize:10}}>{cargoLabel(usr.cargo)}</span>
                    {!isAtivo&&<span style={{...S.badge("gray"),fontSize:10}}>Inativo no AG</span>}
                  </div>
                  <p style={{fontSize:12,color:T.text35}}>{usr.email}</p>
                  {pr?.especialidade&&<p style={{fontSize:11,color:T.gold,marginTop:2}}>{pr.especialidade}</p>}
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
                        <button style={{...S.btnGhost,color:copied===usr.uid?T.emerald:T.text35}} onClick={()=>copiar(usr.uid)}>
                          {copied===usr.uid?<>{Ic.check} Copiado!</>:<>{Ic.copy} Link</>}
                        </button>
                      </>
                    )}
                    {/* Toggle Flow */}
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <span style={{fontSize:11,color:ativoFlow?T.emerald:T.text35}}>
                        {ativoFlow?"Ativo no Flow":"Inativo no Flow"}
                      </span>
                      <button onClick={()=>ativoFlow?desativar(usr.uid,usr.nome):ativar(usr)} disabled={salvando===usr.uid} style={{background:"none",border:"none",cursor:"pointer",padding:0,opacity:salvando===usr.uid?0.4:1}}>
                        {ativoFlow?Ic.toggle_on:Ic.toggle_off}
                      </button>
                    </div>
                  </div>
                ):(
                  <span style={{fontSize:11,color:T.text35}}>Reative no AG para usar no Flow</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal especialidade */}
      {editando&&(
        <div style={{position:"fixed",inset:0,background:"rgba(4,4,8,0.80)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200,backdropFilter:"blur(6px)"}}>
          <div style={{background:"rgba(17,17,25,0.96)",border:"1px solid rgba(238,234,226,0.09)",borderRadius:20,padding:28,width:380,display:"flex",flexDirection:"column",gap:18,boxShadow:"0 24px 64px rgba(0,0,0,0.55)"}}>
            <p style={{fontSize:14,fontWeight:700,color:"#EEEAE2",letterSpacing:"-0.2px"}}>Especialidade / Título</p>
            <p style={{fontSize:12,color:"rgba(238,234,226,0.35)"}}>Exibido na página pública do agendamento, abaixo do nome.</p>
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
// Ícones internos da tela reservas
const IcR = {
  user:    <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  mail:    <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>,
  phone:   <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.15 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.06 1.18h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.09 8.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>,
  clock:   <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>,
  scissor: <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4 8.12 15.88M14.47 14.48 20 20M8.12 8.12 12 12"/></svg>,
  cal:     <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>,
  tag:     <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><circle cx="7" cy="7" r="1.5" fill="currentColor" stroke="none"/></svg>,
  filter:  <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>,
};

// Linha decorativa de status por lado do card
const STATUS_ACCENT = {
  confirmado: { color:"#2DD37A", glow:"rgba(45,211,122,0.18)", label:"Confirmado" },
  pendente:   { color:"#D9B96E", glow:"rgba(192,155,82,0.18)",  label:"Pendente"   },
  cancelado:  { color:"rgba(239,68,68,0.75)", glow:"rgba(239,68,68,0.10)", label:"Cancelado" },
};

function ReservaCard({r, pr, isAdmin, prestadoresAtivos, podeEditar, atualizando, onAtualizar}){
  const acc = STATUS_ACCENT[r.status] || STATUS_ACCENT.cancelado;
  const dtInicio = r.data_hora_inicio ? (r.data_hora_inicio.toDate ? r.data_hora_inicio.toDate() : new Date(r.data_hora_inicio)) : null;
  const dtCriado = r.criadoEm ? (r.criadoEm.toDate ? r.criadoEm.toDate() : new Date(r.criadoEm)) : null;

  const fmtData = d => d ? d.toLocaleString("pt-BR",{day:"2-digit",month:"2-digit",year:"numeric"}) : "—";
  const fmtHora = d => d ? d.toLocaleString("pt-BR",{hour:"2-digit",minute:"2-digit"}) : "—";
  const fmtCurto = d => d ? d.toLocaleString("pt-BR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}) : "—";

  return (
    <div style={{
      background:"rgba(17,17,25,0.92)",
      border:`1px solid rgba(238,234,226,0.07)`,
      borderLeft:`3px solid ${acc.color}`,
      borderRadius:14,
      padding:"18px 22px",
      display:"grid",
      gridTemplateColumns:"1fr 1fr 1fr auto",
      gap:"0 24px",
      alignItems:"center",
      backdropFilter:"blur(12px)",
      boxShadow:`0 2px 24px rgba(0,0,0,0.28), inset 0 0 0 0 transparent`,
      transition:"box-shadow 0.25s, border-color 0.25s",
      position:"relative",
      overflow:"hidden",
    }}
    onMouseEnter={e=>{e.currentTarget.style.boxShadow=`0 4px 32px rgba(0,0,0,0.38), 0 0 0 1px rgba(238,234,226,0.09)`;}}
    onMouseLeave={e=>{e.currentTarget.style.boxShadow=`0 2px 24px rgba(0,0,0,0.28)`;}}
    >
      {/* Glow de status sutil no canto */}
      <div style={{position:"absolute",top:0,left:0,width:120,height:"100%",background:`linear-gradient(90deg, ${acc.glow} 0%, transparent 100%)`,pointerEvents:"none",borderRadius:"14px 0 0 14px"}}/>

      {/* ── Coluna 1: Cliente ── */}
      <div style={{minWidth:0}}>
        <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:8}}>
          <div style={{width:32,height:32,borderRadius:10,background:"linear-gradient(140deg,#D9B96E 0%,#856830 100%)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:800,color:"#040408",flexShrink:0,letterSpacing:"-0.5px",boxShadow:"0 0 0 1px rgba(192,155,82,0.20)"}}>
            {initials(r.cliente_nome)}
          </div>
          <span style={{fontSize:13,fontWeight:700,color:"#EEEAE2",letterSpacing:"-0.1px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.cliente_nome||"—"}</span>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:4,paddingLeft:2}}>
          {r.cliente_email&&(
            <div style={{display:"flex",alignItems:"center",gap:5}}>
              <span style={{color:"rgba(238,234,226,0.25)",flexShrink:0}}>{IcR.mail}</span>
              <span style={{fontSize:11,color:"rgba(238,234,226,0.38)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.cliente_email}</span>
            </div>
          )}
          {r.cliente_telefone&&(
            <div style={{display:"flex",alignItems:"center",gap:5}}>
              <span style={{color:"rgba(238,234,226,0.25)",flexShrink:0}}>{IcR.phone}</span>
              <span style={{fontSize:11,color:"rgba(238,234,226,0.38)"}}>{r.cliente_telefone}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Coluna 2: Serviço + Data ── */}
      <div style={{borderLeft:"1px solid rgba(238,234,226,0.06)",paddingLeft:20,display:"flex",flexDirection:"column",gap:10}}>
        <div>
          <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:3}}>
            <span style={{color:"rgba(192,155,82,0.50)",flexShrink:0}}>{IcR.scissor}</span>
            <span style={{fontSize:9.5,fontWeight:700,color:"rgba(238,234,226,0.22)",textTransform:"uppercase",letterSpacing:"1.2px"}}>Serviço</span>
          </div>
          <p style={{fontSize:13,fontWeight:600,color:"rgba(238,234,226,0.85)",lineHeight:1.3}}>{r.servico_nome||"—"}</p>
          {r.servico_duracao_min&&(
            <div style={{display:"flex",alignItems:"center",gap:4,marginTop:3}}>
              <span style={{color:"rgba(192,155,82,0.35)"}}>{IcR.clock}</span>
              <span style={{fontSize:11,color:"rgba(192,155,82,0.55)",fontWeight:500}}>{formatDuracao(r.servico_duracao_min)}</span>
            </div>
          )}
        </div>
        {isAdmin&&prestadoresAtivos.length>1&&pr&&(
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <div style={{width:20,height:20,borderRadius:6,background:"linear-gradient(140deg,#D9B96E 0%,#856830 100%)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,fontWeight:800,color:"#040408",flexShrink:0}}>{initials(pr.nome)}</div>
            <span style={{fontSize:11,color:"rgba(192,155,82,0.65)",fontWeight:500}}>{pr.nome}</span>
          </div>
        )}
      </div>

      {/* ── Coluna 3: Datas ── */}
      <div style={{borderLeft:"1px solid rgba(238,234,226,0.06)",paddingLeft:20,display:"flex",flexDirection:"column",gap:10}}>
        {dtInicio&&(
          <div>
            <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:3}}>
              <span style={{color:"rgba(192,155,82,0.50)",flexShrink:0}}>{IcR.cal}</span>
              <span style={{fontSize:9.5,fontWeight:700,color:"rgba(238,234,226,0.22)",textTransform:"uppercase",letterSpacing:"1.2px"}}>Agendado para</span>
            </div>
            <p style={{fontSize:14,fontWeight:700,color:"#EEEAE2",letterSpacing:"-0.3px",lineHeight:1}}>{fmtData(dtInicio)}</p>
            <p style={{fontSize:12,color:"rgba(192,155,82,0.75)",fontWeight:600,marginTop:2}}>{fmtHora(dtInicio)}</p>
          </div>
        )}
        {dtCriado&&(
          <div>
            <span style={{fontSize:9.5,fontWeight:600,color:"rgba(238,234,226,0.18)",textTransform:"uppercase",letterSpacing:"1px"}}>Criado em</span>
            <p style={{fontSize:11,color:"rgba(238,234,226,0.28)",marginTop:2}}>{fmtCurto(dtCriado)}</p>
          </div>
        )}
      </div>

      {/* ── Coluna 4: Status + Ações ── */}
      <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:10,minWidth:120}}>
        {/* Badge de status */}
        <div style={{
          display:"inline-flex",alignItems:"center",gap:5,
          padding:"5px 12px",borderRadius:20,
          background:`${acc.glow}`,
          border:`1px solid ${acc.color}44`,
          color:acc.color,fontSize:11,fontWeight:700,letterSpacing:"0.3px",
        }}>
          <div style={{width:6,height:6,borderRadius:"50%",background:acc.color,boxShadow:`0 0 6px ${acc.color}`}}/>
          {acc.label}
        </div>

        {/* Ações */}
        {podeEditar&&(
          <div style={{display:"flex",gap:6}}>
            {r.status==="pendente"&&(
              <>
                <button onClick={()=>onAtualizar(r.id,"confirmado")} disabled={atualizando===r.id} style={{
                  padding:"6px 12px",border:"1px solid rgba(45,211,122,0.30)",borderRadius:8,
                  background:"rgba(45,211,122,0.08)",color:"#2DD37A",fontSize:11,fontWeight:700,
                  cursor:"pointer",display:"flex",alignItems:"center",gap:4,transition:"all 0.2s",
                  opacity:atualizando===r.id?0.5:1,
                }}>✓ Confirmar</button>
                <button onClick={()=>onAtualizar(r.id,"cancelado")} disabled={atualizando===r.id} style={{
                  padding:"6px 12px",border:"1px solid rgba(239,68,68,0.25)",borderRadius:8,
                  background:"rgba(239,68,68,0.06)",color:"#F87171",fontSize:11,fontWeight:700,
                  cursor:"pointer",display:"flex",alignItems:"center",gap:4,transition:"all 0.2s",
                  opacity:atualizando===r.id?0.5:1,
                }}>✕ Cancelar</button>
              </>
            )}
            {r.status==="confirmado"&&(
              <button onClick={()=>onAtualizar(r.id,"cancelado")} disabled={atualizando===r.id} style={{
                padding:"6px 12px",border:"1px solid rgba(239,68,68,0.25)",borderRadius:8,
                background:"rgba(239,68,68,0.06)",color:"#F87171",fontSize:11,fontWeight:700,
                cursor:"pointer",display:"flex",alignItems:"center",gap:4,transition:"all 0.2s",
                opacity:atualizando===r.id?0.5:1,
              }}>✕ Cancelar</button>
            )}
            {r.status==="cancelado"&&(
              <button onClick={()=>onAtualizar(r.id,"pendente")} disabled={atualizando===r.id} style={{
                padding:"6px 12px",border:"1px solid rgba(238,234,226,0.12)",borderRadius:8,
                background:"rgba(238,234,226,0.04)",color:"rgba(238,234,226,0.45)",fontSize:11,fontWeight:600,
                cursor:"pointer",display:"flex",alignItems:"center",gap:4,transition:"all 0.2s",
                opacity:atualizando===r.id?0.5:1,
              }}>↺ Reabrir</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

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

  const FILTROS = [
    {key:"todos",    label:"Todos",      count: reservas.length},
    {key:"pendente", label:"Pendente",   count: reservas.filter(r=>r.status==="pendente").length},
    {key:"confirmado",label:"Confirmado",count: reservas.filter(r=>r.status==="confirmado").length},
    {key:"cancelado",label:"Cancelado",  count: reservas.filter(r=>r.status==="cancelado").length},
  ];
  const FILTRO_COLORS = {todos:"#C09B52", pendente:"#D9B96E", confirmado:"#2DD37A", cancelado:"#F87171"};

  return (
    <div style={{position:"relative",display:"flex",flexDirection:"column",gap:20}}>
      <Toast t={t}/>

      {/* ── Toolbar ── */}
      <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>

        {/* Pills de status */}
        <div style={{display:"flex",gap:4,background:"rgba(238,234,226,0.03)",border:"1px solid rgba(238,234,226,0.07)",borderRadius:12,padding:"4px"}}>
          {FILTROS.map(({key,label,count})=>{
            const ativo = filtroStatus===key;
            const cor = FILTRO_COLORS[key];
            return (
              <button key={key} onClick={()=>setFiltroStatus(key)} style={{
                padding:"6px 14px",borderRadius:9,border:"none",
                background: ativo ? "rgba(238,234,226,0.07)" : "transparent",
                color: ativo ? cor : "rgba(238,234,226,0.30)",
                fontSize:12,fontWeight:ativo?700:500,
                cursor:"pointer",transition:"all 0.2s",
                display:"flex",alignItems:"center",gap:6,
              }}>
                {label}
                <span style={{
                  fontSize:10,fontWeight:700,
                  padding:"1px 7px",borderRadius:20,
                  background: ativo ? `${cor}22` : "rgba(238,234,226,0.05)",
                  color: ativo ? cor : "rgba(238,234,226,0.20)",
                  border: ativo ? `1px solid ${cor}33` : "1px solid transparent",
                  transition:"all 0.2s",
                }}>{count}</span>
              </button>
            );
          })}
        </div>

        {/* Filtro por prestador */}
        {isAdmin&&prestadoresAtivos.length>1&&(
          <select style={{...S.select,width:"auto",minWidth:170,fontSize:12,padding:"7px 12px"}} value={filtroP} onChange={e=>setFiltroP(e.target.value)}>
            <option value="todos">Toda a equipe</option>
            {prestadoresAtivos.map(p=><option key={p.id} value={p.id}>{p.nome}{p.isAdmin?" (você)":""}</option>)}
          </select>
        )}

        {/* Input de data */}
        <div style={{position:"relative",display:"flex",alignItems:"center"}}>
          <span style={{position:"absolute",left:11,color:"rgba(238,234,226,0.25)",pointerEvents:"none",display:"flex"}}>{IcR.cal}</span>
          <input type="date" value={filtroData} onChange={e=>setFiltroData(e.target.value)} style={{
            ...S.input,width:170,paddingLeft:30,fontSize:12,
            color: filtroData ? "#EEEAE2" : "rgba(238,234,226,0.25)",
          }}/>
        </div>
        {filtroData&&(
          <button onClick={()=>setFiltroData("")} style={{...S.btnGhost,fontSize:11,padding:"6px 10px",gap:4}}>
            ✕ Limpar data
          </button>
        )}

        {/* Contador */}
        <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:6}}>
          <span style={{fontSize:11,color:"rgba(238,234,226,0.20)",fontWeight:600,textTransform:"uppercase",letterSpacing:"0.8px"}}>{f.length} reserva{f.length!==1?"s":""}</span>
        </div>
      </div>

      {/* ── Lista de cards ── */}
      {f.length===0?(
        <div style={{...S.card,textAlign:"center",padding:"60px 24px",display:"flex",flexDirection:"column",alignItems:"center",gap:12}}>
          <div style={{width:52,height:52,borderRadius:16,background:"rgba(238,234,226,0.04)",border:"1px solid rgba(238,234,226,0.07)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>📭</div>
          <p style={{fontSize:14,fontWeight:700,color:"rgba(238,234,226,0.50)",letterSpacing:"-0.1px"}}>Nenhuma reserva encontrada</p>
          <p style={{fontSize:12,color:"rgba(238,234,226,0.22)"}}>Tente ajustar os filtros acima</p>
        </div>
      ):(
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {f.map((r,i)=>{
            const pr=prestadores.find(p=>p.id===r.prestadorId);
            return (
              <div key={r.id} style={{animation:`flow-reveal 0.35s cubic-bezier(0.22,1,0.36,1) ${i*0.04}s both`}}>
                <ReservaCard
                  r={r} pr={pr}
                  isAdmin={isAdmin}
                  prestadoresAtivos={prestadoresAtivos}
                  podeEditar={podeEditar}
                  atualizando={atualizando}
                  onAtualizar={atualizarStatus}
                />
              </div>
            );
          })}
        </div>
      )}
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
      <p style={{fontSize:13,fontWeight:600,color:T.text100,marginBottom:4}}>Conta não vinculada ao Flow</p>
      <p style={{fontSize:12,color:T.text35}}>Peça ao administrador para ativar você na tela Equipe.</p>
    </div>
  );
  if(!prestadorId) return <div style={S.emptyState}><p style={{fontSize:13,color:T.text100}}>Nenhum prestador selecionado.</p></div>;

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
          <div><p style={{fontSize:14,fontWeight:600,color:T.text100}}>{prestadorAtual.nome}</p><p style={{fontSize:12,color:T.text35}}>{prestadorAtual.especialidade||cargoLabel(prestadorAtual.cargo)}</p></div>
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
            {DIAS_SEMANA.map(d=>{const a=(config.diasAtivos||[]).includes(d.key);return <button key={d.key} onClick={()=>toggleDia(d.key)} style={{width:44,height:44,borderRadius:8,border:a?`1px solid ${T.gold}`:`1px solid ${T.line}`,background:a?T.goldA12:"transparent",color:a?T.gold:T.text35,fontSize:12,fontWeight:a?700:400,cursor:"pointer",transition:"all 0.2s"}}>{d.label}</button>;})}
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
          <p style={{fontSize:11,color:"rgba(238,234,226,0.30)",marginTop:12,lineHeight:1.65}}>💡 Granularidade = passo entre os horários disponíveis. A duração real de cada serviço é respeitada — sem janelas desperdiçadas.</p>
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
                    <td style={S.td}><span style={{fontWeight:600,color:T.text100}}>{s.nome}</span></td>
                    <td style={S.td}><span style={{color:T.text35}}>{formatDuracao(s.duracao_min)}</span></td>
                    <td style={S.td}><span style={{color:T.gold}}>{s.preco>0?`R$ ${Number(s.preco).toLocaleString("pt-BR",{minimumFractionDigits:2})}`:"Gratuito"}</span></td>
                    <td style={S.td}><span style={{fontSize:12,color:T.text35}}>{s.descricao||"—"}</span></td>
                    <td style={S.td}><button style={S.btnDanger} onClick={()=>setConfig(p=>({...p,serviços:p.serviços.filter(x=>x.id!==s.id)}))}>{Ic.trash}</button></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
          <div style={{background:"rgba(255,255,255,0.02)",border:`1px dashed ${T.goldA22}`,borderRadius:10,padding:16}}>
            <p style={{...S.label,marginBottom:12,color:T.text100,fontSize:13,fontWeight:600}}>+ Novo Serviço</p>
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
        <div style={{padding:"12px 16px",background:"rgba(192,155,82,0.06)",border:"1px solid rgba(192,155,82,0.18)",borderRadius:12,fontSize:12,color:"rgba(238,234,226,0.40)",lineHeight:1.6}}>
          ℹ️ O link do <strong style={{color:"#D9B96E"}}>Administrador</strong> é o link padrão da empresa — funciona sem o parâmetro <code style={{background:"rgba(238,234,226,0.06)",padding:"1px 6px",borderRadius:5,fontSize:11,color:"rgba(238,234,226,0.55)"}}>&prestador=</code>. Os links dos colaboradores incluem o parâmetro automaticamente.
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
                    <p style={{fontSize:14,fontWeight:600,color:T.text100}}>{p.nome}</p>
                    {p.isAdmin&&<span style={{...S.badge("yellow"),display:"flex",alignItems:"center",gap:3,fontSize:10}}>{Ic.crown} Admin</span>}
                  </div>
                  <p style={{fontSize:12,color:T.text35}}>{p.especialidade||"Prestador de serviço"}</p>
                </div>
                <span style={S.badge(p.ativo?"green":"gray")}>{p.ativo?"Ativo":"Inativo"}</span>
              </div>
              <div style={{display:"flex",gap:16,marginBottom:12}}>
                <CheckItem ok={temH} label="Horários configurados"/>
                <CheckItem ok={temS} label="Serviços cadastrados"/>
                <CheckItem ok={!!cfg?.nomeEmpresa} label="Nome preenchido"/>
              </div>
              <div style={{display:"flex",gap:10,alignItems:"center",background:"rgba(255,255,255,0.02)",border:`1px solid ${T.line}`,borderRadius:10,padding:"10px 14px"}}>
                <span style={{fontSize:12,color:T.text100,flex:1,wordBreak:"break-all"}}>{link}</span>
                <button onClick={()=>copiar(p.id)} style={{...S.btnPrimary,background:copied===p.id?T.emeraldA10:`linear-gradient(135deg, ${T.goldHi} 0%, ${T.goldLo} 100%)`,color:copied===p.id?T.emerald:T.ink,border:copied===p.id?`1px solid ${T.emeraldA22}`:"none",flexShrink:0,padding:"7px 14px"}}>
                  {copied===p.id?<>{Ic.check} Copiado!</>:<>{Ic.copy} Copiar</>}
                </button>
              </div>
              {(!temS||!temH)&&<div style={{marginTop:12,padding:"10px 14px",background:"rgba(192,155,82,0.06)",border:"1px solid rgba(192,155,82,0.20)",borderRadius:10,fontSize:12,color:"#D9B96E"}}>⚠️ Configure serviços e horários antes de compartilhar este link.</div>}
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
      <div style={{width:72,height:72,borderRadius:20,background:"linear-gradient(140deg,#D9B96E 0%,#856830 100%)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:30,boxShadow:"0 0 0 1px rgba(192,155,82,0.25), 0 12px 40px rgba(192,155,82,0.22)"}}>{Ic.star}</div>
      <h2 style={{fontSize:24,fontWeight:800,color:"#EEEAE2",marginBottom:4,letterSpacing:"-0.5px"}}>Assent Flow</h2>
      <p style={{fontSize:14,color:"rgba(238,234,226,0.40)",maxWidth:340,lineHeight:1.7,marginBottom:24}}>Disponível no plano <strong style={{color:"#D9B96E"}}>Profissional</strong>.</p>
      <div style={{display:"flex",gap:12}}>
        <button style={{...S.btnPrimary,padding:"11px 28px",fontSize:14}} onClick={()=>window.open("mailto:contato@assentagencia.com.br?subject=Upgrade Profissional","_blank")}>⭐ Fazer Upgrade</button>
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

  // ── Auto-init admin: garante prestador + config existem ─────────────────
  // Executado uma vez por sessão quando admin abre o Flow.
  // Lógica:
  //   1. agendamento_prestadores/admin  → cria se não existe
  //   2. agendamento_configuracoes/admin → migra de /config (formato antigo)
  //                                        ou cria vazio com defaults
  useEffect(()=>{
    if(!tenantUid||!user||!isAdmin) return;

    async function initAdmin(){
      // ── 1. Prestador admin ──────────────────────────────────────────
      const prestRef=doc(db,"users",tenantUid,"agendamento_prestadores","admin");
      const prestSnap=await getDoc(prestRef);
      if(!prestSnap.exists()){
        await setDoc(prestRef,{
          nome:         user.displayName || user.email?.split("@")[0] || "Administrador",
          especialidade:"",
          linkedUserId: user.uid,
          ativo:        true,
          isAdmin:      true,
          criadoEm:     serverTimestamp(),
        });
      }

      // ── 2. Config admin ─────────────────────────────────────────────
      const cfgAdminRef=doc(db,"users",tenantUid,"agendamento_configuracoes","admin");
      const cfgAdminSnap=await getDoc(cfgAdminRef);

      if(!cfgAdminSnap.exists()){
        // Verifica se existe config no formato antigo (/configuracoes/config)
        const cfgOldRef=doc(db,"users",tenantUid,"agendamento_configuracoes","config");
        const cfgOldSnap=await getDoc(cfgOldRef);

        if(cfgOldSnap.exists()){
          // ► MIGRAÇÃO: copia dados antigos para /admin
          const oldData=cfgOldSnap.data();
          await setDoc(cfgAdminRef,{
            ...oldData,
            // Garante campo correto (antigo usava "servicos" sem acento)
            serviços: oldData.serviços || oldData.servicos || [],
            migradoEm: serverTimestamp(),
          });
          // Opcional: marca o doc antigo como migrado (não apaga para segurança)
          await updateDoc(cfgOldRef,{ _migrado:"admin", _migradoEm:serverTimestamp() });
        } else {
          // ► NOVO: cria config padrão vazia (admin configura depois)
          await setDoc(cfgAdminRef,{
            serviços:            [],
            diasAtivos:          ["seg","ter","qua","qui","sex"],
            horaInicio:          "08:00",
            horaFim:             "18:00",
            granularidadeMinutos: 30,
            nomeEmpresa:         "",
            descricao:           "",
            criadoEm:            serverTimestamp(),
          });
        }
      }
    }

    initAdmin().catch(err=>console.error("[Flow] initAdmin error:", err));
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
      <div style={{textAlign:"center",padding:40,display:"flex",flexDirection:"column",alignItems:"center",gap:12}}>
        <div style={{width:60,height:60,borderRadius:18,background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.20)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:26}}>🔒</div>
        <p style={{fontSize:16,fontWeight:700,color:"#EEEAE2",letterSpacing:"-0.2px"}}>Acesso Restrito</p>
        <p style={{fontSize:13,color:"rgba(238,234,226,0.35)",marginBottom:8,lineHeight:1.6,maxWidth:300}}>Seu perfil não possui acesso ao módulo de Agendamentos.</p>
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
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(192,155,82,0.18); border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(192,155,82,0.35); }
        @keyframes flow-reveal { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(0.5) sepia(1) saturate(2) hue-rotate(5deg); opacity:0.5; cursor:pointer; }
        input[type="time"]::-webkit-calendar-picker-indicator { filter: invert(0.5) sepia(1) saturate(2) hue-rotate(5deg); opacity:0.5; cursor:pointer; }
      `}</style>
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
          <span style={{fontSize:10,padding:"4px 12px",borderRadius:20,border:"1px solid rgba(192,155,82,0.25)",background:"rgba(192,155,82,0.08)",color:"#D9B96E",fontWeight:700,letterSpacing:"0.8px",textTransform:"uppercase"}}>★ Profissional</span>
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
