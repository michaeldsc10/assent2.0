/* ═══════════════════════════════════════════════════
   ASSENT v2.0 — EntradaEstoque.jsx
   Módulo: Entrada + Saída de Estoque
   ═══════════════════════════════════════════════════ */

import { useState, useEffect, useMemo } from "react";
import {
  PackagePlus, PackageMinus, Search, X, AlertCircle, CheckCircle2,
  Edit2, Trash2, ArrowDownCircle, ArrowUpCircle, Eye,
} from "lucide-react";
import { db } from "../lib/firebase";
import {
  collection, doc, onSnapshot,
  serverTimestamp, runTransaction,
} from "firebase/firestore";
import { useAuth } from "../contexts/AuthContext"; // ← usa o contexto correto
import { logAction, LOG_ACAO, LOG_MODULO } from "../lib/logAction";

/* ══════════════════════════════════════════════════════
   CSS
   ══════════════════════════════════════════════════════ */
const CSS = `
  .modal-overlay {
    position: fixed; inset: 0; z-index: 1000;
    background: rgba(0,0,0,0.78); backdrop-filter: blur(5px);
    display: flex; align-items: center; justify-content: center;
    padding: 20px; animation: fadeIn .15s ease;
  }
  .modal-overlay-top { z-index: 1100; }
  @keyframes fadeIn { from { opacity:0 } to { opacity:1 } }
  @keyframes slideUp {
    from { opacity:0; transform:translateY(14px) }
    to   { opacity:1; transform:translateY(0) }
  }

  .modal-box {
    background: var(--s1); border: 1px solid var(--border-h);
    border-radius: 16px; width: 100%; max-width: 560px;
    max-height: 92vh; overflow-y: auto;
    box-shadow: 0 28px 72px rgba(0,0,0,0.65);
    animation: slideUp .18s ease;
  }
  .modal-box-md { max-width: 400px; }
  .modal-box::-webkit-scrollbar { width: 3px; }
  .modal-box::-webkit-scrollbar-thumb { background: var(--text-3); border-radius: 2px; }

  .modal-header {
    padding: 20px 22px 16px; border-bottom: 1px solid var(--border);
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
  .form-group { margin-bottom: 16px; }
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
    appearance: none; box-sizing: border-box;
  }
  .form-input:focus { border-color: var(--gold); box-shadow: 0 0 0 3px rgba(200,165,94,0.1); }
  .form-input.err   { border-color: var(--red); }
  .form-input.err:focus { box-shadow: 0 0 0 3px rgba(224,82,82,0.1); }
  .form-input:disabled { opacity: .5; cursor: not-allowed; }
  .form-error { font-size: 11px; color: var(--red); margin-top: 5px; }
  .form-row   { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }

  /* ── Botões ── */
  .btn-primary {
    padding: 9px 20px; border-radius: 9px;
    background: var(--gold); color: #0a0808;
    border: none; cursor: pointer;
    font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 600;
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
  .btn-secondary:disabled { opacity: .5; cursor: not-allowed; }

  .btn-danger {
    padding: 9px 20px; border-radius: 9px;
    background: rgba(224,82,82,0.12); color: var(--red, #e05252);
    border: 1px solid rgba(224,82,82,.25); cursor: pointer;
    font-family: 'DM Sans', sans-serif; font-size: 13px;
    transition: background .13s;
    display: flex; align-items: center; gap: 6px;
  }
  .btn-danger:hover    { background: rgba(224,82,82,.18); }
  .btn-danger:disabled { opacity: .5; cursor: not-allowed; }

  .btn-entrada {
    display: flex; align-items: center; gap: 7px;
    padding: 8px 16px; border-radius: 9px;
    background: rgba(52,199,89,0.12); color: var(--green, #34c759);
    border: 1px solid rgba(52,199,89,0.25); cursor: pointer;
    font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 600;
    white-space: nowrap; transition: background .13s;
  }
  .btn-entrada:hover { background: rgba(52,199,89,0.2); }

  .btn-saida {
    display: flex; align-items: center; gap: 7px;
    padding: 8px 16px; border-radius: 9px;
    background: rgba(224,82,82,0.12); color: var(--red, #e05252);
    border: 1px solid rgba(224,82,82,0.25); cursor: pointer;
    font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 600;
    white-space: nowrap; transition: background .13s;
  }
  .btn-saida:hover { background: rgba(224,82,82,0.2); }

  .btn-icon {
    width: 30px; height: 30px; border-radius: 7px;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; border: 1px solid transparent;
    background: transparent; transition: all .13s;
  }
  .btn-icon-edit { color: var(--blue, #5b8ef0); }
  .btn-icon-edit:hover { background: rgba(91,142,240,0.12); border-color: rgba(91,142,240,.2); }
  .btn-icon-del  { color: var(--red, #e05252); }
  .btn-icon-del:hover  { background: rgba(224,82,82,0.12); border-color: rgba(224,82,82,.2); }

  /* ── Topbar ── */
  .ee-topbar {
    padding: 14px 22px; background: var(--s1); border-bottom: 1px solid var(--border);
    display: flex; align-items: center; gap: 14px; flex-shrink: 0; flex-wrap: wrap;
  }
  .ee-topbar-title h1 {
    font-family: 'Sora', sans-serif; font-size: 17px; font-weight: 600; color: var(--text);
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

  /* ── Abas ── */
  .ee-tabs {
    display: flex; gap: 0; border-bottom: 1px solid var(--border);
    padding: 0 22px; background: var(--s1);
  }
  .ee-tab {
    display: flex; align-items: center; gap: 7px;
    padding: 11px 16px; font-size: 13px; font-weight: 500;
    color: var(--text-3); cursor: pointer; border: none;
    background: transparent; border-bottom: 2px solid transparent;
    margin-bottom: -1px; transition: color .13s, border-color .13s;
    font-family: 'DM Sans', sans-serif;
  }
  .ee-tab:hover { color: var(--text-2); }
  .ee-tab.active-entrada { color: var(--green, #34c759); border-bottom-color: var(--green, #34c759); }
  .ee-tab.active-saida   { color: var(--red, #e05252);   border-bottom-color: var(--red, #e05252); }

  /* ── Tabela ── */
  .ee-table-wrap {
    background: var(--s1); border: 1px solid var(--border);
    border-radius: 12px; overflow: hidden;
  }
  .ee-table-header {
    padding: 13px 18px; border-bottom: 1px solid var(--border);
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

  /* ── Linha entrada ── */
  .ee-row-entrada {
    display: grid;
    grid-template-columns: 100px 1fr 72px 130px 100px 1fr 72px;
    padding: 11px 18px; gap: 8px;
    border-bottom: 1px solid var(--border);
    align-items: center; font-size: 12px; color: var(--text-2);
  }
  /* ── Linha saída (tem coluna Registrado Por no lugar de Custo) ── */
  .ee-row-saida {
    display: grid;
    grid-template-columns: 100px 1fr 72px 130px 1fr 72px;
    padding: 11px 18px; gap: 8px;
    border-bottom: 1px solid var(--border);
    align-items: center; font-size: 12px; color: var(--text-2);
  }
  .ee-row-entrada:last-child,
  .ee-row-saida:last-child { border-bottom: none; }
  .ee-row-entrada:hover,
  .ee-row-saida:hover { background: rgba(255,255,255,0.02); }
  .ee-row-head { background: var(--s2); }
  .ee-row-head span {
    font-size: 10px; font-weight: 500; letter-spacing: .06em;
    text-transform: uppercase; color: var(--text-3);
  }

  .ee-data   { font-family:'Sora',sans-serif; font-size:11px; color:var(--gold); font-weight:500; }
  .ee-nome   { color:var(--text); font-size:13px; font-weight:500; }
  .ee-qtd-in  { font-family:'Sora',sans-serif; font-size:13px; font-weight:600; color:var(--green,#34c759); }
  .ee-qtd-out { font-family:'Sora',sans-serif; font-size:13px; font-weight:600; color:var(--red,#e05252); }
  .ee-motivo {
    background:var(--s3); border:1px solid var(--border); border-radius:5px;
    padding:2px 8px; font-size:11px; color:var(--text-2);
    white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
  }
  .ee-motivo-saida {
    background:rgba(224,82,82,0.08); border:1px solid rgba(224,82,82,0.2); border-radius:5px;
    padding:2px 8px; font-size:11px; color:var(--red,#e05252);
    white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
  }
  .ee-custo  { color:var(--red,#e05252); font-size:12px; }
  .ee-obs    { font-size:11px; color:var(--text-3); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .ee-actions { display:flex; align-items:center; gap:5px; justify-content:flex-end; }

  /* ── Log de responsável ── */
  .ee-log {
    display: flex; flex-direction: column; gap: 1px;
  }
  .ee-log-nome { font-size: 12px; color: var(--text); font-weight: 500; }
  .ee-log-cargo {
    font-size: 10px; color: var(--text-3); font-weight: 500;
    text-transform: uppercase; letter-spacing: .05em;
  }

  .ee-empty, .ee-loading {
    padding: 56px 20px; text-align: center; color: var(--text-3); font-size: 13px;
  }

  /* ── Preview estoque ── */
  .ee-preview {
    display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin: 16px 0;
  }
  .ee-preview-card {
    background: var(--s2); border: 1px solid var(--border);
    border-radius: 10px; padding: 12px 14px; text-align: center;
  }
  .ee-preview-label {
    font-size: 10px; font-weight: 600; letter-spacing: .07em;
    text-transform: uppercase; color: var(--text-3); margin-bottom: 6px;
  }
  .ee-preview-val { font-family:'Sora',sans-serif; font-size:20px; font-weight:700; }
  .ee-preview-val.atual { color: var(--text-2); }
  .ee-preview-val.add   { color: var(--blue, #5b8ef0); }
  .ee-preview-val.novo  { color: var(--green, #34c759); }
  .ee-preview-val.sub   { color: var(--red, #e05252); }

  /* ── Aviso de edição ── */
  .ee-edit-warn {
    display: flex; align-items: flex-start; gap: 8px;
    background: rgba(200,165,94,0.08); border: 1px solid rgba(200,165,94,0.2);
    border-radius: 8px; padding: 10px 13px; margin-bottom: 16px;
    font-size: 12px; color: var(--text-2); line-height: 1.5;
  }

  /* ── Confirm body ── */
  .confirm-body { padding: 24px 22px; text-align: center; }
  .confirm-body p { font-size: 13px; color: var(--text-2); line-height: 1.6; }
  .confirm-body strong { color: var(--text); }

  /* ── Toast ── */
  .ee-toast {
    position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
    z-index: 9999; display: flex; align-items: center; gap: 9px;
    padding: 12px 18px; border-radius: 10px;
    font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 500;
    box-shadow: 0 8px 32px rgba(0,0,0,0.4);
    animation: slideUp .2s ease; pointer-events: none;
  }
  .ee-toast.sucesso { background:rgba(52,199,89,0.15); border:1px solid rgba(52,199,89,0.3); color:var(--green,#34c759); }
  .ee-toast.erro    { background:rgba(224,82,82,0.12);  border:1px solid rgba(224,82,82,0.3);  color:var(--red,#e05252); }

  /* ── Spinner ── */
  @keyframes spin { to { transform: rotate(360deg); } }
  .spinner {
    width:13px; height:13px; border-radius:50%;
    border:2px solid rgba(10,8,8,0.2); border-top-color:#0a0808;
    animation:spin .6s linear infinite; flex-shrink:0;
  }
  .spinner-red { border:2px solid rgba(224,82,82,0.2); border-top-color:var(--red,#e05252); }

  /* ── Erro inline ── */
  .err-box {
    margin-top:14px; display:flex; align-items:center; gap:7px;
    background:rgba(224,82,82,0.1); border:1px solid rgba(224,82,82,0.25);
    border-radius:8px; padding:9px 13px; color:var(--red,#e05252); font-size:12px;
  }

  /* ── Linha clicável ── */
  .ee-row-saida.clickable { cursor: pointer; }
  .ee-row-saida.clickable:hover { background: rgba(224,82,82,0.04); }

  /* ── Modal de detalhes da saída ── */
  .det-grid {
    display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px;
  }
  .det-card {
    background: var(--s2); border: 1px solid var(--border);
    border-radius: 10px; padding: 12px 14px;
  }
  .det-label {
    font-size: 10px; font-weight: 600; letter-spacing: .07em;
    text-transform: uppercase; color: var(--text-3); margin-bottom: 5px;
  }
  .det-val { font-size: 13px; color: var(--text); font-weight: 500; }
  .det-val-red { font-size: 18px; font-weight: 700; color: var(--red,#e05252); font-family:'Sora',sans-serif; }
  .det-val-muted { font-size: 13px; color: var(--text-2); }

  .det-motivo-badge {
    display: inline-flex; align-items: center;
    background: rgba(224,82,82,0.1); border: 1px solid rgba(224,82,82,0.25);
    border-radius: 6px; padding: 4px 10px;
    font-size: 12px; color: var(--red,#e05252); font-weight: 500;
  }

  .det-obs-box {
    background: var(--s2); border: 1px solid var(--border);
    border-radius: 10px; padding: 12px 14px; margin-bottom: 16px;
  }

  .det-responsavel {
    display: flex; align-items: center; gap: 12px;
    background: var(--s2); border: 1px solid var(--border);
    border-radius: 10px; padding: 14px;
  }
  .det-avatar {
    width: 36px; height: 36px; border-radius: 10px; flex-shrink: 0;
    background: rgba(224,82,82,0.12); border: 1px solid rgba(224,82,82,0.2);
    display: flex; align-items: center; justify-content: center;
    font-family: 'Sora', sans-serif; font-size: 14px; font-weight: 700;
    color: var(--red,#e05252);
  }
  .det-resp-nome { font-size: 13px; font-weight: 600; color: var(--text); }
  .det-resp-cargo {
    font-size: 10px; font-weight: 600; letter-spacing: .07em;
    text-transform: uppercase; color: var(--text-3); margin-top: 2px;
  }

  .det-divider {
    border: none; border-top: 1px solid var(--border); margin: 16px 0;
  }

  .btn-icon-view { color: var(--text-3); }
  .btn-icon-view:hover { background: var(--s2); border-color: var(--border); color: var(--text-2); }
`;

