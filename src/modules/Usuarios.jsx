// Usuarios.jsx — ASSENT v2.0
// Módulo de gerenciamento de usuários — exclusivo para Admin
//
// O que este arquivo implementa:
//   ✓ Listagem de usuários com badge de cargo e status ativo/inativo
//   ✓ Convite de novo usuário via Firebase Auth (secondary app) + Firestore
//   ✓ Criação de /userIndex/{uid} → { tenantUid } para o AuthContext funcionar
//   ✓ Edição de cargo e vínculo de vendedor
//   ✓ Toggle ativo/inativo com confirmação
//   ✓ Limite de 10 usuários adicionais (11 total com o Admin)
//   ✓ Tela de acesso negado para cargos não-Admin
//
// Dependência: firebase.js deve exportar `firebaseConfig` além de `db` e `auth`
// Exemplo: export const firebaseConfig = { apiKey: "...", ... };
//
// Estrutura Firestore gerada:
//   users/{tenantUid}/usuarios/{newUid}  → perfil do usuário
//   userIndex/{newUid}                   → { tenantUid } (índice reverso)

import React, { useState, useEffect, useContext, useMemo } from "react";
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
  getDocs,
} from "firebase/firestore";
import { initializeApp, getApps } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { db, firebaseConfig } from "../lib/firebase";
import AuthContext from "../contexts/AuthContext";

/* ─────────────────────────────────────────────
   CONSTANTES
───────────────────────────────────────────── */
const MAX_USUARIOS = 10; // máximo de usuários adicionais (exceto o Admin)

const CARGOS = [
  { value: "financeiro",  label: "Financeiro",          cor: "#5b8ef0", bg: "rgba(91,142,240,0.12)"  },
  { value: "comercial",   label: "Comercial",           cor: "#3ecf8e", bg: "rgba(62,207,142,0.12)"  },
  { value: "compras",     label: "Compras",             cor: "#f59e0b", bg: "rgba(245,158,11,0.12)"  },
  { value: "operacional", label: "Operacional",         cor: "#a78bfa", bg: "rgba(167,139,250,0.12)" },
  { value: "vendedor",    label: "Vendedor",            cor: "#c8a55e", bg: "rgba(200,165,94,0.12)"  },
  { value: "suporte",     label: "Suporte / Atendimento", cor: "#6b7280", bg: "rgba(107,114,128,0.12)" },
];

const CARGO_MAP = Object.fromEntries(CARGOS.map((c) => [c.value, c]));

