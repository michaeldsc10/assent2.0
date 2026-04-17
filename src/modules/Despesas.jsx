/* ═══════════════════════════════════════════════════
   ASSENT v2.0 — Despesasnovo.jsx (RESTAURADO + ID SEQUENCIAL)
   Lógica: Banco usa doc.id (Hash) | Sistema mostra Código (D0001)
   ═══════════════════════════════════════════════════ */

import { useState, useEffect, useMemo } from "react";
import {
  Search, Plus, Edit2, Trash2, X, CheckCircle, RefreshCw,
  AlertCircle, Clock, AlertTriangle, RotateCcw, TrendingUp,
  CreditCard, Wallet, Smartphone, ChevronDown, ChevronUp,
} from "lucide-react";

import { db, auth } from "../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection, doc, setDoc, deleteDoc, onSnapshot,
  query, orderBy, writeBatch, addDoc,
} from "firebase/firestore";

/* ── CSS ORIGINAL RESTAURADO ── */
const CSS = `
  @keyframes fadeIn  { from { opacity: 0 }               to { opacity: 1 } }
  @keyframes slideUp { from { opacity: 0; transform: translateY(14px) } to { opacity: 1; transform: translateY(0) } }

  .modal-overlay { position: fixed; inset: 0; z-index: 1000; background: rgba(0,0,0,0.78); backdrop-filter: blur(5px); display: flex; align-items: center; justify-content: center; padding: 20px; animation: fadeIn .15s ease; }
  .modal-overlay-top { z-index: 1100; }
  .modal-box { background: var(--s1); border: 1px solid var(--border-h); border-radius: 16px; width: 100%; max-width: 560px; max-height: 92vh; overflow-y: auto; box-shadow: 0 28px 72px rgba(0,0,0,0.65); animation: slideUp .18s ease; }
  .modal-box-lg  { max-width: 700px; }
  .modal-box-md  { max-width: 420px; }
  .modal-box::-webkit-scrollbar { width: 3px; }
  .modal-box::-webkit-scrollbar-thumb { background: var(--text-3); border-radius: 2px; }
  .modal-header { padding: 20px 22px 16px; border-bottom: 1px solid var(--border); display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
  .modal-title { font-family: 'Sora', sans-serif; font-size: 16px; font-weight: 600; color: var(--text); }
  .modal-sub { font-size: 12px; color: var(--text-2); margin-top: 3px; }
  .modal-close { width: 30px; height: 30px; border-radius: 8px; flex-shrink: 0; background: var(--s3); border: 1px solid var(--border); display: flex; align-items: center; justify-content: center; cursor: pointer; margin-top: 2px; transition: background .13s; }
  .modal-close:hover { background: var(--s2); border-color: var(--border-h); }
  .modal-body   { padding: 20px 22px; }
  .modal-footer { padding: 14px 22px; border-top: 1px solid var(--border); display: flex; justify-content: flex-end; gap: 10px; }
  .form-group { margin-bottom: 16px; }
  .form-label { display: block; font-size: 10px; font-weight: 600; letter-spacing: .07em; text-transform: uppercase; color: var(--text-2); margin-bottom: 7px; }
  .form-label-req { color: var(--gold); margin-left: 2px; }
  .form-input { width: 100%; background: var(--s2); border: 1px solid var(--border); border-radius: 9px; padding: 10px 13px; color: var(--text); font-size: 13px; font-family: 'DM Sans', sans-serif; outline: none; transition: border-color .15s, box-shadow .15s; }
  .form-input:focus { border-color: var(--gold); box-shadow: 0 0 0 3px rgba(200,165,94,0.1); }
  .form-row-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px; }
  .form-divider { border: none; border-top: 1px solid var(--border); margin: 18px 0 16px; }
  .chip-group { display: flex; gap: 6px; flex-wrap: wrap; }
  .chip { padding: 6px 14px; border-radius: 20px; font-size: 12px; font-weight: 500; border: 1px solid var(--border); cursor: pointer; background: var(--s2); color: var(--text-2); transition: all .13s; }
  .chip.active { background: var(--gold); color: #0a0808; border-color: var(--gold); }
  .btn-primary, .btn-nova-desp { padding: 9px 20px; border-radius: 9px; background: var(--gold); color: #0a0808; border: none; cursor: pointer; font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 600; transition: opacity .13s; }
  .btn-secondary { padding: 9px 20px; border-radius: 9px; background: var(--s3); color: var(--text-2); border: 1px solid var(--border); cursor: pointer; font-family: 'DM Sans', sans-serif; font-size: 13px; }
  .btn-danger { padding: 9px 20px; border-radius: 9px; background: var(--red-d); color: var(--red); border: 1px solid rgba(224,82,82,.25); cursor: pointer; }
  .btn-success { padding: 9px 20px; border-radius: 9px; background: rgba(74,186,130,.12); color: var(--green); border: 1px solid rgba(74,186,130,.25); cursor: pointer; }
  .btn-icon { width: 30px; height: 30px; border-radius: 7px; display: flex; align-items: center; justify-content: center; cursor: pointer; border: 1px solid transparent; background: transparent; transition: all .13s; }
  .btn-icon-edit { color: var(--blue); }
  .btn-icon-del { color: var(--red); }
  .btn-icon-pay { color: var(--green); }
  .btn-icon-undo { color: var(--text-3); }
  .desp-topbar { padding: 14px 22px; background: var(--s1); border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 14px; flex-shrink: 0; }
  .desp-topbar-title h1 { font-family: 'Sora', sans-serif; font-size: 17px; font-weight: 600; color: var(--text); }
  .desp-search { display: flex; align-items: center; gap: 8px; background: var(--s2); border: 1px solid var(--border); border-radius: 8px; padding: 8px 12px; width: 240px; }
  .desp-search input { background: transparent; border: none; outline: none; color: var(--text); font-size: 12px; width: 100%; }
  .desp-metrics { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; padding: 18px 22px; }
  .metric-card { border-radius: 12px; padding: 14px 16px; border: 1px solid transparent; }
  .metric-card-red { background: rgba(224,82,82,.08); border-color: rgba(224,82,82,.18); }
  .metric-card-amber { background: rgba(200,165,94,.08); border-color: rgba(200,165,94,.18); }
  .metric-card-purple { background: rgba(139,92,246,.08); border-color: rgba(139,92,246,.18); }
  .metric-card-green { background: rgba(74,186,130,.08); border-color: rgba(74,186,130,.18); }
  .metric-val { font-family: 'Sora', sans-serif; font-size: 22px; font-weight: 600; }
  .metric-val-red { color: var(--red); } .metric-val-amber { color: var(--gold); } .metric-val-purple { color: #8b5cf6; } .metric-val-green { color: var(--green); }
  .desp-filters { padding: 0 22px 14px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .filter-chip { padding: 5px 12px; border-radius: 20px; font-size: 11px; border: 1px solid var(--border); background: var(--s2); color: var(--text-2); cursor: pointer; }
  .filter-chip.active { background: var(--s3); border-color: var(--border-h); color: var(--text); }
  .filter-select { padding: 5px 10px; border-radius: 8px; font-size: 12px; border: 1px solid var(--border); background: var(--s2); color: var(--text-2); outline: none; font-family: 'DM Sans', sans-serif; }
  .desp-table-wrap { margin: 0 22px 22px; background: var(--s1); border: 1px solid var(--border); border-radius: 12px; overflow-y: auto; max-height: 60vh; }
  .desp-row { display: grid; grid-template-columns: 80px 1fr 100px 110px 110px 90px 100px 110px 90px; padding: 11px 18px; gap: 8px; border-bottom: 1px solid var(--border); align-items: center; font-size: 12px; color: var(--text-2); }
  .desp-row-head { background: var(--s2); }
  .desp-id { font-family: 'Sora', sans-serif; font-size: 11px; color: var(--gold); font-weight: 500; }
  .desp-desc { color: var(--text); font-size: 13px; font-weight: 500; }
  .desp-valor { font-family: 'Sora', sans-serif; font-size: 13px; font-weight: 600; color: var(--text); }
  .status-badge { display: inline-flex; align-items: center; gap: 5px; padding: 3px 9px; border-radius: 20px; font-size: 11px; font-weight: 500; }
  .status-pago { background: rgba(74,186,130,.1); color: var(--green); border: 1px solid rgba(74,186,130,.2); }
  .status-pendente { background: rgba(200,165,94,.1); color: var(--gold); border: 1px solid rgba(200,165,94,.2); }
  .status-vencido { background: rgba(224,82,82,.1); color: var(--red); border: 1px solid rgba(224,82,82,.2); }
  .cat-badge { display: inline-block; padding: 2px 8px; border-radius: 20px; font-size: 11px; background: var(--s3); border: 1px solid var(--border); color: var(--text-2); }
  .parcel-badge { font-size: 10px; color: var(--text-3); background: var(--s3); border: 1px solid var(--border); border-radius: 4px; padding: 1px 5px; font-family: 'Sora', sans-serif; }
  .pay-info { background: var(--s2); border: 1px solid var(--border); border-radius: 10px; padding: 14px 16px; margin-bottom: 16px; }
`;

