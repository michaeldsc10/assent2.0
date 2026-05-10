/* ═══════════════════════════════════════════════════
   ASSENT v2.0 — AReceber.jsx
   Módulo: Contas a Receber
   Estrutura: users/{uid}/a_receber/{id}
   Preparado para integração futura com módulo de Vendas
   ═══════════════════════════════════════════════════ */

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
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
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";

import { db } from "../lib/firebase";
import { fsError } from "../utils/firestoreError";
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
  getDocs,
  increment,
  arrayUnion,
  query,
  where,
} from "firebase/firestore";

const CSS = `
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

  .ar-kpis {
    display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px;
    margin-bottom: 20px;
  }
  .ar-kpi {
    background: var(--s1); border: 1px solid var(--border);
    border-radius: 12px; padding: 14px 16px;
  }
  .ar-kpi-label { font-size: 11px; color: var(--text-2); font-weight: 500; }
  .ar-kpi-val {
    font-family: 'Sora', sans-serif;
    font-size: 20px; font-weight: 700; color: var(--text); margin: 7px 0;
  }
  .ar-kpi-val.gold  { color: var(--gold); }
  .ar-kpi-val.green { color: var(--green); }
  .ar-kpi-val.red   { color: var(--red); }
  .ar-kpi-sub { font-size: 10px; color: var(--text-3); }

  .ar-table-wrap {
    background: var(--s1); border: 1px solid var(--border);
    border-radius: 12px; overflow: hidden;
  }
  .ar-table-header {
    padding: 12px 22px; border-bottom: 1px solid var(--border);
    display: flex; align-items: center; justify-content: space-between;
  }
  .ar-table-title {
    font-size: 13px; font-weight: 600; color: var(--text);
  }
  .ar-count-badge {
    font-size: 10px; background: var(--s3); color: var(--text-2);
    padding: 3px 8px; border-radius: 4px;
  }

  .ar-row {
    display: grid;
    grid-template-columns: 1.2fr 1.5fr 0.8fr 0.8fr 1fr 0.8fr 1fr;
    gap: 12px; padding: 12px 22px; border-bottom: 1px solid var(--border);
    align-items: center; transition: background .13s; cursor: pointer;
  }
  .ar-row:last-child { border-bottom: none; }
  .ar-row:hover { background: var(--s2); }
  .ar-row-head {
    font-size: 10px; font-weight: 600; text-transform: uppercase;
    color: var(--text-2); background: var(--s2); cursor: default;
  }
  .ar-row-head:hover { background: var(--s2); }
  .ar-row-head span[data-sortable] { cursor: pointer; }
  .ar-row-head span[data-sortable]:hover { color: var(--text); }

  .ar-cliente {
    font-weight: 500; font-size: 12px; color: var(--text); overflow: hidden;
    text-overflow: ellipsis; white-space: nowrap;
  }
  .ar-desc {
    color: var(--text-2); font-size: 12px; overflow: hidden;
    text-overflow: ellipsis; white-space: nowrap;
  }
  .ar-valor {
    font-weight: 600; font-family: 'Sora', sans-serif;
  }
  .ar-valor.pago   { color: var(--green); }
  .ar-valor.pendente { color: var(--gold); }
  .ar-valor.vencido  { color: var(--red); }

  .ar-venc {
    font-size: 12px; color: var(--text-2);
  }
  .ar-venc.vencido { color: var(--red); font-weight: 600; }

  .ar-actions {
    display: flex; justify-content: flex-end; gap: 4px;
  }

  .ar-loading, .ar-empty {
    padding: 40px 22px; text-align: center;
    color: var(--text-2); font-size: 13px;
  }

  .cliente-wrap { position: relative; }
  .cliente-tag {
    display: inline-flex; align-items: center; gap: 5px;
    font-size: 11px; color: var(--green); background: rgba(72,199,142,0.1);
    border: 1px solid rgba(72,199,142,0.3); border-radius: 6px;
    padding: 5px 8px; margin-top: 7px;
  }
  .cliente-tag button {
    background: none; border: none; cursor: pointer; padding: 0;
    transition: transform .1s;
  }
  .cliente-tag button:hover { transform: scale(1.15); }

  .cliente-dropdown {
    position: absolute; top: 100%; left: 0; right: 0; margin-top: 6px;
    background: var(--s1); border: 1px solid var(--border);
    border-radius: 8px; z-index: 50; max-height: 200px; overflow-y: auto;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  }
  .cliente-option {
    padding: 10px 12px; border-bottom: 1px solid var(--border);
    cursor: pointer; transition: background .1s;
  }
  .cliente-option:last-child { border-bottom: none; }
  .cliente-option:hover { background: var(--s2); }
  .cliente-option-nome { font-size: 12px; font-weight: 500; color: var(--text); }
  .cliente-option-sub { font-size: 10px; color: var(--text-3); margin-top: 2px; }

  .pag-info-box {
    background: var(--s2); border: 1px solid var(--border);
    border-radius: 8px; padding: 12px; margin-bottom: 16px;
  }
  .pag-info-row {
    display: flex; justify-content: space-between; align-items: center;
    font-size: 12px; padding: 6px 0;
  }
  .pag-info-row strong { color: var(--text); }
  .pag-divider {
    height: 1px; background: var(--border); border: none; margin: 8px 0;
  }
  .pag-info-row .gold { color: var(--gold); font-weight: 600; }
  .pag-info-row .green { color: var(--green); font-weight: 600; }
  .pag-info-row .red { color: var(--red); font-weight: 600; }

  .confirm-body {
    padding: 24px 22px;
    text-align: center;
  }
  .confirm-icon {
    font-size: 40px; margin-bottom: 12px;
  }
  .confirm-body p {
    font-size: 13px; color: var(--text-2); line-height: 1.5;
  }

  .status-badge {
    display: inline-block; font-size: 10px; font-weight: 600;
    text-transform: uppercase; padding: 4px 8px; border-radius: 5px;
  }
  .status-badge.pago {
    background: rgba(72,199,142,0.15); color: var(--green);
    border: 1px solid rgba(72,199,142,0.3);
  }
  .status-badge.pendente {
    background: rgba(200,165,94,0.15); color: var(--gold);
    border: 1px solid rgba(200,165,94,0.3);
  }
  .status-badge.vencido {
    background: rgba(224,82,82,0.15); color: var(--red);
    border: 1px solid rgba(224,82,82,0.3);
  }

  .detalhe-info-group {
    display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 16px;
  }
  .detalhe-info-field {
    background: var(--s2); border: 1px solid var(--border);
    border-radius: 8px; padding: 12px;
  }
  .detalhe-info-label {
    font-size: 10px; font-weight: 600; text-transform: uppercase;
    color: var(--text-2); margin-bottom: 6px;
  }
  .detalhe-info-value {
    font-size: 13px; color: var(--text); font-weight: 500;
  }
  .detalhe-info-full {
    grid-column: 1 / -1;
  }
  .detalhe-section-title {
    font-size: 11px; font-weight: 700; text-transform: uppercase;
    color: var(--text-2); margin-top: 16px; margin-bottom: 10px;
  }
`;

