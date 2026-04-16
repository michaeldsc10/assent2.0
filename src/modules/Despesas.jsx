/* ═══════════════════════════════════════════════════
   ASSENT v2.0 — Despesas.jsx
   Versão com IDs automáticos do Firebase (addDoc)
   Baseado no seu código original - Mais segura
   ═══════════════════════════════════════════════════ */

import { useState, useEffect, useMemo } from "react";
import {
  Search, Plus, Edit2, Trash2, X, CheckCircle, RefreshCw,
  AlertCircle, Clock, AlertTriangle, RotateCcw, TrendingUp,
  CreditCard, Wallet, Smartphone,
} from "lucide-react";

import { db, auth, onAuthStateChanged } from "../lib/firebase";
import {
  collection, doc, setDoc, deleteDoc, onSnapshot,
  query, orderBy, writeBatch, addDoc,
} from "firebase/firestore";

/* ── CSS ── */
const CSS = `
  @keyframes fadeIn  { from { opacity: 0 }               to { opacity: 1 } }
  @keyframes slideUp { from { opacity: 0; transform: translateY(14px) } to { opacity: 1; transform: translateY(0) } }

  /* Modal */
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

  /* Form */
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
  .form-row   { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  .form-row-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px; }
  .form-divider {
    border: none; border-top: 1px solid var(--border);
    margin: 18px 0 16px;
  }

  /* Toggle chips */
  .chip-group { display: flex; gap: 6px; flex-wrap: wrap; }
  .chip {
    padding: 6px 14px; border-radius: 20px; font-size: 12px; font-weight: 500;
    border: 1px solid var(--border); cursor: pointer;
    background: var(--s2); color: var(--text-2);
    transition: all .13s;
  }
  .chip.active {
    background: var(--gold); color: #0a0808;
    border-color: var(--gold);
  }
  .chip:hover:not(.active) { border-color: var(--border-h); color: var(--text); }

  /* Buttons */
  .btn-primary, .btn-nova-desp {
    padding: 9px 20px; border-radius: 9px;
    background: var(--gold); color: #0a0808;
    border: none; cursor: pointer;
    font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 600;
    transition: opacity .13s;
  }
  .btn-primary:hover, .btn-nova-desp:hover { opacity: .88; }

  .btn-secondary {
    padding: 9px 20px; border-radius: 9px;
    background: var(--s3); color: var(--text-2);
    border: 1px solid var(--border); cursor: pointer;
    font-family: 'DM Sans', sans-serif; font-size: 13px;
    transition: background .13s;
  }
  .btn-secondary:hover { background: var(--s2); color: var(--text); }

  .btn-danger {
    padding: 9px 20px; border-radius: 9px;
    background: var(--red-d); color: var(--red);
    border: 1px solid rgba(224,82,82,.25); cursor: pointer;
    font-family: 'DM Sans', sans-serif; font-size: 13px;
    transition: background .13s;
  }
  .btn-danger:hover { background: rgba(224,82,82,.18); }

  .btn-success {
    padding: 9px 20px; border-radius: 9px;
    background: rgba(74,186,130,.12); color: var(--green);
    border: 1px solid rgba(74,186,130,.25); cursor: pointer;
    font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 500;
    transition: background .13s;
  }
  .btn-success:hover { background: rgba(74,186,130,.2); }

  .btn-icon {
    width: 30px; height: 30px; border-radius: 7px;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; border: 1px solid transparent;
    background: transparent; transition: all .13s;
  }
  .btn-icon-edit  { color: var(--blue); }
  .btn-icon-edit:hover  { background: var(--blue-d); border-color: rgba(91,142,240,.2); }
  .btn-icon-del   { color: var(--red); }
  .btn-icon-del:hover   { background: var(--red-d);  border-color: rgba(224,82,82,.2); }
  .btn-icon-pay   { color: var(--green); }
  .btn-icon-pay:hover   { background: rgba(74,186,130,.12); border-color: rgba(74,186,130,.2); }
  .btn-icon-undo  { color: var(--text-3); }
  .btn-icon-undo:hover  { background: var(--s2); border-color: var(--border-h); color: var(--text-2); }

  .desp-topbar {
    padding: 14px 22px; background: var(--s1);
    border-bottom: 1px solid var(--border);
    display: flex; align-items: center; gap: 14px; flex-shrink: 0; flex-wrap: wrap;
  }
  .desp-topbar-title h1 { font-family: 'Sora', sans-serif; font-size: 17px; font-weight: 600; color: var(--text); }
  .desp-topbar-title p { font-size: 11px; color: var(--text-2); margin-top: 2px; }

  .desp-search {
    display: flex; align-items: center; gap: 8px;
    background: var(--s2); border: 1px solid var(--border);
    border-radius: 8px; padding: 8px 12px; width: 240px;
  }
  .desp-search input {
    background: transparent; border: none; outline: none;
    color: var(--text); font-size: 12px; width: 100%;
  }

  .desp-metrics {
    display: grid; grid-template-columns: repeat(4, 1fr);
    gap: 12px; padding: 18px 22px;
  }
  .metric-card { border-radius: 12px; padding: 14px 16px; border: 1px solid transparent; }
  .metric-card-red    { background: rgba(224,82,82,.08);    border-color: rgba(224,82,82,.18); }
  .metric-card-amber  { background: rgba(200,165,94,.08);   border-color: rgba(200,165,94,.18); }
  .metric-card-purple { background: rgba(139,92,246,.08);   border-color: rgba(139,92,246,.18); }
  .metric-card-green  { background: rgba(74,186,130,.08);   border-color: rgba(74,186,130,.18); }

  .metric-icon {
    width: 28px; height: 28px; border-radius: 7px;
    display: flex; align-items: center; justify-content: center; margin-bottom: 10px;
  }
  .metric-label { font-size: 10px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: var(--text-3); margin-bottom: 4px; }
  .metric-val   { font-family: 'Sora', sans-serif; font-size: 22px; font-weight: 600; }
  .metric-val-red    { color: var(--red); }
  .metric-val-amber  { color: var(--gold); }
  .metric-val-purple { color: #8b5cf6; }
  .metric-val-green  { color: var(--green); }
  .metric-sub { font-size: 11px; color: var(--text-3); margin-top: 3px; }

  .desp-filters {
    padding: 0 22px 14px;
    display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
  }
  .filter-chip {
    padding: 5px 12px; border-radius: 20px; font-size: 11px; font-weight: 500;
    border: 1px solid var(--border); background: var(--s2); color: var(--text-2);
    cursor: pointer;
  }
  .filter-chip.active { background: var(--s3); border-color: var(--border-h); color: var(--text); }
  .filter-select {
    padding: 5px 10px; border-radius: 8px; font-size: 12px;
    border: 1px solid var(--border); background: var(--s2); color: var(--text-2);
  }

  .desp-table-wrap {
    margin: 0 22px 22px;
    background: var(--s1); border: 1px solid var(--border);
    border-radius: 12px; overflow: hidden;
  }
  .desp-table-header {
    padding: 13px 18px; border-bottom: 1px solid var(--border);
    display: flex; align-items: center; justify-content: space-between;
  }
  .desp-row {
    display: grid;
    grid-template-columns: 220px 1fr 100px 110px 110px 90px 100px 110px 90px;
    padding: 11px 18px; gap: 8px;
    border-bottom: 1px solid var(--border);
    align-items: center; font-size: 12px; color: var(--text-2);
  }
  .desp-row:last-child { border-bottom: none; }
  .desp-row:hover { background: rgba(255,255,255,0.02); }
  .desp-row-head { background: var(--s2); }
  .desp-row-head span {
    font-size: 10px; font-weight: 500; letter-spacing: .06em;
    text-transform: uppercase; color: var(--text-3);
  }

  .desp-id    { font-family: 'Sora', sans-serif; font-size: 11px; color: var(--gold); font-weight: 500; word-break: break-all; }
  .desp-desc  { color: var(--text); font-size: 13px; font-weight: 500; }
  .desp-desc-obs { font-size: 11px; color: var(--text-3); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 220px; }
  .desp-valor { font-family: 'Sora', sans-serif; font-size: 13px; font-weight: 600; color: var(--text); }
  .desp-actions { display: flex; align-items: center; gap: 4px; justify-content: flex-end; }

  .status-badge {
    display: inline-flex; align-items: center; gap: 5px;
    padding: 3px 9px; border-radius: 20px; font-size: 11px; font-weight: 500;
  }
  .status-pago    { background: rgba(74,186,130,.1);   color: var(--green); border: 1px solid rgba(74,186,130,.2); }
  .status-pendente{ background: rgba(200,165,94,.1);   color: var(--gold);  border: 1px solid rgba(200,165,94,.2); }
  .status-vencido { background: rgba(224,82,82,.1);    color: var(--red);   border: 1px solid rgba(224,82,82,.2); }
  .status-cancelado{ background: var(--s3);            color: var(--text-3);border: 1px solid var(--border); }

  .cat-badge {
    display: inline-block; padding: 2px 8px; border-radius: 20px; font-size: 11px;
    background: var(--s3); border: 1px solid var(--border); color: var(--text-2);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 90px;
  }

  .recorr-icon { color: var(--blue); opacity: .8; }
  .parcel-badge {
    font-size: 10px; color: var(--text-3); background: var(--s3);
    border: 1px solid var(--border); border-radius: 4px; padding: 1px 5px;
    font-family: 'Sora', sans-serif;
  }

  .desp-empty, .desp-loading { padding: 56px 20px; text-align: center; color: var(--text-3); font-size: 13px; }
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

const hoje = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

const parseDate = (d) => {
  if (!d) return null;
  try {
    const dt = typeof d === "string" ? new Date(d + "T12:00:00") : d?.toDate ? d.toDate() : new Date(d);
    dt.setHours(0, 0, 0, 0);
    return dt;
  } catch { return null; }
};

const calcularStatus = (vencimento, statusAtual) => {
  if (statusAtual === "pago" || statusAtual === "cancelado") return statusAtual;
  const venc = parseDate(vencimento);
  if (!venc) return "pendente";
  return venc < hoje() ? "vencido" : "pendente";
};

const proximaData = (dataBase, tipo, intervalo = 1) => {
  const d = parseDate(dataBase);
  if (!d) return null;
  const nova = new Date(d);
  if (tipo === "mensal")  nova.setMonth(nova.getMonth() + intervalo);
  if (tipo === "semanal") nova.setDate(nova.getDate() + 7 * intervalo);
  if (tipo === "anual")   nova.setFullYear(nova.getFullYear() + intervalo);
  return nova.toISOString().split("T")[0];
};

const CATEGORIAS_DEFAULT = ["Fixo", "Variável", "Pessoal", "Marketing", "Operacional", "Tecnologia", "Impostos", "Outros"];
const FORMAS_PAG = [
  { value: "dinheiro", label: "Dinheiro", Icon: Wallet },
  { value: "pix",      label: "Pix",      Icon: Smartphone },
  { value: "cartão",   label: "Cartão",   Icon: CreditCard },
];

/* ── Modal Nova / Editar Despesa ── */
function ModalNovaDespesa({ despesa, onSave, onClose }) {
  const isEdit = !!despesa;

  const [form, setForm] = useState({
    descricao:      despesa?.descricao      || "",
    valor:          despesa?.valor          || "",
    vencimento:     despesa?.vencimento     || "",
    categoria:      despesa?.categoria      || "Fixo",
    centroCusto:    despesa?.centroCusto    || "",
    fornecedor:     despesa?.fornecedor     || "",
    formaPagamento: despesa?.formaPagamento || "pix",
    recorrente:     despesa?.recorrente     || false,
    tipoRecorrencia:despesa?.tipoRecorrencia|| "mensal",
    intervalo:      despesa?.intervalo      || 1,
    dataFim:        despesa?.dataFim        || "",
    parcelado:      despesa?.parcelado      || false,
    totalParcelas:  despesa?.totalParcelas  || 2,
    observacao:     despesa?.observacao     || "",
  });
  const [erros, setErros] = useState({});
  const [salvando, setSalvando] = useState(false);

  const set = (campo, valor) => {
    setForm(f => ({ ...f, [campo]: valor }));
    if (erros[campo]) setErros(e => ({ ...e, [campo]: "" }));
  };

  const validar = () => {
    const e = {};
    if (!form.descricao.trim()) e.descricao = "Descrição é obrigatória.";
    if (!form.valor || isNaN(Number(form.valor)) || Number(form.valor) <= 0) e.valor = "Valor inválido.";
    if (!form.vencimento) e.vencimento = "Data de vencimento é obrigatória.";
    setErros(e);
    return Object.keys(e).length === 0;
  };

  const handleSalvar = async () => {
    if (!validar()) return;
    setSalvando(true);
    await onSave({
      descricao:       form.descricao.trim(),
      valor:           Number(form.valor),
      vencimento:      form.vencimento,
      categoria:       form.categoria,
      centroCusto:     form.centroCusto.trim(),
      fornecedor:      form.fornecedor.trim(),
      formaPagamento:  form.formaPagamento,
      recorrente:      form.recorrente,
      tipoRecorrencia: form.recorrente ? form.tipoRecorrencia : null,
      intervalo:       form.recorrente ? Number(form.intervalo) : null,
      dataFim:         form.recorrente && form.dataFim ? form.dataFim : null,
      parcelado:       form.parcelado && !isEdit,
      totalParcelas:   form.parcelado && !isEdit ? Number(form.totalParcelas) : null,
      observacao:      form.observacao.trim(),
    });
    setSalvando(false);
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box modal-box-lg">
        <div className="modal-header">
          <div>
            <div className="modal-title">{isEdit ? "Editar Despesa" : "Nova Despesa"}</div>
            <div className="modal-sub">
              {isEdit ? `Editando ${despesa.id}` : "Preencha os dados da despesa"}
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>
            <X size={14} color="var(--text-2)" />
          </button>
        </div>

        <div className="modal-body">
          {/* Descrição */}
          <div className="form-group">
            <label className="form-label">Descrição <span className="form-label-req">*</span></label>
            <input className={`form-input ${erros.descricao ? "err" : ""}`} value={form.descricao} onChange={e => set("descricao", e.target.value)} placeholder="Ex: Aluguel, energia elétrica..." autoFocus />
            {erros.descricao && <div className="form-error">{erros.descricao}</div>}
          </div>

          {/* Valor + Vencimento + Forma */}
          <div className="form-row-3">
            <div className="form-group form-group-0">
              <label className="form-label">Valor (R$) <span className="form-label-req">*</span></label>
              <input className={`form-input ${erros.valor ? "err" : ""}`} type="number" min="0" step="0.01" value={form.valor} onChange={e => set("valor", e.target.value)} />
              {erros.valor && <div className="form-error">{erros.valor}</div>}
            </div>
            <div className="form-group form-group-0">
              <label className="form-label">Vencimento <span className="form-label-req">*</span></label>
              <input className={`form-input ${erros.vencimento ? "err" : ""}`} type="date" value={form.vencimento} onChange={e => set("vencimento", e.target.value)} />
              {erros.vencimento && <div className="form-error">{erros.vencimento}</div>}
            </div>
            <div className="form-group form-group-0">
              <label className="form-label">Forma de pagamento</label>
              <div className="chip-group" style={{ marginTop: 2 }}>
                {FORMAS_PAG.map(fp => (
                  <button key={fp.value} className={`chip ${form.formaPagamento === fp.value ? "active" : ""}`} onClick={() => set("formaPagamento", fp.value)} type="button">
                    <fp.Icon size={11} style={{ display: "inline", marginRight: 4 }} /> {fp.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Categoria, Centro, Fornecedor */}
          <div className="form-row-3" style={{ marginTop: 14 }}>
            <div className="form-group form-group-0">
              <label className="form-label">Categoria</label>
              <select className="form-input" value={form.categoria} onChange={e => set("categoria", e.target.value)}>
                {CATEGORIAS_DEFAULT.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-group form-group-0">
              <label className="form-label">Centro de custo</label>
              <input className="form-input" value={form.centroCusto} onChange={e => set("centroCusto", e.target.value)} placeholder="Ex: Marketing..." />
            </div>
            <div className="form-group form-group-0">
              <label className="form-label">Fornecedor</label>
              <input className="form-input" value={form.fornecedor} onChange={e => set("fornecedor", e.target.value)} placeholder="Nome do fornecedor" />
            </div>
          </div>

          <hr className="form-divider" />

          {/* Recorrência e Parcelamento (mesmo do original) */}
          <div className="form-group">
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <input type="checkbox" checked={form.recorrente} onChange={e => set("recorrente", e.target.checked)} style={{ accentColor: "var(--gold)" }} />
              <span className="form-label" style={{ marginBottom: 0 }}>Despesa recorrente</span>
            </label>

            {form.recorrente && (
              <div className="form-row-3" style={{ marginTop: 10 }}>
                <div className="form-group form-group-0">
                  <label className="form-label">Tipo</label>
                  <select className="form-input" value={form.tipoRecorrencia} onChange={e => set("tipoRecorrencia", e.target.value)}>
                    <option value="mensal">Mensal</option>
                    <option value="semanal">Semanal</option>
                    <option value="anual">Anual</option>
                  </select>
                </div>
                <div className="form-group form-group-0">
                  <label className="form-label">Intervalo</label>
                  <input type="number" min="1" className="form-input" value={form.intervalo} onChange={e => set("intervalo", e.target.value)} />
                </div>
                <div className="form-group form-group-0">
                  <label className="form-label">Data fim (opcional)</label>
                  <input type="date" className="form-input" value={form.dataFim} onChange={e => set("dataFim", e.target.value)} />
                </div>
              </div>
            )}
          </div>

          {!isEdit && (
            <div className="form-group">
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input type="checkbox" checked={form.parcelado} disabled={form.recorrente} onChange={e => set("parcelado", e.target.checked)} style={{ accentColor: "var(--gold)" }} />
                <span className="form-label" style={{ marginBottom: 0 }}>Parcelado</span>
              </label>
              {form.parcelado && !form.recorrente && (
                <input type="number" min="2" max="60" className="form-input" style={{ width: "160px", marginTop: 8 }} value={form.totalParcelas} onChange={e => set("totalParcelas", e.target.value)} />
              )}
            </div>
          )}

          <div className="form-group" style={{ marginTop: 14 }}>
            <label className="form-label">Observação</label>
            <input className="form-input" value={form.observacao} onChange={e => set("observacao", e.target.value)} placeholder="Opcional" />
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" onClick={handleSalvar} disabled={salvando}>
            {salvando ? "Salvando..." : isEdit ? "Salvar Alterações" : (form.parcelado ? `Criar ${form.totalParcelas} parcelas` : "Registrar Despesa")}
          </button>
        </div>
      </div>
    </div>
  );
}

/* Modal Pagar */
function ModalPagar({ despesa, onConfirm, onClose }) {
  const [formaPag, setFormaPag] = useState(despesa.formaPagamento || "pix");
  const [pagando, setPagando] = useState(false);

  const handlePagar = async () => {
    setPagando(true);
    await onConfirm(formaPag);
    setPagando(false);
  };

  return (
    <div className="modal-overlay modal-overlay-top" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box modal-box-md">
        <div className="modal-header">
          <div>
            <div className="modal-title">Registrar Pagamento</div>
            <div className="modal-sub">{despesa.descricao}</div>
          </div>
          <button className="modal-close" onClick={onClose}><X size={14} color="var(--text-2)" /></button>
        </div>
        <div className="modal-body">
          <div className="pay-info" style={{ background: "var(--s2)", border: "1px solid var(--border)", borderRadius: "10px", padding: "14px 16px", marginBottom: "16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}><span>Valor</span><span style={{ fontWeight: 600, color: "var(--green)" }}>{fmtR$(despesa.valor)}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span>Vencimento</span><span>{fmtData(despesa.vencimento)}</span></div>
          </div>

          <div className="form-group">
            <label className="form-label">Forma de pagamento</label>
            <div className="chip-group">
              {FORMAS_PAG.map(fp => (
                <button key={fp.value} className={`chip ${formaPag === fp.value ? "active" : ""}`} onClick={() => setFormaPag(fp.value)}>
                  <fp.Icon size={11} style={{ marginRight: 4 }} /> {fp.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn-success" onClick={handlePagar} disabled={pagando}>
            {pagando ? "Registrando..." : "Confirmar Pagamento"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* Modal Confirm Delete */
function ModalConfirmDelete({ despesa, onConfirm, onClose }) {
  const [excluindo, setExcluindo] = useState(false);

  const handleConfirm = async () => {
    setExcluindo(true);
    await onConfirm();
    setExcluindo(false);
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box modal-box-md">
        <div className="modal-header">
          <div className="modal-title">Excluir Despesa</div>
          <button className="modal-close" onClick={onClose}><X size={14} color="var(--text-2)" /></button>
        </div>
        <div style={{ padding: "24px 22px", textAlign: "center" }}>
          <div style={{ width: "44px", height: "44px", background: "var(--red-d)", borderRadius: "50%", margin: "0 auto 14px", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Trash2 size={18} color="var(--red)" />
          </div>
          <p>Deseja excluir <strong>{despesa.descricao}</strong>?<br />Esta ação não pode ser desfeita.</p>
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn-danger" onClick={handleConfirm} disabled={excluindo}>
            {excluindo ? "Excluindo..." : "Confirmar Exclusão"}
          </button>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    pago: { cls: "status-pago", Icon: CheckCircle, label: "Pago" },
    pendente: { cls: "status-pendente", Icon: Clock, label: "Pendente" },
    vencido: { cls: "status-vencido", Icon: AlertCircle, label: "Vencido" },
  };
  const s = map[status] || map.pendente;
  return (
    <span className={`status-badge ${s.cls}`}>
      <s.Icon size={10} /> {s.label}
    </span>
  );
}

/* ════════════════════════════════════════
   COMPONENTE PRINCIPAL
   ════════════════════════════════════════ */
export default function Despesas() {
  const [uid, setUid] = useState(null);
  const [despesas, setDespesas] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const [filtroStatus, setFiltroStatus] = useState("todas");
  const [filtroCategoria, setFiltroCategoria] = useState("todas");
  const [filtroPeriodo, setFiltroPeriodo] = useState("mes");

  const [modalNovo, setModalNovo] = useState(false);
  const [editando, setEditando] = useState(null);
  const [pagando, setPagando] = useState(null);
  const [deletando, setDeletando] = useState(null);

  /* Auth */
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => setUid(user?.uid || null));
    return unsub;
  }, []);

  /* Firestore */
  useEffect(() => {
    if (!uid) { setLoading(false); return; }

    const despesasCol = collection(db, "users", uid, "despesas");
    const q = query(despesasCol,);

    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));

     const updatedDocs = docs.map(d => ({
      ...d,
      status: calcularStatus(d.vencimento, d.status || "pendente")
    }));

    // Ordenamos no cliente (mais estável)
    updatedDocs.sort((a, b) => {
      const dateA = parseDate(a.vencimento);
      const dateB = parseDate(b.vencimento);
      return (dateA || 0) - (dateB || 0);
    });

    setDespesas(updatedDocs);
    setLoading(false);
  }, (error) => {
    console.error("Erro no onSnapshot:", error);
    setLoading(false);
  });

  return () => unsub();
}, [uid]);

  /* ── SALVAR NOVA DESPESA (ID AUTOMÁTICO) ── */
  const handleAdd = async (form) => {
    if (!uid) return;

    try {
      const baseData = {
        ...form,
        status: calcularStatus(form.vencimento, "pendente"),
        dataCriacao: new Date().toISOString(),
      };

      if (form.parcelado && form.totalParcelas > 1) {
        const grupoId = `G${Date.now()}`;
        const batch = writeBatch(db);

        for (let i = 0; i < form.totalParcelas; i++) {
          const dataVenc = new Date(form.vencimento);
          dataVenc.setMonth(dataVenc.getMonth() + i);
          const vencStr = dataVenc.toISOString().split("T")[0];

          batch.set(doc(collection(db, "users", uid, "despesas")), {
            ...baseData,
            parcelado: true,
            grupoId,
            parcelaAtual: i + 1,
            vencimento: vencStr,
            status: calcularStatus(vencStr, "pendente"),
          });
        }
        await batch.commit();
      } else {
        await addDoc(collection(db, "users", uid, "despesas"), baseData);
      }

      setModalNovo(false);
    } catch (error) {
      console.error("Erro ao salvar despesa:", error);
      alert("Erro ao salvar despesa. Verifique o console.");
    }
  };

  const handleEdit = async (form) => {
    if (!uid || !editando) return;
    try {
      const status = calcularStatus(form.vencimento, editando.status);
      await setDoc(doc(db, "users", uid, "despesas", editando.id), { ...form, status }, { merge: true });
      setEditando(null);
    } catch (error) {
      console.error("Erro ao editar:", error);
    }
  };

  const handlePagar = async (formaPagamento) => {
    if (!uid || !pagando) return;
    try {
      await setDoc(doc(db, "users", uid, "despesas", pagando.id), {
        status: "pago",
        formaPagamento,
        dataPagamento: new Date().toISOString().split("T")[0],
      }, { merge: true });

      if (pagando.recorrente) {
        const dataFimOk = !pagando.dataFim || new Date(pagando.dataFim) > new Date();
        if (dataFimOk) {
          const novaData = proximaData(pagando.vencimento, pagando.tipoRecorrencia, pagando.intervalo || 1);
          if (novaData) {
            await addDoc(collection(db, "users", uid, "despesas"), {
              descricao: pagando.descricao,
              valor: pagando.valor,
              vencimento: novaData,
              categoria: pagando.categoria,
              centroCusto: pagando.centroCusto,
              fornecedor: pagando.fornecedor,
              formaPagamento: pagando.formaPagamento,
              recorrente: true,
              tipoRecorrencia: pagando.tipoRecorrencia,
              intervalo: pagando.intervalo,
              dataFim: pagando.dataFim,
              recorrenciaOrigemId: pagando.id,
              status: calcularStatus(novaData, "pendente"),
              dataCriacao: new Date().toISOString(),
            });
          }
        }
      }
    } catch (error) {
      console.error(error);
    } finally {
      setPagando(null);
    }
  };

  const handleDesfazerPagamento = async (despesa) => {
    if (!uid) return;
    const status = calcularStatus(despesa.vencimento, "pendente");
    await setDoc(doc(db, "users", uid, "despesas", despesa.id), { status, dataPagamento: null }, { merge: true });
  };

  const handleDelete = async () => {
    if (!uid || !deletando) return;
    try {
      await deleteDoc(doc(db, "users", uid, "despesas", deletando.id));
    } catch (error) {
      console.error(error);
    } finally {
      setDeletando(null);
    }
  };

  /* Filtros e Métricas */
  const mesAtual = new Date().getMonth();
  const anoAtual = new Date().getFullYear();

  const despesasFiltradas = useMemo(() => {
    let lista = [...despesas];

    if (filtroPeriodo === "mes") {
      lista = lista.filter(d => {
        const dt = parseDate(d.vencimento);
        return dt && dt.getMonth() === mesAtual && dt.getFullYear() === anoAtual;
      });
    } else if (filtroPeriodo === "semana") {
      const inicio = new Date(); inicio.setDate(inicio.getDate() - inicio.getDay());
      const fim = new Date(inicio); fim.setDate(inicio.getDate() + 6);
      lista = lista.filter(d => {
        const dt = parseDate(d.vencimento);
        return dt && dt >= inicio && dt <= fim;
      });
    }

    if (filtroStatus !== "todas") lista = lista.filter(d => d.status === filtroStatus);
    if (filtroCategoria !== "todas") lista = lista.filter(d => d.categoria === filtroCategoria);

    if (search.trim()) {
      const q = search.toLowerCase();
      lista = lista.filter(d =>
        d.descricao?.toLowerCase().includes(q) ||
        d.fornecedor?.toLowerCase().includes(q) ||
        d.categoria?.toLowerCase().includes(q)
      );
    }
    return lista;
  }, [despesas, filtroStatus, filtroCategoria, filtroPeriodo, search, mesAtual, anoAtual]);

  const metricas = useMemo(() => {
    const base = filtroPeriodo === "todas" ? despesas : despesasFiltradas;
    const vencidas = base.filter(d => d.status === "vencido").length;
    const em3dias = base.filter(d => {
      if (d.status !== "pendente") return false;
      const dt = parseDate(d.vencimento);
      const diff = (dt - hoje()) / (1000 * 60 * 60 * 24);
      return diff >= 0 && diff <= 3;
    }).length;

    const totalPendente = base.filter(d => d.status === "pendente" || d.status === "vencido")
      .reduce((s, d) => s + (d.valor || 0), 0);
    const totalPago = base.filter(d => d.status === "pago")
      .reduce((s, d) => s + (d.valor || 0), 0);

    return { vencidas, em3dias, totalPendente, totalPago };
  }, [despesas, despesasFiltradas, filtroPeriodo]);

  const categorias = useMemo(() => [...new Set(despesas.map(d => d.categoria).filter(Boolean))], [despesas]);

  if (!uid) return <div className="desp-loading">Carregando autenticação...</div>;

  return (
    <>
      <style>{CSS}</style>

      <header className="desp-topbar">
        <div className="desp-topbar-title">
          <h1>Despesas</h1>
          <p>Controle de pagamentos e obrigações financeiras</p>
        </div>

        <div className="desp-search">
          <Search size={13} color="var(--text-3)" />
          <input placeholder="Buscar por descrição, fornecedor..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        <div style={{ marginLeft: "auto" }}>
          <button className="btn-nova-desp" onClick={() => setModalNovo(true)}>
            <Plus size={14} /> Nova Despesa
          </button>
        </div>
      </header>

      <div className="desp-metrics">
        <div className="metric-card metric-card-red">
          <div className="metric-icon metric-icon-red"><AlertCircle size={15} color="var(--red)" /></div>
          <div className="metric-label">Vencidas</div>
          <div className="metric-val metric-val-red">{metricas.vencidas}</div>
          <div className="metric-sub">despesas em atraso</div>
        </div>
        <div className="metric-card metric-card-amber">
          <div className="metric-icon metric-icon-amber"><AlertTriangle size={15} color="var(--gold)" /></div>
          <div className="metric-label">Vencem em 3 dias</div>
          <div className="metric-val metric-val-amber">{metricas.em3dias}</div>
          <div className="metric-sub">requerem atenção</div>
        </div>
        <div className="metric-card metric-card-purple">
          <div className="metric-icon metric-icon-purple"><Clock size={15} color="#8b5cf6" /></div>
          <div className="metric-label">Total Pendente</div>
          <div className="metric-val metric-val-purple" style={{ fontSize: 17 }}>{fmtR$(metricas.totalPendente)}</div>
          <div className="metric-sub">a pagar</div>
        </div>
        <div className="metric-card metric-card-green">
          <div className="metric-icon metric-icon-green"><TrendingUp size={15} color="var(--green)" /></div>
          <div className="metric-label">Pago este mês</div>
          <div className="metric-val metric-val-green" style={{ fontSize: 17 }}>{fmtR$(metricas.totalPago)}</div>
          <div className="metric-sub">liquidado</div>
        </div>
      </div>

      <div className="desp-filters">
        <span className="filter-label">Mostrar:</span>
        {["todas", "pendente", "vencido", "pago"].map(s => (
          <button key={s} className={`filter-chip ${filtroStatus === s ? "active" : ""}`} onClick={() => setFiltroStatus(s)}>
            {s === "todas" ? "Todas" : s === "pendente" ? "Pendentes" : s === "vencido" ? "Vencidas" : "Pagas"}
          </button>
        ))}

        <select className="filter-select" value={filtroPeriodo} onChange={e => setFiltroPeriodo(e.target.value)}>
          <option value="mes">Este mês</option>
          <option value="semana">Esta semana</option>
          <option value="todas">Tudo</option>
        </select>

        <select className="filter-select" value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value)}>
          <option value="todas">Todas categorias</option>
          {categorias.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div className="desp-table-wrap">
        <div className="desp-table-header">
          <span className="desp-table-title">Despesas</span>
          <span className="count-badge">{despesasFiltradas.length}</span>
        </div>

        <div className="desp-row desp-row-head">
          <span>ID</span>
          <span>Descrição</span>
          <span>Categoria</span>
          <span>Valor</span>
          <span>Vencimento</span>
          <span>Status</span>
          <span>Fornecedor</span>
          <span>Pagamento</span>
          <span style={{ textAlign: "right" }}>Ações</span>
        </div>

        {loading ? (
          <div className="desp-loading">Carregando despesas...</div>
        ) : despesasFiltradas.length === 0 ? (
          <div className="desp-empty">Nenhuma despesa encontrada.</div>
        ) : despesasFiltradas.map(d => (
          <div key={d.id} className="desp-row">
            <span className="desp-id">{d.id}</span>

            <div>
              <div className="desp-desc">
                {d.descricao}
                {d.parcelado && <span className="parcel-badge" style={{ marginLeft: 6 }}>{d.parcelaAtual}/{d.totalParcelas}</span>}
              </div>
              {d.observacao && <div className="desp-desc-obs">{d.observacao}</div>}
            </div>

            <span className="cat-badge">{d.categoria || "—"}</span>
            <span className="desp-valor">{fmtR$(d.valor)}</span>
            <span>{fmtData(d.vencimento)}</span>
            <StatusBadge status={d.status} />
            <span style={{ color: "var(--text-2)", fontSize: 12 }}>{d.fornecedor || "—"}</span>
            <span style={{ fontSize: 12 }}>{d.dataPagamento ? fmtData(d.dataPagamento) : "—"}</span>

            <div className="desp-actions">
              {d.status !== "pago" && d.status !== "cancelado" && (
                <button className="btn-icon btn-icon-pay" title="Pagar" onClick={() => setPagando(d)}>
                  <CheckCircle size={13} />
                </button>
              )}
              {d.status === "pago" && (
                <button className="btn-icon btn-icon-undo" title="Desfazer" onClick={() => handleDesfazerPagamento(d)}>
                  <RotateCcw size={13} />
                </button>
              )}
              <button className="btn-icon btn-icon-edit" title="Editar" onClick={() => setEditando(d)}>
                <Edit2 size={13} />
              </button>
              <button className="btn-icon btn-icon-del" title="Excluir" onClick={() => setDeletando(d)}>
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modais */}
      {modalNovo && <ModalNovaDespesa onSave={handleAdd} onClose={() => setModalNovo(false)} />}
      {editando && <ModalNovaDespesa despesa={editando} onSave={handleEdit} onClose={() => setEditando(null)} />}
      {pagando && <ModalPagar despesa={pagando} onConfirm={handlePagar} onClose={() => setPagando(null)} />}
      {deletando && <ModalConfirmDelete despesa={deletando} onConfirm={handleDelete} onClose={() => setDeletando(null)} />}
    </>
  );
}
