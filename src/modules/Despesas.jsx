/* ═══════════════════════════════════════════════════
   ASSENT v2.0 — Despesas.jsx (Corrigido)
   Estrutura: users/{uid}/despesas/{D0001, D0002...}
   ═══════════════════════════════════════════════════ */

import { useState, useEffect, useMemo } from "react";
import {
  Search, Plus, Edit2, Trash2, X, CheckCircle, RefreshCw,
  AlertCircle, Clock, AlertTriangle, RotateCcw, TrendingUp,
  CreditCard, Wallet, Smartphone,
} from "lucide-react";

import { db, auth } from "../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection, doc, setDoc, deleteDoc, onSnapshot,
  query, orderBy, writeBatch, addDoc,
} from "firebase/firestore";

/* ── CSS ── */
const CSS = `
  @keyframes fadeIn  { from { opacity: 0 }               to { opacity: 1 } }
  @keyframes slideUp { from { opacity: 0; transform: translateY(14px) } to { opacity: 1; transform: translateY(0) } }

  .modal-overlay {
    position: fixed; inset: 0; z-index: 1000;
    background: rgba(0,0,0,0.78); backdrop-filter: blur(5px);
    display: flex; align-items: center; justify-content: center;
    padding: 20px; animation: fadeIn .15s ease;
  }
  .modal-overlay-top { z-index: 1100; }
  .modal-box {
    background: var(--s1); border: 1px solid var(--border-h);
    border-radius: 16px; width: 100%; max-width: 560px;
    max-height: 92vh; overflow-y: auto;
    box-shadow: 0 28px 72px rgba(0,0,0,0.65);
    animation: slideUp .18s ease;
  }
  .modal-box-lg  { max-width: 700px; }
  .modal-box-md  { max-width: 420px; }
  .modal-box::-webkit-scrollbar { width: 3px; }
  .modal-box::-webkit-scrollbar-thumb { background: var(--text-3); border-radius: 2px; }
  .modal-header {
    padding: 20px 22px 16px; border-bottom: 1px solid var(--border);
    display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;
  }
  .modal-title { font-family: 'Sora', sans-serif; font-size: 16px; font-weight: 600; color: var(--text); }
  .modal-sub { font-size: 12px; color: var(--text-2); margin-top: 3px; }
  .modal-close {
    width: 30px; height: 30px; border-radius: 8px; flex-shrink: 0;
    background: var(--s3); border: 1px solid var(--border);
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; margin-top: 2px; transition: background .13s;
  }
  .modal-close:hover { background: var(--s2); border-color: var(--border-h); }
  .modal-body   { padding: 20px 22px; }
  .modal-footer {
    padding: 14px 22px; border-top: 1px solid var(--border);
    display: flex; justify-content: flex-end; gap: 10px;
  }

  .form-group { margin-bottom: 16px; }
  .form-group-0 { margin-bottom: 0; }
  .form-label {
    display: block; font-size: 10px; font-weight: 600;
    letter-spacing: .07em; text-transform: uppercase;
    color: var(--text-2); margin-bottom: 7px;
  }
  .form-label-req { color: var(--gold); margin-left: 2px; }
  .form-input {
    width: 100%; background: var(--s2);
    border: 1px solid var(--border); border-radius: 9px;
    padding: 10px 13px; color: var(--text); font-size: 13px;
    font-family: 'DM Sans', sans-serif;
    outline: none; transition: border-color .15s, box-shadow .15s;
  }
  .form-input:focus { border-color: var(--gold); box-shadow: 0 0 0 3px rgba(200,165,94,0.1); }
  .form-input.err   { border-color: var(--red); }
  .form-input.err:focus { box-shadow: 0 0 0 3px rgba(224,82,82,0.1); }
  .form-error { font-size: 11px; color: var(--red); margin-top: 5px; }
  .form-row-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px; }
  .form-divider { border: none; border-top: 1px solid var(--border); margin: 18px 0 16px; }

  .chip-group { display: flex; gap: 6px; flex-wrap: wrap; }
  .chip {
    padding: 6px 14px; border-radius: 20px; font-size: 12px; font-weight: 500;
    border: 1px solid var(--border); cursor: pointer;
    background: var(--s2); color: var(--text-2);
    transition: all .13s;
  }
  .chip.active { background: var(--gold); color: #0a0808; border-color: var(--gold); }

  .btn-primary {
    padding: 9px 20px; border-radius: 9px;
    background: var(--gold); color: #0a0808;
    border: none; cursor: pointer;
    font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 600;
  }
  .btn-secondary {
    padding: 9px 20px; border-radius: 9px;
    background: var(--s3); color: var(--text-2);
    border: 1px solid var(--border); cursor: pointer;
  }
  .btn-danger {
    padding: 9px 20px; border-radius: 9px;
    background: var(--red-d); color: var(--red);
    border: 1px solid rgba(224,82,82,.25); cursor: pointer;
  }
  .btn-success {
    padding: 9px 20px; border-radius: 9px;
    background: rgba(74,186,130,.12); color: var(--green);
    border: 1px solid rgba(74,186,130,.25); cursor: pointer;
  }

  .btn-icon {
    width: 30px; height: 30px; border-radius: 7px;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; border: 1px solid transparent; background: transparent;
  }
  .btn-icon-edit  { color: var(--blue); }
  .btn-icon-del   { color: var(--red); }
  .btn-icon-pay   { color: var(--green); }
  .btn-icon-undo  { color: var(--text-3); }

  .desp-topbar {
    padding: 14px 22px; background: var(--s1);
    border-bottom: 1px solid var(--border);
    display: flex; align-items: center; gap: 14px;
  }
  .desp-topbar-title h1 { font-family: 'Sora', sans-serif; font-size: 17px; color: var(--text); }
  .desp-search {
    display: flex; align-items: center; gap: 8px;
    background: var(--s2); border: 1px solid var(--border);
    border-radius: 8px; padding: 8px 12px; width: 240px;
  }
  .desp-search input { background: transparent; border: none; outline: none; color: var(--text); font-size: 12px; }

  .desp-metrics { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; padding: 18px 22px; }
  .metric-card { border-radius: 12px; padding: 14px 16px; border: 1px solid transparent; }
  .metric-card-red    { background: rgba(224,82,82,.08);    border-color: rgba(224,82,82,.18); }
  .metric-card-amber  { background: rgba(200,165,94,.08);   border-color: rgba(200,165,94,.18); }
  .metric-card-purple { background: rgba(139,92,246,.08);   border-color: rgba(139,92,246,.18); }
  .metric-card-green  { background: rgba(74,186,130,.08);   border-color: rgba(74,186,130,.18); }
  .metric-val { font-family: 'Sora', sans-serif; font-size: 22px; font-weight: 600; }

  .desp-filters { padding: 0 22px 14px; display: flex; align-items: center; gap: 8px; }
  .filter-chip {
    padding: 5px 12px; border-radius: 20px; font-size: 11px;
    border: 1px solid var(--border); background: var(--s2); color: var(--text-2); cursor: pointer;
  }
  .filter-chip.active { background: var(--s3); border-color: var(--border-h); color: var(--text); }

  .desp-table-wrap { margin: 0 22px 22px; background: var(--s1); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; }
  .desp-row {
    display: grid; grid-template-columns: 80px 1fr 100px 110px 110px 90px 100px 110px 90px;
    padding: 11px 18px; gap: 8px; border-bottom: 1px solid var(--border); align-items: center; font-size: 12px;
  }
  .desp-row-head { background: var(--s2); font-weight: 600; font-size: 10px; color: var(--text-3); text-transform: uppercase; }
  .status-badge { display: inline-flex; align-items: center; gap: 5px; padding: 3px 9px; border-radius: 20px; font-size: 11px; }
  .status-pago { background: rgba(74,186,130,.1); color: var(--green); }
  .status-pendente { background: rgba(200,165,94,.1); color: var(--gold); }
  .status-vencido { background: rgba(224,82,82,.1); color: var(--red); }
`;

