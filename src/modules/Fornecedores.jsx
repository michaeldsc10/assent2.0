/* ═══════════════════════════════════════════════════
   ASSENT v2.0 — Fornecedores.jsx
   Estrutura Firestore:
     users/{uid}/fornecedores/{id}  → cada fornecedor
   
   REGRAS CRÍTICAS:
     - Sem fornecedorId no sistema (integração via nome)
     - Duplicidade bloqueada via nomeNormalizado
     - doc.id usado apenas internamente (controle Firestore)
   ═══════════════════════════════════════════════════ */

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Search, Plus, Edit2, X, Truck,
  ToggleLeft, ToggleRight, Filter, Download,
} from "lucide-react";

import { db, auth } from "../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  onSnapshot,
  query,
  where,
  getDocs,
} from "firebase/firestore";

/* ── CSS ── */
const CSS = `
  /* ── Modal base ── */
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
    border-radius: 16px; width: 100%; max-width: 520px;
    max-height: 92vh; overflow-y: auto;
    box-shadow: 0 28px 72px rgba(0,0,0,0.65);
    animation: slideUp .18s ease;
  }
  .modal-box-md  { max-width: 420px; }
  .modal-box::-webkit-scrollbar { width: 3px; }
  .modal-box::-webkit-scrollbar-thumb { background: var(--text-3); border-radius: 2px; }

  .modal-header {
    padding: 20px 22px 16px;
    border-bottom: 1px solid var(--border);
    display: flex; align-items: flex-start;
    justify-content: space-between; gap: 12px;
    position: sticky; top: 0;
    background: var(--s1); z-index: 2;
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
    position: sticky; bottom: 0; background: var(--s1); z-index: 2;
  }

  /* ── Buttons ── */
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
  .btn-primary:disabled { opacity: .5; cursor: not-allowed; }

  .btn-secondary {
    padding: 9px 20px; border-radius: 9px;
    background: var(--s3); color: var(--text-2);
    border: 1px solid var(--border); cursor: pointer;
    font-family: 'DM Sans', sans-serif; font-size: 13px;
    transition: background .13s, color .13s;
    display: flex; align-items: center; gap: 6px;
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
  .btn-icon-toggle { color: var(--text-2); }
  .btn-icon-toggle:hover { background: var(--s3); border-color: var(--border-h); }

  /* ── Forms ── */
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
  .form-textarea {
    width: 100%; background: var(--s2);
    border: 1px solid var(--border); border-radius: 9px;
    padding: 10px 13px; color: var(--text); font-size: 13px;
    font-family: 'DM Sans', sans-serif; resize: vertical; min-height: 72px;
    outline: none; transition: border-color .15s, box-shadow .15s;
    box-sizing: border-box;
  }
  .form-textarea:focus { border-color: var(--gold); box-shadow: 0 0 0 3px rgba(200,165,94,0.1); }
  .form-error { font-size: 11px; color: var(--red); margin-top: 5px; }
  .form-row   { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }

  /* ── Topbar ── */
  .fn-topbar {
    padding: 14px 22px;
    background: var(--s1); border-bottom: 1px solid var(--border);
    display: flex; align-items: center; gap: 14px; flex-shrink: 0; flex-wrap: wrap;
  }
  .fn-topbar-title h1 {
    font-family: 'Sora', sans-serif; font-size: 17px; font-weight: 600;
    color: var(--text);
  }
  .fn-topbar-title p { font-size: 11px; color: var(--text-2); margin-top: 2px; }
  .fn-search {
    display: flex; align-items: center; gap: 8px;
    background: var(--s2); border: 1px solid var(--border);
    border-radius: 8px; padding: 8px 12px; width: 270px; flex: 1; min-width: 180px;
  }
  .fn-search input {
    background: transparent; border: none; outline: none;
    color: var(--text); font-size: 12px; width: 100%;
  }
  .fn-topbar-right { display: flex; align-items: center; gap: 8px; margin-left: auto; }

  /* ── Filtros de status ── */
  .fn-filters {
    display: flex; align-items: center; gap: 6px;
    padding: 12px 22px; border-bottom: 1px solid var(--border);
    background: var(--s1); flex-wrap: wrap;
  }
  .fn-filter-label {
    display: flex; align-items: center; gap: 5px;
    font-size: 11px; color: var(--text-3); font-weight: 500; margin-right: 4px;
  }
  .fn-filter-btn {
    padding: 5px 13px; border-radius: 20px; font-size: 12px;
    font-family: 'DM Sans', sans-serif; cursor: pointer;
    border: 1px solid var(--border); background: var(--s2); color: var(--text-2);
    transition: all .13s;
  }
  .fn-filter-btn:hover { border-color: var(--border-h); color: var(--text); }
  .fn-filter-btn.active {
    background: var(--gold); color: #0a0808;
    border-color: var(--gold); font-weight: 600;
  }
  .fn-filter-btn.active-green {
    background: rgba(74,222,128,.12); color: var(--green);
    border-color: rgba(74,222,128,.25); font-weight: 600;
  }
  .fn-filter-btn.active-red {
    background: var(--red-d); color: var(--red);
    border-color: rgba(224,82,82,.25); font-weight: 600;
  }

  /* ── Tabela ── */
  .fn-table-wrap {
    background: var(--s1); border: 1px solid var(--border);
    border-radius: 12px; overflow: hidden;
  }
  .fn-table-header {
    padding: 13px 18px;
    border-bottom: 1px solid var(--border);
    display: flex; align-items: center; justify-content: space-between; gap: 10px;
  }
  .fn-table-title {
    font-family: 'Sora', sans-serif; font-size: 13px; font-weight: 600; color: var(--text);
    display: flex; align-items: center; gap: 8px;
  }
  .fn-count-badge {
    font-family: 'Sora', sans-serif; font-size: 11px; font-weight: 600;
    background: var(--s3); border: 1px solid var(--border-h);
    color: var(--text-2); padding: 2px 9px; border-radius: 20px;
  }
  .fn-table-actions { display: flex; gap: 6px; }
  .fn-export-btn {
    display: flex; align-items: center; gap: 5px;
    padding: 5px 11px; border-radius: 7px; font-size: 11px; font-weight: 600;
    cursor: pointer; border: 1px solid var(--border);
    background: var(--s2); color: var(--text-2);
    font-family: 'DM Sans', sans-serif; transition: all .13s;
  }
  .fn-export-btn:hover { background: var(--s3); color: var(--text); }

  .fn-row {
    display: grid;
    grid-template-columns: 1fr 160px 140px 130px 80px 72px;
    padding: 11px 18px; gap: 8px;
    border-bottom: 1px solid var(--border);
    align-items: center; font-size: 12px; color: var(--text-2);
    transition: background .1s;
  }
  .fn-row:last-child { border-bottom: none; }
  .fn-row:hover { background: rgba(255,255,255,0.025); }
  .fn-row-head { background: var(--s2); }
  .fn-row-head:hover { background: var(--s2); }
  .fn-row-head span {
    font-size: 10px; font-weight: 500; letter-spacing: .06em;
    text-transform: uppercase; color: var(--text-3);
  }

  .fn-nome { color: var(--text); font-size: 13px; font-weight: 500; }
  .fn-doc  { font-family: 'Sora', sans-serif; font-size: 11px; color: var(--text-3); }
  .fn-actions { display: flex; align-items: center; gap: 5px; justify-content: flex-end; }

  .fn-status-badge {
    display: inline-flex; align-items: center; gap: 4px;
    padding: 3px 9px; border-radius: 12px; font-size: 10px; font-weight: 600;
  }
  .fn-status-ativo {
    background: rgba(74,222,128,.1); color: var(--green);
    border: 1px solid rgba(74,222,128,.2);
  }
  .fn-status-inativo {
    background: var(--red-d); color: var(--red);
    border: 1px solid rgba(224,82,82,.2);
  }
  .fn-status-dot {
    width: 5px; height: 5px; border-radius: 50%; background: currentColor;
  }

  .fn-empty, .fn-loading {
    padding: 56px 20px; text-align: center; color: var(--text-3); font-size: 13px;
  }

  /* ── Confirm ── */
  .confirm-body {
    padding: 24px 22px; text-align: center;
    font-size: 13px; color: var(--text-2); line-height: 1.6;
  }
  .confirm-icon { font-size: 28px; margin-bottom: 12px; }

  /* ── Alerta de duplicidade ── */
  .fn-alert-dup {
    background: rgba(224,82,82,.08); border: 1px solid rgba(224,82,82,.25);
    border-radius: 9px; padding: 10px 13px; margin-bottom: 14px;
    font-size: 12px; color: var(--red); display: flex; align-items: center; gap: 8px;
  }
`;

