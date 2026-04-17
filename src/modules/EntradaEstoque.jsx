/* ═══════════════════════════════════════════════════
   ASSENT v2.0 — EntradaEstoque.jsx
   Módulo: Entrada de Estoque
   Estrutura: movimentacoes_estoque / produtos (global)
   ═══════════════════════════════════════════════════ */

import { useState, useEffect, useMemo, useCallback } from "react";
import { PackagePlus, Search, X, AlertCircle, CheckCircle2, ChevronRight } from "lucide-react";
import { db, auth, onAuthStateChanged } from "../lib/firebase";
import {
  collection,
  doc,
  getDoc,
  setDoc,
  addDoc,
  onSnapshot,
  serverTimestamp,
  runTransaction,
} from "firebase/firestore";


/* ── CSS ── */
const CSS = `
  /* ── Modal ── */
  .modal-overlay {
    position: fixed; inset: 0; z-index: 1000;
    background: rgba(0,0,0,0.78);
    backdrop-filter: blur(5px);
    display: flex; align-items: center; justify-content: center;
    padding: 20px; animation: fadeIn .15s ease;
  }
  @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
  @keyframes slideUp {
    from { opacity: 0; transform: translateY(14px) }
    to   { opacity: 1; transform: translateY(0) }
  }

  .modal-box {
    background: var(--s1); border: 1px solid var(--border-h);
    border-radius: 16px; width: 100%; max-width: 560px;
    max-height: 92vh; overflow-y: auto;
    box-shadow: 0 28px 72px rgba(0,0,0,0.65);
    animation: slideUp .18s ease;
  }
  .modal-box::-webkit-scrollbar { width: 3px; }
  .modal-box::-webkit-scrollbar-thumb { background: var(--text-3); border-radius: 2px; }

  .modal-header {
    padding: 20px 22px 16px;
    border-bottom: 1px solid var(--border);
    display: flex; align-items: flex-start;
    justify-content: space-between; gap: 12px;
  }
  .modal-title {
    font-family: 'Sora', sans-serif;
    font-size: 16px; font-weight: 600; color: var(--text);
  }
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

  /* ── Form ── */
  .form-group  { margin-bottom: 16px; }
  .form-label  {
    display: block; font-size: 10px; font-weight: 600;
    letter-spacing: .07em; text-transform: uppercase;
    color: var(--text-2); margin-bottom: 7px;
  }
  .form-label-req { color: var(--gold); margin-left: 2px; }
  .form-input  {
    width: 100%; background: var(--s2);
    border: 1px solid var(--border); border-radius: 9px;
    padding: 10px 13px; color: var(--text); font-size: 13px;
    font-family: 'DM Sans', sans-serif;
    outline: none; transition: border-color .15s, box-shadow .15s;
    appearance: none;
  }
  .form-input:focus { border-color: var(--gold); box-shadow: 0 0 0 3px rgba(200,165,94,0.1); }
  .form-input.err   { border-color: var(--red); }
  .form-input.err:focus { box-shadow: 0 0 0 3px rgba(224,82,82,0.1); }
  .form-error { font-size: 11px; color: var(--red); margin-top: 5px; }
  .form-row   { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  .form-row-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px; }

  /* ── Botões ── */
  .btn-primary {
    padding: 9px 20px; border-radius: 9px;
    background: var(--gold); color: #0a0808;
    border: none; cursor: pointer;
    font-family: 'DM Sans', sans-serif;
    font-size: 13px; font-weight: 600;
    transition: opacity .13s, transform .1s;
    display: flex; align-items: center; gap: 6px;
  }
  .btn-primary:hover  { opacity: .88; }
  .btn-primary:active { transform: scale(.97); }
  .btn-primary:disabled { opacity: .5; cursor: not-allowed; transform: none; }

  .btn-secondary {
    padding: 9px 20px; border-radius: 9px;
    background: var(--s3); color: var(--text-2);
    border: 1px solid var(--border); cursor: pointer;
    font-family: 'DM Sans', sans-serif; font-size: 13px;
    transition: background .13s, color .13s;
  }
  .btn-secondary:hover { background: var(--s2); color: var(--text); }

  .btn-entrada {
    display: flex; align-items: center; gap: 7px;
    padding: 8px 16px; border-radius: 9px;
    background: var(--green-d, rgba(52,199,89,0.12)); color: var(--green, #34c759);
    border: 1px solid rgba(52,199,89,0.25); cursor: pointer;
    font-family: 'DM Sans', sans-serif;
    font-size: 13px; font-weight: 600;
    white-space: nowrap;
    transition: background .13s, transform .1s;
  }
  .btn-entrada:hover  { background: rgba(52,199,89,0.2); }

  /* ── Topbar ── */
  .ee-topbar {
    padding: 14px 22px;
    background: var(--s1); border-bottom: 1px solid var(--border);
    display: flex; align-items: center; gap: 14px; flex-shrink: 0;
  }
  .ee-topbar-title h1 {
    font-family: 'Sora', sans-serif; font-size: 17px; font-weight: 600;
    color: var(--text);
  }
  .ee-topbar-title p { font-size: 11px; color: var(--text-2); margin-top: 2px; }

  .ee-search {
    display: flex; align-items: center; gap: 8px;
    background: var(--s2); border: 1px solid var(--border);
    border-radius: 8px; padding: 8px 12px; width: 270px;
  }
  .ee-search input {
    background: transparent; border: none; outline: none;
    color: var(--text); font-size: 12px; width: 100%;
    font-family: 'DM Sans', sans-serif;
  }

  /* ── Tabela de movimentações ── */
  .ee-table-wrap {
    background: var(--s1); border: 1px solid var(--border);
    border-radius: 12px; overflow: hidden;
  }
  .ee-table-header {
    padding: 13px 18px;
    border-bottom: 1px solid var(--border);
    display: flex; align-items: center; justify-content: space-between;
  }
  .ee-table-title {
    font-family: 'Sora', sans-serif; font-size: 13px; font-weight: 600; color: var(--text);
  }
  .ee-count-badge {
    font-family: 'Sora', sans-serif; font-size: 12px; font-weight: 600;
    background: var(--s3); border: 1px solid var(--border-h);
    color: var(--text-2); padding: 2px 10px; border-radius: 20px;
  }

  .ee-row {
  <span style={{ display: "flex", gap: 8 }}>
  <button onClick={() => handleEditar(m)}>Editar</button>
  <button onClick={() => handleExcluir(m)}>Excluir</button>
</span>
    display: grid;
    grid-template-columns: 140px 1fr 80px 130px 100px 1fr;
    padding: 11px 18px; gap: 8px;
    border-bottom: 1px solid var(--border);
    align-items: center; font-size: 12px; color: var(--text-2);
  }
  .ee-row:last-child { border-bottom: none; }
  .ee-row:hover { background: rgba(255,255,255,0.02); }
  .ee-row-head { background: var(--s2); }
  .ee-row-head span {
    font-size: 10px; font-weight: 500; letter-spacing: .06em;
    text-transform: uppercase; color: var(--text-3);
  }

  .ee-data   { font-family: 'Sora', sans-serif; font-size: 11px; color: var(--gold); font-weight: 500; }
  .ee-nome   { color: var(--text); font-size: 13px; font-weight: 500; }
  .ee-qtd    {
    font-family: 'Sora', sans-serif; font-size: 13px; font-weight: 600;
    color: var(--green, #34c759);
  }
  .ee-motivo {
    background: var(--s3); border: 1px solid var(--border);
    border-radius: 5px; padding: 2px 8px;
    font-size: 11px; color: var(--text-2);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .ee-custo  { color: var(--red); font-size: 12px; }
  .ee-obs    { font-size: 11px; color: var(--text-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

  .ee-empty, .ee-loading {
    padding: 56px 20px; text-align: center; color: var(--text-3); font-size: 13px;
  }

  /* ── Preview de estoque (no modal) ── */
  .ee-preview {
    display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px;
    margin: 16px 0;
  }
  .ee-preview-card {
    background: var(--s2); border: 1px solid var(--border);
    border-radius: 10px; padding: 12px 14px;
    text-align: center;
  }
  .ee-preview-label {
    font-size: 10px; font-weight: 600; letter-spacing: .07em;
    text-transform: uppercase; color: var(--text-3); margin-bottom: 6px;
  }
  .ee-preview-val {
    font-family: 'Sora', sans-serif; font-size: 20px; font-weight: 700;
  }
  .ee-preview-val.atual  { color: var(--text-2); }
  .ee-preview-val.add    { color: var(--blue, #5b8ef0); }
  .ee-preview-val.novo   { color: var(--green, #34c759); }

  /* ── Feedback global ── */
  .ee-toast {
    position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
    z-index: 9999; display: flex; align-items: center; gap: 9px;
    padding: 12px 18px; border-radius: 10px;
    font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 500;
    box-shadow: 0 8px 32px rgba(0,0,0,0.4);
    animation: slideUp .2s ease;
    pointer-events: none;
  }
  .ee-toast.sucesso {
    background: rgba(52,199,89,0.15); border: 1px solid rgba(52,199,89,0.3);
    color: var(--green, #34c759);
  }
  .ee-toast.erro {
    background: var(--red-d, rgba(224,82,82,0.12)); border: 1px solid rgba(224,82,82,0.3);
    color: var(--red, #e05252);
  }

  /* ── Spinner ── */
  @keyframes spin { to { transform: rotate(360deg); } }
  .spinner {
    width: 13px; height: 13px; border-radius: 50%;
    border: 2px solid rgba(10,8,8,0.2);
    border-top-color: #0a0808;
    animation: spin .6s linear infinite;
    flex-shrink: 0;
  }

  /* ── Divisor de seção ── */
  .ee-section-label {
    font-size: 10px; font-weight: 600; letter-spacing: .07em;
    text-transform: uppercase; color: var(--text-3);
    margin: 18px 0 10px;
    display: flex; align-items: center; gap: 8px;
  }
  .ee-section-label::after {
    content: ''; flex: 1; height: 1px; background: var(--border);
  }
`;

