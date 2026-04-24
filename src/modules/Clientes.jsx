/* ═══════════════════════════════════════════════════
   ASSENT v2.0 — Clientes.jsx
   Estrutura: users/{uid}/clientes/{id}
   Exibe todos os perfis (cliente e aluno) com badge visual.
   Filtro por perfil na topbar.
   ═══════════════════════════════════════════════════ */

import { useState, useEffect, useMemo } from "react";
import {
  Search, UserPlus, Edit2, Trash2, X, ChevronRight, Printer,
  GraduationCap,
} from "lucide-react";

import { db } from "../lib/firebase";
import { logAction, LOG_ACAO, LOG_MODULO, montarDescricao } from "../lib/logAction";
import { useAuth } from "../contexts/AuthContext";
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
} from "firebase/firestore";

/* ── CSS ── */
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

  .btn-primary {
    padding: 9px 20px; border-radius: 9px;
    background: var(--gold); color: #0a0808;
    border: none; cursor: pointer;
    font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 600;
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
  .btn-novo-cl {
    display: flex; align-items: center; gap: 7px;
    padding: 8px 16px; border-radius: 9px;
    background: var(--gold); color: #0a0808;
    border: none; cursor: pointer;
    font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 600;
    white-space: nowrap; transition: opacity .13s, transform .1s;
  }
  .btn-novo-cl:hover { opacity: .88; }

  /* ── Topbar ── */
  .cl-topbar {
    padding: 14px 22px;
    background: var(--s1); border-bottom: 1px solid var(--border);
    display: flex; align-items: center; gap: 12px; flex-shrink: 0; flex-wrap: wrap;
  }
  .cl-topbar-title h1 {
    font-family: 'Sora', sans-serif; font-size: 17px; font-weight: 600; color: var(--text);
  }
  .cl-topbar-title p { font-size: 11px; color: var(--text-2); margin-top: 2px; }
  .cl-search {
    display: flex; align-items: center; gap: 8px;
    background: var(--s2); border: 1px solid var(--border);
    border-radius: 8px; padding: 8px 12px; width: 240px;
  }
  .cl-search input {
    background: transparent; border: none; outline: none;
    color: var(--text); font-size: 12px; width: 100%;
    font-family: 'DM Sans', sans-serif;
  }

  /* ── Filtros de perfil ── */
  .cl-perfil-filters { display: flex; gap: 5px; }
  .cl-pfbtn {
    padding: 5px 11px; border-radius: 6px; font-size: 11px; font-weight: 500;
    background: var(--s3); border: 1px solid var(--border);
    color: var(--text-2); cursor: pointer; transition: all .13s;
    font-family: 'DM Sans', sans-serif; white-space: nowrap;
  }
  .cl-pfbtn:hover { background: var(--s2); color: var(--text); }
  .cl-pfbtn.active {
    background: rgba(200,165,94,0.15); border-color: var(--gold); color: var(--gold);
  }

  /* ── Tabela ── */
  .cl-table-wrap {
    background: var(--s1); border: 1px solid var(--border);
    border-radius: 12px; overflow: hidden;
  }
  .cl-table-header {
    padding: 13px 18px;
    border-bottom: 1px solid var(--border);
    display: flex; align-items: center; justify-content: space-between;
  }
  .cl-count-badge {
    font-family: 'Sora', sans-serif; font-size: 12px; font-weight: 600;
    background: var(--s3); border: 1px solid var(--border-h);
    color: var(--text-2); padding: 2px 10px; border-radius: 20px;
  }

  /* grid: ID | nome | telefone | doc | perfil | instagram | endereço | ações */
  .cl-row {
    display: grid;
    grid-template-columns: 80px 1fr 130px 140px 90px 130px 1fr 78px;
    padding: 11px 18px; gap: 8px;
    border-bottom: 1px solid var(--border);
    align-items: center; font-size: 12px; color: var(--text-2);
  }
  .cl-row:hover { background: rgba(255,255,255,0.02); }
  .cl-row-head { background: var(--s2); }
  .cl-row-head span {
    font-size: 10px; font-weight: 500; letter-spacing: .06em;
    text-transform: uppercase; color: var(--text-3);
  }
  .cl-id { font-family: 'Sora', sans-serif; font-size: 11px; color: var(--gold); font-weight: 500; }
  .cl-nome { color: var(--text); font-size: 13px; font-weight: 500; cursor: pointer; }
  .cl-nome:hover { color: var(--gold); text-decoration: underline; }
  .cl-insta { color: var(--blue); }
  .cl-overflow { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .cl-actions { display: flex; align-items: center; gap: 5px; justify-content: flex-end; }

  /* Badge de perfil */
  .cl-badge-aluno {
    display: inline-flex; align-items: center; gap: 4px;
    padding: 2px 7px; border-radius: 20px; font-size: 10px; font-weight: 600;
    background: rgba(200,165,94,0.12); border: 1px solid rgba(200,165,94,.3);
    color: var(--gold); white-space: nowrap;
  }
  .cl-badge-cliente {
    display: inline-flex; align-items: center; gap: 4px;
    padding: 2px 7px; border-radius: 20px; font-size: 10px; font-weight: 600;
    background: var(--s3); border: 1px solid var(--border);
    color: var(--text-3); white-space: nowrap;
  }
  .cl-badge-ambos {
    display: inline-flex; align-items: center; gap: 4px;
    padding: 2px 7px; border-radius: 20px; font-size: 10px; font-weight: 600;
    background: rgba(91,142,240,0.12); border: 1px solid rgba(91,142,240,.3);
    color: var(--blue); white-space: nowrap;
  }

  .cl-empty, .cl-loading { padding: 56px 20px; text-align: center; color: var(--text-3); }

  /* ── Modal Histórico ── */
  .hist-kpis {
    display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 18px;
  }
  .hist-kpi { background: var(--s2); border: 1px solid var(--border); border-radius: 10px; padding: 13px 16px; }
  .hist-kpi-label {
    font-size: 10px; font-weight: 600; text-transform: uppercase;
    letter-spacing: .07em; color: var(--text-3); margin-bottom: 6px;
  }
  .hist-kpi-val { font-family: 'Sora', sans-serif; font-size: 18px; font-weight: 700; }
  .hist-periods { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 16px; }
  .hist-period-btn {
    padding: 5px 12px; border-radius: 6px; font-size: 11px; font-weight: 500;
    background: var(--s3); border: 1px solid var(--border);
    color: var(--text-2); cursor: pointer; transition: all .13s;
    font-family: 'DM Sans', sans-serif;
  }
  .hist-period-btn:hover { background: var(--s2); color: var(--text); }
  .hist-period-btn.active { background: rgba(200,165,94,0.15); border-color: var(--gold); color: var(--gold); }
  .hist-section-label {
    font-size: 10px; font-weight: 600; letter-spacing: .07em;
    text-transform: uppercase; color: var(--text-3); margin-bottom: 10px;
  }
  .hist-row {
    display: flex; align-items: center; gap: 10px;
    padding: 10px 12px; border-radius: 8px;
    background: var(--s2); border: 1px solid var(--border);
    margin-bottom: 7px; cursor: pointer; transition: border-color .13s;
  }
  .hist-row:hover { border-color: var(--border-h); }
  .hist-venda-id { font-family: 'Sora', sans-serif; font-size: 11px; color: var(--gold); font-weight: 500; min-width: 60px; }
  .hist-venda-data { font-size: 12px; color: var(--text-2); flex: 1; }
  .hist-fp { font-size: 11px; padding: 2px 8px; border-radius: 4px; background: var(--s3); border: 1px solid var(--border); color: var(--text-2); }
  .hist-total { font-family: 'Sora', sans-serif; font-size: 13px; color: var(--green); font-weight: 600; margin-left: auto; }
  .hist-empty { padding: 32px; text-align: center; color: var(--text-3); font-size: 13px; }

  /* ── Modal Detalhe Venda ── */
  .vd-meta {
    display: flex; gap: 20px; flex-wrap: wrap;
    background: var(--s2); border: 1px solid var(--border);
    border-radius: 9px; padding: 12px 15px; margin-bottom: 14px;
    font-size: 12px; color: var(--text-2);
  }
  .vd-meta-row strong { color: var(--text); }
  .btn-imprimir {
    display: flex; align-items: center; gap: 6px;
    padding: 7px 14px; border-radius: 8px; margin-bottom: 16px;
    background: var(--s3); border: 1px solid var(--border);
    color: var(--text-2); cursor: pointer; font-size: 12px;
    font-family: 'DM Sans', sans-serif; transition: all .13s;
  }
  .btn-imprimir:hover { background: var(--s2); color: var(--text); }
  .vd-table { border: 1px solid var(--border); border-radius: 9px; overflow: hidden; margin-bottom: 14px; }
  .vd-thead {
    display: grid; grid-template-columns: 1fr 60px 100px 100px 90px 100px;
    padding: 9px 14px; gap: 8px; background: var(--s2); border-bottom: 1px solid var(--border);
    font-size: 9px; font-weight: 600; letter-spacing: .07em; text-transform: uppercase; color: var(--text-3);
  }
  .vd-trow {
    display: grid; grid-template-columns: 1fr 60px 100px 100px 90px 100px;
    padding: 9px 14px; gap: 8px; border-bottom: 1px solid var(--border);
    font-size: 12px; color: var(--text-2); align-items: center;
  }
  .vd-trow:last-child { border-bottom: none; }
  .vd-nome { color: var(--text); font-size: 13px; }
  .vd-totals {
    display: flex; gap: 10px; flex-wrap: wrap;
    background: var(--s2); border: 1px solid var(--border); border-radius: 9px; padding: 12px 15px;
  }
  .vd-total-cell { flex: 1; min-width: 90px; }
  .vd-total-label {
    font-size: 10px; font-weight: 600; text-transform: uppercase;
    letter-spacing: .06em; color: var(--text-3); margin-bottom: 4px;
  }
  .vd-total-val { font-family: 'Sora', sans-serif; font-size: 15px; font-weight: 700; }
  .confirm-body {
    padding: 28px 22px; text-align: center; font-size: 13px; color: var(--text-2); line-height: 1.6;
  }
  .confirm-icon { font-size: 32px; margin-bottom: 12px; }
  .confirm-body strong { color: var(--text); }
`;

/* ── Helpers ── */
const fmtR$ = (v) =>
  `R$ ${Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

const fmtData = (d) => {
  if (!d) return "—";
  try {
    const dt = d?.toDate ? d.toDate() : new Date(d);
    return dt.toLocaleDateString("pt-BR");
  } catch {
    return String(d);
  }
};

const gerarIdCliente = (cnt) => `C${String(cnt + 1).padStart(4, "0")}`;

const PERIODS_HIST = ["Tudo", "Este mês", "Últimos 3 meses", "Este ano"];

const filtrarPorPeriodo = (vendas, period) => {
  if (period === "Tudo") return vendas;
  const now = new Date();
  return vendas.filter((v) => {
    try {
      const data = v.data?.toDate ? v.data.toDate() : new Date(v.data);
      if (isNaN(data)) return false;
      if (period === "Este mês")
        return data.getMonth() === now.getMonth() && data.getFullYear() === now.getFullYear();
      if (period === "Últimos 3 meses") {
        const diffMs = now - data;
        return diffMs >= 0 && diffMs <= 1000 * 60 * 60 * 24 * 90;
      }
      if (period === "Este ano") return data.getFullYear() === now.getFullYear();
    } catch { return false; }
    return true;
  });
};

/* ── Badge de perfil ── */
function PerfilBadge({ perfis }) {
  const isAluno   = perfis?.includes("aluno");
  const isCliente = perfis?.includes("cliente") || !perfis?.length; // docs sem perfil = cliente legado

  if (isAluno && isCliente) {
    return <span className="cl-badge-ambos"><GraduationCap size={9} /> Ambos</span>;
  }
  if (isAluno) {
    return <span className="cl-badge-aluno"><GraduationCap size={9} /> Aluno</span>;
  }
  return <span className="cl-badge-cliente">Cliente</span>;
}

/* ══════════════════════════════════════════════════
   MODAL: Novo / Editar Cliente
   ══════════════════════════════════════════════════ */
function ModalNovoCliente({ cliente, clientes, onSave, onClose }) {
  const isEdit  = !!cliente;
  const isAluno = cliente?.perfis?.includes("aluno");

  const [form, setForm] = useState({
    nome:      cliente?.nome      || "",
    telefone:  cliente?.telefone  || "",
    cpf:       cliente?.cpf       || cliente?.documento || "", // lê os dois campos para compatibilidade
    instagram: cliente?.instagram || "",
    endereco:  cliente?.endereco  || "",
  });
  const [erros, setErros]     = useState({});
  const [salvando, setSalvando] = useState(false);

  const set = (campo, valor) => {
    setForm(f => ({ ...f, [campo]: valor }));
    if (erros[campo]) setErros(e => ({ ...e, [campo]: "" }));
  };

  const validar = () => {
    const e = {};
    const nomeLimpo = form.nome.trim();
    if (!nomeLimpo)          e.nome     = "Nome é obrigatório.";
    if (!form.telefone.trim()) e.telefone = "Telefone é obrigatório.";
    if (!form.cpf.trim())    e.cpf      = "CPF/CNPJ é obrigatório.";

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
              {isEdit
                ? `Editando ${cliente.id} — ${cliente.nome}${isAluno ? " · Este cadastro é também um Aluno" : ""}`
                : "Preencha os dados do novo cliente"}
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>
            <X size={14} color="var(--text-2)" />
          </button>
        </div>

        <div className="modal-body">
          {/* Aviso quando editar um aluno via Clientes.jsx */}
          {isAluno && (
            <div style={{
              background: "rgba(200,165,94,.08)", border: "1px solid rgba(200,165,94,.25)",
              borderRadius: 9, padding: "10px 14px", marginBottom: 16,
              fontSize: 12, color: "var(--gold)", display: "flex", alignItems: "center", gap: 8,
            }}>
              <GraduationCap size={13} />
              Dados de mensalidade deste aluno são gerenciados no módulo de Matrículas.
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Nome <span className="form-label-req">*</span></label>
            <input className={`form-input ${erros.nome ? "err" : ""}`}
              value={form.nome} onChange={e => set("nome", e.target.value)}
              placeholder="Nome completo" autoFocus />
            {erros.nome && <div className="form-error">{erros.nome}</div>}
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Telefone <span className="form-label-req">*</span></label>
              <input className={`form-input ${erros.telefone ? "err" : ""}`}
                value={form.telefone} onChange={e => set("telefone", e.target.value)}
                placeholder="(62) 99999-9999" />
              {erros.telefone && <div className="form-error">{erros.telefone}</div>}
            </div>
            <div className="form-group">
              <label className="form-label">CPF / CNPJ <span className="form-label-req">*</span></label>
              <input className={`form-input ${erros.cpf ? "err" : ""}`}
                value={form.cpf} onChange={e => set("cpf", e.target.value)}
                placeholder="000.000.000-00" />
              {erros.cpf && <div className="form-error">{erros.cpf}</div>}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Instagram</label>
              <input className="form-input"
                value={form.instagram} onChange={e => set("instagram", e.target.value)}
                placeholder="@usuario" />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Endereço</label>
              <input className="form-input"
                value={form.endereco} onChange={e => set("endereco", e.target.value)}
                placeholder="Rua, número, bairro" />
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

/* ══════════════════════════════════════════════════
   MODAL: Detalhe de Venda
   ══════════════════════════════════════════════════ */
function ModalDetalheVenda({ venda, onClose }) {
  if (!venda) return null;
  const itens      = venda.itens || [];
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
          <button className="modal-close" onClick={onClose}><X size={14} color="var(--text-2)" /></button>
        </div>
        <div className="modal-body">
          <div className="vd-meta">
            <div className="vd-meta-row">Cliente: <strong>{venda.cliente || "—"}</strong></div>
            <div className="vd-meta-row">Data: <strong>{fmtData(venda.data)}</strong></div>
            <div className="vd-meta-row">Pagamento: <strong>{venda.formaPagamento || "—"}</strong></div>
          </div>
          <button className="btn-imprimir" onClick={() => window.print()}>
            <Printer size={13} /> Imprimir
          </button>
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
                  <span style={{ textAlign: "right" }}>{item.desconto ? fmtR$(item.desconto) : "—"}</span>
                  <span style={{ textAlign: "right", color: "var(--green)", fontFamily: "Sora, sans-serif", fontWeight: 500 }}>{fmtR$(totalItem)}</span>
                </div>
              );
            })}
          </div>
          <div className="vd-totals">
            <div className="vd-total-cell"><div className="vd-total-label">Subtotal</div><div className="vd-total-val" style={{ color: "var(--text)" }}>{fmtR$(subtotal)}</div></div>
            <div className="vd-total-cell"><div className="vd-total-label">Descontos</div><div className="vd-total-val" style={{ color: "var(--red)" }}>{fmtR$(descontos)}</div></div>
            <div className="vd-total-cell"><div className="vd-total-label">Custo Total</div><div className="vd-total-val" style={{ color: "var(--red)" }}>{fmtR$(custoTotal)}</div></div>
            <div className="vd-total-cell"><div className="vd-total-label">Total</div><div className="vd-total-val" style={{ color: "var(--green)" }}>{fmtR$(total)}</div></div>
            <div className="vd-total-cell"><div className="vd-total-label">Lucro Est.</div><div className="vd-total-val" style={{ color: "var(--gold)" }}>{fmtR$(lucro)}</div></div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════
   MODAL: Histórico de Compras
   ══════════════════════════════════════════════════ */
function ModalHistorico({ cliente, vendas, onClose, onVerVenda }) {
  const [period, setPeriod] = useState("Tudo");

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

  const totalGasto = vendasFiltradas.reduce((s, v) => s + (v.total || 0), 0);
  const totalItens = vendasFiltradas.reduce((s, v) => s + (v.itens?.length || 0), 0);

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box modal-box-lg" style={{ maxWidth: 580 }}>
        <div className="modal-header">
          <div>
            <div className="modal-title">{cliente.nome}</div>
            <div className="modal-sub">
              {[cliente.telefone, cliente.cpf || cliente.documento].filter(Boolean).join(" · ")}
            </div>
          </div>
          <button className="modal-close" onClick={onClose}><X size={14} color="var(--text-2)" /></button>
        </div>
        <div className="modal-body">
          <div className="hist-kpis">
            <div className="hist-kpi">
              <div className="hist-kpi-label">Compras</div>
              <div className="hist-kpi-val" style={{ color: "var(--text)" }}>{vendasFiltradas.length}</div>
            </div>
            <div className="hist-kpi">
              <div className="hist-kpi-label">Total Gasto</div>
              <div className="hist-kpi-val" style={{ color: "var(--green)" }}>{fmtR$(totalGasto)}</div>
            </div>
            <div className="hist-kpi">
              <div className="hist-kpi-label">Itens Comprados</div>
              <div className="hist-kpi-val" style={{ color: "var(--gold)" }}>{totalItens}</div>
            </div>
          </div>
          <div className="hist-periods">
            {PERIODS_HIST.map(p => (
              <button key={p} className={`hist-period-btn ${period === p ? "active" : ""}`}
                onClick={() => setPeriod(p)}>{p}</button>
            ))}
          </div>
          <div className="hist-section-label">Histórico de Compras</div>
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

/* ══════════════════════════════════════════════════
   MODAL: Confirmar Exclusão
   ══════════════════════════════════════════════════ */
function ModalConfirmDelete({ cliente, onConfirm, onClose }) {
  const [excluindo, setExcluindo] = useState(false);

  const handleConfirm = async () => {
    setExcluindo(true);
    await onConfirm();
    setExcluindo(false);
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 400 }}>
        <div className="modal-header">
          <div className="modal-title">Excluir Cliente</div>
          <button className="modal-close" onClick={onClose}><X size={14} color="var(--text-2)" /></button>
        </div>
        <div className="confirm-body">
          <div className="confirm-icon">🗑️</div>
          <p>
            Tem certeza que deseja excluir <strong>{cliente.nome}</strong>?<br />
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
   COMPONENTE PRINCIPAL
   ══════════════════════════════════════════════════ */

/* Opções de filtro de perfil */
const PERFIL_OPCOES = [
  { key: "todos",   label: "Todos"    },
  { key: "cliente", label: "Clientes" },
  { key: "aluno",   label: "Alunos"   },
  { key: "ambos",   label: "Ambos"    },
];

export default function Clientes() {
  const { tenantUid, cargo, nomeUsuario, podeCriar, podeEditar, podeExcluir } = useAuth();

  const podeCriarV   = podeCriar("clientes");
  const podeEditarV  = podeEditar("clientes");
  const podeExcluirV = podeExcluir("clientes");

  const [clientes,     setClientes]     = useState([]);
  const [vendas,       setVendas]       = useState([]);
  const [clienteIdCnt, setClienteIdCnt] = useState(0);
  const [search,       setSearch]       = useState("");
  const [perfilFilter, setPerfilFilter] = useState("todos");
  const [loading,      setLoading]      = useState(true);

  const [modalNovo,    setModalNovo]    = useState(false);
  const [editando,     setEditando]     = useState(null);
  const [deletando,    setDeletando]    = useState(null);
  const [historico,    setHistorico]    = useState(null);
  const [vendaDetalhe, setVendaDetalhe] = useState(null);

  /* ── Firestore listeners ── */
  useEffect(() => {
    if (!tenantUid) { setLoading(false); return; }

    const userRef     = doc(db, "users", tenantUid);
    const clientesCol = collection(db, "users", tenantUid, "clientes");
    const vendasCol   = collection(db, "users", tenantUid, "vendas");

    const unsubUser = onSnapshot(userRef, (snap) => {
      if (snap.exists()) setClienteIdCnt(snap.data().clienteIdCnt || 0);
    });

    const unsubClientes = onSnapshot(clientesCol, (snap) => {
      setClientes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });

    const unsubVendas = onSnapshot(vendasCol, (snap) => {
      setVendas(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => { unsubUser(); unsubClientes(); unsubVendas(); };
  }, [tenantUid]);

  const handleAdd = async (form) => {
    if (!tenantUid) return;
    const newId = gerarIdCliente(clienteIdCnt);
    await setDoc(doc(db, "users", tenantUid, "clientes", newId), {
      ...form,
      perfis: ["cliente"],
      criadoEm: new Date().toISOString(),
    });
    await setDoc(doc(db, "users", tenantUid), { clienteIdCnt: clienteIdCnt + 1 }, { merge: true });
    await logAction({ tenantUid, nomeUsuario, cargo, acao: LOG_ACAO.CRIAR, modulo: LOG_MODULO.CLIENTES, descricao: montarDescricao("criar", "Cliente", form.nome, newId) });
    setModalNovo(false);
  };

  const handleEdit = async (form) => {
    if (!tenantUid || !editando) return;
    await setDoc(doc(db, "users", tenantUid, "clientes", editando.id), form, { merge: true });
    await logAction({ tenantUid, nomeUsuario, cargo, acao: LOG_ACAO.EDITAR, modulo: LOG_MODULO.CLIENTES, descricao: montarDescricao("editar", "Cliente", form.nome, editando.id) });
    setEditando(null);
  };

  const handleDelete = async () => {
    if (!tenantUid || !deletando) return;
    await deleteDoc(doc(db, "users", tenantUid, "clientes", deletando.id));
    await logAction({ tenantUid, nomeUsuario, cargo, acao: LOG_ACAO.EXCLUIR, modulo: LOG_MODULO.CLIENTES, descricao: montarDescricao("excluir", "Cliente", deletando.nome, deletando.id) });
    setDeletando(null);
  };

  const clientesFiltrados = useMemo(() => {
    const q = search.trim().toLowerCase();

    return clientes.filter(c => {
      /* ── Filtro de perfil ── */
      if (perfilFilter !== "todos") {
        const isAluno   = c.perfis?.includes("aluno");
        const isCliente = c.perfis?.includes("cliente") || !c.perfis?.length;
        const isAmbos   = isAluno && isCliente;

        if (perfilFilter === "aluno"   && !isAluno)           return false;
        if (perfilFilter === "cliente" && (!isCliente || isAmbos)) return false;
        if (perfilFilter === "ambos"   && !isAmbos)           return false;
      }

      /* ── Filtro de busca ── */
      if (!q) return true;
      const doc = c.cpf || c.documento || "";
      return (
        c.nome?.toLowerCase().includes(q) ||
        doc.toLowerCase().includes(q) ||
        c.telefone?.toLowerCase().includes(q)
      );
    });
  }, [clientes, search, perfilFilter]);

  /* Contadores por perfil para exibir nos botões */
  const contadores = useMemo(() => {
    const alunos   = clientes.filter(c => c.perfis?.includes("aluno")).length;
    const clts     = clientes.filter(c => c.perfis?.includes("cliente") && !c.perfis?.includes("aluno")).length;
    const ambos    = clientes.filter(c => c.perfis?.includes("aluno") && c.perfis?.includes("cliente")).length;
    const legados  = clientes.filter(c => !c.perfis?.length).length; // docs sem perfil (legado)
    return { alunos, clientes: clts + legados, ambos };
  }, [clientes]);

  return (
    <>
      <style>{CSS}</style>

      <header className="cl-topbar">
        <div className="cl-topbar-title">
          <h1>Clientes</h1>
          <p>Base unificada de clientes e alunos</p>
        </div>

        {/* Busca */}
        <div className="cl-search">
          <Search size={13} color="var(--text-3)" />
          <input
            placeholder="Buscar por nome, CPF ou telefone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Filtros de perfil */}
        <div className="cl-perfil-filters">
          {PERFIL_OPCOES.map(op => (
            <button
              key={op.key}
              className={`cl-pfbtn ${perfilFilter === op.key ? "active" : ""}`}
              onClick={() => setPerfilFilter(op.key)}
            >
              {op.label}
              {op.key === "aluno"   && contadores.alunos  > 0 && ` (${contadores.alunos})`}
              {op.key === "cliente" && contadores.clientes > 0 && ` (${contadores.clientes})`}
              {op.key === "ambos"   && contadores.ambos   > 0 && ` (${contadores.ambos})`}
            </button>
          ))}
        </div>

        {podeCriarV && (
          <button className="btn-novo-cl" onClick={() => setModalNovo(true)}>
            <UserPlus size={14} /> Novo Cliente
          </button>
        )}
      </header>

      <div className="ag-content">
        <div className="cl-table-wrap">
          <div className="cl-table-header">
            <span className="cl-table-title">Cadastros</span>
            <span className="cl-count-badge">{clientesFiltrados.length}</span>
          </div>

          <div className="cl-row cl-row-head">
            <span>ID</span>
            <span>Nome</span>
            <span>Telefone</span>
            <span>CPF / CNPJ</span>
            <span>Perfil</span>
            <span>Instagram</span>
            <span>Endereço</span>
            <span style={{ textAlign: "right" }}>Ações</span>
          </div>

          {loading ? (
            <div className="cl-loading">Carregando clientes...</div>
          ) : clientesFiltrados.length === 0 ? (
            <div className="cl-empty">
              <p>
                {search || perfilFilter !== "todos"
                  ? "Nenhum resultado para os filtros aplicados."
                  : "Nenhum cliente cadastrado ainda."}
              </p>
            </div>
          ) : (
            clientesFiltrados.map((c) => (
              <div key={c.id} className="cl-row">
                <span className="cl-id">{c.idSeqFmt || c.id}</span>
                <span className="cl-nome" onClick={() => setHistorico(c)}>{c.nome}</span>
                <span>{c.telefone || "—"}</span>
                <span>{c.cpf || c.documento || "—"}</span>
                <span><PerfilBadge perfis={c.perfis} /></span>
                <span className="cl-insta">{c.instagram ? `@${c.instagram}` : "—"}</span>
                <span className="cl-overflow">{c.endereco || "—"}</span>
                <div className="cl-actions">
                  {podeEditarV && (
                    <button className="btn-icon btn-icon-edit" onClick={() => setEditando(c)}>
                      <Edit2 size={13} />
                    </button>
                  )}
                  {podeExcluirV && (
                    <button className="btn-icon btn-icon-del" onClick={() => setDeletando(c)}>
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {modalNovo    && podeCriarV   && <ModalNovoCliente clientes={clientes} onSave={handleAdd}  onClose={() => setModalNovo(false)} />}
      {editando     && podeEditarV  && <ModalNovoCliente cliente={editando} clientes={clientes} onSave={handleEdit} onClose={() => setEditando(null)} />}
      {deletando    && podeExcluirV && <ModalConfirmDelete cliente={deletando} onConfirm={handleDelete} onClose={() => setDeletando(null)} />}
      {historico    && <ModalHistorico cliente={historico} vendas={vendas} onClose={() => setHistorico(null)} onVerVenda={setVendaDetalhe} />}
      {vendaDetalhe && <ModalDetalheVenda venda={vendaDetalhe} onClose={() => setVendaDetalhe(null)} />}
    </>
  );
}
