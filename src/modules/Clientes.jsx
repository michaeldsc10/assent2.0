/* ═══════════════════════════════════════════════════
   ASSENT v2.0 — Clientes.jsx [CORRIGIDO]
   Estrutura: users/{uid}/clientes/{id}
   Exibe todos os perfis (cliente e aluno) com badge visual.
   Filtro por perfil na topbar.
   ═══════════════════════════════════════════════════ */

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Search, UserPlus, Edit2, Trash2, X, ChevronRight, Printer,
  GraduationCap, Package,
} from "lucide-react";

import { db } from "../lib/firebase";
import { fsSnapshotError } from "../utils/firestoreError";
import { logAction, LOG_ACAO, LOG_MODULO, montarDescricao } from "../lib/logAction";
import { useAuth } from "../contexts/AuthContext";
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  getDocs,
  orderBy,
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

  /* ── Detalhe Venda ── */
  .dv-meta { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 18px; }
  .dv-meta-card { background: var(--s2); border: 1px solid var(--border); border-radius: 10px; padding: 10px 13px; }
  .dv-meta-label { font-size: 9px; font-weight: 600; letter-spacing: .07em; text-transform: uppercase; color: var(--text-3); margin-bottom: 4px; }
  .dv-meta-val { font-size: 13px; color: var(--text); font-weight: 500; }
  .dv-meta-obs { background: var(--s2); border: 1px solid var(--border); border-radius: 10px; padding: 10px 13px; margin-bottom: 18px; }
  .dv-table { background: var(--s2); border: 1px solid var(--border); border-radius: 10px; overflow: hidden; margin-bottom: 14px; }
  .dv-thead { display: grid; grid-template-columns: 1fr 60px 110px 110px 100px 110px; padding: 8px 12px; background: var(--s3); border-bottom: 1px solid var(--border); gap: 8px; }
  .dv-thead span { font-size: 9px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: var(--text-3); }
  .dv-trow { display: grid; grid-template-columns: 1fr 60px 110px 110px 100px 110px; padding: 10px 12px; border-bottom: 1px solid var(--border); gap: 8px; font-size: 12px; color: var(--text-2); align-items: center; }
  .dv-trow:last-child { border-bottom: none; }
  .dv-nome { color: var(--text); font-weight: 500; display: flex; align-items: center; gap: 6px; }
  .dv-totals { display: flex; gap: 12px; padding: 12px 14px; background: var(--s2); border: 1px solid var(--border); border-radius: 10px; flex-wrap: wrap; }
  .dv-total-cell { display: flex; flex-direction: column; gap: 2px; }
  .dv-total-label { font-size: 9px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: var(--text-3); }
  .dv-total-val { font-family: 'Sora', sans-serif; font-size: 13px; font-weight: 600; }
  .dv-imprimir { display: flex; align-items: center; gap: 6px; padding: 7px 14px; border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer; border: 1px solid var(--border); background: var(--s3); color: var(--text-2); font-family: 'DM Sans', sans-serif; transition: all .13s; margin-bottom: 16px; }
  .dv-imprimir:hover { background: var(--s2); color: var(--text); }

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
  .cl-row-head {
    background: var(--s2); font-weight: 600; color: var(--text);
    border-bottom: 1px solid var(--border-h);
  }
  .cl-sort-btn {
    background: none; border: none; padding: 0; margin: 0;
    font: inherit; font-weight: 600; color: var(--text);
    cursor: pointer; display: inline-flex; align-items: center; gap: 4px;
    transition: color .13s;
  }
  .cl-sort-btn:hover { color: var(--gold); }
  .cl-sort-btn.active { color: var(--gold); }
  .cl-id { font-family: 'Courier New', monospace; font-weight: 600; color: var(--text); }
  .cl-nome { color: var(--text); cursor: pointer; font-weight: 500; }
  .cl-nome:hover { color: var(--gold); text-decoration: underline; }
  .cl-insta { color: var(--blue); }
  .cl-overflow { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .cl-actions {
    display: flex; gap: 4px; justify-content: flex-end;
  }

  .cl-loading {
    padding: 40px 20px; text-align: center;
    color: var(--text-2); font-size: 13px;
  }
  .cl-empty {
    padding: 60px 20px; text-align: center;
    color: var(--text-3); font-size: 13px;
  }

  /* ── Modal novo/edição ── */
  .modal-section { margin-bottom: 20px; }
  .modal-section:last-child { margin-bottom: 0; }
  .modal-section-title {
    font-size: 10px; font-weight: 600;
    letter-spacing: .08em; text-transform: uppercase;
    color: var(--text-2); margin-bottom: 12px; padding-bottom: 8px;
    border-bottom: 1px solid var(--border);
  }
  .form-checkbox-group {
    display: flex; gap: 14px;
  }
  .form-checkbox-item {
    display: flex; align-items: center; gap: 8px; cursor: pointer;
  }
  .form-checkbox-item input {
    width: 16px; height: 16px; cursor: pointer;
  }
  .form-checkbox-label {
    font-size: 12px; color: var(--text); cursor: pointer;
  }

  /* ── Modal histórico ── */
  .modal-vendas-container {
    max-height: 380px; overflow-y: auto;
  }
  .modal-vendas-list {
    display: flex; flex-direction: column; gap: 10px;
  }
  .modal-venda-item {
    padding: 10px 12px; background: var(--s2);
    border: 1px solid var(--border); border-radius: 8px;
    cursor: pointer; transition: all .15s;
  }
  .modal-venda-item:hover {
    background: var(--s3); border-color: var(--border-h);
  }
  .modal-venda-id {
    font-family: 'Courier New', monospace; font-size: 11px;
    color: var(--text-2); margin-bottom: 3px;
  }
  .modal-venda-data {
    font-size: 12px; color: var(--text);
    display: flex; justify-content: space-between;
  }
  .modal-venda-valor {
    font-weight: 600; color: var(--gold);
  }

  /* ── Modal confirmação delete ── */
  .modal-icon-warning {
    width: 48px; height: 48px;
    border-radius: 12px; background: rgba(255,193,7,0.1);
    border: 1px solid rgba(255,193,7,0.3);
    display: flex; align-items: center; justify-content: center;
    margin: 0 auto 16px;
  }
  .modal-confirm-text {
    text-align: center; font-size: 13px; color: var(--text-2);
    line-height: 1.5; margin-bottom: 20px;
  }
  .modal-confirm-text strong { color: var(--text); }

  /* ── Detalhe venda ── */
  .modal-venda-detalhe { }
  .modal-venda-row {
    display: flex; justify-content: space-between;
    padding: 10px 0; border-bottom: 1px solid var(--border);
    font-size: 12px;
  }
  .modal-venda-row-label { color: var(--text-2); }
  .modal-venda-row-value { color: var(--text); font-weight: 500; }
`;

const PERFIL_OPCOES = [
  { key: "todos",   label: "Todos" },
  { key: "cliente", label: "Clientes" },
  { key: "aluno",   label: "Alunos" },
  { key: "ambos",   label: "Ambos" },
];

function PerfilBadge({ perfis = [] }) {
  const isAluno   = perfis.includes("aluno");
  const isCliente = perfis.includes("cliente");

  if (!perfis.length) return <span style={{ color: "var(--text-3)" }}>—</span>;

  if (isAluno && isCliente) {
    return (
      <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
        <span style={{ padding: "2px 6px", borderRadius: "4px", background: "rgba(91,142,240,0.15)", color: "var(--blue)", fontSize: "10px", fontWeight: "600" }}>Aluno</span>
        <span style={{ padding: "2px 6px", borderRadius: "4px", background: "rgba(200,165,94,0.15)", color: "var(--gold)", fontSize: "10px", fontWeight: "600" }}>Cliente</span>
      </span>
    );
  }

  if (isAluno) {
    return (
      <span style={{ padding: "2px 6px", borderRadius: "4px", background: "rgba(91,142,240,0.15)", color: "var(--blue)", fontSize: "10px", fontWeight: "600", display: "inline-block" }}>
        Aluno
      </span>
    );
  }

  return (
    <span style={{ padding: "2px 6px", borderRadius: "4px", background: "rgba(200,165,94,0.15)", color: "var(--gold)", fontSize: "10px", fontWeight: "600", display: "inline-block" }}>
      Cliente
    </span>
  );
}

function ModalNovoCliente({ cliente, clientes, onSave, onClose }) {
  const [form, setForm] = useState(cliente || {});
  const [erros, setErros] = useState({});

  const validate = () => {
    const novosErros = {};
    if (!form.nome?.trim()) novosErros.nome = "Obrigatório";
    if (form.cpf && clientes.some(c => c.id !== cliente?.id && c.cpf === form.cpf)) {
      novosErros.cpf = "CPF já cadastrado";
    }
    setErros(novosErros);
    return Object.keys(novosErros).length === 0;
  };

  const handleSave = () => {
    if (validate()) onSave(form);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="modal-title">{cliente ? "Editar Cliente" : "Novo Cliente"}</div>
            <div className="modal-sub">{cliente ? "Atualize os dados" : "Cadastre um novo cliente ou aluno"}</div>
          </div>
          <button className="modal-close" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body">
          <div className="modal-section">
            <div className="modal-section-title">Dados Pessoais</div>
            <div className="form-group">
              <label className="form-label">Nome <span className="form-label-req">*</span></label>
              <input
                className={`form-input ${erros.nome ? "err" : ""}`}
                type="text"
                value={form.nome || ""}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder="Nome completo"
              />
              {erros.nome && <div className="form-error">{erros.nome}</div>}
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">CPF</label>
                <input
                  className={`form-input ${erros.cpf ? "err" : ""}`}
                  type="text"
                  value={form.cpf || ""}
                  onChange={(e) => setForm({ ...form, cpf: e.target.value })}
                  placeholder="000.000.000-00"
                />
                {erros.cpf && <div className="form-error">{erros.cpf}</div>}
              </div>
              <div className="form-group">
                <label className="form-label">Telefone</label>
                <input
                  className="form-input"
                  type="text"
                  value={form.telefone || ""}
                  onChange={(e) => setForm({ ...form, telefone: e.target.value })}
                  placeholder="(11) 9 9999-9999"
                />
              </div>
            </div>
          </div>

          <div className="modal-section">
            <div className="modal-section-title">Redes Sociais</div>
            <div className="form-group">
              <label className="form-label">Instagram</label>
              <input
                className="form-input"
                type="text"
                value={form.instagram || ""}
                onChange={(e) => setForm({ ...form, instagram: e.target.value })}
                placeholder="usuario"
              />
            </div>
          </div>

          <div className="modal-section">
            <div className="modal-section-title">Endereço</div>
            <div className="form-group">
              <label className="form-label">Rua, Número, Complemento</label>
              <input
                className="form-input"
                type="text"
                value={form.endereco || ""}
                onChange={(e) => setForm({ ...form, endereco: e.target.value })}
                placeholder="Endereço completo"
              />
            </div>
          </div>

          <div className="modal-section">
            <div className="modal-section-title">Perfil</div>
            <div className="form-checkbox-group">
              <label className="form-checkbox-item">
                <input
                  type="checkbox"
                  checked={form.perfis?.includes("cliente") || false}
                  onChange={(e) => {
                    const newPerfis = form.perfis || [];
                    if (e.target.checked) {
                      if (!newPerfis.includes("cliente")) setForm({ ...form, perfis: [...newPerfis, "cliente"] });
                    } else {
                      setForm({ ...form, perfis: newPerfis.filter(p => p !== "cliente") });
                    }
                  }}
                />
                <span className="form-checkbox-label">Cliente</span>
              </label>
              <label className="form-checkbox-item">
                <input
                  type="checkbox"
                  checked={form.perfis?.includes("aluno") || false}
                  onChange={(e) => {
                    const newPerfis = form.perfis || [];
                    if (e.target.checked) {
                      if (!newPerfis.includes("aluno")) setForm({ ...form, perfis: [...newPerfis, "aluno"] });
                    } else {
                      setForm({ ...form, perfis: newPerfis.filter(p => p !== "aluno") });
                    }
                  }}
                />
                <span className="form-checkbox-label">Aluno</span>
              </label>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" onClick={handleSave}>{cliente ? "Salvar Alterações" : "Criar Cliente"}</button>
        </div>
      </div>
    </div>
  );
}

function ModalHistorico({ cliente, tenantUid, onClose, onVerVenda }) {
  const [clienteVendas, setClienteVendas] = useState([]);
  const [loadingVendas, setLoadingVendas] = useState(true);

  useEffect(() => {
    if (!tenantUid || !cliente?.id) { setLoadingVendas(false); return; }
    let cancelled = false;

    const vendasCol = collection(db, "users", tenantUid, "vendas");

    // Busca por clienteId (vendas vinculadas)
    const qId = query(vendasCol, where("clienteId", "==", cliente.id));
    // Busca por nome (fallback para vendas antigas sem clienteId, campo "cliente")
    const qNome = query(vendasCol, where("clienteId", "==", null), where("cliente", "==", cliente.nome));

    Promise.all([getDocs(qId), getDocs(qNome)])
      .then(([snapId, snapNome]) => {
        if (cancelled) return;
        const ids = new Set();
        const arr = [];
        for (const snap of [snapId, snapNome]) {
          snap.docs.forEach(d => {
            if (!ids.has(d.id)) { ids.add(d.id); arr.push({ id: d.id, ...d.data() }); }
          });
        }
        arr.sort((a, b) => {
          const toDate = v => v?.toDate ? v.toDate() : new Date(v || 0);
          return toDate(b.data) - toDate(a.data);
        });
        setClienteVendas(arr);
        setLoadingVendas(false);
      })
      .catch(() => setLoadingVendas(false));

    return () => { cancelled = true; };
  }, [tenantUid, cliente?.id, cliente?.nome]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box modal-box-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="modal-title">{cliente.nome}</div>
            <div className="modal-sub">{cliente.cpf || cliente.documento || "Sem CPF/CNPJ"}</div>
          </div>
          <button className="modal-close" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body">
          <div className="modal-section">
            <div className="modal-section-title">Histórico de Vendas</div>
            <div className="modal-vendas-container">
              <div className="modal-vendas-list">
                {loadingVendas ? (
                  <div style={{ padding: "30px 20px", textAlign: "center", color: "var(--text-3)", fontSize: "12px" }}>
                    Carregando...
                  </div>
                ) : clienteVendas.length === 0 ? (
                  <div style={{ padding: "30px 20px", textAlign: "center", color: "var(--text-3)", fontSize: "12px" }}>
                    Nenhuma venda registrada.
                  </div>
                ) : (
                  clienteVendas.map(v => (
                    <div key={v.id} className="modal-venda-item" onClick={() => onVerVenda(v)}>
                      <div className="modal-venda-id">ID: {v.id}</div>
                      <div className="modal-venda-data">
                        <span>{(v.data?.toDate ? v.data.toDate() : new Date(v.data || 0)).toLocaleDateString("pt-BR")}</span>
                        <span className="modal-venda-valor">R$ {(v.total || 0).toFixed(2)}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ModalConfirmDelete({ cliente, onConfirm, onClose }) {
  return (
    <div className="modal-overlay modal-overlay-top" onClick={onClose}>
      <div className="modal-box modal-box-md" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">Confirmar exclusão</div>
          <button className="modal-close" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body">
          <div className="modal-icon-warning">
            <Trash2 size={24} color="var(--gold)" />
          </div>
          <div className="modal-confirm-text">
            Tem certeza que deseja excluir <strong>{cliente.nome}</strong>? Esta ação não pode ser desfeita.
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn-danger" onClick={onConfirm}>Excluir</button>
        </div>
      </div>
    </div>
  );
}

const fmtR$ = (v) =>
  `R$ ${Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

const fmtData = (d) => {
  if (!d) return "—";
  try {
    const dt = d?.toDate ? d.toDate() : new Date(d);
    return dt.toLocaleDateString("pt-BR");
  } catch { return String(d); }
};

function escapeHtml(text) {
  if (!text) return "";
  const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
  return String(text).replace(/[&<>"']/g, (char) => map[char]);
}

function imprimirRecibo(venda) {
  const el = document.getElementById("recibo-print-root");
  if (!el) return;
  const itens = venda.itens || [];
  const descontos = itens.reduce((s, i) => s + (i.desconto || 0), 0);
  const temTaxa = venda.valorTaxa > 0;
  const temParc = venda.parcelas > 1;
  const isSinal = venda.formaPagamento === "Sinal" && venda.valorPago != null;
  const pagamentos = venda.pagamentos && venda.pagamentos.length > 0
    ? venda.pagamentos
    : [{ label: venda.formaPagamento || "—", valor: isSinal ? venda.valorPago : venda.total }];
  const pgtoLinhas = pagamentos.map(p => {
    const label = temParc && pagamentos.length === 1
      ? `${p.label} — ${venda.parcelas}x de ${fmtR$(venda.total / venda.parcelas)}`
      : p.label;
    return `<div style="display:flex;justify-content:space-between;font-size:12px;"><span>${label}</span><span style="font-weight:bold;">${fmtR$(p.valor ?? venda.total)}</span></div>`;
  }).join("");
  el.innerHTML = `
    <div class="recibo-print">
      <div style="text-align:center;font-weight:bold;font-size:14px;margin-bottom:3px;">ASSENT</div>
      <div style="text-align:center;font-size:11px;margin:6px 0 10px;">Recibo de Venda</div>
      <div style="border-top:1px dashed #000;margin:6px 0;"></div>
      <div style="font-size:12px;"><strong>ID:</strong> ${escapeHtml(venda.idVenda || venda.id)}</div>
      <div style="font-size:12px;"><strong>Data:</strong> ${fmtData(venda.data)}</div>
      <div style="font-size:12px;"><strong>Cliente:</strong> ${escapeHtml(venda.cliente || "—")}</div>
      ${venda.vendedor ? `<div style="font-size:12px;"><strong>Vendedor:</strong> ${escapeHtml(venda.vendedor)}</div>` : ""}
      <div style="border-top:1px dashed #000;margin:8px 0;"></div>
      <div style="display:grid;grid-template-columns:1fr auto auto;gap:2px 8px;font-size:11px;font-weight:bold;margin-bottom:4px;"><span>PRODUTO / SERVIÇO</span><span style="text-align:right;">QTD</span><span style="text-align:right;">TOTAL</span></div>
      ${itens.map(i => {
        const totalItem = (i.preco || 0) * (i.qtd || 1) - (i.desconto || 0);
        return `<div style="display:grid;grid-template-columns:1fr auto auto;gap:1px 8px;font-size:11px;margin-bottom:5px;"><span style="font-weight:bold;">${escapeHtml(i.nome || i.produto || "Item livre")}</span><span style="text-align:right;font-weight:bold;">${i.qtd}x</span><span style="text-align:right;font-weight:bold;">${fmtR$(totalItem)}</span><span style="font-size:10px;color:#444;grid-column:1/-1;">Unitário: ${fmtR$(i.preco)}</span>${i.desconto > 0 ? `<span style="font-size:10px;color:#444;grid-column:1/-1;">Desconto: -${fmtR$(i.desconto)}</span>` : ""}</div>`;
      }).join("")}
      <div style="border-top:1px dashed #000;margin:8px 0;"></div>
      ${descontos > 0 ? `<div style="display:flex;justify-content:space-between;font-size:11px;"><span>Descontos</span><span>-${fmtR$(descontos)}</span></div>` : ""}
      ${temTaxa ? `<div style="display:flex;justify-content:space-between;font-size:11px;color:#444;"><span>Taxa cartão (${venda.taxaPercentual}%)</span><span>${fmtR$(venda.valorTaxa)}</span></div>` : ""}
      <div style="display:flex;justify-content:space-between;font-weight:bold;font-size:14px;margin-top:4px;"><span>TOTAL</span><span>${fmtR$(venda.total)}</span></div>
      ${isSinal ? `<div style="border-top:1px dashed #000;margin:8px 0;"></div><div style="display:flex;justify-content:space-between;font-size:12px;"><span>Sinal recebido</span><span>${fmtR$(venda.valorPago)}</span></div><div style="display:flex;justify-content:space-between;font-size:12px;font-weight:bold;"><span>Restante a pagar</span><span>${fmtR$(venda.valorRestante)}</span></div>` : ""}
      <div style="border-top:1px dashed #000;margin:8px 0;"></div>
      <div style="font-size:12px;font-weight:bold;margin-bottom:4px;">FORMA DE PAGAMENTO</div>
      ${pgtoLinhas}
      ${venda.observacao ? `<div style="border-top:1px dashed #000;margin:8px 0;"></div><div style="font-size:11px;"><strong>Obs:</strong> ${escapeHtml(venda.observacao)}</div>` : ""}
      <div style="text-align:center;font-size:10px;margin-top:14px;">Obrigado!</div>
    </div>
  `;
  window.print();
}

function ModalDetalheVenda({ venda, onClose }) {
  if (!venda) return null;
  const itens = venda.itens || [];
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
            <div className="modal-title" style={{ color: "var(--gold)" }}>{venda.idVenda || venda.id}</div>
            <div className="modal-sub">Detalhes da venda</div>
          </div>
          <button className="modal-close" onClick={onClose}>
            <X size={14} color="var(--text-2)" />
          </button>
        </div>

        <div className="modal-body">
          {/* Meta cards */}
          <div className="dv-meta">
            <div className="dv-meta-card">
              <div className="dv-meta-label">Cliente</div>
              <div className="dv-meta-val">{venda.cliente || "—"}</div>
            </div>
            <div className="dv-meta-card">
              <div className="dv-meta-label">Data</div>
              <div className="dv-meta-val">{fmtData(venda.data)}</div>
            </div>
            <div className="dv-meta-card">
              <div className="dv-meta-label">Pagamento</div>
              <div className="dv-meta-val">
                {venda.formaPagamento || "—"}
                {venda.parcelas > 1 && (
                  <span style={{ marginLeft: 6, fontSize: 11, color: "var(--gold)" }}>
                    {venda.parcelas}x
                  </span>
                )}
              </div>
            </div>
          </div>

          {venda.valorTaxa > 0 && (
            <div className="dv-meta" style={{ gridTemplateColumns: "1fr 1fr", marginTop: -6 }}>
              <div className="dv-meta-card">
                <div className="dv-meta-label">
                  Taxa {venda.formaPagamento === "Pix" ? "PIX" : "Cartão"} ({venda.taxaPercentual}%)
                </div>
                <div className="dv-meta-val" style={{ color: "var(--red)" }}>{fmtR$(venda.valorTaxa)}</div>
              </div>
              {venda.parcelas > 1 && (
                <div className="dv-meta-card">
                  <div className="dv-meta-label">Valor por Parcela</div>
                  <div className="dv-meta-val">{fmtR$(venda.total / venda.parcelas)}</div>
                </div>
              )}
            </div>
          )}

          {venda.vendedor && (
            <div className="dv-meta" style={{ gridTemplateColumns: "1fr", marginTop: -6 }}>
              <div className="dv-meta-card">
                <div className="dv-meta-label">Vendedor</div>
                <div className="dv-meta-val">{venda.vendedor}</div>
              </div>
            </div>
          )}

          {venda.observacao && (
            <div className="dv-meta-obs" style={{ marginTop: 6 }}>
              <div className="dv-meta-label" style={{ marginBottom: 4 }}>Observação</div>
              <div style={{ fontSize: 13, color: "var(--text-2)" }}>{venda.observacao}</div>
            </div>
          )}

          <button className="dv-imprimir" onClick={() => imprimirRecibo(venda)}>
            <Printer size={13} /> Reimprimir Recibo
          </button>

          {/* Tabela de itens */}
          <div className="dv-table">
            <div className="dv-thead">
              <span>PRODUTO / SERVIÇO</span>
              <span style={{ textAlign: "center" }}>QTD</span>
              <span style={{ textAlign: "right" }}>PREÇO UNIT.</span>
              <span style={{ textAlign: "right" }}>CUSTO UNIT.</span>
              <span style={{ textAlign: "right" }}>DESCONTO</span>
              <span style={{ textAlign: "right" }}>TOTAL ITEM</span>
            </div>
            {itens.length === 0 ? (
              <div style={{ padding: 18, textAlign: "center", color: "var(--text-3)", fontSize: 12 }}>
                Nenhum item nesta venda.
              </div>
            ) : itens.map((item, i) => {
              const totalItem = (item.preco || 0) * (item.qtd || 1) - (item.desconto || 0);
              return (
                <div key={i} className="dv-trow">
                  <span className="dv-nome">
                    {item.tipo === "servico" ? "🎯" : <Package size={11} color="var(--text-3)" />}
                    {item.nome || item.produto || "—"}
                  </span>
                  <span style={{ textAlign: "center" }}>{item.qtd || 1}</span>
                  <span style={{ textAlign: "right" }}>{fmtR$(item.preco)}</span>
                  <span style={{ textAlign: "right", color: "var(--red)" }}>{fmtR$(item.custo)}</span>
                  <span style={{ textAlign: "right" }}>{item.desconto ? fmtR$(item.desconto) : "—"}</span>
                  <span style={{ textAlign: "right", color: "var(--green)", fontFamily: "Sora, sans-serif", fontWeight: 500 }}>
                    {fmtR$(totalItem)}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Totais */}
          <div className="dv-totals">
            <div className="dv-total-cell">
              <div className="dv-total-label">Subtotal</div>
              <div className="dv-total-val" style={{ color: "var(--text)" }}>{fmtR$(subtotal)}</div>
            </div>
            <div className="dv-total-cell">
              <div className="dv-total-label">Descontos</div>
              <div className="dv-total-val" style={{ color: "var(--red)" }}>{fmtR$(descontos)}</div>
            </div>
            <div className="dv-total-cell">
              <div className="dv-total-label">Custo Total</div>
              <div className="dv-total-val" style={{ color: "var(--red)" }}>{fmtR$(custoTotal)}</div>
            </div>
            {venda.valorTaxa > 0 && (
              <div className="dv-total-cell">
                <div className="dv-total-label">
                  Taxa {venda.formaPagamento === "Pix" ? "PIX" : "Cartão"} ({venda.taxaPercentual}%)
                </div>
                <div className="dv-total-val" style={{ color: "var(--red)" }}>{fmtR$(venda.valorTaxa)}</div>
              </div>
            )}
            <div className="dv-total-cell">
              <div className="dv-total-label">Total</div>
              <div className="dv-total-val" style={{ color: "var(--green)" }}>{fmtR$(total)}</div>
            </div>
            {venda.formaPagamento === "Sinal" && venda.valorPago != null && (
              <>
                <div className="dv-total-cell">
                  <div className="dv-total-label">Sinal Recebido</div>
                  <div className="dv-total-val" style={{ color: "var(--green)" }}>{fmtR$(venda.valorPago)}</div>
                </div>
                <div className="dv-total-cell">
                  <div className="dv-total-label">A Receber</div>
                  <div className="dv-total-val" style={{ color: "var(--blue, #5b8ef0)" }}>{fmtR$(venda.valorRestante)}</div>
                </div>
              </>
            )}
            <div className="dv-total-cell">
              <div className="dv-total-label">Lucro Est.</div>
              <div className="dv-total-val" style={{ color: "var(--gold)" }}>
                {fmtR$(typeof venda.lucroEstimado === "number" ? venda.lucroEstimado : lucro)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function gerarIdCliente(cnt) {
  return String(cnt + 1).padStart(5, "0");
}

export default function Clientes() {
  const { tenantUid, nomeUsuario, cargo, podeCriar, podeEditar, podeExcluir } = useAuth();

  const podeCriarV   = podeCriar("clientes");
  const podeEditarV  = podeEditar("clientes");
  const podeExcluirV = podeExcluir("clientes");
  const [loading, setLoading] = useState(true);
  const [clientes, setClientes] = useState([]);
  const [clienteIdCnt, setClienteIdCnt] = useState(0);
  const [search, setSearch] = useState("");
  const [perfilFilter, setPerfilFilter] = useState("todos");
  const [modalNovo, setModalNovo] = useState(false);
  const [editando, setEditando] = useState(null);
  const [deletando, setDeletando] = useState(null);
  const [historico, setHistorico] = useState(null);
  const [vendaDetalhe, setVendaDetalhe] = useState(null);
  const [sortField, setSortField] = useState("id");
  const [sortDir, setSortDir]   = useState("asc");

  const toggleSort = (field) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  };

  /* ── Atalho de teclado: N → Novo Cliente ── */
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignora se o foco estiver em input, textarea ou select
      const tag = document.activeElement?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      // Ignora se algum modal já estiver aberto
      if (modalNovo || editando || deletando || historico || vendaDetalhe) return;
      if (e.key === "n" || e.key === "N") {
        if (podeCriarV) {
          e.preventDefault();
          setModalNovo(true);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [modalNovo, editando, deletando, historico, vendaDetalhe, podeCriarV]);

  /* ── Firestore listeners ── */
  useEffect(() => {
    if (!tenantUid) { setLoading(false); return; }

    const userRef     = doc(db, "users", tenantUid);
    const clientesCol = collection(db, "users", tenantUid, "clientes");

    const unsubUser = onSnapshot(userRef, (snap) => {
      if (snap.exists()) setClienteIdCnt(snap.data().clienteIdCnt || 0);
    }, fsSnapshotError("Clientes:userRef"));

    const unsubClientes = onSnapshot(clientesCol, (snap) => {
      setClientes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, fsSnapshotError("Clientes:clientes"));

    return () => { unsubUser(); unsubClientes(); };
  }, [tenantUid]);

  const handleAdd = async (form) => {
    if (!tenantUid) return;
    const newId = gerarIdCliente(clienteIdCnt);
    await setDoc(doc(db, "users", tenantUid, "clientes", newId), {
      ...form,
      id: newId,
      perfis: ["cliente"],
      criadoEm: new Date().toISOString(),
    });
    await setDoc(doc(db, "users", tenantUid), { clienteIdCnt: clienteIdCnt + 1 }, { merge: true });
    await logAction({ tenantUid, nomeUsuario, cargo, acao: LOG_ACAO.CRIAR, modulo: LOG_MODULO.CLIENTES, descricao: montarDescricao("criar", "Cliente", form.nome, newId) });
    setModalNovo(false);
  };

  const handleEdit = async (form) => {
    if (!tenantUid || !editando) return;
    await setDoc(doc(db, "users", tenantUid, "clientes", editando.id), { ...form, id: editando.id }, { merge: true });
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

        if (perfilFilter === "aluno"   && !isAluno)   return false;
        if (perfilFilter === "cliente" && !isCliente) return false;
        if (perfilFilter === "ambos"   && !isAmbos)   return false;
      }

      /* ── Filtro de busca ── */
      if (!q) return true;
      const docNumber = c.cpf || c.documento || "";
      return (
        c.nome?.toLowerCase().includes(q) ||
        docNumber.toLowerCase().includes(q) ||
        c.telefone?.toLowerCase().includes(q)
      );
    }).sort((a, b) => {
      let va, vb;
      if (sortField === "id") {
        va = parseInt((a.idSeqFmt || a.id || "").replace(/\D/g, "") || "0", 10);
        vb = parseInt((b.idSeqFmt || b.id || "").replace(/\D/g, "") || "0", 10);
      } else {
        va = (a.nome || "").toLowerCase();
        vb = (b.nome || "").toLowerCase();
      }
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ?  1 : -1;
      return 0;
    });
  }, [clientes, search, perfilFilter, sortField, sortDir]);

  /* Contadores por perfil para exibir nos botões */
  const contadores = useMemo(() => {
    const alunos   = clientes.filter(c => c.perfis?.includes("aluno")).length;
    const clientes_only = clientes.filter(c => c.perfis?.includes("cliente") && !c.perfis?.includes("aluno")).length;
    const ambos    = clientes.filter(c => c.perfis?.includes("aluno") && c.perfis?.includes("cliente")).length;
    const legados  = clientes.filter(c => !c.perfis?.length).length;
    return { 
      alunos, 
      clientes: clientes_only + legados + ambos,
      ambos 
    };
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
          <button
            className="btn-novo-cl"
            onClick={() => setModalNovo(true)}
            title="Novo Cliente (N)"
          ><UserPlus size={14} /><span><span style={{ borderBottom: "1.5px solid currentColor" }}>N</span>ovo Cliente</span></button>
        )}
      </header>

      <div className="ag-content">
        <div className="cl-table-wrap">
          <div className="cl-table-header">
            <span className="cl-table-title">Cadastros</span>
            <span className="cl-count-badge">{clientesFiltrados.length}</span>
          </div>

          <div className="cl-row cl-row-head">
            <span>
              <button className={`cl-sort-btn ${sortField === "id" ? "active" : ""}`} onClick={() => toggleSort("id")}>
                ID {sortField === "id" ? (sortDir === "asc" ? "↑" : "↓") : "↕"}
              </button>
            </span>
            <span>
              <button className={`cl-sort-btn ${sortField === "nome" ? "active" : ""}`} onClick={() => toggleSort("nome")}>
                Nome {sortField === "nome" ? (sortDir === "asc" ? "↑" : "↓") : "↕"}
              </button>
            </span>
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
      {historico    && <ModalHistorico cliente={historico} tenantUid={tenantUid} onClose={() => setHistorico(null)} onVerVenda={setVendaDetalhe} />}
      {vendaDetalhe && <ModalDetalheVenda venda={vendaDetalhe} onClose={() => setVendaDetalhe(null)} />}
    </>
  );
}
