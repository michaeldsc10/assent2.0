/* ═══════════════════════════════════════════════════
   ASSENT v2.0 — AReceber.jsx
   Módulo: Contas a Receber
   Estrutura: users/{uid}/a_receber/{id}
   Preparado para integração futura com módulo de Vendas
   ═══════════════════════════════════════════════════ */

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Search,
  Plus,
  Edit2,
  Trash2,
  X,
  DollarSign,
  CheckCircle,
  Clock,
  AlertCircle,
  Filter,
} from "lucide-react";

import { db } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";
import { logAction, LOG_ACAO, LOG_MODULO, montarDescricao } from "../lib/logAction";
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  runTransaction,
  getDoc,
} from "firebase/firestore";

/* ══════════════════════════════════════════════════
   CSS — padrão visual ASSENT v2.0
   ══════════════════════════════════════════════════ */
const CSS = `
  /* ── Modal ── */
  .modal-overlay {
    position: fixed; inset: 0; z-index: 1000;
    background: rgba(0,0,0,0.78);
    backdrop-filter: blur(5px);
    display: flex; align-items: center; justify-content: center;
    padding: 20px; animation: fadeIn .15s ease;
  }
  .modal-overlay-top { z-index: 1100; }

  @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
  @keyframes slideUp {
    from { opacity: 0; transform: translateY(14px) }
    to   { opacity: 1; transform: translateY(0) }
  }

  .modal-box {
    background: var(--s1); border: 1px solid var(--border-h);
    border-radius: 16px; width: 100%; max-width: 520px;
    max-height: 90vh; overflow-y: auto;
    box-shadow: 0 28px 72px rgba(0,0,0,0.65);
    animation: slideUp .18s ease;
  }
  .modal-box-md  { max-width: 400px; }
  .modal-box-sm  { max-width: 360px; }
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

  /* Form */
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
    box-sizing: border-box;
  }
  .form-input:focus { border-color: var(--gold); box-shadow: 0 0 0 3px rgba(200,165,94,0.1); }
  .form-input.err   { border-color: var(--red); }
  .form-input.err:focus { box-shadow: 0 0 0 3px rgba(224,82,82,0.1); }
  .form-error { font-size: 11px; color: var(--red); margin-top: 5px; }
  .form-row   { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  .form-textarea {
    width: 100%; background: var(--s2);
    border: 1px solid var(--border); border-radius: 9px;
    padding: 10px 13px; color: var(--text); font-size: 13px;
    font-family: 'DM Sans', sans-serif;
    outline: none; transition: border-color .15s, box-shadow .15s;
    resize: vertical; min-height: 72px; box-sizing: border-box;
  }
  .form-textarea:focus { border-color: var(--gold); box-shadow: 0 0 0 3px rgba(200,165,94,0.1); }

  /* Buttons */
  .btn-primary {
    padding: 9px 20px; border-radius: 9px;
    background: var(--gold); color: #0a0808;
    border: none; cursor: pointer;
    font-family: 'DM Sans', sans-serif;
    font-size: 13px; font-weight: 600;
    transition: opacity .13s, transform .1s;
  }
  .btn-primary:hover  { opacity: .88; }
  .btn-primary:active { transform: scale(.97); }
  .btn-primary:disabled { opacity: .5; cursor: not-allowed; }

  .btn-secondary {
    padding: 9px 20px; border-radius: 9px;
    background: var(--s3); color: var(--text-2);
    border: 1px solid var(--border); cursor: pointer;
    font-family: 'DM Sans', sans-serif; font-size: 13px;
    transition: background .13s, color .13s;
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

  .btn-icon {
    width: 30px; height: 30px; border-radius: 7px;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; border: 1px solid transparent;
    background: transparent; transition: all .13s;
  }
  .btn-icon-edit  { color: var(--blue); }
  .btn-icon-edit:hover  { background: var(--blue-d); border-color: rgba(91,142,240,.2); }
  .btn-icon-del   { color: var(--red); }
  .btn-icon-del:hover   { background: var(--red-d); border-color: rgba(224,82,82,.2); }
  .btn-icon-pay   { color: var(--green); }
  .btn-icon-pay:hover   { background: rgba(72,199,142,.12); border-color: rgba(72,199,142,.25); }

  .btn-novo-ar {
    display: flex; align-items: center; gap: 7px;
    padding: 8px 16px; border-radius: 9px;
    background: var(--gold); color: #0a0808;
    border: none; cursor: pointer;
    font-family: 'DM Sans', sans-serif;
    font-size: 13px; font-weight: 600;
    white-space: nowrap;
    transition: opacity .13s, transform .1s;
  }
  .btn-novo-ar:hover  { opacity: .88; }

  /* Topbar */
  .ar-topbar {
    padding: 14px 22px;
    background: var(--s1); border-bottom: 1px solid var(--border);
    display: flex; align-items: center; gap: 14px; flex-shrink: 0;
    flex-wrap: wrap;
  }
  .ar-topbar-title h1 {
    font-family: 'Sora', sans-serif; font-size: 17px; font-weight: 600;
    color: var(--text);
  }
  .ar-topbar-title p { font-size: 11px; color: var(--text-2); margin-top: 2px; }

  .ar-search {
    display: flex; align-items: center; gap: 8px;
    background: var(--s2); border: 1px solid var(--border);
    border-radius: 8px; padding: 8px 12px; width: 240px;
  }
  .ar-search input {
    background: transparent; border: none; outline: none;
    color: var(--text); font-size: 12px; width: 100%;
    font-family: 'DM Sans', sans-serif;
  }

  .ar-filter-group {
    display: flex; align-items: center; gap: 6px;
  }
  .ar-filter-btn {
    padding: 6px 12px; border-radius: 6px; font-size: 11px; font-weight: 500;
    background: var(--s3); border: 1px solid var(--border);
    color: var(--text-2); cursor: pointer; transition: all .13s;
    font-family: 'DM Sans', sans-serif;
  }
  .ar-filter-btn:hover { background: var(--s2); color: var(--text); }
  .ar-filter-btn.active {
    background: rgba(200,165,94,0.15); border-color: var(--gold);
    color: var(--gold);
  }

  /* KPIs */
  .ar-kpis {
    display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px;
    margin-bottom: 20px;
  }
  .ar-kpi {
    background: var(--s1); border: 1px solid var(--border);
    border-radius: 12px; padding: 16px 18px;
  }
  .ar-kpi-label {
    font-size: 10px; font-weight: 600; text-transform: uppercase;
    letter-spacing: .07em; color: var(--text-3); margin-bottom: 8px;
  }
  .ar-kpi-val {
    font-family: 'Sora', sans-serif; font-size: 20px; font-weight: 700;
    color: var(--text);
  }
  .ar-kpi-val.green { color: var(--green); }
  .ar-kpi-val.gold  { color: var(--gold); }
  .ar-kpi-val.red   { color: var(--red); }
  .ar-kpi-sub { font-size: 11px; color: var(--text-3); margin-top: 4px; }

  /* Tabela */
  .ar-table-wrap {
    background: var(--s1); border: 1px solid var(--border);
    border-radius: 12px; overflow: hidden;
  }
  .ar-table-header {
    padding: 13px 18px;
    border-bottom: 1px solid var(--border);
    display: flex; align-items: center; justify-content: space-between;
  }
  .ar-table-title {
    font-family: 'Sora', sans-serif; font-size: 13px; font-weight: 600;
    color: var(--text);
  }
  .ar-count-badge {
    font-family: 'Sora', sans-serif; font-size: 12px; font-weight: 600;
    background: var(--s3); border: 1px solid var(--border-h);
    color: var(--text-2); padding: 2px 10px; border-radius: 20px;
  }

  /* grid: cliente | descrição | valor restante | vencimento | status | ações */
  .ar-row {
    display: grid;
    grid-template-columns: 160px 1fr 130px 120px 110px 90px;
    padding: 11px 18px; gap: 8px;
    border-bottom: 1px solid var(--border);
    align-items: center; font-size: 12px; color: var(--text-2);
  }
  .ar-row:last-child { border-bottom: none; }
  .ar-row:hover { background: rgba(255,255,255,0.02); }
  .ar-row-head { background: var(--s2); }
  .ar-row-head span {
    font-size: 10px; font-weight: 500; letter-spacing: .06em;
    text-transform: uppercase; color: var(--text-3);
  }

  .ar-cliente { color: var(--text); font-size: 13px; font-weight: 500; }
  .ar-desc    { color: var(--text-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ar-valor   { font-family: 'Sora', sans-serif; font-size: 13px; font-weight: 600; }
  .ar-valor.pendente { color: var(--gold); }
  .ar-valor.vencido  { color: var(--red); }
  .ar-valor.pago     { color: var(--green); }
  .ar-venc    { font-size: 12px; color: var(--text-2); }
  .ar-venc.vencido { color: var(--red); }
  .ar-actions { display: flex; align-items: center; gap: 5px; justify-content: flex-end; }

  .ar-empty, .ar-loading {
    padding: 56px 20px; text-align: center; color: var(--text-3);
    font-size: 13px;
  }

  /* Status badge */
  .status-badge {
    display: inline-flex; align-items: center; gap: 5px;
    padding: 3px 9px; border-radius: 20px;
    font-size: 10px; font-weight: 600; letter-spacing: .04em;
    text-transform: uppercase; white-space: nowrap;
  }
  .status-badge.pendente {
    background: rgba(200,165,94,0.12); border: 1px solid rgba(200,165,94,.3);
    color: var(--gold);
  }
  .status-badge.vencido {
    background: var(--red-d); border: 1px solid rgba(224,82,82,.25);
    color: var(--red);
  }
  .status-badge.pago {
    background: rgba(72,199,142,0.10); border: 1px solid rgba(72,199,142,.25);
    color: var(--green);
  }

  /* Modal pagamento info box */
  .pag-info-box {
    background: var(--s2); border: 1px solid var(--border);
    border-radius: 9px; padding: 14px 16px; margin-bottom: 18px;
  }
  .pag-info-row {
    display: flex; justify-content: space-between; align-items: center;
    font-size: 12px; color: var(--text-2); margin-bottom: 6px;
  }
  .pag-info-row:last-child { margin-bottom: 0; }
  .pag-info-row strong { color: var(--text); }
  .pag-info-row .green { color: var(--green); font-family: 'Sora', sans-serif; font-weight: 600; }
  .pag-info-row .gold  { color: var(--gold);  font-family: 'Sora', sans-serif; font-weight: 600; }
  .pag-info-row .red   { color: var(--red);   font-family: 'Sora', sans-serif; font-weight: 600; }

  .pag-divider {
    border: none; border-top: 1px solid var(--border); margin: 12px 0;
  }

  /* Confirm body */
  .confirm-body {
    padding: 28px 22px; text-align: center;
    font-size: 13px; color: var(--text-2); line-height: 1.6;
  }
  .confirm-icon { font-size: 32px; margin-bottom: 12px; }
  .confirm-body strong { color: var(--text); }
`;