/* ══════════════════════════════════════════════════
   UTILIDADES
   ══════════════════════════════════════════════════ */
const fmtR$ = (val) => {
  if (typeof val !== "number" || isNaN(val)) return "R$ 0,00";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);
};

const fmtData = (dateStr) => {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T00:00:00");
  if (isNaN(d)) return "—";
  return new Intl.DateTimeFormat("pt-BR").format(d);
};

const fmtDataCompleta = (timestamp) => {
  if (!timestamp) return "—";
  let d;
  if (typeof timestamp === "string") {
    d = new Date(timestamp);
  } else if (timestamp.toDate) {
    d = timestamp.toDate();
  } else {
    d = new Date(timestamp);
  }
  if (isNaN(d)) return "—";
  return new Intl.DateTimeFormat("pt-BR", { 
    year: "numeric", 
    month: "2-digit", 
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(d);
};

const FILTROS_STATUS = ["Todos", "pago", "pendente", "vencido"];

const LABEL_STATUS = {
  Todos: "Todos",
  pago: "Pago",
  pendente: "Pendente",
  vencido: "Vencido"
};

const LABEL_ORIGEM = {
  venda: "Venda",
  manual: "Manual",
  outro: "Outro"
};

/* ══════════════════════════════════════════════════
   FUNÇÕES AUXILIARES
   ══════════════════════════════════════════════════ */
const normalizarConta = (doc) => {
  return {
    ...doc,
    valorTotal: doc.valorTotal || 0,
    valorPago: doc.valorPago || 0,
    valorRestante: (doc.valorTotal || 0) - (doc.valorPago || 0)
  };
};

const calcStatus = (valorRestante, dataVencimento) => {
  if (valorRestante <= 0) return "pago";
  const hoje = new Date();
  const venc = new Date(dataVencimento + "T00:00:00");
  if (venc < hoje) return "vencido";
  return "pendente";
};

const StatusBadge = ({ status }) => (
  <div className={`status-badge ${status}`}>{LABEL_STATUS[status]}</div>
);

/* ══════════════════════════════════════════════════
   MODAL: Detalhes Completo
   ══════════════════════════════════════════════════ */
function ModalDetalhes({ conta, onClose }) {
  const status = calcStatus(conta.valorRestante, conta.dataVencimento);
  
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <div className="modal-header">
          <div>
            <div className="modal-title">Detalhes da Conta</div>
            <div className="modal-sub">{conta.clienteNome}</div>
          </div>
          <button className="modal-close" onClick={onClose}>
            <X size={14} color="var(--text-2)" />
          </button>
        </div>

        <div className="modal-body">
          <div className="detalhe-info-group">
            <div className="detalhe-info-field detalhe-info-full">
              <div className="detalhe-info-label">Descrição</div>
              <div className="detalhe-info-value">{conta.descricao || "—"}</div>
            </div>
          </div>

          <div className="detalhe-section-title">Financeiro</div>
          <div className="detalhe-info-group">
            <div className="detalhe-info-field">
              <div className="detalhe-info-label">Valor Total</div>
              <div className="detalhe-info-value" style={{ color: "var(--gold)" }}>
                {fmtR$(conta.valorTotal)}
              </div>
            </div>
            <div className="detalhe-info-field">
              <div className="detalhe-info-label">Já Recebido</div>
              <div className="detalhe-info-value" style={{ color: "var(--green)" }}>
                {fmtR$(conta.valorPago)}
              </div>
            </div>
            <div className="detalhe-info-field">
              <div className="detalhe-info-label">Restante</div>
              <div className="detalhe-info-value" style={{ color: status === "vencido" ? "var(--red)" : "var(--text)" }}>
                {fmtR$(conta.valorRestante)}
              </div>
            </div>
            <div className="detalhe-info-field">
              <div className="detalhe-info-label">Status</div>
              <div style={{ marginTop: "4px" }}>
                <StatusBadge status={status} />
              </div>
            </div>
          </div>

          <div className="detalhe-section-title">Datas</div>
          <div className="detalhe-info-group">
            <div className="detalhe-info-field">
              <div className="detalhe-info-label">Vencimento</div>
              <div className="detalhe-info-value">{fmtData(conta.dataVencimento)}</div>
            </div>
            <div className="detalhe-info-field">
              <div className="detalhe-info-label">Criado em</div>
              <div className="detalhe-info-value">{fmtDataCompleta(conta.dataCriacao)}</div>
            </div>
          </div>

          <div className="detalhe-section-title">Informações</div>
          <div className="detalhe-info-group">
            <div className="detalhe-info-field">
              <div className="detalhe-info-label">Origem</div>
              <div className="detalhe-info-value">
                {LABEL_ORIGEM[conta.origem] || conta.origem || "—"}
              </div>
            </div>
            <div className="detalhe-info-field">
              <div className="detalhe-info-label">Forma de Pagamento</div>
              <div className="detalhe-info-value">{conta.formaPagamento || "—"}</div>
            </div>
          </div>

          {conta.observacoes && (
            <>
              <div className="detalhe-section-title">Observações</div>
              <div className="detalhe-info-field detalhe-info-full" style={{ minHeight: "70px" }}>
                <div className="detalhe-info-value" style={{ whiteSpace: "pre-wrap", lineHeight: "1.5" }}>
                  {conta.observacoes}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Fechar</button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════
   MODAL: Formulário (Criar/Editar)
   ══════════════════════════════════════════════════ */
function ModalFormConta({ conta, onSave, onClose }) {
  const [form, setForm] = useState(
    conta || {
      clienteNome: "",
      clienteId: null,
      descricao: "",
      valorTotal: "",
      valorPago: "0",
      formaPagamento: "dinheiro",
      dataVencimento: "",
      observacoes: "",
      origem: "manual"
    }
  );

  const [erros, setErros] = useState({});
  const [salvando, setSalvando] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [clientes, setClientes] = useState([]);
  const [clienteVinculado, setClienteVinculado] = useState(conta?.clienteId ? { id: conta.clienteId } : null);
  const { tenantUid } = useAuth();
  const inputRef = useRef(null);

  useEffect(() => {
    if (!tenantUid) return;
    const col = collection(db, "users", tenantUid, "clientes");
    const unsub = onSnapshot(col, (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setClientes(docs);
    });
    return unsub;
  }, [tenantUid]);

  const clientesFiltrados = clientes.filter(c => {
    const q = form.clienteNome.toLowerCase();
    const nome = (c.nome || c.nomeFantasia || "").toLowerCase();
    return nome.includes(q);
  });

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const selecionarCliente = (c) => {
    set("clienteNome", c.nome || c.nomeFantasia || "");
    set("clienteId", c.id);
    setClienteVinculado(c);
    setDropdownOpen(false);
  };

  const desvincularCliente = () => {
    setClienteVinculado(null);
    set("clienteId", null);
  };

  const validar = () => {
    const e = {};
    if (!form.clienteNome?.trim()) e.clienteNome = "Cliente é obrigatório";
    if (!form.descricao?.trim()) e.descricao = "Descrição é obrigatória";
    const vt = parseFloat((form.valorTotal || "").replace(",", "."));
    if (isNaN(vt) || vt <= 0) e.valorTotal = "Informe um valor maior que zero";
    if (!form.dataVencimento?.trim()) e.dataVencimento = "Data é obrigatória";
    setErros(e);
    return Object.keys(e).length === 0;
  };

  const handleSalvar = async () => {
    if (!validar()) return;
    setSalvando(true);
    const vt = parseFloat((form.valorTotal || "").replace(",", "."));
    const vp = parseFloat((form.valorPago || "").replace(",", ".")) || 0;
    await onSave({
      ...form,
      valorTotal: vt,
      valorPago: Math.min(vp, vt),
      valorRestante: Math.max(vt - vp, 0)
    });
    setSalvando(false);
  };

  const isEdit = !!conta;

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <div className="modal-header">
          <div className="modal-title">{isEdit ? "Editar Conta" : "Nova Conta"}</div>
          <button className="modal-close" onClick={onClose}>
            <X size={14} color="var(--text-2)" />
          </button>
        </div>

        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">
              Cliente <span className="form-label-req">*</span>
            </label>
            <div className="cliente-wrap">
              <input
                ref={inputRef}
                className={`form-input${erros.clienteNome ? " err" : ""}`}
                placeholder="Nome do cliente ou busque na lista…"
                value={form.clienteNome}
                disabled={!!clienteVinculado}
                onChange={e => {
                  set("clienteNome", e.target.value);
                  if (clienteVinculado) {
                    setClienteVinculado(null);
                    setForm(f => ({ ...f, clienteId: null }));
                  }
                  setDropdownOpen(true);
                }}
                onFocus={() => setDropdownOpen(true)}
                autoComplete="off"
              />

              {clienteVinculado && (
                <div className="cliente-tag">
                  <CheckCircle size={11} />
                  Cliente cadastrado vinculado
                  <button onClick={desvincularCliente} title="Desvincular">
                    <X size={11} />
                  </button>
                </div>
              )}

              {dropdownOpen && !clienteVinculado && clientesFiltrados.length > 0 && (
                <div className="cliente-dropdown">
                  {clientesFiltrados.map(c => {
                    const nome = c.nome || c.nomeFantasia || "—";
                    const sub  = c.email || c.telefone || c.cpf || c.cnpj || "";
                    return (
                      <div
                        key={c.id}
                        className="cliente-option"
                        onMouseDown={e => { e.preventDefault(); selecionarCliente(c); }}
                      >
                        <div className="cliente-option-nome">{nome}</div>
                        {sub && <div className="cliente-option-sub">{sub}</div>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            {erros.clienteNome && <div className="form-error">{erros.clienteNome}</div>}
          </div>

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

          <div className="form-group">
            <label className="form-label">Forma de Pagamento</label>
            <select
              className="form-input"
              value={form.formaPagamento}
              onChange={e => set("formaPagamento", e.target.value)}
            >
              <option value="dinheiro">Dinheiro</option>
              <option value="cartao_credito">Cartão de Crédito</option>
              <option value="cartao_debito">Cartão de Débito</option>
              <option value="boleto">Boleto</option>
              <option value="transferencia">Transferência</option>
              <option value="pix">PIX</option>
              <option value="cheque">Cheque</option>
              <option value="outro">Outro</option>
            </select>
          </div>

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
  const hoje = (() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"0")}-${String(n.getDate()).padStart(2,"0")}`; })();
  const [dataRecebimento, setDataRecebimento] = useState(hoje);

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
    if (!dataRecebimento) {
      setErro("Informe a data do recebimento.");
      return;
    }

    setSalvando(true);
    await onConfirm(valor, dataRecebimento);
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

          <div className="form-group">
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
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">
              Data do Recebimento <span className="form-label-req">*</span>
            </label>
            <input
              type="date"
              className="form-input"
              value={dataRecebimento}
              onChange={e => { setDataRecebimento(e.target.value); setErro(""); }}
            />
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

  const [search, setSearch]             = useState("");
  const [filtroStatus, setFiltroStatus] = useState("Todos");
  const [sortKey, setSortKey]           = useState(null);
  const [sortDir, setSortDir]           = useState("asc");

  const { tenantUid, cargo, nomeUsuario, podeCriar, podeEditar, podeExcluir } = useAuth();

  const podeCriarV   = podeCriar("aReceber");
  const podeEditarV  = podeEditar("aReceber");
  const podeExcluirV = podeExcluir("aReceber");

  const [modalNovo, setModalNovo]   = useState(false);
  const [editando, setEditando]     = useState(null);
  const [deletando, setDeletando]   = useState(null);
  const [pagamento, setPagamento]   = useState(null);
  const [detalhes, setDetalhes]     = useState(null);

  const toggleSort = (key) => {
    setSortDir(d => sortKey === key ? (d === "asc" ? "desc" : "asc") : "asc");
    setSortKey(key);
  };

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
        fsError(err, "AReceber:listener");
        setLoading(false);
      }
    );

    return unsub;
  }, [tenantUid]);

  /* ── Criar ── */
  const handleCriar = useCallback(async (dados) => {
    if (!tenantUid) return;
    try {
      const col = collection(db, "users", tenantUid, "a_receber");
      const agora = new Date();
      const historicoInicial = dados.valorPago > 0
        ? [{ valor: dados.valorPago, data: agora.toISOString() }]
        : [];
      await addDoc(col, {
        ...dados,
        origem: dados.origem || "manual",
        dataCriacao: serverTimestamp(),
        dataPagamento: dados.valorPago > 0 ? agora : null,
        historicoPagamentos: historicoInicial,
      });
      setModalNovo(false);
      await logAction({ tenantUid, nomeUsuario, cargo, acao: LOG_ACAO.CRIAR, modulo: LOG_MODULO.A_RECEBER, descricao: montarDescricao("criar", "Conta a Receber", dados.clienteNome || dados.descricao) });
    } catch (err) {
      fsError(err, "AReceber:criar");
      alert("Erro ao criar conta. Tente novamente.");
    }
  }, [tenantUid, nomeUsuario, cargo]);

  /* ── Editar ── */
  const handleEditar = useCallback(async (dados) => {
    if (!tenantUid || !editando?.id) return;
    try {
      const ref = doc(db, "users", tenantUid, "a_receber", editando.id);
      // Detecta se houve incremento manual no valorPago
      const vpAnterior = editando.valorPago || 0;
      const vpNovo     = dados.valorPago || 0;
      const incremento = vpNovo - vpAnterior;
      const agora      = new Date();

      const updateData = {
        clienteNome:    dados.clienteNome,
        clienteId:      dados.clienteId,
        descricao:      dados.descricao,
        valorTotal:     dados.valorTotal,
        valorPago:      dados.valorPago,
        valorRestante:  dados.valorRestante,
        formaPagamento: dados.formaPagamento,
        dataVencimento: dados.dataVencimento,
        observacoes:    dados.observacoes,
      };

      if (incremento > 0) {
        updateData.dataPagamento       = agora;
        updateData.historicoPagamentos = arrayUnion({ valor: incremento, data: agora.toISOString() });
      }

      await updateDoc(ref, updateData);
      setEditando(null);
      await logAction({ tenantUid, nomeUsuario, cargo, acao: LOG_ACAO.EDITAR, modulo: LOG_MODULO.A_RECEBER, descricao: montarDescricao("editar", "Conta a Receber", dados.clienteNome || dados.descricao, editando.id) });
    } catch (err) {
      fsError(err, "AReceber:editar");
      alert("Erro ao editar conta. Tente novamente.");
    }
  }, [tenantUid, editando?.id, nomeUsuario, cargo]);

  /* ── Pagamento ── */
  const handlePagamento = useCallback(async (valor, dataRecebimento) => {
    if (!tenantUid || !pagamento?.id) return;
    try {
      await runTransaction(db, async (t) => {
        const ref = doc(db, "users", tenantUid, "a_receber", pagamento.id);
        const snap = await t.get(ref);
        if (!snap.exists()) throw new Error("Conta não encontrada");

        const contaAtual = snap.data();
        const novoValorPago = (contaAtual.valorPago || 0) + valor;
        const novoValorRestante = Math.max((contaAtual.valorTotal || 0) - novoValorPago, 0);

        const dataISO = dataRecebimento
          ? new Date(dataRecebimento + "T12:00:00").toISOString()
          : new Date().toISOString();
        t.update(ref, {
          valorPago: novoValorPago,
          valorRestante: novoValorRestante,
          dataPagamento: dataRecebimento ? new Date(dataRecebimento + "T12:00:00") : new Date(),
          historicoPagamentos: arrayUnion({ valor, data: dataISO }),
        });

        if (contaAtual.origem === "venda" && contaAtual.referenciaId) {
          const vendaRef = doc(db, "users", tenantUid, "vendas", contaAtual.referenciaId);
          t.update(vendaRef, { valorRestante: novoValorRestante });
        }
      });
      setPagamento(null);
      await logAction({ tenantUid, nomeUsuario, cargo, acao: LOG_ACAO.EDITAR, modulo: LOG_MODULO.A_RECEBER, descricao: montarDescricao("pagar", "Conta a Receber", pagamento.clienteNome || pagamento.descricao, pagamento.id) });
    } catch (err) {
      fsError(err, "AReceber:registrarPagamento");
      alert("Erro ao registrar pagamento. Tente novamente.");
    }
  }, [tenantUid, pagamento, nomeUsuario, cargo]);

  /* ── Deletar ── */
  const handleDeletar = useCallback(async () => {
    if (!tenantUid || !deletando?.id) return;
    try {
      await runTransaction(db, async (t) => {
        t.delete(doc(db, "users", tenantUid, "a_receber", deletando.id));

        if (deletando.origem === "venda" && deletando.referenciaId) {
          try {
            const vendaRef = doc(db, "users", tenantUid, "vendas", deletando.referenciaId);
            const valorARestaurar = deletando.valorPago > 0 ? deletando.valorPago : (deletando.valorRestante ?? deletando.valorTotal ?? 0);
            if (valorARestaurar > 0) {
              t.update(vendaRef, { valorRestante: increment(valorARestaurar) });
            }
          } catch (errVenda) {
            fsError(errVenda, "AReceber:restaurarVendaRestante");
          }
        }
      });
      setDeletando(null);
      await logAction({ tenantUid, nomeUsuario, cargo, acao: LOG_ACAO.EXCLUIR, modulo: LOG_MODULO.A_RECEBER, descricao: montarDescricao("excluir", "Conta a Receber", deletando.clienteNome || deletando.descricao, deletando.id) });
    } catch (err) {
      fsError(err, "AReceber:excluir");
      alert("Erro ao excluir conta. Tente novamente.");
    }
  }, [tenantUid, deletando]);

  /* ── Filtragem + busca + ordenação (memoizado) ── */
  const contasFiltradas = useMemo(() => {
    const q = search.trim().toLowerCase();

    return contas
      .filter(c => {
        const passaStatus = filtroStatus === "Todos" || c.status === filtroStatus;
        const passaBusca  = !q || c.clienteNome?.toLowerCase().includes(q) || c.descricao?.toLowerCase().includes(q);
        return passaStatus && passaBusca;
      })
      .sort((a, b) => {
        if (!sortKey) return 0;
        let va, vb;
        if (sortKey === "status") {
          va = calcStatus(a.valorRestante, a.dataVencimento);
          vb = calcStatus(b.valorRestante, b.dataVencimento);
        } else {
          va = a[sortKey] ?? "";
          vb = b[sortKey] ?? "";
          if (sortKey === "dataVencimento") {
            va = va || "9999-99-99";
            vb = vb || "9999-99-99";
          }
        }
        const cmp = String(va).localeCompare(String(vb), "pt-BR", { numeric: true });
        return sortDir === "asc" ? cmp : -cmp;
      });
  }, [contas, search, filtroStatus, sortKey, sortDir]);

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

  const COLUNAS_HEAD = [
    { key: "clienteNome",    label: "Cliente" },
    { key: "descricao",      label: "Descrição" },
    { key: null,             label: "Total" },
    { key: null,             label: "Restante" },
    { key: "dataVencimento", label: "Vencimento" },
    { key: "status",         label: "Status" },
  ];

  return (
    <>
      <style>{CSS}</style>

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

        <div className="ar-table-wrap">
          <div className="ar-table-header">
            <span className="ar-table-title">Contas a Receber</span>
            <span className="ar-count-badge">{contasFiltradas.length}</span>
          </div>

          <div className="ar-row ar-row-head">
            {COLUNAS_HEAD.map(({ key, label }) => (
              <span
                key={label}
                data-sortable={key ? true : undefined}
                onClick={() => key && toggleSort(key)}
                style={{ display: "flex", alignItems: "center", gap: 4 }}
              >
                {label}
                {key && (
                  sortKey === key
                    ? sortDir === "asc"
                      ? <ArrowUp size={11} style={{ flexShrink: 0 }} />
                      : <ArrowDown size={11} style={{ flexShrink: 0 }} />
                    : <ArrowUpDown size={11} style={{ flexShrink: 0, opacity: 0.35 }} />
                )}
              </span>
            ))}
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
                <div 
                  key={c.id} 
                  className="ar-row"
                  onClick={() => setDetalhes(c)}
                >
                  <span className="ar-cliente">{c.clienteNome || "—"}</span>
                  <span className="ar-desc" title={c.descricao}>{c.descricao || "—"}</span>
                  <span className="ar-valor" style={{ color: "var(--text-2)", fontWeight: 500 }}>
                    {fmtR$(c.valorTotal)}
                  </span>
                  <span className={`ar-valor ${statusCalc}`}>
                    {fmtR$(c.valorRestante)}
                  </span>
                  <span className={`ar-venc${vencida ? " vencido" : ""}`}>
                    {fmtData(c.dataVencimento)}
                  </span>
                  <StatusBadge status={statusCalc} />
                  <div className="ar-actions" onClick={e => e.stopPropagation()}>
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
      {detalhes && (
        <ModalDetalhes
          conta={detalhes}
          onClose={() => setDetalhes(null)}
        />
      )}
    </>
  );
}