/* ── Helpers ── */
const fmtR$ = (v) => `R$ ${Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
const fmtData = (d) => {
  if (!d) return "—";
  try {
    const dt = typeof d === "string" ? new Date(d + "T12:00:00") : d?.toDate ? d.toDate() : new Date(d);
    return dt.toLocaleDateString("pt-BR");
  } catch { return String(d); }
};
const hoje = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const parseDate = (d) => {
  if (!d) return null;
  const dt = typeof d === "string" ? new Date(d + "T12:00:00") : d?.toDate ? d.toDate() : new Date(d);
  dt.setHours(0, 0, 0, 0);
  return dt;
};
const calcularStatus = (vencimento, statusAtual) => {
  if (statusAtual === "pago" || statusAtual === "cancelado") return statusAtual;
  const venc = parseDate(vencimento);
  if (!venc) return "pendente";
  return venc < hoje() ? "vencido" : "pendente";
};
const gerarIdDespesa = (cnt) => `D${String(cnt + 1).padStart(4, "0")}`;

const FORMAS_PAG = [
  { value: "dinheiro", label: "Dinheiro", Icon: Wallet },
  { value: "pix",      label: "Pix",      Icon: Smartphone },
  { value: "cartão",   label: "Cartão",   Icon: CreditCard },
];

/* ── Hooks ── */
function useCategorias(uid) {
  const [categorias, setCategorias] = useState([]);
  useEffect(() => {
    if (!uid) return;
    const q = query(collection(db, "users", uid, "categorias_despesas"), orderBy("nome", "asc"));
    return onSnapshot(q, (snap) => {
      setCategorias(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(c => c.ativa !== false));
    });
  }, [uid]);
  const criarCategoria = async (nome) => {
    if (!uid || !nome.trim()) return;
    await addDoc(collection(db, "users", uid, "categorias_despesas"), { nome: nome.trim(), ativa: true, criadoEm: new Date().toISOString() });
  };
  const desativarCategoria = async (id) => {
    await setDoc(doc(db, "users", uid, "categorias_despesas", id), { ativa: false }, { merge: true });
  };
  return { categorias, criarCategoria, desativarCategoria };
}

/* ── Componentes de Modal ── */
function ModalNovaDespesa({ despesa, categorias, onCriarCategoria, onDesativarCategoria, onSave, onClose }) {
  const isEdit = !!despesa;
  const [form, setForm] = useState({
    descricao: despesa?.descricao || "",
    valor: despesa?.valor || "",
    vencimento: despesa?.vencimento || "",
    categoria: despesa?.categoria || categorias[0]?.nome || "",
    formaPagamento: despesa?.formaPagamento || "pix",
    recorrente: despesa?.recorrente || false,
    parcelado: false,
    totalParcelas: 2,
    fornecedor: despesa?.fornecedor || "",
    observacao: despesa?.observacao || ""
  });

  const handleSalvar = () => {
    if (!form.descricao || !form.valor || !form.vencimento) return alert("Preencha os campos obrigatórios");
    onSave(form);
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box modal-box-lg">
        <div className="modal-header">
          <div className="modal-title">{isEdit ? "Editar Despesa" : "Nova Despesa"}</div>
          <button className="modal-close" onClick={onClose}><X size={14} /></button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Descrição *</label>
            <input className="form-input" value={form.descricao} onChange={e => setForm({...form, descricao: e.target.value})} />
          </div>
          <div className="form-row-3">
            <div>
               <label className="form-label">Valor *</label>
               <input type="number" className="form-input" value={form.valor} onChange={e => setForm({...form, valor: e.target.value})} />
            </div>
            <div>
               <label className="form-label">Vencimento *</label>
               <input type="date" className="form-input" value={form.vencimento} onChange={e => setForm({...form, vencimento: e.target.value})} />
            </div>
            <div>
               <label className="form-label">Pagamento</label>
               <select className="form-input" value={form.formaPagamento} onChange={e => setForm({...form, formaPagamento: e.target.value})}>
                  {FORMAS_PAG.map(fp => <option key={fp.value} value={fp.value}>{fp.label}</option>)}
               </select>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" onClick={handleSalvar}>Salvar</button>
        </div>
      </div>
    </div>
  );
}

/* ── Componente Principal ── */
export default function Despesas() {
  const [uid, setUid] = useState(null);
  const [despesas, setDespesas] = useState([]);
  const [despesaIdCnt, setDespesaIdCnt] = useState(0);
  const [loading, setLoading] = useState(true);
  const [modalNovo, setModalNovo] = useState(false);
  const [editando, setEditando] = useState(null);

  const { categorias, criarCategoria, desativarCategoria } = useCategorias(uid);

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => setUid(user?.uid || null));
  }, []);

  useEffect(() => {
    if (!uid) return;
    const unsubUser = onSnapshot(doc(db, "users", uid), (snap) => {
      if (snap.exists()) setDespesaIdCnt(snap.data().despesaIdCnt || 0);
    });
    const unsubDesp = onSnapshot(query(collection(db, "users", uid, "despesas"), orderBy("vencimento", "asc")), (snap) => {
      setDespesas(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => { unsubUser(); unsubDesp(); };
  }, [uid]);

  const handleAdd = async (form) => {
    const sequencialId = gerarIdDespesa(despesaIdCnt);
    const status = calcularStatus(form.vencimento, "pendente");
    
    // Grava o documento com ID sequencial em vez de aleatório
    await setDoc(doc(db, "users", uid, "despesas", sequencialId), {
      ...form,
      id: sequencialId,
      status,
      valor: Number(form.valor),
      dataCriacao: new Date().toISOString()
    });
    
    await setDoc(doc(db, "users", uid), { despesaIdCnt: despesaIdCnt + 1 }, { merge: true });
    setModalNovo(false);
  };

  const handleEdit = async (form) => {
    await setDoc(doc(db, "users", uid, "despesas", editando.id), { 
        ...form, 
        valor: Number(form.valor),
        status: calcularStatus(form.vencimento, editando.status) 
    }, { merge: true });
    setEditando(null);
  };

  const handleDelete = async (id) => {
    if (window.confirm("Excluir esta despesa?")) {
      await deleteDoc(doc(db, "users", uid, "despesas", id));
    }
  };

  const totalPendente = useMemo(() => 
    despesas.filter(d => d.status !== "pago").reduce((acc, curr) => acc + (curr.valor || 0), 0), 
  [despesas]);

  if (!uid) return <div style={{padding: 40, color: 'white'}}>Carregando...</div>;

  return (
    <div style={{ background: 'var(--s0)', minHeight: '100vh', color: 'var(--text)' }}>
      <style>{CSS}</style>
      
      <header className="desp-topbar">
        <div className="desp-topbar-title"><h1>Financeiro / Despesas</h1></div>
        <button className="btn-primary" style={{marginLeft: 'auto'}} onClick={() => setModalNovo(true)}>+ Nova Despesa</button>
      </header>

      <div className="desp-metrics">
        <div className="metric-card metric-card-purple">
          <div className="metric-val" style={{color: '#8b5cf6'}}>{fmtR$(totalPendente)}</div>
          <div style={{fontSize: 11, opacity: 0.7}}>Total Pendente</div>
        </div>
      </div>

      <div className="desp-table-wrap">
        <div className="desp-row desp-row-head">
          <span>ID</span>
          <span>Descrição</span>
          <span>Categoria</span>
          <span>Valor</span>
          <span>Vencimento</span>
          <span>Status</span>
          <span>Fornecedor</span>
          <span>Pagamento</span>
          <span style={{textAlign: 'right'}}>Ações</span>
        </div>

        {despesas.map(d => (
          <div key={d.id} className="desp-row">
            <span style={{color: 'var(--gold)', fontWeight: 600}}>{d.id}</span>
            <span style={{fontWeight: 500}}>{d.descricao}</span>
            <span>{d.categoria || "—"}</span>
            <span style={{fontWeight: 600}}>{fmtR$(d.valor)}</span>
            <span>{fmtData(d.vencimento)}</span>
            <span className={`status-badge status-${d.status}`}>{d.status}</span>
            <span>{d.fornecedor || "—"}</span>
            <span>{d.dataPagamento ? fmtData(d.dataPagamento) : "—"}</span>
            <div style={{display: 'flex', gap: 5, justifyContent: 'flex-end'}}>
              <button className="btn-icon btn-icon-edit" onClick={() => setEditando(d)}><Edit2 size={12}/></button>
              <button className="btn-icon btn-icon-del" onClick={() => handleDelete(d.id)}><Trash2 size={12}/></button>
            </div>
          </div>
        ))}
      </div>

      {modalNovo && (
        <ModalNovaDespesa 
          categorias={categorias} 
          onSave={handleAdd} 
          onClose={() => setModalNovo(false)} 
        />
      )}
      {editando && (
        <ModalNovaDespesa 
          despesa={editando} 
          categorias={categorias} 
          onSave={handleEdit} 
          onClose={() => setEditando(null)} 
        />
      )}
    </div>
  );
}