/* ── HELPERS ── */
const fmtR$ = (v) => `R$ ${Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
const fmtData = (d) => { if (!d) return "—"; try { const dt = typeof d === "string" ? new Date(d + "T12:00:00") : d?.toDate ? d.toDate() : new Date(d); return dt.toLocaleDateString("pt-BR"); } catch { return String(d); } };
const hoje = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const parseDate = (d) => { if (!d) return null; const dt = typeof d === "string" ? new Date(d + "T12:00:00") : d?.toDate ? d.toDate() : new Date(d); dt.setHours(0, 0, 0, 0); return dt; };
const calcularStatus = (vencimento, statusAtual) => { if (statusAtual === "pago" || statusAtual === "cancelado") return statusAtual; const venc = parseDate(vencimento); if (!venc) return "pendente"; return venc < hoje() ? "vencido" : "pendente"; };
const gerarIdSequencial = (cnt) => `D${String(cnt + 1).padStart(4, "0")}`; // Lógica restaurada

/* ── COMPONENTE PRINCIPAL ── */
export default function Despesas() {
  const [uid, setUid] = useState(null);
  const [despesas, setDespesas] = useState([]);
  const [despesaIdCnt, setDespesaIdCnt] = useState(0); // Contador restaurado
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todas");
  const [filtroPeriodo, setFiltroPeriodo] = useState("mes");
  const [modalNovo, setModalNovo] = useState(false);
  const [editando, setEditando] = useState(null);
  const [pagando, setPagando] = useState(null);
  const [deletando, setDeletando] = useState(null);

  useEffect(() => { return onAuthStateChanged(auth, user => setUid(user?.uid || null)); }, []);

  useEffect(() => {
    if (!uid) return;
    const unsubUser = onSnapshot(doc(db, "users", uid), (snap) => { if (snap.exists()) setDespesaIdCnt(snap.data().despesaIdCnt || 0); });
    const unsubDesp = onSnapshot(query(collection(db, "users", uid, "despesas"), orderBy("vencimento", "asc")), (snap) => { setDespesas(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false); });
    return () => { unsubUser(); unsubDesp(); };
  }, [uid]);

  const handleAdd = async (form) => {
    if (!uid) return;
    let cnt = despesaIdCnt;
    if (form.parcelado && form.totalParcelas > 1) {
      const batch = writeBatch(db);
      for (let i = 0; i < form.totalParcelas; i++) {
        const sequencial = gerarIdSequencial(cnt);
        const dataVenc = new Date(form.vencimento + "T12:00:00");
        dataVenc.setMonth(dataVenc.getMonth() + i);
        const vencStr = dataVenc.toISOString().split("T")[0];
        batch.set(doc(collection(db, "users", uid, "despesas")), { ...form, codigo: sequencial, parcelaAtual: i + 1, vencimento: vencStr, status: calcularStatus(vencStr, "pendente"), dataCriacao: new Date().toISOString() });
        cnt++;
      }
      batch.set(doc(db, "users", uid), { despesaIdCnt: cnt }, { merge: true });
      await batch.commit();
    } else {
      const sequencial = gerarIdSequencial(cnt);
      await addDoc(collection(db, "users", uid, "despesas"), { ...form, codigo: sequencial, status: calcularStatus(form.vencimento, "pendente"), dataCriacao: new Date().toISOString() });
      await setDoc(doc(db, "users", uid), { despesaIdCnt: cnt + 1 }, { merge: true });
    }
    setModalNovo(false);
  };

  const handlePagar = async (forma) => {
    if (!uid || !pagando) return;
    await setDoc(doc(db, "users", uid, "despesas", pagando.id), { status: "pago", formaPagamento: forma, dataPagamento: new Date().toISOString().split("T")[0] }, { merge: true });
    setPagando(null);
  };

  const despesasFiltradas = useMemo(() => {
    let lista = [...despesas];
    const mes = new Date().getMonth();
    const ano = new Date().getFullYear();
    if (filtroPeriodo === "mes") lista = lista.filter(d => { const dt = parseDate(d.vencimento); return dt && dt.getMonth() === mes && dt.getFullYear() === ano; });
    if (filtroStatus !== "todas") lista = lista.filter(d => d.status === filtroStatus);
    if (search.trim()) lista = lista.filter(d => d.descricao?.toLowerCase().includes(search.toLowerCase()));
    return lista;
  }, [despesas, filtroStatus, filtroPeriodo, search]);

  const metricas = useMemo(() => {
    const vencidas = despesasFiltradas.filter(d => d.status === "vencido").length;
    const pendente = despesasFiltradas.filter(d => d.status !== "pago").reduce((s, d) => s + (d.valor || 0), 0);
    const pago = despesasFiltradas.filter(d => d.status === "pago").reduce((s, d) => s + (d.valor || 0), 0);
    return { vencidas, pendente, pago };
  }, [despesasFiltradas]);

  if (!uid) return <div style={{padding: 40, color: 'white'}}>Carregando...</div>;

  return (
    <>
      <style>{CSS}</style>
      <header className="desp-topbar">
        <div className="desp-topbar-title"><h1>Despesas</h1><p>Gestão financeira refinada</p></div>
        <div className="desp-search"><Search size={13} color="var(--text-3)" /><input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} /></div>
        <button className="btn-nova-desp" style={{marginLeft:'auto'}} onClick={() => setModalNovo(true)}><Plus size={14}/> Nova Despesa</button>
      </header>

      {/* CARDS RESTAURADOS */}
      <div className="desp-metrics">
        <div className="metric-card metric-card-red"><div className="metric-val metric-val-red">{metricas.vencidas}</div><div className="metric-label">Vencidas</div></div>
        <div className="metric-card metric-card-purple"><div className="metric-val metric-val-purple">{fmtR$(metricas.pendente)}</div><div className="metric-label">Total Pendente</div></div>
        <div className="metric-card metric-card-green"><div className="metric-val metric-val-green">{fmtR$(metricas.pago)}</div><div className="metric-label">Pago este mês</div></div>
      </div>

      <div className="desp-filters">
        <span style={{fontSize: 11, color: 'var(--text-3)'}}>Filtros:</span>
        {["todas", "pendente", "vencido", "pago"].map(s => <button key={s} className={`filter-chip ${filtroStatus === s ? "active" : ""}`} onClick={() => setFiltroStatus(s)}>{s.toUpperCase()}</button>)}
        <select className="filter-select" value={filtroPeriodo} onChange={e => setFiltroPeriodo(e.target.value)}><option value="mes">Este mês</option><option value="todas">Tudo</option></select>
      </div>

      <div className="desp-table-wrap">
        <div className="desp-row desp-row-head"><span>ID</span><span>Descrição</span><span>Categoria</span><span>Valor</span><span>Vencimento</span><span>Status</span><span>Pagamento</span><span style={{textAlign:'right'}}>Ações</span></div>
        {despesasFiltradas.map(d => (
          <div key={d.id} className="desp-row">
            <span className="desp-id">{d.codigo || "—"}</span> {/* EXIBIÇÃO DO SEQUENCIAL */}
            <div className="desp-desc">{d.descricao} {d.parcelado && <span className="parcel-badge">{d.parcelaAtual}/{d.totalParcelas}</span>}</div>
            <span className="cat-badge">{d.categoria}</span>
            <span className="desp-valor">{fmtR$(d.valor)}</span>
            <span>{fmtData(d.vencimento)}</span>
            <span className={`status-badge status-${d.status}`}>{d.status}</span>
            <span>{d.dataPagamento ? fmtData(d.dataPagamento) : "—"}</span>
            <div style={{display:'flex', gap:4, justifyContent:'flex-end'}}>
              {d.status !== "pago" && <button className="btn-icon btn-icon-pay" onClick={() => setPagando(d)}><CheckCircle size={13}/></button>}
              <button className="btn-icon btn-icon-edit" onClick={() => setEditando(d)}><Edit2 size={13}/></button>
              <button className="btn-icon btn-icon-del" onClick={() => setDeletando(d)}><Trash2 size={13}/></button>
            </div>
          </div>
        ))}
      </div>

      {modalNovo && <ModalForm onSave={handleAdd} onClose={() => setModalNovo(false)} />}
      {pagando && <ModalConfirmPay despesa={pagando} onConfirm={handlePagar} onClose={() => setPagando(null)} />}
      {deletando && <ModalConfirmDel despesa={deletando} onConfirm={async () => { await deleteDoc(doc(db, "users", uid, "despesas", deletando.id)); setDeletando(null); }} onClose={() => setDeletando(null)} />}
    </>
  );
}

/* MODAIS DE APOIO - INTERFACE REFINADA */
function ModalForm({ despesa, onSave, onClose }) {
  const [form, setForm] = useState({ descricao: despesa?.descricao || "", valor: despesa?.valor || "", vencimento: despesa?.vencimento || "", categoria: despesa?.categoria || "Fixo", parcelado: false, totalParcelas: 2 });
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}><div className="modal-box modal-box-lg"><div className="modal-header"><div><div className="modal-title">Lançamento</div></div><button className="modal-close" onClick={onClose}><X size={14}/></button></div><div className="modal-body">
      <div className="form-group"><label className="form-label">Descrição</label><input className="form-input" value={form.descricao} onChange={e => setForm({...form, descricao: e.target.value})} /></div>
      <div className="form-row-3"><div><label className="form-label">Valor</label><input type="number" className="form-input" value={form.valor} onChange={e => setForm({...form, valor: e.target.value})} /></div><div><label className="form-label">Vencimento</label><input type="date" className="form-input" value={form.vencimento} onChange={e => setForm({...form, vencimento: e.target.value})} /></div><div><label className="form-label">Categoria</label><input className="form-input" value={form.categoria} onChange={e => setForm({...form, categoria: e.target.value})} /></div></div>
      <div className="form-group" style={{marginTop:15}}><label style={{display:'flex', gap:8}}><input type="checkbox" checked={form.parcelado} onChange={e => setForm({...form, parcelado: e.target.checked})} /> <span className="form-label">Parcelado</span></label>{form.parcelado && <input type="number" className="form-input" style={{width:80, marginTop:5}} value={form.totalParcelas} onChange={e => setForm({...form, totalParcelas: e.target.value})} />}</div>
    </div><div className="modal-footer"><button className="btn-secondary" onClick={onClose}>Cancelar</button><button className="btn-primary" onClick={() => onSave(form)}>Salvar</button></div></div></div>
  );
}

function ModalConfirmPay({ despesa, onConfirm, onClose }) {
  return (
    <div className="modal-overlay modal-overlay-top" onClick={e => e.target === e.currentTarget && onClose()}><div className="modal-box modal-box-md"><div className="modal-header"><div className="modal-title">Registrar Pagamento</div><button className="modal-close" onClick={onClose}><X size={14}/></button></div><div className="modal-body"><div className="pay-info"><div style={{display:'flex', justifyContent:'space-between'}}><span>Valor:</span><span style={{fontWeight:600}}>{fmtR$(despesa.valor)}</span></div></div><p style={{fontSize:12, color:'var(--text-3)'}}>Confirme o pagamento de: {despesa.descricao}</p></div><div className="modal-footer"><button className="btn-secondary" onClick={onClose}>Cancelar</button><button className="btn-success" onClick={() => onConfirm("pix")}>Confirmar Pago</button></div></div></div>
  );
}

function ModalConfirmDel({ despesa, onConfirm, onClose }) {
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}><div className="modal-box modal-box-md"><div className="modal-header"><div className="modal-title">Excluir</div><button className="modal-close" onClick={onClose}><X size={14}/></button></div><div className="modal-body">Deseja excluir permanentemente: <strong>{despesa.descricao}</strong>?</div><div className="modal-footer"><button className="btn-secondary" onClick={onClose}>Cancelar</button><button className="btn-danger" onClick={onConfirm}>Excluir</button></div></div></div>
  );
}
