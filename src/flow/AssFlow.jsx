// src/flow/AssFlow.jsx
// ASSENT Flow v2.0 — Multi-prestador + Disponibilidade por tempo real
// Convenções AG v2.0: guard tenantUid, paths /users/{tenantUid}/..., serverTimestamp()

import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext.jsx";
import {
  getFirestore, collection, doc, onSnapshot,
  setDoc, updateDoc, deleteDoc, addDoc,
  serverTimestamp, query, orderBy,
} from "firebase/firestore";

const db = getFirestore();
const PUBLIC_BASE = "https://flow.assentagencia.com.br";

// ─── Estilos ─────────────────────────────────────────────────────────────────
const S = {
  root: { display:"flex", height:"100vh", background:"var(--bg)", color:"var(--text)", fontFamily:"var(--font,'Montserrat',sans-serif)", overflow:"hidden" },
  sidebar: { width:220, minWidth:220, background:"var(--s1)", borderRight:"1px solid var(--border)", display:"flex", flexDirection:"column", padding:"0 0 16px 0" },
  sidebarHeader: { padding:"24px 20px 20px", borderBottom:"1px solid var(--border)", marginBottom:8 },
  logoRow: { display:"flex", alignItems:"center", gap:10, marginBottom:4 },
  logoIcon: { width:32, height:32, background:"linear-gradient(135deg,var(--gold) 0%,#1a3a5c 100%)", borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, fontWeight:700, color:"#fff" },
  logoText: { fontSize:13, fontWeight:700, color:"var(--gold)", letterSpacing:2, textTransform:"uppercase" },
  logoSub: { fontSize:10, color:"var(--text-muted)", letterSpacing:1, textTransform:"uppercase" },
  navItem: a => ({ display:"flex", alignItems:"center", gap:10, padding:"10px 20px", cursor:"pointer", background:a?"var(--gold-alpha,rgba(212,175,55,0.12))":"transparent", borderLeft:a?"3px solid var(--gold)":"3px solid transparent", color:a?"var(--gold)":"var(--text-muted)", fontSize:13, fontWeight:a?600:400, transition:"all 0.15s", userSelect:"none" }),
  sidebarFooter: { marginTop:"auto", padding:"0 12px", display:"flex", flexDirection:"column", gap:8 },
  btnSecondary: { padding:"8px 14px", background:"var(--s2,rgba(255,255,255,0.05))", border:"1px solid var(--border)", borderRadius:8, color:"var(--text-muted)", fontSize:12, cursor:"pointer", display:"flex", alignItems:"center", gap:6, width:"100%" },
  main: { flex:1, display:"flex", flexDirection:"column", overflow:"hidden" },
  topbar: { height:56, borderBottom:"1px solid var(--border)", display:"flex", alignItems:"center", padding:"0 24px", gap:12, background:"var(--s1)", flexShrink:0 },
  topbarTitle: { fontSize:15, fontWeight:600, color:"var(--text)", flex:1 },
  badge: c => ({ padding:"2px 10px", borderRadius:20, fontSize:11, fontWeight:600, background:c==="green"?"rgba(34,197,94,0.15)":c==="yellow"?"rgba(234,179,8,0.15)":c==="red"?"rgba(239,68,68,0.15)":"rgba(156,163,175,0.15)", color:c==="green"?"#22c55e":c==="yellow"?"#eab308":c==="red"?"#ef4444":"#9ca3af", border:`1px solid ${c==="green"?"rgba(34,197,94,0.3)":c==="yellow"?"rgba(234,179,8,0.3)":c==="red"?"rgba(239,68,68,0.3)":"rgba(156,163,175,0.3)"}` }),
  content: { flex:1, overflow:"auto", padding:24 },
  card: { background:"var(--s1)", border:"1px solid var(--border)", borderRadius:12, padding:20 },
  grid2: { display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 },
  grid4: { display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:16 },
  statCard: { background:"var(--s1)", border:"1px solid var(--border)", borderRadius:12, padding:20, display:"flex", flexDirection:"column", gap:6 },
  sectionTitle: { fontSize:13, fontWeight:600, color:"var(--text-muted)", textTransform:"uppercase", letterSpacing:1, marginBottom:12 },
  table: { width:"100%", borderCollapse:"collapse" },
  th: { textAlign:"left", padding:"8px 12px", fontSize:11, color:"var(--text-muted)", textTransform:"uppercase", letterSpacing:0.5, borderBottom:"1px solid var(--border)", fontWeight:600 },
  td: { padding:"12px", fontSize:13, borderBottom:"1px solid var(--border)", verticalAlign:"middle" },
  btnPrimary: { padding:"8px 18px", background:"var(--gold)", border:"none", borderRadius:8, color:"#000", fontSize:13, fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", gap:6 },
  btnGhost: { padding:"6px 12px", background:"transparent", border:"1px solid var(--border)", borderRadius:6, color:"var(--text-muted)", fontSize:12, cursor:"pointer" },
  btnDanger: { padding:"6px 12px", background:"rgba(239,68,68,0.1)", border:"1px solid rgba(239,68,68,0.3)", borderRadius:6, color:"#ef4444", fontSize:12, cursor:"pointer" },
  btnSuccess: { padding:"6px 12px", background:"rgba(34,197,94,0.1)", border:"1px solid rgba(34,197,94,0.3)", borderRadius:6, color:"#22c55e", fontSize:12, cursor:"pointer" },
  btnBlue: { padding:"6px 12px", background:"rgba(59,130,246,0.1)", border:"1px solid rgba(59,130,246,0.3)", borderRadius:6, color:"#3b82f6", fontSize:12, cursor:"pointer" },
  input: { width:"100%", padding:"9px 12px", background:"var(--s2,rgba(255,255,255,0.05))", border:"1px solid var(--border)", borderRadius:8, color:"var(--text)", fontSize:13, outline:"none", boxSizing:"border-box" },
  select: { width:"100%", padding:"9px 12px", background:"var(--s2,rgba(255,255,255,0.05))", border:"1px solid var(--border)", borderRadius:8, color:"var(--text)", fontSize:13, outline:"none", cursor:"pointer", boxSizing:"border-box" },
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
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
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
function statusColor(s) { return s==="confirmado"?"green":s==="pendente"?"yellow":s==="cancelado"?"red":"gray"; }
function statusLabel(s) { return s==="confirmado"?"Confirmado":s==="pendente"?"Pendente":s==="cancelado"?"Cancelado":s; }
function initials(nome) { return (nome||"?").split(" ").slice(0,2).map(w=>w[0]).join("").toUpperCase(); }
function formatDuracao(min) { if(min<60) return `${min} min`; const h=Math.floor(min/60),m=min%60; return m===0?`${h}h`:`${h}h${m}min`; }

const CONFIG_DEFAULT = {
  serviços:[],diasAtivos:["seg","ter","qua","qui","sex"],
  horaInicio:"08:00",horaFim:"18:00",granularidadeMinutos:30,
  nomeEmpresa:"",descricao:"",atualizadoEm:null,
};

// ─── useToast ─────────────────────────────────────────────────────────────────
function useToast() {
  const [toast,setToast] = useState(null);
  const show = (msg,type="success") => { setToast({msg,type}); setTimeout(()=>setToast(null),3000); };
  return [toast,show];
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({toast}) {
  if (!toast?.msg) return null;
  return (
    <div style={{ position:"fixed",bottom:24,right:24,padding:"12px 20px",borderRadius:10,
      background:toast.type==="success"?"rgba(34,197,94,0.15)":"rgba(239,68,68,0.15)",
      border:`1px solid ${toast.type==="success"?"rgba(34,197,94,0.4)":"rgba(239,68,68,0.4)"}`,
      color:toast.type==="success"?"#22c55e":"#ef4444",fontSize:13,fontWeight:600,zIndex:999,backdropFilter:"blur(8px)" }}>
      {toast.msg}
    </div>
  );
}

// ─── LoadingSpinner ───────────────────────────────────────────────────────────
function LoadingSpinner({height=200}) {
  return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",height,gap:10,color:"var(--text-muted)",fontSize:13}}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2" style={{animation:"spin 0.8s linear infinite"}}>
        <circle cx="12" cy="12" r="10" strokeOpacity="0.2"/><path d="M12 2a10 10 0 0 1 10 10"/>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </svg>Carregando…
    </div>
  );
}

// ─── Avatar ───────────────────────────────────────────────────────────────────
function Avatar({nome, size=36}) {
  return (
    <div style={{width:size,height:size,borderRadius:size/3,background:"linear-gradient(135deg,var(--gold) 0%,#1a3a5c 100%)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:size*0.38,fontWeight:700,color:"#fff",flexShrink:0}}>
      {initials(nome)}
    </div>
  );
}

// ─── StatusBar ────────────────────────────────────────────────────────────────
function StatusBar({label,value,total,color}) {
  const pct = total>0?Math.round((value/total)*100):0;
  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
        <span style={{fontSize:12,color:"var(--text)"}}>{label}</span>
        <span style={{fontSize:12,color:"var(--text-muted)"}}>{value} ({pct}%)</span>
      </div>
      <div style={{height:6,background:"var(--border)",borderRadius:3,overflow:"hidden"}}>
        <div style={{height:"100%",width:`${pct}%`,background:color,borderRadius:3,transition:"width 0.4s"}}/>
      </div>
    </div>
  );
}

// ─── CheckItem ────────────────────────────────────────────────────────────────
function CheckItem({ok,label}) {
  return (
    <div style={{display:"flex",gap:6,alignItems:"center"}}>
      <div style={{width:18,height:18,borderRadius:"50%",background:ok?"rgba(34,197,94,0.15)":"rgba(156,163,175,0.1)",border:`1px solid ${ok?"rgba(34,197,94,0.4)":"var(--border)"}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,color:ok?"#22c55e":"var(--text-muted)",flexShrink:0}}>
        {ok?"✓":"○"}
      </div>
      <span style={{fontSize:12,color:ok?"var(--text)":"var(--text-muted)"}}>{label}</span>
    </div>
  );
}

// ─── Tela: Visão Geral ────────────────────────────────────────────────────────
function TelaVisaoGeral({tenantUid,prestadores,meuPrestadorId,isAdmin}) {
  const [reservas,setReservas]     = useState([]);
  const [loading,setLoading]       = useState(true);
  const [filtroPrestador,setFiltroPrestador] = useState(isAdmin?"todos":meuPrestadorId);

  useEffect(()=>{
    if(!tenantUid) return;
    const q=query(collection(db,"users",tenantUid,"agendamento_reservas"),orderBy("criadoEm","desc"));
    const unsub=onSnapshot(q,snap=>{
      let docs=snap.docs.map(d=>({id:d.id,...d.data()}));
      if(!isAdmin&&meuPrestadorId) docs=docs.filter(r=>r.prestadorId===meuPrestadorId);
      setReservas(docs); setLoading(false);
    });
    return()=>unsub();
  },[tenantUid]);

  const hoje=new Date(); hoje.setHours(0,0,0,0);
  const amanha=new Date(hoje); amanha.setDate(amanha.getDate()+1);
  const semana=new Date(hoje); semana.setDate(semana.getDate()+7);

  const f = isAdmin&&filtroPrestador!=="todos" ? reservas.filter(r=>r.prestadorId===filtroPrestador) : reservas;
  const total=f.length, confirmadas=f.filter(r=>r.status==="confirmado").length;
  const pendentes=f.filter(r=>r.status==="pendente").length, canceladas=f.filter(r=>r.status==="cancelado").length;
  const hojeR=f.filter(r=>{ if(!r.data_hora_inicio) return false; const d=r.data_hora_inicio.toDate?r.data_hora_inicio.toDate():new Date(r.data_hora_inicio); return d>=hoje&&d<amanha; });
  const semanaR=f.filter(r=>{ if(!r.data_hora_inicio) return false; const d=r.data_hora_inicio.toDate?r.data_hora_inicio.toDate():new Date(r.data_hora_inicio); return d>=hoje&&d<semana; });
  const proximas=f.filter(r=>{ if(!r.data_hora_inicio||r.status==="cancelado") return false; const d=r.data_hora_inicio.toDate?r.data_hora_inicio.toDate():new Date(r.data_hora_inicio); return d>=hoje; }).sort((a,b)=>{ const da=a.data_hora_inicio.toDate?a.data_hora_inicio.toDate():new Date(a.data_hora_inicio),db2=b.data_hora_inicio.toDate?b.data_hora_inicio.toDate():new Date(b.data_hora_inicio); return da-db2; }).slice(0,5);

  if(loading) return <LoadingSpinner/>;
  return (
    <div style={{display:"flex",flexDirection:"column",gap:20}}>
      {isAdmin&&prestadores.length>0&&(
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <label style={{...S.label,marginBottom:0,whiteSpace:"nowrap"}}>Visualizando:</label>
          <select style={{...S.select,width:"auto",minWidth:200}} value={filtroPrestador} onChange={e=>setFiltroPrestador(e.target.value)}>
            <option value="todos">Todos os prestadores</option>
            {prestadores.map(p=><option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
        </div>
      )}
      <div style={S.grid4}>
        <div style={S.statCard}><span style={{fontSize:20}}>📋</span><p style={{fontSize:28,fontWeight:700,color:"var(--gold)"}}>{total}</p><p style={{fontSize:13,color:"var(--text)",fontWeight:600}}>Total de Reservas</p></div>
        <div style={S.statCard}><span style={{fontSize:20}}>📅</span><p style={{fontSize:28,fontWeight:700,color:"var(--gold)"}}>{hojeR.length}</p><p style={{fontSize:13,color:"var(--text)",fontWeight:600}}>Hoje</p></div>
        <div style={S.statCard}><span style={{fontSize:20}}>📆</span><p style={{fontSize:28,fontWeight:700,color:"var(--gold)"}}>{semanaR.length}</p><p style={{fontSize:13,color:"var(--text)",fontWeight:600}}>Esta Semana</p></div>
        <div style={S.statCard}><span style={{fontSize:20}}>⏳</span><p style={{fontSize:28,fontWeight:700,color:"#eab308"}}>{pendentes}</p><p style={{fontSize:13,color:"var(--text)",fontWeight:600}}>Pendentes</p></div>
      </div>
      <div style={S.grid2}>
        <div style={S.card}>
          <p style={S.sectionTitle}>Status das Reservas</p>
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <StatusBar label="Confirmadas" value={confirmadas} total={total} color="#22c55e"/>
            <StatusBar label="Pendentes"   value={pendentes}   total={total} color="#eab308"/>
            <StatusBar label="Canceladas"  value={canceladas}  total={total} color="#ef4444"/>
          </div>
        </div>
        <div style={S.card}>
          <p style={S.sectionTitle}>Próximos Agendamentos</p>
          {proximas.length===0?<div style={S.emptyState}><p style={{fontSize:13}}>Nenhum agendamento futuro</p></div>:(
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {proximas.map(r=>{
                const pr=prestadores.find(p=>p.id===r.prestadorId);
                return (
                  <div key={r.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 10px",background:"var(--s2,rgba(255,255,255,0.03))",borderRadius:8,border:"1px solid var(--border)"}}>
                    <div>
                      <p style={{fontSize:13,fontWeight:600,color:"var(--text)",marginBottom:2}}>{r.cliente_nome||"Cliente"}</p>
                      <p style={{fontSize:11,color:"var(--text-muted)"}}>
                        {r.servico_nome} · {formatDateShort(r.data_hora_inicio)}
                        {pr&&<span style={{color:"var(--gold)",marginLeft:4}}>· {pr.nome}</span>}
                      </p>
                    </div>
                    <span style={S.badge(statusColor(r.status))}>{statusLabel(r.status)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Tela: Prestadores ────────────────────────────────────────────────────────
function TelaPrestadores({tenantUid,prestadores,onConfigurar}) {
  const [formAberto,setFormAberto] = useState(false);
  const [novoNome,setNovoNome]     = useState("");
  const [novaEsp,setNovaEsp]       = useState("");
  const [linkedUid,setLinkedUid]   = useState("");
  const [criando,setCriando]       = useState(false);
  const [atualizando,setAtualizando] = useState(null);
  const [copied,setCopied]         = useState(null);
  const [toast,showToast]          = useToast();

  const criarPrestador = async()=>{
    if(!novoNome.trim()) return;
    setCriando(true);
    try {
      await addDoc(collection(db,"users",tenantUid,"agendamento_prestadores"),{
        nome:novoNome.trim(), especialidade:novaEsp.trim()||null,
        linkedUserId:linkedUid.trim()||null, ativo:true, criadoEm:serverTimestamp(),
      });
      setNovoNome(""); setNovaEsp(""); setLinkedUid(""); setFormAberto(false);
      showToast("Prestador criado!");
    } catch { showToast("Erro ao criar prestador.","error"); }
    setCriando(false);
  };

  const toggleAtivo = async(p)=>{
    setAtualizando(p.id);
    try { await updateDoc(doc(db,"users",tenantUid,"agendamento_prestadores",p.id),{ativo:!p.ativo}); showToast(p.ativo?"Desativado.":"Ativado!"); }
    catch { showToast("Erro.","error"); }
    setAtualizando(null);
  };

  const excluir = async(p)=>{
    if(!window.confirm(`Excluir "${p.nome}"? Isso não pode ser desfeito.`)) return;
    try { await deleteDoc(doc(db,"users",tenantUid,"agendamento_prestadores",p.id)); showToast("Prestador excluído."); }
    catch { showToast("Erro ao excluir.","error"); }
  };

  const copiarLink = (p)=>{
    navigator.clipboard.writeText(`${PUBLIC_BASE}?tenant=${tenantUid}&prestador=${p.id}`);
    setCopied(p.id); setTimeout(()=>setCopied(null),2500);
  };

  return (
    <div style={{display:"flex",flexDirection:"column",gap:20}}>
      <Toast toast={toast}/>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div>
          <p style={{fontSize:15,fontWeight:600,color:"var(--text)"}}>Prestadores de Serviço</p>
          <p style={{fontSize:12,color:"var(--text-muted)"}}>Cada prestador tem sua própria agenda, serviços e link público.</p>
        </div>
        <button style={S.btnPrimary} onClick={()=>setFormAberto(f=>!f)}>{Ic.plus} Novo Prestador</button>
      </div>

      {formAberto&&(
        <div style={{...S.card,border:"1px dashed rgba(212,175,55,0.3)",background:"rgba(212,175,55,0.04)"}}>
          <p style={{...S.sectionTitle,color:"var(--gold)"}}>Novo Prestador</p>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
            <div><label style={S.label}>Nome *</label><input style={S.input} value={novoNome} onChange={e=>setNovoNome(e.target.value)} placeholder="Ex: Ana Carolina" autoFocus/></div>
            <div><label style={S.label}>Especialidade</label><input style={S.input} value={novaEsp} onChange={e=>setNovaEsp(e.target.value)} placeholder="Ex: Nail Designer"/></div>
          </div>
          <div style={{marginBottom:12}}>
            <label style={S.label}>UID do usuário AG (opcional — vincula ao login)</label>
            <input style={S.input} value={linkedUid} onChange={e=>setLinkedUid(e.target.value)} placeholder="UID do Firebase Auth do colaborador"/>
          </div>
          <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
            <button style={S.btnGhost} onClick={()=>{setFormAberto(false);setNovoNome("");setNovaEsp("");setLinkedUid("");}}>Cancelar</button>
            <button style={{...S.btnPrimary,opacity:novoNome.trim()?1:0.4}} onClick={criarPrestador} disabled={criando||!novoNome.trim()}>{criando?"Criando…":"Criar Prestador"}</button>
          </div>
        </div>
      )}

      {prestadores.length===0?(
        <div style={{...S.card,...S.emptyState}}>
          <p style={{fontSize:24,marginBottom:8}}>👥</p>
          <p style={{fontSize:13,fontWeight:600,color:"var(--text)"}}>Nenhum prestador cadastrado</p>
          <p style={{fontSize:12,color:"var(--text-muted)",marginTop:4}}>Crie o primeiro prestador para começar a usar o Flow.</p>
        </div>
      ):(
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {prestadores.map(p=>(
            <div key={p.id} style={{...S.card,display:"flex",alignItems:"center",gap:16,opacity:p.ativo?1:0.55}}>
              <Avatar nome={p.nome}/>
              <div style={{flex:1}}>
                <p style={{fontSize:14,fontWeight:600,color:"var(--text)",marginBottom:2}}>{p.nome}</p>
                <p style={{fontSize:12,color:"var(--text-muted)"}}>
                  {p.especialidade||"Prestador de serviço"}
                  {p.linkedUserId&&<span style={{color:"var(--gold)",marginLeft:8}}>· Vinculado ao AG</span>}
                </p>
              </div>
              <span style={S.badge(p.ativo?"green":"gray")}>{p.ativo?"Ativo":"Inativo"}</span>
              <div style={{display:"flex",gap:6}}>
                <button title="Configurar" style={S.btnBlue} onClick={()=>onConfigurar(p)}>{Ic.settings}</button>
                <button title={copied===p.id?"Copiado!":"Copiar link"} style={{...S.btnGhost,color:copied===p.id?"#22c55e":"var(--text-muted)"}} onClick={()=>copiarLink(p)}>{copied===p.id?Ic.check:Ic.copy}</button>
                <button title={p.ativo?"Desativar":"Ativar"} style={p.ativo?S.btnDanger:S.btnSuccess} onClick={()=>toggleAtivo(p)} disabled={atualizando===p.id}>{p.ativo?"Desativar":"Ativar"}</button>
                <button title="Excluir" style={S.btnDanger} onClick={()=>excluir(p)}>{Ic.trash}</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Tela: Reservas ───────────────────────────────────────────────────────────
function TelaReservas({tenantUid,prestadores,meuPrestadorId,isAdmin,podeEditar}) {
  const [reservas,setReservas]     = useState([]);
  const [loading,setLoading]       = useState(true);
  const [filtroStatus,setFiltroStatus] = useState("todos");
  const [filtroData,setFiltroData] = useState("");
  const [filtroPrestador,setFiltroPrestador] = useState(isAdmin?"todos":meuPrestadorId);
  const [atualizando,setAtualizando] = useState(null);
  const [toast,showToast]          = useToast();

  useEffect(()=>{
    if(!tenantUid) return;
    const q=query(collection(db,"users",tenantUid,"agendamento_reservas"),orderBy("data_hora_inicio","desc"));
    const unsub=onSnapshot(q,snap=>{
      let docs=snap.docs.map(d=>({id:d.id,...d.data()}));
      if(!isAdmin&&meuPrestadorId) docs=docs.filter(r=>r.prestadorId===meuPrestadorId);
      setReservas(docs); setLoading(false);
    });
    return()=>unsub();
  },[tenantUid]);

  const atualizarStatus = async(id,novoStatus)=>{
    if(!podeEditar) return;
    setAtualizando(id);
    try {
      await updateDoc(doc(db,"users",tenantUid,"agendamento_reservas",id),{status:novoStatus,atualizadoEm:serverTimestamp()});
      showToast(novoStatus==="confirmado"?"Reserva confirmada!":"Reserva cancelada.",novoStatus==="confirmado"?"success":"error");
    } catch { showToast("Erro ao atualizar.","error"); }
    setAtualizando(null);
  };

  let filtradas=reservas;
  if(isAdmin&&filtroPrestador!=="todos") filtradas=filtradas.filter(r=>r.prestadorId===filtroPrestador);
  if(filtroStatus!=="todos") filtradas=filtradas.filter(r=>r.status===filtroStatus);
  if(filtroData){
    const dia=new Date(filtroData+"T00:00:00"),diaFim=new Date(filtroData+"T23:59:59");
    filtradas=filtradas.filter(r=>{ if(!r.data_hora_inicio) return false; const d=r.data_hora_inicio.toDate?r.data_hora_inicio.toDate():new Date(r.data_hora_inicio); return d>=dia&&d<=diaFim; });
  }

  if(loading) return <LoadingSpinner/>;
  return (
    <div style={{position:"relative"}}>
      <Toast toast={toast}/>
      <div style={{display:"flex",gap:12,marginBottom:16,alignItems:"center",flexWrap:"wrap"}}>
        {isAdmin&&prestadores.length>0&&(
          <select style={{...S.select,width:"auto",minWidth:180}} value={filtroPrestador} onChange={e=>setFiltroPrestador(e.target.value)}>
            <option value="todos">Todos os prestadores</option>
            {prestadores.map(p=><option key={p.id} value={p.id}>{p.nome}</option>)}
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
        <span style={{marginLeft:"auto",fontSize:12,color:"var(--text-muted)"}}>{filtradas.length} reserva{filtradas.length!==1?"s":""}</span>
      </div>
      <div style={{...S.card,padding:0,overflow:"hidden"}}>
        {filtradas.length===0?(
          <div style={S.emptyState}><p style={{fontSize:24,marginBottom:8}}>📭</p><p style={{fontSize:13,fontWeight:600,color:"var(--text)"}}>Nenhuma reserva encontrada</p></div>
        ):(
          <table style={S.table}>
            <thead><tr>
              <th style={S.th}>Cliente</th>
              {isAdmin&&<th style={S.th}>Prestador</th>}
              <th style={S.th}>Serviço</th><th style={S.th}>Data/Hora</th>
              <th style={S.th}>Status</th><th style={S.th}>Criado em</th>
              {podeEditar&&<th style={S.th}>Ações</th>}
            </tr></thead>
            <tbody>
              {filtradas.map(r=>{
                const pr=prestadores.find(p=>p.id===r.prestadorId);
                return (
                  <tr key={r.id}>
                    <td style={S.td}>
                      <span style={{fontWeight:600,color:"var(--text)",display:"block"}}>{r.cliente_nome||"—"}</span>
                      {r.cliente_email&&<span style={{fontSize:11,color:"var(--text-muted)",display:"block"}}>{r.cliente_email}</span>}
                      {r.cliente_telefone&&<span style={{fontSize:11,color:"var(--text-muted)",display:"block"}}>{r.cliente_telefone}</span>}
                    </td>
                    {isAdmin&&(
                      <td style={S.td}>
                        <div style={{display:"flex",alignItems:"center",gap:8}}>
                          <Avatar nome={pr?.nome||"?"} size={28}/>
                          <span style={{fontSize:12,color:"var(--text-muted)"}}>{pr?.nome||"—"}</span>
                        </div>
                      </td>
                    )}
                    <td style={S.td}>
                      <span style={{display:"block"}}>{r.servico_nome||"—"}</span>
                      {r.servico_duracao_min&&<span style={{fontSize:11,color:"var(--text-muted)"}}>{formatDuracao(r.servico_duracao_min)}</span>}
                    </td>
                    <td style={S.td}>{formatDate(r.data_hora_inicio)}</td>
                    <td style={S.td}><span style={S.badge(statusColor(r.status))}>{statusLabel(r.status)}</span></td>
                    <td style={S.td}><span style={{fontSize:12,color:"var(--text-muted)"}}>{formatDate(r.criadoEm)}</span></td>
                    {podeEditar&&(
                      <td style={S.td}>
                        <div style={{display:"flex",gap:6}}>
                          {r.status==="pendente"&&<>
                            <button onClick={()=>atualizarStatus(r.id,"confirmado")} disabled={atualizando===r.id} style={S.btnSuccess}>✓ Confirmar</button>
                            <button onClick={()=>atualizarStatus(r.id,"cancelado")} disabled={atualizando===r.id} style={S.btnDanger}>✕ Cancelar</button>
                          </>}
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

// ─── Tela: Configurações ──────────────────────────────────────────────────────
function TelaConfiguracoes({tenantUid,prestadores,meuPrestadorId,isAdmin}) {
  const [prestadorId,setPrestadorId] = useState(isAdmin?(prestadores[0]?.id||null):meuPrestadorId);
  const [config,setConfig]           = useState(CONFIG_DEFAULT);
  const [loading,setLoading]         = useState(true);
  const [salvando,setSalvando]       = useState(false);
  const [novoS,setNovoS]             = useState({nome:"",duracao:60,preco:"",descricao:""});
  const [toast,showToast]            = useToast();

  useEffect(()=>{
    if(!tenantUid||!prestadorId){setLoading(false);return;}
    setLoading(true);
    const ref=doc(db,"users",tenantUid,"agendamento_configuracoes",prestadorId);
    const unsub=onSnapshot(ref,snap=>{ setConfig(snap.exists()?{...CONFIG_DEFAULT,...snap.data()}:{...CONFIG_DEFAULT}); setLoading(false); });
    return()=>unsub();
  },[tenantUid,prestadorId]);

  const salvar = async()=>{
    if(!prestadorId) return;
    setSalvando(true);
    try { await setDoc(doc(db,"users",tenantUid,"agendamento_configuracoes",prestadorId),{...config,atualizadoEm:serverTimestamp()},{merge:true}); showToast("Configurações salvas!"); }
    catch { showToast("Erro ao salvar.","error"); }
    setSalvando(false);
  };

  const addServico = ()=>{
    if(!novoS.nome.trim()) return;
    const s={id:Date.now().toString(),nome:novoS.nome.trim(),duracao_min:parseInt(novoS.duracao)||60,preco:parseFloat(novoS.preco)||0,descricao:novoS.descricao.trim(),ativo:true};
    setConfig(p=>({...p,serviços:[...(p.serviços||[]),s]}));
    setNovoS({nome:"",duracao:60,preco:"",descricao:""});
  };

  const toggleDia = k=>setConfig(p=>({...p,diasAtivos:p.diasAtivos.includes(k)?p.diasAtivos.filter(d=>d!==k):[...p.diasAtivos,k]}));
  const prestadorAtual = prestadores.find(p=>p.id===prestadorId);

  if(!isAdmin&&!meuPrestadorId) return (
    <div style={S.emptyState}>
      <p style={{fontSize:32,marginBottom:8}}>🔗</p>
      <p style={{fontSize:13,fontWeight:600,color:"var(--text)",marginBottom:4}}>Você não está vinculado a um prestador</p>
      <p style={{fontSize:12,color:"var(--text-muted)"}}>Peça ao administrador para vincular seu usuário a um perfil de prestador.</p>
    </div>
  );
  if(!prestadorId) return <div style={S.emptyState}><p style={{fontSize:13,color:"var(--text)"}}>Crie um prestador primeiro na aba Prestadores.</p></div>;

  return (
    <div style={{display:"flex",flexDirection:"column",gap:20}}>
      <Toast toast={toast}/>

      {/* Seletor de prestador */}
      {isAdmin&&prestadores.length>0&&(
        <div style={{...S.card,padding:"14px 16px"}}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <label style={{...S.label,marginBottom:0,whiteSpace:"nowrap"}}>Configurando:</label>
            <select style={{...S.select,width:"auto",minWidth:220}} value={prestadorId||""} onChange={e=>setPrestadorId(e.target.value)}>
              {prestadores.map(p=><option key={p.id} value={p.id}>{p.nome}{p.especialidade?` · ${p.especialidade}`:""}</option>)}
            </select>
            {prestadorAtual&&<span style={S.badge(prestadorAtual.ativo?"green":"gray")}>{prestadorAtual.ativo?"Ativo":"Inativo"}</span>}
          </div>
        </div>
      )}

      {/* Header membro */}
      {!isAdmin&&prestadorAtual&&(
        <div style={{...S.card,padding:"12px 16px",display:"flex",alignItems:"center",gap:12}}>
          <Avatar nome={prestadorAtual.nome}/><div><p style={{fontSize:14,fontWeight:600,color:"var(--text)"}}>{prestadorAtual.nome}</p><p style={{fontSize:12,color:"var(--text-muted)"}}>{prestadorAtual.especialidade||"Prestador de serviço"}</p></div>
        </div>
      )}

      {loading?<LoadingSpinner/>:<>
        {/* Dados */}
        <div style={S.card}>
          <p style={S.sectionTitle}>Dados da Agenda</p>
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
            {DIAS_SEMANA.map(d=>{
              const ativo=(config.diasAtivos||[]).includes(d.key);
              return <button key={d.key} onClick={()=>toggleDia(d.key)} style={{width:44,height:44,borderRadius:8,border:ativo?"1px solid var(--gold)":"1px solid var(--border)",background:ativo?"rgba(212,175,55,0.15)":"transparent",color:ativo?"var(--gold)":"var(--text-muted)",fontSize:12,fontWeight:ativo?700:400,cursor:"pointer"}}>{d.label}</button>;
            })}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:14}}>
            <div><label style={S.label}>Início do Expediente</label><input type="time" style={S.input} value={config.horaInicio||"08:00"} onChange={e=>setConfig(p=>({...p,horaInicio:e.target.value}))}/></div>
            <div><label style={S.label}>Fim do Expediente</label><input type="time" style={S.input} value={config.horaFim||"18:00"} onChange={e=>setConfig(p=>({...p,horaFim:e.target.value}))}/></div>
            <div>
              <label style={S.label}>Granularidade dos horários</label>
              <select style={S.select} value={config.granularidadeMinutos||30} onChange={e=>setConfig(p=>({...p,granularidadeMinutos:parseInt(e.target.value)}))}>
                {[5,10,15,20,30,45,60].map(v=><option key={v} value={v}>{v<60?`${v} minutos`:v===60?"1 hora":""}</option>)}
              </select>
            </div>
          </div>
          <p style={{fontSize:11,color:"var(--text-muted)",marginTop:10}}>
            💡 Granularidade = passo entre os horários exibidos (ex: 15 min → 09:00, 09:15, 09:30…).
            A duração real de cada serviço bloqueia o tempo correto — sem janelas desperdiçadas.
          </p>
        </div>

        {/* Serviços */}
        <div style={S.card}>
          <p style={S.sectionTitle}>Serviços Oferecidos</p>
          {(config.serviços||[]).length>0&&(
            <div style={{marginBottom:16}}>
              <table style={S.table}>
                <thead><tr><th style={S.th}>Nome</th><th style={S.th}>Duração</th><th style={S.th}>Preço</th><th style={S.th}>Descrição</th><th style={S.th}></th></tr></thead>
                <tbody>
                  {config.serviços.map(s=>(
                    <tr key={s.id}>
                      <td style={S.td}><span style={{fontWeight:600,color:"var(--text)"}}>{s.nome}</span></td>
                      <td style={S.td}><span style={{color:"var(--text-muted)"}}>{formatDuracao(s.duracao_min)}</span></td>
                      <td style={S.td}><span style={{color:"var(--gold)"}}>{s.preco>0?`R$ ${Number(s.preco).toLocaleString("pt-BR",{minimumFractionDigits:2})}`:"Gratuito"}</span></td>
                      <td style={S.td}><span style={{fontSize:12,color:"var(--text-muted)"}}>{s.descricao||"—"}</span></td>
                      <td style={S.td}><button style={S.btnDanger} onClick={()=>setConfig(p=>({...p,serviços:p.serviços.filter(x=>x.id!==s.id)}))}>{Ic.trash}</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div style={{background:"var(--s2,rgba(255,255,255,0.03))",border:"1px dashed var(--border)",borderRadius:10,padding:16}}>
            <p style={{...S.label,marginBottom:12,color:"var(--text)",fontSize:13,fontWeight:600}}>+ Novo Serviço</p>
            <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr",gap:12,marginBottom:12}}>
              <div><label style={S.label}>Nome *</label><input style={S.input} value={novoS.nome} onChange={e=>setNovoS(p=>({...p,nome:e.target.value}))} placeholder="Ex: Manicure"/></div>
              <div><label style={S.label}>Duração</label>
                <select style={S.select} value={novoS.duracao} onChange={e=>setNovoS(p=>({...p,duracao:e.target.value}))}>
                  {[15,20,30,45,60,75,90,120,150,180,240].map(v=><option key={v} value={v}>{formatDuracao(v)}</option>)}
                </select>
              </div>
              <div><label style={S.label}>Preço (R$)</label><input style={S.input} type="number" min="0" step="0.01" value={novoS.preco} onChange={e=>setNovoS(p=>({...p,preco:e.target.value}))} placeholder="0,00"/></div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:12,alignItems:"flex-end"}}>
              <div><label style={S.label}>Descrição (opcional)</label><input style={S.input} value={novoS.descricao} onChange={e=>setNovoS(p=>({...p,descricao:e.target.value}))} placeholder="Breve descrição"/></div>
              <button onClick={addServico} disabled={!novoS.nome.trim()} style={{...S.btnPrimary,height:38,opacity:novoS.nome.trim()?1:0.4}}>{Ic.plus} Adicionar</button>
            </div>
          </div>
        </div>

        <div style={{display:"flex",justifyContent:"flex-end"}}>
          <button onClick={salvar} disabled={salvando} style={{...S.btnPrimary,padding:"10px 28px",fontSize:14}}>
            {salvando?"Salvando…":"💾 Salvar Configurações"}
          </button>
        </div>
      </>}
    </div>
  );
}

// ─── Tela: Link Público ───────────────────────────────────────────────────────
function TelaLinkPublico({tenantUid,prestadores,meuPrestadorId,isAdmin}) {
  const [configs,setConfigs] = useState({});
  const [copied,setCopied]   = useState(null);

  useEffect(()=>{
    if(!tenantUid||!prestadores.length) return;
    const unsubs=prestadores.map(p=>{
      const ref=doc(db,"users",tenantUid,"agendamento_configuracoes",p.id);
      return onSnapshot(ref,snap=>setConfigs(prev=>({...prev,[p.id]:snap.exists()?snap.data():null})));
    });
    return()=>unsubs.forEach(u=>u());
  },[tenantUid,prestadores.length]);

  const copiar = id=>{ navigator.clipboard.writeText(`${PUBLIC_BASE}?tenant=${tenantUid}&prestador=${id}`); setCopied(id); setTimeout(()=>setCopied(null),2500); };
  const lista = isAdmin?prestadores:prestadores.filter(p=>p.id===meuPrestadorId);

  return (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      {lista.length===0?<div style={{...S.card,...S.emptyState}}><p style={{fontSize:13}}>Nenhum prestador configurado.</p></div>:
        lista.map(p=>{
          const cfg=configs[p.id];
          const link=`${PUBLIC_BASE}?tenant=${tenantUid}&prestador=${p.id}`;
          const temS=cfg?.serviços?.length>0, temH=cfg?.diasAtivos?.length>0;
          return (
            <div key={p.id} style={S.card}>
              <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:14}}>
                <Avatar nome={p.nome}/>
                <div style={{flex:1}}><p style={{fontSize:14,fontWeight:600,color:"var(--text)"}}>{p.nome}</p><p style={{fontSize:12,color:"var(--text-muted)"}}>{p.especialidade||"Prestador de serviço"}</p></div>
                <span style={S.badge(p.ativo?"green":"gray")}>{p.ativo?"Ativo":"Inativo"}</span>
              </div>
              <div style={{display:"flex",gap:16,marginBottom:12}}>
                <CheckItem ok={temH} label="Horários configurados"/>
                <CheckItem ok={temS} label="Serviços cadastrados"/>
                <CheckItem ok={!!cfg?.nomeEmpresa} label="Nome preenchido"/>
              </div>
              <div style={{display:"flex",gap:10,alignItems:"center",background:"var(--s2,rgba(255,255,255,0.03))",border:"1px solid var(--border)",borderRadius:10,padding:"10px 14px"}}>
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
      <div style={S.card}>
        <p style={S.sectionTitle}>Como usar</p>
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {["Configure os serviços e horários de cada prestador na aba Configurações","Copie o link individual de cada prestador e compartilhe nas redes, WhatsApp ou e-mail","O cliente acessa, vê os serviços e escolhe um horário disponível em tempo real","A reserva aparece na aba Reservas com status Pendente","Confirme ou cancele a reserva na aba Reservas"].map((t,i)=>(
            <div key={i} style={{display:"flex",gap:12,alignItems:"flex-start"}}>
              <div style={{width:22,height:22,borderRadius:"50%",background:"rgba(212,175,55,0.15)",border:"1px solid var(--gold)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:"var(--gold)",flexShrink:0,marginTop:1}}>{i+1}</div>
              <span style={{fontSize:13,color:"var(--text)",lineHeight:1.5}}>{t}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Tela Upgrade ────────────────────────────────────────────────────────────
function TelaUpgrade({onVoltar}) {
  return (
    <div style={S.upgradeWall}>
      <div style={{width:64,height:64,borderRadius:16,background:"linear-gradient(135deg,var(--gold) 0%,#1a3a5c 100%)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:28}}>{Ic.star}</div>
      <h2 style={{fontSize:22,fontWeight:700,color:"var(--text)",marginBottom:8}}>Assent Flow</h2>
      <p style={{fontSize:14,color:"var(--text-muted)",maxWidth:360,lineHeight:1.6,marginBottom:20}}>
        Disponível no plano <strong style={{color:"var(--gold)"}}>Profissional</strong>.
      </p>
      <div style={{display:"flex",gap:12}}>
        <button style={{...S.btnPrimary,padding:"10px 24px"}} onClick={()=>window.open("mailto:contato@assentagencia.com.br?subject=Upgrade Profissional","_blank")}>⭐ Fazer Upgrade</button>
        <button onClick={onVoltar} style={S.btnGhost}>Voltar</button>
      </div>
    </div>
  );
}

// ─── Componente Principal ─────────────────────────────────────────────────────
export default function AssFlow({tenantUid,plano,theme,onToggleTheme,onVoltar}) {
  // ── HOOKS PRIMEIRO — Rules of Hooks ───────────────────────────────────
  const {isAdmin,podeVer,podeEditar,user} = useAuth();
  const [tela,setTela]               = useState("overview");
  const [prestadores,setPrestadores] = useState([]);
  const [meuPrestadorId,setMeuPrestadorId] = useState(null);
  const [loadingP,setLoadingP]       = useState(true);

  useEffect(()=>{
    if(!tenantUid) return;
    const q=query(collection(db,"users",tenantUid,"agendamento_prestadores"),orderBy("criadoEm","asc"));
    const unsub=onSnapshot(q,snap=>{
      const list=snap.docs.map(d=>({id:d.id,...d.data()}));
      setPrestadores(list);
      if(!isAdmin&&user){ const meu=list.find(p=>p.linkedUserId===user.uid); if(meu) setMeuPrestadorId(meu.id); }
      setLoadingP(false);
    });
    return()=>unsub();
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

  const irParaConfiguracoes = ()=>setTela("configuracoes");

  const TELAS=[
    {key:"overview",    label:"Visão Geral",   icon:Ic.calendar},
    ...(isAdmin?[{key:"prestadores",label:"Prestadores",icon:Ic.users}]:[]),
    {key:"reservas",    label:"Reservas",      icon:Ic.list},
    {key:"configuracoes",label:"Configurações",icon:Ic.settings},
    {key:"link",        label:"Link Público",  icon:Ic.link},
  ];

  const titulos={overview:"Visão Geral",prestadores:"Prestadores",reservas:"Reservas",configuracoes:"Configurações",link:"Link Público"};

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
          <button style={S.btnSecondary} onClick={onToggleTheme}>{theme==="dark"?Ic.sun:Ic.moon}{theme==="dark"?"Modo Claro":"Modo Escuro"}</button>
          <button style={S.btnSecondary} onClick={onVoltar}>{Ic.back}Voltar ao Gestão</button>
        </div>
      </aside>

      <main style={S.main}>
        <header style={S.topbar}>
          <span style={S.topbarTitle}>{titulos[tela]}</span>
          <span style={{fontSize:11,padding:"3px 10px",borderRadius:20,border:"1px solid var(--border)",background:"rgba(212,175,55,0.08)",color:"var(--gold)",fontWeight:600,letterSpacing:0.5}}>★ Profissional</span>
        </header>
        <div style={S.content}>
          {loadingP?<LoadingSpinner/>:<>
            {tela==="overview"      &&<TelaVisaoGeral    tenantUid={tenantUid} prestadores={prestadores} meuPrestadorId={meuPrestadorId} isAdmin={isAdmin}/>}
            {tela==="prestadores"   &&<TelaPrestadores   tenantUid={tenantUid} prestadores={prestadores} onConfigurar={irParaConfiguracoes}/>}
            {tela==="reservas"      &&<TelaReservas      tenantUid={tenantUid} prestadores={prestadores} meuPrestadorId={meuPrestadorId} isAdmin={isAdmin} podeEditar={podeEditar("agendamento")}/>}
            {tela==="configuracoes" &&<TelaConfiguracoes tenantUid={tenantUid} prestadores={prestadores} meuPrestadorId={meuPrestadorId} isAdmin={isAdmin}/>}
            {tela==="link"          &&<TelaLinkPublico   tenantUid={tenantUid} prestadores={prestadores} meuPrestadorId={meuPrestadorId} isAdmin={isAdmin}/>}
          </>}
        </div>
      </main>
    </div>
  );
}