/* ─────────────────────────────────────────────
   CSS
───────────────────────────────────────────── */
const CSS = `
  .usr-root {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
    background: var(--bg);
    color: var(--text);
    font-family: 'DM Sans', sans-serif;
  }

  /* ── Topbar ── */
  .usr-topbar {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 20px;
    border-bottom: 1px solid var(--border);
    background: var(--s1);
    flex-shrink: 0;
  }
  .usr-topbar-title h2 {
    font-size: 15px;
    font-weight: 600;
    color: var(--text);
    margin: 0;
  }
  .usr-topbar-title p {
    font-size: 11px;
    color: var(--text-3);
    margin: 2px 0 0;
  }
  .usr-topbar-spacer { flex: 1; }
  .usr-counter {
    font-size: 12px;
    color: var(--text-3);
    background: var(--s2);
    border: 1px solid var(--border);
    border-radius: 20px;
    padding: 4px 10px;
  }
  .usr-counter span { color: var(--gold); font-weight: 600; }

  /* ── Botão Convidar ── */
  .usr-btn-convidar {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    background: linear-gradient(135deg, #c8a55e, #dfc07c);
    color: #0a0808;
    font-weight: 700;
    font-size: 12px;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: opacity .15s;
    white-space: nowrap;
  }
  .usr-btn-convidar:hover { opacity: 0.88; }
  .usr-btn-convidar:disabled { opacity: 0.45; cursor: not-allowed; }

  /* ── Tabela ── */
  .usr-table-wrap {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
  }
  .usr-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }
  .usr-table thead tr {
    border-bottom: 1px solid var(--border);
  }
  .usr-table th {
    padding: 9px 12px;
    text-align: left;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    color: var(--text-3);
  }
  .usr-table tbody tr {
    border-bottom: 1px solid var(--border);
    transition: background .12s;
  }
  .usr-table tbody tr:hover { background: rgba(255,255,255,0.02); }
  .usr-table td {
    padding: 11px 12px;
    vertical-align: middle;
  }

  /* ── Avatar + nome ── */
  .usr-user-cell {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .usr-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: linear-gradient(135deg, #b8952e, #e0c060);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 13px;
    color: #0a0808;
    flex-shrink: 0;
  }
  .usr-avatar.inativo {
    background: var(--s3);
    color: var(--text-3);
  }
  .usr-user-name {
    font-weight: 500;
    color: var(--text);
  }
  .usr-user-name.inativo { color: var(--text-3); text-decoration: line-through; }
  .usr-user-email {
    font-size: 11px;
    color: var(--text-3);
    margin-top: 1px;
  }

  /* ── Badge cargo ── */
  .usr-badge-cargo {
    display: inline-flex;
    align-items: center;
    padding: 3px 9px;
    border-radius: 20px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.03em;
    white-space: nowrap;
  }
  .usr-badge-admin {
    background: rgba(200,165,94,0.15);
    color: var(--gold);
    border: 1px solid rgba(200,165,94,0.25);
  }

  /* ── Badge status ── */
  .usr-badge-ativo {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 3px 9px;
    border-radius: 20px;
    font-size: 11px;
    font-weight: 600;
  }
  .usr-badge-ativo.ativo {
    background: rgba(62,207,142,0.1);
    color: var(--green);
  }
  .usr-badge-ativo.inativo {
    background: rgba(255,255,255,0.04);
    color: var(--text-3);
  }
  .usr-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .usr-dot.ativo  { background: var(--green); }
  .usr-dot.inativo { background: var(--text-3); }

  /* ── Ações ── */
  .usr-acoes {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .usr-btn-acao {
    padding: 5px 10px;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    border: 1px solid transparent;
    transition: background .12s, border-color .12s;
  }
  .usr-btn-acao.editar {
    background: rgba(91,142,240,0.1);
    color: var(--blue);
    border-color: rgba(91,142,240,0.2);
  }
  .usr-btn-acao.editar:hover { background: rgba(91,142,240,0.18); }
  .usr-btn-acao.ativar {
    background: rgba(62,207,142,0.08);
    color: var(--green);
    border-color: rgba(62,207,142,0.2);
  }
  .usr-btn-acao.ativar:hover { background: rgba(62,207,142,0.16); }
  .usr-btn-acao.desativar {
    background: rgba(224,82,82,0.08);
    color: var(--red);
    border-color: rgba(224,82,82,0.18);
  }
  .usr-btn-acao.desativar:hover { background: rgba(224,82,82,0.15); }

  /* ── Linha Admin (destacada) ── */
  .usr-row-admin td:first-child { border-left: 2px solid var(--gold); }

  /* ── Empty state ── */
  .usr-empty {
    text-align: center;
    padding: 60px 20px;
    color: var(--text-3);
  }
  .usr-empty-icon { font-size: 36px; margin-bottom: 12px; }
  .usr-empty h3 { font-size: 14px; color: var(--text-2); margin-bottom: 6px; }
  .usr-empty p { font-size: 12px; }

  /* ── Acesso negado ── */
  .usr-acesso-negado {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    gap: 12px;
    color: var(--text-3);
    text-align: center;
    padding: 40px;
  }
  .usr-acesso-negado-icon { font-size: 40px; }
  .usr-acesso-negado h3 { font-size: 15px; color: var(--text-2); margin: 0; }
  .usr-acesso-negado p  { font-size: 12px; max-width: 320px; line-height: 1.6; }

  /* ─────────────────────────────────
     MODAL
  ───────────────────────────────── */
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.65);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 200;
    padding: 20px;
  }
  .modal-box {
    background: var(--s1);
    border: 1px solid var(--border-h);
    border-radius: 14px;
    width: 100%;
    max-width: 480px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 18px 20px 14px;
    border-bottom: 1px solid var(--border);
  }
  .modal-header h3 {
    font-size: 14px;
    font-weight: 600;
    color: var(--text);
    margin: 0;
  }
  .modal-header p {
    font-size: 11px;
    color: var(--text-3);
    margin: 3px 0 0;
  }
  .modal-close {
    background: transparent;
    border: none;
    color: var(--text-3);
    font-size: 18px;
    cursor: pointer;
    padding: 4px;
    line-height: 1;
    transition: color .12s;
  }
  .modal-close:hover { color: var(--text); }
  .modal-body {
    padding: 18px 20px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 14px;
    flex: 1;
  }
  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding: 14px 20px;
    border-top: 1px solid var(--border);
  }

  /* ── Campos do modal ── */
  .usr-field {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  .usr-field label {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--text-3);
  }
  .usr-field input,
  .usr-field select {
    background: var(--s2);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 9px 12px;
    font-size: 13px;
    color: var(--text);
    outline: none;
    transition: border-color .15s;
    width: 100%;
    font-family: 'DM Sans', sans-serif;
  }
  .usr-field input:focus,
  .usr-field select:focus { border-color: var(--gold); }
  .usr-field input::placeholder { color: var(--text-3); }
  .usr-field input:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .usr-field-hint {
    font-size: 11px;
    color: var(--text-3);
    line-height: 1.5;
  }
  .usr-field-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  /* ── Aviso de cargo ── */
  .usr-cargo-info {
    background: rgba(200,165,94,0.07);
    border: 1px solid rgba(200,165,94,0.18);
    border-radius: 8px;
    padding: 10px 12px;
    font-size: 11px;
    color: var(--text-2);
    line-height: 1.6;
  }

  /* ── Erro ── */
  .usr-erro {
    background: var(--red-d);
    border: 1px solid rgba(224,82,82,0.25);
    border-radius: 8px;
    padding: 10px 12px;
    font-size: 12px;
    color: var(--red);
  }

  /* ── Botões modal ── */
  .usr-btn-cancelar {
    padding: 8px 16px;
    background: transparent;
    border: 1px solid var(--border-h);
    border-radius: 8px;
    color: var(--text-2);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: background .12s;
  }
  .usr-btn-cancelar:hover { background: rgba(255,255,255,0.04); }
  .usr-btn-salvar {
    padding: 8px 20px;
    background: linear-gradient(135deg, #c8a55e, #dfc07c);
    border: none;
    border-radius: 8px;
    color: #0a0808;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    transition: opacity .15s;
  }
  .usr-btn-salvar:hover  { opacity: 0.88; }
  .usr-btn-salvar:disabled { opacity: 0.5; cursor: not-allowed; }

  /* ── Loading spinner ── */
  .usr-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--text-3);
    font-size: 13px;
    gap: 10px;
  }

  /* ── Divisor ── */
  .usr-divider {
    border: none;
    border-top: 1px solid var(--border);
    margin: 2px 0;
  }

  /* ── Toast feedback ── */
  .usr-toast {
    position: fixed;
    bottom: 24px;
    right: 24px;
    background: var(--s2);
    border: 1px solid var(--border-h);
    border-radius: 10px;
    padding: 11px 16px;
    font-size: 13px;
    color: var(--text);
    box-shadow: 0 8px 32px rgba(0,0,0,0.4);
    z-index: 300;
    display: flex;
    align-items: center;
    gap: 8px;
    animation: usr-toast-in 0.2s ease;
  }
  .usr-toast.sucesso { border-color: rgba(62,207,142,0.3); }
  .usr-toast.erro    { border-color: rgba(224,82,82,0.3); }
  @keyframes usr-toast-in {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  @media (max-width: 640px) {
    .usr-table-wrap { padding: 12px; }
    .usr-topbar { flex-wrap: wrap; gap: 8px; }
    .usr-field-row { grid-template-columns: 1fr; }
    .usr-table th:nth-child(3),
    .usr-table td:nth-child(3) { display: none; } /* esconde col vendedor no mobile */
  }
`;