/* ══════════════════════════════════════════════════════
   HELPERS
   ══════════════════════════════════════════════════════ */
const hoje     = () => new Date().toISOString().slice(0, 10);
const num      = (v) => Number(v) || 0;
const sanitize = (s) => typeof s === "string" ? s.trim() : s;

const fmtR$ = (v) =>
  v != null && v !== ""
    ? `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
    : "—";

const fmtData = (d) => {
  if (!d) return "—";
  try {
    const dt = d?.toDate ? d.toDate() : new Date(d + "T00:00:00");
    return dt.toLocaleDateString("pt-BR");
  } catch { return String(d); }
};

const MOTIVOS_ENTRADA = [
  "Compra de fornecedor",
  "Ajuste de estoque",
  "Devolução de cliente",
  "Transferência entre locais",
  "Produção interna",
  "Outros",
];

const MOTIVOS_SAIDA = [
  "Devolução ao fornecedor",
  "Doação",
  "Vencimento / Validade expirada",
  "Outros",
];

/* Label legível para cargo */
const CARGO_LABELS = {
  admin:       "Admin",
  financeiro:  "Financeiro",
  comercial:   "Comercial",
  compras:     "Compras",
  operacional: "Operacional",
  vendedor:    "Vendedor",
  suporte:     "Suporte",
};

/* ══════════════════════════════════════════════════════
   TOAST
   ══════════════════════════════════════════════════════ */
function Toast({ msg, tipo }) {
  if (!msg) return null;
  const Icon = tipo === "sucesso" ? CheckCircle2 : AlertCircle;
  return (
    <div className={`ee-toast ${tipo}`}>
      <Icon size={15} /> {msg}
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   MODAL: Criar / Editar Entrada
   ══════════════════════════════════════════════════════ */
function ModalEntrada({ tenantUid, produtos, fornecedores, movimentacao, onSalvo, onClose }) {
  const isEdit = !!movimentacao;

  const [form, setForm] = useState({
    produtoId:  movimentacao?.produtoId  ?? "",
    quantidade: movimentacao?.quantidade != null ? String(movimentacao.quantidade) : "",
    motivo:     movimentacao?.motivo     ?? "",
    fornecedor: movimentacao?.fornecedor ?? "",
    data:       movimentacao?.data       ?? hoje(),
    observacao: movimentacao?.observacao ?? "",
    custo:      movimentacao?.custo      != null ? String(movimentacao.custo) : "",
  });
  const [erros, setErros]         = useState({});
  const [salvando, setSalvando]   = useState(false);
  const [errGlobal, setErrGlobal] = useState("");

  const produtoSelecionado = useMemo(
    () => produtos.find((p) => p._docId === form.produtoId) || null,
    [form.produtoId, produtos]
  );

  const baseEstoque = isEdit
    ? Math.max(0, num(produtoSelecionado?.estoque) - num(movimentacao.quantidade))
    : num(produtoSelecionado?.estoque);
  const qtdNova  = Math.max(0, num(form.quantidade));
  const prevNovo = baseEstoque + qtdNova;

  const set = (campo, valor) => {
    setForm((f) => ({ ...f, [campo]: valor }));
    if (erros[campo]) setErros((e) => ({ ...e, [campo]: "" }));
    setErrGlobal("");
  };

  const validar = () => {
    const e = {};
    if (!form.produtoId)                               e.produtoId  = "Selecione um produto.";
    if (!form.quantidade || num(form.quantidade) <= 0) e.quantidade = "Quantidade deve ser maior que zero.";
    if (!form.motivo)                                  e.motivo     = "Selecione o motivo.";
    if (!form.data)                                    e.data       = "Data inválida.";
    if (form.custo !== "" && num(form.custo) < 0)      e.custo      = "Custo não pode ser negativo.";
    setErros(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validar() || salvando) return;
    setSalvando(true);
    setErrGlobal("");

    try {
      const prodObj    = produtos.find((p) => p.id === form.produtoId || p._docId === form.produtoId);
      const prodDocId  = prodObj?._docId || form.produtoId;
      const produtoRef = doc(db, "users", tenantUid, "produtos", prodDocId);

      if (isEdit) {
        const movRef = doc(db, "users", tenantUid, "movimentacoes_estoque", movimentacao.id);
        await runTransaction(db, async (tx) => {
          const [prodSnap, movSnap] = await Promise.all([tx.get(produtoRef), tx.get(movRef)]);
          if (!prodSnap.exists()) throw new Error("Produto não encontrado.");
          if (!movSnap.exists())  throw new Error("Movimentação não encontrada.");

          const estoqueReal = num(prodSnap.data().estoque);
          const qtdAntiga   = num(movSnap.data().quantidade);
          const qtdN        = num(form.quantidade);
          const novoEst     = Math.max(0, estoqueReal - qtdAntiga + qtdN);

          const atualizaProduto = { estoque: novoEst };
          if (form.custo !== "" && !isNaN(num(form.custo))) atualizaProduto.custo = num(form.custo);
          tx.update(produtoRef, atualizaProduto);

          tx.update(movRef, {
            produtoNome:     sanitize(prodSnap.data().nome || ""),
            quantidade:      qtdN,
            motivo:          sanitize(form.motivo),
            fornecedor:      sanitize(form.fornecedor) || null,
            observacao:      sanitize(form.observacao) || null,
            data:            sanitize(form.data),
            custo:           form.custo !== "" ? num(form.custo) : null,
            dataAtualizacao: serverTimestamp(),
            estoqueNovo:     novoEst,
          });
        });
        await logAction({ tenantUid, nomeUsuario: "—", cargo: "—", acao: LOG_ACAO.EDITAR, modulo: LOG_MODULO.ENTRADA_ESTOQUE, descricao: `Editou entrada de ${form.quantidade} un. de ${produtos.find(p=>p._docId===form.produtoId||p.id===form.produtoId)?.nome||form.produtoId}` });
        onSalvo("Entrada atualizada com sucesso!");
      } else {
        const movRef = doc(collection(db, "users", tenantUid, "movimentacoes_estoque"));
        await runTransaction(db, async (tx) => {
          const prodSnap = await tx.get(produtoRef);
          if (!prodSnap.exists()) throw new Error("Produto não encontrado.");

          const estoqueReal = num(prodSnap.data().estoque);
          const qtdN        = estoqueReal + num(form.quantidade);

          const atualizaProduto = { estoque: qtdN };
          if (form.custo !== "" && !isNaN(num(form.custo))) atualizaProduto.custo = num(form.custo);
          tx.update(produtoRef, atualizaProduto);

          tx.set(movRef, {
            produtoId:       prodDocId,
            produtoNome:     sanitize(prodSnap.data().nome || ""),
            quantidade:      num(form.quantidade),
            tipo:            "entrada",
            motivo:          sanitize(form.motivo),
            fornecedor:      sanitize(form.fornecedor) || null,
            observacao:      sanitize(form.observacao) || null,
            data:            sanitize(form.data),
            dataCriacao:     serverTimestamp(),
            custo:           form.custo !== "" ? num(form.custo) : null,
            uid:             tenantUid,
            estoqueAnterior: estoqueReal,
            estoqueNovo:     qtdN,
          });
        });
        await logAction({ tenantUid, nomeUsuario: "—", cargo: "—", acao: LOG_ACAO.CRIAR, modulo: LOG_MODULO.ENTRADA_ESTOQUE, descricao: `Registrou entrada de ${form.quantidade} un. de ${produtos.find(p=>p._docId===form.produtoId||p.id===form.produtoId)?.nome||form.produtoId}` });
        onSalvo("Entrada registrada com sucesso!");
      }
      onClose();
    } catch (err) {
      console.error("Erro ao salvar entrada:", err);
      setErrGlobal(err.message || "Erro ao salvar. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <div className="modal-header">
          <div>
            <div className="modal-title">
              {isEdit ? "Editar Entrada de Estoque" : "Registrar Entrada de Estoque"}
            </div>
            <div className="modal-sub">
              {isEdit
                ? `Editando movimentação de ${fmtData(movimentacao.data)}`
                : "Informe os dados da movimentação"}
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>
            <X size={14} color="var(--text-2)" />
          </button>
        </div>

        <div className="modal-body">
          {isEdit && (
            <div className="ee-edit-warn">
              <AlertCircle size={14} color="var(--gold)" style={{ flexShrink: 0, marginTop: 1 }} />
              <span>
                O estoque será recalculado pela diferença entre a quantidade anterior
                ({movimentacao.quantidade}) e a nova. O produto não pode ser trocado na edição.
              </span>
            </div>
          )}

          {/* Produto */}
          <div className="form-group">
            <label className="form-label">
              Produto <span className="form-label-req">*</span>
            </label>
            <select
              className={`form-input ${erros.produtoId ? "err" : ""}`}
              value={form.produtoId}
              onChange={(e) => set("produtoId", e.target.value)}
              disabled={isEdit}
            >
              <option value="">Selecione um produto...</option>
              {produtos.map((p) => (
                <option key={p._docId} value={p._docId}>
                  {p.nome}{p.sku ? ` (${p.sku})` : ""}
                </option>
              ))}
            </select>
            {erros.produtoId && <div className="form-error">{erros.produtoId}</div>}
          </div>

          {/* Preview em tempo real */}
          {produtoSelecionado && (
            <div className="ee-preview">
              <div className="ee-preview-card">
                <div className="ee-preview-label">Estoque Base</div>
                <div className="ee-preview-val atual">{baseEstoque}</div>
              </div>
              <div className="ee-preview-card">
                <div className="ee-preview-label">{isEdit ? "Nova Qtd" : "Adicionando"}</div>
                <div className="ee-preview-val add">+{qtdNova}</div>
              </div>
              <div className="ee-preview-card">
                <div className="ee-preview-label">Novo Estoque</div>
                <div className="ee-preview-val novo">{prevNovo}</div>
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
                type="number" min="1" step="1"
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
              {MOTIVOS_ENTRADA.map((m) => (
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
                  <option key={f.id} value={f.nome || f.id}>{f.nome}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Custo unitário (R$)</label>
              <input
                type="number" min="0" step="0.01"
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

          {errGlobal && (
            <div className="err-box">
              <AlertCircle size={14} /> {errGlobal}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose} disabled={salvando}>
            Cancelar
          </button>
          <button className="btn-primary" onClick={handleSubmit} disabled={salvando}>
            {salvando
              ? <><div className="spinner" /> Salvando...</>
              : isEdit
                ? <><Edit2 size={13} /> Salvar Alterações</>
                : <><PackagePlus size={14} /> Registrar Entrada</>}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   MODAL: Registrar Saída
   ──────────────────────────────────────────────────────
   Grava tipo:"saida" + registradoPor: { nome, cargo }
   Desconta do estoque atomicamente via runTransaction.
   ══════════════════════════════════════════════════════ */
function ModalSaida({ tenantUid, nomeUsuario, cargo, produtos, onSalvo, onClose }) {
  const [form, setForm] = useState({
    produtoId:  "",
    quantidade: "",
    motivo:     "",
    data:       hoje(),
    observacao: "",
  });
  const [erros, setErros]         = useState({});
  const [salvando, setSalvando]   = useState(false);
  const [errGlobal, setErrGlobal] = useState("");

  const produtoSelecionado = useMemo(
    () => produtos.find((p) => p._docId === form.produtoId) || null,
    [form.produtoId, produtos]
  );

  const estoqueAtual = num(produtoSelecionado?.estoque);
  const qtdSaida     = Math.max(0, num(form.quantidade));
  const prevNovo     = Math.max(0, estoqueAtual - qtdSaida);

  const set = (campo, valor) => {
    setForm((f) => ({ ...f, [campo]: valor }));
    if (erros[campo]) setErros((e) => ({ ...e, [campo]: "" }));
    setErrGlobal("");
  };

  const validar = () => {
    const e = {};
    if (!form.produtoId)                               e.produtoId  = "Selecione um produto.";
    if (!form.quantidade || num(form.quantidade) <= 0) e.quantidade = "Quantidade deve ser maior que zero.";
    if (produtoSelecionado && num(form.quantidade) > num(produtoSelecionado.estoque))
                                                       e.quantidade = "Quantidade maior que o estoque disponível.";
    if (!form.motivo)                                  e.motivo     = "Selecione o motivo.";
    if (!form.data)                                    e.data       = "Data inválida.";
    setErros(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validar() || salvando) return;
    setSalvando(true);
    setErrGlobal("");

    try {
      const prodObj    = produtos.find((p) => p.id === form.produtoId || p._docId === form.produtoId);
      const prodDocId  = prodObj?._docId || form.produtoId;
      const produtoRef = doc(db, "users", tenantUid, "produtos", prodDocId);
      const movRef     = doc(collection(db, "users", tenantUid, "movimentacoes_estoque"));

      await runTransaction(db, async (tx) => {
        const prodSnap = await tx.get(produtoRef);
        if (!prodSnap.exists()) throw new Error("Produto não encontrado.");

        const estoqueReal = num(prodSnap.data().estoque);
        const qtdN        = num(form.quantidade);

        if (qtdN > estoqueReal) throw new Error("Estoque insuficiente para realizar esta saída.");

        const novoEst = Math.max(0, estoqueReal - qtdN);
        tx.update(produtoRef, { estoque: novoEst });

        tx.set(movRef, {
          produtoId:       prodDocId,
          produtoNome:     sanitize(prodSnap.data().nome || ""),
          quantidade:      qtdN,
          tipo:            "saida",
          motivo:          sanitize(form.motivo),
          observacao:      sanitize(form.observacao) || null,
          data:            sanitize(form.data),
          dataCriacao:     serverTimestamp(),
          uid:             tenantUid,
          estoqueAnterior: estoqueReal,
          estoqueNovo:     novoEst,
          // ── Log do responsável ──
          registradoPor: {
            nome:  nomeUsuario || "Desconhecido",
            cargo: cargo       || "desconhecido",
          },
        });
      });

      await logAction({ tenantUid, nomeUsuario, cargo, acao: LOG_ACAO.CRIAR, modulo: LOG_MODULO.ENTRADA_ESTOQUE, descricao: `Registrou saída de ${form.quantidade} un. de ${produtos.find(p=>p._docId===form.produtoId||p.id===form.produtoId)?.nome||form.produtoId}` });
      onSalvo("Saída registrada com sucesso!");
      onClose();
    } catch (err) {
      console.error("Erro ao registrar saída:", err);
      setErrGlobal(err.message || "Erro ao registrar saída. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <div className="modal-header">
          <div>
            <div className="modal-title">Registrar Saída de Estoque</div>
            <div className="modal-sub">Informe os dados da saída</div>
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
                <option key={p._docId} value={p._docId}>
                  {p.nome}{p.sku ? ` (${p.sku})` : ""} — estoque: {p.estoque ?? 0}
                </option>
              ))}
            </select>
            {erros.produtoId && <div className="form-error">{erros.produtoId}</div>}
          </div>

          {/* Preview em tempo real */}
          {produtoSelecionado && (
            <div className="ee-preview">
              <div className="ee-preview-card">
                <div className="ee-preview-label">Estoque Atual</div>
                <div className="ee-preview-val atual">{estoqueAtual}</div>
              </div>
              <div className="ee-preview-card">
                <div className="ee-preview-label">Saindo</div>
                <div className="ee-preview-val sub">-{qtdSaida}</div>
              </div>
              <div className="ee-preview-card">
                <div className="ee-preview-label">Novo Estoque</div>
                <div className="ee-preview-val" style={{ color: prevNovo < 5 ? "var(--red,#e05252)" : "var(--green,#34c759)" }}>
                  {prevNovo}
                </div>
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
                type="number" min="1" step="1"
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
              Motivo da Saída <span className="form-label-req">*</span>
            </label>
            <select
              className={`form-input ${erros.motivo ? "err" : ""}`}
              value={form.motivo}
              onChange={(e) => set("motivo", e.target.value)}
            >
              <option value="">Selecione o motivo...</option>
              {MOTIVOS_SAIDA.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            {erros.motivo && <div className="form-error">{erros.motivo}</div>}
          </div>

          {/* Observação */}
          <div className="form-group">
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

          {/* Responsável — somente leitura, apenas informativo */}
          <div
            style={{
              display: "flex", alignItems: "center", gap: 9,
              background: "var(--s2)", border: "1px solid var(--border)",
              borderRadius: 9, padding: "10px 13px", marginBottom: 0,
            }}
          >
            <ArrowUpCircle size={14} color="var(--text-3)" style={{ flexShrink: 0 }} />
            <div style={{ fontSize: 12, color: "var(--text-2)" }}>
              Saída será registrada por{" "}
              <strong style={{ color: "var(--text)" }}>{nomeUsuario || "—"}</strong>
              {" "}•{" "}
              <span style={{ color: "var(--text-3)" }}>
                {CARGO_LABELS[cargo] || cargo || "—"}
              </span>
            </div>
          </div>

          {errGlobal && (
            <div className="err-box" style={{ marginTop: 14 }}>
              <AlertCircle size={14} /> {errGlobal}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose} disabled={salvando}>
            Cancelar
          </button>
          <button className="btn-danger" onClick={handleSubmit} disabled={salvando}>
            {salvando
              ? <><div className="spinner spinner-red" /> Registrando...</>
              : <><PackageMinus size={13} /> Registrar Saída</>}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   MODAL: Confirmar Exclusão de Entrada
   ══════════════════════════════════════════════════════ */
function ModalConfirmDelete({ tenantUid, movimentacao, produtos, onSalvo, onClose }) {
  const [excluindo, setExcluindo] = useState(false);
  const [errGlobal, setErrGlobal] = useState("");

  const handleConfirm = async () => {
    if (excluindo) return;
    setExcluindo(true);
    setErrGlobal("");

    try {
      const prodObj    = (produtos || []).find(
        (p) => p._docId === movimentacao.produtoId || p.id === movimentacao.produtoId
      );
      const prodDocId  = prodObj?._docId || movimentacao.produtoId;
      const produtoRef = doc(db, "users", tenantUid, "produtos", prodDocId);
      const movRef     = doc(db, "users", tenantUid, "movimentacoes_estoque", movimentacao.id);

      await runTransaction(db, async (tx) => {
        const [prodSnap, movSnap] = await Promise.all([tx.get(produtoRef), tx.get(movRef)]);
        if (!prodSnap.exists()) throw new Error("Produto não encontrado.");
        if (!movSnap.exists())  throw new Error("Movimentação não encontrada.");

        const estoqueReal = num(prodSnap.data().estoque);
        const qtdEntrada  = num(movSnap.data().quantidade);
        const novoEst     = Math.max(0, estoqueReal - qtdEntrada);

        tx.update(produtoRef, { estoque: novoEst });
        tx.delete(movRef);
      });

      await logAction({ tenantUid, nomeUsuario: "—", cargo: "—", acao: LOG_ACAO.EXCLUIR, modulo: LOG_MODULO.ENTRADA_ESTOQUE, descricao: `Excluiu entrada de ${movimentacao.quantidade} un. de ${movimentacao.produtoNome||movimentacao.produtoId}` });
      onSalvo("Entrada excluída e estoque revertido.");
      onClose();
    } catch (err) {
      console.error("Erro ao excluir entrada:", err);
      setErrGlobal(err.message || "Erro ao excluir. Tente novamente.");
    } finally {
      setExcluindo(false);
    }
  };

  return (
    <div
      className="modal-overlay modal-overlay-top"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="modal-box modal-box-md">
        <div className="modal-header">
          <div className="modal-title">Excluir Entrada</div>
          <button className="modal-close" onClick={onClose}>
            <X size={14} color="var(--text-2)" />
          </button>
        </div>

        <div className="confirm-body">
          <p>
            Tem certeza que deseja excluir a entrada de{" "}
            <strong>{movimentacao.quantidade} un.</strong> de{" "}
            <strong>{movimentacao.produtoNome || movimentacao.produtoId}</strong>?
            <br /><br />
            O estoque será <strong>reduzido em {movimentacao.quantidade} unidade(s)</strong>.
            <br />
            Esta ação não pode ser desfeita.
          </p>
          {errGlobal && (
            <div className="err-box" style={{ marginTop: 14, textAlign: "left" }}>
              <AlertCircle size={14} /> {errGlobal}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose} disabled={excluindo}>
            Cancelar
          </button>
          <button className="btn-danger" onClick={handleConfirm} disabled={excluindo}>
            {excluindo
              ? <><div className="spinner spinner-red" /> Excluindo...</>
              : <><Trash2 size={13} /> Confirmar Exclusão</>}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   MODAL: Detalhes da Saída (somente leitura)
   ══════════════════════════════════════════════════════ */
function ModalDetalhesSaida({ movimentacao: m, onExcluir, onClose }) {
  const iniciais = (nome) =>
    (nome || "?").split(" ").slice(0, 2).map((p) => p[0]).join("").toUpperCase();

  return (
    <div
      className="modal-overlay modal-overlay-top"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="modal-box modal-box-md" style={{ maxWidth: 480 }}>
        <div className="modal-header">
          <div>
            <div className="modal-title">Detalhes da Saída</div>
            <div className="modal-sub">{fmtData(m.data)}</div>
          </div>
          <button className="modal-close" onClick={onClose}>
            <X size={14} color="var(--text-2)" />
          </button>
        </div>

        <div className="modal-body">

          {/* Produto + Quantidade */}
          <div className="det-grid">
            <div className="det-card" style={{ gridColumn: "1 / -1" }}>
              <div className="det-label">Produto</div>
              <div className="det-val">{m.produtoNome || m.produtoId}</div>
            </div>
            <div className="det-card">
              <div className="det-label">Quantidade retirada</div>
              <div className="det-val-red">-{m.quantidade}</div>
            </div>
            <div className="det-card">
              <div className="det-label">Data</div>
              <div className="det-val">{fmtData(m.data)}</div>
            </div>
          </div>

          {/* Motivo */}
          <div style={{ marginBottom: 16 }}>
            <div className="det-label" style={{ marginBottom: 8 }}>Motivo</div>
            <span className="det-motivo-badge">{m.motivo}</span>
          </div>

          {/* Estoque antes / depois */}
          {(m.estoqueAnterior != null || m.estoqueNovo != null) && (
            <div className="det-grid" style={{ marginBottom: 16 }}>
              <div className="det-card">
                <div className="det-label">Estoque anterior</div>
                <div className="det-val">{m.estoqueAnterior ?? "—"}</div>
              </div>
              <div className="det-card">
                <div className="det-label">Estoque após saída</div>
                <div className="det-val">{m.estoqueNovo ?? "—"}</div>
              </div>
            </div>
          )}

          {/* Observação */}
          <div className="det-obs-box">
            <div className="det-label" style={{ marginBottom: 6 }}>Observação</div>
            {m.observacao
              ? <div className="det-val-muted" style={{ lineHeight: 1.6 }}>{m.observacao}</div>
              : <div className="det-val-muted" style={{ fontStyle: "italic", opacity: .6 }}>Nenhuma observação registrada.</div>
            }
          </div>

          <hr className="det-divider" />

          {/* Responsável */}
          <div className="det-label" style={{ marginBottom: 8 }}>Registrado por</div>
          <div className="det-responsavel">
            <div className="det-avatar">
              {iniciais(m.registradoPor?.nome)}
            </div>
            <div>
              <div className="det-resp-nome">{m.registradoPor?.nome || "—"}</div>
              <div className="det-resp-cargo">
                {CARGO_LABELS[m.registradoPor?.cargo] || m.registradoPor?.cargo || "—"}
              </div>
            </div>
          </div>

        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Fechar</button>
          <button className="btn-danger" onClick={onExcluir}>
            <Trash2 size={13} /> Excluir Saída
          </button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
   ══════════════════════════════════════════════════════ */
export default function EntradaEstoque() {
  // ── Auth via contexto — funciona para admin E convidados ──
  const { tenantUid, nomeUsuario, cargo, loadingAuth } = useAuth();

  const [produtos, setProdutos]           = useState([]);
  const [fornecedores, setFornecedores]   = useState([]);
  const [entradas, setEntradas]           = useState([]);
  const [saidas, setSaidas]               = useState([]);
  const [loading, setLoading]             = useState(true);
  const [search, setSearch]               = useState("");
  const [aba, setAba]                     = useState("entrada"); // "entrada" | "saida"

  /* Modais */
  const [modalNovo, setModalNovo]     = useState(false);
  const [modalSaida, setModalSaida]   = useState(false);
  const [editando, setEditando]       = useState(null);
  const [deletando, setDeletando]     = useState(null);
  const [detalheSaida, setDetalheSaida] = useState(null);

  /* Toast */
  const [toast, setToast] = useState({ msg: "", tipo: "sucesso" });
  const showToast = (msg, tipo = "sucesso") => {
    setToast({ msg, tipo });
    setTimeout(() => setToast({ msg: "", tipo: "sucesso" }), 3500);
  };

  /* ── Firestore: escuta em tempo real usando tenantUid ── */
  useEffect(() => {
    if (!tenantUid) { setLoading(false); return; }

    const unsubP = onSnapshot(
      collection(db, "users", tenantUid, "produtos"),
      (snap) => setProdutos(snap.docs.map((d) => ({ ...d.data(), id: d.id, _docId: d.id })))
    );

    const unsubF = onSnapshot(
      collection(db, "users", tenantUid, "fornecedores"),
      (snap) => setFornecedores(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );

    const unsubM = onSnapshot(
      collection(db, "users", tenantUid, "movimentacoes_estoque"),
      (snap) => {
        const todos = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => {
            const ta = a.dataCriacao?.toMillis?.() ?? 0;
            const tb = b.dataCriacao?.toMillis?.() ?? 0;
            return tb - ta;
          });
        setEntradas(todos.filter((m) => m.tipo === "entrada"));
        setSaidas(todos.filter((m) => m.tipo === "saida"));
        setLoading(false);
      }
    );

    return () => { unsubP(); unsubF(); unsubM(); };
  }, [tenantUid]);

  /* ── Filtro ── */
  const movFiltradas = useMemo(() => {
    const lista = aba === "entrada" ? entradas : saidas;
    const q = search.trim().toLowerCase();
    if (!q) return lista;
    return lista.filter(
      (m) =>
        m.produtoNome?.toLowerCase().includes(q) ||
        m.motivo?.toLowerCase().includes(q) ||
        m.fornecedor?.toLowerCase().includes(q) ||
        m.registradoPor?.nome?.toLowerCase().includes(q)
    );
  }, [entradas, saidas, aba, search]);

  if (loadingAuth || !tenantUid) {
    return <div className="ee-loading">Carregando autenticação...</div>;
  }

  return (
    <>
      <style>{CSS}</style>

      {/* Topbar */}
      <header className="ee-topbar">
        <div className="ee-topbar-title">
          <h1>Estoque</h1>
          <p>Registre entradas e saídas de produtos</p>
        </div>

        <div className="ee-search">
          <Search size={13} color="var(--text-3)" />
          <input
            placeholder={
              aba === "entrada"
                ? "Buscar produto, motivo ou fornecedor..."
                : "Buscar produto, motivo ou responsável..."
            }
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <button className="btn-entrada" onClick={() => setModalNovo(true)}>
          <PackagePlus size={14} /> Registrar Entrada
        </button>
        <button className="btn-saida" onClick={() => setModalSaida(true)}>
          <PackageMinus size={14} /> Registrar Saída
        </button>
      </header>

      {/* Abas */}
      <div className="ee-tabs">
        <button
          className={`ee-tab ${aba === "entrada" ? "active-entrada" : ""}`}
          onClick={() => setAba("entrada")}
        >
          <ArrowDownCircle size={14} /> Entradas ({entradas.length})
        </button>
        <button
          className={`ee-tab ${aba === "saida" ? "active-saida" : ""}`}
          onClick={() => setAba("saida")}
        >
          <ArrowUpCircle size={14} /> Saídas ({saidas.length})
        </button>
      </div>

      {/* Tabela */}
      <div className="ag-content">
        <div className="ee-table-wrap">
          <div className="ee-table-header">
            <span className="ee-table-title">
              {aba === "entrada" ? "Histórico de Entradas" : "Histórico de Saídas"}
            </span>
            <span className="ee-count-badge">{movFiltradas.length}</span>
          </div>

          {/* Cabeçalho de colunas */}
          {aba === "entrada" ? (
            <div className="ee-row-entrada ee-row-head">
              <span>Data</span>
              <span>Produto</span>
              <span>Qtd</span>
              <span>Motivo</span>
              <span>Custo Unit.</span>
              <span>Observação</span>
              <span style={{ textAlign: "right" }}>Ações</span>
            </div>
          ) : (
            <div className="ee-row-saida ee-row-head">
              <span>Data</span>
              <span>Produto</span>
              <span>Qtd</span>
              <span>Motivo</span>
              <span>Registrado por</span>
              <span style={{ textAlign: "right" }}>Ações</span>
            </div>
          )}

          {loading ? (
            <div className="ee-loading">Carregando movimentações...</div>
          ) : movFiltradas.length === 0 ? (
            <div className="ee-empty">
              {aba === "entrada" ? "Nenhuma entrada registrada ainda." : "Nenhuma saída registrada ainda."}
            </div>
          ) : aba === "entrada" ? (
            movFiltradas.map((m) => (
              <div key={m.id} className="ee-row-entrada">
                <span className="ee-data">{fmtData(m.data)}</span>
                <span className="ee-nome">{m.produtoNome || m.produtoId}</span>
                <span className="ee-qtd-in">+{m.quantidade}</span>
                <span className="ee-motivo">{m.motivo}</span>
                <span className="ee-custo">{fmtR$(m.custo)}</span>
                <span className="ee-obs">{m.observacao || "—"}</span>
                <div className="ee-actions">
                  <button
                    className="btn-icon btn-icon-edit"
                    title="Editar entrada"
                    onClick={() => setEditando(m)}
                  >
                    <Edit2 size={13} />
                  </button>
                  <button
                    className="btn-icon btn-icon-del"
                    title="Excluir entrada"
                    onClick={() => setDeletando(m)}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))
          ) : (
            movFiltradas.map((m) => (
              <div
                key={m.id}
                className="ee-row-saida clickable"
                onClick={() => setDetalheSaida(m)}
              >
                <span className="ee-data">{fmtData(m.data)}</span>
                <span className="ee-nome">{m.produtoNome || m.produtoId}</span>
                <span className="ee-qtd-out">-{m.quantidade}</span>
                <span className="ee-motivo-saida">{m.motivo}</span>
                <div className="ee-log">
                  <span className="ee-log-nome">{m.registradoPor?.nome || "—"}</span>
                  <span className="ee-log-cargo">
                    {CARGO_LABELS[m.registradoPor?.cargo] || m.registradoPor?.cargo || "—"}
                  </span>
                </div>
                <div className="ee-actions" onClick={(e) => e.stopPropagation()}>
                  <button
                    className="btn-icon btn-icon-view"
                    title="Ver detalhes"
                    onClick={() => setDetalheSaida(m)}
                  >
                    <Eye size={13} />
                  </button>
                  <button
                    className="btn-icon btn-icon-del"
                    title="Excluir saída"
                    onClick={() => setDeletando(m)}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modal: Nova entrada */}
      {modalNovo && (
        <ModalEntrada
          tenantUid={tenantUid}
          produtos={produtos}
          fornecedores={fornecedores}
          movimentacao={null}
          onSalvo={(msg) => showToast(msg, "sucesso")}
          onClose={() => setModalNovo(false)}
        />
      )}

      {/* Modal: Editar entrada */}
      {editando && editando.tipo === "entrada" && (
        <ModalEntrada
          tenantUid={tenantUid}
          produtos={produtos}
          fornecedores={fornecedores}
          movimentacao={editando}
          onSalvo={(msg) => { showToast(msg, "sucesso"); setEditando(null); }}
          onClose={() => setEditando(null)}
        />
      )}

      {/* Modal: Registrar saída */}
      {modalSaida && (
        <ModalSaida
          tenantUid={tenantUid}
          nomeUsuario={nomeUsuario}
          cargo={cargo}
          produtos={produtos}
          onSalvo={(msg) => showToast(msg, "sucesso")}
          onClose={() => setModalSaida(false)}
        />
      )}

      {/* Modal: Confirmar exclusão (entrada ou saída) */}
      {deletando && (
        <ModalConfirmDelete
          tenantUid={tenantUid}
          movimentacao={deletando}
          produtos={produtos}
          onSalvo={(msg) => { showToast(msg, "sucesso"); setDeletando(null); }}
          onClose={() => setDeletando(null)}
        />
      )}

      {/* Modal: Detalhes da saída */}
      {detalheSaida && (
        <ModalDetalhesSaida
          movimentacao={detalheSaida}
          onExcluir={() => { setDeletando(detalheSaida); setDetalheSaida(null); }}
          onClose={() => setDetalheSaida(null)}
        />
      )}

      <Toast msg={toast.msg} tipo={toast.tipo} />
    </>
  );
}