/* ── Helpers ── */
const hoje = () => new Date().toISOString().slice(0, 10);

const fmtR$ = (v) =>
  v != null && v !== ""
    ? `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
    : "—";

const fmtData = (d) => {
  if (!d) return "—";
  try {
    const dt = d?.toDate ? d.toDate() : new Date(d + "T00:00:00");
    return dt.toLocaleDateString("pt-BR");
  } catch {
    return String(d);
  }
};

const sanitize = (s) => (typeof s === "string" ? s.trim() : s);

const MOTIVOS = [
  "Compra de fornecedor",
  "Ajuste de estoque",
  "Devolução de cliente",
  "Transferência entre locais",
  "Produção interna",
  "Outros",
];

/* ══════════════════════════════════════════════════════
   TOAST
   ══════════════════════════════════════════════════════ */
function Toast({ msg, tipo }) {
  if (!msg) return null;
  const Icon = tipo === "sucesso" ? CheckCircle2 : AlertCircle;
  return (
    <div className={`ee-toast ${tipo}`}>
      <Icon size={15} />
      {msg}
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   MODAL: Nova Entrada de Estoque
   ══════════════════════════════════════════════════════ */
function ModalEntrada({ uid, produtos, fornecedores, movimento, onSalvo, onClose }) {
   
  const FORM_INICIAL = {
    produtoId:   "",
    quantidade:  "",
    motivo:      "",
    fornecedor:  "",
    data:        hoje(),
    observacao:  "",
    custo:       "",
  };

  const isEditing = !!movimento;

const [form, setForm] = useState(() => isEditing ? {
        produtoId: movimento.produtoId,
        quantidade: String(movimento.quantidade),
        motivo: movimento.motivo,
        fornecedor: movimento.fornecedor || "",
        data: movimento.data,
        observacao: movimento.observacao || "",
        custo: movimento.custo ?? "",
      }
    : FORM_INICIAL
);

  /* Produto selecionado atual */
  const produtoSelecionado = useMemo(
    () => produtos.find((p) => p.id === form.produtoId) || null,
    [form.produtoId, produtos]
  );

  /* Cálculo em tempo real */
  const estoqueAtual  = produtoSelecionado?.estoque ?? 0;
  const qtdAdd        = Math.max(0, Number(form.quantidade) || 0);
  const novoEstoque   = calcularNovoEstoque(estoqueAtual, qtdAdd);

   const oldQuantidade = isEditing ? Number(movimento.quantidade) || 0 : 0;
const qtdForm = Math.max(0, Number(form.quantidade) || 0);
const delta = qtdForm - oldQuantidade;
const novoEstoque = Math.max(0, estoqueAtual + delta);

  /* ── set helper ── */
  const set = (campo, valor) => {
    setForm((f) => ({ ...f, [campo]: valor }));
    if (erros[campo]) setErros((e) => ({ ...e, [campo]: "" }));
    setErrGlobal("");
  };

  /* ── buscarProduto (exposto para uso externo se necessário) ── */
  const buscarProduto = useCallback(
    async (id) => {
      if (!id || !uid) return null;
      try {
        const snap = await getDoc(doc(db, "users", uid, "produtos", id));
        return snap.exists() ? { id: snap.id, ...snap.data() } : null;
      } catch (err) {
        console.error("Erro ao buscar produto:", err);
        return null;
      }
    },
    [uid]
  );

  /* ── Validações ── */
  const validar = () => {
    const e = {};
    if (!form.produtoId)               e.produtoId  = "Selecione um produto.";
    if (!form.quantidade || Number(form.quantidade) <= 0)
                                       e.quantidade = "Informe uma quantidade maior que zero.";
    if (!form.motivo)                  e.motivo     = "Selecione o motivo.";
    if (!form.data)                    e.data       = "Data inválida.";
    if (form.custo !== "" && Number(form.custo) < 0)
                                       e.custo      = "Custo não pode ser negativo.";
    setErros(e);
    return Object.keys(e).length === 0;
  };

  /* ── handleSubmit ── */
  const handleSubmit = async () => {
    if (!validar() || salvando) return;
    setSalvando(true);
    setErrGlobal("");

    try {
      const produtoRef = doc(db, "users", uid, "produtos", form.produtoId);
      const movCol     = collection(db, "users", uid, "movimentacoes_estoque");

      /* Transação atômica: evita race conditions de estoque */
     const oldQtd = isEditing ? Number(movimento.quantidade) || 0 : 0;
const newQtd = Number(form.quantidade) || 0;

const delta = newQtd - oldQtd;

const estoqueReal = prodSnap.data().estoque ?? 0;

const quantidadeFinal = isEditing ? delta : newQtd;

const novoEst = Math.max(0, estoqueReal + quantidadeFinal);

        /* 1. Atualiza estoque (e custo, se informado) */
        const updateProduto = { estoque: novoEst };
        if (form.custo !== "" && !isNaN(Number(form.custo))) {
          updateProduto.custo = Number(form.custo);
        }
        tx.update(produtoRef, updateProduto);

        /* 2. Cria registro de movimentação */
        const movRef = isEditing
  ? doc(db, "users", uid, "movimentacoes_estoque", movimento.id)
  : doc(movCol);
        tx.set(movRef, {
  produtoId: sanitize(form.produtoId),
  produtoNome: sanitize(prodSnap.data().nome || ""),
  quantidade: Number(form.quantidade),
  tipo: "entrada",
  motivo: sanitize(form.motivo),
  fornecedor: sanitize(form.fornecedor) || null,
  observacao: sanitize(form.observacao) || null,
  data: sanitize(form.data),
  custo: form.custo !== "" ? Number(form.custo) : null,
  estoqueAnterior: estoqueReal,
  estoqueNovo: novoEst,
  dataAtualizacao: serverTimestamp(),
}, { merge: true });
      

      onSalvo("Entrada registrada com sucesso!");
      onClose();
    
      console.error("Erro ao salvar entrada:", err);
      setErrGlobal(err.message || "Erro ao salvar. Tente novamente.");
    
      setSalvando(false);
    
  

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">

        {/* Header */}
        <div className="modal-header">
          <div>
            <div className="modal-title">Registrar Entrada de Estoque</div>
            <div className="modal-sub">Informe os dados da movimentação de entrada</div>
          </div>
          <button className="modal-close" onClick={onClose}>
            <X size={14} color="var(--text-2)" />
          </button>
        </div>

        <div className="modal-body">

          {/* Produto */}
          <div className="form-group">
            <label className="form-label">
              Produto <span className="form-label-req">*</span>
            </label>
            <select
              className={`form-input ${erros.produtoId ? "err" : ""}`}
              value={form.produtoId}
              onChange={(e) => set("produtoId", e.target.value)}
            >
              <option value="">Selecione um produto...</option>
              {produtos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome} {p.sku ? `(${p.sku})` : ""}
                </option>
              ))}
            </select>
            {erros.produtoId && <div className="form-error">{erros.produtoId}</div>}
          </div>

          {/* Preview de estoque em tempo real */}
          {produtoSelecionado && (
            <div className="ee-preview">
              <div className="ee-preview-card">
                <div className="ee-preview-label">Estoque Atual</div>
                <div className="ee-preview-val atual">{estoqueAtual}</div>
              </div>
              <div className="ee-preview-card">
                <div className="ee-preview-label">Adicionando</div>
                <div className="ee-preview-val add">+{qtdAdd}</div>
              </div>
              <div className="ee-preview-card">
                <div className="ee-preview-label">Novo Estoque</div>
                <div className="ee-preview-val novo">{novoEstoque}</div>
              </div>
            </div>
          )}

          {/* Quantidade + Data */}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">
                Quantidade <span className="form-label-req">*</span>
              </label>
              <input
                type="number"
                min="1"
                step="1"
                className={`form-input ${erros.quantidade ? "err" : ""}`}
                value={form.quantidade}
                onChange={(e) => set("quantidade", e.target.value)}
                placeholder="0"
              />
              {erros.quantidade && <div className="form-error">{erros.quantidade}</div>}
            </div>
            <div className="form-group">
              <label className="form-label">
                Data <span className="form-label-req">*</span>
              </label>
              <input
                type="date"
                className={`form-input ${erros.data ? "err" : ""}`}
                value={form.data}
                onChange={(e) => set("data", e.target.value)}
              />
              {erros.data && <div className="form-error">{erros.data}</div>}
            </div>
          </div>

          {/* Motivo */}
          <div className="form-group">
            <label className="form-label">
              Motivo <span className="form-label-req">*</span>
            </label>
            <select
              className={`form-input ${erros.motivo ? "err" : ""}`}
              value={form.motivo}
              onChange={(e) => set("motivo", e.target.value)}
            >
              <option value="">Selecione o motivo...</option>
              {MOTIVOS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            {erros.motivo && <div className="form-error">{erros.motivo}</div>}
          </div>

          {/* Fornecedor + Custo */}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Fornecedor</label>
              <select
                className="form-input"
                value={form.fornecedor}
                onChange={(e) => set("fornecedor", e.target.value)}
              >
                <option value="">Nenhum</option>
                {fornecedores.map((f) => (
                  <option key={f.id} value={f.nome || f.id}>
                    {f.nome}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Custo unitário (R$)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className={`form-input ${erros.custo ? "err" : ""}`}
                value={form.custo}
                onChange={(e) => set("custo", e.target.value)}
                placeholder="0,00"
              />
              {erros.custo && <div className="form-error">{erros.custo}</div>}
            </div>
          </div>

          {/* Observação */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Observação</label>
            <textarea
              className="form-input"
              rows={2}
              style={{ resize: "vertical", minHeight: 60 }}
              value={form.observacao}
              onChange={(e) => set("observacao", e.target.value)}
              placeholder="Informações adicionais (opcional)..."
            />
          </div>

          {/* Erro global */}
          {errGlobal && (
            <div
              style={{
                marginTop: 14, display: "flex", alignItems: "center", gap: 7,
                background: "var(--red-d, rgba(224,82,82,0.1))",
                border: "1px solid rgba(224,82,82,0.25)",
                borderRadius: 8, padding: "9px 13px",
                color: "var(--red)", fontSize: 12,
              }}
            >
              <AlertCircle size={14} />
              {errGlobal}
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose} disabled={salvando}>
            Cancelar
          </button>
          <button className="btn-primary" onClick={handleSubmit} disabled={salvando}>
            {salvando ? <><div className="spinner" /> Salvando...</> : <><PackagePlus size={14} /> Registrar Entrada</>}
          </button>
        </div>

      </div>
    </div>
  );


/* ══════════════════════════════════════════════════════
   FUNÇÃO PURA: Calcular novo estoque
   ══════════════════════════════════════════════════════ */
function calcularNovoEstoque(estoqueAtual, quantidade) {
  return Math.max(0, Number(estoqueAtual || 0) + Number(quantidade || 0));
}

/* ══════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL: EntradaEstoque
   ══════════════════════════════════════════════════════ */
export default function EntradaEstoque() {
   const [movimentoEditar, setMovimentoEditar] = useState(null);
const [movimentoExcluir, setMovimentoExcluir] = useState(null);
  const [uid, setUid]                 = useState(null);
  const [produtos, setProdutos]       = useState([]);
  const [fornecedores, setFornecedores] = useState([]);
  const [movimentacoes, setMovimentacoes] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState("");
  const [modalAberto, setModalAberto] = useState(false);
   const handleEditar = (mov) => {
  setMovimentoEditar(mov);
  setModalAberto(true);
};
const handleExcluir = (mov) => {
  setMovimentoExcluir(mov);
};

   const confirmarExclusao = async () => {
  if (!movimentoExcluir) return;

  try {
    const mov = movimentoExcluir;

    const movRef = doc(db, "users", uid, "movimentacoes_estoque", mov.id);
    const produtoRef = doc(db, "users", uid, "produtos", mov.produtoId);

    await runTransaction(db, async (tx) => {
      const prodSnap = await tx.get(produtoRef);
      if (!prodSnap.exists()) throw new Error("Produto não encontrado.");

      const estoqueReal = prodSnap.data().estoque ?? 0;

      // 🔥 regra correta
      const novoEstoque = Math.max(0, estoqueReal - mov.quantidade);

      tx.update(produtoRef, { estoque: novoEstoque });
      tx.delete(movRef);
    });

    showToast("Entrada excluída com sucesso!");
    setMovimentoExcluir(null);

  } catch (err) {
    console.error(err);
    showToast("Erro ao excluir: " + err.message, "erro");
  }
};
   
  /* Toast */
  const [toast, setToast] = useState({ msg: "", tipo: "sucesso" });
  const showToast = (msg, tipo = "sucesso") => {
    setToast({ msg, tipo });
    setTimeout(() => setToast({ msg: "", tipo: "sucesso" }), 3500);
  };

  /* ── Auth ── */
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => setUid(user?.uid || null));
    return unsub;
  }, []);

  /* ── Firestore: escuta em tempo real ── */
  useEffect(() => {
    if (!uid) { setLoading(false); return; }

    const produtosCol      = collection(db, "users", uid, "produtos");
    const fornecedoresCol  = collection(db, "users", uid, "fornecedores");
    const movCol           = collection(db, "users", uid, "movimentacoes_estoque");

    const unsubP = onSnapshot(produtosCol, (snap) => {
      setProdutos(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    const unsubF = onSnapshot(fornecedoresCol, (snap) => {
      setFornecedores(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    const unsubM = onSnapshot(movCol, (snap) => {
      const entradas = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((m) => m.tipo === "entrada")
        .sort((a, b) => {
          const da = a.dataCriacao?.toMillis?.() ?? 0;
          const db_ = b.dataCriacao?.toMillis?.() ?? 0;
          return db_ - da;
        });
      setMovimentacoes(entradas);
      setLoading(false);
    });

    return () => { unsubP(); unsubF(); unsubM(); };
  }, [uid]);

  /* ── Filtro de busca ── */
  const movFiltradas = useMemo(() => {
    if (!search.trim()) return movimentacoes;
    const q = search.toLowerCase();
    return movimentacoes.filter(
      (m) =>
        m.produtoNome?.toLowerCase().includes(q) ||
        m.motivo?.toLowerCase().includes(q) ||
        m.fornecedor?.toLowerCase().includes(q)
    );
  }, [movimentacoes, search]);

  if (!uid)
    return <div className="ee-loading">Carregando autenticação...</div>;

  return (
    <>
      <style>{CSS}</style>

      {/* Topbar */}
      <header className="ee-topbar">
        <div className="ee-topbar-title">
          <h1>Entrada de Estoque</h1>
          <p>Registre e acompanhe as entradas de produtos</p>
        </div>

        <div className="ee-search">
          <Search size={13} color="var(--text-3)" />
          <input
            placeholder="Buscar por produto, motivo ou fornecedor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <button className="btn-entrada" onClick={() => setModalAberto(true)}>
          <PackagePlus size={14} /> Registrar Entrada
        </button>
      </header>

      {/* Conteúdo */}
      <div className="ag-content">
        <div className="ee-table-wrap">
          <div className="ee-table-header">
            <span className="ee-table-title">Histórico de Entradas</span>
            <span className="ee-count-badge">{movimentacoes.length}</span>
          </div>

          {/* Cabeçalho da tabela */}
          <div className="ee-row ee-row-head">
            <span>Data</span>
            <span>Produto</span>
            <span>Qtd</span>
            <span>Motivo</span>
            <span>Custo Unit.</span>
            <span>Observação</span>
          </div>

          {loading ? (
            <div className="ee-loading">Carregando movimentações...</div>
          ) : movFiltradas.length === 0 ? (
            <div className="ee-empty">
              Nenhuma entrada registrada ainda.
            </div>
          ) : (
            movFiltradas.map((m) => (
              <div key={m.id} className="ee-row">
                <span className="ee-data">{fmtData(m.data)}</span>
                <span className="ee-nome">{m.produtoNome || m.produtoId}</span>
                <span className="ee-qtd">+{m.quantidade}</span>
                <span className="ee-motivo">{m.motivo}</span>
                <span className="ee-custo">{fmtR$(m.custo)}</span>
                <span className="ee-obs">{m.observacao || "—"}</span>
                  <span style={{ display: "flex", gap: 8 }}>
                 <button onClick={() => handleEditar(m)}>Editar</button>
                 <button onClick={() => handleExcluir(m)}>Excluir</button>
</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modal */}
      {modalAberto && (
        <ModalEntrada
  uid={uid}
  produtos={produtos}
  fornecedores={fornecedores}
  movimento={movimentoEditar}
  onSalvo={(msg) => showToast(msg, "sucesso")}
  onClose={() => {
    setModalAberto(false);
    setMovimentoEditar(null);
  }}
/>
      )}

      {/* Toast de feedback */}
      <Toast msg={toast.msg} tipo={toast.tipo} />
   
     {movimentoExcluir && (
  <div className="modal-overlay">
    <div className="modal-box">
      <div className="modal-header">
        <div className="modal-title">Confirmar exclusão</div>
      </div>

      <div className="modal-body">
        Deseja excluir esta entrada?
      </div>

      <div className="modal-footer">
        <button onClick={() => setMovimentoExcluir(null)}>
          Cancelar
        </button>
        <button onClick={confirmarExclusao}>
          Excluir 
        </button>
         
      </div>
    </div>
  </div>
       
)}
  );
}