/* ─────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────── */
function inicialNome(nome) {
  if (!nome) return "?";
  const partes = nome.trim().split(" ");
  return partes.length >= 2
    ? (partes[0][0] + partes[partes.length - 1][0]).toUpperCase()
    : partes[0][0].toUpperCase();
}

function BadgeCargo({ cargo }) {
  if (cargo === "admin") {
    return <span className="usr-badge-cargo usr-badge-admin">Admin</span>;
  }
  const c = CARGO_MAP[cargo];
  if (!c) return <span className="usr-badge-cargo" style={{ color: "var(--text-3)" }}>{cargo}</span>;
  return (
    <span
      className="usr-badge-cargo"
      style={{ background: c.bg, color: c.cor, border: `1px solid ${c.cor}33` }}
    >
      {c.label}
    </span>
  );
}

/* ─────────────────────────────────────────────
   MODAL CONVIDAR / EDITAR USUÁRIO
───────────────────────────────────────────── */
function ModalUsuario({ usuario, vendedores, onSalvar, onFechar, salvando }) {
  const isEdicao = Boolean(usuario?.uid);

  const [nome,       setNome]       = useState(usuario?.nome  || "");
  const [email,      setEmail]      = useState(usuario?.email || "");
  const [senha,      setSenha]      = useState("");
  const [cargo,      setCargo]      = useState(usuario?.cargo || "operacional");
  const [vendedorId, setVendedorId] = useState(usuario?.vendedorId || "");
  const [erro,       setErro]       = useState("");

  // Quando muda de cargo e não é mais "vendedor", limpa o vínculo
  useEffect(() => {
    if (cargo !== "vendedor") setVendedorId("");
  }, [cargo]);

  const cargoInfo = {
    financeiro:  "Acesso completo ao módulo financeiro. Visão estratégica dos números.",
    comercial:   "Gestão de vendas, clientes e orçamentos. Sem acesso a dados financeiros sensíveis.",
    compras:     "Gestão de fornecedores, compras e entrada de estoque.",
    operacional: "Dia a dia: estoque, caixa, cadastros. Sem visão financeira estratégica.",
    vendedor:    "Foco no funil de vendas. Enxerga apenas as próprias vendas e agenda.",
    suporte:     "Visualiza clientes e agenda. Sem acesso a dados financeiros.",
  };

  function handleSubmit(e) {
    e.preventDefault();
    setErro("");

    if (!nome.trim())  { setErro("Nome é obrigatório."); return; }
    if (!isEdicao) {
      if (!email.trim()) { setErro("E-mail é obrigatório."); return; }
      if (senha.length < 6) { setErro("A senha deve ter no mínimo 6 caracteres."); return; }
    }
    if (cargo === "vendedor" && !vendedorId) {
      setErro("Selecione o cadastro de vendedor vinculado a este usuário."); return;
    }

    onSalvar({ nome: nome.trim(), email: email.trim(), senha, cargo, vendedorId }, setErro);
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onFechar()}>
      <div className="modal-box">
        <div className="modal-header">
          <div>
            <h3>{isEdicao ? "Editar usuário" : "Convidar novo usuário"}</h3>
            <p>
              {isEdicao
                ? "Altere o cargo ou o vínculo de vendedor"
                : "Cria uma conta e define o cargo de acesso"}
            </p>
          </div>
          <button className="modal-close" onClick={onFechar} aria-label="Fechar">✕</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">

            {/* Nome */}
            <div className="usr-field">
              <label>Nome completo</label>
              <input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Maria Silva"
                required
              />
            </div>

            {/* E-mail e Senha — só no convite */}
            {!isEdicao && (
              <div className="usr-field-row">
                <div className="usr-field">
                  <label>E-mail</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="usuario@email.com"
                    required
                  />
                </div>
                <div className="usr-field">
                  <label>Senha inicial</label>
                  <input
                    type="password"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    placeholder="Mín. 6 caracteres"
                    required
                    minLength={6}
                  />
                  <span className="usr-field-hint">O usuário pode alterar depois.</span>
                </div>
              </div>
            )}

            {/* E-mail só leitura na edição */}
            {isEdicao && (
              <div className="usr-field">
                <label>E-mail</label>
                <input value={usuario.email} disabled />
                <span className="usr-field-hint">O e-mail não pode ser alterado após a criação.</span>
              </div>
            )}

            <hr className="usr-divider" />

            {/* Cargo */}
            <div className="usr-field">
              <label>Cargo</label>
              <select value={cargo} onChange={(e) => setCargo(e.target.value)}>
                {CARGOS.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>

            {/* Info do cargo */}
            {cargoInfo[cargo] && (
              <div className="usr-cargo-info">
                💡 <strong>{CARGO_MAP[cargo]?.label}:</strong> {cargoInfo[cargo]}
              </div>
            )}

            {/* Vínculo de vendedor — só aparece quando cargo = "vendedor" */}
            {cargo === "vendedor" && (
              <div className="usr-field">
                <label>Cadastro de vendedor vinculado</label>
                {vendedores.length === 0 ? (
                  <p className="usr-field-hint" style={{ color: "var(--amber)" }}>
                    ⚠️ Nenhum vendedor cadastrado ainda. Acesse o módulo Vendedores e crie o cadastro primeiro.
                  </p>
                ) : (
                  <select value={vendedorId} onChange={(e) => setVendedorId(e.target.value)}>
                    <option value="">— Selecione o vendedor —</option>
                    {vendedores
                      .filter((v) => v.ativo !== false)
                      .map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.nome}{v.comissao ? ` (${v.comissao}% comissão)` : ""}
                        </option>
                      ))}
                  </select>
                )}
                <span className="usr-field-hint">
                  Este é o cadastro que filtra as vendas e a agenda deste usuário.
                </span>
              </div>
            )}

            {/* Erro */}
            {erro && <div className="usr-erro">⚠️ {erro}</div>}

          </div>

          <div className="modal-footer">
            <button type="button" className="usr-btn-cancelar" onClick={onFechar} disabled={salvando}>
              Cancelar
            </button>
            <button type="submit" className="usr-btn-salvar" disabled={salvando}>
              {salvando
                ? "Aguarde…"
                : isEdicao
                ? "Salvar alterações"
                : "Criar usuário"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   COMPONENTE PRINCIPAL
───────────────────────────────────────────── */
export default function Usuarios() {
  const { user, cargo, tenantUid, isAdmin } = useContext(AuthContext);

  const [usuarios,   setUsuarios]   = useState([]);
  const [vendedores, setVendedores] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [usuarioEditando, setUsuarioEditando] = useState(null);
  const [salvando,   setSalvando]   = useState(false);
  const [toast,      setToast]      = useState(null); // { msg, tipo }

  // tenantUid = uid do Admin dono da conta (raiz do Firestore)
  const raiz = tenantUid || user?.uid;

  /* ── Firestore: ouvir usuários ── */
  useEffect(() => {
    if (!raiz) return;
    const colRef = collection(db, "users", raiz, "usuarios");
    const unsub = onSnapshot(colRef, (snap) => {
      const lista = snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
      // Ordena: ativos primeiro, depois pelo nome
      lista.sort((a, b) => {
        if (a.ativo === b.ativo) return (a.nome || "").localeCompare(b.nome || "");
        return a.ativo === false ? 1 : -1;
      });
      setUsuarios(lista);
      setLoading(false);
    });
    return () => unsub();
  }, [raiz]);

  /* ── Firestore: ouvir vendedores (para o select no modal) ── */
  useEffect(() => {
    if (!raiz) return;
    const colRef = collection(db, "users", raiz, "vendedores");
    const unsub = onSnapshot(colRef, (snap) => {
      setVendedores(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [raiz]);

  /* ── Notificação toast ── */
  function mostrarToast(msg, tipo = "sucesso") {
    setToast({ msg, tipo });
    setTimeout(() => setToast(null), 3500);
  }

  /* ── Abrir modal de edição ── */
  function abrirEditar(usr) {
    setUsuarioEditando(usr);
    setModalAberto(true);
  }

  /* ── Fechar modal ── */
  function fecharModal() {
    setModalAberto(false);
    setUsuarioEditando(null);
  }

  /* ── Contar usuários não-admin ativos ── */
  const totalAtivos = usuarios.filter((u) => u.ativo !== false).length;

  /* ── Criar usuário via Firebase Auth (secondary app) + Firestore ── */
  async function criarUsuario({ nome, email, senha, cargo: novoCargo, vendedorId }, setErro) {
    setSalvando(true);
    try {
      // 1. Cria ou reutiliza a secondary app para não deslogar o Admin
      const secondaryAppName = "assent-secondary";
      let secondaryApp = getApps().find((a) => a.name === secondaryAppName);
      if (!secondaryApp) {
        secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
      }
      const secondaryAuth = getAuth(secondaryApp);

      // 2. Cria o usuário no Firebase Auth
      const { user: novoUser } = await createUserWithEmailAndPassword(
        secondaryAuth, email, senha
      );
      const novoUid = novoUser.uid;

      // 3. Sign out da secondary app (não afeta o Admin logado na primary)
      await secondaryAuth.signOut();

      // 4. Escreve o perfil na subcoleção de usuários do tenant
      await setDoc(doc(db, "users", raiz, "usuarios", novoUid), {
        nome,
        email,
        cargo:      novoCargo,
        vendedorId: novoCargo === "vendedor" ? vendedorId : null,
        ativo:      true,
        criadoEm:   serverTimestamp(),
        criadoPor:  user.uid,
      });

      // 5. Cria o índice reverso — AuthContext usa isso para identificar o tenant
      await setDoc(doc(db, "userIndex", novoUid), {
        tenantUid: raiz,
        criadoEm:  serverTimestamp(),
      });

      fecharModal();
      mostrarToast(`Usuário "${nome}" criado com sucesso.`);
    } catch (err) {
      console.error("[Usuarios] Erro ao criar usuário:", err);
      if (err.code === "auth/email-already-in-use") {
        setErro("Este e-mail já está em uso em outra conta.");
      } else if (err.code === "auth/invalid-email") {
        setErro("E-mail inválido.");
      } else if (err.code === "auth/weak-password") {
        setErro("Senha muito fraca. Use pelo menos 6 caracteres.");
      } else {
        setErro("Erro ao criar usuário. Tente novamente.");
      }
    } finally {
      setSalvando(false);
    }
  }

  /* ── Editar usuário (cargo e vendedorId) ── */
  async function editarUsuario({ nome, cargo: novoCargo, vendedorId }, setErro) {
    setSalvando(true);
    try {
      const docRef = doc(db, "users", raiz, "usuarios", usuarioEditando.uid);
      await updateDoc(docRef, {
        nome,
        cargo: novoCargo,
        vendedorId: novoCargo === "vendedor" ? vendedorId : null,
        atualizadoEm: serverTimestamp(),
      });
      fecharModal();
      mostrarToast(`Usuário "${nome}" atualizado.`);
    } catch (err) {
      console.error("[Usuarios] Erro ao editar:", err);
      setErro("Não foi possível salvar as alterações.");
    } finally {
      setSalvando(false);
    }
  }

  /* ── Roteador: criar ou editar ── */
  function handleSalvar(dados, setErro) {
    if (usuarioEditando) {
      editarUsuario(dados, setErro);
    } else {
      criarUsuario(dados, setErro);
    }
  }

  /* ── Toggle ativo/inativo ── */
  async function toggleAtivo(usr) {
    const novoStatus = !usr.ativo;
    const acao = novoStatus ? "ativar" : "desativar";
    if (!window.confirm(
      `Deseja ${acao} o acesso de "${usr.nome}"?\n` +
      (novoStatus
        ? "O usuário voltará a conseguir logar no sistema."
        : "O usuário perderá o acesso, mas seus dados históricos serão preservados.")
    )) return;

    try {
      await updateDoc(doc(db, "users", raiz, "usuarios", usr.uid), {
        ativo: novoStatus,
        atualizadoEm: serverTimestamp(),
      });
      mostrarToast(
        novoStatus ? `"${usr.nome}" reativado.` : `"${usr.nome}" desativado.`
      );
    } catch (err) {
      console.error("[Usuarios] Erro ao alterar status:", err);
      mostrarToast("Erro ao alterar status.", "erro");
    }
  }

  /* ─────────────────────────────────────────
     RENDER: acesso negado
  ───────────────────────────────────────── */
  if (!isAdmin) {
    return (
      <>
        <style>{CSS}</style>
        <div className="usr-root">
          <div className="usr-acesso-negado">
            <div className="usr-acesso-negado-icon">🔒</div>
            <h3>Acesso restrito</h3>
            <p>
              O módulo de Usuários é exclusivo para o <strong>Administrador</strong> da conta.
              Entre em contato com o responsável caso precise de alterações.
            </p>
          </div>
        </div>
      </>
    );
  }

  /* ─────────────────────────────────────────
     RENDER: loading
  ───────────────────────────────────────── */
  if (loading) {
    return (
      <>
        <style>{CSS}</style>
        <div className="usr-root">
          <div className="usr-loading">Carregando usuários…</div>
        </div>
      </>
    );
  }

  /* ─────────────────────────────────────────
     RENDER PRINCIPAL
  ───────────────────────────────────────── */
  const limiteAtingido = totalAtivos >= MAX_USUARIOS;

  return (
    <>
      <style>{CSS}</style>

      <div className="usr-root">

        {/* ── Topbar ── */}
        <div className="usr-topbar">
          <div className="usr-topbar-title">
            <h2>Usuários</h2>
            <p>Gerencie os acessos da sua equipe</p>
          </div>

          <div className="usr-topbar-spacer" />

          <div className="usr-counter">
            <span>{totalAtivos}</span>/{MAX_USUARIOS} usuários ativos
          </div>

          <button
            className="usr-btn-convidar"
            onClick={() => { setUsuarioEditando(null); setModalAberto(true); }}
            disabled={limiteAtingido}
            title={limiteAtingido ? `Limite de ${MAX_USUARIOS} usuários atingido` : "Convidar novo usuário"}
          >
            + Convidar usuário
          </button>
        </div>

        {/* ── Aviso de limite ── */}
        {limiteAtingido && (
          <div style={{
            padding: "10px 20px",
            background: "rgba(245,158,11,0.08)",
            borderBottom: "1px solid rgba(245,158,11,0.2)",
            fontSize: 12,
            color: "var(--amber)",
          }}>
            ⚠️ Limite de {MAX_USUARIOS} usuários adicionais atingido. Desative um usuário para liberar uma vaga.
          </div>
        )}

        {/* ── Tabela ── */}
        <div className="usr-table-wrap">
          {usuarios.length === 0 ? (
            <div className="usr-empty">
              <div className="usr-empty-icon">👥</div>
              <h3>Nenhum usuário adicionado ainda</h3>
              <p>Clique em "Convidar usuário" para dar acesso à sua equipe.</p>
            </div>
          ) : (
            <table className="usr-table">
              <thead>
                <tr>
                  <th>Usuário</th>
                  <th>Cargo</th>
                  <th>Vendedor vinculado</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {/* ── Linha do Admin (sempre no topo) ── */}
                <tr className="usr-row-admin">
                  <td>
                    <div className="usr-user-cell">
                      <div className="usr-avatar">
                        {inicialNome(user.displayName || user.email)}
                      </div>
                      <div>
                        <div className="usr-user-name">
                          {user.displayName || "Administrador"}
                        </div>
                        <div className="usr-user-email">{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td><BadgeCargo cargo="admin" /></td>
                  <td><span style={{ color: "var(--text-3)", fontSize: 12 }}>—</span></td>
                  <td>
                    <span className="usr-badge-ativo ativo">
                      <span className="usr-dot ativo" />Ativo
                    </span>
                  </td>
                  <td>
                    <span style={{ fontSize: 11, color: "var(--text-3)" }}>Proprietário da conta</span>
                  </td>
                </tr>

                {/* ── Usuários adicionais ── */}
                {usuarios.map((usr) => {
                  const isAtivo = usr.ativo !== false;
                  const vendedorNome = usr.vendedorId
                    ? vendedores.find((v) => v.id === usr.vendedorId)?.nome
                    : null;

                  return (
                    <tr key={usr.uid}>
                      <td>
                        <div className="usr-user-cell">
                          <div className={`usr-avatar${isAtivo ? "" : " inativo"}`}>
                            {inicialNome(usr.nome)}
                          </div>
                          <div>
                            <div className={`usr-user-name${isAtivo ? "" : " inativo"}`}>
                              {usr.nome}
                            </div>
                            <div className="usr-user-email">{usr.email}</div>
                          </div>
                        </div>
                      </td>

                      <td><BadgeCargo cargo={usr.cargo} /></td>

                      <td>
                        {vendedorNome ? (
                          <span style={{
                            fontSize: 12,
                            background: "rgba(62,207,142,0.1)",
                            color: "var(--green)",
                            padding: "2px 8px",
                            borderRadius: 12,
                          }}>
                            ✓ {vendedorNome}
                          </span>
                        ) : usr.cargo === "vendedor" ? (
                          <span style={{
                            fontSize: 12,
                            background: "rgba(224,82,82,0.08)",
                            color: "var(--red)",
                            padding: "2px 8px",
                            borderRadius: 12,
                          }}>
                            ⚠ Sem vínculo
                          </span>
                        ) : (
                          <span style={{ color: "var(--text-3)", fontSize: 12 }}>—</span>
                        )}
                      </td>

                      <td>
                        <span className={`usr-badge-ativo ${isAtivo ? "ativo" : "inativo"}`}>
                          <span className={`usr-dot ${isAtivo ? "ativo" : "inativo"}`} />
                          {isAtivo ? "Ativo" : "Inativo"}
                        </span>
                      </td>

                      <td>
                        <div className="usr-acoes">
                          <button
                            className="usr-btn-acao editar"
                            onClick={() => abrirEditar(usr)}
                          >
                            Editar
                          </button>
                          <button
                            className={`usr-btn-acao ${isAtivo ? "desativar" : "ativar"}`}
                            onClick={() => toggleAtivo(usr)}
                          >
                            {isAtivo ? "Desativar" : "Reativar"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Modal ── */}
        {modalAberto && (
          <ModalUsuario
            usuario={usuarioEditando}
            vendedores={vendedores}
            onSalvar={handleSalvar}
            onFechar={fecharModal}
            salvando={salvando}
          />
        )}

        {/* ── Toast ── */}
        {toast && (
          <div className={`usr-toast ${toast.tipo}`}>
            {toast.tipo === "sucesso" ? "✓" : "⚠️"} {toast.msg}
          </div>
        )}

      </div>
    </>
  );
}