/* ── Helpers ── */
const fmtTel = (t) => t || "—";
const fmtDoc = (d) => d || "—";

function exportarCSV(fornecedores) {
  const header = "Nome,Documento,Telefone,Email,Endereço,Status,Observações,Data Criação\n";
  const rows = fornecedores.map(f =>
    `"${f.nome || ""}","${f.documento || ""}","${f.telefone || ""}","${f.email || ""}","${f.endereco || ""}","${f.status || ""}","${f.observacoes || ""}","${f.dataCriacao || ""}"`
  ).join("\n");
  const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "fornecedores.csv"; a.click();
  URL.revokeObjectURL(url);
}

function fmtData(d) {
  if (!d) return "—";
  try {
    const dt = d?.toDate ? d.toDate() : new Date(d);
    return dt.toLocaleDateString("pt-BR");
  } catch { return String(d); }
}

/* ══════════════════════════════════════════════════
   MODAL: Formulário de Fornecedor (Criar / Editar)
   ══════════════════════════════════════════════════ */
function ModalFornecedor({ fornecedor, uid, onSave, onClose }) {
  const isEdit = !!fornecedor;

  const [nome,        setNome]        = useState(fornecedor?.nome        || "");
  const [documento,   setDocumento]   = useState(fornecedor?.documento   || "");
  const [telefone,    setTelefone]    = useState(fornecedor?.telefone    || "");
  const [email,       setEmail]       = useState(fornecedor?.email       || "");
  const [endereco,    setEndereco]    = useState(fornecedor?.endereco    || "");
  const [observacoes, setObservacoes] = useState(fornecedor?.observacoes || "");

  const [salvando, setSalvando] = useState(false);
  const [erros,    setErros]    = useState({});
  const [erroDup,  setErroDup]  = useState("");

  /* Validação local */
  const validar = useCallback(() => {
    const e = {};
    if (!nome.trim()) e.nome = "Nome é obrigatório.";
    setErros(e);
    return Object.keys(e).length === 0;
  }, [nome]);

  /* Verificar duplicidade no Firestore */
  const verificarDuplicidade = useCallback(async (nomeNorm) => {
    try {
      const col = collection(db, "users", uid, "fornecedores");
      const q   = query(col, where("nomeNormalizado", "==", nomeNorm));
      const snap = await getDocs(q);

      if (snap.empty) return false;

      /* Em edição: ignorar o próprio documento */
      if (isEdit) {
        const outrosDocs = snap.docs.filter(d => d.id !== fornecedor.id);
        return outrosDocs.length > 0;
      }

      return true;
    } catch (error) {
      console.error("Erro ao verificar duplicidade de fornecedor:", error);
      /* Em caso de erro de leitura, bloquear como precaução */
      throw new Error("Não foi possível verificar duplicidade. Tente novamente.");
    }
  }, [uid, isEdit, fornecedor]);

  const handleSalvar = useCallback(async () => {
    setErroDup("");
    if (!validar()) return;

    setSalvando(true);

    try {
      const nomeNormalizado = nome.trim().toLowerCase();

      /* ── Bloquear duplicidade ── */
      const duplicado = await verificarDuplicidade(nomeNormalizado);
      if (duplicado) {
        setErroDup(`Já existe um fornecedor com o nome "${nome.trim()}". Use um nome diferente.`);
        setSalvando(false);
        return;
      }

      const agora = new Date().toISOString();

      const payload = {
        nome:            nome.trim(),
        nomeNormalizado,
        documento:       documento.trim(),
        telefone:        telefone.trim(),
        email:           email.trim(),
        endereco:        endereco.trim(),
        observacoes:     observacoes.trim(),
        dataAtualizacao: agora,
      };

      if (!isEdit) {
        payload.status      = "ativo";
        payload.dataCriacao = agora;
      }

      await onSave(payload, isEdit ? fornecedor : null);
    } catch (error) {
      console.error("Erro ao salvar fornecedor:", error);
      setErroDup(error.message || "Erro ao salvar. Tente novamente.");
      setSalvando(false);
    }
  }, [nome, documento, telefone, email, endereco, observacoes, isEdit, fornecedor, validar, verificarDuplicidade, onSave]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>

        <div className="modal-header">
          <div>
            <div className="modal-title">
              {isEdit ? "Editar Fornecedor" : "Novo Fornecedor"}
            </div>
            <div className="modal-sub">
              {isEdit ? `Editando: ${fornecedor.nome}` : "Preencha os dados do fornecedor"}
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>
            <X size={13} color="var(--text-2)" />
          </button>
        </div>

        <div className="modal-body">

          {/* Alerta de duplicidade */}
          {erroDup && (
            <div className="fn-alert-dup">
              <X size={13} /> {erroDup}
            </div>
          )}

          {/* Nome — obrigatório */}
          <div className="form-group">
            <label className="form-label">
              Nome <span className="form-label-req">*</span>
            </label>
            <input
              className={`form-input${erros.nome ? " err" : ""}`}
              placeholder="Nome do fornecedor"
              value={nome}
              onChange={e => { setNome(e.target.value); setErroDup(""); }}
            />
            {erros.nome && <div className="form-error">{erros.nome}</div>}
          </div>

          {/* Documento e Telefone */}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Documento (CNPJ / CPF)</label>
              <input
                className="form-input"
                placeholder="00.000.000/0000-00"
                value={documento}
                onChange={e => setDocumento(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Telefone</label>
              <input
                className="form-input"
                placeholder="(00) 00000-0000"
                value={telefone}
                onChange={e => setTelefone(e.target.value)}
              />
            </div>
          </div>

          {/* Email */}
          <div className="form-group">
            <label className="form-label">E-mail</label>
            <input
              className="form-input"
              type="email"
              placeholder="contato@fornecedor.com.br"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>

          {/* Endereço */}
          <div className="form-group">
            <label className="form-label">Endereço</label>
            <input
              className="form-input"
              placeholder="Rua, número, cidade — UF"
              value={endereco}
              onChange={e => setEndereco(e.target.value)}
            />
          </div>

          {/* Observações */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Observações</label>
            <textarea
              className="form-textarea"
              placeholder="Informações adicionais..."
              value={observacoes}
              onChange={e => setObservacoes(e.target.value)}
            />
          </div>

        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose} disabled={salvando}>
            Cancelar
          </button>
          <button
            className="btn-primary"
            onClick={handleSalvar}
            disabled={salvando}
          >
            {salvando ? "Salvando..." : "Salvar"}
          </button>
        </div>

      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════
   MODAL: Confirmar Toggle de Status
   ══════════════════════════════════════════════════ */
function ModalConfirmToggle({ fornecedor, onConfirm, onClose }) {
  const ativando = fornecedor.status === "inativo";

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box modal-box-md" onClick={e => e.stopPropagation()}>

        <div className="modal-header">
          <div>
            <div className="modal-title">
              {ativando ? "Ativar Fornecedor" : "Inativar Fornecedor"}
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>
            <X size={13} color="var(--text-2)" />
          </button>
        </div>

        <div className="confirm-body">
          <div className="confirm-icon">{ativando ? "✅" : "⚠️"}</div>
          <p>
            Deseja {ativando ? "ativar" : "inativar"} o fornecedor{" "}
            <strong style={{ color: "var(--text)" }}>"{fornecedor.nome}"</strong>?
          </p>
          {!ativando && (
            <p style={{ fontSize: 11, color: "var(--text-3)", marginTop: 8 }}>
              Fornecedores inativos não aparecem nas sugestões de novas compras.
            </p>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button
            className={ativando ? "btn-primary" : "btn-danger"}
            onClick={onConfirm}
          >
            {ativando ? "Ativar" : "Inativar"}
          </button>
        </div>

      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════
   COMPONENTE PRINCIPAL — Fornecedores
   ══════════════════════════════════════════════════ */
export default function Fornecedores() {
  const [uid,          setUid]          = useState(null);
  const [fornecedores, setFornecedores] = useState([]);
  const [loading,      setLoading]      = useState(true);

  /* Modais */
  const [modalNovo,     setModalNovo]     = useState(false);
  const [editando,      setEditando]      = useState(null);
  const [toggleAlvo,    setToggleAlvo]    = useState(null);

  /* Filtros */
  const [search,        setSearch]        = useState("");
  const [filtroStatus,  setFiltroStatus]  = useState("todos");

  /* ── Auth ── */
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, user => {
      setUid(user?.uid || null);
    });
    return unsub;
  }, []);

  /* ── Listener Firestore ── */
  useEffect(() => {
    if (!uid) return;

    const col = collection(db, "users", uid, "fornecedores");
    const unsub = onSnapshot(
      col,
      (snap) => {
        const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        /* Ordenar por nome A→Z */
        lista.sort((a, b) => (a.nome || "").localeCompare(b.nome || "", "pt-BR"));
        setFornecedores(lista);
        setLoading(false);
      },
      (error) => {
        console.error("Erro ao carregar fornecedores:", error);
        setLoading(false);
      }
    );

    return unsub;
  }, [uid]);

  /* ── Salvar (Criar / Editar) ── */
  const handleSave = useCallback(async (payload, fornecedorExistente) => {
    if (!uid) return;

    try {
      if (fornecedorExistente) {
        /* EDITAR: atualizar documento existente via doc.id interno */
        const ref = doc(db, "users", uid, "fornecedores", fornecedorExistente.id);
        await updateDoc(ref, payload);
        setEditando(null);
      } else {
        /* CRIAR: Firestore gera doc.id automaticamente */
        const col = collection(db, "users", uid, "fornecedores");
        await addDoc(col, payload);
        setModalNovo(false);
      }
    } catch (error) {
      console.error("Erro ao persistir fornecedor:", error);
      /* Re-lança para o modal tratar e exibir para o usuário */
      throw new Error("Falha ao salvar no banco de dados. Tente novamente.");
    }
  }, [uid]);

  /* ── Toggle de Status ── */
  const handleToggleStatus = useCallback(async () => {
    if (!uid || !toggleAlvo) return;

    const novoStatus = toggleAlvo.status === "ativo" ? "inativo" : "ativo";

    try {
      const ref = doc(db, "users", uid, "fornecedores", toggleAlvo.id);
      await updateDoc(ref, {
        status:          novoStatus,
        dataAtualizacao: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Erro ao alterar status do fornecedor:", error);
    } finally {
      setToggleAlvo(null);
    }
  }, [uid, toggleAlvo]);

  /* ── Filtros com useMemo ── */
  const fornecedoresFiltrados = useMemo(() => {
    let lista = [...fornecedores];

    /* Filtro por status */
    if (filtroStatus !== "todos") {
      lista = lista.filter(f => f.status === filtroStatus);
    }

    /* Filtro por busca (nome, documento, email) */
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      lista = lista.filter(f =>
        f.nome?.toLowerCase().includes(q)        ||
        f.documento?.toLowerCase().includes(q)   ||
        f.email?.toLowerCase().includes(q)       ||
        f.telefone?.toLowerCase().includes(q)
      );
    }

    return lista;
  }, [fornecedores, filtroStatus, search]);

  /* ── Contadores para badges ── */
  const contadores = useMemo(() => ({
    todos:   fornecedores.length,
    ativos:  fornecedores.filter(f => f.status === "ativo").length,
    inativos: fornecedores.filter(f => f.status === "inativo").length,
  }), [fornecedores]);

  if (!uid) return <div className="fn-loading">Carregando autenticação...</div>;

  return (
    <>
      <style>{CSS}</style>

      {/* Topbar */}
      <header className="fn-topbar">
        <div className="fn-topbar-title">
          <h1>Fornecedores</h1>
          <p>Gerencie seus fornecedores e parceiros</p>
        </div>

        <div className="fn-search">
          <Search size={13} color="var(--text-3)" />
          <input
            placeholder="Buscar por nome, CNPJ ou e-mail..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div className="fn-topbar-right">
          <button
            style={{
              display: "flex", alignItems: "center", gap: 7,
              padding: "8px 16px", borderRadius: 9, background: "var(--gold)",
              color: "#0a0808", border: "none", cursor: "pointer",
              fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600,
              whiteSpace: "nowrap", transition: "opacity .13s",
            }}
            onClick={() => setModalNovo(true)}
          >
            <Plus size={14} /> Novo Fornecedor
          </button>
        </div>
      </header>

      {/* Filtros de status */}
      <div className="fn-filters">
        <span className="fn-filter-label">
          <Filter size={11} /> Status:
        </span>

        <button
          className={`fn-filter-btn ${filtroStatus === "todos" ? "active" : ""}`}
          onClick={() => setFiltroStatus("todos")}
        >
          Todos ({contadores.todos})
        </button>

        <button
          className={`fn-filter-btn ${filtroStatus === "ativo" ? "active-green" : ""}`}
          onClick={() => setFiltroStatus("ativo")}
        >
          Ativos ({contadores.ativos})
        </button>

        <button
          className={`fn-filter-btn ${filtroStatus === "inativo" ? "active-red" : ""}`}
          onClick={() => setFiltroStatus("inativo")}
        >
          Inativos ({contadores.inativos})
        </button>
      </div>

      {/* Tabela */}
      <div className="ag-content">
        <div className="fn-table-wrap">

          <div className="fn-table-header">
            <div className="fn-table-title">
              Fornecedores
              <span className="fn-count-badge">{fornecedoresFiltrados.length}</span>
            </div>
            <div className="fn-table-actions">
              <button
                className="fn-export-btn"
                onClick={() => exportarCSV(fornecedoresFiltrados)}
                title="Exportar CSV"
              >
                <Download size={11} /> CSV
              </button>
            </div>
          </div>

          {/* Cabeçalho da tabela */}
          <div className="fn-row fn-row-head">
            <span>NOME</span>
            <span>DOCUMENTO</span>
            <span>TELEFONE</span>
            <span>E-MAIL</span>
            <span>STATUS</span>
            <span style={{ textAlign: "right" }}>AÇÕES</span>
          </div>

          {loading ? (
            <div className="fn-loading">
              <Truck size={28} color="var(--text-3)" style={{ marginBottom: 8 }} />
              <p>Carregando fornecedores...</p>
            </div>
          ) : fornecedoresFiltrados.length === 0 ? (
            <div className="fn-empty">
              <Truck size={28} color="var(--text-3)" style={{ marginBottom: 8 }} />
              <p>
                {search || filtroStatus !== "todos"
                  ? "Nenhum fornecedor encontrado para este filtro."
                  : "Nenhum fornecedor cadastrado. Clique em \"Novo Fornecedor\" para começar."}
              </p>
            </div>
          ) : fornecedoresFiltrados.map(f => (
            <div key={f.id} className="fn-row">

              {/* Nome + data de criação */}
              <div>
                <div className="fn-nome">{f.nome}</div>
                {f.dataCriacao && (
                  <div style={{ fontSize: 10, color: "var(--text-3)", marginTop: 2 }}>
                    Desde {fmtData(f.dataCriacao)}
                  </div>
                )}
              </div>

              <span className="fn-doc">{fmtDoc(f.documento)}</span>
              <span>{fmtTel(f.telefone)}</span>
              <span style={{ fontSize: 11 }}>{f.email || "—"}</span>

              {/* Badge de status */}
              <span>
                <span className={`fn-status-badge fn-status-${f.status || "ativo"}`}>
                  <span className="fn-status-dot" />
                  {f.status === "inativo" ? "Inativo" : "Ativo"}
                </span>
              </span>

              {/* Ações */}
              <div className="fn-actions">
                <button
                  className="btn-icon btn-icon-edit"
                  title="Editar"
                  onClick={() => setEditando(f)}
                >
                  <Edit2 size={13} />
                </button>
                <button
                  className="btn-icon btn-icon-toggle"
                  title={f.status === "ativo" ? "Inativar" : "Ativar"}
                  onClick={() => setToggleAlvo(f)}
                >
                  {f.status === "ativo"
                    ? <ToggleRight size={15} color="var(--green)" />
                    : <ToggleLeft  size={15} color="var(--text-3)" />}
                </button>
              </div>

            </div>
          ))}

        </div>
      </div>

      {/* Modal: Novo Fornecedor */}
      {modalNovo && (
        <ModalFornecedor
          uid={uid}
          onSave={handleSave}
          onClose={() => setModalNovo(false)}
        />
      )}

      {/* Modal: Editar Fornecedor */}
      {editando && (
        <ModalFornecedor
          fornecedor={editando}
          uid={uid}
          onSave={handleSave}
          onClose={() => setEditando(null)}
        />
      )}

      {/* Modal: Confirmar Toggle */}
      {toggleAlvo && (
        <ModalConfirmToggle
          fornecedor={toggleAlvo}
          onConfirm={handleToggleStatus}
          onClose={() => setToggleAlvo(null)}
        />
      )}
    </>
  );
}