/* ══════════════════════════════════════════════════
   HELPERS
   ══════════════════════════════════════════════════ */

/** Formata valor monetário em BRL */
const fmtR$ = (v) =>
  `R$ ${Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

/** Formata string de data ISO (YYYY-MM-DD) para pt-BR */
const fmtData = (d) => {
  if (!d) return "—";
  try {
    // Força parse local para evitar offset UTC
    const [ano, mes, dia] = String(d).split("-");
    return `${dia}/${mes}/${ano}`;
  } catch {
    return String(d);
  }
};

/** Data de hoje no formato YYYY-MM-DD (local) */
const hojeISO = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

/**
 * Calcula o status correto com base nos valores e data de vencimento.
 * REGRA CRÍTICA: nunca confiar apenas no status salvo.
 */
const calcStatus = (valorRestante, dataVencimento) => {
  const restante = Number(valorRestante || 0);
  if (restante <= 0) return "pago";
  const hoje = hojeISO();
  if (dataVencimento && dataVencimento < hoje) return "vencido";
  return "pendente";
};

/** Garante consistência dos campos financeiros de um documento */
const normalizarConta = (conta) => {
  const valorTotal  = Number(conta.valorTotal  || 0);
  const valorPago   = Number(conta.valorPago   || 0);
  const valorRestante = Math.max(0, valorTotal - valorPago);
  const status = calcStatus(valorRestante, conta.dataVencimento);
  return { ...conta, valorTotal, valorPago, valorRestante, status };
};

/* Gera ID sequencial de venda — espelha o padrão de Vendas.jsx */
const gerarIdVenda = (cnt) => `V${String(cnt + 1).padStart(4, "0")}`;

const FILTROS_STATUS = ["Todos", "pendente", "vencido", "pago"];

const LABEL_STATUS = {
  Todos:    "Todos",
  pendente: "Pendente",
  vencido:  "Vencido",
  pago:     "Pago",
};

/* ══════════════════════════════════════════════════
   COMPONENTE: StatusBadge
   ══════════════════════════════════════════════════ */
function StatusBadge({ status }) {
  const icon = {
    pendente: <Clock     size={10} />,
    vencido:  <AlertCircle size={10} />,
    pago:     <CheckCircle size={10} />,
  }[status] || null;

  return (
    <span className={`status-badge ${status}`}>
      {icon}
      {LABEL_STATUS[status] || status}
    </span>
  );
}

/* ══════════════════════════════════════════════════
   MODAL: Novo / Editar Conta a Receber
   ══════════════════════════════════════════════════ */
function ModalFormConta({ conta, onSave, onClose }) {
  const isEdit = !!conta;

  const [form, setForm] = useState({
    clienteNome:    conta?.clienteNome    || "",
    descricao:      conta?.descricao      || "",
    valorTotal:     conta?.valorTotal     != null ? String(conta.valorTotal) : "",
    valorPago:      conta?.valorPago      != null ? String(conta.valorPago)  : "0",
    dataVencimento: conta?.dataVencimento || "",
    observacoes:    conta?.observacoes    || "",
  });
  const [erros, setErros]     = useState({});
  const [salvando, setSalvando] = useState(false);

  const set = useCallback((campo, valor) => {
    setForm(f => ({ ...f, [campo]: valor }));
    setErros(e => ({ ...e, [campo]: "" }));
  }, []);

  const validar = () => {
    const e = {};
    if (!form.clienteNome.trim())    e.clienteNome    = "Nome do cliente é obrigatório.";
    if (!form.descricao.trim())      e.descricao      = "Descrição é obrigatória.";
    if (!form.dataVencimento)        e.dataVencimento = "Data de vencimento é obrigatória.";

    const vTotal = parseFloat(form.valorTotal.replace(",", "."));
    if (isNaN(vTotal) || vTotal <= 0) e.valorTotal = "Valor total deve ser maior que zero.";

    const vPago = parseFloat(form.valorPago.replace(",", "."));
    if (isNaN(vPago) || vPago < 0)    e.valorPago  = "Valor pago não pode ser negativo.";
    if (!isNaN(vTotal) && !isNaN(vPago) && vPago > vTotal)
      e.valorPago = "Valor pago não pode ser maior que o valor total.";

    setErros(e);
    return Object.keys(e).length === 0;
  };

  const handleSalvar = async () => {
    if (!validar()) return;
    setSalvando(true);

    try {
      const valorTotal    = parseFloat(form.valorTotal.replace(",", "."));
      const valorPago     = parseFloat(form.valorPago.replace(",", "."));
      const valorRestante = Math.max(0, valorTotal - valorPago);
      const status        = calcStatus(valorRestante, form.dataVencimento);

      await onSave({
        clienteNome:    form.clienteNome.trim(),
        descricao:      form.descricao.trim(),
        valorTotal,
        valorPago,
        valorRestante,
        dataVencimento: form.dataVencimento,
        observacoes:    form.observacoes.trim(),
        status,
        // Campos para integração futura com módulo de Vendas
        origem:         isEdit ? (conta.origem || "manual") : "manual",
        referenciaId:   isEdit ? (conta.referenciaId || null) : null,
      });
    } finally {
      // Garante reset mesmo se onSave lançar exceção
      setSalvando(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <div className="modal-header">
          <div>
            <div className="modal-title">{isEdit ? "Editar Conta" : "Nova Conta a Receber"}</div>
            <div className="modal-sub">
              {isEdit ? `Editando: ${conta.clienteNome}` : "Preencha os dados da conta"}
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>
            <X size={14} color="var(--text-2)" />
          </button>
        </div>

        <div className="modal-body">
          {/* Cliente */}
          <div className="form-group">
            <label className="form-label">
              Cliente <span className="form-label-req">*</span>
            </label>
            <input
              className={`form-input${erros.clienteNome ? " err" : ""}`}
              placeholder="Nome do cliente"
              value={form.clienteNome}
              onChange={e => set("clienteNome", e.target.value)}
            />
            {erros.clienteNome && <div className="form-error">{erros.clienteNome}</div>}
          </div>

          {/* Descrição */}
          <div className="form-group">
            <label className="form-label">
              Descrição <span className="form-label-req">*</span>
            </label>
            <input
              className={`form-input${erros.descricao ? " err" : ""}`}
              placeholder="Ex: Serviço de design, parcela 1/3..."
              value={form.descricao}
              onChange={e => set("descricao", e.target.value)}
            />
            {erros.descricao && <div className="form-error">{erros.descricao}</div>}
          </div>

          {/* Valores */}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">
                Valor Total (R$) <span className="form-label-req">*</span>
              </label>
              <input
                className={`form-input${erros.valorTotal ? " err" : ""}`}
                placeholder="0,00"
                value={form.valorTotal}
                onChange={e => set("valorTotal", e.target.value)}
                inputMode="decimal"
              />
              {erros.valorTotal && <div className="form-error">{erros.valorTotal}</div>}
            </div>

            <div className="form-group">
              <label className="form-label">Já Recebido (R$)</label>
              <input
                className={`form-input${erros.valorPago ? " err" : ""}`}
                placeholder="0,00"
                value={form.valorPago}
                onChange={e => set("valorPago", e.target.value)}
                inputMode="decimal"
              />
              {erros.valorPago && <div className="form-error">{erros.valorPago}</div>}
            </div>
          </div>

          {/* Data de vencimento */}
          <div className="form-group">
            <label className="form-label">
              Data de Vencimento <span className="form-label-req">*</span>
            </label>
            <input
              type="date"
              className={`form-input${erros.dataVencimento ? " err" : ""}`}
              value={form.dataVencimento}
              onChange={e => set("dataVencimento", e.target.value)}
            />
            {erros.dataVencimento && <div className="form-error">{erros.dataVencimento}</div>}
          </div>

          {/* Observações */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Observações</label>
            <textarea
              className="form-textarea"
              placeholder="Informações adicionais (opcional)"
              value={form.observacoes}
              onChange={e => set("observacoes", e.target.value)}
            />
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" onClick={handleSalvar} disabled={salvando}>
            {salvando ? "Salvando..." : isEdit ? "Salvar Alterações" : "Criar Conta"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════
   MODAL: Registrar Pagamento
   ══════════════════════════════════════════════════ */
function ModalPagamento({ conta, onConfirm, onClose }) {
  const [valorStr, setValorStr] = useState("");
  const [erro, setErro]         = useState("");
  const [salvando, setSalvando] = useState(false);

  const handleConfirmar = async () => {
    const valor = parseFloat(valorStr.replace(",", "."));

    if (isNaN(valor) || valor <= 0) {
      setErro("Informe um valor maior que zero.");
      return;
    }
    if (valor > conta.valorRestante + 0.001) {
      setErro(`Valor maior que o restante (${fmtR$(conta.valorRestante)}).`);
      return;
    }

    setSalvando(true);
    await onConfirm(valor);
    setSalvando(false);
  };

  return (
    <div className="modal-overlay modal-overlay-top" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box modal-box-sm">
        <div className="modal-header">
          <div>
            <div className="modal-title">Registrar Pagamento</div>
            <div className="modal-sub">{conta.clienteNome} — {conta.descricao}</div>
          </div>
          <button className="modal-close" onClick={onClose}>
            <X size={14} color="var(--text-2)" />
          </button>
        </div>

        <div className="modal-body">
          {/* Resumo financeiro */}
          <div className="pag-info-box">
            <div className="pag-info-row">
              <span>Valor Total</span>
              <span className="gold">{fmtR$(conta.valorTotal)}</span>
            </div>
            <div className="pag-info-row">
              <span>Já Recebido</span>
              <span className="green">{fmtR$(conta.valorPago)}</span>
            </div>
            <hr className="pag-divider" />
            <div className="pag-info-row">
              <strong>Restante</strong>
              <span className="red">{fmtR$(conta.valorRestante)}</span>
            </div>
          </div>

          {/* Valor a registrar */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">
              Valor Recebido (R$) <span className="form-label-req">*</span>
            </label>
            <input
              className={`form-input${erro ? " err" : ""}`}
              placeholder={`Máx: ${fmtR$(conta.valorRestante)}`}
              value={valorStr}
              onChange={e => { setValorStr(e.target.value); setErro(""); }}
              inputMode="decimal"
              autoFocus
            />
            {erro && <div className="form-error">{erro}</div>}
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" onClick={handleConfirmar} disabled={salvando}>
            {salvando ? "Registrando..." : "Confirmar Pagamento"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════
   MODAL: Confirmar Exclusão
   ══════════════════════════════════════════════════ */
function ModalConfirmDelete({ conta, onConfirm, onClose }) {
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
          <div className="modal-title">Excluir Conta</div>
          <button className="modal-close" onClick={onClose}>
            <X size={14} color="var(--text-2)" />
          </button>
        </div>
        <div className="confirm-body">
          <div className="confirm-icon">🗑️</div>
          <p>
            Tem certeza que deseja excluir a conta de{" "}
            <strong>{conta.clienteNome}</strong>?<br />
            Esta ação não pode ser desfeita.
          </p>
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

/* ══════════════════════════════════════════════════
   COMPONENTE PRINCIPAL: AReceber
   ══════════════════════════════════════════════════ */
export default function AReceber() {
  const [contas, setContas]   = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch]           = useState("");
  const [filtroStatus, setFiltroStatus] = useState("Todos");

  // ── Multi-tenant ──
  const { tenantUid, cargo, nomeUsuario, podeCriar, podeEditar, podeExcluir } = useAuth();

  // ── Flags de permissão ──
  const podeCriarV   = podeCriar("aReceber");
  const podeEditarV  = podeEditar("aReceber");
  const podeExcluirV = podeExcluir("aReceber");

  const [modalNovo, setModalNovo]   = useState(false);
  const [editando, setEditando]     = useState(null);
  const [deletando, setDeletando]   = useState(null);
  const [pagamento, setPagamento]   = useState(null);

  /* ── Auth ── */
  /* ── Firestore — listener em tempo real ── */
  useEffect(() => {
    if (!tenantUid) {
      setLoading(false);
      return;
    }

    const col = collection(db, "users", tenantUid, "a_receber");

    const unsub = onSnapshot(
      col,
      (snap) => {
        const docs = snap.docs.map(d => normalizarConta({ id: d.id, ...d.data() }));
        setContas(docs);
        setLoading(false);
      },
      (err) => {
        console.error("[AReceber] Erro ao carregar contas:", err);
        setLoading(false);
      }
    );

    return unsub;
  }, [tenantUid]);

  /* ── Handler: Criar nova conta ── */
  const handleCriar = useCallback(async (dados) => {
    if (!tenantUid) return;
    try {
      const now = new Date().toISOString();
      const arRef = await addDoc(collection(db, "users", tenantUid, "a_receber"), {
        ...dados,
        dataCriacao:     now,
        dataAtualizacao: now,
      });
      await logAction({ tenantUid, nomeUsuario, cargo, acao: LOG_ACAO.CRIAR, modulo: LOG_MODULO.A_RECEBER, descricao: montarDescricao("criar", "Conta a Receber", dados.clienteNome || dados.descricao, arRef.id) });
      setModalNovo(false);
    } catch (err) {
      console.error("[AReceber] Erro ao criar conta:", err);
      alert("Erro ao criar conta. Tente novamente.");
    }
  }, [tenantUid]);

  /* ── Handler: Editar conta ── */
  const handleEditar = useCallback(async (dados) => {
    if (!tenantUid || !editando) return;
    try {
      const ref = doc(db, "users", tenantUid, "a_receber", editando.id);
      await updateDoc(ref, {
        ...dados,
        dataAtualizacao: new Date().toISOString(),
      });
      await logAction({ tenantUid, nomeUsuario, cargo, acao: LOG_ACAO.EDITAR, modulo: LOG_MODULO.A_RECEBER, descricao: montarDescricao("editar", "Conta a Receber", dados.clienteNome || dados.descricao || editando.clienteNome, editando.id) });
      setEditando(null);
    } catch (err) {
      console.error("[AReceber] Erro ao editar conta:", err);
      alert("Erro ao salvar alterações. Tente novamente.");
    }
  }, [tenantUid, editando]);

  /* ── Handler: Registrar pagamento ── */
  const handlePagamento = useCallback(async (valorRecebido) => {
    if (!tenantUid || !pagamento) return;
    try {
      const conta = pagamento;
      const novoValorPago     = Number((conta.valorPago + valorRecebido).toFixed(2));
      const novoValorRestante = Math.max(0, Number((conta.valorTotal - novoValorPago).toFixed(2)));
      const novoStatus        = calcStatus(novoValorRestante, conta.dataVencimento);
      const agora             = new Date().toISOString();

      /* 1. Atualiza o documento em a_receber (comportamento existente) */
      const ref = doc(db, "users", tenantUid, "a_receber", conta.id);
      await updateDoc(ref, {
        valorPago:       novoValorPago,
        valorRestante:   novoValorRestante,
        status:          novoStatus,
        dataAtualizacao: agora,
      });

      /* 2. ── REGIME DE CAIXA: registrar entrada no Caixa ──────────────────
         Toda confirmação de pagamento gera uma entrada no Caixa.
         · Se a conta veio de uma venda (origem === "venda"), usa o referenciaId
           da venda para que o DRE consiga somar o valor recebido agora.
         · Se for conta manual (origem !== "venda"), ainda registra no Caixa
           mas com origem "a_receber" — o DRE não contabiliza essas entradas
           como receita de venda, mantendo a consistência atual.
         Garantia anti-duplicação: cada chamada a handlePagamento representa
         um evento de pagamento distinto (data e valor diferentes do sinal
         original), nunca é a mesma operação executada duas vezes. */  

       
       try {
        /* ─── REGIME DE CAIXA ─────────────────────────────────────────────
           Determina origem da entrada de caixa conforme o tipo da conta:
             · origem "venda"       → entrada no caixa linkada à venda original
             · origem "mensalidade" → cria venda sintética (categoria "Mensalidade")
                                      e linka caixa a ela para fluir ao DRE
             · origem manual        → caixa com origem "a_receber"
                                      (DRE ignora — mantém comportamento atual)
        ───────────────────────────────────────────────────────────────────── */
        const ehVenda       = conta.origem === "venda";
        const ehMensalidade = conta.origem === "mensalidade";

        let origemCaixa;
        let referenciaCaixa;

        if (ehVenda) {
          origemCaixa     = "venda";
          referenciaCaixa = conta.referenciaId || null;
        } else if (ehMensalidade) {
          /* Cria venda sintética para que mensalidade recebida apareça em
             /vendas (Relatório de Vendas) e seja reconhecida pelo DRE via
             caixa origem="venda" + referenciaId existente. */
          const vendaMensalidade = {
            tipoVenda:       "mensalidade",
            categoria:       "Mensalidade",
            cliente:         conta.clienteNome || "—",
            clienteNome:     conta.clienteNome || "—",
            clienteId:       conta.clienteId   || null,
            clienteIdSeq:    conta.clienteIdSeq ?? null,
            mesReferencia:   conta.mesReferencia || null,
            total:           valorRecebido,
            valorRecebido,
            itens: [{
              nome:          `Mensalidade ${conta.mesReferencia || ""} — ${conta.clienteNome || ""}`.trim(),
              produto:       "Mensalidade",
              qtd:           1,
              quantidade:    1,
              preco:         valorRecebido,
              valorUnitario: valorRecebido,
              total:         valorRecebido,
              subtotal:      valorRecebido,
              tipo:          "mensalidade",
              custo:         0,
            }],
            formaPagamento:   "Mensalidade",
            data:             agora,
            criadoEm:         agora,
            origem:           "mensalidade",
            referenciaCliente: conta.clienteId || null,
            /* ── Link de volta ao a_receber que originou esta venda sintética.
               Usado por Vendas.jsx para reverter o pagamento ao cancelar/excluir. ── */
            aReceberDocId:    conta.id,
            descontos:        0,
            valorTaxa:        0,
          };
          /* Gera ID sequencial (V0001…) atômico via transaction —
             mesmo padrão de Vendas.jsx para manter consistência visual */
          const novoIdVenda = await runTransaction(db, async (tx) => {
            const userRef  = doc(db, "users", tenantUid);
            const userSnap = await tx.get(userRef);
            const currentCnt = userSnap.data()?.vendaIdCnt || 0;
            const vendaId    = gerarIdVenda(currentCnt);
            tx.set(doc(db, "users", tenantUid, "vendas", vendaId), {
              ...vendaMensalidade,
              id: vendaId,
            });
            tx.set(userRef, { vendaIdCnt: currentCnt + 1 }, { merge: true });
            return vendaId;
          });
          origemCaixa     = "venda";
          referenciaCaixa = novoIdVenda;
        } else {
          origemCaixa     = "a_receber";
          referenciaCaixa = conta.id;
        }

        await addDoc(collection(db, "users", tenantUid, "caixa"), {
          tipo:         "entrada",
          origem:       origemCaixa,
          referenciaId: referenciaCaixa,
          valor:        valorRecebido,
          descricao:    ehMensalidade
            ? `Mensalidade recebida — ${conta.clienteNome || ""}${conta.mesReferencia ? ` · ${conta.mesReferencia}` : ""}`
            : `Recebimento — ${conta.clienteNome || ""}${conta.descricao ? ` · ${conta.descricao}` : ""}`,
          categoria:    ehMensalidade ? "Mensalidade" : (ehVenda ? "Venda" : "A Receber"),
          data:         agora,
          criadoEm:     agora,
        });
      } catch (errCaixa) {
        /* O a_receber já foi atualizado. O Caixa falhou isoladamente.
           Não reverte o pagamento — exibe aviso discreto no console. */
        console.error("[AReceber] Pagamento registrado, mas erro ao lançar no Caixa:", errCaixa);
      }

      setPagamento(null);
    } catch (err) {
      console.error("[AReceber] Erro ao registrar pagamento:", err);
      alert("Erro ao registrar pagamento. Tente novamente.");
    }
  }, [tenantUid, pagamento]);

  /* ── Handler: Excluir conta ── */
  const handleDeletar = useCallback(async () => {
    if (!tenantUid || !deletando) return;
    try {
      await deleteDoc(doc(db, "users", tenantUid, "a_receber", deletando.id));
      await logAction({ tenantUid, nomeUsuario, cargo, acao: LOG_ACAO.EXCLUIR, modulo: LOG_MODULO.A_RECEBER, descricao: montarDescricao("excluir", "Conta a Receber", deletando.clienteNome || deletando.descricao, deletando.id) });
      setDeletando(null);
    } catch (err) {
      console.error("[AReceber] Erro ao excluir conta:", err);
      alert("Erro ao excluir conta. Tente novamente.");
    }
  }, [tenantUid, deletando]);

  /* ── Filtragem + busca (memoizado) ── */
  const contasFiltradas = useMemo(() => {
    const q = search.trim().toLowerCase();

    return contas.filter(c => {
      const passaStatus =
        filtroStatus === "Todos" || c.status === filtroStatus;

      const passaBusca =
        !q ||
        c.clienteNome?.toLowerCase().includes(q) ||
        c.descricao?.toLowerCase().includes(q);

      return passaStatus && passaBusca;
    });
  }, [contas, search, filtroStatus]);

  /* ── KPIs (memoizado) ── */
  const kpis = useMemo(() => {
    const totalPendente = contas
      .filter(c => c.status === "pendente" || c.status === "vencido")
      .reduce((acc, c) => acc + c.valorRestante, 0);

    const totalVencido = contas
      .filter(c => c.status === "vencido")
      .reduce((acc, c) => acc + c.valorRestante, 0);

    const totalRecebido = contas
      .reduce((acc, c) => acc + c.valorPago, 0);

    return { totalPendente, totalVencido, totalRecebido };
  }, [contas]);

  /* ── Guard ── */
  // App.jsx bloqueia render enquanto loadingAuth||!tenantUid

  return (
    <>
      <style>{CSS}</style>

      {/* Topbar */}
      <header className="ar-topbar">
        <div className="ar-topbar-title">
          <h1>A Receber</h1>
          <p>Controle de contas e valores pendentes</p>
        </div>

        <div className="ar-search">
          <Search size={13} color="var(--text-3)" />
          <input
            placeholder="Buscar por cliente ou descrição..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Filtros de status */}
        <div className="ar-filter-group">
          <Filter size={12} color="var(--text-3)" />
          {FILTROS_STATUS.map(f => (
            <button
              key={f}
              className={`ar-filter-btn${filtroStatus === f ? " active" : ""}`}
              onClick={() => setFiltroStatus(f)}
            >
              {LABEL_STATUS[f]}
            </button>
          ))}
        </div>

        {podeCriarV && <button className="btn-novo-ar" onClick={() => setModalNovo(true)}>
          <Plus size={14} /> Nova Conta
        </button>}
      </header>

      <div className="ag-content">
        {/* KPIs */}
        <div className="ar-kpis">
          <div className="ar-kpi">
            <div className="ar-kpi-label">Total a Receber</div>
            <div className={`ar-kpi-val${kpis.totalPendente > 0 ? " gold" : ""}`}>
              {fmtR$(kpis.totalPendente)}
            </div>
            <div className="ar-kpi-sub">pendente + vencido</div>
          </div>

          <div className="ar-kpi">
            <div className="ar-kpi-label">Vencido</div>
            <div className={`ar-kpi-val${kpis.totalVencido > 0 ? " red" : ""}`}>
              {fmtR$(kpis.totalVencido)}
            </div>
            <div className="ar-kpi-sub">em atraso</div>
          </div>

          <div className="ar-kpi">
            <div className="ar-kpi-label">Total Recebido</div>
            <div className="ar-kpi-val green">{fmtR$(kpis.totalRecebido)}</div>
            <div className="ar-kpi-sub">todos os registros</div>
          </div>
        </div>

        {/* Tabela */}
        <div className="ar-table-wrap">
          <div className="ar-table-header">
            <span className="ar-table-title">Contas a Receber</span>
            <span className="ar-count-badge">{contasFiltradas.length}</span>
          </div>

          {/* Cabeçalho */}
          <div className="ar-row ar-row-head">
            <span>Cliente</span>
            <span>Descrição</span>
            <span>Restante</span>
            <span>Vencimento</span>
            <span>Status</span>
            <span style={{ textAlign: "right" }}>Ações</span>
          </div>

          {loading ? (
            <div className="ar-loading">Carregando contas...</div>
          ) : contasFiltradas.length === 0 ? (
            <div className="ar-empty">
              {contas.length === 0
                ? "Nenhuma conta cadastrada ainda."
                : "Nenhum resultado para os filtros aplicados."}
            </div>
          ) : (
            contasFiltradas.map(c => {
              const statusCalc = calcStatus(c.valorRestante, c.dataVencimento);
              const vencida    = statusCalc === "vencido";

              return (
                <div key={c.id} className="ar-row">
                  <span className="ar-cliente">{c.clienteNome || "—"}</span>
                  <span className="ar-desc"    title={c.descricao}>{c.descricao || "—"}</span>
                  <span className={`ar-valor ${statusCalc}`}>
                    {fmtR$(c.valorRestante)}
                  </span>
                  <span className={`ar-venc${vencida ? " vencido" : ""}`}>
                    {fmtData(c.dataVencimento)}
                  </span>
                  <StatusBadge status={statusCalc} />
                  <div className="ar-actions">
                    {/* Registrar pagamento — só se ainda há saldo */}
                    {statusCalc !== "pago" && (
                      <button
                        className="btn-icon btn-icon-pay"
                        title="Registrar pagamento"
                        onClick={() => setPagamento(c)}
                      >
                        <DollarSign size={13} />
                      </button>
                    )}
                    {podeEditarV && <button
                      className="btn-icon btn-icon-edit"
                      title="Editar"
                      onClick={() => setEditando(c)}
                    >
                      <Edit2 size={13} />
                    </button>}
                    {podeExcluirV && <button
                      className="btn-icon btn-icon-del"
                      title="Excluir"
                      onClick={() => setDeletando(c)}
                    >
                      <Trash2 size={13} />
                    </button>}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── Modais ── */}
      {modalNovo && podeCriarV && (
        <ModalFormConta
          onSave={handleCriar}
          onClose={() => setModalNovo(false)}
        />
      )}
      {editando && podeEditarV && (
        <ModalFormConta
          conta={editando}
          onSave={handleEditar}
          onClose={() => setEditando(null)}
        />
      )}
      {pagamento && (
        <ModalPagamento
          conta={pagamento}
          onConfirm={handlePagamento}
          onClose={() => setPagamento(null)}
        />
      )}
      {deletando && podeExcluirV && (
        <ModalConfirmDelete
          conta={deletando}
          onConfirm={handleDeletar}
          onClose={() => setDeletando(null)}
        />
      )}
    </>
  );
}
