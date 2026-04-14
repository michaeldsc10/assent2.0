/* ═══════════════════════════════════════════════════
   ASSENT v2.0 — Clientes.jsx
   Módulo completo: cadastro, listagem, histórico,
   detalhe de venda — com Firestore em tempo real
   ═══════════════════════════════════════════════════ */

import { useState, useEffect, useMemo } from "react";
import {
  Search, UserPlus, Edit2, Trash2, X,
  ChevronRight, Printer,
} from "lucide-react";
import { db } from "../lib/firebase";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { getAuth } from "firebase/auth";

/* ─── CSS do módulo ──────────────────────────────────
   Injeta apenas estilos novos. As variáveis CSS
   (--gold, --bg, --text...) vêm do Dashboard.jsx    */
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
  .modal-box-lg  { max-width: 680px; }
  .modal-box-md  { max-width: 400px; }
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
  }
  .form-input:focus { border-color: var(--gold); box-shadow: 0 0 0 3px rgba(200,165,94,0.1); }
  .form-input.err   { border-color: var(--red); }
  .form-input.err:focus { box-shadow: 0 0 0 3px rgba(224,82,82,0.1); }
  .form-error { font-size: 11px; color: var(--red); margin-top: 5px; }
  .form-row   { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }

  /* ── Buttons ── */
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
  .btn-icon-edit { color: var(--blue); }
  .btn-icon-edit:hover { background: var(--blue-d); border-color: rgba(91,142,240,.2); }
  .btn-icon-del  { color: var(--red); }
  .btn-icon-del:hover  { background: var(--red-d); border-color: rgba(224,82,82,.2); }

  .btn-imprimir {
    display: inline-flex; align-items: center; gap: 7px;
    padding: 7px 15px; border-radius: 8px; cursor: pointer;
    background: var(--s3); color: var(--text-2);
    border: 1px solid var(--border);
    font-family: 'DM Sans', sans-serif; font-size: 12px;
    margin-bottom: 18px; transition: background .13s;
  }
  .btn-imprimir:hover { background: var(--s2); color: var(--text); }

  .btn-novo-cl {
    display: flex; align-items: center; gap: 7px;
    padding: 8px 16px; border-radius: 9px;
    background: var(--gold); color: #0a0808;
    border: none; cursor: pointer;
    font-family: 'DM Sans', sans-serif;
    font-size: 13px; font-weight: 600;
    white-space: nowrap;
    transition: opacity .13s, transform .1s;
    flex-shrink: 0;
  }
  .btn-novo-cl:hover  { opacity: .88; }
  .btn-novo-cl:active { transform: scale(.97); }

  /* ── Topbar do módulo ── */
  .cl-topbar {
    padding: 14px 22px;
    background: var(--s1); border-bottom: 1px solid var(--border);
    display: flex; align-items: center; gap: 14px; flex-shrink: 0;
  }
  .cl-topbar-title { flex: 1; }
  .cl-topbar-title h1 {
    font-family: 'Sora', sans-serif; font-size: 17px; font-weight: 600;
    color: var(--text); line-height: 1.2;
  }
  .cl-topbar-title p { font-size: 11px; color: var(--text-2); margin-top: 2px; }

  .cl-search {
    display: flex; align-items: center; gap: 8px;
    background: var(--s2); border: 1px solid var(--border);
    border-radius: 8px; padding: 8px 12px; width: 270px;
    transition: border-color .15s;
  }
  .cl-search:focus-within { border-color: var(--border-h); }
  .cl-search input {
    background: transparent; border: none; outline: none;
    color: var(--text); font-size: 12px; width: 100%;
    font-family: 'DM Sans', sans-serif;
  }
  .cl-search input::placeholder { color: var(--text-3); }

  /* ── Tabela de clientes ── */
  .cl-table-wrap {
    background: var(--s1); border: 1px solid var(--border);
    border-radius: 12px; overflow: hidden;
  }
  .cl-table-header {
    padding: 13px 18px;
    border-bottom: 1px solid var(--border);
    display: flex; align-items: center; justify-content: space-between;
  }
  .cl-table-title { font-size: 13px; font-weight: 500; color: var(--text); }
  .cl-count-badge {
    font-family: 'Sora', sans-serif; font-size: 12px; font-weight: 600;
    background: var(--s3); border: 1px solid var(--border-h);
    color: var(--text-2); padding: 2px 10px; border-radius: 20px;
  }

  /* Grid colunas: ID | Nome | Telefone | CPF/CNPJ | Insta | Endereço | Ações */
  .cl-row {
    display: grid;
    grid-template-columns: 72px 1fr 130px 145px 120px 1fr 78px;
    padding: 11px 18px; gap: 8px;
    border-bottom: 1px solid var(--border);
    align-items: center; font-size: 12px; color: var(--text-2);
    transition: background .1s;
  }
  .cl-row:hover      { background: rgba(255,255,255,0.02); }
  .cl-row:last-child { border-bottom: none; }
  .cl-row-head       { background: var(--s2); }
  .cl-row-head span  {
    font-size: 10px; font-weight: 500; letter-spacing: .06em;
    text-transform: uppercase; color: var(--text-3);
  }

  .cl-id { font-family: 'Sora', sans-serif; font-size: 11px; color: var(--gold); font-weight: 500; }
  .cl-nome {
    color: var(--text); font-size: 13px; font-weight: 500;
    cursor: pointer; transition: color .13s;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .cl-nome:hover { color: var(--gold); text-decoration: underline; text-underline-offset: 3px; }
  .cl-insta { color: var(--blue); }
  .cl-overflow { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .cl-actions { display: flex; align-items: center; gap: 5px; justify-content: flex-end; }

  .cl-empty { padding: 56px 20px; text-align: center; }
  .cl-empty p { font-size: 13px; color: var(--text-3); margin-top: 8px; }
  .cl-loading { padding: 40px 20px; text-align: center; color: var(--text-3); font-size: 13px; }

  /* ── Histórico: KPI cards ── */
  .hist-kpis {
    display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;
    margin-bottom: 16px;
  }
  .hist-kpi {
    background: var(--s2); border: 1px solid var(--border);
    border-radius: 10px; padding: 13px 15px;
  }
  .hist-kpi-label {
    font-size: 9px; font-weight: 600; letter-spacing: .08em;
    text-transform: uppercase; color: var(--text-3); margin-bottom: 6px;
  }
  .hist-kpi-val {
    font-family: 'Sora', sans-serif;
    font-size: 22px; font-weight: 700; line-height: 1;
  }

  /* ── Histórico: período ── */
  .hist-periods { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 16px; }
  .hist-period-btn {
    padding: 5px 14px; border-radius: 20px; font-size: 12px;
    cursor: pointer; border: 1px solid var(--border);
    background: transparent; color: var(--text-2);
    font-family: 'DM Sans', sans-serif; transition: all .13s;
  }
  .hist-period-btn:hover { background: var(--s2); color: var(--text); }
  .hist-period-btn.active {
    background: var(--gold-d); border-color: rgba(200,165,94,.3); color: var(--gold);
  }

  .hist-section-label {
    font-size: 9px; font-weight: 600; letter-spacing: .1em;
    text-transform: uppercase; color: var(--text-3); margin-bottom: 10px;
  }

  /* ── Histórico: linha de venda ── */
  .hist-row {
    display: flex; align-items: center; gap: 10px;
    background: var(--s2); border: 1px solid var(--border);
    border-radius: 9px; padding: 11px 14px; margin-bottom: 7px;
    cursor: pointer; transition: border-color .15s;
  }
  .hist-row:hover { border-color: var(--border-h); background: rgba(255,255,255,0.03); }
  .hist-row:last-child { margin-bottom: 0; }

  .hist-venda-id {
    font-family: 'Sora', sans-serif; font-size: 12px;
    color: var(--gold); font-weight: 500; flex-shrink: 0;
  }
  .hist-venda-data { font-size: 11px; color: var(--text-2); flex: 1; }
  .hist-fp {
    font-size: 10px; color: var(--text-3);
    background: var(--s3); border: 1px solid var(--border);
    padding: 2px 8px; border-radius: 12px; flex-shrink: 0;
  }
  .hist-total {
    font-family: 'Sora', sans-serif; font-size: 13px;
    font-weight: 600; color: var(--green); flex-shrink: 0;
  }
  .hist-empty { padding: 28px 0; text-align: center; color: var(--text-3); font-size: 13px; }

  /* ── Venda Detalhe ── */
  .vd-meta { margin-bottom: 14px; }
  .vd-meta-row { font-size: 13px; color: var(--text-2); margin-bottom: 5px; }
  .vd-meta-row strong { color: var(--text); }

  .vd-table { border: 1px solid var(--border); border-radius: 10px; overflow: hidden; margin-bottom: 12px; }
  .vd-thead {
    display: grid;
    grid-template-columns: 1fr 52px 110px 110px 90px 110px;
    padding: 9px 14px; background: var(--s2);
    border-bottom: 1px solid var(--border);
  }
  .vd-thead span {
    font-size: 10px; font-weight: 500; letter-spacing: .06em;
    text-transform: uppercase; color: var(--text-3);
  }
  .vd-trow {
    display: grid;
    grid-template-columns: 1fr 52px 110px 110px 90px 110px;
    padding: 11px 14px; font-size: 12px; color: var(--text-2);
    border-bottom: 1px solid var(--border); align-items: center;
  }
  .vd-trow:last-child { border-bottom: none; }
  .vd-trow .vd-nome { color: var(--text); font-size: 13px; font-weight: 500; }

  .vd-totals {
    display: grid; grid-template-columns: repeat(5, 1fr);
    background: var(--s2); border: 1px solid var(--border);
    border-radius: 10px; overflow: hidden;
  }
  .vd-total-cell {
    padding: 12px 14px; border-right: 1px solid var(--border);
  }
  .vd-total-cell:last-child { border-right: none; }
  .vd-total-label {
    font-size: 9px; font-weight: 600; letter-spacing: .07em;
    text-transform: uppercase; color: var(--text-3); margin-bottom: 5px;
  }
  .vd-total-val {
    font-family: 'Sora', sans-serif; font-size: 14px; font-weight: 700;
  }

  /* ── Confirm delete ── */
  .confirm-body { padding: 24px 22px; text-align: center; }
  .confirm-icon { font-size: 38px; margin-bottom: 10px; }
  .confirm-body p { font-size: 14px; color: var(--text-2); line-height: 1.6; }
  .confirm-body strong { color: var(--text); }
`;

/* ─── Helpers ────────────────────────────────────────── */

/** Formata número para moeda BRL */
const fmtR$ = (v) =>
  `R$ ${Number(v || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

/** Formata data para pt-BR */
const fmtData = (d) => {
  if (!d) return "—";
  if (typeof d === "string" && d.includes("/")) return d; // já formatado
  try {
    const dt = d?.toDate ? d.toDate() : new Date(d);
    return dt.toLocaleDateString("pt-BR");
  } catch {
    return String(d);
  }
};

/** Gera ID de cliente no formato C0001 */
const gerarIdCliente = (cnt) =>
  `C${String(cnt + 1).padStart(4, "0")}`;

/** Filtra vendas por período */
const filtrarPorPeriodo = (vendas, periodo) => {
  if (periodo === "Tudo") return vendas;
  const agora = new Date();
  const inicio = new Date();
  if      (periodo === "Hoje")     { inicio.setHours(0, 0, 0, 0); }
  else if (periodo === "7 dias")   { inicio.setDate(agora.getDate() - 7); }
  else if (periodo === "30 dias")  { inicio.setDate(agora.getDate() - 30); }
  else if (periodo === "Este mês") { inicio.setDate(1); inicio.setHours(0, 0, 0, 0); }
  return vendas.filter(v => {
    try {
      const dt = v.data?.toDate ? v.data.toDate() : new Date(v.data);
      return dt >= inicio;
    } catch { return true; }
  });
};

const PERIODS_HIST = ["Tudo", "Hoje", "7 dias", "30 dias", "Este mês"];


/* ══════════════════════════════════════════════════════
   MODAL: Novo / Editar Cliente
   ══════════════════════════════════════════════════════ */
function ModalNovoCliente({ cliente, clientes, onSave, onClose }) {
  const isEdit = !!cliente;

  const [form, setForm] = useState({
    nome:      cliente?.nome      || "",
    telefone:  cliente?.telefone  || "",
    cpf:       cliente?.cpf       || "",
    instagram: cliente?.instagram || "",
    endereco:  cliente?.endereco  || "",
  });
  const [erros, setErros] = useState({});
  const [salvando, setSalvando] = useState(false);

  const set = (campo, valor) => {
    setForm(f => ({ ...f, [campo]: valor }));
    if (erros[campo]) setErros(e => ({ ...e, [campo]: "" }));
  };

  const validar = () => {
    const e = {};
    const nomeLimpo = form.nome.trim();

    if (!nomeLimpo)          e.nome = "Nome é obrigatório.";
    if (!form.telefone.trim()) e.telefone = "Telefone é obrigatório.";
    if (!form.cpf.trim())    e.cpf = "CPF/CNPJ é obrigatório.";

    /* Proibido cadastrar 2 clientes com nome completamente idêntico */
    if (nomeLimpo) {
      const duplicado = clientes.some(c =>
        c.nome.trim().toLowerCase() === nomeLimpo.toLowerCase() &&
        c.id !== cliente?.id
      );
      if (duplicado) e.nome = "Já existe um cliente com este nome exato.";
    }

    setErros(e);
    return Object.keys(e).length === 0;
  };

  const handleSalvar = async () => {
    if (!validar()) return;
    setSalvando(true);
    await onSave({
      nome:      form.nome.trim(),
      telefone:  form.telefone.trim(),
      cpf:       form.cpf.trim(),
      instagram: form.instagram.trim().replace(/^@/, ""),
      endereco:  form.endereco.trim(),
    });
    setSalvando(false);
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">

        <div className="modal-header">
          <div>
            <div className="modal-title">{isEdit ? "Editar Cliente" : "Novo Cliente"}</div>
            <div className="modal-sub">
              {isEdit ? `Editando ${cliente.id} — ${cliente.nome}` : "Preencha os dados do novo cliente"}
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>
            <X size={14} color="var(--text-2)" />
          </button>
        </div>

        <div className="modal-body">

          {/* Nome */}
          <div className="form-group">
            <label className="form-label">
              Nome <span className="form-label-req">*</span>
            </label>
            <input
              className={`form-input ${erros.nome ? "err" : ""}`}
              value={form.nome}
              onChange={e => set("nome", e.target.value)}
              placeholder="Nome completo"
              autoFocus
            />
            {erros.nome && <div className="form-error">{erros.nome}</div>}
          </div>

          {/* Telefone + CPF */}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">
                Telefone <span className="form-label-req">*</span>
              </label>
              <input
                className={`form-input ${erros.telefone ? "err" : ""}`}
                value={form.telefone}
                onChange={e => set("telefone", e.target.value)}
                placeholder="(62) 99999-9999"
              />
              {erros.telefone && <div className="form-error">{erros.telefone}</div>}
            </div>
            <div className="form-group">
              <label className="form-label">
                CPF / CNPJ <span className="form-label-req">*</span>
              </label>
              <input
                className={`form-input ${erros.cpf ? "err" : ""}`}
                value={form.cpf}
                onChange={e => set("cpf", e.target.value)}
                placeholder="000.000.000-00"
              />
              {erros.cpf && <div className="form-error">{erros.cpf}</div>}
            </div>
          </div>

          {/* Instagram + Endereço */}
          <div className="form-row">
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Instagram</label>
              <input
                className="form-input"
                value={form.instagram}
                onChange={e => set("instagram", e.target.value)}
                placeholder="@usuario"
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Endereço</label>
              <input
                className="form-input"
                value={form.endereco}
                onChange={e => set("endereco", e.target.value)}
                placeholder="Rua, número, bairro"
              />
            </div>
          </div>

        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" onClick={handleSalvar} disabled={salvando}>
            {salvando ? "Salvando..." : isEdit ? "Salvar Alterações" : "Cadastrar Cliente"}
          </button>
        </div>

      </div>
    </div>
  );
}


/* ══════════════════════════════════════════════════════
   MODAL: Detalhe de Venda
   ══════════════════════════════════════════════════════ */
function ModalDetalheVenda({ venda, onClose }) {
  if (!venda) return null;

  const itens = venda.itens || [];

  /* Cálculos do rodapé */
  const subtotal   = itens.reduce((s, i) => s + (i.preco || 0) * (i.qtd || 1), 0);
  const descontos  = itens.reduce((s, i) => s + (i.desconto || 0), 0);
  const custoTotal = itens.reduce((s, i) => s + (i.custo || 0) * (i.qtd || 1), 0);
  const total      = typeof venda.total === "number" ? venda.total : subtotal - descontos;
  const lucro      = total - custoTotal;

  return (
    <div className="modal-overlay modal-overlay-top" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box modal-box-lg">

        <div className="modal-header">
          <div>
            <div className="modal-title" style={{ color: "var(--gold)" }}>{venda.id}</div>
            <div className="modal-sub">Detalhes da venda</div>
          </div>
          <button className="modal-close" onClick={onClose}>
            <X size={14} color="var(--text-2)" />
          </button>
        </div>

        <div className="modal-body">

          {/* Metadados */}
          <div className="vd-meta">
            <div className="vd-meta-row">Cliente: <strong>{venda.cliente || "—"}</strong></div>
            <div className="vd-meta-row">Data: <strong>{fmtData(venda.data)}</strong></div>
            <div className="vd-meta-row">Pagamento: <strong>{venda.formaPagamento || "—"}</strong></div>
          </div>

          <button className="btn-imprimir" onClick={() => window.print()}>
            <Printer size={13} /> Imprimir
          </button>

          {/* Tabela de itens */}
          <div className="vd-table">
            <div className="vd-thead">
              <span>PRODUTO</span>
              <span style={{ textAlign: "center" }}>QTD</span>
              <span style={{ textAlign: "right" }}>PREÇO UNIT.</span>
              <span style={{ textAlign: "right" }}>CUSTO UNIT.</span>
              <span style={{ textAlign: "right" }}>DESCONTO</span>
              <span style={{ textAlign: "right" }}>TOTAL ITEM</span>
            </div>

            {itens.length === 0 ? (
              <div style={{ padding: "18px", textAlign: "center", color: "var(--text-3)", fontSize: 12 }}>
                Nenhum item registrado nesta venda.
              </div>
            ) : itens.map((item, i) => {
              const totalItem = (item.preco || 0) * (item.qtd || 1) - (item.desconto || 0);
              return (
                <div key={i} className="vd-trow">
                  <span className="vd-nome">{item.nome || item.produto || "—"}</span>
                  <span style={{ textAlign: "center" }}>{item.qtd || 1}</span>
                  <span style={{ textAlign: "right" }}>{fmtR$(item.preco)}</span>
                  <span style={{ textAlign: "right", color: "var(--red)" }}>{fmtR$(item.custo)}</span>
                  <span style={{ textAlign: "right" }}>
                    {item.desconto ? fmtR$(item.desconto) : "—"}
                  </span>
                  <span style={{ textAlign: "right", color: "var(--green)", fontFamily: "Sora, sans-serif", fontWeight: 500 }}>
                    {fmtR$(totalItem)}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Totais */}
          <div className="vd-totals">
            <div className="vd-total-cell">
              <div className="vd-total-label">Subtotal</div>
              <div className="vd-total-val" style={{ color: "var(--text)" }}>{fmtR$(subtotal)}</div>
            </div>
            <div className="vd-total-cell">
              <div className="vd-total-label">Descontos</div>
              <div className="vd-total-val" style={{ color: "var(--red)" }}>{fmtR$(descontos)}</div>
            </div>
            <div className="vd-total-cell">
              <div className="vd-total-label">Custo Total</div>
              <div className="vd-total-val" style={{ color: "var(--red)" }}>{fmtR$(custoTotal)}</div>
            </div>
            <div className="vd-total-cell">
              <div className="vd-total-label">Total</div>
              <div className="vd-total-val" style={{ color: "var(--green)" }}>{fmtR$(total)}</div>
            </div>
            <div className="vd-total-cell">
              <div className="vd-total-label">Lucro Est.</div>
              <div className="vd-total-val" style={{ color: "var(--gold)" }}>{fmtR$(lucro)}</div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}


/* ══════════════════════════════════════════════════════
   MODAL: Histórico de Compras do Cliente
   ══════════════════════════════════════════════════════ */
function ModalHistorico({ cliente, vendas, onClose, onVerVenda }) {
  const [period, setPeriod] = useState("Tudo");

  /* Filtra as vendas deste cliente */
  const vendasCliente = useMemo(() =>
    vendas.filter(v =>
      v.cliente?.trim().toLowerCase() === cliente.nome.trim().toLowerCase()
    ),
    [vendas, cliente.nome]
  );

  const vendasFiltradas = useMemo(() =>
    filtrarPorPeriodo(vendasCliente, period),
    [vendasCliente, period]
  );

  /* KPIs */
  const totalGasto = vendasFiltradas.reduce((s, v) => s + (v.total || 0), 0);
  const totalItens = vendasFiltradas.reduce((s, v) => s + (v.itens?.length || 0), 0);

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box modal-box-lg" style={{ maxWidth: 580 }}>

        <div className="modal-header">
          <div>
            <div className="modal-title">{cliente.nome}</div>
            <div className="modal-sub">
              {[cliente.telefone, cliente.cpf].filter(Boolean).join(" · ")}
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>
            <X size={14} color="var(--text-2)" />
          </button>
        </div>

        <div className="modal-body">

          {/* KPI cards */}
          <div className="hist-kpis">
            <div className="hist-kpi">
              <div className="hist-kpi-label">Compras</div>
              <div className="hist-kpi-val" style={{ color: "var(--text)" }}>
                {vendasFiltradas.length}
              </div>
            </div>
            <div className="hist-kpi">
              <div className="hist-kpi-label">Total Gasto</div>
              <div className="hist-kpi-val" style={{ color: "var(--green)" }}>
                {fmtR$(totalGasto)}
              </div>
            </div>
            <div className="hist-kpi">
              <div className="hist-kpi-label">Itens Comprados</div>
              <div className="hist-kpi-val" style={{ color: "var(--gold)" }}>
                {totalItens}
              </div>
            </div>
          </div>

          {/* Filtro de período */}
          <div className="hist-periods">
            {PERIODS_HIST.map(p => (
              <button
                key={p}
                className={`hist-period-btn ${period === p ? "active" : ""}`}
                onClick={() => setPeriod(p)}
              >{p}</button>
            ))}
          </div>

          {/* Label */}
          <div className="hist-section-label">Histórico de Compras</div>

          {/* Lista de vendas */}
          {vendasFiltradas.length === 0 ? (
            <div className="hist-empty">Nenhuma venda encontrada neste período.</div>
          ) : vendasFiltradas.map((v, i) => (
            <div key={i} className="hist-row" onClick={() => onVerVenda(v)}>
              <span className="hist-venda-id">{v.id}</span>
              <span className="hist-venda-data">{fmtData(v.data)}</span>
              {v.formaPagamento && <span className="hist-fp">{v.formaPagamento}</span>}
              <span className="hist-total">{fmtR$(v.total)}</span>
              <ChevronRight size={14} color="var(--text-3)" />
            </div>
          ))}

        </div>
      </div>
    </div>
  );
}


/* ══════════════════════════════════════════════════════
   MODAL: Confirmar Exclusão
   ══════════════════════════════════════════════════════ */
function ModalConfirmDelete({ cliente, onConfirm, onClose }) {
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
          <div className="modal-title">Excluir Cliente</div>
          <button className="modal-close" onClick={onClose}>
            <X size={14} color="var(--text-2)" />
          </button>
        </div>
        <div className="confirm-body">
          <div className="confirm-icon">🗑️</div>
          <p>
            Tem certeza que deseja excluir{" "}
            <strong>{cliente.nome}</strong>?<br />
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


/* ══════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL — Clientes
   ══════════════════════════════════════════════════════ */
export default function Clientes() {
  const [clientes,       setClientes]       = useState([]);
  const [vendas,         setVendas]         = useState([]);
  const [clienteIdCnt,   setClienteIdCnt]   = useState(0);
  const [search,         setSearch]         = useState("");
  const [loading,        setLoading]        = useState(true);

  /* Estados dos modais */
  const [modalNovo,      setModalNovo]      = useState(false);
  const [editando,       setEditando]       = useState(null);  // cliente em edição
  const [deletando,      setDeletando]      = useState(null);  // cliente a excluir
  const [historico,      setHistorico]      = useState(null);  // cliente com histórico aberto
  const [vendaDetalhe,   setVendaDetalhe]   = useState(null);  // venda aberta em detalhe

  const uid = getAuth().currentUser?.uid;

  /* ── Listener Firestore em tempo real ── */
  useEffect(() => {
    if (!uid) { setLoading(false); return; }
    const ref = doc(db, "dados", uid);
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setClientes(data.clientes    || []);
        setVendas(data.vendas        || []);
        setClienteIdCnt(data.clienteIdCnt || 0);
      }
      setLoading(false);
    }, (err) => {
      console.error("Clientes — erro Firestore:", err);
      setLoading(false);
    });
    return () => unsub();
  }, [uid]);

  /* ── Salvar no Firestore (merge parcial) ── */
  const salvar = async (novosClientes, novoCnt) => {
    if (!uid) return;
    await setDoc(
      doc(db, "dados", uid),
      {
        clientes:  novosClientes,
        updatedAt: new Date(),
        ...(novoCnt !== undefined && { clienteIdCnt: novoCnt }),
      },
      { merge: true }
    );
  };

  /* ── CRUD ── */
  const handleAdd = async (form) => {
    const id          = gerarIdCliente(clienteIdCnt);
    const novo        = { ...form, id, criadoEm: new Date().toISOString() };
    const lista       = [...clientes, novo];
    await salvar(lista, clienteIdCnt + 1);
    setModalNovo(false);
  };

  const handleEdit = async (form) => {
    const lista = clientes.map(c =>
      c.id === editando.id ? { ...c, ...form } : c
    );
    await salvar(lista);
    setEditando(null);
  };

  const handleDelete = async () => {
    const lista = clientes.filter(c => c.id !== deletando.id);
    await salvar(lista);
    setDeletando(null);
  };

  /* ── Busca ── */
  const clientesFiltrados = useMemo(() => {
    if (!search.trim()) return clientes;
    const q = search.toLowerCase();
    return clientes.filter(c =>
      c.nome?.toLowerCase().includes(q) ||
      c.cpf?.toLowerCase().includes(q)  ||
      c.telefone?.toLowerCase().includes(q)
    );
  }, [clientes, search]);


  /* ═══════════════════════════════ RENDER ═══════════════ */
  return (
    <>
      <style>{CSS}</style>

      {/* ── Topbar ── */}
     <header className="ag-topbar ag-topbar-centered">
  <div className="ag-topbar-title">
    <h1>Clientes</h1>
    <p>Gerencie e acompanhe sua base de clientes</p>
  </div>
  {/* search + botão — ficam à direita normalmente */}
</header>

      {/* ── Conteúdo ── */}
      <div className="ag-content">
        <div className="cl-table-wrap">

          {/* Cabeçalho da tabela */}
          <div className="cl-table-header">
            <span className="cl-table-title">Clientes cadastrados</span>
            <span className="cl-count-badge">{clientes.length}</span>
          </div>

          {/* Linha de títulos */}
          <div className="cl-row cl-row-head">
            <span>ID</span>
            <span>Nome</span>
            <span>Telefone</span>
            <span>CPF / CNPJ</span>
            <span>Instagram</span>
            <span>Endereço</span>
            <span style={{ textAlign: "right" }}>Ações</span>
          </div>

          {/* Estados: loading / vazio / lista */}
          {loading ? (
            <div className="cl-loading">Carregando clientes...</div>
          ) : clientesFiltrados.length === 0 ? (
            <div className="cl-empty">
              <p>
                {search
                  ? `Nenhum resultado para "${search}".`
                  : "Nenhum cliente cadastrado ainda. Clique em + Novo Cliente para começar."}
              </p>
            </div>
          ) : clientesFiltrados.map(c => (
            <div key={c.id} className="cl-row">
              <span className="cl-id">{c.id}</span>
              <span className="cl-nome" onClick={() => setHistorico(c)}>{c.nome}</span>
              <span>{c.telefone || "—"}</span>
              <span>{c.cpf || "—"}</span>
              <span className="cl-insta">{c.instagram ? `@${c.instagram}` : "—"}</span>
              <span className="cl-overflow">{c.endereco || "—"}</span>
              <div className="cl-actions">
                <button
                  className="btn-icon btn-icon-edit"
                  onClick={() => setEditando(c)}
                  title="Editar cliente"
                >
                  <Edit2 size={13} />
                </button>
                <button
                  className="btn-icon btn-icon-del"
                  onClick={() => setDeletando(c)}
                  title="Excluir cliente"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}

        </div>
      </div>

      {/* ═══════ MODAIS ═══════ */}

      {/* Novo cliente */}
      {modalNovo && (
        <ModalNovoCliente
          clientes={clientes}
          onSave={handleAdd}
          onClose={() => setModalNovo(false)}
        />
      )}

      {/* Editar cliente */}
      {editando && (
        <ModalNovoCliente
          cliente={editando}
          clientes={clientes}
          onSave={handleEdit}
          onClose={() => setEditando(null)}
        />
      )}

      {/* Confirmar exclusão */}
      {deletando && (
        <ModalConfirmDelete
          cliente={deletando}
          onConfirm={handleDelete}
          onClose={() => setDeletando(null)}
        />
      )}

      {/* Histórico do cliente */}
      {historico && (
        <ModalHistorico
          cliente={historico}
          vendas={vendas}
          onClose={() => setHistorico(null)}
          onVerVenda={(v) => setVendaDetalhe(v)}
        />
      )}

      {/* Detalhe da venda (empilhado sobre histórico) */}
      {vendaDetalhe && (
        <ModalDetalheVenda
          venda={vendaDetalhe}
          onClose={() => setVendaDetalhe(null)}
        />
      )}
    </>
  );
}
