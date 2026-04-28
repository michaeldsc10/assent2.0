/* ═══════════════════════════════════════════════════
   ASSENT v2.0 — Servicos.jsx
   Estrutura:
     users/{uid}/servicos/{id}          ← serviços
     users/{uid}/categorias/{id}        ← categorias de serviço
   ═══════════════════════════════════════════════════ */

import { useState, useEffect, useMemo } from "react";
import { Search, Plus, Edit2, Trash2, X, Tag, Settings, AlertTriangle } from "lucide-react";

import { db } from "../lib/firebase";
import { fsSnapshotError } from "../utils/firestoreError";
import { useAuth } from "../contexts/AuthContext";
import { logAction, LOG_ACAO, LOG_MODULO, montarDescricao } from "../lib/logAction";
import {LIMITES_FREE } from "../hooks/useLicenca";
import {  BannerLimite  } from  "../hooks/LicencaUI.jsx";
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  getDocs,
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
  .modal-box-md  { max-width: 420px; }
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
  .form-row-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px; }

  textarea.form-input { resize: vertical; min-height: 70px; }

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
  .btn-danger:disabled { opacity: .5; cursor: not-allowed; }

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

  .btn-novo-sv {
    display: flex; align-items: center; gap: 7px;
    padding: 8px 16px; border-radius: 9px;
    background: var(--gold); color: #0a0808;
    border: none; cursor: pointer;
    font-family: 'DM Sans', sans-serif;
    font-size: 13px; font-weight: 600;
    white-space: nowrap;
    transition: opacity .13s, transform .1s;
  }
  .btn-novo-sv:hover  { opacity: .88; }

  /* Topbar */
  .sv-topbar {
    padding: 14px 22px;
    background: var(--s1); border-bottom: 1px solid var(--border);
    display: flex; align-items: center; gap: 14px; flex-shrink: 0;
    flex-wrap: wrap;
  }
  .sv-topbar-title h1 {
    font-family: 'Sora', sans-serif; font-size: 17px; font-weight: 600;
    color: var(--text);
  }
  .sv-topbar-title p { font-size: 11px; color: var(--text-2); margin-top: 2px; }
  .sv-topbar-actions { display: flex; align-items: center; gap: 8px; margin-left: auto; }

  .sv-search {
    display: flex; align-items: center; gap: 8px;
    background: var(--s2); border: 1px solid var(--border);
    border-radius: 8px; padding: 8px 12px; width: 270px;
  }
  .sv-search input {
    background: transparent; border: none; outline: none;
    color: var(--text); font-size: 12px; width: 100%;
    font-family: 'DM Sans', sans-serif;
  }

  /* Botão gerenciar categorias */
  .btn-cat-manage {
    display: flex; align-items: center; gap: 6px;
    padding: 8px 13px; border-radius: 9px;
    background: var(--s2); color: var(--text-2);
    border: 1px solid var(--border); cursor: pointer;
    font-family: 'DM Sans', sans-serif; font-size: 12px;
    transition: all .13s;
    white-space: nowrap;
  }
  .btn-cat-manage:hover { background: var(--s3); color: var(--text); border-color: var(--border-h); }

  /* Tabela */
  .sv-table-wrap {
    background: var(--s1); border: 1px solid var(--border);
    border-radius: 12px; overflow: hidden;
  }
  .sv-table-header {
    padding: 13px 18px;
    border-bottom: 1px solid var(--border);
    display: flex; align-items: center; justify-content: space-between;
  }
  .sv-table-title {
    font-family: 'Sora', sans-serif; font-size: 13px; font-weight: 600;
    color: var(--text);
  }
  .sv-count-badge {
    font-family: 'Sora', sans-serif; font-size: 12px; font-weight: 600;
    background: var(--s3); border: 1px solid var(--border-h);
    color: var(--text-2); padding: 2px 10px; border-radius: 20px;
  }

  .sv-row {
    display: grid;
    grid-template-columns: 72px 1fr 110px 110px 110px 80px 1fr 84px;
    padding: 11px 18px; gap: 8px;
    border-bottom: 1px solid var(--border);
    align-items: center; font-size: 12px; color: var(--text-2);
  }
  .sv-row:last-child { border-bottom: none; }
  .sv-row:hover { background: rgba(255,255,255,0.02); }
  .sv-row-head { background: var(--s2); }
  .sv-row-head span {
    font-size: 10px; font-weight: 500; letter-spacing: .06em;
    text-transform: uppercase; color: var(--text-3);
  }

  .sv-id { font-family: 'Sora', sans-serif; font-size: 11px; color: var(--gold); font-weight: 500; }
  .sv-nome { color: var(--text); font-size: 13px; font-weight: 500; }
  .sv-preco { color: var(--green); font-family: 'Sora', sans-serif; font-size: 12px; font-weight: 500; }
  .sv-custo { color: var(--red); font-size: 12px; }
  .sv-desc { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 11px; color: var(--text-3); }
  .sv-actions { display: flex; align-items: center; gap: 5px; justify-content: flex-end; }

  /* Badge de margem */
  .sv-margin-badge {
    display: inline-flex; align-items: center; justify-content: center;
    padding: 3px 8px; border-radius: 6px;
    font-family: 'Sora', sans-serif; font-size: 11px; font-weight: 600;
  }
  .sv-margin-badge.high   { background: rgba(72,199,142,.12); color: #48c78e; }
  .sv-margin-badge.medium { background: rgba(200,165,94,.12); color: var(--gold); }
  .sv-margin-badge.low    { background: rgba(224,82,82,.12);  color: var(--red); }

  /* Badge de categoria */
  .cat-badge {
    display: inline-flex; align-items: center;
    padding: 3px 9px; border-radius: 6px;
    font-size: 11px; font-weight: 500;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    max-width: 100%;
  }

  .sv-empty, .sv-loading { padding: 56px 20px; text-align: center; color: var(--text-3); }
  .sv-empty p { font-size: 13px; margin-bottom: 4px; }
  .sv-empty span { font-size: 11px; }

  /* ── Modal Categoria ── */
  .cat-list { display: flex; flex-direction: column; gap: 6px; margin-bottom: 16px; }
  .cat-item {
    display: flex; align-items: center; gap: 10px;
    background: var(--s2); border: 1px solid var(--border);
    border-radius: 9px; padding: 10px 13px;
    transition: border-color .13s;
  }
  .cat-item:hover { border-color: var(--border-h); }
  .cat-color-dot {
    width: 12px; height: 12px; border-radius: 50%; flex-shrink: 0;
  }
  .cat-item-name { flex: 1; font-size: 13px; color: var(--text); }
  .cat-item-actions { display: flex; gap: 4px; }

  .cat-form {
    background: var(--s2); border: 1px solid var(--border-h);
    border-radius: 10px; padding: 14px;
    margin-bottom: 16px;
  }
  .cat-form-title {
    font-size: 11px; font-weight: 600; text-transform: uppercase;
    letter-spacing: .06em; color: var(--text-2); margin-bottom: 12px;
  }
  .cat-color-row {
    display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
    margin-top: 8px;
  }
  .cat-color-opt {
    width: 22px; height: 22px; border-radius: 50%;
    cursor: pointer; border: 2px solid transparent;
    transition: transform .13s, border-color .13s;
    flex-shrink: 0;
  }
  .cat-color-opt:hover { transform: scale(1.15); }
  .cat-color-opt.selected { border-color: white; transform: scale(1.15); }

  /* Seletor de categoria no form */
  .sv-cat-select-wrap {
    display: flex; align-items: center; gap: 6px;
  }
  .sv-cat-select {
    flex: 1; background: var(--s2);
    border: 1px solid var(--border); border-radius: 9px;
    padding: 10px 13px; color: var(--text); font-size: 13px;
    font-family: 'DM Sans', sans-serif;
    outline: none; transition: border-color .15s;
    cursor: pointer;
  }
  .sv-cat-select:focus { border-color: var(--gold); }
  .sv-cat-select.err { border-color: var(--red); }

  /* Aviso de exclusão protegida */
  .del-warn {
    display: flex; gap: 12px; align-items: flex-start;
    background: rgba(224,82,82,.08); border: 1px solid rgba(224,82,82,.2);
    border-radius: 10px; padding: 14px 16px; margin-bottom: 16px;
  }
  .del-warn-icon { flex-shrink: 0; margin-top: 1px; }
  .del-warn-text { font-size: 12px; color: var(--text-2); line-height: 1.6; }
  .del-warn-text strong { color: var(--red); }

  .confirm-body {
    padding: 24px 22px; text-align: center;
    font-size: 13px; color: var(--text-2); line-height: 1.6;
  }
  .confirm-icon { font-size: 32px; margin-bottom: 12px; }
`;

/* ── Paleta de cores para categorias ── */
const CAT_COLORS = [
  { hex: "#c8a55e", label: "Ouro"    },
  { hex: "#5b8ef0", label: "Azul"    },
  { hex: "#48c78e", label: "Verde"   },
  { hex: "#e05252", label: "Vermelho"},
  { hex: "#a855f7", label: "Roxo"    },
  { hex: "#f59e0b", label: "Âmbar"   },
  { hex: "#ec4899", label: "Rosa"    },
  { hex: "#06b6d4", label: "Ciano"   },
  { hex: "#84cc16", label: "Lima"    },
  { hex: "#94a3b8", label: "Cinza"   },
];

/* ── Helpers ── */
const fmtR$ = (v) =>
  `R$ ${Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

const gerarIdServico = (cnt) => `SV${String(cnt + 1).padStart(4, "0")}`;

function calcMargem(preco, custo) {
  const p = Number(preco) || 0;
  const c = Number(custo) || 0;
  if (p === 0) return null;
  return ((p - c) / p) * 100;
}

function MargemBadge({ preco, custo }) {
  const m = calcMargem(preco, custo);
  if (m === null) return <span style={{ color: "var(--text-3)", fontSize: 11 }}>—</span>;
  const cls = m >= 70 ? "high" : m >= 40 ? "medium" : "low";
  return <span className={`sv-margin-badge ${cls}`}>{m.toFixed(1)}%</span>;
}

function CatBadge({ categoria, categorias }) {
  const cat = categorias?.find(c => c.id === categoria || c.nome === categoria);
  if (!cat) return <span style={{ color: "var(--text-3)", fontSize: 11 }}>—</span>;
  const bg = cat.cor ? `${cat.cor}22` : "rgba(200,165,94,0.12)";
  const color = cat.cor || "var(--gold)";
  return (
    <span className="cat-badge" style={{ background: bg, color }}>
      {cat.nome}
    </span>
  );
}

/* ════════════════════════════════════════════════════
   MODAL: Gerenciar Categorias
   ════════════════════════════════════════════════════ */
function ModalCategorias({ categorias, onClose, onAdd, onEdit, onDelete, servicos }) {
  const [form, setForm]   = useState({ nome: "", cor: CAT_COLORS[0].hex });
  const [editing, setEditing] = useState(null); // categoria sendo editada
  const [erros, setErros] = useState({});
  const [salvando, setSalvando] = useState(false);

  const resetForm = () => {
    setForm({ nome: "", cor: CAT_COLORS[0].hex });
    setEditing(null);
    setErros({});
  };

  const iniciarEdicao = (cat) => {
    setEditing(cat);
    setForm({ nome: cat.nome, cor: cat.cor || CAT_COLORS[0].hex });
    setErros({});
  };

  const validar = () => {
    const e = {};
    const nomeLimpo = form.nome.trim();
    if (!nomeLimpo) { e.nome = "Nome é obrigatório."; }
    else {
      const dup = categorias.some(c =>
        c.nome.trim().toLowerCase() === nomeLimpo.toLowerCase() &&
        c.id !== editing?.id
      );
      if (dup) e.nome = "Já existe uma categoria com este nome.";
    }
    setErros(e);
    return Object.keys(e).length === 0;
  };

  const handleSalvar = async () => {
    if (!validar()) return;
    setSalvando(true);
    if (editing) {
      await onEdit(editing.id, { nome: form.nome.trim(), cor: form.cor });
    } else {
      await onAdd({ nome: form.nome.trim(), cor: form.cor });
    }
    setSalvando(false);
    resetForm();
  };

  const servicosDaCat = (catId) =>
    servicos.filter(s => s.categoriaId === catId || s.categoria === catId).length;

  return (
    <div className="modal-overlay modal-overlay-top" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 480 }}>
        <div className="modal-header">
          <div>
            <div className="modal-title">Categorias de Serviço</div>
            <div className="modal-sub">Crie e personalize as categorias</div>
          </div>
          <button className="modal-close" onClick={onClose}>
            <X size={14} color="var(--text-2)" />
          </button>
        </div>

        <div className="modal-body">
          {/* Formulário add/edit */}
          <div className="cat-form">
            <div className="cat-form-title">{editing ? "Editar Categoria" : "Nova Categoria"}</div>

            <div className="form-group" style={{ marginBottom: 10 }}>
              <input
                className={`form-input ${erros.nome ? "err" : ""}`}
                placeholder="Nome da categoria"
                value={form.nome}
                onChange={e => {
                  setForm(f => ({ ...f, nome: e.target.value }));
                  if (erros.nome) setErros(ev => ({ ...ev, nome: "" }));
                }}
              />
              {erros.nome && <div className="form-error">{erros.nome}</div>}
            </div>

            <div className="form-label">Cor</div>
            <div className="cat-color-row">
              {CAT_COLORS.map(c => (
                <div
                  key={c.hex}
                  className={`cat-color-opt ${form.cor === c.hex ? "selected" : ""}`}
                  style={{ background: c.hex }}
                  title={c.label}
                  onClick={() => setForm(f => ({ ...f, cor: c.hex }))}
                />
              ))}
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 14, justifyContent: "flex-end" }}>
              {editing && (
                <button className="btn-secondary" onClick={resetForm}>Cancelar</button>
              )}
              <button className="btn-primary" onClick={handleSalvar} disabled={salvando}>
                {salvando ? "Salvando..." : editing ? "Salvar Alterações" : "+ Adicionar"}
              </button>
            </div>
          </div>

          {/* Lista */}
          {categorias.length === 0 ? (
            <div style={{ textAlign: "center", color: "var(--text-3)", fontSize: 12, padding: "12px 0" }}>
              Nenhuma categoria criada ainda.
            </div>
          ) : (
            <div className="cat-list">
              {categorias.map(cat => {
                const usada = servicosDaCat(cat.id);
                return (
                  <div key={cat.id} className="cat-item">
                    <div className="cat-color-dot" style={{ background: cat.cor || "var(--gold)" }} />
                    <span className="cat-item-name">{cat.nome}</span>
                    {usada > 0 && (
                      <span style={{ fontSize: 10, color: "var(--text-3)" }}>
                        {usada} serviço{usada > 1 ? "s" : ""}
                      </span>
                    )}
                    <div className="cat-item-actions">
                      <button className="btn-icon btn-icon-edit" onClick={() => iniciarEdicao(cat)}>
                        <Edit2 size={12} />
                      </button>
                      <button
                        className="btn-icon btn-icon-del"
                        title={usada > 0 ? "Remova os serviços desta categoria antes de excluí-la" : "Excluir"}
                        onClick={() => {
                          if (usada > 0) {
                            alert(`Esta categoria está em uso por ${usada} serviço(s). Altere-os antes de excluir.`);
                            return;
                          }
                          onDelete(cat.id);
                        }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════
   MODAL: Novo / Editar Serviço
   ════════════════════════════════════════════════════ */
function ModalNovoServico({ servico, servicos, categorias, onSave, onClose, onAbrirCategorias }) {
  const isEdit = !!servico;

  const [form, setForm] = useState({
    nome:        servico?.nome        || "",
    preco:       servico?.preco       != null ? String(servico.preco)  : "",
    custo:       servico?.custo       != null ? String(servico.custo)  : "",
    categoriaId: servico?.categoriaId || "",
    descricao:   servico?.descricao   || "",
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

    if (!nomeLimpo) e.nome = "Nome é obrigatório.";

    if (nomeLimpo) {
      const dup = servicos.some(s =>
        s.nome.trim().toLowerCase() === nomeLimpo.toLowerCase() &&
        s.id !== servico?.id
      );
      if (dup) e.nome = "Já existe um serviço com este nome exato.";
    }

    const preco = parseFloat(form.preco.replace(",", "."));
    if (form.preco === "" || isNaN(preco) || preco < 0)
      e.preco = "Informe um preço válido (≥ 0).";

    const custo = parseFloat(form.custo.replace(",", "."));
    if (form.custo !== "" && (isNaN(custo) || custo < 0))
      e.custo = "Custo inválido.";

    setErros(e);
    return Object.keys(e).length === 0;
  };

  const parseMoeda = (v) => {
    const n = parseFloat(String(v).replace(",", "."));
    return isNaN(n) ? 0 : n;
  };

  const handleSalvar = async () => {
    if (!validar()) return;
    setSalvando(true);
    await onSave({
      nome:        form.nome.trim(),
      preco:       parseMoeda(form.preco),
      custo:       parseMoeda(form.custo),
      categoriaId: form.categoriaId || null,
      descricao:   form.descricao.trim(),
    });
    setSalvando(false);
  };

  // Margem preview em tempo real
  const margem = calcMargem(parseMoeda(form.preco), parseMoeda(form.custo));
  const margemCls = margem === null ? "" : margem >= 70 ? "high" : margem >= 40 ? "medium" : "low";

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <div className="modal-header">
          <div>
            <div className="modal-title">{isEdit ? "Editar Serviço" : "Novo Serviço"}</div>
            <div className="modal-sub">
              {isEdit
                ? `Editando ${servico.id} — ${servico.nome}`
                : "Preencha os dados do serviço"}
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
              placeholder="Ex: Ensaio Fotográfico Externo"
              autoFocus
            />
            {erros.nome && <div className="form-error">{erros.nome}</div>}
          </div>

          {/* Preço + Custo */}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">
                Preço (R$) <span className="form-label-req">*</span>
              </label>
              <input
                className={`form-input ${erros.preco ? "err" : ""}`}
                value={form.preco}
                onChange={e => set("preco", e.target.value)}
                placeholder="0,00"
                inputMode="decimal"
              />
              {erros.preco && <div className="form-error">{erros.preco}</div>}
            </div>
            <div className="form-group">
              <label className="form-label">Custo Estimado (R$)</label>
              <input
                className={`form-input ${erros.custo ? "err" : ""}`}
                value={form.custo}
                onChange={e => set("custo", e.target.value)}
                placeholder="0,00"
                inputMode="decimal"
              />
              {erros.custo && <div className="form-error">{erros.custo}</div>}
            </div>
          </div>

          {/* Preview de margem */}
          {margem !== null && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: -8, marginBottom: 16 }}>
              <span style={{ fontSize: 11, color: "var(--text-3)" }}>Margem estimada:</span>
              <span className={`sv-margin-badge ${margemCls}`}>{margem.toFixed(1)}%</span>
            </div>
          )}

          {/* Categoria */}
          <div className="form-group">
            <label className="form-label">Categoria</label>
            <div className="sv-cat-select-wrap">
              <select
                className={`sv-cat-select ${erros.categoriaId ? "err" : ""}`}
                value={form.categoriaId}
                onChange={e => set("categoriaId", e.target.value)}
              >
                <option value="">Sem categoria</option>
                {categorias.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.nome}</option>
                ))}
              </select>
              <button
                className="btn-cat-manage"
                type="button"
                title="Gerenciar categorias"
                onClick={onAbrirCategorias}
              >
                <Settings size={13} />
              </button>
            </div>
          </div>

          {/* Descrição */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Descrição</label>
            <textarea
              className="form-input"
              value={form.descricao}
              onChange={e => set("descricao", e.target.value)}
              placeholder="Breve descrição do serviço (opcional)"
              rows={3}
            />
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" onClick={handleSalvar} disabled={salvando}>
            {salvando ? "Salvando..." : isEdit ? "Salvar Alterações" : "Cadastrar Serviço"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════
   MODAL: Confirmar Exclusão de Serviço
   ════════════════════════════════════════════════════ */
function ModalConfirmDelete({ servico, vendas, onConfirm, onClose }) {
  const [excluindo, setExcluindo] = useState(false);

  // Verifica quantas vendas referenciam este serviço pelo ID interno
  const vendasComServico = useMemo(() => {
    if (!vendas || !servico) return [];
    return vendas.filter(v =>
      v.itens?.some(item => item.servicoId === servico.id)
    );
  }, [vendas, servico]);

  const bloqueado = vendasComServico.length > 0;

  const handleConfirm = async () => {
    if (bloqueado) return;
    setExcluindo(true);
    await onConfirm();
    setExcluindo(false);
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box modal-box-md">
        <div className="modal-header">
          <div className="modal-title">Excluir Serviço</div>
          <button className="modal-close" onClick={onClose}>
            <X size={14} color="var(--text-2)" />
          </button>
        </div>

        <div className="modal-body">
          {bloqueado ? (
            <div className="del-warn">
              <div className="del-warn-icon">
                <AlertTriangle size={18} color="var(--red)" />
              </div>
              <div className="del-warn-text">
                <strong>Exclusão bloqueada.</strong><br />
                O serviço <strong>"{servico.nome}"</strong> está referenciado em{" "}
                <strong>{vendasComServico.length} venda(s)</strong> e não pode ser excluído para
                preservar o histórico financeiro.
                <br /><br />
                Se não quiser que ele apareça em novos orçamentos, você pode renomear
                ou manter desativado (em breve).
              </div>
            </div>
          ) : (
            <div className="confirm-body">
              <div className="confirm-icon">🗑️</div>
              <p>
                Tem certeza que deseja excluir{" "}
                <strong>{servico.nome}</strong>?<br />
                Esta ação não pode ser desfeita.
              </p>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>
            {bloqueado ? "Fechar" : "Cancelar"}
          </button>
          {!bloqueado && (
            <button className="btn-danger" onClick={handleConfirm} disabled={excluindo}>
              {excluindo ? "Excluindo..." : "Confirmar Exclusão"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
   ════════════════════════════════════════════════════ */
export default function Servicos({ isPro = false }) {
  // ── Multi-tenant ──
  const { tenantUid, cargo, nomeUsuario, podeCriar, podeEditar, podeExcluir } = useAuth();

  // ── Flags de permissão ──
  const podeCriarV  = podeCriar("servicos");
  const podeEditarV = podeEditar("servicos");
  const podeExcluirV = podeExcluir("servicos");

  const [servicos, setServicos]     = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [vendas, setVendas]         = useState([]);
  const [servicoIdCnt, setServicoIdCnt] = useState(0);
  const [catIdCnt, setCatIdCnt]     = useState(0);
  const [search, setSearch]         = useState("");
  const [loading, setLoading]       = useState(true);

  const [modalNovo, setModalNovo]     = useState(false);
  const [editando, setEditando]       = useState(null);
  const [deletando, setDeletando]     = useState(null);
  const [modalCats, setModalCats]     = useState(false);


  /* Firestore: escuta em tempo real */
  useEffect(() => {
    if (!tenantUid) { setLoading(false); return; }

    const userRef      = doc(db, "users", tenantUid);
    const servicosCol  = collection(db, "users", tenantUid, "servicos");
    const categoriasCol = collection(db, "users", tenantUid, "categoriasServico");
    const vendasCol    = collection(db, "users", tenantUid, "vendas");

    const unsubUser = onSnapshot(userRef, snap => {
      if (snap.exists()) {
        setServicoIdCnt(snap.data().servicoIdCnt || 0);
        setCatIdCnt(snap.data().catServicoIdCnt || 0);
      }
    }, fsSnapshotError("Servicos:userRef"));

    const unsubServicos = onSnapshot(servicosCol, snap => {
      setServicos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, fsSnapshotError("Servicos:servicos"));

    const unsubCats = onSnapshot(categoriasCol, snap => {
      setCategorias(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, fsSnapshotError("Servicos:categorias"));

    const unsubVendas = onSnapshot(vendasCol, snap => {
      setVendas(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, fsSnapshotError("Servicos:vendas"));

    return () => { unsubUser(); unsubServicos(); unsubCats(); unsubVendas(); };
  }, [tenantUid]);

  /* ── CRUD Serviços ── */
  const handleAdd = async (form) => {
    if (!tenantUid) return;
    const newId = gerarIdServico(servicoIdCnt);
    await setDoc(doc(db, "users", tenantUid, "servicos", newId), {
      ...form,
      criadoEm: new Date().toISOString(),
    });
    await setDoc(doc(db, "users", tenantUid), { servicoIdCnt: servicoIdCnt + 1 }, { merge: true });
    await logAction({ tenantUid, nomeUsuario, cargo, acao: LOG_ACAO.CRIAR, modulo: LOG_MODULO.SERVICOS, descricao: montarDescricao("criar", "Serviço", form.nome, newId) });
    setModalNovo(false);
  };

  const handleEdit = async (form) => {
    if (!tenantUid || !editando) return;
    await setDoc(doc(db, "users", tenantUid, "servicos", editando.id), {
      ...form,
      atualizadoEm: new Date().toISOString(),
    }, { merge: true });
    await logAction({ tenantUid, nomeUsuario, cargo, acao: LOG_ACAO.EDITAR, modulo: LOG_MODULO.SERVICOS, descricao: montarDescricao("editar", "Serviço", form.nome, editando.id) });
    setEditando(null);
  };

  const handleDelete = async () => {
    if (!tenantUid || !deletando) return;
    await deleteDoc(doc(db, "users", tenantUid, "servicos", deletando.id));
    await logAction({ tenantUid, nomeUsuario, cargo, acao: LOG_ACAO.EXCLUIR, modulo: LOG_MODULO.SERVICOS, descricao: montarDescricao("excluir", "Serviço", deletando.nome, deletando.id) });
    setDeletando(null);
  };

  /* ── CRUD Categorias ── */
  const handleAddCat = async (form) => {
    if (!tenantUid) return;
    const newId = `CAT${String(catIdCnt + 1).padStart(3, "0")}`;
    await setDoc(doc(db, "users", tenantUid, "categoriasServico", newId), {
      ...form,
      criadoEm: new Date().toISOString(),
    });
    await setDoc(doc(db, "users", tenantUid), { catServicoIdCnt: catIdCnt + 1 }, { merge: true });
  };

  const handleEditCat = async (catId, form) => {
    if (!tenantUid) return;
    await setDoc(doc(db, "users", tenantUid, "categoriasServico", catId), form, { merge: true });
  };

  const handleDeleteCat = async (catId) => {
    if (!tenantUid) return;
    await deleteDoc(doc(db, "users", tenantUid, "categoriasServico", catId));
  };

  /* ── Filtro de busca ── */
  const servicosFiltrados = useMemo(() => {
    if (!search.trim()) return servicos;
    const q = search.toLowerCase();
    return servicos.filter(s => {
      const cat = categorias.find(c => c.id === s.categoriaId);
      return (
        s.nome?.toLowerCase().includes(q) ||
        s.descricao?.toLowerCase().includes(q) ||
        cat?.nome?.toLowerCase().includes(q)
      );
    });
  }, [servicos, categorias, search]);

  // App.jsx bloqueia render enquanto loadingAuth||!tenantUid

  return (
    <>
      <style>{CSS}</style>

      {/* Topbar */}
      <header className="sv-topbar">
        <div className="sv-topbar-title">
          <h1>Serviços</h1>
          <p>Gerencie o catálogo de serviços oferecidos</p>
        </div>

        <div className="sv-search">
          <Search size={13} color="var(--text-3)" />
          <input
            placeholder="Buscar por nome ou categoria..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div className="sv-topbar-actions">
          <button className="btn-cat-manage" onClick={() => setModalCats(true)}>
            <Tag size={13} /> Categorias
          </button>
          <button
            className="btn-novo-sv"
            onClick={() => setModalNovo(true)}
            disabled={!podeCriarV || (!isPro && servicos.length >= LIMITES_FREE.servicos)}
            title={!isPro && servicos.length >= LIMITES_FREE.servicos ? `Limite de ${LIMITES_FREE.servicos} serviços atingido no plano Free` : undefined}
          >
            <Plus size={14} /> Novo Serviço
          </button>
        </div>
      </header>

      {/* Conteúdo */}
      <div className="ag-content">
        <BannerLimite total={servicos.length} limite={LIMITES_FREE.servicos} tipo="serviços" isPro={isPro} />
        <div className="sv-table-wrap">
          <div className="sv-table-header">
            <span className="sv-table-title">Serviços cadastrados</span>
            <span className="sv-count-badge">{servicos.length}</span>
          </div>

          {/* Cabeçalho da tabela */}
          <div className="sv-row sv-row-head">
            <span>ID</span>
            <span>Serviço</span>
            <span>Categoria</span>
            <span>Preço</span>
            <span>Custo</span>
            <span>Margem</span>
            <span>Descrição</span>
            <span style={{ textAlign: "right" }}>Ações</span>
          </div>

          {loading ? (
            <div className="sv-loading">Carregando serviços...</div>
          ) : servicosFiltrados.length === 0 ? (
            <div className="sv-empty">
              <p>
                {search
                  ? `Nenhum serviço encontrado para "${search}".`
                  : "Nenhum serviço cadastrado ainda."}
              </p>
              {!search && (
                <span>Clique em <strong>"+ Novo Serviço"</strong> para começar.</span>
              )}
            </div>
          ) : (
            servicosFiltrados.map(s => (
              <div key={s.id} className="sv-row">
                <span className="sv-id">{s.id}</span>
                <span className="sv-nome">{s.nome}</span>
                <CatBadge categoria={s.categoriaId} categorias={categorias} />
                <span className="sv-preco">{fmtR$(s.preco)}</span>
                <span className="sv-custo">{s.custo ? fmtR$(s.custo) : "—"}</span>
                <MargemBadge preco={s.preco} custo={s.custo} />
                <span className="sv-desc">{s.descricao || "—"}</span>
                <div className="sv-actions">
                  {podeEditarV && <button className="btn-icon btn-icon-edit" onClick={() => setEditando(s)}>
                    <Edit2 size={13} />
                  </button>}
                  {podeExcluirV && <button className="btn-icon btn-icon-del" onClick={() => setDeletando(s)}>
                    <Trash2 size={13} />
                  </button>}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modais */}
      {modalNovo && podeCriarV && (
        <ModalNovoServico
          servicos={servicos}
          categorias={categorias}
          onSave={handleAdd}
          onClose={() => setModalNovo(false)}
          onAbrirCategorias={() => setModalCats(true)}
        />
      )}
      {editando && podeEditarV && (
        <ModalNovoServico
          servico={editando}
          servicos={servicos}
          categorias={categorias}
          onSave={handleEdit}
          onClose={() => setEditando(null)}
          onAbrirCategorias={() => setModalCats(true)}
        />
      )}
      {deletando && podeExcluirV && (
        <ModalConfirmDelete
          servico={deletando}
          vendas={vendas}
          onConfirm={handleDelete}
          onClose={() => setDeletando(null)}
        />
      )}
      {modalCats && (
        <ModalCategorias
          categorias={categorias}
          servicos={servicos}
          onClose={() => setModalCats(false)}
          onAdd={handleAddCat}
          onEdit={handleEditCat}
          onDelete={handleDeleteCat}
        />
      )}
    </>
  );
}
