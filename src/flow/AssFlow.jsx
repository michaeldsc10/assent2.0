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
  setDoc, updateDoc, deleteDoc, getDoc, addDoc,
  serverTimestamp, query, orderBy, where,
} from "firebase/firestore";

const db = getFirestore();
const PUBLIC_BASE = "https://flow.assentagencia.com.br";

// ─── Design Tokens ────────────────────────────────────────────────────────────
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
    display:"flex", height:"100vh", height:"100dvh",
    background: T.ink,
    color: T.text100,
    fontFamily:"'Inter', system-ui, sans-serif",
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
    zIndex:100,
    transition:"transform 0.28s cubic-bezier(0.22,1,0.36,1)",
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
    padding:"0 20px", gap:10,
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
  back:     <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>,
  plus:     <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>,
  trash:    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2"/></svg>,
  copy:     <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>,
  check:    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="20,6 9,17 4,12"/></svg>,
  star:     <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/></svg>,
  crown:    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M2 20h20M4 20L2 8l6 4 4-8 4 8 6-4-2 12"/></svg>,
  menu:     <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 12h18M3 6h18M3 18h18"/></svg>,
  close:    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>,
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
  bloqueiosRecorrentes:[], // [{id, motivo, inicio, fim}] — pausas fixas diárias (ex: almoço)
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
      {/* grid responsivo via className */}
      <div className="flow-grid4">
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
      <div className="flow-grid2">
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
function TelaEquipe({tenantUid,user,prestadores,onConfigurar}){
  const [usuarios,setUsuarios]=useState([]);
  const [loadingU,setLoadingU]=useState(true);
  const [editando,setEditando]=useState(null);
  const [salvando,setSalvando]=useState(null);
  const [copied,setCopied]=useState(null);
  const [t,showT]=useToast();

  useEffect(()=>{
    if(!tenantUid) return;
    const q=query(collection(db,"users",tenantUid,"usuarios"),orderBy("criadoEm","asc"));
    const u=onSnapshot(q,snap=>{
      setUsuarios(snap.docs.map(d=>({uid:d.id,...d.data()})));
      setLoadingU(false);
    });
    return()=>u();
  },[tenantUid]);

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

  const desativar = async(pid, nome)=>{
    if(!window.confirm(`Desativar ${nome} do Flow? As reservas existentes não serão afetadas.`)) return;
    setSalvando(pid);
    try {
      await updateDoc(doc(db,"users",tenantUid,"agendamento_prestadores",pid),{ativo:false});
      showT("Desativado do Flow.");
    } catch { showT("Erro.","error"); }
    setSalvando(null);
  };

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

  const getPrestador = uid => prestadores.find(p=>p.id===uid)||null;
  const adminPrestador = prestadores.find(p=>p.isAdmin)||null;

  if(loadingU) return <Loading/>;

  return (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <Toast t={t}/>

      <div>
        <p style={{fontSize:15,fontWeight:700,color:"#EEEAE2",marginBottom:6,letterSpacing:"-0.2px"}}>Equipe no Flow</p>
        <p style={{fontSize:12,color:"rgba(238,234,226,0.35)",lineHeight:1.7}}>Ative os colaboradores cadastrados no AG para que tenham sua própria agenda pública. Cada um configura seus serviços e horários de forma independente.</p>
      </div>

      {/* Admin sempre primeiro */}
      {adminPrestador&&(
        <div style={{
          background:"rgba(17,17,25,0.92)",
          border:`1px solid rgba(238,234,226,0.07)`,
          borderLeft:`3px solid ${T.gold}`,
          borderRadius:14,
          padding:"16px 20px",
          display:"flex",alignItems:"center",gap:14,flexWrap:"wrap",
          backdropFilter:"blur(12px)",
          position:"relative",overflow:"hidden",
        }}>
          <div style={{position:"absolute",top:0,left:0,width:120,height:"100%",background:`linear-gradient(90deg,rgba(192,155,82,0.08) 0%,transparent 100%)`,pointerEvents:"none"}}/>
          <Avatar nome={adminPrestador.nome}/>
          <div style={{flex:1,minWidth:120}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3,flexWrap:"wrap"}}>
              <p style={{fontSize:14,fontWeight:700,color:T.text100,letterSpacing:"-0.1px"}}>{adminPrestador.nome}</p>
              <span style={{...S.badge("yellow"),display:"flex",alignItems:"center",gap:3,fontSize:10}}>{Ic.crown} Admin</span>
              <span style={S.badge("green")}>Ativo no Flow</span>
            </div>
            <p style={{fontSize:12,color:T.text35}}>{adminPrestador.especialidade||"Administrador"}</p>
          </div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
            <button style={{...S.btnGhost,fontSize:11}} onClick={()=>setEditando({prestadorId:"admin",esp:adminPrestador.especialidade||""})}>✏ Especialidade</button>
            <button style={{...S.btnGhost,color:copied==="admin"?T.emerald:T.text35,fontSize:11}} onClick={()=>copiar("admin")}>
              {copied==="admin"?<>{Ic.check} Copiado!</>:<>{Ic.copy} Link</>}
            </button>
            <button style={{...S.btnGhost,fontSize:11}} onClick={()=>onConfigurar("admin")}>⚙ Configurar</button>
          </div>
        </div>
      )}

      {/* Demais usuários do AG */}
      {usuarios.length===0?(
        <div style={{...S.emptyState}}>
          <p style={{fontSize:22,marginBottom:8}}>👥</p>
          <p style={{fontSize:13,fontWeight:600,color:T.text100,marginBottom:4}}>Nenhum colaborador cadastrado</p>
          <p style={{fontSize:12,color:T.text35}}>Adicione usuários no módulo Usuários do AG para ativá-los aqui.</p>
        </div>
      ):(
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {usuarios.map(usr=>{
            const prestador=getPrestador(usr.uid);
            const ativoFlow=prestador?.ativo===true;
            const inativoAG=usr.ativo===false;
            return (
              <div key={usr.uid} style={{
                background:"rgba(17,17,25,0.92)",
                border:`1px solid rgba(238,234,226,0.07)`,
                borderLeft:`3px solid ${ativoFlow?T.emerald:T.text08}`,
                borderRadius:14,
                padding:"14px 18px",
                display:"flex",alignItems:"center",gap:14,flexWrap:"wrap",
                backdropFilter:"blur(12px)",
                opacity:inativoAG?0.55:1,
                transition:"opacity 0.2s",
              }}>
                <Avatar nome={usr.nome} size={32}/>
                <div style={{flex:1,minWidth:100}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:2,flexWrap:"wrap"}}>
                    <p style={{fontSize:13,fontWeight:600,color:T.text100}}>{usr.nome||"Sem nome"}</p>
                    <span style={S.badge("gray")}>{cargoLabel(usr.cargo)}</span>
                    {ativoFlow&&<span style={S.badge("green")}>Flow ativo</span>}
                    {inativoAG&&<span style={S.badge("red")}>Inativo no AG</span>}
                  </div>
                  {prestador?.especialidade&&<p style={{fontSize:11,color:T.text35}}>{prestador.especialidade}</p>}
                </div>
                {!inativoAG?(
                  <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
                    {ativoFlow&&(
                      <>
                        <button style={{...S.btnGhost,fontSize:11}} onClick={()=>setEditando({prestadorId:usr.uid,esp:prestador?.especialidade||""})}>✏ Especialidade</button>
                        <button style={{...S.btnGhost,fontSize:11}} onClick={()=>onConfigurar(usr.uid)}>⚙ Configurar</button>
                        <button style={{...S.btnGhost,color:copied===usr.uid?T.emerald:T.text35,fontSize:11}} onClick={()=>copiar(usr.uid)}>
                          {copied===usr.uid?<>{Ic.check} Copiado!</>:<>{Ic.copy} Link</>}
                        </button>
                      </>
                    )}
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
        <div style={{position:"fixed",inset:0,background:"rgba(4,4,8,0.80)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200,backdropFilter:"blur(6px)",padding:"0 16px"}}>
          <div style={{background:"rgba(17,17,25,0.96)",border:"1px solid rgba(238,234,226,0.09)",borderRadius:20,padding:28,width:"100%",maxWidth:380,display:"flex",flexDirection:"column",gap:18,boxShadow:"0 24px 64px rgba(0,0,0,0.55)"}}>
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
const IcR = {
  user:    <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  mail:    <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>,
  phone:   <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.15 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.06 1.18h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.09 8.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>,
  clock:   <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>,
  scissor: <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4 8.12 15.88M14.47 14.48 20 20M8.12 8.12 12 12"/></svg>,
  cal:     <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>,
  tag:     <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><circle cx="7" cy="7" r="1.5" fill="currentColor" stroke="none"/></svg>,
  search:  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>,
};

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
    <div className="flow-reserva-card" style={{
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
      boxShadow:`0 2px 24px rgba(0,0,0,0.28)`,
      transition:"box-shadow 0.25s, border-color 0.25s",
      position:"relative",
      overflow:"hidden",
    }}
    onMouseEnter={e=>{e.currentTarget.style.boxShadow=`0 4px 32px rgba(0,0,0,0.38), 0 0 0 1px rgba(238,234,226,0.09)`;}}
    onMouseLeave={e=>{e.currentTarget.style.boxShadow=`0 2px 24px rgba(0,0,0,0.28)`;}}
    >
      <div style={{position:"absolute",top:0,left:0,width:120,height:"100%",background:`linear-gradient(90deg, ${acc.glow} 0%, transparent 100%)`,pointerEvents:"none",borderRadius:"14px 0 0 14px"}}/>

      {/* Coluna 1: Cliente */}
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

      {/* Coluna 2: Serviço */}
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

      {/* Coluna 3: Datas */}
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

      {/* Coluna 4: Status + Ações */}
      <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:10,minWidth:120}}>
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
        {podeEditar&&(
          <div style={{display:"flex",gap:6,flexWrap:"wrap",justifyContent:"flex-end"}}>
            {r.status==="pendente"&&(
              <>
                <button onClick={()=>onAtualizar(r.id,"confirmado")} disabled={atualizando===r.id} style={{padding:"6px 12px",border:"1px solid rgba(45,211,122,0.30)",borderRadius:8,background:"rgba(45,211,122,0.08)",color:"#2DD37A",fontSize:11,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:4,transition:"all 0.2s",opacity:atualizando===r.id?0.5:1}}>✓ Confirmar</button>
                <button onClick={()=>onAtualizar(r.id,"cancelado")} disabled={atualizando===r.id} style={{padding:"6px 12px",border:"1px solid rgba(239,68,68,0.25)",borderRadius:8,background:"rgba(239,68,68,0.06)",color:"#F87171",fontSize:11,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:4,transition:"all 0.2s",opacity:atualizando===r.id?0.5:1}}>✕ Cancelar</button>
              </>
            )}
            {r.status==="confirmado"&&(
              <button onClick={()=>onAtualizar(r.id,"cancelado")} disabled={atualizando===r.id} style={{padding:"6px 12px",border:"1px solid rgba(239,68,68,0.25)",borderRadius:8,background:"rgba(239,68,68,0.06)",color:"#F87171",fontSize:11,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:4,transition:"all 0.2s",opacity:atualizando===r.id?0.5:1}}>✕ Cancelar</button>
            )}
            {r.status==="cancelado"&&(
              <button onClick={()=>onAtualizar(r.id,"pendente")} disabled={atualizando===r.id} style={{padding:"6px 12px",border:"1px solid rgba(238,234,226,0.12)",borderRadius:8,background:"rgba(238,234,226,0.04)",color:"rgba(238,234,226,0.45)",fontSize:11,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",gap:4,transition:"all 0.2s",opacity:atualizando===r.id?0.5:1}}>↺ Reabrir</button>
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
  const [aba,setAba]=useState("ativas");
  const [filtroStatus,setFiltroStatus]=useState("todos");
  const [filtroP,setFiltroP]=useState(isAdmin?"todos":meuPrestadorId);
  const [atualizando,setAtualizando]=useState(null);
  const [t,showT]=useToast();
  // Busca unificada: texto (nome + serviço) e data
  const [busca,setBusca]=useState("");
  const [buscarData,setBuscarData]=useState("");
  const [sortBy,setSortBy]=useState("data");
  const [sortDir,setSortDir]=useState("desc");

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
      showT(novoStatus==="confirmado"?"Confirmada!":novoStatus==="cancelado"?"Cancelada.":"Reaberta.",novoStatus==="confirmado"?"success":"error");
    } catch { showT("Erro.","error"); }
    setAtualizando(null);
  };

  const toggleSort=(campo)=>{
    if(sortBy===campo){ setSortDir(d=>d==="desc"?"asc":"desc"); }
    else { setSortBy(campo); setSortDir("desc"); }
  };

  if(loading) return <Loading/>;
  const prestadoresAtivos=prestadores.filter(p=>p.ativo);

  const ativas    = reservas.filter(r=>r.status!=="cancelado");
  const canceladas= reservas.filter(r=>r.status==="cancelado");

  const aplicarFiltros=(lista)=>{
    let f=lista;
    if(isAdmin&&filtroP!=="todos") f=f.filter(r=>r.prestadorId===filtroP);
    if(aba==="ativas"&&filtroStatus!=="todos") f=f.filter(r=>r.status===filtroStatus);
    // Busca unificada: nome OU serviço
    if(busca.trim()){
      const q=busca.trim().toLowerCase();
      f=f.filter(r=>
        (r.cliente_nome||"").toLowerCase().includes(q)||
        (r.servico_nome||"").toLowerCase().includes(q)
      );
    }
    // Filtro por data
    if(buscarData){
      const d0=new Date(buscarData+"T00:00:00"),d1=new Date(buscarData+"T23:59:59");
      f=f.filter(r=>{
        if(!r.data_hora_inicio) return false;
        const d=r.data_hora_inicio.toDate?r.data_hora_inicio.toDate():new Date(r.data_hora_inicio);
        return d>=d0&&d<=d1;
      });
    }
    f=[...f].sort((a,b)=>{
      if(sortBy==="nome"){
        const na=(a.cliente_nome||"").toLowerCase(),nb=(b.cliente_nome||"").toLowerCase();
        return sortDir==="asc"?na.localeCompare(nb,"pt-BR"):nb.localeCompare(na,"pt-BR");
      } else {
        const da=a.data_hora_inicio?(a.data_hora_inicio.toDate?a.data_hora_inicio.toDate():new Date(a.data_hora_inicio)):new Date(0);
        const db2=b.data_hora_inicio?(b.data_hora_inicio.toDate?b.data_hora_inicio.toDate():new Date(b.data_hora_inicio)):new Date(0);
        return sortDir==="asc"?da-db2:db2-da;
      }
    });
    return f;
  };

  const listaAtual=aplicarFiltros(aba==="ativas"?ativas:canceladas);

  const SUB_FILTROS=[
    {key:"todos",      label:"Todos",      count:ativas.length},
    {key:"pendente",   label:"Pendente",   count:ativas.filter(r=>r.status==="pendente").length},
    {key:"confirmado", label:"Confirmado", count:ativas.filter(r=>r.status==="confirmado").length},
  ];
  const SUB_COLORS={todos:"#C09B52",pendente:"#D9B96E",confirmado:"#2DD37A"};

  const limparBusca=()=>{ setBusca(""); setBuscarData(""); };
  const temBusca=busca.trim()||buscarData;

  const sortBtnStyle=(campo)=>({
    display:"flex",alignItems:"center",gap:5,
    padding:"6px 13px",borderRadius:8,border:"none",
    background: sortBy===campo ? "rgba(192,155,82,0.12)" : "rgba(238,234,226,0.04)",
    color: sortBy===campo ? "#D9B96E" : "rgba(238,234,226,0.35)",
    fontSize:11.5,fontWeight:sortBy===campo?700:500,
    cursor:"pointer",transition:"all 0.2s",
    borderWidth:1,borderStyle:"solid",
    borderColor: sortBy===campo ? "rgba(192,155,82,0.28)" : "rgba(238,234,226,0.07)",
  });
  const sortArrow=(campo)=>sortBy===campo?(sortDir==="desc"?" ↓":" ↑"):" ↕";

  return (
    <div style={{position:"relative",display:"flex",flexDirection:"column",gap:16}}>
      <Toast t={t}/>

      {/* ══ ABAS PRINCIPAIS ══ */}
      <div style={{display:"flex",gap:0,background:"rgba(238,234,226,0.03)",border:"1px solid rgba(238,234,226,0.07)",borderRadius:14,padding:4,alignSelf:"flex-start"}}>
        {[
          {key:"ativas",    label:"Ativas",     count:ativas.length,    cor:"#2DD37A", icon:"✦"},
          {key:"canceladas",label:"Canceladas", count:canceladas.length,cor:"#F87171", icon:"✕"},
        ].map(({key,label,count,cor,icon})=>{
          const on=aba===key;
          return (
            <button key={key} onClick={()=>{setAba(key);setFiltroStatus("todos");limparBusca();}} style={{
              display:"flex",alignItems:"center",gap:7,
              padding:"8px 18px",borderRadius:10,border:"none",
              background: on ? (key==="ativas"?"rgba(45,211,122,0.10)":"rgba(239,68,68,0.09)") : "transparent",
              color: on ? cor : "rgba(238,234,226,0.30)",
              fontSize:13,fontWeight:on?700:500,
              cursor:"pointer",transition:"all 0.2s",
              boxShadow: on ? `0 0 0 1px ${cor}30` : "none",
            }}>
              <span style={{fontSize:10}}>{icon}</span>
              {label}
              <span style={{fontSize:10,fontWeight:700,padding:"1px 7px",borderRadius:20,background:on?`${cor}20`:"rgba(238,234,226,0.05)",color:on?cor:"rgba(238,234,226,0.20)",border:on?`1px solid ${cor}33`:"1px solid transparent"}}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* ══ BARRA DE PESQUISA UNIFICADA ══ */}
      <div style={{
        background:"rgba(17,17,25,0.80)",
        border:"1px solid rgba(238,234,226,0.07)",
        borderRadius:14,padding:"12px 14px",
        backdropFilter:"blur(12px)",
        display:"flex",flexDirection:"column",gap:10,
      }}>
        {/* Linha 1: busca unificada + data + limpar */}
        <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
          {/* Input unificado: nome ou serviço */}
          <div style={{position:"relative",flex:"2 1 200px",minWidth:160,display:"flex",alignItems:"center"}}>
            <span style={{position:"absolute",left:11,top:"50%",transform:"translateY(-50%)",color:"rgba(238,234,226,0.22)",pointerEvents:"none",display:"flex"}}>{IcR.search}</span>
            <input
              type="text"
              placeholder="Buscar por cliente ou serviço…"
              value={busca}
              onChange={e=>setBusca(e.target.value)}
              style={{...S.input,paddingLeft:32,fontSize:12,height:36,padding:"0 10px 0 32px"}}
            />
          </div>
          {/* Data */}
          <div style={{position:"relative",flex:"1 1 140px",minWidth:130,display:"flex",alignItems:"center"}}>
            <span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",color:"rgba(238,234,226,0.22)",pointerEvents:"none",display:"flex"}}>{IcR.cal}</span>
            <input
              type="date"
              value={buscarData}
              onChange={e=>setBuscarData(e.target.value)}
              style={{...S.input,paddingLeft:30,fontSize:12,height:36,padding:"0 10px 0 30px",color:buscarData?"#EEEAE2":"rgba(238,234,226,0.25)"}}
            />
          </div>
          {temBusca&&(
            <button onClick={limparBusca} style={{...S.btnGhost,fontSize:11,padding:"0 12px",height:36,gap:4,whiteSpace:"nowrap"}}>
              ✕ Limpar
            </button>
          )}
        </div>

        {/* Linha 2: sort + status + prestador + contador */}
        <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
          <span style={{fontSize:10.5,fontWeight:700,color:"rgba(238,234,226,0.20)",textTransform:"uppercase",letterSpacing:"1px",whiteSpace:"nowrap"}}>Ordenar:</span>
          <button onClick={()=>toggleSort("data")}  style={sortBtnStyle("data")}>
            {IcR.cal} Data{sortArrow("data")}
          </button>
          <button onClick={()=>toggleSort("nome")} style={sortBtnStyle("nome")}>
            {IcR.user} Nome{sortArrow("nome")}
          </button>

          {aba==="ativas"&&(
            <>
              <div style={{width:1,height:22,background:"rgba(238,234,226,0.07)",margin:"0 4px"}}/>
              <span style={{fontSize:10.5,fontWeight:700,color:"rgba(238,234,226,0.20)",textTransform:"uppercase",letterSpacing:"1px",whiteSpace:"nowrap"}}>Status:</span>
              <div style={{display:"flex",gap:3,background:"rgba(238,234,226,0.03)",border:"1px solid rgba(238,234,226,0.06)",borderRadius:9,padding:"3px"}}>
                {SUB_FILTROS.map(({key,label,count})=>{
                  const on=filtroStatus===key;
                  const cor=SUB_COLORS[key];
                  return (
                    <button key={key} onClick={()=>setFiltroStatus(key)} style={{
                      padding:"4px 11px",borderRadius:7,border:"none",
                      background: on ? "rgba(238,234,226,0.07)" : "transparent",
                      color: on ? cor : "rgba(238,234,226,0.28)",
                      fontSize:11.5,fontWeight:on?700:500,
                      cursor:"pointer",transition:"all 0.2s",
                      display:"flex",alignItems:"center",gap:5,
                    }}>
                      {label}
                      <span style={{fontSize:10,fontWeight:700,padding:"1px 6px",borderRadius:20,background:on?`${cor}22`:"rgba(238,234,226,0.05)",color:on?cor:"rgba(238,234,226,0.18)",border:on?`1px solid ${cor}33`:"1px solid transparent"}}>{count}</span>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {isAdmin&&prestadoresAtivos.length>1&&(
            <>
              <div style={{width:1,height:22,background:"rgba(238,234,226,0.07)",margin:"0 4px"}}/>
              <select style={{...S.select,width:"auto",minWidth:140,fontSize:11.5,padding:"5px 10px",height:32}} value={filtroP} onChange={e=>setFiltroP(e.target.value)}>
                <option value="todos">Toda a equipe</option>
                {prestadoresAtivos.map(p=><option key={p.id} value={p.id}>{p.nome}{p.isAdmin?" (você)":""}</option>)}
              </select>
            </>
          )}

          <div style={{marginLeft:"auto"}}>
            <span style={{fontSize:11,color:"rgba(238,234,226,0.18)",fontWeight:600,textTransform:"uppercase",letterSpacing:"0.8px"}}>
              {listaAtual.length} reserva{listaAtual.length!==1?"s":""}
            </span>
          </div>
        </div>
      </div>

      {/* ══ LISTA ══ */}
      {listaAtual.length===0?(
        <div style={{...S.card,textAlign:"center",padding:"60px 24px",display:"flex",flexDirection:"column",alignItems:"center",gap:12}}>
          <div style={{width:52,height:52,borderRadius:16,background:"rgba(238,234,226,0.04)",border:"1px solid rgba(238,234,226,0.07)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>
            {aba==="canceladas"?"🚫":"📭"}
          </div>
          <p style={{fontSize:14,fontWeight:700,color:"rgba(238,234,226,0.50)",letterSpacing:"-0.1px"}}>
            {temBusca?"Nenhum resultado encontrado":"Nenhuma reserva aqui"}
          </p>
          <p style={{fontSize:12,color:"rgba(238,234,226,0.22)"}}>
            {temBusca?"Tente outros termos de busca":aba==="canceladas"?"Nenhuma reserva foi cancelada ainda":"Sem reservas ativas no momento"}
          </p>
          {temBusca&&<button onClick={limparBusca} style={{...S.btnGhost,fontSize:12,marginTop:4}}>Limpar busca</button>}
        </div>
      ):(
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {listaAtual.map((r,i)=>{
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
function TelaConfiguracoes({tenantUid,prestadores,meuPrestadorId,isAdmin,prestadorFoco}){
  const [prestadorId,setPrestadorId]=useState(prestadorFoco||(isAdmin?"admin":meuPrestadorId));
  const [config,setConfig]=useState(CONFIG_DEFAULT);
  const [loading,setLoading]=useState(true);
  const [salvando,setSalvando]=useState(false);
  const [novoS,setNovoS]=useState({nome:"",duracao:60,preco:"",descricao:""});
  const [novaP,setNovaP]=useState({motivo:"Almoço",inicio:"12:00",fim:"13:00"});
  const [bloqueiosData,setBloqueiosData]=useState([]);
  const [novoB,setNovoB]=useState({data:"",diaTodo:true,inicio:"08:00",fim:"09:00",motivo:""});
  const [salvandoB,setSalvandoB]=useState(false);
  const [t,showT]=useToast();

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

  // Listener de bloqueios por data
  useEffect(()=>{
    if(!tenantUid||!prestadorId) return;
    const q=query(
      collection(db,"users",tenantUid,"agendamento_bloqueios"),
      where("prestadorId","==",prestadorId),
      orderBy("data","asc")
    );
    const u=onSnapshot(q,snap=>{
      setBloqueiosData(snap.docs.map(d=>({id:d.id,...d.data()})));
    },()=>{});
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

  // Pausas recorrentes — salvas dentro do doc de config (salvar geral)
  const addPausa=()=>{
    if(!novaP.inicio||!novaP.fim||novaP.inicio>=novaP.fim) return;
    const p={id:Date.now().toString(),...novaP};
    setConfig(c=>({...c,bloqueiosRecorrentes:[...(c.bloqueiosRecorrentes||[]),p]}));
    setNovaP({motivo:"Almoço",inicio:"12:00",fim:"13:00"});
  };
  const removerPausa=(id)=>setConfig(c=>({...c,bloqueiosRecorrentes:(c.bloqueiosRecorrentes||[]).filter(p=>p.id!==id)}));

  // Bloqueios por data — coleção separada (operação imediata)
  const addBloqueioData=async()=>{
    if(!novoB.data||!novoB.motivo.trim()) return;
    if(!novoB.diaTodo&&(!novoB.inicio||!novoB.fim||novoB.inicio>=novoB.fim)) return;
    setSalvandoB(true);
    try {
      await addDoc(collection(db,"users",tenantUid,"agendamento_bloqueios"),{
        prestadorId,
        data:novoB.data,
        diaTodo:novoB.diaTodo,
        ...(novoB.diaTodo?{}:{horaInicio:novoB.inicio,horaFim:novoB.fim}),
        motivo:novoB.motivo.trim(),
        criadoEm:serverTimestamp(),
      });
      setNovoB({data:"",diaTodo:true,inicio:"08:00",fim:"09:00",motivo:""});
      showT("Bloqueio adicionado!");
    } catch { showT("Erro ao salvar bloqueio.","error"); }
    setSalvandoB(false);
  };
  const removerBloqueioData=async(id)=>{
    try { await deleteDoc(doc(db,"users",tenantUid,"agendamento_bloqueios",id)); showT("Bloqueio removido!"); }
    catch { showT("Erro ao remover.","error"); }
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

  const IcCfg = {
    profile: <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
    clock2:  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>,
    tag2:    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><circle cx="7" cy="7" r="1.5" fill="currentColor" stroke="none"/></svg>,
    pencil:  <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  };

  const secaoHeader = (icon, title, subtitle) => (
    <div style={{display:"flex",alignItems:"flex-start",gap:12,marginBottom:20}}>
      <div style={{width:36,height:36,borderRadius:10,background:T.goldA06,border:`1px solid ${T.goldA22}`,display:"flex",alignItems:"center",justifyContent:"center",color:T.gold,flexShrink:0}}>{icon}</div>
      <div>
        <p style={{fontSize:13,fontWeight:700,color:T.text100,letterSpacing:"-0.1px",marginBottom:2}}>{title}</p>
        <p style={{fontSize:11.5,color:T.text35,lineHeight:1.5}}>{subtitle}</p>
      </div>
    </div>
  );

  return (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <Toast t={t}/>

      {isAdmin&&prestadoresAtivos.length>1?(
        <div style={{background:"rgba(17,17,25,0.92)",border:`1px solid rgba(238,234,226,0.07)`,borderLeft:`3px solid ${T.gold}`,borderRadius:14,padding:"16px 20px",display:"flex",alignItems:"center",gap:14,backdropFilter:"blur(12px)",position:"relative",overflow:"hidden",flexWrap:"wrap"}}>
          <div style={{position:"absolute",top:0,left:0,width:120,height:"100%",background:`linear-gradient(90deg,${T.goldA06} 0%,transparent 100%)`,pointerEvents:"none"}}/>
          <div style={{width:36,height:36,borderRadius:10,background:T.goldA06,border:`1px solid ${T.goldA22}`,display:"flex",alignItems:"center",justifyContent:"center",color:T.gold,flexShrink:0,fontSize:14}}>{IcCfg.profile}</div>
          <div style={{flex:1,minWidth:160}}>
            <p style={{fontSize:11,color:T.text35,fontWeight:600,textTransform:"uppercase",letterSpacing:"1px",marginBottom:6}}>Configurando agenda de</p>
            <select style={{...S.select,width:"auto",minWidth:240,padding:"8px 12px",fontSize:13}} value={prestadorId||""} onChange={e=>setPrestadorId(e.target.value)}>
              {prestadoresAtivos.map(p=><option key={p.id} value={p.id}>{p.nome}{p.isAdmin?" (Admin)":""}{p.especialidade?` · ${p.especialidade}`:""}</option>)}
            </select>
          </div>
          {prestadorAtual&&<span style={S.badge(prestadorAtual.ativo?"green":"gray")}>{prestadorAtual.ativo?"Ativo":"Inativo"}</span>}
        </div>
      ):(!isAdmin&&prestadorAtual&&(
        <div style={{background:"rgba(17,17,25,0.92)",border:`1px solid rgba(238,234,226,0.07)`,borderLeft:`3px solid ${T.gold}`,borderRadius:14,padding:"16px 20px",display:"flex",alignItems:"center",gap:14,backdropFilter:"blur(12px)",position:"relative",overflow:"hidden"}}>
          <div style={{position:"absolute",top:0,left:0,width:120,height:"100%",background:`linear-gradient(90deg,${T.goldA06} 0%,transparent 100%)`,pointerEvents:"none"}}/>
          <Avatar nome={prestadorAtual.nome}/>
          <div style={{flex:1}}>
            <p style={{fontSize:14,fontWeight:700,color:T.text100,letterSpacing:"-0.1px"}}>{prestadorAtual.nome}</p>
            <p style={{fontSize:12,color:T.text35,marginTop:2}}>{prestadorAtual.especialidade||cargoLabel(prestadorAtual.cargo)}</p>
          </div>
          <span style={S.badge("green")}>Minha Agenda</span>
        </div>
      ))}

      {loading?<Loading/>:<>

        {/* Seção 1: Identidade */}
        <div style={{background:"rgba(17,17,25,0.92)",border:`1px solid rgba(238,234,226,0.07)`,borderRadius:14,padding:"20px 22px",backdropFilter:"blur(12px)"}}>
          {secaoHeader(IcCfg.pencil,"Identidade Pública","O que o cliente vê ao abrir sua página de agendamento.")}
          <div className="flow-grid2">
            <div>
              <label style={S.label}>Nome exibido na página</label>
              <input style={S.input} value={config.nomeEmpresa||""} onChange={e=>setConfig(p=>({...p,nomeEmpresa:e.target.value}))} placeholder="Ex: Ana · Nail Designer"/>
            </div>
            <div>
              <label style={S.label}>Descrição curta</label>
              <input style={S.input} value={config.descricao||""} onChange={e=>setConfig(p=>({...p,descricao:e.target.value}))} placeholder="Ex: Especialista em unhas de gel"/>
            </div>
          </div>
        </div>

        {/* Seção 2: Horários */}
        <div style={{background:"rgba(17,17,25,0.92)",border:`1px solid rgba(238,234,226,0.07)`,borderRadius:14,padding:"20px 22px",backdropFilter:"blur(12px)"}}>
          {secaoHeader(IcCfg.clock2,"Horários de Atendimento","Defina quando você recebe clientes. Os horários disponíveis são gerados automaticamente.")}
          <p style={{...S.label,marginBottom:10}}>Dias de Atendimento</p>
          <div style={{display:"flex",gap:6,marginBottom:20,flexWrap:"wrap"}}>
            {DIAS_SEMANA.map(d=>{
              const a=(config.diasAtivos||[]).includes(d.key);
              return (
                <button key={d.key} onClick={()=>toggleDia(d.key)} style={{
                  width:46,height:46,borderRadius:10,
                  border:a?`1px solid ${T.gold}`:`1px solid rgba(238,234,226,0.07)`,
                  background:a?T.goldA12:"rgba(255,255,255,0.02)",
                  color:a?T.gold:T.text35,
                  fontSize:11.5,fontWeight:a?700:400,
                  cursor:"pointer",transition:"all 0.2s",
                  display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:2,
                  boxShadow:a?`0 0 12px ${T.goldA12}`:"none",
                }}>{d.label}</button>
              );
            })}
          </div>
          <div className="flow-grid3">
            <div>
              <label style={S.label}>Início do expediente</label>
              <input type="time" style={S.input} value={config.horaInicio||"08:00"} onChange={e=>setConfig(p=>({...p,horaInicio:e.target.value}))}/>
            </div>
            <div>
              <label style={S.label}>Fim do expediente</label>
              <input type="time" style={S.input} value={config.horaFim||"18:00"} onChange={e=>setConfig(p=>({...p,horaFim:e.target.value}))}/>
            </div>
            <div>
              <label style={S.label}>Intervalo entre horários</label>
              <select style={S.select} value={config.granularidadeMinutos||30} onChange={e=>setConfig(p=>({...p,granularidadeMinutos:parseInt(e.target.value)}))}>
                {[5,10,15,20,30,45,60].map(v=><option key={v} value={v}>{v<60?`${v} min`:"1h"}</option>)}
              </select>
            </div>
          </div>
          <div style={{marginTop:14,padding:"10px 14px",background:"rgba(192,155,82,0.04)",border:`1px solid ${T.goldA12}`,borderRadius:10,fontSize:11.5,color:T.text35,lineHeight:1.65,display:"flex",gap:8,alignItems:"flex-start"}}>
            <span style={{flexShrink:0,marginTop:1}}>💡</span>
            <span>O intervalo define o passo entre os horários disponíveis para o cliente — a duração real de cada serviço é sempre respeitada.</span>
          </div>
        </div>

        {/* Seção 2.5: Pausas Recorrentes (almoço, etc.) */}
        <div style={{background:"rgba(17,17,25,0.92)",border:`1px solid rgba(238,234,226,0.07)`,borderRadius:14,padding:"20px 22px",backdropFilter:"blur(12px)"}}>
          {secaoHeader(IcCfg.clock2,"Pausas Recorrentes","Horários fixos bloqueados todos os dias — como almoço. Salvo junto com as configurações.")}
          {(config.bloqueiosRecorrentes||[]).length>0&&(
            <div style={{marginBottom:14,borderRadius:10,overflow:"hidden",border:`1px solid rgba(238,234,226,0.07)`}}>
              {(config.bloqueiosRecorrentes||[]).map((p,i)=>(
                <div key={p.id} style={{display:"flex",alignItems:"center",gap:14,padding:"11px 16px",borderBottom:i<(config.bloqueiosRecorrentes.length-1)?`1px solid rgba(238,234,226,0.05)`:"none",background:i%2===0?"rgba(255,255,255,0.012)":"transparent"}}>
                  <div style={{flex:1}}>
                    <span style={{fontSize:13,fontWeight:600,color:T.text100}}>{p.motivo||"Pausa"}</span>
                    <span style={{fontSize:12,color:T.text35,marginLeft:10}}>{p.inicio} → {p.fim}</span>
                  </div>
                  <button style={S.btnDanger} onClick={()=>removerPausa(p.id)}>{Ic.trash}</button>
                </div>
              ))}
            </div>
          )}
          <div style={{background:"rgba(192,155,82,0.03)",border:`1px dashed ${T.goldA22}`,borderRadius:10,padding:"16px 18px"}}>
            <p style={{fontSize:12,fontWeight:700,color:T.gold,textTransform:"uppercase",letterSpacing:"1px",marginBottom:14}}>+ Nova Pausa</p>
            <div style={{display:"grid",gridTemplateColumns:"1fr 110px 110px auto",gap:10,alignItems:"flex-end"}}>
              <div><label style={S.label}>Descrição</label><input style={S.input} value={novaP.motivo} onChange={e=>setNovaP(p=>({...p,motivo:e.target.value}))} placeholder="Ex: Almoço"/></div>
              <div><label style={S.label}>Início</label><input type="time" style={S.input} value={novaP.inicio} onChange={e=>setNovaP(p=>({...p,inicio:e.target.value}))}/></div>
              <div><label style={S.label}>Fim</label><input type="time" style={S.input} value={novaP.fim} onChange={e=>setNovaP(p=>({...p,fim:e.target.value}))}/></div>
              <button onClick={addPausa} disabled={!novaP.motivo.trim()||novaP.inicio>=novaP.fim} style={{...S.btnPrimary,height:42,paddingLeft:16,paddingRight:16,opacity:(!novaP.motivo.trim()||novaP.inicio>=novaP.fim)?0.4:1}}>{Ic.plus} Add</button>
            </div>
          </div>
        </div>

        {/* Seção 2.6: Bloqueios por Data */}
        <div style={{background:"rgba(17,17,25,0.92)",border:`1px solid rgba(238,234,226,0.07)`,borderRadius:14,padding:"20px 22px",backdropFilter:"blur(12px)"}}>
          {secaoHeader(
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/></svg>,
            "Bloqueios por Data",
            "Feche datas específicas ou horários pontuais — feriados, ausências, compromissos."
          )}
          {bloqueiosData.length>0&&(
            <div style={{marginBottom:14,borderRadius:10,overflow:"hidden",border:`1px solid rgba(238,234,226,0.07)`}}>
              {bloqueiosData.map((b,i)=>{
                const passado=b.data<new Date().toISOString().slice(0,10);
                return (
                  <div key={b.id} style={{display:"flex",alignItems:"center",gap:14,padding:"11px 16px",borderBottom:i<bloqueiosData.length-1?`1px solid rgba(238,234,226,0.05)`:"none",background:i%2===0?"rgba(255,255,255,0.012)":"transparent",opacity:passado?0.45:1}}>
                    <div style={{flex:1}}>
                      <span style={{fontSize:13,fontWeight:600,color:T.text100}}>{b.motivo||"Bloqueio"}</span>
                      <span style={{fontSize:12,color:T.text35,marginLeft:10}}>
                        {b.data} · {b.diaTodo?"Dia todo":`${b.horaInicio} → ${b.horaFim}`}
                      </span>
                      {passado&&<span style={{marginLeft:8,fontSize:10,color:T.text18}}>(passado)</span>}
                    </div>
                    <button style={S.btnDanger} onClick={()=>removerBloqueioData(b.id)}>{Ic.trash}</button>
                  </div>
                );
              })}
            </div>
          )}
          {bloqueiosData.length===0&&(
            <div style={{textAlign:"center",padding:"20px 16px",marginBottom:14,background:"rgba(255,255,255,0.01)",border:`1px dashed rgba(238,234,226,0.07)`,borderRadius:10}}>
              <p style={{fontSize:13,color:T.text35}}>Nenhum bloqueio cadastrado</p>
            </div>
          )}
          <div style={{background:"rgba(96,165,250,0.03)",border:`1px dashed rgba(96,165,250,0.22)`,borderRadius:10,padding:"16px 18px"}}>
            <p style={{fontSize:12,fontWeight:700,color:T.blue,textTransform:"uppercase",letterSpacing:"1px",marginBottom:14}}>+ Novo Bloqueio</p>
            <div style={{display:"grid",gridTemplateColumns:"160px 1fr",gap:12,marginBottom:12}}>
              <div><label style={S.label}>Data *</label><input type="date" style={S.input} value={novoB.data} min={new Date().toISOString().slice(0,10)} onChange={e=>setNovoB(p=>({...p,data:e.target.value}))}/></div>
              <div><label style={S.label}>Motivo *</label><input style={S.input} value={novoB.motivo} onChange={e=>setNovoB(p=>({...p,motivo:e.target.value}))} placeholder="Ex: Feriado, Compromisso pessoal…"/></div>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12}}>
              <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",fontSize:12,color:T.text65}}>
                <input type="checkbox" checked={novoB.diaTodo} onChange={e=>setNovoB(p=>({...p,diaTodo:e.target.checked}))}
                  style={{width:16,height:16,accentColor:T.gold,cursor:"pointer"}}/>
                Fechar o dia todo
              </label>
            </div>
            {!novoB.diaTodo&&(
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
                <div><label style={S.label}>Horário início</label><input type="time" style={S.input} value={novoB.inicio} onChange={e=>setNovoB(p=>({...p,inicio:e.target.value}))}/></div>
                <div><label style={S.label}>Horário fim</label><input type="time" style={S.input} value={novoB.fim} onChange={e=>setNovoB(p=>({...p,fim:e.target.value}))}/></div>
              </div>
            )}
            <div style={{display:"flex",justifyContent:"flex-end"}}>
              <button onClick={addBloqueioData} disabled={salvandoB||!novoB.data||!novoB.motivo.trim()||(!novoB.diaTodo&&novoB.inicio>=novoB.fim)}
                style={{...S.btnPrimary,height:40,paddingLeft:20,paddingRight:20,opacity:(salvandoB||!novoB.data||!novoB.motivo.trim())?0.4:1}}>
                {salvandoB?"Salvando…":"Bloquear Data"}
              </button>
            </div>
          </div>
        </div>

        {/* Seção 3: Serviços */}
        <div style={{background:"rgba(17,17,25,0.92)",border:`1px solid rgba(238,234,226,0.07)`,borderRadius:14,padding:"20px 22px",backdropFilter:"blur(12px)"}}>
          {secaoHeader(IcCfg.tag2,"Serviços Oferecidos","Os clientes escolhem um serviço antes de selecionar o horário.")}
          {(config.serviços||[]).length>0&&(
            <div style={{marginBottom:16,borderRadius:10,overflow:"hidden",border:`1px solid rgba(238,234,226,0.07)`}}>
              {config.serviços.map((s,i)=>(
                <div key={s.id} style={{
                  display:"grid",
                  gridTemplateColumns:"1fr auto auto auto auto",
                  gap:"0 20px",
                  alignItems:"center",
                  padding:"13px 16px",
                  borderBottom:i<config.serviços.length-1?`1px solid rgba(238,234,226,0.05)`:"none",
                  background:i%2===0?"rgba(255,255,255,0.012)":"transparent",
                }}>
                  <div>
                    <p style={{fontSize:13,fontWeight:600,color:T.text100,marginBottom:2}}>{s.nome}</p>
                    {s.descricao&&<p style={{fontSize:11,color:T.text35}}>{s.descricao}</p>}
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:5,color:T.text35,fontSize:12,whiteSpace:"nowrap"}}>
                    <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                    {formatDuracao(s.duracao_min)}
                  </div>
                  <span style={{...S.badge(s.preco>0?"yellow":"gray"),whiteSpace:"nowrap"}}>
                    {s.preco>0?`R$ ${Number(s.preco).toLocaleString("pt-BR",{minimumFractionDigits:2})}`:"Gratuito"}
                  </span>
                  <button style={S.btnDanger} onClick={()=>setConfig(p=>({...p,serviços:p.serviços.filter(x=>x.id!==s.id)}))}>{Ic.trash}</button>
                </div>
              ))}
            </div>
          )}
          {(config.serviços||[]).length===0&&(
            <div style={{textAlign:"center",padding:"28px 16px",marginBottom:16,background:"rgba(255,255,255,0.01)",border:`1px dashed rgba(238,234,226,0.07)`,borderRadius:10}}>
              <p style={{fontSize:13,color:T.text35,marginBottom:4}}>Nenhum serviço cadastrado ainda</p>
              <p style={{fontSize:11.5,color:T.text18}}>Adicione abaixo para que os clientes possam agendar.</p>
            </div>
          )}
          <div style={{background:"rgba(192,155,82,0.03)",border:`1px dashed ${T.goldA22}`,borderRadius:10,padding:"16px 18px"}}>
            <p style={{fontSize:12,fontWeight:700,color:T.gold,textTransform:"uppercase",letterSpacing:"1px",marginBottom:14}}>+ Novo Serviço</p>
            <div className="flow-grid3" style={{marginBottom:12}}>
              <div><label style={S.label}>Nome *</label><input style={S.input} value={novoS.nome} onChange={e=>setNovoS(p=>({...p,nome:e.target.value}))} placeholder="Ex: Manicure com Esmaltação"/></div>
              <div><label style={S.label}>Duração</label><select style={S.select} value={novoS.duracao} onChange={e=>setNovoS(p=>({...p,duracao:e.target.value}))}>{[15,20,30,45,60,75,90,120,150,180,240].map(v=><option key={v} value={v}>{formatDuracao(v)}</option>)}</select></div>
              <div><label style={S.label}>Preço (R$)</label><input style={S.input} type="number" min="0" step="0.01" value={novoS.preco} onChange={e=>setNovoS(p=>({...p,preco:e.target.value}))} placeholder="0,00"/></div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:12,alignItems:"flex-end"}}>
              <div><label style={S.label}>Descrição curta (opcional)</label><input style={S.input} value={novoS.descricao} onChange={e=>setNovoS(p=>({...p,descricao:e.target.value}))} placeholder="Breve descrição exibida para o cliente"/></div>
              <button onClick={addServico} disabled={!novoS.nome.trim()} style={{...S.btnPrimary,height:42,paddingLeft:18,paddingRight:18,opacity:novoS.nome.trim()?1:0.4}}>{Ic.plus} Adicionar</button>
            </div>
          </div>
        </div>

        <div style={{display:"flex",justifyContent:"flex-end",paddingBottom:8}}>
          <button onClick={salvar} disabled={salvando} style={{...S.btnPrimary,padding:"11px 32px",fontSize:14,boxShadow:"0 4px 20px rgba(192,155,82,0.30)"}}>
            {salvando?"Salvando…":"Salvar Configurações"}
          </button>
        </div>
      </>}
    </div>
  );
}

// ─── Tela Link Público ────────────────────────────────────────────────────────
function TelaLinkPublico({tenantUid,prestadores,meuPrestadorId,isAdmin}){
  const [configs,setConfigs]=useState({});
  const [copied,setCopied]=useState(null);
  const [expanded,setExpanded]=useState(null);

  useEffect(()=>{
    if(!tenantUid||!prestadores.length) return;
    const ativos=prestadores.filter(p=>p.ativo);
    const unsubs=ativos.map(p=>{
      const ref=doc(db,"users",tenantUid,"agendamento_configuracoes",p.id);
      return onSnapshot(ref,snap=>setConfigs(prev=>({...prev,[p.id]:snap.exists()?snap.data():null})));
    });
    return()=>unsubs.forEach(u=>u());
  },[tenantUid,prestadores.length]);

  const copiar=id=>{
    navigator.clipboard.writeText(id==="admin"?`${PUBLIC_BASE}?tenant=${tenantUid}`:`${PUBLIC_BASE}?tenant=${tenantUid}&prestador=${id}`);
    setCopied(id); setTimeout(()=>setCopied(null),2500);
  };
  const lista=isAdmin?prestadores.filter(p=>p.ativo):prestadores.filter(p=>p.id===meuPrestadorId);

  const IcExternal = <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>;

  return (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      {isAdmin&&(
        <div style={{background:"rgba(17,17,25,0.92)",border:`1px solid rgba(238,234,226,0.07)`,borderLeft:`3px solid ${T.gold}`,borderRadius:14,padding:"16px 20px",backdropFilter:"blur(12px)",position:"relative",overflow:"hidden",display:"flex",alignItems:"flex-start",gap:14}}>
          <div style={{position:"absolute",top:0,left:0,width:120,height:"100%",background:`linear-gradient(90deg,${T.goldA06} 0%,transparent 100%)`,pointerEvents:"none"}}/>
          <div style={{width:36,height:36,borderRadius:10,background:T.goldA06,border:`1px solid ${T.goldA22}`,display:"flex",alignItems:"center",justifyContent:"center",color:T.gold,flexShrink:0,fontSize:16}}>🔗</div>
          <div style={{flex:1}}>
            <p style={{fontSize:13,fontWeight:700,color:T.text100,marginBottom:4}}>Links de Agendamento Público</p>
            <p style={{fontSize:12,color:T.text35,lineHeight:1.65}}>
              O link do <strong style={{color:T.gold}}>Administrador</strong> é o endereço principal da empresa — funciona sem parâmetros adicionais.
              Os links de colaboradores incluem o identificador único de cada prestador automaticamente.
            </p>
          </div>
        </div>
      )}

      {lista.length===0?(
        <div style={{background:"rgba(17,17,25,0.92)",border:`1px solid rgba(238,234,226,0.07)`,borderRadius:14,padding:"52px 24px",textAlign:"center",backdropFilter:"blur(12px)"}}>
          <p style={{fontSize:22,marginBottom:8}}>📭</p>
          <p style={{fontSize:13,fontWeight:700,color:T.text35}}>Nenhum prestador ativo no momento.</p>
        </div>
      ):(
        lista.map(p=>{
          const cfg=configs[p.id];
          const link=p.id==="admin"?`${PUBLIC_BASE}?tenant=${tenantUid}`:`${PUBLIC_BASE}?tenant=${tenantUid}&prestador=${p.id}`;
          const temS=cfg?.serviços?.length>0;
          const temH=cfg?.diasAtivos?.length>0;
          const temNome=!!cfg?.nomeEmpresa;
          const prontoParaCompartilhar=temS&&temH&&temNome;
          const numServicos=(cfg?.serviços||[]).length;
          const diasAtivos=(cfg?.diasAtivos||[]);
          const isExpanded=expanded===p.id;
          const statusBorder = prontoParaCompartilhar ? T.emerald : T.goldLo;
          const statusGlow   = prontoParaCompartilhar ? "rgba(45,211,122,0.08)" : "rgba(192,155,82,0.06)";

          return (
            <div key={p.id} style={{
              background:"rgba(17,17,25,0.92)",
              border:`1px solid rgba(238,234,226,0.07)`,
              borderLeft:`3px solid ${statusBorder}`,
              borderRadius:14,
              backdropFilter:"blur(12px)",
              overflow:"hidden",
              transition:"box-shadow 0.25s",
              position:"relative",
            }}
            onMouseEnter={e=>{e.currentTarget.style.boxShadow=`0 4px 32px rgba(0,0,0,0.38), 0 0 0 1px rgba(238,234,226,0.07)`;}}
            onMouseLeave={e=>{e.currentTarget.style.boxShadow="none";}}>
              <div style={{position:"absolute",top:0,left:0,width:120,height:"100%",background:`linear-gradient(90deg,${statusGlow} 0%,transparent 100%)`,pointerEvents:"none"}}/>

              {/* Cabeçalho */}
              <div style={{padding:"18px 22px",display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>
                <Avatar nome={p.nome}/>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3,flexWrap:"wrap"}}>
                    <p style={{fontSize:14,fontWeight:700,color:T.text100,letterSpacing:"-0.1px"}}>{p.nome}</p>
                    {p.isAdmin&&<span style={{...S.badge("yellow"),display:"flex",alignItems:"center",gap:3,fontSize:10}}>{Ic.crown} Admin</span>}
                    <span style={S.badge(prontoParaCompartilhar?"green":"yellow")}>{prontoParaCompartilhar?"Pronto":"Incompleto"}</span>
                  </div>
                  <p style={{fontSize:12,color:T.text35}}>{p.especialidade||"Prestador de serviço"}</p>
                </div>
                <div style={{display:"flex",gap:8,alignItems:"center",flexShrink:0,flexWrap:"wrap"}}>
                  <button onClick={()=>setExpanded(isExpanded?null:p.id)} style={{...S.btnGhost,padding:"7px 12px",fontSize:11,color:isExpanded?T.gold:T.text35,borderColor:isExpanded?T.goldA22:undefined}}>
                    {isExpanded?"▲ Menos":"▼ Detalhes"}
                  </button>
                  <button onClick={()=>window.open(link,"_blank")} style={{...S.btnGhost,padding:"7px 12px",fontSize:11}}>
                    {IcExternal} Abrir
                  </button>
                  <button onClick={()=>copiar(p.id)} style={{
                    ...S.btnPrimary,
                    background:copied===p.id?T.emeraldA10:`linear-gradient(135deg, ${T.goldHi} 0%, ${T.goldLo} 100%)`,
                    color:copied===p.id?T.emerald:T.ink,
                    border:copied===p.id?`1px solid ${T.emeraldA22}`:"none",
                    padding:"7px 16px",fontSize:12,
                    boxShadow:copied===p.id?"0 0 12px rgba(45,211,122,0.18)":"0 4px 14px rgba(192,155,82,0.22)",
                  }}>
                    {copied===p.id?<>{Ic.check} Copiado!</>:<>{Ic.copy} Copiar Link</>}
                  </button>
                </div>
              </div>

              {/* URL */}
              <div style={{margin:"0 22px 16px",padding:"10px 14px",background:"rgba(255,255,255,0.025)",border:`1px solid rgba(238,234,226,0.06)`,borderRadius:10,display:"flex",alignItems:"center",gap:10}}>
                <div style={{width:22,height:22,borderRadius:6,background:T.goldA06,border:`1px solid ${T.goldA12}`,display:"flex",alignItems:"center",justifyContent:"center",color:T.gold,flexShrink:0,fontSize:10}}>🔗</div>
                <span style={{fontSize:11.5,color:T.text35,flex:1,wordBreak:"break-all",fontFamily:"'JetBrains Mono', monospace"}}>{link}</span>
              </div>

              {/* Checklist */}
              <div style={{margin:"0 22px",padding:"12px 16px",background:"rgba(255,255,255,0.015)",border:`1px solid rgba(238,234,226,0.05)`,borderRadius:10,display:"flex",gap:24,flexWrap:"wrap",marginBottom:prontoParaCompartilhar&&!isExpanded?16:12}}>
                <CheckItem ok={temNome} label="Nome preenchido"/>
                <CheckItem ok={temH} label={temH?`${diasAtivos.length} dias ativos`:"Horários configurados"}/>
                <CheckItem ok={temS} label={temS?`${numServicos} serviço${numServicos!==1?"s":""}`:"Serviços cadastrados"}/>
              </div>

              {!prontoParaCompartilhar&&(
                <div style={{margin:"0 22px",marginBottom:16,padding:"10px 14px",background:"rgba(192,155,82,0.04)",border:`1px solid rgba(192,155,82,0.18)`,borderRadius:10,fontSize:11.5,color:"#D9B96E",display:"flex",gap:8,alignItems:"flex-start"}}>
                  <span style={{flexShrink:0}}>⚠️</span>
                  <span>
                    {[!temNome&&"preencha o nome público",!temH&&"configure dias e horários",!temS&&"adicione pelo menos um serviço"].filter(Boolean).join(", ")}
                    {" "}antes de compartilhar este link.
                  </span>
                </div>
              )}

              {isExpanded&&(
                <div style={{borderTop:`1px solid rgba(238,234,226,0.05)`,padding:"16px 22px",display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
                  <div>
                    <p style={{...S.sectionTitle,marginBottom:10}}>Dias Ativos</p>
                    <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                      {["dom","seg","ter","qua","qui","sex","sab"].map(k=>{
                        const ativo=diasAtivos.includes(k);
                        const label={dom:"Dom",seg:"Seg",ter:"Ter",qua:"Qua",qui:"Qui",sex:"Sex",sab:"Sáb"}[k];
                        return <div key={k} style={{padding:"5px 10px",borderRadius:7,fontSize:11,fontWeight:ativo?700:400,background:ativo?T.goldA12:"rgba(255,255,255,0.02)",border:ativo?`1px solid ${T.goldA22}`:`1px solid rgba(238,234,226,0.05)`,color:ativo?T.gold:T.text18}}>{label}</div>;
                      })}
                    </div>
                    {cfg?.horaInicio&&cfg?.horaFim&&(
                      <p style={{fontSize:11.5,color:T.text35,marginTop:10}}>{cfg.horaInicio} – {cfg.horaFim} · intervalo de {cfg.granularidadeMinutos||30} min</p>
                    )}
                  </div>
                  <div>
                    <p style={{...S.sectionTitle,marginBottom:10}}>Serviços ({numServicos})</p>
                    {numServicos===0?<p style={{fontSize:12,color:T.text18}}>Nenhum serviço cadastrado.</p>:(
                      <div style={{display:"flex",flexDirection:"column",gap:6}}>
                        {(cfg?.serviços||[]).slice(0,4).map(s=>(
                          <div key={s.id} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 10px",background:"rgba(255,255,255,0.02)",borderRadius:8,border:`1px solid rgba(238,234,226,0.05)`}}>
                            <span style={{fontSize:12,color:T.text100,fontWeight:600,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.nome}</span>
                            <span style={{fontSize:11,color:T.text35,whiteSpace:"nowrap"}}>{formatDuracao(s.duracao_min)}</span>
                            <span style={{...S.badge(s.preco>0?"yellow":"gray"),fontSize:10}}>{s.preco>0?`R$${Number(s.preco).toLocaleString("pt-BR",{minimumFractionDigits:2})}`:"Free"}</span>
                          </div>
                        ))}
                        {numServicos>4&&<p style={{fontSize:11,color:T.text18,marginTop:2}}>+{numServicos-4} serviço{numServicos-4!==1?"s":""} adicionais</p>}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

// ─── Upgrade Wall ─────────────────────────────────────────────────────────────
function TelaUpgrade({onVoltar}){
  return (
    <div style={S.upgradeWall}>
      <div style={{width:72,height:72,borderRadius:20,background:"linear-gradient(140deg,#D9B96E 0%,#856830 100%)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:30,boxShadow:"0 0 0 1px rgba(192,155,82,0.25), 0 12px 40px rgba(192,155,82,0.22)"}}>
        <svg width="28" height="28" fill="none" stroke="#040408" strokeWidth="2" viewBox="0 0 24 24"><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/></svg>
      </div>
      <h2 style={{fontSize:24,fontWeight:800,color:"#EEEAE2",marginBottom:4,letterSpacing:"-0.5px"}}>Assent Flow</h2>
      <p style={{fontSize:14,color:"rgba(238,234,226,0.40)",maxWidth:340,lineHeight:1.7,marginBottom:24}}>Disponível no plano <strong style={{color:"#D9B96E"}}>Profissional</strong>.</p>
      <div style={{display:"flex",gap:12}}>
        <button style={{...S.btnPrimary,padding:"11px 28px",fontSize:14}} onClick={()=>window.open("mailto:contato@assentagencia.com.br?subject=Upgrade Profissional","_blank")}>⭐ Fazer Upgrade</button>
        <button onClick={onVoltar} style={S.btnGhost}>Voltar</button>
      </div>
    </div>
  );
}

// ─── CSS Responsivo ───────────────────────────────────────────────────────────
const FLOW_RESPONSIVE_CSS = `
  /* Grids responsivos */
  .flow-grid4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
  .flow-grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .flow-grid3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }

  @media (max-width: 900px) {
    .flow-grid4 { grid-template-columns: repeat(2, 1fr) !important; }
  }
  @media (max-width: 640px) {
    .flow-grid4 { grid-template-columns: repeat(2, 1fr) !important; }
    .flow-grid2 { grid-template-columns: 1fr !important; }
    .flow-grid3 { grid-template-columns: 1fr 1fr !important; }
  }
  @media (max-width: 420px) {
    .flow-grid4 { grid-template-columns: 1fr 1fr !important; }
    .flow-grid3 { grid-template-columns: 1fr !important; }
  }

  /* Sidebar mobile: drawer lateral */
  @media (max-width: 720px) {
    .flow-sidebar {
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      height: 100% !important;
      z-index: 200 !important;
      transform: translateX(-100%) !important;
      box-shadow: none !important;
    }
    .flow-sidebar.open {
      transform: translateX(0) !important;
      box-shadow: 8px 0 32px rgba(0,0,0,0.55) !important;
    }
    .flow-overlay {
      display: block !important;
    }
    .flow-hamburger {
      display: flex !important;
    }
    .flow-plan-badge {
      display: none !important;
    }
    .flow-content {
      padding: 16px !important;
      padding-bottom: 80px !important;
    }
    .flow-topbar {
      padding: 0 14px !important;
    }
  }

  /* Overlay escuro atrás do drawer */
  .flow-overlay {
    display: none;
    position: fixed;
    inset: 0;
    background: rgba(4,4,8,0.72);
    z-index: 199;
    backdrop-filter: blur(4px);
    animation: fadeIn 0.22s ease;
  }
  @keyframes fadeIn { from { opacity:0 } to { opacity:1 } }

  /* Hamburger: oculto em desktop */
  .flow-hamburger {
    display: none;
    background: none;
    border: none;
    cursor: pointer;
    color: rgba(238,234,226,0.55);
    padding: 6px;
    border-radius: 8px;
    align-items: center;
    justify-content: center;
    transition: color 0.15s, background 0.15s;
    flex-shrink: 0;
  }
  .flow-hamburger:hover { color: #EEEAE2; background: rgba(238,234,226,0.06); }

  /* Bottom nav mobile */
  .flow-bottom-nav {
    display: none;
    position: fixed;
    bottom: 0; left: 0; right: 0;
    height: 60px;
    background: rgba(7,7,13,0.96);
    border-top: 1px solid rgba(238,234,226,0.07);
    z-index: 150;
    align-items: center;
    justify-content: space-around;
    backdrop-filter: blur(16px);
    padding: 0 8px;
  }
  @media (max-width: 720px) {
    .flow-bottom-nav { display: flex !important; }
  }
  .flow-bnav-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
    cursor: pointer;
    padding: 6px 12px;
    border-radius: 10px;
    transition: all 0.18s;
    color: rgba(238,234,226,0.30);
    font-size: 9.5px;
    font-weight: 600;
    letter-spacing: 0.2px;
    user-select: none;
    border: none;
    background: transparent;
    min-width: 52px;
  }
  .flow-bnav-item.active {
    color: #C09B52;
    background: rgba(192,155,82,0.08);
  }

  /* ReservaCard: 4 colunas → 2 colunas → 1 coluna */
  @media (max-width: 900px) {
    .flow-reserva-card {
      grid-template-columns: 1fr 1fr !important;
      gap: 14px !important;
    }
  }
  @media (max-width: 580px) {
    .flow-reserva-card {
      grid-template-columns: 1fr !important;
      gap: 12px !important;
    }
    .flow-reserva-card > div {
      border-left: none !important;
      padding-left: 0 !important;
    }
  }
`;

// ─── Componente Principal ─────────────────────────────────────────────────────
export default function AssFlow({tenantUid,plano,theme,onToggleTheme,onVoltar}){
  // HOOKS PRIMEIRO
  const {isAdmin,podeVer,podeEditar,user} = useAuth();
  const [tela,setTela]           = useState("overview");
  const [prestadores,setPrestadores] = useState([]);
  const [loadingP,setLoadingP]   = useState(true);
  const [prestadorFoco,setPrestadorFoco] = useState(null);
  const [sidebarOpen,setSidebarOpen] = useState(false);

  const meuPrestadorId = isAdmin ? "admin" : (prestadores.find(p=>p.linkedUserId===user?.uid&&p.ativo)?.id || null);

  // Auto-init admin
  useEffect(()=>{
    if(!tenantUid||!user||!isAdmin) return;
    async function initAdmin(){
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
      const cfgAdminRef=doc(db,"users",tenantUid,"agendamento_configuracoes","admin");
      const cfgAdminSnap=await getDoc(cfgAdminRef);
      if(!cfgAdminSnap.exists()){
        const cfgOldRef=doc(db,"users",tenantUid,"agendamento_configuracoes","config");
        const cfgOldSnap=await getDoc(cfgOldRef);
        if(cfgOldSnap.exists()){
          const oldData=cfgOldSnap.data();
          await setDoc(cfgAdminRef,{
            ...oldData,
            serviços: oldData.serviços || oldData.servicos || [],
            migradoEm: serverTimestamp(),
          });
          await updateDoc(cfgOldRef,{ _migrado:"admin", _migradoEm:serverTimestamp() });
        } else {
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

  // Carrega prestadores
  useEffect(()=>{
    if(!tenantUid) return;
    const q=query(collection(db,"users",tenantUid,"agendamento_prestadores"),orderBy("criadoEm","asc"));
    const u=onSnapshot(q,snap=>{
      const list=snap.docs.map(d=>({id:d.id,...d.data()}));
      const adminP=list.find(p=>p.id==="admin");
      const rest=list.filter(p=>p.id!=="admin");
      setPrestadores(adminP?[adminP,...rest]:rest);
      setLoadingP(false);
    });
    return()=>u();
  },[tenantUid]);

  // Fechar sidebar ao navegar
  const irPara=(key)=>{ setTela(key); setSidebarOpen(false); };
  const irParaConfiguracoes=(pid)=>{ setPrestadorFoco(pid); irPara("configuracoes"); };

  // Guards
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

  const TELAS=[
    {key:"overview",      label:"Visão Geral",    icon:Ic.calendar},
    ...(isAdmin?[{key:"equipe",label:"Equipe",icon:Ic.users}]:[]),
    {key:"reservas",      label:"Reservas",       icon:Ic.list},
    {key:"configuracoes", label:"Configurações",  icon:Ic.settings},
    {key:"link",          label:"Link Público",   icon:Ic.link},
  ];
  const titulos={overview:"Visão Geral",equipe:"Equipe no Flow",reservas:"Reservas",configuracoes:"Configurações",link:"Link Público"};

  // Bottom nav: primeiras 4 telas (mobile)
  const BOTTOM_TELAS = TELAS.slice(0, 4);

  return (
    <div style={S.root}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(192,155,82,0.18); border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(192,155,82,0.35); }
        @keyframes flow-reveal { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(0.5) sepia(1) saturate(2) hue-rotate(5deg); opacity:0.5; cursor:pointer; }
        input[type="time"]::-webkit-calendar-picker-indicator { filter: invert(0.5) sepia(1) saturate(2) hue-rotate(5deg); opacity:0.5; cursor:pointer; }
        ${FLOW_RESPONSIVE_CSS}
      `}</style>

      {/* Overlay mobile */}
      {sidebarOpen&&(
        <div className="flow-overlay" onClick={()=>setSidebarOpen(false)}/>
      )}

      {/* Sidebar */}
      <aside className={`flow-sidebar${sidebarOpen?" open":""}`} style={S.sidebar}>
        <div style={S.sidebarHeader}>
          <div style={S.logoRow}>
            <img src="/logo2_flow.png" alt="Flow" style={{ height:40, maxWidth:"100%", objectFit:"contain", display:"block" }} />
          </div>
        </div>
        <nav style={{flex:1}}>
          {TELAS.map(t=>(
            <div key={t.key} style={S.navItem(tela===t.key)} onClick={()=>irPara(t.key)}>
              {t.icon}{t.label}
            </div>
          ))}
        </nav>
        <div style={S.sidebarFooter}>
          <button style={S.btnSidebarSecondary} onClick={onVoltar}>{Ic.back}Voltar ao Gestão</button>
        </div>
      </aside>

      {/* Main */}
      <main style={S.main}>
        <header className="flow-topbar" style={S.topbar}>
          {/* Hamburger mobile */}
          <button className="flow-hamburger" onClick={()=>setSidebarOpen(o=>!o)} aria-label="Menu">
            {sidebarOpen ? Ic.close : Ic.menu}
          </button>
          <span style={S.topbarTitle}>{titulos[tela]}</span>
          <span className="flow-plan-badge" style={{fontSize:10,padding:"4px 12px",borderRadius:20,border:"1px solid rgba(192,155,82,0.25)",background:"rgba(192,155,82,0.08)",color:"#D9B96E",fontWeight:700,letterSpacing:"0.8px",textTransform:"uppercase",flexShrink:0}}>★ Profissional</span>
        </header>

        <div className="flow-content" style={S.content}>
          {loadingP?<Loading/>:<>
            {tela==="overview"      &&<TelaVisaoGeral    tenantUid={tenantUid} prestadores={prestadores} meuPrestadorId={meuPrestadorId} isAdmin={isAdmin}/>}
            {tela==="equipe"        &&<TelaEquipe        tenantUid={tenantUid} user={user} prestadores={prestadores} onConfigurar={irParaConfiguracoes}/>}
            {tela==="reservas"      &&<TelaReservas      tenantUid={tenantUid} prestadores={prestadores} meuPrestadorId={meuPrestadorId} isAdmin={isAdmin} podeEditar={podeEditar("agendamento")}/>}
            {tela==="configuracoes" &&<TelaConfiguracoes tenantUid={tenantUid} prestadores={prestadores} meuPrestadorId={meuPrestadorId} isAdmin={isAdmin} prestadorFoco={prestadorFoco}/>}
            {tela==="link"          &&<TelaLinkPublico   tenantUid={tenantUid} prestadores={prestadores} meuPrestadorId={meuPrestadorId} isAdmin={isAdmin}/>}
          </>}
        </div>
      </main>

      {/* Bottom Nav mobile */}
      <nav className="flow-bottom-nav">
        {BOTTOM_TELAS.map(t=>(
          <button
            key={t.key}
            className={`flow-bnav-item${tela===t.key?" active":""}`}
            onClick={()=>irPara(t.key)}
          >
            <span style={{display:"flex",fontSize:16}}>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
        {/* Botão "mais" para telas que ficaram de fora */}
        {TELAS.length > 4 && (
          <button
            className={`flow-bnav-item${!BOTTOM_TELAS.find(t=>t.key===tela)&&tela!=="overview"&&tela!=="equipe"&&tela!=="reservas"&&tela!=="configuracoes"?" active":""}`}
            onClick={()=>irPara(TELAS[4].key)}
          >
            <span style={{display:"flex",fontSize:16}}>{TELAS[4].icon}</span>
            <span>{TELAS[4].label}</span>
          </button>
        )}
      </nav>
    </div>
  );
}
